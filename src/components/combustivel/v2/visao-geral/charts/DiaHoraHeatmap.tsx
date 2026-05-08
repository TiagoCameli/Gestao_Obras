// G6 — Heatmap dia da semana × hora. Útil pra ver padrões de operação
// (turnos noturnos, fins de semana). Renderizado em SVG puro porque
// Recharts não tem heatmap built-in e é simples de fazer à mão.

import { useMemo } from 'react';
import ChartCard from '../../shared/ChartCard';
import EmptyState from '../../shared/EmptyState';
import type { SaidaCombustivel } from '../../../../../types';

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
}

const DOW_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function DiaHoraHeatmap({ saidasNoPeriodo }: Props) {
  const { matrix, max } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let mx = 0;
    for (const s of saidasNoPeriodo) {
      const d = new Date(s.data);
      if (isNaN(d.getTime())) continue;
      const dow = d.getDay();
      const hour = d.getHours();
      m[dow]![hour]! += 1;
      if (m[dow]![hour]! > mx) mx = m[dow]![hour]!;
    }
    return { matrix: m, max: mx };
  }, [saidasNoPeriodo]);

  const empty = max === 0;

  return (
    <ChartCard title="Padrão semanal" subtitle="Saídas por dia da semana × hora" height={300}>
      {empty ? (
        <EmptyState />
      ) : (
        <div className="h-full w-full overflow-x-auto">
          <table className="w-full text-[10px] border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th aria-label="" className="w-10" />
                {Array.from({ length: 24 }).map((_, h) => (
                  <th
                    key={h}
                    className="text-[var(--color-fg-subtle)] font-normal pb-1 text-center"
                    style={{ minWidth: 12 }}
                  >
                    {h % 3 === 0 ? h : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                <tr key={dow}>
                  <td className="pr-2 text-right text-[var(--color-fg-muted)]">{DOW_LABEL[dow]}</td>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const count = matrix[dow]![h]!;
                    const intensity = max > 0 ? count / max : 0;
                    let bg = 'var(--color-surface-2)';
                    if (count > 0) {
                      const alpha = 0.18 + intensity * 0.82;
                      bg = `color-mix(in srgb, var(--color-accent) ${Math.round(alpha * 100)}%, var(--color-surface-1))`;
                    }
                    return (
                      <td
                        key={h}
                        title={`${DOW_LABEL[dow]} ${String(h).padStart(2, '0')}:00 — ${count} saída${count !== 1 ? 's' : ''}`}
                        className="rounded-[3px] cursor-default"
                        style={{
                          background: bg,
                          height: 18,
                          minWidth: 12,
                        }}
                        aria-label={`${DOW_LABEL[dow]} ${h}h: ${count} saídas`}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex items-center justify-end gap-2 px-2 text-[10px] text-[var(--color-fg-muted)]">
            <span>Menos</span>
            <span className="flex gap-0.5">
              {[0.2, 0.4, 0.6, 0.8, 1].map((a) => (
                <span
                  key={a}
                  className="w-3 h-3 rounded-[3px]"
                  style={{
                    background: `color-mix(in srgb, var(--color-accent) ${Math.round(a * 100)}%, var(--color-surface-1))`,
                  }}
                />
              ))}
            </span>
            <span>Mais</span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
