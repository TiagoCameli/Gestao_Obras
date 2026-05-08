// G7 — Tabela compacta dos últimos N abastecimentos do período.
// Colunas adaptam ao mode:
//   - 'proprios':  Data | Equipamento | Operador | Combustível | Litros | R$/L | Total
//   - 'carretas':  Data | Placa | Motorista | Transportadora | Combustível | Litros | R$/L | Total
// Linha clicável (no F1, abre nada; F5 abrirá o drawer de detalhes).

import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Equipamento, Fornecedor, Insumo, Obra, SaidaCombustivel } from '../../../../types';
import type { ConsumidorMode } from '../filters/types';
import { fmtBRL, fmtDataHora, fmtL, fmtNumDec, iniciais } from '../shared/formatters';
import { corCombustivel } from '../shared/chartTheme';

interface Props {
  mode: ConsumidorMode;
  saidasNoPeriodo: SaidaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  obras: Obra[];
  combustiveis: Insumo[];
  topN?: number;
  onSelect?: (s: SaidaCombustivel) => void;
  /** Botão "Ver todos" → muda pra aba de Saídas. */
  onVerTodos?: () => void;
}

export default function UltimosAbastecimentosTable({
  mode,
  saidasNoPeriodo,
  equipamentos,
  transportadoras,
  obras,
  combustiveis,
  topN = 10,
  onSelect,
  onVerTodos,
}: Props) {
  const eqMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e])), [equipamentos]);
  const transpMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);
  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const combMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);

  const rows = useMemo(
    () => [...saidasNoPeriodo].sort((a, b) => b.data.localeCompare(a.data)).slice(0, topN),
    [saidasNoPeriodo, topN],
  );

  if (rows.length === 0) return null;

  // Subtítulo adapta: quando exibido == total, omite "mais recentes" pra
  // não enganar.
  const totalNoPeriodo = saidasNoPeriodo.length;
  const showAllInWindow = rows.length === totalNoPeriodo;
  const subtitle = showAllInWindow
    ? `Todos os abastecimentos no período (${totalNoPeriodo})`
    : `${rows.length} mais recentes no período`;
  const verTodosLabel = `Ver todos (${totalNoPeriodo})`;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xs)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
            {showAllInWindow ? 'Abastecimentos no período' : 'Últimos abastecimentos'}
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{subtitle}</p>
        </div>
        {onVerTodos && !showAllInWindow && (
          <button
            type="button"
            onClick={onVerTodos}
            className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium inline-flex items-center gap-1"
          >
            {verTodosLabel} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Data/hora</th>
              {mode === 'proprios' ? (
                <>
                  <th className="text-left font-semibold px-3 py-2.5">Equipamento</th>
                  <th className="text-left font-semibold px-3 py-2.5">Operador</th>
                </>
              ) : (
                <>
                  <th className="text-left font-semibold px-3 py-2.5">Placa</th>
                  <th className="text-left font-semibold px-3 py-2.5">Motorista</th>
                  <th className="text-left font-semibold px-3 py-2.5">Transportadora</th>
                </>
              )}
              <th className="text-left font-semibold px-3 py-2.5">Combustível</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Litros</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">R$/L</th>
              <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((s) => {
              const eq = s.equipamentoId && s.equipamentoId !== 'desconhecido' ? eqMap.get(s.equipamentoId) : null;
              const combNome = s.tipoCombustivel ? combMap.get(s.tipoCombustivel) ?? '—' : '—';
              const cor = corCombustivel(combNome);
              const rPorL = s.litros > 0 ? s.valorTotal / s.litros : 0;
              const motorista = (s.motorista || '').trim();
              const placa = (s.placa || '').trim();
              const transpNome = s.transportadoraId ? transpMap.get(s.transportadoraId) : null;
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelect?.(s)}
                  className={`hover:bg-[var(--color-surface-2)]/60 transition-colors ${onSelect ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-2.5 text-[var(--color-fg-muted)] whitespace-nowrap text-xs">
                    {fmtDataHora(s.data)}
                  </td>
                  {mode === 'proprios' ? (
                    <>
                      <td className="px-3 py-2.5">
                        <div className="text-[var(--color-fg)] font-medium">{eq?.nome ?? '—'}</div>
                        {eq?.codigoPatrimonio && (
                          <div className="text-[10px] font-mono text-[var(--color-fg-subtle)]">{eq.codigoPatrimonio}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {motorista ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-surface-2)] text-[10px] font-semibold flex items-center justify-center text-[var(--color-fg-muted)]">
                              {iniciais(motorista)}
                            </span>
                            <span className="text-xs text-[var(--color-fg)]">{motorista}</span>
                          </span>
                        ) : (
                          <span className="text-xs italic text-[var(--color-fg-subtle)]">—</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2.5 font-mono text-[var(--color-fg)] font-semibold">
                        {placa || <span className="italic text-[var(--color-fg-subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {motorista ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-surface-2)] text-[10px] font-semibold flex items-center justify-center text-[var(--color-fg-muted)]">
                              {iniciais(motorista)}
                            </span>
                            <span className="text-xs text-[var(--color-fg)]">{motorista}</span>
                          </span>
                        ) : (
                          <span className="text-xs italic text-[var(--color-fg-subtle)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[var(--color-fg-muted)]">
                        {transpNome ?? <span className="italic text-[var(--color-fg-subtle)]">—</span>}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        background: `color-mix(in srgb, ${cor} 18%, transparent)`,
                        color: cor,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                      {combNome}
                    </span>
                    {s.obraId && obraMap.get(s.obraId) && (
                      <div className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">{obraMap.get(s.obraId)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg)]">{fmtL(s.litros)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--color-fg-muted)] text-xs">
                    {rPorL > 0 ? `R$ ${fmtNumDec(rPorL, 4)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--color-fg)]">
                    {fmtBRL(s.valorTotal)}
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
