import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTransferenciaCombustivel, transferenciaCombustivelToDb } from '../lib/mappers';
import type { TransferenciaCombustivel } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useTransferenciasCombustivel() {
  return useQuery({
    queryKey: ['transferencias_combustivel'],
    queryFn: async () => {
      // F8.4 — soft delete: filtra deleted_at IS NULL (registros ativos).
      const { data, error } = await supabase
        .from('transferencias_combustivel')
        .select('*')
        .is('deleted_at', null);
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
  const { usuario } = useAuth();
  return useMutation({
    // F8.4 — soft delete: marca deleted_at + deleted_by em vez de DELETE.
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transferencias_combustivel')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}
