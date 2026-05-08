// G4 — Custo por obra. Treemap quando ≥4 obras (área proporcional ao
// custo); barras empilhadas quando ≤3 (treemap fica feio com 1-2 itens).
// Click adiciona obra ao filtro global.

import { useMemo } from 'react';
import { ResponsiveContainer, Treemap } from 'recharts';
import type { Obra, SaidaCombustivel } from '../../../../../types';
import ChartCard from '../../shared/ChartCard';
import EmptyState from '../../shared/EmptyState';
import { fmtBRL, fmtBRLCompact, fmtL, fmtNumDec } from '../../shared/formatters';
import { useCombustivelFilter } from '../../filters/FilterContext';

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
  obras: Obra[];
}

interface ObraAgg {
  id: string;
  name: string;
  litros: number;
  size: number;        // pra Treemap = custo
  custo: number;
  pct: number;
  cor: string;
  // Index signature exigida pelo TreemapDataType do Recharts.
  [k: string]: string | number;
}

// Gradiente verde — escala perceptual simples baseada em rank
function corPorRank(rank: number, total: number): string {
  const ratio = total <= 1 ? 0 : rank / Math.max(total - 1, 1);
  // L: 35% (escuro) → 75% (claro)
  const l = 35 + ratio * 40;
  return `hsl(146 35% ${l}%)`;
}

export default function CustoPorObra({ saidasNoPeriodo, obras }: Props) {
  const { state, toggleObra, hovered, setHovered } = useCombustivelFilter();
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const rows = useMemo(() => {
    const acc = new Map<string, { litros: number; custo: number }>();
    let total = 0;
    for (const s of saidasNoPeriodo) {
      const id = s.obraId ?? '_sem';
      const cur = acc.get(id) ?? { litros: 0, custo: 0 };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      acc.set(id, cur);
      total += s.valorTotal;
    }
    const arr: ObraAgg[] = Array.from(acc.entries())
      .sort((a, b) => b[1].custo - a[1].custo)
      .map(([id, v], i, all) => ({
        id,
        name: id === '_sem' ? 'Sem obra' : obrasMap.get(id) ?? id,
        litros: v.litros,
        size: Math.max(v.custo, 0.01), // treemap não aceita 0
        custo: v.custo,
        pct: total > 0 ? (v.custo / total) * 100 : 0,
        cor: corPorRank(i, all.length),
      }));
    return arr;
  }, [saidasNoPeriodo, obrasMap]);

  const empty = rows.length === 0;
  const usarTreemap = rows.length >= 4;
  const single = rows.length === 1;

  return (
    <ChartCard title="Custo por obra" subtitle="Distribuição do custo no período" height={300}>
      {empty ? (
        <EmptyState />
      ) : single ? (
        // Barra de 100% única é visualmente inútil. Texto resumo é mais legível.
        <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] font-semibold">
            Única obra no período
          </div>
          <div className="text-base font-semibold text-[var(--color-fg)] max-w-full truncate">{rows[0]!.name}</div>
          <div className="text-sm font-mono tabular-nums text-[var(--color-fg-muted)]">
            {fmtBRL(rows[0]!.custo)} · {fmtL(rows[0]!.litros)}
          </div>
        </div>
      ) : usarTreemap ? (
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={rows}
            dataKey="size"
            stroke="var(--color-surface-1)"
            fill="var(--color-accent)"
            isAnimationActive
            animationDuration={400}
            content={
              <TreemapNode
                state={state}
                hovered={hovered}
                onClick={(id) => id !== '_sem' && toggleObra(id)}
                onHover={(id) => setHovered(id ? { type: 'obra', value: id } : null)}
              />
            }
          />
        </ResponsiveContainer>
      ) : (
        // Fallback ≤3 obras: barras empilhadas horizontais simples (proporção)
        <div className="flex flex-col gap-2 px-2 py-3 h-full justify-center">
          {rows.map((r) => {
            const isFiltered = state.obraIds.includes(r.id);
            const dim =
              hovered && hovered.type === 'obra' && hovered.value !== r.id
                ? 0.45
                : state.obraIds.length > 0 && !isFiltered
                  ? 0.45
                  : 1;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => r.id !== '_sem' && toggleObra(r.id)}
                onMouseEnter={() => setHovered({ type: 'obra', value: r.id })}
                onMouseLeave={() => setHovered(null)}
                className="text-left group"
                style={{ opacity: dim }}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--color-fg)] font-medium truncate">{r.name}</span>
                  <span className="text-[var(--color-fg-muted)] tabular-nums">
                    {fmtBRL(r.custo)} <span className="opacity-60">· {fmtNumDec(r.pct, 1)}%</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.max(r.pct, 1.5)}%`, background: r.cor }}
                  />
                </div>
                <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">{fmtL(r.litros)}</div>
              </button>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

interface TreemapNodeProps {
  // Recharts injeta props sem tipar — declarei só o que uso.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ObraAgg;
  state: { obraIds: string[] };
  hovered: { type: string; value: string } | null;
  onClick: (id: string) => void;
  onHover: (id: string | null) => void;
}

function TreemapNode(props: TreemapNodeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload, state, hovered, onClick, onHover } = props;
  if (!payload || width <= 0 || height <= 0) return null;

  const isFiltered = state.obraIds.includes(payload.id);
  let opacity = 1;
  if (hovered && hovered.type === 'obra' && hovered.value !== payload.id) opacity = 0.4;
  else if (state.obraIds.length > 0 && !isFiltered) opacity = 0.45;

  const showLabel = width > 70 && height > 32;
  const showValue = width > 90 && height > 50;

  return (
    <g
      onClick={() => onClick(payload.id)}
      onMouseEnter={() => onHover(payload.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.cor}
        fillOpacity={opacity}
        stroke="var(--color-surface-1)"
        strokeWidth={2}
      />
      {showLabel && (
        <text
          x={x + 8}
          y={y + 16}
          fill="white"
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {payload.name.length > Math.floor(width / 6)
            ? payload.name.slice(0, Math.floor(width / 6) - 1) + '…'
            : payload.name}
        </text>
      )}
      {showValue && (
        <text x={x + 8} y={y + 32} fill="white" fontSize={10} fillOpacity={0.85} style={{ pointerEvents: 'none' }}>
          {fmtBRLCompact(payload.custo)} · {fmtNumDec(payload.pct, 1)}%
        </text>
      )}
    </g>
  );
}
