import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTransferenciaCombustivel, transferenciaCombustivelToDb } from '../lib/mappers';
import type { TransferenciaCombustivel } from '../types';

export function useTransferenciasCombustivel() {
  return useQuery({
    queryKey: ['transferencias_combustivel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transferencias_combustivel').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToTransferenciaCombustivel);
    },
  });
}

export function useAdicionarTransferenciaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferencia: TransferenciaCombustivel) => {
      const { error } = await supabase
        .from('transferencias_combustivel')
        .insert(transferenciaCombustivelToDb(transferencia));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}

export function useExcluirTransferenciaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transferencias_combustivel').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}
