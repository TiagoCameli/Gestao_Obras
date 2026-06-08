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
      // F8.4 — soft delete: filtra deleted_at IS NULL (registros ativos).
      // Pra ver lixeira (admin), usar useSaidasCombustivelDeletadas (TBD).
      //
      // Paginação obrigatória: o PostgREST corta em 1000 linhas por request
      // (default do Supabase). Como a tabela já passou de 1000 (e cresce todo
      // dia), buscar sem .range() descartaria silenciosamente as saídas mais
      // antigas e subcontaria todos os agregados que dependem deste hook
      // (totais de combustível, custo por equipamento, etc). Busca em páginas
      // de 1000 até esgotar. Tiebreaker por id estabiliza a ordenação na borda
      // das páginas (data não é única). Ver docs/tech-debt.md (limite de 1000).
      const PAGINA = 1000;
      const todas: unknown[] = [];
      for (let from = 0; ; from += PAGINA) {
        const { data, error } = await supabase
          .from('saidas_combustivel')
          .select('*')
          .is('deleted_at', null)
          .order('data', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + PAGINA - 1);
        if (error) throw error;
        const lote = data ?? [];
        todas.push(...lote);
        if (lote.length < PAGINA) break;
      }
      return todas.map(dbToSaidaCombustivel);
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

/**
 * FI.4 — Insert atômico via RPC `registrar_saida_combustivel_fifo`.
 *
 * Substitui `useAdicionarSaidaCombustivel` em fluxos novos (desktop +
 * mobile) que usam custeio FIFO real (helper `calcularPrecoFIFO`).
 *
 * A RPC grava 3 linhas numa transação:
 *  - `saidas_combustivel` (a saída em si)
 *  - `saidas_lotes` (N porções consumidas — uma por lote)
 *  - `saidas_sem_suprimento` (se houve litros sem lote disponível)
 *
 * Edit mode continua usando `useAtualizarSaidaCombustivel` (preserva
 * snapshot imutável, HF.11 — não recalcula FIFO em edit).
 */
export function useRegistrarSaidaFIFO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      saida: SaidaCombustivel;
      lotes: {
        fonteTipo: 'entrada' | 'transferencia';
        fonteId: string;
        litros: number;
        precoLote: number;
      }[];
      litrosSemSuprimento: number;
    }) => {
      const { data, error } = await supabase.rpc('registrar_saida_combustivel_fifo', {
        p_saida: saidaCombustivelToDb(params.saida),
        p_lotes: params.lotes.map((l) => ({
          fonte_tipo: l.fonteTipo,
          fonte_id: l.fonteId,
          litros: l.litros,
          preco_lote: l.precoLote,
        })),
        p_litros_sem_suprimento: params.litrosSemSuprimento,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] });
      qc.invalidateQueries({ queryKey: ['saidas_lotes'] });
      qc.invalidateQueries({ queryKey: ['saidas_sem_suprimento'] });
    },
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
      invalidateAll(qc);
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
    onSuccess: () => invalidateAll(qc),
  });
}
