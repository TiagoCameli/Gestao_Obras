// Marco 5 / PR25b — Hook que monitora fila offline e sincroniza com Supabase.
//
// Comportamento:
// - Carrega contagem de pendentes ao montar.
// - Tenta sync ao montar (se online).
// - Listener no evento 'online' do navegador → sync automático.
// - Polling leve a cada 60s pra detectar mudanças na fila.
// - Expõe sync() manual.
// - Cada item é processado em série pra não saturar rede instável.

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  listPendingChecklists,
  countPendingChecklists,
  removeChecklist,
  markChecklistAttempt,
  indexedDBSuportado,
  type ChecklistQueueItem,
} from '../lib/checklistsQueue';
import { useEnviarChecklist } from './useChecklists';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface UseChecklistSyncResult {
  /** Total de checklists na fila offline (incluindo os que falharam). */
  count: number;
  status: SyncStatus;
  /** Itens da fila (carregados sob demanda). */
  items: ChecklistQueueItem[];
  /** Disparar sync manualmente. */
  sync: () => Promise<void>;
  /** Recarregar itens da fila (sem disparar sync). */
  refresh: () => Promise<void>;
  /** Se o navegador está online segundo navigator.onLine. */
  online: boolean;
}

export function useChecklistSync(): UseChecklistSyncResult {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<ChecklistQueueItem[]>([]);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const syncingRef = useRef(false);
  const enviar = useEnviarChecklist();

  const refresh = useCallback(async () => {
    if (!indexedDBSuportado()) return;
    try {
      const [n, list] = await Promise.all([
        countPendingChecklists(),
        listPendingChecklists(),
      ]);
      setCount(n);
      setItems(list);
    } catch (err) {
      console.error('[checklist-sync] refresh falhou', err);
    }
  }, []);

  const sync = useCallback(async () => {
    if (!indexedDBSuportado()) return;
    if (syncingRef.current) return;
    if (!navigator.onLine) return;

    syncingRef.current = true;
    setStatus('syncing');
    try {
      const fila = await listPendingChecklists();
      for (const item of fila) {
        try {
          await enviar.mutateAsync({
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
          const msg = err instanceof Error ? err.message : 'Erro de sincronização';
          await markChecklistAttempt(item.localId, msg);
          // Não pula — segue tentando os outros itens
        }
      }
      setStatus('idle');
    } catch (err) {
      console.error('[checklist-sync] sync geral falhou', err);
      setStatus('error');
    } finally {
      syncingRef.current = false;
      await refresh();
    }
  }, [enviar, refresh]);

  // Monta: carrega itens e tenta sync
  useEffect(() => {
    refresh();
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listener online/offline
  useEffect(() => {
    function onOnline() {
      setOnline(true);
      sync();
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [sync]);

  // Polling leve pra refletir mudanças (outro tab ou enqueue)
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { count, status, items, sync, refresh, online };
}
