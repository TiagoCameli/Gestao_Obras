import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEntradaCombustivel, entradaCombustivelToDb } from '../lib/mappers';
import type { EntradaCombustivel } from '../types';

export function useEntradasCombustivel() {
  return useQuery({
    queryKey: ['entradas_combustivel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('entradas_combustivel').select('*');
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
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('entradas_combustivel').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}
