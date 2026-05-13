// Marco 5 / PR27 — Hook unificado de sincronização offline.
//
// Substitui o useChecklistSync (PR25b) por uma versão que orquestra as 3
// filas: checklists, medições e OS criadas pelo mobile.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  listPendingChecklists,
  countPendingChecklists,
  removeChecklist,
  markChecklistAttempt,
  indexedDBSuportado,
} from '../lib/checklistsQueue';
import {
  listPendingMedicoes,
  countPendingMedicoes,
  removeMedicao,
  markMedicaoAttempt,
  listPendingOSNovas,
  countPendingOSNovas,
  removeOSNova,
  markOSNovaAttempt,
} from '../lib/offlineQueue';
import { useEnviarChecklist } from './useChecklists';
import type { MedicaoEquipamento } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface UseOfflineSyncResult {
  totalPendentes: number;
  countChecklists: number;
  countMedicoes: number;
  countOS: number;
  status: SyncStatus;
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
  online: boolean;
}

function gerarId(prefix: string) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function useOfflineSync(): UseOfflineSyncResult {
  const qc = useQueryClient();
  const enviarChecklist = useEnviarChecklist();
  const [countChecklists, setCountChecklists] = useState(0);
  const [countMedicoes, setCountMedicoes] = useState(0);
  const [countOS, setCountOS] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!indexedDBSuportado()) return;
    try {
      const [c, m, o] = await Promise.all([
        countPendingChecklists(),
        countPendingMedicoes(),
        countPendingOSNovas(),
      ]);
      setCountChecklists(c);
      setCountMedicoes(m);
      setCountOS(o);
    } catch (err) {
      console.error('[offline-sync] refresh falhou', err);
    }
  }, []);

  const syncChecklists = useCallback(async () => {
    const fila = await listPendingChecklists();
    for (const item of fila) {
      try {
        await enviarChecklist.mutateAsync({
          templateId: item.templateId,
          templateVersao: item.templateVersao,
          equipamentoId: item.equipamentoId,
          operadorFuncionarioId: item.operadorFuncionarioId,
          operadorNome: item.operadorNome,
          medicaoAtual: item.medicaoAtual,
          status: item.status,
          observacoesGerais: item.observacoesGerais,
          respostas: item.respostas.map((r) => ({
            perguntaId: r.perguntaId,
            perguntaSnapshot: r.perguntaSnapshot,
            resposta: r.resposta,
            observacao: r.observacao,
            fotoBlob: r.fotoBlob,
          })),
        });
        await removeChecklist(item.localId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro';
        await markChecklistAttempt(item.localId, msg);
      }
    }
  }, [enviarChecklist]);

  const syncMedicoes = useCallback(async () => {
    const fila = await listPendingMedicoes();
    for (const item of fila) {
      try {
        const payload: Partial<MedicaoEquipamento> & { id: string } = {
          id: gerarId('med'),
          equipamentoId: item.equipamentoId,
          data: item.data,
          tipoMedicao: item.tipoMedicao,
          valor: item.valor,
          origem: item.origem,
          origemId: null,
          observacoes: item.observacoes,
          fotoUrls: [],
          arquivoUrls: [],
          createdBy: item.operadorNome,
        };
        const { error } = await supabase.from('medicoes_equipamento').insert({
          id: payload.id,
          equipamento_id: payload.equipamentoId,
          data: payload.data,
          tipo_medicao: payload.tipoMedicao,
          valor: payload.valor,
          origem: payload.origem,
          origem_id: payload.origemId,
          observacoes: payload.observacoes,
          foto_urls: payload.fotoUrls,
          arquivo_urls: payload.arquivoUrls,
          created_by: payload.createdBy,
        });
        if (error) throw error;
        await removeMedicao(item.localId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro';
        await markMedicaoAttempt(item.localId, msg);
      }
    }
    qc.invalidateQueries({ queryKey: ['medicoes_equipamento'] });
    qc.invalidateQueries({ queryKey: ['medicao_atual'] });
  }, [qc]);

  const syncOSNovas = useCallback(async () => {
    const fila = await listPendingOSNovas();
    for (const item of fila) {
      try {
        // Gera número via RPC
        const { data: numero, error: numErr } = await supabase.rpc('gerar_numero_os');
        if (numErr) throw numErr;

        const osId = gerarId('os');

        // Upload de fotos (array). Compat com fotoBlob legado.
        const blobsParaUpload: Blob[] = [
          ...(item.fotoBlobs ?? []),
          ...(item.fotoBlob ? [item.fotoBlob] : []),
        ];
        const fotoUrls: string[] = [];
        for (let i = 0; i < blobsParaUpload.length; i++) {
          const blob = blobsParaUpload[i];
          const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
          const path = `os/${osId}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('apontamento-fotos')
            .upload(path, blob, { contentType: blob.type });
          if (!upErr) {
            const { data: signed } = await supabase.storage
              .from('apontamento-fotos')
              .createSignedUrl(path, 60 * 60 * 24 * 365);
            if (signed?.signedUrl) fotoUrls.push(signed.signedUrl);
          }
        }

        const now = new Date().toISOString();
        const { error: osErr } = await supabase.from('ordens_servico').insert({
          id: osId,
          numero,
          equipamento_id: item.equipamentoId,
          tipo: item.tipo,
          prioridade: item.prioridade,
          status: 'aberta',
          origem: 'manual',
          origem_id: null,
          atividade_id: null,
          obra_id: null,
          solicitante_id: '',
          responsavel_id: '',
          fornecedor_servico_id: null,
          data_prevista_inicio: null,
          data_inicio_execucao: null,
          data_conclusao: null,
          prazo_atendimento: null,
          medicao_abertura: item.medicaoAbertura,
          medicao_conclusao: null,
          parada_inicio: null,
          parada_fim: null,
          defeito_reportado: item.defeitoReportado,
          sintomas: item.sintomas,
          sistemas_afetados: [],
          causa_raiz: '',
          solucao_aplicada: '',
          recomendacoes: '',
          custo_pecas: 0,
          custo_servico_terceiro: 0,
          custo_mao_obra_propria: 0,
          aprovado_por: '',
          aprovado_em: null,
          garantia_acionada: false,
          foto_urls: fotoUrls,
          arquivo_urls: [],
          observacoes: item.observacoes || `Aberta via mobile por ${item.operadorNome}`,
          data_abertura: now,
          created_by: item.operadorNome,
          updated_by: item.operadorNome,
        });
        if (osErr) throw osErr;

        await removeOSNova(item.localId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro';
        await markOSNovaAttempt(item.localId, msg);
      }
    }
    qc.invalidateQueries({ queryKey: ['ordens_servico'] });
  }, [qc]);

  const sync = useCallback(async () => {
    if (!indexedDBSuportado()) return;
    if (syncingRef.current) return;
    if (!navigator.onLine) return;

    syncingRef.current = true;
    setStatus('syncing');
    try {
      await syncChecklists();
      await syncMedicoes();
      await syncOSNovas();
      setStatus('idle');
    } catch (err) {
      console.error('[offline-sync] geral falhou', err);
      setStatus('error');
    } finally {
      syncingRef.current = false;
      await refresh();
    }
  }, [syncChecklists, syncMedicoes, syncOSNovas, refresh]);

  useEffect(() => {
    refresh();
    if (typeof navigator !== 'undefined' && navigator.onLine) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onOnline() { setOnline(true); sync(); }
    function onOffline() { setOnline(false); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [sync]);

  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return {
    totalPendentes: countChecklists + countMedicoes + countOS,
    countChecklists,
    countMedicoes,
    countOS,
    status,
    sync,
    refresh,
    online,
  };
}
