import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TipoOleo } from '../types';

// ── Helper ──────────────────────────────────────────────────────────

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Mappers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToTipoOleo(row: any): TipoOleo {
  return {
    id: row.id,
    nome: row.nome ?? '',
    aplicacao: row.aplicacao ?? [],
    intervaloMeses: row.intervalo_meses != null ? Number(row.intervalo_meses) : null,
    ativo: !!row.ativo,
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

function tipoOleoToDb(t: Omit<TipoOleo, 'createdAt'>) {
  return {
    id: t.id,
    nome: t.nome,
    aplicacao: t.aplicacao,
    intervalo_meses: t.intervaloMeses,
    ativo: t.ativo,
    created_by: t.createdBy,
  };
}

// ── Queries ──────────────────────────────────────────────────────────

export function useTiposOleo(apenasAtivo?: boolean) {
  return useQuery<TipoOleo[]>({
    queryKey: ['tipos-oleo', { apenasAtivo }],
    queryFn: async () => {
      let q = supabase.from('tipos_oleo').select('*').order('nome');
      if (apenasAtivo) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(dbToTipoOleo);
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────

export function useCriarTipoOleo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TipoOleo, 'id' | 'createdAt'>) => {
      const id = gerarId();
      const payload = tipoOleoToDb({ ...input, id });
      const { data, error } = await supabase.from('tipos_oleo').insert(payload).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão ou linha não inserida');
      return dbToTipoOleo(data[0]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tipos-oleo'] });
    },
  });
}

export function useAtualizarTipoOleo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Omit<TipoOleo, 'createdAt'>) => {
      const { error } = await supabase
        .from('tipos_oleo')
        .update(tipoOleoToDb(t))
        .eq('id', t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tipos-oleo'] });
    },
  });
}

export function useExcluirTipoOleo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tipos_oleo').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tipos-oleo'] });
    },
  });
}
