import type { StatusOS, PrioridadeOS, PlanoManutencao, HistoricoMedicao } from '../types';

export interface VencimentoPlano {
  vencido: boolean;
  diasRestantes: number | null;
  horasRestantes: number | null;
  kmRestantes: number | null;
}

export function calcularVencimentoPlano(
  plano: PlanoManutencao,
  ultimaMedicao: number,
): VencimentoPlano {
  let vencido = false;
  let diasRestantes: number | null = null;
  let horasRestantes: number | null = null;
  let kmRestantes: number | null = null;

  if (plano.intervaloHoras != null && plano.intervaloHoras > 0) {
    const proximaHora = plano.ultimaExecucaoMedicao + plano.intervaloHoras;
    horasRestantes = proximaHora - ultimaMedicao;
    if (horasRestantes <= 0) vencido = true;
  }

  if (plano.intervaloKm != null && plano.intervaloKm > 0) {
    const proximoKm = plano.ultimaExecucaoMedicao + plano.intervaloKm;
    kmRestantes = proximoKm - ultimaMedicao;
    if (kmRestantes <= 0) vencido = true;
  }

  if (plano.intervaloDias != null && plano.intervaloDias > 0 && plano.ultimaExecucaoData) {
    const ultima = new Date(plano.ultimaExecucaoData);
    const proxima = new Date(ultima);
    proxima.setDate(proxima.getDate() + plano.intervaloDias);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    proxima.setHours(0, 0, 0, 0);
    diasRestantes = Math.ceil((proxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    if (diasRestantes <= 0) vencido = true;
  }

  return { vencido, diasRestantes, horasRestantes, kmRestantes };
}

export function getCorStatus(status: StatusOS): string {
  const cores: Record<StatusOS, string> = {
    aberta: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    em_andamento: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    aguardando_peca: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    cancelada: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
  };
  return cores[status] ?? cores.aberta;
}

export function getCorPrioridade(prioridade: PrioridadeOS): string {
  const cores: Record<PrioridadeOS, string> = {
    baixa: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
    normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    critica: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  return cores[prioridade] ?? cores.normal;
}

export function labelStatus(status: StatusOS): string {
  const labels: Record<StatusOS, string> = {
    aberta: 'Aberta',
    em_andamento: 'Em Andamento',
    aguardando_peca: 'Aguardando Peça',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };
  return labels[status] ?? status;
}

export function labelPrioridade(prioridade: PrioridadeOS): string {
  const labels: Record<PrioridadeOS, string> = {
    baixa: 'Baixa',
    normal: 'Normal',
    alta: 'Alta',
    critica: 'Crítica',
  };
  return labels[prioridade] ?? prioridade;
}

export function contarAlertasEquipamento(
  equipamentoId: string,
  planos: PlanoManutencao[],
  medicoes: HistoricoMedicao[],
): number {
  const planosEq = planos.filter((p) => p.equipamentoId === equipamentoId && p.ativo);
  const medicoesEq = medicoes.filter((m) => m.equipamentoId === equipamentoId);
  const ultimaMedicao = medicoesEq.length > 0
    ? Math.max(...medicoesEq.map((m) => m.valor))
    : 0;

  return planosEq.filter((p) => calcularVencimentoPlano(p, ultimaMedicao).vencido).length;
}
