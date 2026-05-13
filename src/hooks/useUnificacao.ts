import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * PR28 — Fase 1: Unificação progressiva Colaborador × Funcionário do
 * Apontamento RH (tabela `apont_funcionarios`).
 *
 * Estes hooks operam apenas em camada de VÍNCULO (FK opcional).
 * Não copiam dados, não apagam registros, não tocam em campos das duas tabelas
 * além da coluna `apont_funcionario_id` em `colaboradores`.
 */

export interface ParUnificacaoSugerido {
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorCpf: string;
  colaboradorEmpresaId: string;
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioCpf: string;
  funcionarioFuncao: string;
  funcionarioTipoVinculo: string;
  motivo: string;
  score: number;
}

/**
 * Lista pares prováveis para revisão manual. Consome a função SQL
 * `colaborador_match_apont_funcionario_sugestoes` (ver migration PR28b).
 */
export function useSugestoesUnificacao() {
  return useQuery({
    queryKey: ['unificacao', 'sugestoes'],
    queryFn: async (): Promise<ParUnificacaoSugerido[]> => {
      const { data, error } = await supabase.rpc('colaborador_match_apont_funcionario_sugestoes');
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        colaboradorId: String(row.colaborador_id ?? ''),
        colaboradorNome: String(row.colaborador_nome ?? ''),
        colaboradorCpf: String(row.colaborador_cpf ?? ''),
        colaboradorEmpresaId: String(row.colaborador_empresa_id ?? ''),
        funcionarioId: String(row.funcionario_id ?? ''),
        funcionarioNome: String(row.funcionario_nome ?? ''),
        funcionarioCpf: String(row.funcionario_cpf ?? ''),
        funcionarioFuncao: String(row.funcionario_funcao ?? ''),
        funcionarioTipoVinculo: String(row.funcionario_tipo_vinculo ?? ''),
        motivo: String(row.motivo ?? ''),
        score: Number(row.score ?? 0),
      }));
    },
    staleTime: 10_000,
  });
}

/**
 * Cria o vínculo Colaborador → apont_funcionario (atualiza só a coluna
 * `apont_funcionario_id`). Pode ser desfeito chamando `useDesvincularColaborador`.
 */
export function useVincularColaboradorFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { colaboradorId: string; funcionarioId: string }) => {
      const { error } = await supabase
        .from('colaboradores')
        .update({ apont_funcionario_id: params.funcionarioId })
        .eq('id', params.colaboradorId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unificacao'] });
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
    },
  });
}

/* ---------- Fase 2 — Backfill Colaborador → apont_funcionario ---------- */

export interface BackfillPreviewLinha {
  campo: string;
  valorApont: string;
  valorColab: string;
  vaiPreencher: boolean;
}

/**
 * Preview do que o backfill copiaria para um colaborador vinculado.
 * Não modifica nada.
 */
export function usePreviewBackfill(colaboradorId: string | null) {
  return useQuery({
    queryKey: ['unificacao', 'backfill-preview', colaboradorId],
    enabled: Boolean(colaboradorId),
    queryFn: async (): Promise<BackfillPreviewLinha[]> => {
      const { data, error } = await supabase.rpc('colaborador_to_apont_backfill_preview', {
        p_colaborador_id: colaboradorId!,
      });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        campo: String(row.campo ?? ''),
        valorApont: String(row.valor_apont ?? ''),
        valorColab: String(row.valor_colab ?? ''),
        vaiPreencher: Boolean(row.vai_preencher),
      }));
    },
    staleTime: 5_000,
  });
}

/**
 * Aplica o backfill em LOTE para todos os colaboradores vinculados.
 * Retorna o total de campos preenchidos somado entre os pares.
 */
export function useAplicarBackfillLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (colaboradorIds: string[]) => {
      let totalCampos = 0;
      const detalhes: string[] = [];
      for (const id of colaboradorIds) {
        const { data, error } = await supabase.rpc('colaborador_to_apont_backfill_apply', {
          p_colaborador_id: id,
        });
        if (error) throw error;
        const row = (data ?? [])[0] ?? {};
        const campos = Number(row.campos_preenchidos ?? 0);
        totalCampos += campos;
        if (campos > 0) detalhes.push(`${campos}× em ${id.slice(0, 8)}`);
      }
      return { totalCampos, paresProcessados: colaboradorIds.length, detalhes };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unificacao'] });
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
      qc.invalidateQueries({ queryKey: ['funcionarios'] });
    },
  });
}

/**
 * Aplica o backfill — copia cpf/rg/telefone/data_nascimento do colaborador
 * para o apont_funcionario vinculado. NUNCA sobrescreve valor preenchido.
 */
export function useAplicarBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (colaboradorId: string) => {
      const { data, error } = await supabase.rpc('colaborador_to_apont_backfill_apply', {
        p_colaborador_id: colaboradorId,
      });
      if (error) throw error;
      // Função retorna 1 linha com (campos_preenchidos, detalhe)
      const row = (data ?? [])[0] ?? {};
      return {
        camposPreenchidos: Number(row.campos_preenchidos ?? 0),
        detalhe: String(row.detalhe ?? ''),
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unificacao'] });
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
      qc.invalidateQueries({ queryKey: ['funcionarios'] });
    },
  });
}

/**
 * Desfaz o vínculo (volta `apont_funcionario_id` para NULL).
 */
export function useDesvincularColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (colaboradorId: string) => {
      const { error } = await supabase
        .from('colaboradores')
        .update({ apont_funcionario_id: null })
        .eq('id', colaboradorId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unificacao'] });
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
    },
  });
}
