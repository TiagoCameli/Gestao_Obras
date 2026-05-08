import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToSaidaCombustivel, saidaCombustivelToDb } from '../lib/mappers';
import type { SaidaCombustivel } from '../types';
import { useAuth } from '../contexts/AuthContext';

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

/**
 * Atualização em batch (F2.B.2) — usado pra atribuição retroativa de
 * equipamento em N saídas sentinel de uma vez.
 *
 * Diferenças vs `useAtualizarSaidaCombustivel`:
 *  - Loop manual pra reportar progresso por linha (UI precisa de "X de Y")
 *  - Continua em erro: marca a linha falha e segue, não aborta o lote
 *  - Invalidação UMA vez no fim (não N vezes — economiza refetches)
 *  - Injeta updated_by automaticamente (mesma semântica do handleSubmitSaida
 *    no container, sem o caller precisar repetir)
 *
 * Retorna a função executora (não useMutation — mutationFn não suporta
 * progresso por iteração nativo).
 */
export function useAtualizarSaidasCombustivelBatch() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useCallback(
    async (
      saidas: SaidaCombustivel[],
      onProgress?: (done: number, total: number) => void,
    ): Promise<{ saved: number; failed: { saidaId: string; error: string }[] }> => {
      const results = { saved: 0, failed: [] as { saidaId: string; error: string }[] };
      const updatedBy = usuario?.nome ?? null;
      let done = 0;
      for (const saida of saidas) {
        try {
          const payload = saidaCombustivelToDb({ ...saida, updatedBy });
          const { error } = await supabase
            .from('saidas_combustivel')
            .update(payload)
            .eq('id', saida.id);
          if (error) {
            results.failed.push({ saidaId: saida.id, error: error.message });
          } else {
            results.saved += 1;
          }
        } catch (e: unknown) {
          results.failed.push({
            saidaId: saida.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        done += 1;
        onProgress?.(done, saidas.length);
      }
      if (results.saved > 0) invalidateAll(qc);
      return results;
    },
    [qc, usuario?.nome],
  );
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
