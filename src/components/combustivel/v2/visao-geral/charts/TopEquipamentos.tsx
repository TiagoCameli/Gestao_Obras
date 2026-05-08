// G3 — Top equipamentos por consumo. Barras horizontais ranqueadas.
// Click numa barra adiciona o equipamento ao filtro global.

import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Equipamento, SaidaCombustivel } from '../../../../../types';
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
  equipamentos: Equipamento[];
  topN?: number;
}

interface BarRow {
  id: string;
  nome: string;
  codigo: string;
  litros: number;
  custo: number;
}

export default function TopEquipamentos({ saidasNoPeriodo, equipamentos, topN = 10 }: Props) {
  const { state, toggleEquipamento, hovered, setHovered } = useCombustivelFilter();
  const [metrica, setMetrica] = useState<Metrica>('litros');

  const { rows, max } = useMemo(() => {
    const acc = new Map<string, { litros: number; custo: number }>();
    for (const s of saidasNoPeriodo) {
      if (!s.equipamentoId || s.equipamentoId === 'desconhecido') continue;
      const cur = acc.get(s.equipamentoId) ?? { litros: 0, custo: 0 };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      acc.set(s.equipamentoId, cur);
    }
    const eqMap = new Map(equipamentos.map((e) => [e.id, e]));
    const list: BarRow[] = Array.from(acc.entries()).map(([id, v]) => {
      const eq = eqMap.get(id);
      return {
        id,
        nome: eq?.nome ?? 'Desconhecido',
        codigo: eq?.codigoPatrimonio || eq?.tipo || '',
        litros: v.litros,
        custo: v.custo,
      };
    });
    list.sort((a, b) => (metrica === 'litros' ? b.litros - a.litros : b.custo - a.custo));
    const top = list.slice(0, topN);
    const m = top.reduce((max, r) => Math.max(max, r[metrica]), 0);
    return { rows: top, max: m };
  }, [saidasNoPeriodo, equipamentos, metrica, topN]);

  const empty = rows.length === 0;
  // Quando temos menos de 3 itens, BarChart fica visualmente vazio (eixo
  // gigante, 1-2 barrinhas). Renderiza como lista compacta.
  const useList = rows.length > 0 && rows.length < 3;
  const chartHeight = useList
    ? Math.max(140, rows.length * 56 + 16)
    : Math.max(180, rows.length * 30);

  return (
    <ChartCard
      title="Top equipamentos"
      subtitle="Maiores consumidores no período"
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
        <EmptyState />
      ) : useList ? (
        <ul className="px-3 py-2 space-y-2 h-full overflow-y-auto">
          {rows.map((r, i) => {
            const valor = r[metrica];
            const pct = max > 0 ? (valor / max) * 100 : 0;
            const isFiltered = state.equipamentoIds.includes(r.id);
            return (
              <li
                key={r.id}
                onMouseEnter={() => setHovered({ type: 'equipamento', value: r.id })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => toggleEquipamento(r.id)}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isFiltered ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] text-[11px] font-semibold flex items-center justify-center text-[var(--color-fg-muted)] shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--color-fg)] truncate">{r.nome}</div>
                  {r.codigo && (
                    <div className="text-[10px] font-mono text-[var(--color-fg-subtle)] truncate">{r.codigo}</div>
                  )}
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
              dataKey="nome"
              tick={{ ...AXIS_STYLE, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={140}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const r = payload[0]!.payload as BarRow;
                return (
                  <ChartTooltip
                    title={r.nome}
                    lines={[
                      { label: 'Volume', value: fmtL(r.litros), color: 'var(--color-accent)' },
                      { label: 'Custo', value: fmtBRL(r.custo) },
                      ...(r.codigo ? [{ label: 'Código', value: r.codigo }] : []),
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
                const id = (d as { payload: BarRow }).payload.id;
                if (id) toggleEquipamento(id);
              }}
              onMouseEnter={(d) => setHovered({ type: 'equipamento', value: (d as { payload: BarRow }).payload.id })}
              onMouseLeave={() => setHovered(null)}
            >
              {rows.map((r) => {
                const isFiltered = state.equipamentoIds.includes(r.id);
                const dim =
                  hovered && hovered.type === 'equipamento' && hovered.value !== r.id
                    ? 0.4
                    : state.equipamentoIds.length > 0 && !isFiltered
                      ? 0.4
                      : 1;
                return (
                  <Cell
                    key={r.id}
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
