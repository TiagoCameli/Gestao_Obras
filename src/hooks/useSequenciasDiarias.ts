import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToSequenciaDiaria, sequenciaDiariaToDb } from '../lib/mappers';
import type { SequenciaDiaria } from '../types';

export function useSequenciasDiarias() {
  return useQuery({
    queryKey: ['sequencias_diarias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sequencias_diarias')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToSequenciaDiaria);
    },
  });
}

export function useAdicionarSequenciaDiaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seq: SequenciaDiaria) => {
      const { error } = await supabase.from('sequencias_diarias').insert(sequenciaDiariaToDb(seq));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequencias_diarias'] }),
  });
}

export function useAtualizarSequenciaDiaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seq: SequenciaDiaria) => {
      const { error } = await supabase.from('sequencias_diarias').update(sequenciaDiariaToDb(seq)).eq('id', seq.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequencias_diarias'] }),
  });
}

export function useExcluirSequenciaDiaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sequencias_diarias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequencias_diarias'] });
      qc.invalidateQueries({ queryKey: ['registros_horas_diaristas'] });
    },
  });
}
