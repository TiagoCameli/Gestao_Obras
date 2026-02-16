import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToObra, obraToDb } from '../lib/mappers';
import type { Obra } from '../types';

export function useObras() {
  return useQuery({
    queryKey: ['obras'],
    queryFn: async () => {
      const { data, error } = await supabase.from('obras').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToObra);
    },
  });
}

export function useAdicionarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obra: Obra) => {
      const { error } = await supabase.from('obras').insert(obraToDb(obra));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obras'] }),
  });
}

export function useAtualizarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obra: Obra) => {
      const { error } = await supabase.from('obras').update(obraToDb(obra)).eq('id', obra.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obras'] }),
  });
}

export function useExcluirObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('obras').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras'] });
      qc.invalidateQueries({ queryKey: ['etapas'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos_material'] });
    },
  });
}
