import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaPrancha,
  DOCUMENTO_VAZIO,
  type EngenhariaPrancha,
  type EngenhariaPranchaRow,
  type DocumentoPrancha,
} from '../types/prancha';

const QK_PRANCHA = (id: string) => ['engenharia', 'pranchas', 'item', id] as const;
const QK_PRANCHAS_DA_PASTA = (pastaId: string) => ['engenharia', 'pranchas', 'pasta', pastaId] as const;

export function useEngenhariaPrancha(id: string) {
  return useQuery({
    queryKey: QK_PRANCHA(id),
    queryFn: async (): Promise<EngenhariaPrancha | null> => {
      const { data, error } = await supabase.from('engenharia_pranchas').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaPrancha(data as EngenhariaPranchaRow) : null;
    },
    enabled: !!id,
  });
}

export function usePranchasDaPasta(pastaId: string) {
  return useQuery({
    queryKey: QK_PRANCHAS_DA_PASTA(pastaId),
    queryFn: async (): Promise<EngenhariaPrancha[]> => {
      const { data, error } = await supabase
        .from('engenharia_pranchas')
        .select('*')
        .eq('pasta_id', pastaId)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaPrancha(r as EngenhariaPranchaRow));
    },
    enabled: !!pastaId,
  });
}

export function useCriarPrancha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pastaId: string; titulo: string }) => {
      const { data, error } = await supabase
        .from('engenharia_pranchas')
        .insert({ pasta_id: input.pastaId, titulo: input.titulo, documento_json: DOCUMENTO_VAZIO })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaPrancha(data as EngenhariaPranchaRow);
    },
    onSuccess: (p) => qc.invalidateQueries({ queryKey: QK_PRANCHAS_DA_PASTA(p.pastaId) }),
  });
}

export type SalvarPranchaResult =
  | { ok: true; novaVersao: number }
  | { ok: false; motivo: 'conflito_versao' | 'sem_permissao' | 'prancha_nao_encontrada' | string };

export function useSalvarPrancha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      titulo: string;
      documento: DocumentoPrancha;
      versaoAtual: number;
    }): Promise<SalvarPranchaResult> => {
      const { data, error } = await supabase.rpc('engenharia_salvar_prancha_com_versao', {
        p_prancha_id: input.id,
        p_titulo: input.titulo,
        p_documento_json: input.documento,
        p_versao_atual: input.versaoAtual,
      });
      if (error) return { ok: false, motivo: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) return { ok: false, motivo: row?.motivo ?? 'desconhecido' };
      return { ok: true, novaVersao: row.nova_versao };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK_PRANCHA(vars.id) });
      qc.invalidateQueries({ queryKey: ['engenharia', 'pranchas', 'versoes', vars.id] });
    },
  });
}

export function useSoftDeletePrancha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_pranchas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pranchas'] }),
  });
}
