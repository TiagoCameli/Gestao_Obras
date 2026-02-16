import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToFrete, freteToDb } from '../lib/mappers';
import type { Frete } from '../types';

export function useFretes() {
  return useQuery({
    queryKey: ['fretes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fretes').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToFrete);
    },
  });
}

export function useAdicionarFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (frete: Frete) => {
      const { error } = await supabase.from('fretes').insert(freteToDb(frete));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fretes'] });
    },
  });
}

export function useAtualizarFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (frete: Frete) => {
      const { error } = await supabase
        .from('fretes')
        .update(freteToDb(frete))
        .eq('id', frete.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fretes'] });
    },
  });
}

export function useExcluirFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fretes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fretes'] });
    },
  });
}
