import { supabase } from '../../../lib/supabase';
import type {
  ManutencaoAgendamento,
  ManutencaoAgendamentoRow,
  ManutencaoAgendamentoStatus,
  ManutencaoTarefa,
} from '../types';
import { listTarefasPorModelo, getTarefa } from './manutencaoTarefasApi';

const TABELA = 'manutencao_agendamentos';

/** Estimativa média de operação para converter intervalo em horas → dias. */
const HORAS_OPERACAO_POR_MES = 225;
const DIAS_POR_MES = 30;

export function rowToAgendamento(r: ManutencaoAgendamentoRow): ManutencaoAgendamento {
  return {
    id: r.id,
    equipamentoId: r.equipamento_id,
    tarefaId: r.tarefa_id,
    dataPrevista: r.data_prevista,
    horimetroPrevisto: r.horimetro_previsto ?? undefined,
    custoEstimadoBrl: r.custo_estimado_brl ?? undefined,
    status: r.status as ManutencaoAgendamentoStatus,
    alertaDiasAntes: r.alerta_dias_antes ?? undefined,
    origem: r.origem as ManutencaoAgendamento['origem'],
    baseadoEmRegistroId: r.baseado_em_registro_id ?? undefined,
    observacao: r.observacao ?? undefined,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    criadoPor: r.criado_por,
  };
}

export function agendamentoToInsert(a: Partial<ManutencaoAgendamento>): Record<string, unknown> {
  return {
    ...(a.id !== undefined ? { id: a.id } : {}),
    equipamento_id: a.equipamentoId,
    tarefa_id: a.tarefaId,
    data_prevista: a.dataPrevista,
    horimetro_previsto: a.horimetroPrevisto ?? null,
    custo_estimado_brl: a.custoEstimadoBrl ?? null,
    status: a.status ?? 'agendada',
    alerta_dias_antes: a.alertaDiasAntes ?? 7,
    origem: a.origem ?? 'manual',
    baseado_em_registro_id: a.baseadoEmRegistroId ?? null,
    observacao: a.observacao ?? null,
    criado_por: a.criadoPor ?? '',
  };
}

export interface FiltrosAgendamento {
  equipamentoId?: string;
  status?: ManutencaoAgendamentoStatus | ManutencaoAgendamentoStatus[];
  ate?: string; // YYYY-MM-DD — só agendamentos com data_prevista <= este
  desde?: string; // YYYY-MM-DD
}

export async function listAgendamentos(
  filtros?: FiltrosAgendamento
): Promise<ManutencaoAgendamento[]> {
  let query = supabase.from(TABELA).select('*');
  if (filtros?.equipamentoId) query = query.eq('equipamento_id', filtros.equipamentoId);
  if (filtros?.status) {
    query = Array.isArray(filtros.status)
      ? query.in('status', filtros.status)
      : query.eq('status', filtros.status);
  }
  if (filtros?.desde) query = query.gte('data_prevista', filtros.desde);
  if (filtros?.ate) query = query.lte('data_prevista', filtros.ate);
  const { data, error } = await query.order('data_prevista', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToAgendamento(r as ManutencaoAgendamentoRow));
}

export async function getAgendamento(id: string): Promise<ManutencaoAgendamento | null> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToAgendamento(data as ManutencaoAgendamentoRow) : null;
}

export async function createAgendamento(
  agendamento: Partial<ManutencaoAgendamento> & {
    equipamentoId: string;
    tarefaId: string;
    dataPrevista: string;
    criadoPor: string;
  }
): Promise<ManutencaoAgendamento> {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(agendamentoToInsert(agendamento))
    .select('*')
    .single();
  if (error) throw error;
  return rowToAgendamento(data as ManutencaoAgendamentoRow);
}

export async function updateAgendamento(
  id: string,
  patch: Partial<ManutencaoAgendamento>
): Promise<ManutencaoAgendamento> {
  const update: Record<string, unknown> = {};
  if (patch.dataPrevista !== undefined) update.data_prevista = patch.dataPrevista;
  if (patch.horimetroPrevisto !== undefined) update.horimetro_previsto = patch.horimetroPrevisto;
  if (patch.custoEstimadoBrl !== undefined) update.custo_estimado_brl = patch.custoEstimadoBrl;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.alertaDiasAntes !== undefined) update.alerta_dias_antes = patch.alertaDiasAntes;
  if (patch.origem !== undefined) update.origem = patch.origem;
  if (patch.baseadoEmRegistroId !== undefined)
    update.baseado_em_registro_id = patch.baseadoEmRegistroId;
  if (patch.observacao !== undefined) update.observacao = patch.observacao;

  const { data, error } = await supabase
    .from(TABELA)
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToAgendamento(data as ManutencaoAgendamentoRow);
}

