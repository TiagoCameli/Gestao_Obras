import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToFinanceiroEquipamento, financeiroEquipamentoToDb } from '../lib/mappers';
import type { FinanceiroEquipamento } from '../types';

export function useFinanceiroEquipamento(equipamentoId: string | null | undefined) {
  return useQuery<FinanceiroEquipamento | null>({
    queryKey: ['financeiro_equipamento', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_equipamento')
        .select('*')
        .eq('equipamento_id', equipamentoId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return dbToFinanceiroEquipamento(data);
    },
  });
}

export function useSalvarFinanceiroEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fin: FinanceiroEquipamento) => {
      const { error } = await supabase
        .from('financeiro_equipamento')
        .upsert(financeiroEquipamentoToDb(fin), { onConflict: 'equipamento_id' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['financeiro_equipamento', variables.equipamentoId] });
    },
  });
}
