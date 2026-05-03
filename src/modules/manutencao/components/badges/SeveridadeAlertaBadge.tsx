import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { SEVERIDADE_LABELS, type AlertaSeveridade } from '../../types';

export interface SeveridadeAlertaBadgeProps {
  severidade: AlertaSeveridade;
  className?: string;
}

const ESTILO: Record<AlertaSeveridade, { bg: string; fg: string }> = {
  info: { bg: 'var(--color-info-soft)', fg: 'var(--color-info-fg)' },
  warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning-fg)' },
  critical: { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger-fg)' },
};

export function SeveridadeAlertaBadge({ severidade, className = '' }: SeveridadeAlertaBadgeProps) {
  const e = ESTILO[severidade];
  const Icone =
    severidade === 'critical' ? AlertOctagon : severidade === 'warning' ? AlertTriangle : Info;

  return (
    <span
      className={
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full ' +
        'text-[12px] font-medium leading-tight border ' +
        className
      }
      style={{ backgroundColor: e.bg, color: e.fg, borderColor: 'var(--color-border)' }}
      aria-label={SEVERIDADE_LABELS[severidade]}
    >
      <Icone aria-hidden className="w-3 h-3" />
      {SEVERIDADE_LABELS[severidade]}
    </span>
  );
}

export default SeveridadeAlertaBadge;
