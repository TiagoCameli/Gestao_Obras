import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToAbastecimento, abastecimentoToDb } from '../lib/mappers';
import type { Abastecimento } from '../types';

export function useAbastecimentos() {
  return useQuery({
    queryKey: ['abastecimentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('abastecimentos').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToAbastecimento);
    },
  });
}

export function useAdicionarAbastecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (abastecimento: Abastecimento) => {
      const { error } = await supabase.from('abastecimentos').insert(abastecimentoToDb(abastecimento));
      if (error) throw error;
      // Trigger will auto-recalculate deposito level
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}

export function useAtualizarAbastecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (abastecimento: Abastecimento) => {
      const { error } = await supabase
        .from('abastecimentos')
        .update(abastecimentoToDb(abastecimento))
        .eq('id', abastecimento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}

export function useExcluirAbastecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('abastecimentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}
