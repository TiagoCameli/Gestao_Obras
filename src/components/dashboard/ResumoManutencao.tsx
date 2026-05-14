// ResumoManutencao — mini-painel de Manutenção dentro do Dashboard.
// Mostra: nº de OS abertas/em andamento/concluídas no mês, custo total.

import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { useOrdensServico } from '../../hooks/useOrdensServico';

function inicioMesISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ResumoManutencao() {
  const { data: ordens = [] } = useOrdensServico({});
  const inicio = inicioMesISO();

  const dados = useMemo(() => {
    const noMes = ordens.filter((o) => (o.dataAbertura || '').slice(0, 10) >= inicio);
    const abertas = noMes.filter((o) =>
      ['aberta', 'em_execucao', 'aguardando_pecas', 'aguardando_aprovacao'].includes(o.status as string)
    ).length;
    const concluidas = noMes.filter((o) => o.status === 'concluida').length;
    const canceladas = noMes.filter((o) => o.status === 'cancelada').length;
    const custoTotal = noMes.reduce((sum, o) => sum + (o.custoTotal || 0), 0);
    return { abertas, concluidas, canceladas, custoTotal, total: noMes.length };
  }, [ordens, inicio]);

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="w-4 h-4 text-[var(--color-danger-fg)]" />
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Manutenção (este mês)</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Abertas</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-warning-fg)]">{dados.abertas}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Concluídas</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-accent)]">{dados.concluidas}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Canceladas</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-fg-subtle)]">{dados.canceladas}</p>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Custo total</p>
        <p className="text-xl font-semibold tabular-nums">{formatCurrency(dados.custoTotal)}</p>
      </div>
      {dados.total === 0 && (
        <p className="text-xs text-[var(--color-fg-subtle)] mt-2">Sem OS no período.</p>
      )}
    </div>
  );
}
