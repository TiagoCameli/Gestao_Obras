import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToInsumo, insumoToDb } from '../lib/mappers';
import type { Insumo } from '../types';

export function useInsumos() {
  return useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToInsumo);
    },
  });
}

export function useAdicionarInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insumo: Insumo) => {
      const { error } = await supabase.from('insumos').insert(insumoToDb(insumo));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insumos'] }),
  });
}

export function useAtualizarInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insumo: Insumo) => {
      const { error } = await supabase.from('insumos').update(insumoToDb(insumo)).eq('id', insumo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insumos'] }),
  });
}

export function useExcluirInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('insumos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insumos'] }),
  });
}

/** Insere vários insumos de uma vez (import de planilha). Lança erro se 0 linhas (RLS silencioso). */
export function useImportarInsumos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insumos: Insumo[]) => {
      if (insumos.length === 0) return;
      const { data, error } = await supabase
        .from('insumos')
        .insert(insumos.map(insumoToDb))
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nenhuma peça foi importada — possível negação de permissão (RLS).');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insumos'] }),
  });
}
