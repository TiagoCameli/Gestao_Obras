import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToColaborador, colaboradorToDb } from '../lib/mappers';
import type { Colaborador } from '../types';

export function useColaboradores() {
  return useQuery({
    queryKey: ['colaboradores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('colaboradores').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToColaborador);
    },
  });
}

export function useAdicionarColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (colaborador: Colaborador) => {
      const { error } = await supabase.from('colaboradores').insert(colaboradorToDb(colaborador));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colaboradores'] }),
  });
}

export function useAtualizarColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (colaborador: Colaborador) => {
      const { error } = await supabase.from('colaboradores').update(colaboradorToDb(colaborador)).eq('id', colaborador.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colaboradores'] }),
  });
}

export function useExcluirColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('colaboradores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colaboradores'] }),
  });
}
