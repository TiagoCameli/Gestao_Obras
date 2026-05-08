// G2 — Mix de combustível: donut com legenda detalhada à direita.
// Click num slice toggla o tipo de combustível no filtro global.

import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Insumo, SaidaCombustivel } from '../../../../../types';
import ChartCard from '../../shared/ChartCard';
import EmptyState from '../../shared/EmptyState';
import ChartTooltip from '../../shared/ChartTooltip';
import { fmtBRL, fmtL, fmtNumDec } from '../../shared/formatters';
import { corCombustivel } from '../../shared/chartTheme';
import { useCombustivelFilter } from '../../filters/FilterContext';

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
  combustiveis: Insumo[];
}

interface Slice {
  id: string;
  nome: string;
  litros: number;
  custo: number;
  cor: string;
  pct: number;
}

export default function MixCombustivel({ saidasNoPeriodo, combustiveis }: Props) {
  const { state, toggleTipoCombustivel, hovered, setHovered } = useCombustivelFilter();
  const insumosMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);

  const { slices, totalLitros } = useMemo(() => {
    const acc = new Map<string, { litros: number; custo: number }>();
    for (const s of saidasNoPeriodo) {
      const id = s.tipoCombustivel || '_outros';
      const cur = acc.get(id) ?? { litros: 0, custo: 0 };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      acc.set(id, cur);
    }
    const total = Array.from(acc.values()).reduce((s, v) => s + v.litros, 0);
    const arr: Slice[] = Array.from(acc.entries())
      .map(([id, v], i) => {
        const nome = id === '_outros' ? 'Outros' : insumosMap.get(id) ?? 'Outros';
        return {
          id,
          nome,
          litros: v.litros,
          custo: v.custo,
          cor: corCombustivel(nome, i),
          pct: total > 0 ? (v.litros / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.litros - a.litros);
    return { slices: arr, totalLitros: total };
  }, [saidasNoPeriodo, insumosMap]);

  const empty = saidasNoPeriodo.length === 0;
  const single = slices.length === 1;

  return (
    <ChartCard title="Mix de combustível" subtitle="Volume por tipo" height={300}>
      {empty ? (
        <EmptyState />
      ) : single ? (
        // Donut com 1 fatia é visualmente inútil. Card simples é melhor leitura.
        <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="w-12 h-12 rounded-full" style={{ background: slices[0]!.cor }} aria-hidden />
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] font-semibold">
            Único combustível usado
          </div>
          <div className="text-base font-semibold text-[var(--color-fg)]">{slices[0]!.nome}</div>
          <div className="text-sm font-mono tabular-nums text-[var(--color-fg-muted)]">
            {fmtL(slices[0]!.litros)} · {fmtBRL(slices[0]!.custo)}
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center gap-4 px-2">
          <div className="relative w-[180px] h-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="litros"
                  nameKey="nome"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="none"
                  animationDuration={400}
                  onMouseEnter={(_, i) => setHovered({ type: 'tipo', value: slices[i]!.id })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(_, i) => {
                    const s = slices[i];
                    if (s && s.id !== '_outros') toggleTipoCombustivel(s.id);
                  }}
                >
                  {slices.map((s) => {
                    const dim =
                      hovered && hovered.type === 'tipo' && hovered.value !== s.id
                        ? 0.3
                        : state.tipoCombustiveis.length > 0 && !state.tipoCombustiveis.includes(s.id)
                          ? 0.4
                          : 1;
                    return (
                      <Cell key={s.id} fill={s.cor} fillOpacity={dim} cursor="pointer" />
                    );
                  })}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const s = payload[0]!.payload as Slice;
                    return (
                      <ChartTooltip
                        title={s.nome}
                        lines={[
                          { label: 'Volume', value: fmtL(s.litros), color: s.cor },
                          { label: 'Custo', value: fmtBRL(s.custo) },
                          { label: '% do total', value: `${fmtNumDec(s.pct, 1)}%` },
                        ]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Total</div>
              <div className="text-lg font-bold text-[var(--color-fg)] tabular-nums">{fmtL(totalLitros)}</div>
            </div>
          </div>

          <ul className="flex-1 min-w-0 space-y-1.5 overflow-y-auto max-h-full pr-1">
            {slices.map((s) => {
              const isFiltered = state.tipoCombustiveis.includes(s.id);
              return (
                <li
                  key={s.id}
                  className={`flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded-md cursor-pointer transition-colors ${
                    isFiltered ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-surface-2)]'
                  }`}
                  onMouseEnter={() => setHovered({ type: 'tipo', value: s.id })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => s.id !== '_outros' && toggleTipoCombustivel(s.id)}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.cor }} />
                    <span className="truncate text-[var(--color-fg)]">{s.nome}</span>
                  </span>
                  <span className="text-[var(--color-fg-muted)] tabular-nums shrink-0">
                    {fmtNumDec(s.pct, 1)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
