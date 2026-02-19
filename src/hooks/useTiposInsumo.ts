import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTipoInsumo, tipoInsumoToDb } from '../lib/mappers';
import type { TipoInsumoEntity } from '../types';

export function useTiposInsumo() {
  return useQuery({
    queryKey: ['tipos_insumo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_insumo').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToTipoInsumo);
    },
  });
}

export function useAdicionarTipoInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipo: TipoInsumoEntity) => {
      const { error } = await supabase.from('tipos_insumo').insert(tipoInsumoToDb(tipo));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos_insumo'] }),
  });
}

export function useAtualizarTipoInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipo: TipoInsumoEntity) => {
      const { error } = await supabase.from('tipos_insumo').update(tipoInsumoToDb(tipo)).eq('id', tipo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos_insumo'] }),
  });
}

export function useExcluirTipoInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tipos_insumo').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos_insumo'] }),
  });
}
