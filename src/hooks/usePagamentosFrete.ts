import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToPagamentoFrete, pagamentoFreteToDb } from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import type { PagamentoFrete } from '../types';

// FF.4 — soft delete: lista padrão omite registros com deleted_at preenchido.
export function usePagamentosFrete() {
  return useQuery({
    queryKey: ['pagamentos_frete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_frete')
        .select('*')
        .is('deleted_at', null);
      if (error) throw error;
      return (data ?? []).map(dbToPagamentoFrete);
    },
  });
}

export function usePagamentosFreteDeletados() {
  return useQuery({
    queryKey: ['pagamentos_frete_deletados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_frete')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
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
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pagamentos_frete')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagamentos_frete'] });
      qc.invalidateQueries({ queryKey: ['pagamentos_frete_deletados'] });
    },
  });
}

export function useRestaurarPagamentoFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pagamentos_frete')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagamentos_frete'] });
      qc.invalidateQueries({ queryKey: ['pagamentos_frete_deletados'] });
    },
  });
}
