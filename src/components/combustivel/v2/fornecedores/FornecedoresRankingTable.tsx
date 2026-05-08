// Ranking detalhado de fornecedores com mín/médio/máx R$/L do período
// + sparkline R$/L diário por linha. Click → cross-filter via toggleFornecedor.

import { useMemo } from 'react';
import type { EntradaCombustivel } from '../../../../types';
import { useCombustivelFilter } from '../filters/FilterContext';
import Sparkline from '../shared/Sparkline';
import { fmtBRL, fmtL, fmtNumDec } from '../shared/formatters';
import { bucketByDia } from '../shared/stats';

interface Props {
  entradasNoPeriodo: EntradaCombustivel[];
  periodo: { from: string; to: string };
}

interface RankRow {
  nome: string;
  qtdCompras: number;
  litros: number;
  custo: number;
  rPorLMin: number;
  rPorLMedio: number;
  rPorLMax: number;
  pctTotal: number;
  spark: number[];          // sparkline R$/L diário (zeros filtrados depois)
}

export default function FornecedoresRankingTable({ entradasNoPeriodo, periodo }: Props) {
  const { state, toggleFornecedor } = useCombustivelFilter();

  const rows = useMemo<RankRow[]>(() => {
    const acc = new Map<string, { qtd: number; litros: number; custo: number; entradas: EntradaCombustivel[]; rpls: number[] }>();
    let totalLitros = 0;

    for (const e of entradasNoPeriodo) {
      const nome = (e.fornecedor || '').trim();
      if (!nome) continue;
      const cur = acc.get(nome) ?? { qtd: 0, litros: 0, custo: 0, entradas: [], rpls: [] };
      cur.qtd += 1;
      cur.litros += e.quantidadeLitros;
      cur.custo += e.valorTotal;
      cur.entradas.push(e);
      if (e.quantidadeLitros > 0) {
        cur.rpls.push(e.valorTotal / e.quantidadeLitros);
      }
      acc.set(nome, cur);
      totalLitros += e.quantidadeLitros;
    }

    const list: RankRow[] = [];
    for (const [nome, v] of acc) {
      // Sparkline R$/L diário: bucket litros + custo, R$/L = c/l por bucket.
      const sparkLitros = bucketByDia(v.entradas, (e) => e.dataHora, (e) => e.quantidadeLitros, periodo.from, periodo.to);
      const sparkCusto = bucketByDia(v.entradas, (e) => e.dataHora, (e) => e.valorTotal, periodo.from, periodo.to);
      const sparkRpL = sparkLitros
        .map((b, i) => {
          const c = sparkCusto[i]?.valor ?? 0;
          return b.valor > 0 ? c / b.valor : 0;
        })
        // Filtra zeros (dias sem compra rebaixariam o sparkline) — padrão P0-11.
        .filter((v) => v > 0);

      const rpls = v.rpls;
      list.push({
        nome,
        qtdCompras: v.qtd,
        litros: v.litros,
        custo: v.custo,
        rPorLMin: rpls.length > 0 ? Math.min(...rpls) : 0,
        rPorLMedio: v.litros > 0 ? v.custo / v.litros : 0,
        rPorLMax: rpls.length > 0 ? Math.max(...rpls) : 0,
        pctTotal: totalLitros > 0 ? (v.litros / totalLitros) * 100 : 0,
        spark: sparkRpL,
      });
    }
    list.sort((a, b) => b.litros - a.litros);
    return list;
  }, [entradasNoPeriodo, periodo]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xs)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
            Ranking de fornecedores
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
            {rows.length} fornecedor{rows.length !== 1 ? 'es' : ''} no período · click filtra
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            <tr>
              <th className="text-right font-semibold px-3 py-2.5 w-[40px]">#</th>
              <th className="text-left font-semibold px-3 py-2.5">Fornecedor</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Compras</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Litros</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Custo</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">R$/L mín</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">R$/L médio</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">R$/L máx</th>
              <th className="text-left font-semibold px-3 py-2.5 w-[160px]">% do total</th>
              <th className="text-left font-semibold px-3 py-2.5 w-[80px]">Tend. R$/L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((r, i) => {
              const filtered = state.fornecedores.includes(r.nome);
              return (
                <tr
                  key={r.nome}
                  onClick={() => toggleFornecedor(r.nome)}
                  className={`cursor-pointer transition-colors ${
                    filtered ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-surface-2)]/60'
                  }`}
                >
                  <td className="px-3 py-2.5 text-right text-[var(--color-fg-muted)] font-mono text-xs tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[var(--color-fg)] font-medium truncate max-w-[280px]">{r.nome}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{r.qtdCompras}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{fmtL(r.litros)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{fmtBRL(r.custo)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg-muted)] text-xs">
                    {r.rPorLMin > 0 ? `R$ ${fmtNumDec(r.rPorLMin, 4)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)] text-xs font-semibold">
                    {r.rPorLMedio > 0 ? `R$ ${fmtNumDec(r.rPorLMedio, 4)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg-muted)] text-xs">
                    {r.rPorLMax > 0 ? `R$ ${fmtNumDec(r.rPorLMax, 4)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)] transition-all"
                          style={{ width: `${Math.max(r.pctTotal, 2)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-[var(--color-fg-muted)] w-[44px] text-right">
                        {fmtNumDec(r.pctTotal, 1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.spark.length >= 4 ? (
                      <Sparkline data={r.spark} width={64} height={20} />
                    ) : (
                      <span className="text-[10px] text-[var(--color-fg-subtle)] italic">poucos pts</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
