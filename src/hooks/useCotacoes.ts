import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToCotacao, cotacaoToDb } from '../lib/mappers';
import type { Cotacao } from '../types';

export function useCotacoes() {
  return useQuery({
    queryKey: ['cotacoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cotacoes').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToCotacao);
    },
  });
}

export function useAdicionarCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cotacao: Cotacao) => {
      const { error } = await supabase.from('cotacoes').insert(cotacaoToDb(cotacao));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotacoes'] }),
  });
}

export function useAtualizarCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cotacao: Cotacao) => {
      const { error } = await supabase
        .from('cotacoes')
        .update(cotacaoToDb(cotacao))
        .eq('id', cotacao.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotacoes'] }),
  });
}

export function useExcluirCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cotacoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotacoes'] }),
  });
}
