// Ranking detalhado por consumidor (mode-aware).
// Mode='proprios': linha "_naoid" agrupa todos os sentinels com label
//   "Não identificado", cinza hachurado, click → nav pra Saídas filtradas
//   (apenasSentinel=1). Linhas normais togglam equipamentoIds (cross-filter).
// Mode='carretas': agrupa por placa; click toggla state.placas.

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Equipamento, Fornecedor, SaidaCombustivel } from '../../../../types';
import { useCombustivelFilter } from '../filters/FilterContext';
import Sparkline from '../shared/Sparkline';
import { fmtBRL, fmtL, fmtNumDec } from '../shared/formatters';
import { bucketByDia } from '../shared/stats';
import type { ConsumidorMode } from '../filters/types';

interface Props {
  mode: ConsumidorMode;
  saidasNoPeriodo: SaidaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  periodo: { from: string; to: string };
  /** Click no row sentinel ("_naoid") → liga apenasSentinel + vai pra Saídas. */
  onAtribuirSentinels: () => void;
}

interface RankRow {
  id: string;            // equipamentoId | placa | '_naoid'
  isSentinel: boolean;
  nome: string;
  meta: string;          // patrimônio (proprios) ou transportadora (carretas)
  litros: number;
  custo: number;
  rPorL: number;
  qtdSaidas: number;
  pctTotal: number;
  spark: number[];
}

export default function ConsumidoresRankingTable({
  mode,
  saidasNoPeriodo,
  equipamentos,
  transportadoras,
  periodo,
  onAtribuirSentinels,
}: Props) {
  const { state, toggleEquipamento, togglePlaca } = useCombustivelFilter();
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e])), [equipamentos]);
  const transpMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);

  const rows = useMemo<RankRow[]>(() => {
    const acc = new Map<string, { litros: number; custo: number; qtdSaidas: number; saidas: SaidaCombustivel[] }>();
    let totalLitros = 0;
    for (const s of saidasNoPeriodo) {
      let key: string | null = null;
      if (mode === 'proprios') {
        key = s.equipamentoId === 'desconhecido' ? '_naoid' : (s.equipamentoId || null);
      } else {
        key = (s.placa || '').trim() || null;
      }
      if (!key) continue;
      totalLitros += s.litros;
      const cur = acc.get(key) ?? { litros: 0, custo: 0, qtdSaidas: 0, saidas: [] };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      cur.qtdSaidas += 1;
      cur.saidas.push(s);
      acc.set(key, cur);
    }

    const list: RankRow[] = [];
    for (const [id, v] of acc) {
      const isSentinel = id === '_naoid';
      let nome = id;
      let meta = '';
      if (isSentinel) {
        nome = 'Não identificado';
        meta = `${v.qtdSaidas} saída${v.qtdSaidas !== 1 ? 's' : ''} sem equipamento`;
      } else if (mode === 'proprios') {
        const eq = equipMap.get(id);
        nome = eq?.nome ?? id;
        meta = eq?.codigoPatrimonio || eq?.tipo || '';
      } else {
        const ref = v.saidas.find((s) => s.transportadoraId);
        meta = ref?.transportadoraId ? (transpMap.get(ref.transportadoraId) ?? '') : '';
      }
      const spark = bucketByDia(v.saidas, (s) => s.data, (s) => s.litros, periodo.from, periodo.to).map((d) => d.valor);
      list.push({
        id,
        isSentinel,
        nome,
        meta,
        litros: v.litros,
        custo: v.custo,
        rPorL: v.litros > 0 ? v.custo / v.litros : 0,
        qtdSaidas: v.qtdSaidas,
        pctTotal: totalLitros > 0 ? (v.litros / totalLitros) * 100 : 0,
        spark,
      });
    }
    list.sort((a, b) => b.litros - a.litros);
    return list;
  }, [mode, saidasNoPeriodo, equipMap, transpMap, periodo]);

  if (rows.length === 0) return null;

  function handleRowClick(r: RankRow) {
    if (r.isSentinel) {
      onAtribuirSentinels();
      return;
    }
    if (mode === 'proprios') toggleEquipamento(r.id);
    else togglePlaca(r.id);
  }

  function isFiltered(r: RankRow): boolean {
    if (r.isSentinel) return state.apenasSentinel;
    if (mode === 'proprios') return state.equipamentoIds.includes(r.id);
    return state.placas.includes(r.id);
  }

  const labelMeta = mode === 'proprios' ? 'Equip.' : 'Placa';

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xs)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
            Ranking de {mode === 'proprios' ? 'equipamentos' : 'carretas'}
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
            {rows.length} {labelMeta.toLowerCase()}{rows.length !== 1 ? 's' : ''} no período · click filtra · linha hachurada = atribuir
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            <tr>
              <th className="text-right font-semibold px-3 py-2.5 w-[40px]">#</th>
              <th className="text-left font-semibold px-3 py-2.5">{mode === 'proprios' ? 'Equipamento' : 'Placa'}</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Litros</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Custo</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">R$/L</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Saídas</th>
              <th className="text-left font-semibold px-3 py-2.5 w-[180px]">% do total</th>
              <th className="text-left font-semibold px-3 py-2.5 w-[80px]">Tend.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((r, i) => {
              const filtered = isFiltered(r);
              // Sentinel: cinza hachurado (background gradient diagonal sutil)
              const sentinelBg = r.isSentinel
                ? 'bg-[repeating-linear-gradient(45deg,var(--color-surface-2),var(--color-surface-2)_4px,var(--color-surface-1)_4px,var(--color-surface-1)_8px)]'
                : '';
              return (
                <tr
                  key={r.id}
                  onClick={() => handleRowClick(r)}
                  className={`cursor-pointer transition-colors ${
                    filtered
                      ? 'bg-[var(--color-accent-soft)]'
                      : `${sentinelBg} hover:bg-[var(--color-surface-2)]/60`
                  }`}
                >
                  <td className="px-3 py-2.5 text-right text-[var(--color-fg-muted)] font-mono text-xs tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`font-medium truncate max-w-[280px] ${
                      r.isSentinel ? 'text-amber-700 dark:text-amber-400 inline-flex items-center gap-1.5' : 'text-[var(--color-fg)]'
                    }`}>
                      {r.isSentinel && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span className={mode === 'carretas' && !r.isSentinel ? 'font-mono' : ''}>{r.nome}</span>
                    </div>
                    {r.meta && (
                      <div className="text-[10px] text-[var(--color-fg-subtle)] truncate max-w-[280px]">{r.meta}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{fmtL(r.litros)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{fmtBRL(r.custo)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg-muted)] text-xs">
                    {r.rPorL > 0 ? `R$ ${fmtNumDec(r.rPorL, 4)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{r.qtdSaidas}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className={`h-full transition-all ${r.isSentinel ? 'bg-amber-500/70' : 'bg-[var(--color-accent)]'}`}
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
