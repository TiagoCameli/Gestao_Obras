export type StatusManutencao =
  | 'em_dia'
  | 'atencao'
  | 'atrasada'
  | 'em_manutencao'
  | 'sem_dados';

export interface StatusManutencaoBadgeProps {
  status: StatusManutencao;
  className?: string;
}

const LABEL: Record<StatusManutencao, string> = {
  em_dia: 'Em dia',
  atencao: 'Atenção',
  atrasada: 'Atrasada',
  em_manutencao: 'Em manutenção',
  sem_dados: 'Sem dados',
};

const ESTILO: Record<StatusManutencao, { bg: string; fg: string }> = {
  em_dia: { bg: 'var(--color-success-soft)', fg: 'var(--color-success-fg)' },
  atencao: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning-fg)' },
  atrasada: { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger-fg)' },
  em_manutencao: { bg: 'var(--color-info-soft)', fg: 'var(--color-info-fg)' },
  sem_dados: { bg: 'var(--color-surface-2)', fg: 'var(--color-fg-muted)' },
};

export function StatusManutencaoBadge({ status, className = '' }: StatusManutencaoBadgeProps) {
  const e = ESTILO[status];
  return (
    <span
      className={
        'inline-flex items-center px-2 py-0.5 rounded-full ' +
        'text-[12px] font-medium leading-tight border ' +
        className
      }
      style={{ backgroundColor: e.bg, color: e.fg, borderColor: 'var(--color-border)' }}
    >
      {LABEL[status]}
    </span>
  );
}

export default StatusManutencaoBadge;
