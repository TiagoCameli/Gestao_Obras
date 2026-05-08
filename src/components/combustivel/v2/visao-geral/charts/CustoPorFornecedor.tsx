// G5 — R$/L por fornecedor (de ENTRADAS, não saídas).
// Brief original era "postos"; convertido pra fornecedor de combustível
// porque saídas saem do tanque interno e não têm posto.
// Linha de referência = média ponderada do período. Barras acima da
// média ficam vermelhas; abaixo, verdes.
// Click toggla fornecedor no filtro global.

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EntradaCombustivel } from '../../../../../types';
import ChartCard from '../../shared/ChartCard';
import EmptyState from '../../shared/EmptyState';
import ChartTooltip from '../../shared/ChartTooltip';
import { fmtBRL, fmtL, fmtNumDec } from '../../shared/formatters';
import { AXIS_STYLE } from '../../shared/chartTheme';
import { useCombustivelFilter } from '../../filters/FilterContext';

interface Props {
  entradasNoPeriodo: EntradaCombustivel[];
}

interface FornAgg {
  nome: string;
  litros: number;
  custo: number;
  rPorL: number;
  qtd: number;
}

export default function CustoPorFornecedor({ entradasNoPeriodo }: Props) {
  const { state, toggleFornecedor, hovered, setHovered } = useCombustivelFilter();

  const { rows, mediaRpL } = useMemo(() => {
    const acc = new Map<string, FornAgg>();
    let totalL = 0;
    let totalR = 0;
    for (const e of entradasNoPeriodo) {
      const nome = (e.fornecedor || '').trim();
      if (!nome) continue;
      const cur = acc.get(nome) ?? { nome, litros: 0, custo: 0, rPorL: 0, qtd: 0 };
      cur.litros += e.quantidadeLitros;
      cur.custo += e.valorTotal;
      cur.qtd += 1;
      acc.set(nome, cur);
      totalL += e.quantidadeLitros;
      totalR += e.valorTotal;
    }
    const arr = Array.from(acc.values()).map((f) => ({
      ...f,
      rPorL: f.litros > 0 ? f.custo / f.litros : 0,
    }));
    arr.sort((a, b) => a.rPorL - b.rPorL);
    return { rows: arr, mediaRpL: totalL > 0 ? totalR / totalL : 0 };
  }, [entradasNoPeriodo]);

  const empty = rows.length === 0;

  return (
    <ChartCard title="R$/L por fornecedor" subtitle="Compras de combustível no período" height={300}>
      {empty ? (
        <EmptyState description="Nenhuma entrada de combustível no período." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="nome"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `R$ ${fmtNumDec(v, 2)}`}
              width={56}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const r = payload[0]!.payload as FornAgg;
                const acima = r.rPorL > mediaRpL;
                return (
                  <ChartTooltip
                    title={r.nome}
                    lines={[
                      { label: 'R$/L médio', value: `R$ ${fmtNumDec(r.rPorL, 4)}` },
                      { label: 'Volume', value: fmtL(r.litros) },
                      { label: 'Total', value: fmtBRL(r.custo) },
                      { label: 'Compras', value: r.qtd },
                    ]}
                    footer={
                      mediaRpL > 0
                        ? acima
                          ? `Acima da média geral (R$ ${fmtNumDec(mediaRpL, 4)}/L)`
                          : `Abaixo da média geral (R$ ${fmtNumDec(mediaRpL, 4)}/L)`
                        : undefined
                    }
                  />
                );
              }}
            />
            {mediaRpL > 0 && (
              <ReferenceLine
                y={mediaRpL}
                stroke="var(--color-fg-subtle)"
                strokeDasharray="4 4"
                label={{
                  position: 'right',
                  value: `Média R$ ${fmtNumDec(mediaRpL, 4)}`,
                  fill: 'var(--color-fg-muted)',
                  fontSize: 10,
                }}
              />
            )}
            <Bar
              dataKey="rPorL"
              radius={[6, 6, 0, 0]}
              animationDuration={300}
              onClick={(d) => {
                const nome = (d as { payload: FornAgg }).payload.nome;
                if (nome) toggleFornecedor(nome);
              }}
              onMouseEnter={(d) => setHovered({ type: 'fornecedor', value: (d as { payload: FornAgg }).payload.nome })}
              onMouseLeave={() => setHovered(null)}
            >
              {rows.map((r) => {
                const isFiltered = state.fornecedores.includes(r.nome);
                const acima = mediaRpL > 0 && r.rPorL > mediaRpL;
                const base = acima ? '#DC2626' : 'var(--color-accent)';
                const dim =
                  hovered && hovered.type === 'fornecedor' && hovered.value !== r.nome
                    ? 0.4
                    : state.fornecedores.length > 0 && !isFiltered
                      ? 0.4
                      : 1;
                return <Cell key={r.nome} fill={base} fillOpacity={dim} cursor="pointer" />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
