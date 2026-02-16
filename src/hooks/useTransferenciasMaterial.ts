import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTransferenciaMaterial, transferenciaMaterialToDb } from '../lib/mappers';
import type { TransferenciaMaterial } from '../types';

export function useTransferenciasMaterial() {
  return useQuery({
    queryKey: ['transferencias_material'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transferencias_material').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToTransferenciaMaterial);
    },
  });
}

export function useAdicionarTransferenciaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferencia: TransferenciaMaterial) => {
      const { error } = await supabase
        .from('transferencias_material')
        .insert(transferenciaMaterialToDb(transferencia));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transferencias_material'] }),
  });
}

export function useExcluirTransferenciaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transferencias_material').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transferencias_material'] }),
  });
}
