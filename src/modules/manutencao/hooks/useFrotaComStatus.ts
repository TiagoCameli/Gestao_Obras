import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  EquipamentoComStatusManutencao,
  ManutencaoCategoria,
  ManutencaoPrioridade,
} from '../types';

const KEY = ['manutencao', 'frota-com-status'] as const;

/**
 * Diferença em dias entre uma data ISO (YYYY-MM-DD) e hoje (positivo = futuro,
 * negativo = passado/atrasado).
 */
function diasAteHoje(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${dataIso}T00:00:00`);
  alvo.setHours(0, 0, 0, 0);
  const ms = alvo.getTime() - hoje.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface EquipamentoLite {
  id: string;
  nome: string;
  codigo_patrimonio: string;
  ativo: boolean;
  modelo_id: string | null;
  horimetro_atual: number | null;
  horimetro_funcional: boolean;
}

interface AgendamentoLite {
  id: string;
  equipamento_id: string;
  tarefa_id: string;
  data_prevista: string;
  status: string;
}

interface AlertaLite {
  equipamento_id: string;
  severidade: string;
}

interface RegistroLite {
  id: string;
  equipamento_id: string;
  tarefa_id: string;
  executado_em: string;
}

interface TarefaLite {
  id: string;
  titulo: string;
  categoria: string;
  prioridade: string;
}

interface ModeloLite {
  id: string;
  modelo_nome: string;
}

async function buildFrotaComStatus(): Promise<EquipamentoComStatusManutencao[]> {
  const { data: equipsRaw, error: errEq } = await supabase
    .from('equipamentos')
    .select(
      'id,nome,codigo_patrimonio,ativo,modelo_id,horimetro_atual,horimetro_funcional'
    )
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (errEq) throw errEq;
  const equips = (equipsRaw ?? []) as EquipamentoLite[];
  if (equips.length === 0) return [];

  const equipIds = equips.map((e) => e.id);
  const modeloIds = Array.from(
    new Set(equips.map((e) => e.modelo_id).filter((m): m is string => !!m))
  );

  const [agOpen, agAtrasados, alertas, registrosUlt, modelos] = await Promise.all([
    supabase
      .from('manutencao_agendamentos')
      .select('id,equipamento_id,tarefa_id,data_prevista,status')
      .in('equipamento_id', equipIds)
      .in('status', ['agendada', 'atrasada'])
      .order('data_prevista', { ascending: true }),
    supabase
      .from('manutencao_agendamentos')
      .select('id,equipamento_id,tarefa_id,data_prevista,status')
      .in('equipamento_id', equipIds)
      .eq('status', 'atrasada'),
    supabase
      .from('manutencao_alertas')
      .select('equipamento_id,severidade')
      .in('equipamento_id', equipIds)
      .is('reconhecido_em', null),
    supabase
      .from('manutencao_registros')
      .select('id,equipamento_id,tarefa_id,executado_em')
      .in('equipamento_id', equipIds)
      .order('executado_em', { ascending: false }),
    modeloIds.length > 0
      ? supabase.from('equipamento_modelos').select('id,modelo_nome').in('id', modeloIds)
      : Promise.resolve({ data: [] as ModeloLite[], error: null }),
  ]);
  if (agOpen.error) throw agOpen.error;
  if (agAtrasados.error) throw agAtrasados.error;
  if (alertas.error) throw alertas.error;
  if (registrosUlt.error) throw registrosUlt.error;
  if (modelos.error) throw modelos.error;

  const agOpenList = (agOpen.data ?? []) as AgendamentoLite[];
  const agAtrasadosList = (agAtrasados.data ?? []) as AgendamentoLite[];
  const alertasList = (alertas.data ?? []) as AlertaLite[];
  const registrosList = (registrosUlt.data ?? []) as RegistroLite[];
  const modelosList = (modelos.data ?? []) as ModeloLite[];

  // Tarefas referenciadas nos agendamentos abertos e nos últimos registros — pra exibir título
  const tarefaIds = Array.from(
    new Set([
      ...agOpenList.map((a) => a.tarefa_id),
      ...registrosList.map((r) => r.tarefa_id),
    ])
  );
  let tarefasMap = new Map<string, TarefaLite>();
  if (tarefaIds.length > 0) {
    const { data: tarefasRaw, error: errT } = await supabase
      .from('manutencao_tarefas')
      .select('id,titulo,categoria,prioridade')
      .in('id', tarefaIds);
    if (errT) throw errT;
    tarefasMap = new Map(
      (tarefasRaw ?? []).map((t) => [(t as TarefaLite).id, t as TarefaLite])
    );
  }

  const modeloMap = new Map(modelosList.map((m) => [m.id, m.modelo_nome]));

  // Próxima manutenção por equipamento (primeiro item ordenado de agOpenList)
  const proximaPorEquip = new Map<string, AgendamentoLite>();
  for (const a of agOpenList) {
    if (!proximaPorEquip.has(a.equipamento_id)) {
      proximaPorEquip.set(a.equipamento_id, a);
    }
  }

  // Atrasadas count
  const atrasadasPorEquip = new Map<string, number>();
  for (const a of agAtrasadosList) {
    atrasadasPorEquip.set(a.equipamento_id, (atrasadasPorEquip.get(a.equipamento_id) ?? 0) + 1);
  }

  // Alertas counts
  const alertasPorEquip = new Map<string, { total: number; criticos: number }>();
  for (const a of alertasList) {
    const cur = alertasPorEquip.get(a.equipamento_id) ?? { total: 0, criticos: 0 };
    cur.total += 1;
    if (a.severidade === 'critical') cur.criticos += 1;
    alertasPorEquip.set(a.equipamento_id, cur);
  }

  // Última manutenção por equipamento
  const ultimaPorEquip = new Map<string, RegistroLite>();
  for (const r of registrosList) {
    if (!ultimaPorEquip.has(r.equipamento_id)) {
      ultimaPorEquip.set(r.equipamento_id, r);
    }
  }

  return equips.map<EquipamentoComStatusManutencao>((e) => {
    const prox = proximaPorEquip.get(e.id);
    const proxTarefa = prox ? tarefasMap.get(prox.tarefa_id) : undefined;
    const ultima = ultimaPorEquip.get(e.id);
    const ultimaTarefa = ultima ? tarefasMap.get(ultima.tarefa_id) : undefined;
    const al = alertasPorEquip.get(e.id);

    return {
      equipamentoId: e.id,
      patrimony: e.codigo_patrimonio,
      nome: e.nome,
      modeloId: e.modelo_id ?? undefined,
      modeloNome: e.modelo_id ? modeloMap.get(e.modelo_id) : undefined,
      ativo: e.ativo,
      horimetroAtual: e.horimetro_atual ?? undefined,
      horimetroFuncional: e.horimetro_funcional,
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
      manutencoesAtrasadas: atrasadasPorEquip.get(e.id) ?? 0,
      alertasAtivos: al?.total ?? 0,
      alertasCriticos: al?.criticos ?? 0,
      ultimaManutencao: ultima && ultimaTarefa
        ? {
            registroId: ultima.id,
            tarefaTitulo: ultimaTarefa.titulo,
            executadoEm: ultima.executado_em,
          }
        : undefined,
    };
  });
}

export function useFrotaComStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: buildFrotaComStatus,
  });
}
