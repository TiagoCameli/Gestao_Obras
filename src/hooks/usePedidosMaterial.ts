import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToPedidoMaterial, pedidoMaterialToDb } from '../lib/mappers';
import type { PedidoMaterial } from '../types';

export function usePedidosMaterial() {
  return useQuery({
    queryKey: ['pedidos_material'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pedidos_material').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToPedidoMaterial);
    },
  });
}

export function useAdicionarPedidoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedido: PedidoMaterial) => {
      const { error } = await supabase.from('pedidos_material').insert(pedidoMaterialToDb(pedido));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos_material'] });
    },
  });
}

export function useAtualizarPedidoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedido: PedidoMaterial) => {
      const { error } = await supabase
        .from('pedidos_material')
        .update(pedidoMaterialToDb(pedido))
        .eq('id', pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos_material'] });
    },
  });
}

export function useExcluirPedidoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pedidos_material').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos_material'] });
    },
  });
}
