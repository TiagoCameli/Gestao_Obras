import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToPedidoCompra, pedidoCompraToDb } from '../lib/mappers';
import type { PedidoCompra } from '../types';

export function usePedidosCompra() {
  return useQuery({
    queryKey: ['pedidos_compra'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pedidos_compra').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToPedidoCompra);
    },
  });
}

export function useAdicionarPedidoCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedido: PedidoCompra) => {
      const { error } = await supabase.from('pedidos_compra').insert(pedidoCompraToDb(pedido));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos_compra'] }),
  });
}

export function useAtualizarPedidoCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedido: PedidoCompra) => {
      const { error } = await supabase
        .from('pedidos_compra')
        .update(pedidoCompraToDb(pedido))
        .eq('id', pedido.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos_compra'] }),
  });
}

export function useExcluirPedidoCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pedidos_compra').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos_compra'] }),
  });
}
