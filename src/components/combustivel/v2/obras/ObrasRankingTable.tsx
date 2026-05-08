// Ranking detalhado de obras com bar de % do total e sparkline diário
// embutida por linha. Click na linha → toggleObra (cross-filter).

import { useMemo } from 'react';
import type { Equipamento, Obra, SaidaCombustivel } from '../../../../types';
import { useCombustivelFilter } from '../filters/FilterContext';
import Sparkline from '../shared/Sparkline';
import { fmtBRL, fmtL, fmtNumDec } from '../shared/formatters';
import { bucketByDia } from '../shared/stats';

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
  obras: Obra[];
  equipamentos: Equipamento[];
  periodo: { from: string; to: string };
}

interface RankRow {
  id: string;
  nome: string;
  litros: number;
  custo: number;
  rPorL: number;
  qtdEquipamentos: number;
  pctTotal: number;
  spark: number[];
}

export default function ObrasRankingTable({ saidasNoPeriodo, obras, periodo }: Props) {
  const { state, toggleObra } = useCombustivelFilter();
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const rows = useMemo<RankRow[]>(() => {
    const acc = new Map<string, { litros: number; custo: number; equips: Set<string>; saidas: SaidaCombustivel[] }>();
    let totalLitros = 0;

    for (const s of saidasNoPeriodo) {
      if (!s.obraId) continue;
      totalLitros += s.litros;
      const cur = acc.get(s.obraId) ?? { litros: 0, custo: 0, equips: new Set<string>(), saidas: [] };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      // Equipamento próprio: conta distinct (ignora sentinel pra evitar
      // poluir com "1 equipamento desconhecido").
      if (s.equipamentoId && s.equipamentoId !== 'desconhecido') {
        cur.equips.add(s.equipamentoId);
      }
      cur.saidas.push(s);
      acc.set(s.obraId, cur);
    }

    const list: RankRow[] = [];
    for (const [id, v] of acc) {
      const spark = bucketByDia(v.saidas, (s) => s.data, (s) => s.litros, periodo.from, periodo.to).map((d) => d.valor);
      list.push({
        id,
        nome: obrasMap.get(id) ?? id,
        litros: v.litros,
        custo: v.custo,
        rPorL: v.litros > 0 ? v.custo / v.litros : 0,
        qtdEquipamentos: v.equips.size,
        pctTotal: totalLitros > 0 ? (v.litros / totalLitros) * 100 : 0,
        spark,
      });
    }
    list.sort((a, b) => b.litros - a.litros);
    return list;
  }, [saidasNoPeriodo, obrasMap, periodo]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xs)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
            Ranking de obras
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
            {rows.length} obra{rows.length !== 1 ? 's' : ''} com saída no período · click na linha filtra
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            <tr>
              <th className="text-right font-semibold px-3 py-2.5 w-[40px]">#</th>
              <th className="text-left font-semibold px-3 py-2.5">Obra</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Litros</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Custo</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">R$/L</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Equip.</th>
              <th className="text-left font-semibold px-3 py-2.5 w-[180px]">% do total</th>
              <th className="text-left font-semibold px-3 py-2.5 w-[80px]">Tend.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((r, i) => {
              const filtered = state.obraIds.includes(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => toggleObra(r.id)}
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
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{fmtL(r.litros)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{fmtBRL(r.custo)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg-muted)] text-xs">
                    {r.rPorL > 0 ? `R$ ${fmtNumDec(r.rPorL, 4)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{r.qtdEquipamentos}</td>
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
                    {r.spark.filter((v) => v > 0).length >= 4 ? (
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