export async function deleteAgendamento(id: string): Promise<void> {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}

/* ─── Cálculos de cronograma ─────────────────────────────────────────── */

function addDiasIso(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Converte intervalo em horas para dias usando estimativa média. */
function horasParaDias(horas: number): number {
  return Math.ceil((horas / HORAS_OPERACAO_POR_MES) * DIAS_POR_MES);
}

function calcularDataPrevista(referencia: string, tarefa: ManutencaoTarefa): string {
  const dias =
    tarefa.intervaloDias ??
    (tarefa.intervaloHoras ? horasParaDias(tarefa.intervaloHoras) : 30);
  return addDiasIso(referencia, dias);
}

/**
 * Para um equipamento com `modelo_id` associado, cria um agendamento futuro
 * para CADA tarefa ativa do modelo, somando o intervalo à dataReferencia.
 * Ignora tarefas que já tenham agendamento aberto (não duplica).
 */
export async function gerarAgendaInicial(
  equipamentoId: string,
  dataReferencia: string,
  criadoPor: string
): Promise<ManutencaoAgendamento[]> {
  const { data: equipRow, error: errEq } = await supabase
    .from('equipamentos')
    .select('modelo_id')
    .eq('id', equipamentoId)
    .maybeSingle();
  if (errEq) throw errEq;
  const modeloId = (equipRow as { modelo_id: string | null } | null)?.modelo_id;
  if (!modeloId) {
    throw new Error(
      `Equipamento ${equipamentoId} não possui modelo associado — associe um modelo antes de gerar a agenda.`
    );
  }

  const tarefas = await listTarefasPorModelo(modeloId);
  if (tarefas.length === 0) return [];

  // Tarefas que já têm agendamento aberto (agendada ou atrasada) — não duplicar
  const { data: existentes, error: errExist } = await supabase
    .from(TABELA)
    .select('tarefa_id')
    .eq('equipamento_id', equipamentoId)
    .in('status', ['agendada', 'atrasada']);
  if (errExist) throw errExist;
  const jaAgendadas = new Set(
    (existentes ?? []).map((e) => (e as { tarefa_id: string }).tarefa_id)
  );

  const inserts = tarefas
    .filter((t) => !jaAgendadas.has(t.id))
    .map((t) => agendamentoToInsert({
      equipamentoId,
      tarefaId: t.id,
      dataPrevista: calcularDataPrevista(dataReferencia, t),
      status: 'agendada',
      origem: 'auto',
      criadoPor,
    }));

  if (inserts.length === 0) return [];

  const { data, error } = await supabase.from(TABELA).insert(inserts).select('*');
  if (error) throw error;
  return (data ?? []).map((r) => rowToAgendamento(r as ManutencaoAgendamentoRow));
}

/**
 * Após a conclusão de um registro de manutenção, marca o agendamento
 * vinculado como `concluida` e cria o próximo agendamento futuro para a
 * mesma tarefa, partindo da data de execução.
 */
export async function recalcularAgendamentoAposExecucao(
  registroId: string
): Promise<ManutencaoAgendamento | null> {
  const { data: regRow, error: errReg } = await supabase
    .from('manutencao_registros')
    .select('equipamento_id, tarefa_id, agendamento_id, executado_em, criado_por')
    .eq('id', registroId)
    .maybeSingle();
  if (errReg) throw errReg;
  if (!regRow) throw new Error(`Registro ${registroId} não encontrado`);
  const reg = regRow as {
    equipamento_id: string;
    tarefa_id: string;
    agendamento_id: string | null;
    executado_em: string;
    criado_por: string;
  };

  if (reg.agendamento_id) {
    const { error: errClose } = await supabase
      .from(TABELA)
      .update({ status: 'concluida' })
      .eq('id', reg.agendamento_id);
    if (errClose) throw errClose;
  }

  const tarefa = await getTarefa(reg.tarefa_id);
  if (!tarefa) return null;

  const refIso = reg.executado_em.slice(0, 10);
  const dataPrevista = calcularDataPrevista(refIso, tarefa);

  const proximo = await createAgendamento({
    equipamentoId: reg.equipamento_id,
    tarefaId: reg.tarefa_id,
    dataPrevista,
    status: 'agendada',
    origem: 'auto',
    baseadoEmRegistroId: registroId,
    criadoPor: reg.criado_por,
  });
  return proximo;
}
