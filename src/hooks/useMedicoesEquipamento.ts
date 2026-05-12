import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToMedicaoEquipamento, medicaoEquipamentoToDb } from '../lib/mappers';
import type { MedicaoEquipamento, MedicaoAtualEquipamento, TipoMedicao, OrigemMedicao } from '../types';

/**
 * Lista todas as leituras de um equipamento, ordenadas da mais recente para a mais antiga.
 * Se equipamentoId não for informado, retorna [].
 */
export function useMedicoesEquipamento(equipamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ['medicoes_equipamento', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicoes_equipamento')
        .select('*')
        .eq('equipamento_id', equipamentoId!)
        .is('deleted_at', null)
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToMedicaoEquipamento);
    },
  });
}

/**
 * Leitura mais recente de um único equipamento (lê da view v_equipamento_medicao_atual).
 * Retorna null se o equipamento ainda não tem leitura.
 */
export function useMedicaoAtual(equipamentoId: string | null | undefined) {
  return useQuery<MedicaoAtualEquipamento | null>({
    queryKey: ['medicao_atual_equipamento', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipamento_medicao_atual')
        .select('*')
        .eq('equipamento_id', equipamentoId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        equipamentoId: data.equipamento_id,
        medicaoAtual: Number(data.medicao_atual ?? 0),
        tipoMedicao: (data.tipo_medicao ?? 'horimetro') as TipoMedicao,
        dataUltimaLeitura: data.data_ultima_leitura ?? '',
        origemUltimaLeitura: (data.origem_ultima_leitura ?? 'manual') as OrigemMedicao,
        origemIdUltimaLeitura: data.origem_id_ultima_leitura ?? null,
      };
    },
  });
}

/**
 * Mapa de medição atual para a frota inteira. Útil pro card do equipamento na /frota
 * mostrar "horímetro atual" sem fazer N queries.
 */
export function useMedicoesAtuaisFrota() {
  return useQuery<Map<string, MedicaoAtualEquipamento>>({
    queryKey: ['medicoes_atuais_frota'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipamento_medicao_atual')
        .select('*');
      if (error) throw error;
      const map = new Map<string, MedicaoAtualEquipamento>();
      for (const row of data ?? []) {
        map.set(row.equipamento_id, {
          equipamentoId: row.equipamento_id,
          medicaoAtual: Number(row.medicao_atual ?? 0),
          tipoMedicao: (row.tipo_medicao ?? 'horimetro') as TipoMedicao,
          dataUltimaLeitura: row.data_ultima_leitura ?? '',
          origemUltimaLeitura: (row.origem_ultima_leitura ?? 'manual') as OrigemMedicao,
          origemIdUltimaLeitura: row.origem_id_ultima_leitura ?? null,
        });
      }
      return map;
    },
  });
}

export function useAdicionarMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (medicao: MedicaoEquipamento) => {
      const { error } = await supabase
        .from('medicoes_equipamento')
        .insert(medicaoEquipamentoToDb(medicao));
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['medicoes_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['medicao_atual_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['medicoes_atuais_frota'] });
    },
  });
}

export function useAtualizarMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (medicao: MedicaoEquipamento) => {
      const { error } = await supabase
        .from('medicoes_equipamento')
        .update(medicaoEquipamentoToDb(medicao))
        .eq('id', medicao.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['medicoes_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['medicao_atual_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['medicoes_atuais_frota'] });
    },
  });
}

/**
 * Soft delete (marca deleted_at). NÃO recomendado pra uso geral - leitura
 * é histórico imutável. Reservado para corrigir erros de digitação.
 */
export function useExcluirMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; equipamentoId: string; deletedBy: string }) => {
      const { error } = await supabase
        .from('medicoes_equipamento')
        .update({ deleted_at: new Date().toISOString(), deleted_by: params.deletedBy })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['medicoes_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['medicao_atual_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['medicoes_atuais_frota'] });
    },
  });
}
