import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEntradaMaterial, entradaMaterialToDb } from '../lib/mappers';
import type { EntradaMaterial } from '../types';

export function useEntradasMaterial() {
  return useQuery({
    queryKey: ['entradas_material'],
    queryFn: async () => {
      const { data, error } = await supabase.from('entradas_material').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToEntradaMaterial);
    },
  });
}

export function useAdicionarEntradaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaMaterial) => {
      const { error } = await supabase.from('entradas_material').insert(entradaMaterialToDb(entrada));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entradas_material'] }),
  });
}

export function useAtualizarEntradaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaMaterial) => {
      const { error } = await supabase
        .from('entradas_material')
        .update(entradaMaterialToDb(entrada))
        .eq('id', entrada.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entradas_material'] }),
  });
}

export function useExcluirEntradaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('entradas_material').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entradas_material'] }),
  });
}

/** Insert em lote pro import via Excel. Um único .insert(array) — não N chamadas. */
export function useImportarEntradasMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entradas: EntradaMaterial[]) => {
      if (entradas.length === 0) return;
      const { data, error } = await supabase
        .from('entradas_material')
        .insert(entradas.map(entradaMaterialToDb))
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nenhuma entrada foi importada — possível negação de permissão (RLS).');
      }
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['entradas_material'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_total'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_deposito'] }),
      ]),
  });
}
