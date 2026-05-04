import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToSaidaCombustivel, saidaCombustivelToDb } from '../lib/mappers';
import type { SaidaCombustivel } from '../types';

/**
 * Lista todas as saídas de combustível (modelo unificado pós-Fase 2).
 * Substitui useAbastecimentos + useAbastecimentosCarreta após Fase 5.
 *
 * Mutations invalidam 5 queryKeys pra manter cache coerente:
 * - ['saidas_combustivel']         — esta tabela
 * - ['transportadora_movimentos']  — trigger cria movimentos pra carretas
 * - ['transportadora_saldos']      — saldo derivado dos movimentos
 * - ['abastecimentos']             — compat shim legado lê daqui
 * - ['abastecimentos_carreta']     — idem
 */
export function useSaidasCombustivel() {
  return useQuery({
    queryKey: ['saidas_combustivel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saidas_combustivel')
        .select('*')
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToSaidaCombustivel);
    },
  });
}

const INVALIDATE_KEYS: readonly (readonly string[])[] = [
  ['saidas_combustivel'],
  ['transportadora_movimentos'],
  ['transportadora_saldos'],
  ['abastecimentos'],
  ['abastecimentos_carreta'],
];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const k of INVALIDATE_KEYS) qc.invalidateQueries({ queryKey: k });
}

export function useAdicionarSaidaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (saida: SaidaCombustivel) => {
      const { error } = await supabase
        .from('saidas_combustivel')
        .insert(saidaCombustivelToDb(saida));
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAtualizarSaidaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (saida: SaidaCombustivel) => {
      const { error } = await supabase
        .from('saidas_combustivel')
        .update(saidaCombustivelToDb(saida))
        .eq('id', saida.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useExcluirSaidaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saidas_combustivel').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
