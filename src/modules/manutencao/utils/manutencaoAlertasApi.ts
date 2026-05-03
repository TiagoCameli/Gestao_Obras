import { supabase } from '../../../lib/supabase';
import type {
  AlertaSeveridade,
  AlertaTipo,
  ManutencaoAlerta,
  ManutencaoAlertaRow,
} from '../types';

const TABELA = 'manutencao_alertas';

export function rowToAlerta(r: ManutencaoAlertaRow): ManutencaoAlerta {
  return {
    id: r.id,
    equipamentoId: r.equipamento_id,
    tipo: r.tipo as AlertaTipo,
    severidade: r.severidade as AlertaSeveridade,
    mensagem: r.mensagem,
    agendamentoId: r.agendamento_id ?? undefined,
    registroId: r.registro_id ?? undefined,
    reconhecidoEm: r.reconhecido_em ?? undefined,
    reconhecidoPorFuncionarioId: r.reconhecido_por_funcionario_id ?? undefined,
    criadoEm: r.criado_em,
    criadoPor: r.criado_por,
  };
}

export function alertaToInsert(a: Partial<ManutencaoAlerta>): Record<string, unknown> {
  return {
    ...(a.id !== undefined ? { id: a.id } : {}),
    equipamento_id: a.equipamentoId,
    tipo: a.tipo,
    severidade: a.severidade ?? 'info',
    mensagem: a.mensagem,
    agendamento_id: a.agendamentoId ?? null,
    registro_id: a.registroId ?? null,
    reconhecido_em: a.reconhecidoEm ?? null,
    reconhecido_por_funcionario_id: a.reconhecidoPorFuncionarioId ?? null,
    criado_por: a.criadoPor ?? '',
  };
}

export interface FiltrosAlerta {
  equipamentoId?: string;
  abertos?: boolean; // true = só não-reconhecidos
  severidade?: AlertaSeveridade;
  tipo?: AlertaTipo;
}

export async function listAlertas(filtros?: FiltrosAlerta): Promise<ManutencaoAlerta[]> {
  let query = supabase.from(TABELA).select('*');
  if (filtros?.equipamentoId) query = query.eq('equipamento_id', filtros.equipamentoId);
  if (filtros?.severidade) query = query.eq('severidade', filtros.severidade);
  if (filtros?.tipo) query = query.eq('tipo', filtros.tipo);
  if (filtros?.abertos) query = query.is('reconhecido_em', null);
  const { data, error } = await query.order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToAlerta(r as ManutencaoAlertaRow));
}

export async function getAlerta(id: string): Promise<ManutencaoAlerta | null> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToAlerta(data as ManutencaoAlertaRow) : null;
}

export async function createAlerta(
  alerta: Partial<ManutencaoAlerta> & {
    equipamentoId: string;
    tipo: AlertaTipo;
    mensagem: string;
    criadoPor: string;
  }
): Promise<ManutencaoAlerta> {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(alertaToInsert(alerta))
    .select('*')
    .single();
  if (error) throw error;
  return rowToAlerta(data as ManutencaoAlertaRow);
}

export async function updateAlerta(
  id: string,
  patch: Partial<ManutencaoAlerta>
): Promise<ManutencaoAlerta> {
  const update: Record<string, unknown> = {};
  if (patch.tipo !== undefined) update.tipo = patch.tipo;
  if (patch.severidade !== undefined) update.severidade = patch.severidade;
  if (patch.mensagem !== undefined) update.mensagem = patch.mensagem;
  if (patch.agendamentoId !== undefined) update.agendamento_id = patch.agendamentoId;
  if (patch.registroId !== undefined) update.registro_id = patch.registroId;
  if (patch.reconhecidoEm !== undefined) update.reconhecido_em = patch.reconhecidoEm;
  if (patch.reconhecidoPorFuncionarioId !== undefined)
    update.reconhecido_por_funcionario_id = patch.reconhecidoPorFuncionarioId;

  const { data, error } = await supabase
    .from(TABELA)
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToAlerta(data as ManutencaoAlertaRow);
}

export async function deleteAlerta(id: string): Promise<void> {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Marca um alerta como reconhecido (visualizado e tratado).
 */
export async function reconhecerAlerta(
  alertaId: string,
  funcionarioId: string
): Promise<ManutencaoAlerta> {
  const { data, error } = await supabase
    .from(TABELA)
    .update({
      reconhecido_em: new Date().toISOString(),
      reconhecido_por_funcionario_id: funcionarioId,
    })
    .eq('id', alertaId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToAlerta(data as ManutencaoAlertaRow);
}

/**
 * Varre `manutencao_agendamentos` com data prevista no passado e status ainda
 * aberto, atualiza o status para 'atrasada' (se ainda não estava) e cria um
 * alerta `manutencao_atrasada` para cada um que ainda não tenha alerta aberto.
 */
export async function gerarAlertasAtrasados(criadoPor: string): Promise<ManutencaoAlerta[]> {
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: atrasadosRows, error: errAg } = await supabase
    .from('manutencao_agendamentos')
    .select('id, equipamento_id, tarefa_id, data_prevista, status')
    .lt('data_prevista', hoje)
    .in('status', ['agendada', 'atrasada']);
  if (errAg) throw errAg;
  const atrasados = (atrasadosRows ?? []) as Array<{
    id: string;
    equipamento_id: string;
    tarefa_id: string;
    data_prevista: string;
    status: string;
  }>;
  if (atrasados.length === 0) return [];

  // Sobe pra 'atrasada' os que ainda estavam 'agendada'
  const idsAindaAgendados = atrasados.filter((a) => a.status === 'agendada').map((a) => a.id);
  if (idsAindaAgendados.length > 0) {
    const { error: errStatus } = await supabase
      .from('manutencao_agendamentos')
      .update({ status: 'atrasada' })
      .in('id', idsAindaAgendados);
    if (errStatus) throw errStatus;
  }

  // Verifica quais já têm alerta aberto pra não duplicar
  const agIds = atrasados.map((a) => a.id);
  const { data: existentesRows, error: errEx } = await supabase
    .from(TABELA)
    .select('agendamento_id')
    .in('agendamento_id', agIds)
    .eq('tipo', 'manutencao_atrasada')
    .is('reconhecido_em', null);
  if (errEx) throw errEx;
  const jaTemAlerta = new Set(
    (existentesRows ?? []).map((e) => (e as { agendamento_id: string }).agendamento_id)
  );

  const inserts = atrasados
    .filter((a) => !jaTemAlerta.has(a.id))
    .map((a) =>
      alertaToInsert({
        equipamentoId: a.equipamento_id,
        tipo: 'manutencao_atrasada',
        severidade: 'warning',
        mensagem: `Manutenção prevista para ${a.data_prevista} ainda não foi executada.`,
        agendamentoId: a.id,
        criadoPor,
      })
    );

  if (inserts.length === 0) return [];

  const { data, error } = await supabase.from(TABELA).insert(inserts).select('*');
  if (error) throw error;
  return (data ?? []).map((r) => rowToAlerta(r as ManutencaoAlertaRow));
}
