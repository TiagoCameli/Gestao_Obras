import { useMemo } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import PrioridadeBadge from '../badges/PrioridadeBadge';
import ManutencaoEmptyState from '../shared/ManutencaoEmptyState';
import type { ManutencaoAgendamento, ManutencaoTarefa } from '../../types';

export interface AgendaListProps {
  agendamentos: ManutencaoAgendamento[];
  tarefas: ManutencaoTarefa[];
  onItemClick?: (agendamentoId: string) => void;
  className?: string;
}

type Grupo = 'atrasadas' | 'esta_semana' | 'proximas' | 'distantes';

const TITULO_GRUPO: Record<Grupo, string> = {
  atrasadas: 'Atrasadas',
  esta_semana: 'Esta semana',
  proximas: 'Próximas (30 dias)',
  distantes: 'Mais distantes',
};

function diasAteHoje(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(dataIso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
}

function grupoDe(dias: number): Grupo {
  if (dias < 0) return 'atrasadas';
  if (dias <= 7) return 'esta_semana';
  if (dias <= 30) return 'proximas';
  return 'distantes';
}

function iconeStatus(status: ManutencaoAgendamento['status']) {
  if (status === 'concluida')
    return <CheckCircle2 aria-hidden className="w-4 h-4 text-[var(--color-success-fg)]" />;
  if (status === 'cancelada')
    return <XCircle aria-hidden className="w-4 h-4 text-[var(--color-fg-subtle)]" />;
  if (status === 'atrasada')
    return <AlertTriangle aria-hidden className="w-4 h-4 text-[var(--color-danger-fg)]" />;
  return <Calendar aria-hidden className="w-4 h-4 text-[var(--color-fg-muted)]" />;
}

export function AgendaList({
  agendamentos,
  tarefas,
  onItemClick,
  className = '',
}: AgendaListProps) {
  const tarefaPorId = useMemo(() => {
    const m = new Map<string, ManutencaoTarefa>();
    tarefas.forEach((t) => m.set(t.id, t));
    return m;
  }, [tarefas]);

  const grupos = useMemo(() => {
    const map: Record<Grupo, ManutencaoAgendamento[]> = {
      atrasadas: [],
      esta_semana: [],
      proximas: [],
      distantes: [],
    };
    [...agendamentos]
      .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista))
      .forEach((a) => {
        const g = grupoDe(diasAteHoje(a.dataPrevista));
        map[g].push(a);
      });
    return map;
  }, [agendamentos]);

  if (agendamentos.length === 0) {
    return (
      <ManutencaoEmptyState
        titulo="Nenhuma manutenção agendada"
        mensagem="Não há agendamentos para este equipamento."
        icone={<Calendar />}
        className={className}
      />
    );
  }

  return (
    <div className={'flex flex-col gap-5 ' + className}>
      {(Object.keys(TITULO_GRUPO) as Grupo[]).map((g) => {
        const itens = grupos[g];
        if (itens.length === 0) return null;
        return (
          <section key={g}>
            <h4
              className="text-xs font-semibold uppercase tracking-wide mb-2 text-[var(--color-fg-muted)]"
            >
              {TITULO_GRUPO[g]}
              <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">
                ({itens.length})
              </span>
            </h4>
            <ul className="flex flex-col gap-1.5">
              {itens.map((a) => {
                const tarefa = tarefaPorId.get(a.tarefaId);
                const isInteractive = !!onItemClick;
                return (
                  <li key={a.id}>
                    <div
                      role={isInteractive ? 'button' : undefined}
                      tabIndex={isInteractive ? 0 : undefined}
                      onClick={isInteractive ? () => onItemClick?.(a.id) : undefined}
                      onKeyDown={
                        isInteractive
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onItemClick?.(a.id);
                              }
                            }
                          : undefined
                      }
                      className={
                        'flex items-center gap-3 px-3 py-2 rounded-lg ' +
                        'bg-[var(--color-surface-1)] border border-[var(--color-border)] ' +
                        (isInteractive
                          ? 'cursor-pointer hover:bg-[var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
                          : '')
                      }
                    >
                      {iconeStatus(a.status)}
                      <span className="text-xs font-mono text-[var(--color-fg-muted)] w-24 shrink-0">
                        {a.dataPrevista}
                      </span>
                      <span className="text-sm text-[var(--color-fg)] flex-1 min-w-0 truncate">
                        {tarefa?.titulo ?? a.tarefaId}
                      </span>
                      {tarefa && <PrioridadeBadge prioridade={tarefa.prioridade} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default AgendaList;
