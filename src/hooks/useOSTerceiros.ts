import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { OSTerceiro } from '../types';

// ── Helper ──────────────────────────────────────────────────────────

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Mappers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToOSTerceiro(row: any): OSTerceiro {
  return {
    id: row.id,
    osId: row.os_id ?? '',
    prestador: row.prestador ?? '',
    descricao: row.descricao ?? '',
    valor: Number(row.valor ?? 0),
    notaFiscal: row.nota_fiscal ?? null,
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

function osTerceiroToDb(t: OSTerceiro) {
  return {
    id: t.id,
    os_id: t.osId,
    prestador: t.prestador,
    descricao: t.descricao,
    valor: t.valor,
    nota_fiscal: t.notaFiscal,
    created_by: t.createdBy,
  };
}

// ── Queries ──────────────────────────────────────────────────────────

export function useTerceirosOS(osId: string | null | undefined) {
  return useQuery<OSTerceiro[]>({
    queryKey: ['os-terceiros', osId ?? ''],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_terceiros')
        .select('*')
        .eq('os_id', osId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(dbToOSTerceiro);
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────

export function useAdicionarTerceiroOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (terceiro: Omit<OSTerceiro, 'id' | 'createdAt'>) => {
      const id = gerarId();
      const payload = osTerceiroToDb({ ...terceiro, id, createdAt: '' });
      const { data, error } = await supabase.from('os_terceiros').insert(payload).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão ou linha não inserida');
      return dbToOSTerceiro(data[0]);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['os', variables.osId] });
      qc.invalidateQueries({ queryKey: ['os-terceiros', variables.osId] });
    },
  });
}

export function useExcluirTerceiroOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; osId: string }) => {
      const { error } = await supabase.from('os_terceiros').delete().eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['os', variables.osId] });
      qc.invalidateQueries({ queryKey: ['os-terceiros', variables.osId] });
    },
  });
}
