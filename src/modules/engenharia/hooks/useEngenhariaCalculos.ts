import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaCalculo,
  type EngenhariaCalculo,
  type EngenhariaCalculoRow,
  type DocumentoCalculo,
} from '../types/calculo';

const QK_CALC = (id: string) => ['engenharia', 'calculos', 'item', id] as const;
const QK_CALCS_DA_PASTA = (pastaId: string) =>
  ['engenharia', 'calculos', 'pasta', pastaId] as const;

export function useEngenhariaCalculo(id: string) {
  return useQuery({
    queryKey: QK_CALC(id),
    queryFn: async (): Promise<EngenhariaCalculo | null> => {
      const { data, error } = await supabase
        .from('engenharia_calculos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaCalculo(data as EngenhariaCalculoRow) : null;
    },
    enabled: !!id,
  });
}

export function useCalculosDaPasta(pastaId: string) {
  return useQuery({
    queryKey: QK_CALCS_DA_PASTA(pastaId),
    queryFn: async (): Promise<EngenhariaCalculo[]> => {
      const { data, error } = await supabase
        .from('engenharia_calculos')
        .select('*')
        .eq('pasta_id', pastaId)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaCalculo(r as EngenhariaCalculoRow));
    },
    enabled: !!pastaId,
  });
}

export function useCriarCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pastaId: string; titulo: string }) => {
      const { data, error } = await supabase
        .from('engenharia_calculos')
        .insert({
          pasta_id: input.pastaId,
          titulo: input.titulo,
          documento_json: { linhas: [] },
          alerta_ativo: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaCalculo(data as EngenhariaCalculoRow);
    },
    onSuccess: (calc) => {
      qc.invalidateQueries({ queryKey: QK_CALCS_DA_PASTA(calc.pastaId) });
    },
  });
}

export type SalvarCalculoResult =
  | { ok: true; novaVersao: number }
  | { ok: false; motivo: 'conflito_versao' | 'sem_permissao' | 'calculo_nao_encontrado' | string };

export function useSalvarCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      titulo: string;
      documento: DocumentoCalculo;
      alertaAtivo: boolean;
      versaoAtual: number;
    }): Promise<SalvarCalculoResult> => {
      const { data, error } = await supabase.rpc('engenharia_salvar_calculo_com_versao', {
        p_calculo_id: input.id,
        p_titulo: input.titulo,
        p_documento_json: input.documento,
        p_alerta_ativo: input.alertaAtivo,
        p_versao_atual: input.versaoAtual,
      });
      if (error) return { ok: false, motivo: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) return { ok: false, motivo: row?.motivo ?? 'desconhecido' };
      return { ok: true, novaVersao: row.nova_versao };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_CALC(vars.id) });
      qc.invalidateQueries({ queryKey: ['engenharia', 'calculos', 'versoes', vars.id] });
    },
  });
}

export function useSoftDeleteCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_calculos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'calculos'] }),
  });
}
