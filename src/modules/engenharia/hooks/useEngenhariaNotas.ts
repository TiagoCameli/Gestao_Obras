import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaNota,
  type EngenhariaNota,
  type EngenhariaNotaRow,
} from '../types/nota';

const QK_NOTA = (id: string) => ['engenharia', 'notas', 'item', id] as const;
const QK_NOTAS_DA_PASTA = (pastaId: string) =>
  ['engenharia', 'notas', 'pasta', pastaId] as const;

export function useEngenhariaNota(id: string) {
  return useQuery({
    queryKey: QK_NOTA(id),
    queryFn: async (): Promise<EngenhariaNota | null> => {
      const { data, error } = await supabase
        .from('engenharia_notas')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaNota(data as EngenhariaNotaRow) : null;
    },
    enabled: !!id,
  });
}

export function useNotasDaPasta(pastaId: string) {
  return useQuery({
    queryKey: QK_NOTAS_DA_PASTA(pastaId),
    queryFn: async (): Promise<EngenhariaNota[]> => {
      const { data, error } = await supabase
        .from('engenharia_notas')
        .select('*')
        .eq('pasta_id', pastaId)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaNota(r as EngenhariaNotaRow));
    },
    enabled: !!pastaId,
  });
}

export function useCriarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pastaId: string; titulo: string }) => {
      const { data, error } = await supabase
        .from('engenharia_notas')
        .insert({
          pasta_id: input.pastaId,
          titulo: input.titulo,
          conteudo_json: { type: 'doc', content: [] },
        })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaNota(data as EngenhariaNotaRow);
    },
    onSuccess: (nota) => {
      qc.invalidateQueries({ queryKey: QK_NOTAS_DA_PASTA(nota.pastaId) });
    },
  });
}

export type SalvarNotaResult =
  | { ok: true; novaVersao: number }
  | { ok: false; motivo: 'conflito_versao' | 'sem_permissao' | 'nota_nao_encontrada' | string };

export function useSalvarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      titulo: string;
      conteudoJson: unknown;
      versaoAtual: number;
    }): Promise<SalvarNotaResult> => {
      const { data, error } = await supabase.rpc('engenharia_salvar_nota_com_versao', {
        p_nota_id: input.id,
        p_titulo: input.titulo,
        p_conteudo_json: input.conteudoJson,
        p_versao_atual: input.versaoAtual,
      });
      if (error) return { ok: false, motivo: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) {
        return { ok: false, motivo: row?.motivo ?? 'desconhecido' };
      }
      return { ok: true, novaVersao: row.nova_versao };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_NOTA(vars.id) });
      qc.invalidateQueries({ queryKey: ['engenharia', 'notas', 'versoes', vars.id] });
    },
  });
}

export function useSoftDeleteNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_notas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'notas'] }),
  });
}
