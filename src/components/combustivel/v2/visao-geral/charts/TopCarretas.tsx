// G3 (variante mode='carretas') — Top placas por consumo.
// Cada barra representa uma placa; subline mostra a transportadora.
// Click → toggle no filtro de placas. Ranking pode ser por litros ou R$.

import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Fornecedor, SaidaCombustivel } from '../../../../../types';
import ChartCard from '../../shared/ChartCard';
import EmptyState from '../../shared/EmptyState';
import ChartTooltip from '../../shared/ChartTooltip';
import { fmtBRL, fmtBRLCompact, fmtL, fmtLCompact } from '../../shared/formatters';
import { AXIS_STYLE } from '../../shared/chartTheme';
import { niceMax } from '../../shared/stats';
import { useCombustivelFilter } from '../../filters/FilterContext';

type Metrica = 'litros' | 'custo';

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
  transportadoras: Fornecedor[];
  topN?: number;
}

interface BarRow {
  /** Placa serve como id (texto livre, distinct dentro do período). */
  id: string;
  placa: string;
  transportadoraNome: string;
  litros: number;
  custo: number;
  qtd: number;
}

export default function TopCarretas({ saidasNoPeriodo, transportadoras, topN = 10 }: Props) {
  const { state, togglePlaca, hovered, setHovered } = useCombustivelFilter();
  const [metrica, setMetrica] = useState<Metrica>('litros');

  const transpMap = useMemo(
    () => new Map(transportadoras.map((t) => [t.id, t.nome])),
    [transportadoras],
  );

  const { rows, max } = useMemo(() => {
    const acc = new Map<string, BarRow>();
    for (const s of saidasNoPeriodo) {
      const placa = (s.placa || '').trim();
      if (!placa) continue;
      const cur = acc.get(placa) ?? {
        id: placa,
        placa,
        transportadoraNome: s.transportadoraId ? transpMap.get(s.transportadoraId) ?? '—' : '—',
        litros: 0,
        custo: 0,
        qtd: 0,
      };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      cur.qtd += 1;
      acc.set(placa, cur);
    }
    const list = Array.from(acc.values());
    list.sort((a, b) => (metrica === 'litros' ? b.litros - a.litros : b.custo - a.custo));
    const top = list.slice(0, topN);
    const m = top.reduce((max, r) => Math.max(max, r[metrica]), 0);
    return { rows: top, max: m };
  }, [saidasNoPeriodo, transpMap, metrica, topN]);

  const empty = rows.length === 0;
  // <3 itens → renderiza como lista (idêntico ao TopEquipamentos).
  const useList = rows.length > 0 && rows.length < 3;
  const chartHeight = useList
    ? Math.max(140, rows.length * 60 + 16)
    : Math.max(180, rows.length * 36);

  return (
    <ChartCard
      title="Top carretas"
      subtitle="Placas com maior consumo no período"
      height={chartHeight + 32}
      actions={
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-[11px]">
          {(['litros', 'custo'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetrica(m)}
              className={`px-2.5 py-1 transition-colors ${
                metrica === m
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold'
                  : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {m === 'litros' ? 'Litros' : 'R$'}
            </button>
          ))}
        </div>
      }
    >
      {empty ? (
        <EmptyState description="Nenhuma carreta abasteceu no período." />
      ) : useList ? (
        <ul className="px-3 py-2 space-y-2 h-full overflow-y-auto">
          {rows.map((r, i) => {
            const valor = r[metrica];
            const pct = max > 0 ? (valor / max) * 100 : 0;
            const isFiltered = state.placas.includes(r.placa);
            return (
              <li
                key={r.placa}
                onMouseEnter={() => setHovered({ type: 'placa', value: r.placa })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => togglePlaca(r.placa)}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isFiltered ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] text-[11px] font-semibold flex items-center justify-center text-[var(--color-fg-muted)] shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-semibold text-[var(--color-fg)] truncate">{r.placa}</div>
                  <div className="text-[11px] text-[var(--color-fg-muted)] truncate">{r.transportadoraNome}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-accent)] transition-all"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right text-sm font-mono tabular-nums text-[var(--color-fg)] shrink-0">
                  {metrica === 'litros' ? fmtL(r.litros) : fmtBRL(r.custo)}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
          >
            <XAxis
              type="number"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (metrica === 'litros' ? fmtLCompact(v) : fmtBRLCompact(v))}
              domain={[0, niceMax(max)]}
            />
            <YAxis
              type="category"
              dataKey="placa"
              tick={{ ...AXIS_STYLE, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={100}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const r = payload[0]!.payload as BarRow;
                return (
                  <ChartTooltip
                    title={`${r.placa} · ${r.transportadoraNome}`}
                    lines={[
                      { label: 'Volume', value: fmtL(r.litros), color: 'var(--color-accent)' },
                      { label: 'Custo', value: fmtBRL(r.custo) },
                      { label: 'Abastecimentos', value: r.qtd },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey={metrica}
              radius={[0, 6, 6, 0]}
              animationDuration={300}
              onClick={(d) => {
                const placa = (d as { payload: BarRow }).payload.placa;
                if (placa) togglePlaca(placa);
              }}
              onMouseEnter={(d) => setHovered({ type: 'placa', value: (d as { payload: BarRow }).payload.placa })}
              onMouseLeave={() => setHovered(null)}
            >
              {rows.map((r) => {
                const isFiltered = state.placas.includes(r.placa);
                const dim =
                  hovered && hovered.type === 'placa' && hovered.value !== r.placa
                    ? 0.4
                    : state.placas.length > 0 && !isFiltered
                      ? 0.4
                      : 1;
                return (
                  <Cell
                    key={r.placa}
                    fill={isFiltered ? 'var(--color-accent-hover)' : 'var(--color-accent)'}
                    fillOpacity={dim}
                    cursor="pointer"
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
