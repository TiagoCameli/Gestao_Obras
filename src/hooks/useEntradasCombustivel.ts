import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEntradaCombustivel, entradaCombustivelToDb } from '../lib/mappers';
import type { EntradaCombustivel } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useEntradasCombustivel() {
  return useQuery({
    queryKey: ['entradas_combustivel'],
    queryFn: async () => {
      // F8.4 — soft delete: filtra deleted_at IS NULL (registros ativos).
      const { data, error } = await supabase
        .from('entradas_combustivel')
        .select('*')
        .is('deleted_at', null);
      if (error) throw error;
      return (data ?? []).map(dbToEntradaCombustivel);
    },
  });
}

export function useAdicionarEntradaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaCombustivel) => {
      const { error } = await supabase.from('entradas_combustivel').insert(entradaCombustivelToDb(entrada));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}

export function useAtualizarEntradaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaCombustivel) => {
      const { error } = await supabase
        .from('entradas_combustivel')
        .update(entradaCombustivelToDb(entrada))
        .eq('id', entrada.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}

// F10 — Lixeira
export function useEntradasCombustivelDeletadas() {
  return useQuery({
    queryKey: ['entradas_combustivel', 'deletadas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entradas_combustivel')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row: { deleted_at: string | null; deleted_by: string | null }) => ({
        ...dbToEntradaCombustivel(row),
        deletedAt: row.deleted_at,
        deletedBy: row.deleted_by,
      }));
    },
  });
}

export function useRestaurarEntradaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('entradas_combustivel')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['entradas_combustivel', 'deletadas'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}

export function useExcluirEntradaCombustivel() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    // F8.4 — soft delete: marca deleted_at + deleted_by em vez de DELETE.
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('entradas_combustivel')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}
