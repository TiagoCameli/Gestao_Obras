/**
 * Hooks para a junction depositos_obras (N:N).
 *
 * - useDepositosMaterialV2(): lista todos com obrasIds populado
 * - useVincularObrasDeposito: substitui as obras de um depósito (delete + insert)
 * - useSaldosDeposito(deposito_id): lê vw_saldos_deposito
 * - useSaldoInsumo(deposito_id, insumo_id): single via função RPC
 * - useTotalEstoqueDeposito(deposito_id): valor total + qtd insumos distintos
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToDepositoMaterial } from '../lib/mappers';
import type { DepositoMaterial, SaldoDepositoInsumo } from '../types';

/**
 * Lista depósitos de material V2: traz cada depósito com `obrasIds` populado
 * a partir da junction `depositos_obras`. Filtra soft-deleted por padrão.
 */
export function useDepositosMaterialV2(incluirDeletados = false) {
  return useQuery<DepositoMaterial[]>({
    queryKey: ['depositos_material_v2', incluirDeletados],
    queryFn: async () => {
      // 1) busca depósitos
      let q = supabase.from('depositos_material').select('*').order('nome');
      if (!incluirDeletados) q = q.is('deletado_em', null);
      const { data: deps, error } = await q;
      if (error) throw error;
      const depositos = (deps ?? []).map(dbToDepositoMaterial);

      // 2) batch das vinculações (uma única query)
      const ids = depositos.map((d) => d.id);
      if (ids.length === 0) return depositos;
      const { data: vinc, error: e2 } = await supabase
        .from('depositos_obras')
        .select('deposito_material_id, obra_id')
        .in('deposito_material_id', ids);
      if (e2) throw e2;

      const map = new Map<string, string[]>();
      for (const v of vinc ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dId = (v as any).deposito_material_id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oId = (v as any).obra_id as string;
        if (!map.has(dId)) map.set(dId, []);
        map.get(dId)!.push(oId);
      }
      return depositos.map((d) => ({ ...d, obrasIds: map.get(d.id) ?? [] }));
    },
  });
}

interface VincularParams {
  depositoId: string;
  obrasIds: string[];
  criadoPor: string;
}

/** Substitui (delete + insert) as obras vinculadas a um depósito. */
export function useVincularObrasDeposito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ depositoId, obrasIds, criadoPor }: VincularParams) => {
      // delete tudo e re-insere — atômico no nível conceitual
      const { error: e1 } = await supabase
        .from('depositos_obras')
        .delete()
        .eq('deposito_material_id', depositoId);
      if (e1) throw e1;
      if (obrasIds.length === 0) return;
      const rows = obrasIds.map((obraId) => ({
        deposito_material_id: depositoId,
        obra_id: obraId,
        criado_por: criadoPor || '',
      }));
      const { error: e2 } = await supabase.from('depositos_obras').insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depositos_material_v2'] });
    },
  });
}

// ──────────────────── Saldos ─────────────────────────────────────────────

/** Saldos de todos os insumos num depósito (via vw_saldos_deposito). */
export function useSaldosDeposito(depositoId: string) {
  return useQuery<SaldoDepositoInsumo[]>({
    queryKey: ['saldos_deposito', depositoId],
    queryFn: async () => {
      if (!depositoId) return [];
      const { data, error } = await supabase
        .from('vw_saldos_deposito')
        .select('*')
        .eq('deposito_id', depositoId);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((r: any) => ({
        depositoId: r.deposito_id,
        insumoId: r.insumo_id,
        saldo: Number(r.saldo ?? 0),
        valorTotalEntradas: Number(r.valor_total_entradas ?? 0),
        ultimaMovimentacao: r.ultima_movimentacao ?? undefined,
      }));
    },
    enabled: !!depositoId,
    staleTime: 30_000,
  });
}

/**
 * Saldo único (deposito × insumo). Usa a função SQL via RPC.
 * Útil pra validar saída antes de gravar.
 */
export async function consultarSaldoInsumo(depositoId: string, insumoId: string): Promise<number> {
  const { data, error } = await supabase.rpc('saldo_deposito_insumo', {
    p_deposito_id: depositoId,
    p_insumo_id: insumoId,
  });
  if (error) {
    console.warn('[saldo_deposito_insumo] erro:', error.message);
    return 0;
  }
  return Number(data ?? 0);
}

/**
 * Saldos agregados pra muitos depósitos de uma vez (usado nos cards da lista).
 * Retorna um Map<depositoId, { qtdInsumos, valorTotal }>.
 */
export function useResumoSaldosTodos() {
  return useQuery({
    queryKey: ['resumo_saldos_todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_saldos_deposito')
        .select('deposito_id, saldo, valor_total_entradas');
      if (error) throw error;
      const map = new Map<string, { qtdInsumos: number; valorTotal: number }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (data ?? []) as any[]) {
        const id = r.deposito_id as string;
        const cur = map.get(id) ?? { qtdInsumos: 0, valorTotal: 0 };
        if (Number(r.saldo) > 0) cur.qtdInsumos += 1;
        cur.valorTotal += Number(r.valor_total_entradas ?? 0);
        map.set(id, cur);
      }
      return map;
    },
    staleTime: 60_000,
  });
}
