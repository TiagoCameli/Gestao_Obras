// Marco 5 / PR26 — Hook que consome v_checklists_nao_conformidades.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { StatusExecucaoChecklist } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ChecklistNaoConformidade {
  execucaoId: string;
  equipamentoId: string;
  codigoPatrimonio: string;
  equipamentoNome: string;
  equipamentoTipo: string;
  operadorNome: string;
  concluidoEm: string;
  status: StatusExecucaoChecklist;
  osGeradaId: string | null;
  itensNao: number;
  itensCriticos: number;
}

function dbToNaoConformidade(row: any): ChecklistNaoConformidade {
  return {
    execucaoId: row.execucao_id,
    equipamentoId: row.equipamento_id,
    codigoPatrimonio: row.codigo_patrimonio ?? '',
    equipamentoNome: row.equipamento_nome ?? '',
    equipamentoTipo: row.equipamento_tipo ?? '',
    operadorNome: row.operador_nome ?? '',
    concluidoEm: row.concluido_em ?? '',
    status: (row.status ?? 'concluido') as StatusExecucaoChecklist,
    osGeradaId: row.os_gerada_id ?? null,
    itensNao: Number(row.itens_nao ?? 0),
    itensCriticos: Number(row.itens_criticos ?? 0),
  };
}

/** Equipamentos com a última execução tendo respostas 'nao' (ainda em aberto). */
export function useChecklistsNaoConformidades() {
  return useQuery({
    queryKey: ['checklists_nao_conformidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_checklists_nao_conformidades')
        .select('*')
        .order('concluido_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToNaoConformidade);
    },
  });
}
