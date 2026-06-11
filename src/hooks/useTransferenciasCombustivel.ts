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

export function useAtualizarTransferenciaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferencia: TransferenciaCombustivel) => {
      const { data, error } = await supabase
        .from('transferencias_combustivel')
        .update(transferenciaCombustivelToDb(transferencia))
        .eq('id', transferencia.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Falha ao salvar: sem permissão ou nenhuma linha alterada.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
      // O recompute FIFO no banco reprecifica as saídas dos tanques afetados.
      qc.invalidateQueries({ queryKey: ['saidas_combustivel'] });
    },
  });
}

// F10 — Lixeira
export function useTransferenciasCombustivelDeletadas() {
  return useQuery({
    queryKey: ['transferencias_combustivel', 'deletadas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transferencias_combustivel')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row: { deleted_at: string | null; deleted_by: string | null }) => ({
        ...dbToTransferenciaCombustivel(row),
        deletedAt: row.deleted_at,
        deletedBy: row.deleted_by,
      }));
    },
  });
}

export function useRestaurarTransferenciaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transferencias_combustivel')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] });
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel', 'deletadas'] });
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
