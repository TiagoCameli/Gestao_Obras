import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * PR28 — Fase 1: Unificação progressiva Colaborador × Funcionário.
 *
 * Estes hooks operam apenas em camada de VÍNCULO (FK opcional).
 * Não copiam dados, não apagam registros, não tocam em campos das duas tabelas
 * além da coluna `funcionario_id` em `colaboradores`.
 */

export interface ParUnificacaoSugerido {
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorCpf: string;
  colaboradorEmpresaId: string;
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioCpf: string;
  funcionarioCargo: string;
  motivo: string;
  score: number;
}

/**
 * Lista pares prováveis para revisão manual. Consome a função SQL
 * `colaborador_match_funcionario_sugestoes` (ver migration PR28).
 */
export function useSugestoesUnificacao() {
  return useQuery({
    queryKey: ['unificacao', 'sugestoes'],
    queryFn: async (): Promise<ParUnificacaoSugerido[]> => {
      const { data, error } = await supabase.rpc('colaborador_match_funcionario_sugestoes');
      if (error) throw error;
      // O Supabase devolve as colunas no formato snake_case da função SQL.
      return (data ?? []).map((row: Record<string, unknown>) => ({
        colaboradorId: String(row.colaborador_id ?? ''),
        colaboradorNome: String(row.colaborador_nome ?? ''),
        colaboradorCpf: String(row.colaborador_cpf ?? ''),
        colaboradorEmpresaId: String(row.colaborador_empresa_id ?? ''),
        funcionarioId: String(row.funcionario_id ?? ''),
        funcionarioNome: String(row.funcionario_nome ?? ''),
        funcionarioCpf: String(row.funcionario_cpf ?? ''),
        funcionarioCargo: String(row.funcionario_cargo ?? ''),
        motivo: String(row.motivo ?? ''),
        score: Number(row.score ?? 0),
      }));
    },
    // Stale-time curto porque a lista muda assim que o usuário vincula um par.
    staleTime: 10_000,
  });
}

/**
 * Cria o vínculo Colaborador → Funcionário (atualiza só a coluna `funcionario_id`).
 * Pode ser desfeito chamando `useDesvincularColaborador`.
 */
export function useVincularColaboradorFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { colaboradorId: string; funcionarioId: string }) => {
      const { error } = await supabase
        .from('colaboradores')
        .update({ funcionario_id: params.funcionarioId })
        .eq('id', params.colaboradorId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unificacao'] });
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
    },
  });
}

/**
 * Desfaz o vínculo (volta `funcionario_id` para NULL).
 */
export function useDesvincularColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (colaboradorId: string) => {
      const { error } = await supabase
        .from('colaboradores')
        .update({ funcionario_id: null })
        .eq('id', colaboradorId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unificacao'] });
      qc.invalidateQueries({ queryKey: ['colaboradores'] });
    },
  });
}
