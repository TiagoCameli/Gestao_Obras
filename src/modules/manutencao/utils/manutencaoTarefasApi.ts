import { supabase } from '../../../lib/supabase';
import type {
  CriterioAceite,
  ExecutorPapel,
  FerramentaRef,
  FluidoConsumo,
  ManutencaoCategoria,
  ManutencaoPrioridade,
  ManutencaoTarefa,
  ManutencaoTarefaRow,
  PecaConsumo,
  ProcedimentoStep,
  SinalAlerta,
  SpecTecnica,
  TorqueSpec,
} from '../types';

const TABELA = 'manutencao_tarefas';

export function rowToTarefa(r: ManutencaoTarefaRow): ManutencaoTarefa {
  return {
    id: r.id,
    modeloId: r.modelo_id,
    titulo: r.titulo,
    categoria: r.categoria as ManutencaoCategoria,
    intervaloHoras: r.intervalo_horas ?? undefined,
    intervaloDias: r.intervalo_dias ?? undefined,
    prioridade: r.prioridade as ManutencaoPrioridade,
    executorPapel: r.executor_papel as ExecutorPapel,
    duracaoEstimadaMin: r.duracao_estimada_min ?? undefined,
    pecasNecessarias: (r.pecas_necessarias ?? []) as PecaConsumo[],
    fluidosNecessarios: (r.fluidos_necessarios ?? []) as FluidoConsumo[],
    ferramentasNecessarias: (r.ferramentas_necessarias ?? []) as FerramentaRef[],
    procedimento: (r.procedimento ?? []) as ProcedimentoStep[],
    descricaoTecnica: r.descricao_tecnica ?? '',
    sistemasAfetados: r.sistemas_afetados ?? [],
    torques: (r.torques ?? []) as TorqueSpec[],
    specsTecnicas: (r.specs_tecnicas ?? []) as SpecTecnica[],
    criteriosAceite: (r.criterios_aceite ?? []) as CriterioAceite[],
    sinaisAlerta: (r.sinais_alerta ?? []) as SinalAlerta[],
    notasSeguranca: r.notas_seguranca ?? undefined,
    epi: r.epi ?? undefined,
    notasTecnicas: r.notas_tecnicas ?? undefined,
    manualReferencia: r.manual_referencia ?? undefined,
    preRequisitos: r.pre_requisitos ?? undefined,
    ativo: r.ativo,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    criadoPor: r.criado_por,
  };
}

export function tarefaToInsert(t: ManutencaoTarefa): Record<string, unknown> {
  return {
    id: t.id,
    modelo_id: t.modeloId,
    titulo: t.titulo,
    categoria: t.categoria,
    intervalo_horas: t.intervaloHoras ?? null,
    intervalo_dias: t.intervaloDias ?? null,
    prioridade: t.prioridade,
    executor_papel: t.executorPapel,
    duracao_estimada_min: t.duracaoEstimadaMin ?? null,
    pecas_necessarias: t.pecasNecessarias ?? [],
    fluidos_necessarios: t.fluidosNecessarios ?? [],
    ferramentas_necessarias: t.ferramentasNecessarias ?? [],
    procedimento: t.procedimento ?? [],
    descricao_tecnica: t.descricaoTecnica ?? '',
    sistemas_afetados: t.sistemasAfetados ?? [],
    torques: t.torques ?? [],
    specs_tecnicas: t.specsTecnicas ?? [],
    criterios_aceite: t.criteriosAceite ?? [],
    sinais_alerta: t.sinaisAlerta ?? [],
    notas_seguranca: t.notasSeguranca ?? null,
    epi: t.epi ?? null,
    notas_tecnicas: t.notasTecnicas ?? null,
    manual_referencia: t.manualReferencia ?? null,
    pre_requisitos: t.preRequisitos ?? null,
    ativo: t.ativo,
    criado_por: t.criadoPor,
  };
}

export async function listTarefasPorModelo(modeloId: string): Promise<ManutencaoTarefa[]> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('modelo_id', modeloId)
    .eq('ativo', true)
    .order('intervalo_horas', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToTarefa(r as ManutencaoTarefaRow));
}

export async function getTarefa(id: string): Promise<ManutencaoTarefa | null> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToTarefa(data as ManutencaoTarefaRow) : null;
}

export async function createTarefa(tarefa: ManutencaoTarefa): Promise<ManutencaoTarefa> {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(tarefaToInsert(tarefa))
    .select('*')
    .single();
  if (error) throw error;
  return rowToTarefa(data as ManutencaoTarefaRow);
}

export async function updateTarefa(
  id: string,
  patch: Partial<ManutencaoTarefa>
): Promise<ManutencaoTarefa> {
  const update: Record<string, unknown> = {};
  const map: Array<[keyof ManutencaoTarefa, string]> = [
    ['titulo', 'titulo'],
    ['categoria', 'categoria'],
    ['intervaloHoras', 'intervalo_horas'],
    ['intervaloDias', 'intervalo_dias'],
    ['prioridade', 'prioridade'],
    ['executorPapel', 'executor_papel'],
    ['duracaoEstimadaMin', 'duracao_estimada_min'],
    ['pecasNecessarias', 'pecas_necessarias'],
    ['fluidosNecessarios', 'fluidos_necessarios'],
    ['ferramentasNecessarias', 'ferramentas_necessarias'],
    ['procedimento', 'procedimento'],
    ['descricaoTecnica', 'descricao_tecnica'],
    ['sistemasAfetados', 'sistemas_afetados'],
    ['torques', 'torques'],
    ['specsTecnicas', 'specs_tecnicas'],
    ['criteriosAceite', 'criterios_aceite'],
    ['sinaisAlerta', 'sinais_alerta'],
    ['notasSeguranca', 'notas_seguranca'],
    ['epi', 'epi'],
    ['notasTecnicas', 'notas_tecnicas'],
    ['manualReferencia', 'manual_referencia'],
    ['preRequisitos', 'pre_requisitos'],
    ['ativo', 'ativo'],
  ];
  for (const [camel, snake] of map) {
    if (patch[camel] !== undefined) update[snake] = patch[camel];
  }

  const { data, error } = await supabase
    .from(TABELA)
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToTarefa(data as ManutencaoTarefaRow);
}

export async function deleteTarefa(id: string): Promise<void> {
  const { error } = await supabase.from(TABELA).update({ ativo: false }).eq('id', id);
  if (error) throw error;
}
