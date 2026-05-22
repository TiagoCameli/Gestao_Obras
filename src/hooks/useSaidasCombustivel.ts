import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToSaidaCombustivel, saidaCombustivelToDb } from '../lib/mappers';
import type { SaidaCombustivel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { invalidateCombustivelCaches } from './useCombustivelInvalidator';

/**
 * Lista todas as saídas de combustível (modelo unificado pós-Fase 2).
 * Substitui useAbastecimentos + useAbastecimentosCarreta após Fase 5.
 *
 * Mutations usam invalidateCombustivelCaches (HF.12) pra refetchar todas as
 * 9 queryKeys ligadas (depositos, entradas, saídas, transferências,
 * esvaziamentos, transportadora_movimentos/saldos, abastecimentos shim).
 * Bug #4: o conjunto antigo esquecera ['depositos'].
 */
export function useSaidasCombustivel() {
  return useQuery({
    queryKey: ['saidas_combustivel'],
    queryFn: async () => {
      // F8.4 — soft delete: filtra deleted_at IS NULL (registros ativos).
      // Pra ver lixeira (admin), usar useSaidasCombustivelDeletadas (TBD).
      const { data, error } = await supabase
        .from('saidas_combustivel')
        .select('*')
        .is('deleted_at', null)
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToSaidaCombustivel);
    },
  });
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
    onSuccess: () => invalidateCombustivelCaches(qc),
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
    onSuccess: () => invalidateCombustivelCaches(qc),
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
      if (results.saved > 0) invalidateCombustivelCaches(qc);
      return results;
    },
    [qc, usuario?.nome],
  );
}

// ────────────────────────────────────────────────────────────────────
// F10 — Lixeira: lê soft-deleted + restaura.
// ────────────────────────────────────────────────────────────────────

export function useSaidasCombustivelDeletadas() {
  return useQuery({
    queryKey: ['saidas_combustivel', 'deletadas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saidas_combustivel')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(200); // cap razoável; admin pode filtrar mais se precisar
      if (error) throw error;
      return (data ?? []).map((row: { deleted_at: string | null; deleted_by: string | null }) => ({
        ...dbToSaidaCombustivel(row),
        deletedAt: row.deleted_at,
        deletedBy: row.deleted_by,
      }));
    },
  });
}

export function useRestaurarSaidaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saidas_combustivel')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCombustivelCaches(qc);
      qc.invalidateQueries({ queryKey: ['saidas_combustivel', 'deletadas'] });
    },
  });
}

export function useExcluirSaidaCombustivel() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    // F8.4 — soft delete: marca deleted_at + deleted_by em vez de DELETE.
    // Trigger DB grava entry no audit_log com tipo "saidas_combustivel_delete".
    // Restore via UPDATE deleted_at = NULL (admin, futuro).
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saidas_combustivel')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateCombustivelCaches(qc),
  });
}
