// Marco 4 / PR22 — Custo de peças nos últimos 12 meses do equipamento.
//
// Mostra total + barra mensal simples. Se zero, banner discreto convidando
// a aplicar plano preventivo.

import { Package, TrendingUp } from 'lucide-react';
import { useCustoPecasEquipamentoDetalhe } from '../../../hooks/useCustoPecasEquipamento';

interface Props {
  equipamentoId: string;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtMes(s: string): string {
  // '2026-05' → 'mai/26'
  const [a, m] = s.split('-');
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${meses[parseInt(m, 10) - 1]}/${a.slice(2)}`;
}

export default function CustoPecasEquipamentoSection({ equipamentoId }: Props) {
  const { data, isLoading } = useCustoPecasEquipamentoDetalhe(equipamentoId);

  if (isLoading) {
    return (
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
          Custo de peças (12 meses)
        </h3>
        <p className="text-sm text-[var(--color-fg-muted)] py-4 text-center">Carregando…</p>
      </section>
    );
  }

  const total = data?.total;
  const mensal = data?.mensal ?? [];
  const totalCusto = total?.custoTotal12m ?? 0;
  const maxMes = Math.max(0, ...mensal.map((m) => m.custoPecas));

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
        Custo de peças (12 meses)
      </h3>

      {totalCusto === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 text-center">
          <Package aria-hidden className="w-8 h-8 text-[var(--color-fg-subtle)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-fg)]">
            Nenhum consumo de peças registrado
          </p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-md mx-auto">
            Quando OSs deste equipamento consumirem peças do almoxarifado, o
            gasto vai aparecer aqui consolidado por mês.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
          {/* Header com total + sumário */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-info-soft)] text-[var(--color-info-fg)] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">
                  Total no período
                </div>
                <div className="text-xl font-semibold text-[var(--color-fg)] font-mono">
                  {fmtBRL(totalCusto)}
                </div>
              </div>
            </div>
            {total && (
              <div className="text-xs text-[var(--color-fg-muted)] text-right">
                <div>{total.numOs} OS · {total.numPecas} peças</div>
                <div className="text-[var(--color-fg-subtle)]">
                  Média/mês: {fmtBRL(totalCusto / 12)}
                </div>
              </div>
            )}
          </div>

          {/* Barras mensais */}
          <div className="grid grid-cols-12 gap-1 items-end h-24">
            {mensal.map((m) => {
              const pct = maxMes > 0 ? (m.custoPecas / maxMes) * 100 : 0;
              return (
                <div key={m.mes} className="flex flex-col items-center justify-end h-full">
                  <div
                    className={
                      'w-full rounded-t ' +
                      (m.custoPecas > 0
                        ? 'bg-[var(--color-accent)]'
                        : 'bg-[var(--color-surface-2)]')
                    }
                    style={{ height: `${Math.max(pct, m.custoPecas > 0 ? 4 : 2)}%` }}
                    title={`${fmtMes(m.mes)}: ${fmtBRL(m.custoPecas)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-12 gap-1 mt-1">
            {mensal.map((m) => (
              <div
                key={m.mes}
                className="text-[10px] text-center text-[var(--color-fg-subtle)] truncate"
              >
                {fmtMes(m.mes)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
