import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToApontamento, apontamentoToDb } from '../lib/mappers';
import type { Apontamento } from '../types';

export function useApontamentos() {
  return useQuery({
    queryKey: ['apontamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('apontamentos').select('*').order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToApontamento);
    },
  });
}

export function useAdicionarApontamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apontamento: Apontamento) => {
      const { error } = await supabase.from('apontamentos').insert(apontamentoToDb(apontamento));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apontamentos'] }),
  });
}

export function useAtualizarApontamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apontamento: Apontamento) => {
      const { error } = await supabase.from('apontamentos').update(apontamentoToDb(apontamento)).eq('id', apontamento.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apontamentos'] }),
  });
}

export function useExcluirApontamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('apontamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apontamentos'] }),
  });
}
