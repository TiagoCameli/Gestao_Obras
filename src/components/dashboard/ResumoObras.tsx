// ResumoObras — mini-painel de Obras (status, prazos, valores).

import { Building2 } from 'lucide-react';
import { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { useObras } from '../../hooks/useObras';

export default function ResumoObras() {
  const { data: obras = [] } = useObras();

  const dados = useMemo(() => {
    const ativas = obras.filter((o) => o.status === 'em_andamento');
    const pausadas = obras.filter((o) => o.status === 'pausada');
    const planejamento = obras.filter((o) => o.status === 'planejamento');
    const orcamentoTotal = obras.reduce((sum, o) => sum + (o.orcamento || 0), 0);
    const hoje = new Date().toISOString().slice(0, 10);
    const atrasadas = ativas.filter(
      (o) => o.dataPrevisaoFim && o.dataPrevisaoFim < hoje
    ).length;
    return {
      ativas: ativas.length,
      pausadas: pausadas.length,
      planejamento: planejamento.length,
      atrasadas,
      orcamentoTotal,
    };
  }, [obras]);

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Obras</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Ativas</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-warning-fg)]">{dados.ativas}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Em planejamento</p>
          <p className="text-xl font-semibold tabular-nums">{dados.planejamento}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Pausadas</p>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-fg-subtle)]">{dados.pausadas}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Atrasadas</p>
          <p
            className={
              'text-xl font-semibold tabular-nums ' +
              (dados.atrasadas > 0 ? 'text-[var(--color-danger-fg)]' : '')
            }
          >
            {dados.atrasadas}
          </p>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Orçamento total</p>
        <p className="text-xl font-semibold tabular-nums">{formatCurrency(dados.orcamentoTotal)}</p>
      </div>
      {obras.length === 0 && (
        <p className="text-xs text-[var(--color-fg-subtle)] mt-2">Sem obras cadastradas.</p>
      )}
    </div>
  );
}
