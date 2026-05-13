// Marco 4 / PR18 — Hook que consome v_saldo_estoque_total e v_saldo_estoque.
//
// Saldo + custo médio móvel calculados no banco. Cliente recebe o snapshot.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { SaldoEstoque, SaldoEstoquePorDeposito, StatusEstoque } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function dbToSaldoEstoque(row: any): SaldoEstoque {
  return {
    insumoId: row.insumo_id,
    insumoNome: row.insumo_nome ?? '',
    unidade: row.unidade ?? '',
    codigoSku: row.codigo_sku ?? null,
    codigoEan: row.codigo_ean ?? null,
    fabricante: row.fabricante ?? null,
    codigoFabricante: row.codigo_fabricante ?? null,
    categoria: row.categoria ?? null,
    tipo: row.tipo ?? null,
    estoqueMinimo: row.estoque_minimo != null ? Number(row.estoque_minimo) : null,
    estoqueMaximo: row.estoque_maximo != null ? Number(row.estoque_maximo) : null,
    usadoEmManutencao: !!row.usado_em_manutencao,
    fotoUrl: row.foto_url ?? null,
    equipamentosCompativeis: row.equipamentos_compativeis ?? [],
    saldoTotal: Number(row.saldo_total ?? 0),
    custoMedio: row.custo_medio != null ? Number(row.custo_medio) : null,
    statusEstoque: (row.status_estoque ?? 'ok') as StatusEstoque,
  };
}

function dbToSaldoPorDeposito(row: any): SaldoEstoquePorDeposito {
  return {
    insumoId: row.insumo_id,
    insumoNome: row.insumo_nome ?? '',
    unidade: row.unidade ?? '',
    codigoSku: row.codigo_sku ?? null,
    fabricante: row.fabricante ?? null,
    estoqueMinimo: row.estoque_minimo != null ? Number(row.estoque_minimo) : null,
    depositoId: row.deposito_id,
    depositoNome: row.deposito_nome ?? '',
    saldo: Number(row.saldo ?? 0),
    custoMedio: row.custo_medio != null ? Number(row.custo_medio) : null,
    totalEntradas: Number(row.total_entradas ?? 0),
    valorTotalEntradas: Number(row.valor_total_entradas ?? 0),
  };
}

/** Saldo + custo médio agregado por insumo (todos depósitos). */
export function useSaldoEstoqueTotal(filtros?: { apenasManutencao?: boolean }) {
  return useQuery({
    queryKey: ['saldo_estoque_total', filtros?.apenasManutencao ?? false],
    queryFn: async () => {
      let q = supabase.from('v_saldo_estoque_total').select('*');
      if (filtros?.apenasManutencao) {
        q = q.eq('usado_em_manutencao', true);
      }
      const { data, error } = await q.order('insumo_nome');
      if (error) throw error;
      return (data ?? []).map(dbToSaldoEstoque);
    },
  });
}

/** Detalhamento por depósito de um insumo. */
export function useSaldoEstoquePorDeposito(insumoId: string | null | undefined) {
  return useQuery({
    queryKey: ['saldo_estoque_deposito', insumoId ?? ''],
    enabled: !!insumoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_saldo_estoque')
        .select('*')
        .eq('insumo_id', insumoId!)
        .order('deposito_nome');
      if (error) throw error;
      return (data ?? []).map(dbToSaldoPorDeposito);
    },
  });
}
