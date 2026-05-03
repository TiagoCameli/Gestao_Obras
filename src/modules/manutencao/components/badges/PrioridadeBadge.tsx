import {
  PRIORIDADE_LABELS,
  PRIORIDADE_CORES,
  type ManutencaoPrioridade,
} from '../../types';

export interface PrioridadeBadgeProps {
  prioridade: ManutencaoPrioridade;
  className?: string;
}

const FG_PRIORIDADE: Record<ManutencaoPrioridade, string> = {
  critica: 'var(--color-danger-fg)',
  alta: 'var(--color-warning-fg)',
  media: 'var(--color-info-fg)',
  baixa: 'var(--color-fg-muted)',
};

export function PrioridadeBadge({ prioridade, className = '' }: PrioridadeBadgeProps) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full ' +
        'text-[12px] font-medium leading-tight border ' +
        className
      }
      style={{
        backgroundColor: PRIORIDADE_CORES[prioridade],
        color: FG_PRIORIDADE[prioridade],
        borderColor: 'var(--color-border)',
      }}
    >
      {PRIORIDADE_LABELS[prioridade]}
    </span>
  );
}

export default PrioridadeBadge;
