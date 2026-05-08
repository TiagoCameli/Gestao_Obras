// Tooltip custom unificado pros gráficos Recharts. Visual idêntico em
// todos os charts pra dar coerência. Aceita label + array de linhas.

import type { ReactNode } from 'react';

export interface TooltipLine {
  label: string;
  value: ReactNode;
  color?: string;
}

interface Props {
  title?: ReactNode;
  lines: TooltipLine[];
  footer?: ReactNode;
}

export default function ChartTooltip({ title, lines, footer }: Props) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-md)] py-2 px-2.5 min-w-[160px] max-w-[280px]">
      {title && (
        <div className="text-[11px] font-semibold text-[var(--color-fg)] mb-1.5">{title}</div>
      )}
      <div className="space-y-1">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)] truncate">
              {l.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: l.color }}
                />
              )}
              <span className="truncate">{l.label}</span>
            </span>
            <span className="font-mono font-semibold text-[var(--color-fg)] tabular-nums shrink-0">
              {l.value}
            </span>
          </div>
        ))}
      </div>
      {footer && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-fg-subtle)]">
          {footer}
        </div>
      )}
    </div>
  );
}
