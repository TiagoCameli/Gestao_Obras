// Wrapper consistente pros gráficos: border + radius + padding + título.
// Permite ações no canto superior direito (toggles, export local, etc).

import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Altura do conteúdo do gráfico (área de plotagem). */
  height?: number | string;
  className?: string;
}

export default function ChartCard({
  title,
  subtitle,
  actions,
  children,
  height = 280,
  className = '',
}: Props) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xs)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      <div className="px-2 pb-3" style={{ height }}>
        {children}
      </div>
    </div>
  );
}
