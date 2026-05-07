import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTransportadoraMovimento } from '../lib/mappers';
import type { TipoMovimentoTransportadora, TransportadoraMovimento } from '../types';

function gerarIdText(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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
      // View transportadora_movimentos_detalhe = base + LEFT JOIN nas
      // tabelas de origem (fretes/saidas_combustivel/pagamentos_frete)
      // pra trazer os campos do cálculo (peso×km×tkm, litros×preço, etc).
      let q = supabase.from('transportadora_movimentos_detalhe').select('*').order('data', { ascending: false });
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

/** Cria ajuste manual (crédito ou débito) na conta-corrente da transportadora.
 *  INSERT direto em transportadora_movimentos com origem_tabela='ajuste_manual'
 *  (sem trigger — não há tabela origem). View transportadora_saldos é
 *  atualizada automaticamente (é VIEW agregada).
 */
export interface NovoAjusteManualInput {
  transportadoraId: string;
  tipo: 'ajuste_manual_credito' | 'ajuste_manual_debito';
  /** Valor positivo. Sinal vem do tipo. */
  valor: number;
  /** ISO timestamptz da data do ajuste. */
  data: string;
  /** Mês de referência (YYYY-MM-DD do 1º dia). Default = mês da data. */
  mesReferencia?: string | null;
  descricao: string;
  obraId?: string | null;
}

export function useCriarAjusteManualTransportadora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovoAjusteManualInput) => {
      const id = gerarIdText();
      const dataIso = input.data.length === 16 ? `${input.data}:00` : input.data;
      const mesRef = input.mesReferencia ?? `${dataIso.slice(0, 7)}-01`;
      const { error } = await supabase.from('transportadora_movimentos').insert({
        id,
        transportadora_id: input.transportadoraId,
        data: dataIso,
        tipo: input.tipo,
        valor: input.valor,
        origem_tabela: 'ajuste_manual',
        origem_id: id,
        descricao: input.descricao,
        obra_id: input.obraId ?? null,
        mes_referencia: mesRef,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transportadora_movimentos'] });
      qc.invalidateQueries({ queryKey: ['transportadora_saldos'] });
      qc.invalidateQueries({ queryKey: ['transportadora_saldo'] });
    },
  });
}

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
