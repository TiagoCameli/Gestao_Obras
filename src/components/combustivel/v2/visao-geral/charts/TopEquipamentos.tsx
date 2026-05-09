// G3 — Top equipamentos por consumo. Barras horizontais ranqueadas.
// Click numa barra normal → toggla equipamentoIds (cross-filter).
// Click na barra "Não identificado" (sentinel) → onAtribuirSentinels
// (mesma ação do banner: liga apenasSentinel + nav pra Saídas).

import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import type { Equipamento, SaidaCombustivel } from '../../../../../types';
import ChartCard from '../../shared/ChartCard';
import EmptyState from '../../shared/EmptyState';
import ChartTooltip from '../../shared/ChartTooltip';
import { fmtBRL, fmtBRLCompact, fmtL, fmtLCompact } from '../../shared/formatters';
import { AXIS_STYLE } from '../../shared/chartTheme';
import { niceMax } from '../../shared/stats';
import { useCombustivelFilter } from '../../filters/FilterContext';

type Metrica = 'litros' | 'custo';
const SENTINEL_ID = '_naoid';
const SENTINEL_COR = '#d97706';      // amber-600
const SENTINEL_COR_FILTRADO = '#b45309'; // amber-700

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
  equipamentos: Equipamento[];
  topN?: number;
  /** Quando o usuário clicar na barra/linha de sentinel — liga
   *  apenasSentinel + nav pra Saídas. Opcional: se ausente, sentinel
   *  fica visualmente presente mas click é no-op. */
  onAtribuirSentinels?: () => void;
  /** Desliga animação Recharts (usado pela captura PDF F4.A.2 — captura
   *  precisa do estado final imediato). */
  disableAnimation?: boolean;
}

interface BarRow {
  id: string;
  nome: string;
  codigo: string;
  litros: number;
  custo: number;
  isSentinel: boolean;
  qtdSaidas: number;
}

export default function TopEquipamentos({ saidasNoPeriodo, equipamentos, topN = 10, onAtribuirSentinels, disableAnimation = false }: Props) {
  const { state, toggleEquipamento, hovered, setHovered } = useCombustivelFilter();
  const [metrica, setMetrica] = useState<Metrica>('litros');

  const { rows, max } = useMemo(() => {
    const acc = new Map<string, { litros: number; custo: number; qtd: number }>();
    for (const s of saidasNoPeriodo) {
      const id = s.equipamentoId === 'desconhecido' ? SENTINEL_ID : s.equipamentoId;
      if (!id) continue;
      const cur = acc.get(id) ?? { litros: 0, custo: 0, qtd: 0 };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      cur.qtd += 1;
      acc.set(id, cur);
    }
    const eqMap = new Map(equipamentos.map((e) => [e.id, e]));
    const list: BarRow[] = Array.from(acc.entries()).map(([id, v]) => {
      if (id === SENTINEL_ID) {
        return {
          id,
          nome: 'Não identificado',
          codigo: `${v.qtd} saída${v.qtd !== 1 ? 's' : ''} sem ID`,
          litros: v.litros,
          custo: v.custo,
          isSentinel: true,
          qtdSaidas: v.qtd,
        };
      }
      const eq = eqMap.get(id);
      return {
        id,
        nome: eq?.nome ?? 'Desconhecido',
        codigo: eq?.codigoPatrimonio || eq?.tipo || '',
        litros: v.litros,
        custo: v.custo,
        isSentinel: false,
        qtdSaidas: v.qtd,
      };
    });
    list.sort((a, b) => (metrica === 'litros' ? b.litros - a.litros : b.custo - a.custo));
    const top = list.slice(0, topN);
    const m = top.reduce((max, r) => Math.max(max, r[metrica]), 0);
    return { rows: top, max: m };
  }, [saidasNoPeriodo, equipamentos, metrica, topN]);

  const empty = rows.length === 0;
  const useList = rows.length > 0 && rows.length < 3;
  const chartHeight = useList
    ? Math.max(140, rows.length * 56 + 16)
    : Math.max(180, rows.length * 30);

  function handleRowClick(r: BarRow) {
    if (r.isSentinel) {
      if (onAtribuirSentinels) onAtribuirSentinels();
      return;
    }
    toggleEquipamento(r.id);
  }

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
            const isFiltered = !r.isSentinel && state.equipamentoIds.includes(r.id);
            const sentinelBg = r.isSentinel
              ? 'bg-[repeating-linear-gradient(45deg,var(--color-surface-2),var(--color-surface-2)_4px,var(--color-surface-1)_4px,var(--color-surface-1)_8px)]'
              : '';
            return (
              <li
                key={r.id}
                onMouseEnter={() => !r.isSentinel && setHovered({ type: 'equipamento', value: r.id })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleRowClick(r)}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isFiltered ? 'bg-[var(--color-accent-soft)]' : `${sentinelBg} hover:bg-[var(--color-surface-2)]`
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] text-[11px] font-semibold flex items-center justify-center text-[var(--color-fg-muted)] shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${
                    r.isSentinel ? 'text-amber-700 dark:text-amber-400 inline-flex items-center gap-1.5' : 'text-[var(--color-fg)]'
                  }`}>
                    {r.isSentinel && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                    {r.nome}
                  </div>
                  {r.codigo && (
                    <div className="text-[10px] font-mono text-[var(--color-fg-subtle)] truncate">{r.codigo}</div>
                  )}
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className={`h-full transition-all ${r.isSentinel ? 'bg-amber-500/70' : 'bg-[var(--color-accent)]'}`}
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
                      { label: 'Volume', value: fmtL(r.litros), color: r.isSentinel ? SENTINEL_COR : 'var(--color-accent)' },
                      { label: 'Custo', value: fmtBRL(r.custo) },
                      ...(r.codigo ? [{ label: r.isSentinel ? 'Saídas' : 'Código', value: r.codigo }] : []),
                      ...(r.isSentinel ? [{ label: '', value: 'Click → atribuir retroativamente' }] : []),
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey={metrica}
              radius={[0, 6, 6, 0]}
              animationDuration={disableAnimation ? 0 : 300}
              isAnimationActive={!disableAnimation}
              onClick={(d) => handleRowClick((d as { payload: BarRow }).payload)}
              onMouseEnter={(d) => {
                const r = (d as { payload: BarRow }).payload;
                if (!r.isSentinel) setHovered({ type: 'equipamento', value: r.id });
              }}
              onMouseLeave={() => setHovered(null)}
            >
              {rows.map((r) => {
                const isFiltered = !r.isSentinel && state.equipamentoIds.includes(r.id);
                const dim =
                  !r.isSentinel && hovered && hovered.type === 'equipamento' && hovered.value !== r.id
                    ? 0.4
                    : !r.isSentinel && state.equipamentoIds.length > 0 && !isFiltered
                      ? 0.4
                      : 1;
                const fill = r.isSentinel
                  ? SENTINEL_COR
                  : isFiltered
                    ? 'var(--color-accent-hover)'
                    : 'var(--color-accent)';
                return (
                  <Cell
                    key={r.id}
                    fill={fill}
                    fillOpacity={dim}
                    cursor="pointer"
                    stroke={r.isSentinel ? SENTINEL_COR_FILTRADO : undefined}
                    strokeWidth={r.isSentinel ? 1 : 0}
                    strokeDasharray={r.isSentinel ? '3 2' : undefined}
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
