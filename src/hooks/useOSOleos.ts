import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { OSOleo, OleoVencendo } from '../types';

// ── Helper ──────────────────────────────────────────────────────────

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Mappers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToOSOleo(row: any): OSOleo {
  return {
    id: row.id,
    osId: row.os_id ?? '',
    tipoOleoId: row.tipo_oleo_id ?? '',
    insumoId: row.insumo_id ?? null,
    depositoId: row.deposito_id ?? null,
    quantidade: Number(row.quantidade ?? 0),
    unidade: row.unidade ?? 'L',
    valorUnitario: Number(row.valor_unitario ?? 0),
    valorTotal: Number(row.valor_total ?? 0),
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

function osOleoToDb(o: OSOleo) {
  return {
    id: o.id,
    os_id: o.osId,
    tipo_oleo_id: o.tipoOleoId,
    insumo_id: o.insumoId ?? null,
    deposito_id: o.depositoId ?? null,
    quantidade: o.quantidade,
    unidade: o.unidade,
    valor_unitario: o.valorUnitario,
    created_by: o.createdBy,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToOleoVencendo(row: any): OleoVencendo {
  return {
    equipamentoId: row.equipamento_id ?? '',
    equipamentoNome: row.equipamento_nome ?? '',
    tipoOleoId: row.tipo_oleo_id ?? '',
    tipoOleoNome: row.tipo_oleo_nome ?? '',
    aplicacao: row.aplicacao ?? '',
    ultimaTroca: row.ultima_troca ?? '',
    intervaloMeses: Number(row.intervalo_meses ?? 0),
    dataVencimento: row.data_vencimento ?? '',
    diasParaVencer: Number(row.dias_para_vencer ?? 0),
    situacao: row.situacao ?? 'ok',
  };
}

// ── Queries ──────────────────────────────────────────────────────────

export function useOleosOS(osId: string | null | undefined) {
  return useQuery<OSOleo[]>({
    queryKey: ['os-oleos', osId ?? ''],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_oleos')
        .select('*')
        .eq('os_id', osId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(dbToOSOleo);
    },
  });
}

export function useOleosVencendo() {
  return useQuery<OleoVencendo[]>({
    queryKey: ['oleos-vencendo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_oleos_vencendo').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToOleoVencendo);
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────

export function useAdicionarOleoOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oleo: Omit<OSOleo, 'id' | 'createdAt'>) => {
      const id = gerarId();
      const payload = osOleoToDb({ ...oleo, id, createdAt: '' });
      const { data, error } = await supabase.from('os_oleos').insert(payload).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão ou linha não inserida');
      return dbToOSOleo(data[0]);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['ordem_servico', variables.osId] });
      qc.invalidateQueries({ queryKey: ['ordem_servico_numero'] });
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
      qc.invalidateQueries({ queryKey: ['os-oleos', variables.osId] });
      qc.invalidateQueries({ queryKey: ['oleos-vencendo'] });
      // baixa/estorno de estoque reflete no saldo do almoxarifado
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'saldo_estoque_total' });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'saldo_estoque_deposito' });
    },
  });
}

export function useExcluirOleoOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; osId: string }) => {
      const { data, error } = await supabase
        .from('os_oleos')
        .delete()
        .eq('id', params.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão ou linha não excluída');
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['ordem_servico', variables.osId] });
      qc.invalidateQueries({ queryKey: ['ordem_servico_numero'] });
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
      qc.invalidateQueries({ queryKey: ['os-oleos', variables.osId] });
      qc.invalidateQueries({ queryKey: ['oleos-vencendo'] });
      // baixa/estorno de estoque reflete no saldo do almoxarifado
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'saldo_estoque_total' });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'saldo_estoque_deposito' });
    },
  });
}
