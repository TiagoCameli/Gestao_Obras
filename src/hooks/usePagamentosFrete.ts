import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToPagamentoFrete, pagamentoFreteToDb } from '../lib/mappers';
import type { PagamentoFrete } from '../types';

export function usePagamentosFrete() {
  return useQuery({
    queryKey: ['pagamentos_frete'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pagamentos_frete').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToPagamentoFrete);
    },
  });
}

export function useAdicionarPagamentoFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pagamento: PagamentoFrete) => {
      const { error } = await supabase.from('pagamentos_frete').insert(pagamentoFreteToDb(pagamento));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagamentos_frete'] });
    },
  });
}

export function useAtualizarPagamentoFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pagamento: PagamentoFrete) => {
      const { error } = await supabase
        .from('pagamentos_frete')
        .update(pagamentoFreteToDb(pagamento))
        .eq('id', pagamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagamentos_frete'] });
    },
  });
}

export function useExcluirPagamentoFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pagamentos_frete').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagamentos_frete'] });
    },
  });
}
