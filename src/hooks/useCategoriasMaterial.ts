import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToCategoriaMaterial, categoriaMaterialToDb } from '../lib/mappers';
import type { CategoriaMaterial } from '../types';

export function useCategoriasMaterial() {
  return useQuery({
    queryKey: ['categorias_material'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categorias_material').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToCategoriaMaterial);
    },
  });
}

export function useAdicionarCategoriaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoria: CategoriaMaterial) => {
      const { error } = await supabase.from('categorias_material').insert(categoriaMaterialToDb(categoria));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias_material'] }),
  });
}

export function useAtualizarCategoriaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoria: CategoriaMaterial) => {
      const { error } = await supabase.from('categorias_material').update(categoriaMaterialToDb(categoria)).eq('id', categoria.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias_material'] }),
  });
}

export function useExcluirCategoriaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias_material').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias_material'] }),
  });
}
