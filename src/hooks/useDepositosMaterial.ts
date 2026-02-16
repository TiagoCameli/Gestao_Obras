import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToDepositoMaterial, depositoMaterialToDb } from '../lib/mappers';
import type { DepositoMaterial } from '../types';

export function useDepositosMaterial() {
  return useQuery({
    queryKey: ['depositos_material'],
    queryFn: async () => {
      const { data, error } = await supabase.from('depositos_material').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToDepositoMaterial);
    },
  });
}

export function useAdicionarDepositoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dep: DepositoMaterial) => {
      const { error } = await supabase.from('depositos_material').insert(depositoMaterialToDb(dep));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depositos_material'] }),
  });
}

export function useAtualizarDepositoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dep: DepositoMaterial) => {
      const { error } = await supabase.from('depositos_material').update(depositoMaterialToDb(dep)).eq('id', dep.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depositos_material'] }),
  });
}

export function useExcluirDepositoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('depositos_material').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depositos_material'] }),
  });
}
