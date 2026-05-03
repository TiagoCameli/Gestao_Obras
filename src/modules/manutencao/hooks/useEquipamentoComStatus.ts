import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  EquipamentoComStatusManutencao,
  ManutencaoCategoria,
  ManutencaoPrioridade,
} from '../types';

const KEY = (equipamentoId: string | undefined) =>
  ['manutencao', 'equipamento-com-status', equipamentoId ?? ''] as const;

function diasAteHoje(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${dataIso}T00:00:00`);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

interface EquipRow {
  id: string;
  nome: string;
  codigo_patrimonio: string;
  ativo: boolean;
  modelo_id: string | null;
  horimetro_atual: number | null;
  horimetro_funcional: boolean;
}

async function buildOne(
  equipamentoId: string
): Promise<EquipamentoComStatusManutencao | null> {
  const { data: equipRaw, error: errEq } = await supabase
    .from('equipamentos')
    .select(
      'id,nome,codigo_patrimonio,ativo,modelo_id,horimetro_atual,horimetro_funcional'
    )
    .eq('id', equipamentoId)
    .maybeSingle();
  if (errEq) throw errEq;
  if (!equipRaw) return null;
  const equip = equipRaw as EquipRow;

  const [proxRes, atrasadosRes, alertasRes, ultimoRes, modeloRes] = await Promise.all([
    supabase
      .from('manutencao_agendamentos')
      .select('id,tarefa_id,data_prevista,status')
      .eq('equipamento_id', equipamentoId)
      .in('status', ['agendada', 'atrasada'])
      .order('data_prevista', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('manutencao_agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('equipamento_id', equipamentoId)
      .eq('status', 'atrasada'),
    supabase
      .from('manutencao_alertas')
      .select('severidade')
      .eq('equipamento_id', equipamentoId)
      .is('reconhecido_em', null),
    supabase
      .from('manutencao_registros')
      .select('id,tarefa_id,executado_em')
      .eq('equipamento_id', equipamentoId)
      .order('executado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
    equip.modelo_id
      ? supabase
          .from('equipamento_modelos')
          .select('modelo_nome')
          .eq('id', equip.modelo_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (proxRes.error) throw proxRes.error;
  if (atrasadosRes.error) throw atrasadosRes.error;
  if (alertasRes.error) throw alertasRes.error;
  if (ultimoRes.error) throw ultimoRes.error;
  if (modeloRes.error) throw modeloRes.error;

  const prox = proxRes.data as
    | { id: string; tarefa_id: string; data_prevista: string; status: string }
    | null;
  const ultimo = ultimoRes.data as
    | { id: string; tarefa_id: string; executado_em: string }
    | null;
  const alertasList = (alertasRes.data ?? []) as Array<{ severidade: string }>;
  const modeloRow = modeloRes.data as { modelo_nome: string } | null;

  const tarefaIds = [prox?.tarefa_id, ultimo?.tarefa_id].filter(
    (i): i is string => !!i
  );
  let tarefaMap = new Map<
    string,
    { titulo: string; categoria: string; prioridade: string }
  >();
  if (tarefaIds.length > 0) {
    const { data: tarefasRaw, error } = await supabase
      .from('manutencao_tarefas')
      .select('id,titulo,categoria,prioridade')
      .in('id', Array.from(new Set(tarefaIds)));
    if (error) throw error;
    tarefaMap = new Map(
      (tarefasRaw ?? []).map((t) => [
        (t as { id: string }).id,
        t as { id: string; titulo: string; categoria: string; prioridade: string },
      ])
    );
  }

  const proxTarefa = prox ? tarefaMap.get(prox.tarefa_id) : undefined;
  const ultimaTarefa = ultimo ? tarefaMap.get(ultimo.tarefa_id) : undefined;

  return {
    equipamentoId: equip.id,
    patrimony: equip.codigo_patrimonio,
    nome: equip.nome,
    modeloId: equip.modelo_id ?? undefined,
    modeloNome: modeloRow?.modelo_nome,
    ativo: equip.ativo,
    horimetroAtual: equip.horimetro_atual ?? undefined,
    horimetroFuncional: equip.horimetro_funcional,
    proximaManutencao: prox && proxTarefa
      ? {
          agendamentoId: prox.id,
          tarefaId: prox.tarefa_id,
          tarefaTitulo: proxTarefa.titulo,
          categoria: proxTarefa.categoria as ManutencaoCategoria,
          dataPrevista: prox.data_prevista,
          diasRestantes: diasAteHoje(prox.data_prevista),
          prioridade: proxTarefa.prioridade as ManutencaoPrioridade,
        }
      : undefined,
    manutencoesAtrasadas: atrasadosRes.count ?? 0,
    alertasAtivos: alertasList.length,
    alertasCriticos: alertasList.filter((a) => a.severidade === 'critical').length,
    ultimaManutencao: ultimo && ultimaTarefa
      ? {
          registroId: ultimo.id,
          tarefaTitulo: ultimaTarefa.titulo,
          executadoEm: ultimo.executado_em,
        }
      : undefined,
  };
}

export function useEquipamentoComStatus(equipamentoId: string | undefined) {
  return useQuery({
    queryKey: KEY(equipamentoId),
    queryFn: () => buildOne(equipamentoId!),
    enabled: !!equipamentoId,
  });
}
