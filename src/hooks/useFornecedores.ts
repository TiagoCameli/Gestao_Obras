import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToFornecedor, fornecedorToDb } from '../lib/mappers';
import type { Fornecedor } from '../types';

export function useFornecedores() {
  return useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fornecedores').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToFornecedor);
    },
  });
}

export function useAdicionarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fornecedor: Fornecedor) => {
      const { error } = await supabase.from('fornecedores').insert(fornecedorToDb(fornecedor));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  });
}

export function useAtualizarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fornecedor: Fornecedor) => {
      const { error } = await supabase.from('fornecedores').update(fornecedorToDb(fornecedor)).eq('id', fornecedor.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  });
}

export function useExcluirFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fornecedores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  });
}
