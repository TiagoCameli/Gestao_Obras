// G1 — Evolução temporal: barras de Volume (L) + linha de Custo (R$).
// Granularidade dia/semana/mês definida pelo pai. Click numa barra
// estreita o período do filtro pra esse bucket; cross-highlight via
// hover do FilterContext.

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SaidaCombustivel } from '../../../../../types';
import ChartCard from '../../shared/ChartCard';
import EmptyState from '../../shared/EmptyState';
import ChartTooltip from '../../shared/ChartTooltip';
import { fmtBRL, fmtBRLCompact, fmtL, fmtLCompact, fmtData, fmtMesAno } from '../../shared/formatters';
import { AXIS_STYLE, GRID_STROKE } from '../../shared/chartTheme';
import { useCombustivelFilter } from '../../filters/FilterContext';

export type Granularidade = 'dia' | 'semana' | 'mes';

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
  periodo: { from: string; to: string };
  granularidade: Granularidade;
  onChangeGranularidade: (g: Granularidade) => void;
}

interface Bucket {
  bucketKey: string;       // 2026-04-15 (dia) ou 2026-W16 (semana) ou 2026-04 (mês)
  bucketLabel: string;
  from: string;            // ISO YYYY-MM-DD início inclusive
  to: string;              // ISO YYYY-MM-DD fim inclusive
  litros: number;
  custo: number;
}

function startOfWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay(); // 0 = Dom
  const diff = (dow + 6) % 7; // ISO: semana começa Seg
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeek(iso: string): string {
  const d = new Date(startOfWeek(iso) + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

function endOfMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function bucketize(
  saidas: SaidaCombustivel[],
  periodo: { from: string; to: string },
  g: Granularidade,
): Bucket[] {
  const map = new Map<string, Bucket>();

  // Pré-popula buckets vazios do range
  const start = new Date(periodo.from + 'T00:00:00');
  const end = new Date(periodo.to + 'T00:00:00');
  const cur = new Date(start);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    let key: string, from: string, to: string, label: string;
    if (g === 'dia') {
      key = iso;
      from = iso;
      to = iso;
      label = fmtData(iso).slice(0, 5); // dd/MM
      cur.setDate(cur.getDate() + 1);
    } else if (g === 'semana') {
      from = startOfWeek(iso);
      to = endOfWeek(iso);
      key = from;
      label = `${fmtData(from).slice(0, 5)}–${fmtData(to).slice(0, 5)}`;
      // Pula pra próxima semana
      const next = new Date(to + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      cur.setTime(next.getTime());
    } else {
      from = startOfMonth(iso);
      to = endOfMonth(iso);
      key = iso.slice(0, 7);
      label = fmtMesAno(iso);
      // Pula pro 1º do próximo mês
      const next = new Date(to + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      cur.setTime(next.getTime());
    }
    if (!map.has(key)) {
      map.set(key, { bucketKey: key, bucketLabel: label, from, to, litros: 0, custo: 0 });
    }
  }

  for (const s of saidas) {
    const dia = s.data.slice(0, 10);
    let key: string;
    if (g === 'dia') key = dia;
    else if (g === 'semana') key = startOfWeek(dia);
    else key = dia.slice(0, 7);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.litros += s.litros;
    bucket.custo += s.valorTotal;
  }

  return Array.from(map.values()).sort((a, b) => a.from.localeCompare(b.from));
}

export default function EvolucaoTemporal({
  saidasNoPeriodo,
  periodo,
  granularidade,
  onChangeGranularidade,
}: Props) {
  const { setPeriodoCustom } = useCombustivelFilter();

  const data = useMemo(
    () => bucketize(saidasNoPeriodo, periodo, granularidade),
    [saidasNoPeriodo, periodo, granularidade],
  );

  const empty = saidasNoPeriodo.length === 0;

  return (
    <ChartCard
      title="Evolução temporal"
      subtitle="Volume × Custo por período"
      height={300}
      actions={
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-[11px]">
          {(['dia', 'semana', 'mes'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChangeGranularidade(g)}
              className={`px-2.5 py-1 capitalize transition-colors ${
                granularidade === g
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold'
                  : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {g === 'mes' ? 'Mês' : g === 'dia' ? 'Dia' : 'Semana'}
            </button>
          ))}
        </div>
      }
    >
      {empty ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            onClick={(e) => {
              // Recharts onClick: e.activePayload[0].payload é o bucket
              const payload = (e as { activePayload?: { payload: Bucket }[] })?.activePayload?.[0]?.payload;
              if (payload) setPeriodoCustom(payload.from, payload.to);
            }}
          >
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="bucketLabel" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
            <YAxis
              yAxisId="L"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtLCompact(v)}
              width={60}
            />
            <YAxis
              yAxisId="R$"
              orientation="right"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtBRLCompact(v)}
              width={60}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const b = payload[0]!.payload as Bucket;
                const rPorL = b.litros > 0 ? b.custo / b.litros : 0;
                return (
                  <ChartTooltip
                    title={b.bucketLabel}
                    lines={[
                      { label: 'Volume', value: fmtL(b.litros), color: 'var(--color-accent)' },
                      { label: 'Custo', value: fmtBRL(b.custo), color: '#1A1A1A' },
                      { label: 'R$/L', value: rPorL > 0 ? `R$ ${rPorL.toFixed(4)}` : '—' },
                    ]}
                    footer={`${fmtData(b.from)} – ${fmtData(b.to)}`}
                  />
                );
              }}
            />
            <Legend
              align="right"
              verticalAlign="top"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: 'var(--color-fg-muted)', paddingBottom: 8 }}
            />
            <Bar
              yAxisId="L"
              dataKey="litros"
              name="Volume (L)"
              fill="var(--color-accent)"
              fillOpacity={0.6}
              radius={[4, 4, 0, 0]}
              animationDuration={300}
            />
            <Line
              yAxisId="R$"
              type="monotone"
              dataKey="custo"
              name="Custo (R$)"
              stroke="#1A1A1A"
              strokeWidth={1.75}
              dot={{ r: 2.5, fill: '#1A1A1A' }}
              activeDot={{ r: 4 }}
              animationDuration={300}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
