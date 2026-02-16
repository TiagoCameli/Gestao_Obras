import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToSaidaMaterial, saidaMaterialToDb } from '../lib/mappers';
import type { SaidaMaterial } from '../types';

export function useSaidasMaterial() {
  return useQuery({
    queryKey: ['saidas_material'],
    queryFn: async () => {
      const { data, error } = await supabase.from('saidas_material').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToSaidaMaterial);
    },
  });
}

export function useAdicionarSaidaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (saida: SaidaMaterial) => {
      const { error } = await supabase.from('saidas_material').insert(saidaMaterialToDb(saida));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saidas_material'] }),
  });
}

export function useAtualizarSaidaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (saida: SaidaMaterial) => {
      const { error } = await supabase
        .from('saidas_material')
        .update(saidaMaterialToDb(saida))
        .eq('id', saida.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saidas_material'] }),
  });
}

export function useExcluirSaidaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saidas_material').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saidas_material'] }),
  });
}
