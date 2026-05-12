import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  PlanoPreventivo, PlanoAtividade, EquipamentoPlano, ProximaPreventiva,
  CategoriaAtividade, TipoMedicao,
} from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function dbToPlano(row: any): PlanoPreventivo {
  return {
    id: row.id, nome: row.nome ?? '',
    tipoEquipamento: row.tipo_equipamento ?? '',
    fabricante: row.fabricante ?? '',
    modeloReferencia: row.modelo_referencia ?? '',
    ativo: !!row.ativo,
    observacoes: row.observacoes ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by ?? '',
  };
}
function planoToDb(p: PlanoPreventivo) {
  return {
    id: p.id, nome: p.nome,
    tipo_equipamento: p.tipoEquipamento,
    fabricante: p.fabricante,
    modelo_referencia: p.modeloReferencia,
    ativo: p.ativo,
    observacoes: p.observacoes,
    created_by: p.createdBy,
    updated_by: p.updatedBy,
  };
}

function dbToAtividade(row: any): PlanoAtividade {
  return {
    id: row.id,
    planoId: row.plano_id,
    nome: row.nome ?? '',
    categoria: row.categoria ?? null,
    periodicidadeHorimetro: row.periodicidade_horimetro != null ? Number(row.periodicidade_horimetro) : null,
    periodicidadeKm: row.periodicidade_km != null ? Number(row.periodicidade_km) : null,
    periodicidadeDias: row.periodicidade_dias != null ? Number(row.periodicidade_dias) : null,
    toleranciaPercentual: Number(row.tolerancia_percentual ?? 10),
    tempoEstimadoH: row.tempo_estimado_h != null ? Number(row.tempo_estimado_h) : null,
    custoEstimado: row.custo_estimado != null ? Number(row.custo_estimado) : null,
    procedimento: row.procedimento ?? '',
    obrigatoria: !!row.obrigatoria,
    ordem: Number(row.ordem ?? 0),
    exigeOficinaExterna: !!row.exige_oficina_externa,
    epiNecessario: row.epi_necessario ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}
function atividadeToDb(a: PlanoAtividade) {
  return {
    id: a.id,
    plano_id: a.planoId,
    nome: a.nome,
    categoria: a.categoria,
    periodicidade_horimetro: a.periodicidadeHorimetro,
    periodicidade_km: a.periodicidadeKm,
    periodicidade_dias: a.periodicidadeDias,
    tolerancia_percentual: a.toleranciaPercentual,
    tempo_estimado_h: a.tempoEstimadoH,
    custo_estimado: a.custoEstimado,
    procedimento: a.procedimento,
    obrigatoria: a.obrigatoria,
    ordem: a.ordem,
    exige_oficina_externa: a.exigeOficinaExterna,
    epi_necessario: a.epiNecessario,
    arquivo_urls: a.arquivoUrls,
    created_by: a.createdBy,
  };
}

function dbToEquipPlano(row: any): EquipamentoPlano {
  return {
    id: row.id,
    equipamentoId: row.equipamento_id,
    planoId: row.plano_id,
    ativo: !!row.ativo,
    dataInicio: row.data_inicio,
    observacoes: row.observacoes ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

function dbToProxima(row: any): ProximaPreventiva {
  return {
    equipamentoId: row.equipamento_id,
    codigoPatrimonio: row.codigo_patrimonio ?? '',
    equipamentoNome: row.equipamento_nome ?? '',
    equipamentoTipo: row.equipamento_tipo ?? '',
    tipoMedicao: (row.tipo_medicao ?? 'horimetro') as TipoMedicao,
    atividadeId: row.atividade_id,
    atividadeNome: row.atividade_nome ?? '',
    categoria: row.categoria as CategoriaAtividade | null,
    periodicidadeHorimetro: row.periodicidade_horimetro != null ? Number(row.periodicidade_horimetro) : null,
    periodicidadeKm: row.periodicidade_km != null ? Number(row.periodicidade_km) : null,
    periodicidadeDias: row.periodicidade_dias != null ? Number(row.periodicidade_dias) : null,
    toleranciaPercentual: Number(row.tolerancia_percentual ?? 10),
    obrigatoria: !!row.obrigatoria,
    ultimaExecucaoData: row.ultima_execucao_data ?? null,
    ultimaExecucaoMedicao: row.ultima_execucao_medicao != null ? Number(row.ultima_execucao_medicao) : null,
    medicaoAtual: row.medicao_atual != null ? Number(row.medicao_atual) : null,
    proximaMedicao: row.proxima_medicao != null ? Number(row.proxima_medicao) : null,
    unidadesRestantes: row.unidades_restantes != null ? Number(row.unidades_restantes) : null,
    proximaData: row.proxima_data ?? null,
    diasRestantes: row.dias_restantes != null ? Number(row.dias_restantes) : null,
  };
}

// ── Queries ──────────────────────────────────────────────────────────

export function usePlanosPreventivos() {
  return useQuery({
    queryKey: ['planos_preventivos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_preventivos')
        .select('*')
        .is('deleted_at', null)
        .order('tipo_equipamento')
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(dbToPlano);
    },
  });
}

export function useAtividadesPlano(planoId: string | null | undefined) {
  return useQuery<PlanoAtividade[]>({
    queryKey: ['plano_atividades', planoId ?? ''],
    enabled: !!planoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_atividades')
        .select('*')
        .eq('plano_id', planoId!)
        .order('ordem');
      if (error) throw error;
      return (data ?? []).map(dbToAtividade);
    },
  });
}

export function usePlanosDeEquipamento(equipamentoId: string | null | undefined) {
  return useQuery<EquipamentoPlano[]>({
    queryKey: ['equipamento_plano', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipamento_plano')
        .select('*')
        .eq('equipamento_id', equipamentoId!)
        .eq('ativo', true);
      if (error) throw error;
      return (data ?? []).map(dbToEquipPlano);
    },
  });
}

export function useProximasPreventivas(equipamentoId?: string | null) {
  return useQuery<ProximaPreventiva[]>({
    queryKey: ['proximas_preventivas', equipamentoId ?? 'todas'],
    queryFn: async () => {
      let q = supabase.from('v_proximas_preventivas').select('*');
      if (equipamentoId) q = q.eq('equipamento_id', equipamentoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(dbToProxima);
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function useSalvarPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plano: PlanoPreventivo) => {
      const payload = planoToDb(plano);
      const { error } = await supabase
        .from('planos_preventivos')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planos_preventivos'] });
    },
  });
}

export function useExcluirPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; deletedBy: string }) => {
      const { error } = await supabase
        .from('planos_preventivos')
        .update({ deleted_at: new Date().toISOString(), deleted_by: params.deletedBy })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planos_preventivos'] });
      qc.invalidateQueries({ queryKey: ['proximas_preventivas'] });
    },
  });
}

export function useSalvarAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (atividade: PlanoAtividade) => {
      const payload = atividadeToDb(atividade);
      const { error } = await supabase
        .from('plano_atividades')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['plano_atividades', variables.planoId] });
      qc.invalidateQueries({ queryKey: ['proximas_preventivas'] });
    },
  });
}

export function useExcluirAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; planoId: string }) => {
      const { error } = await supabase
        .from('plano_atividades')
        .delete()
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['plano_atividades', variables.planoId] });
      qc.invalidateQueries({ queryKey: ['proximas_preventivas'] });
    },
  });
}

export function useAplicarPlanoEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { equipamentoId: string; planoId: string; dataInicio: string; createdBy: string }) => {
      const { error } = await supabase.from('equipamento_plano').insert({
        id: gerarId(),
        equipamento_id: params.equipamentoId,
        plano_id: params.planoId,
        ativo: true,
        data_inicio: params.dataInicio,
        created_by: params.createdBy,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['equipamento_plano', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['proximas_preventivas'] });
    },
  });
}

export function useRemoverPlanoEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; equipamentoId: string }) => {
      const { error } = await supabase
        .from('equipamento_plano')
        .update({ ativo: false })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['equipamento_plano', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['proximas_preventivas'] });
    },
  });
}
