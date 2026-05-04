import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTransportadoraMovimento } from '../lib/mappers';
import type { TipoMovimentoTransportadora, TransportadoraMovimento } from '../types';

export interface UseTransportadoraMovimentosOptions {
  /** Filtra por transportadora_id no servidor. */
  transportadoraId?: string;
  /** Filtra por mes_referencia (date YYYY-MM-DD truncada pro 1º dia do mês). */
  mesReferencia?: string;
  /** Filtra por tipo de movimento. */
  tipo?: TipoMovimentoTransportadora;
}

/**
 * Lista movimentos da conta-corrente das transportadoras (extrato cronológico).
 * Ordem: data DESC (mais recente primeiro).
 *
 * Saldo acumulado por linha NÃO é calculado aqui (decisão Q8 da Fase 0:
 * client-side via reduce no consumer pra evitar drift se algum movimento
 * for editado depois). Saldo total agregado disponível em useTransportadoraSaldo
 * (via view `transportadora_saldos`).
 */
export function useTransportadoraMovimentos(options?: UseTransportadoraMovimentosOptions) {
  const { transportadoraId, mesReferencia, tipo } = options ?? {};
  return useQuery({
    queryKey: ['transportadora_movimentos', { transportadoraId, mesReferencia, tipo }],
    queryFn: async () => {
      let q = supabase.from('transportadora_movimentos').select('*').order('data', { ascending: false });
      if (transportadoraId) q = q.eq('transportadora_id', transportadoraId);
      if (mesReferencia) q = q.eq('mes_referencia', mesReferencia);
      if (tipo) q = q.eq('tipo', tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(dbToTransportadoraMovimento);
    },
  });
}

/** Calcula saldo acumulado por linha (cronológico ASC) — helper opcional
 *  pra extrato visual. Aceita lista já em ordem (qualquer direção) e
 *  retorna nova lista ordenada cronologicamente com campo `saldoAcumulado`.
 *  Convenção: tipos credito_* + ajuste_manual_credito somam; resto subtrai. */
export interface TransportadoraMovimentoComSaldo extends TransportadoraMovimento {
  saldoAcumulado: number;
}

const TIPOS_CREDITO: ReadonlySet<TipoMovimentoTransportadora> = new Set([
  'credito_frete',
  'credito_abastecimento_transterra',
  'ajuste_manual_credito',
]);

export function calcularSaldoAcumulado(
  movs: TransportadoraMovimento[]
): TransportadoraMovimentoComSaldo[] {
  const ordenado = [...movs].sort((a, b) => a.data.localeCompare(b.data));
  let acc = 0;
  return ordenado.map((m) => {
    acc += TIPOS_CREDITO.has(m.tipo) ? m.valor : -m.valor;
    return { ...m, saldoAcumulado: acc };
  });
}
