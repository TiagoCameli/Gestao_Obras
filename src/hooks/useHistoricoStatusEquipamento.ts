import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToHistoricoStatusEquipamento, historicoStatusEquipamentoToDb } from '../lib/mappers';
import type { HistoricoStatusEquipamento, StatusEquipamento } from '../types';

/**
 * Histórico de mudanças de status de um equipamento (mais recente primeiro).
 */
export function useHistoricoStatusEquipamento(equipamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ['historico_status_equipamento', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_status_equipamento')
        .select('*')
        .eq('equipamento_id', equipamentoId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToHistoricoStatusEquipamento);
    },
  });
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface MudarStatusParams {
  equipamentoId: string;
  statusDe: StatusEquipamento;
  statusPara: StatusEquipamento;
  motivo: string;
  observacoes?: string;
  /** Se vier de uma OS futura. */
  osId?: string | null;
  usuarioNome: string;
}

/**
 * Muda o status do equipamento E grava no histórico em duas chamadas:
 *   1. UPDATE equipamentos SET status, ativo
 *   2. INSERT historico_status_equipamento
 *
 * Idealmente seria uma transação RPC no DB, mas como o tempo entre as duas
 * é < 100ms e o impacto de falha parcial é só "histórico faltando", aceitamos.
 * Em caso de falha do INSERT, logamos no console — o UPDATE permanece.
 */
export function useChangeStatusEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: MudarStatusParams) => {
      const { equipamentoId, statusDe, statusPara, motivo, observacoes, osId, usuarioNome } = params;

      // No-op se não houve mudança
      if (statusDe === statusPara) return;

      // 1) Atualiza equipamento
      const { error: updErr } = await supabase
        .from('equipamentos')
        .update({
          status: statusPara,
          ativo: statusPara !== 'fora_funcionamento',
        })
        .eq('id', equipamentoId);
      if (updErr) throw updErr;

      // 2) Grava histórico
      const historico: HistoricoStatusEquipamento = {
        id: gerarId(),
        equipamentoId,
        statusDe,
        statusPara,
        motivo: motivo.trim(),
        observacoes: observacoes?.trim() ?? '',
        osId: osId ?? null,
        createdAt: new Date().toISOString(),
        createdBy: usuarioNome,
      };
      const { error: histErr } = await supabase
        .from('historico_status_equipamento')
        .insert(historicoStatusEquipamentoToDb(historico));
      if (histErr) {
        // Log mas não derruba a UI — o status já foi mudado
        console.error('[useChangeStatusEquipamento] histórico falhou:', histErr);
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      qc.invalidateQueries({ queryKey: ['historico_status_equipamento', variables.equipamentoId] });
    },
  });
}
