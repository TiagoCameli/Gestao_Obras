// Marco 4 / PR22 — Custo de peças por equipamento (12m rolling).
//
// Consome v_custo_pecas_equipamento_12m e v_custo_pecas_equipamento_mensal.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CustoPecasEquipamento {
  equipamentoId: string;
  codigoPatrimonio: string;
  equipamentoNome: string;
  equipamentoTipo: string;
  custoTotal12m: number;
  numOs: number;
  numPecas: number;
  qtyTotal: number;
}

export interface CustoPecasMensal {
  equipamentoId: string;
  codigoPatrimonio: string;
  equipamentoNome: string;
  mes: string;
  custoPecas: number;
}

function dbToCustoEquipamento(row: any): CustoPecasEquipamento {
  return {
    equipamentoId: row.equipamento_id,
    codigoPatrimonio: row.codigo_patrimonio ?? '',
    equipamentoNome: row.equipamento_nome ?? '',
    equipamentoTipo: row.equipamento_tipo ?? '',
    custoTotal12m: Number(row.custo_total_12m ?? 0),
    numOs: Number(row.num_os ?? 0),
    numPecas: Number(row.num_pecas ?? 0),
    qtyTotal: Number(row.qty_total ?? 0),
  };
}

function dbToCustoMensal(row: any): CustoPecasMensal {
  return {
    equipamentoId: row.equipamento_id,
    codigoPatrimonio: row.codigo_patrimonio ?? '',
    equipamentoNome: row.equipamento_nome ?? '',
    mes: row.mes ?? '',
    custoPecas: Number(row.custo_pecas ?? 0),
  };
}

/** Top N equipamentos por custo de peças nos últimos 12 meses. */
export function useCustoPecasEquipamento(limit = 10) {
  return useQuery({
    queryKey: ['custo_pecas_equipamento_12m', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_custo_pecas_equipamento_12m')
        .select('*')
        .order('custo_total_12m', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(dbToCustoEquipamento);
    },
  });
}

/** Total + breakdown mensal para UM equipamento específico. */
export function useCustoPecasEquipamentoDetalhe(equipamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ['custo_pecas_equipamento_detalhe', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const [resTotal, resMensal] = await Promise.all([
        supabase
          .from('v_custo_pecas_equipamento_12m')
          .select('*')
          .eq('equipamento_id', equipamentoId!)
          .maybeSingle(),
        supabase
          .from('v_custo_pecas_equipamento_mensal')
          .select('*')
          .eq('equipamento_id', equipamentoId!)
          .order('mes'),
      ]);
      if (resTotal.error) throw resTotal.error;
      if (resMensal.error) throw resMensal.error;
      return {
        total: resTotal.data ? dbToCustoEquipamento(resTotal.data) : null,
        mensal: (resMensal.data ?? []).map(dbToCustoMensal),
      };
    },
  });
}
