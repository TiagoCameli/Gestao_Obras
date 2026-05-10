import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToPedidoMaterial, pedidoMaterialToDb } from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import type { PedidoMaterial } from '../types';

// FF.4 — soft delete: lista padrão omite registros com deleted_at preenchido.
export function usePedidosMaterial() {
  return useQuery({
    queryKey: ['pedidos_material'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_material')
        .select('*')
        .is('deleted_at', null);
      if (error) throw error;
      return (data ?? []).map(dbToPedidoMaterial);
    },
  });
}

export function usePedidosMaterialDeletados() {
  return useQuery({
    queryKey: ['pedidos_material_deletados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_material')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
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
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pedidos_material')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos_material'] });
      qc.invalidateQueries({ queryKey: ['pedidos_material_deletados'] });
    },
  });
}

export function useRestaurarPedidoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pedidos_material')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos_material'] });
      qc.invalidateQueries({ queryKey: ['pedidos_material_deletados'] });
    },
  });
}
