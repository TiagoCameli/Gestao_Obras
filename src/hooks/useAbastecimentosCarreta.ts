import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToAbastecimentoCarreta, abastecimentoCarretaToDb } from '../lib/mappers';
import type { AbastecimentoCarreta } from '../types';

export function useAbastecimentosCarreta() {
  return useQuery({
    queryKey: ['abastecimentos_carreta'],
    queryFn: async () => {
      const { data, error } = await supabase.from('abastecimentos_carreta').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToAbastecimentoCarreta);
    },
  });
}

export function useAdicionarAbastecimentoCarreta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (abast: AbastecimentoCarreta) => {
      const { error } = await supabase.from('abastecimentos_carreta').insert(abastecimentoCarretaToDb(abast));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abastecimentos_carreta'] });
    },
  });
}

export function useAtualizarAbastecimentoCarreta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (abast: AbastecimentoCarreta) => {
      const { error } = await supabase
        .from('abastecimentos_carreta')
        .update(abastecimentoCarretaToDb(abast))
        .eq('id', abast.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abastecimentos_carreta'] });
    },
  });
}

export function useExcluirAbastecimentoCarreta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('abastecimentos_carreta').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abastecimentos_carreta'] });
    },
  });
}
