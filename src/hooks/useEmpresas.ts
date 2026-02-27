import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEmpresa, empresaToDb } from '../lib/mappers';
import type { Empresa } from '../types';

export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToEmpresa);
    },
  });
}

export function useAdicionarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (empresa: Empresa) => {
      const { error } = await supabase.from('empresas').insert(empresaToDb(empresa));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresas'] }),
  });
}

export function useAtualizarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (empresa: Empresa) => {
      const { error } = await supabase.from('empresas').update(empresaToDb(empresa)).eq('id', empresa.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresas'] }),
  });
}

export function useExcluirEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('empresas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresas'] }),
  });
}
