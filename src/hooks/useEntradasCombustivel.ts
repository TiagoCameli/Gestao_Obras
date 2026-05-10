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
