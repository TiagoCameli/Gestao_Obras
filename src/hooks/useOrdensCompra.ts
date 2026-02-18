import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToOrdemCompra, ordemCompraToDb } from '../lib/mappers';
import type { OrdemCompra } from '../types';

export function useOrdensCompra() {
  return useQuery({
    queryKey: ['ordens_compra'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ordens_compra').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToOrdemCompra);
    },
  });
}

export function useAdicionarOrdemCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oc: OrdemCompra) => {
      const { error } = await supabase.from('ordens_compra').insert(ordemCompraToDb(oc));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordens_compra'] }),
  });
}

export function useAtualizarOrdemCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oc: OrdemCompra) => {
      const { error } = await supabase
        .from('ordens_compra')
        .update(ordemCompraToDb(oc))
        .eq('id', oc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordens_compra'] }),
  });
}

export function useExcluirOrdemCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ordens_compra').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordens_compra'] }),
  });
}
