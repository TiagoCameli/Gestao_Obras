import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEspecificacoesEquipamento, especificacoesEquipamentoToDb } from '../lib/mappers';
import type { EspecificacoesEquipamento } from '../types';

/**
 * Especificações técnicas de um equipamento (1 linha por equipamento, ou null
 * se ainda não foram cadastradas).
 */
export function useEspecificacoesEquipamento(equipamentoId: string | null | undefined) {
  return useQuery<EspecificacoesEquipamento | null>({
    queryKey: ['especificacoes_equipamento', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('especificacoes_equipamento')
        .select('*')
        .eq('equipamento_id', equipamentoId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return dbToEspecificacoesEquipamento(data);
    },
  });
}

/**
 * Upsert das especificações (insert se não existe, update se existe).
 * Sempre cria/sobrescreve a linha do equipamento.
 */
export function useSalvarEspecificacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spec: EspecificacoesEquipamento) => {
      const { error } = await supabase
        .from('especificacoes_equipamento')
        .upsert(especificacoesEquipamentoToDb(spec), { onConflict: 'equipamento_id' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['especificacoes_equipamento', variables.equipamentoId] });
    },
  });
}
