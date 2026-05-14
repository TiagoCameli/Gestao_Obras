// ResumoInsumos — mini-painel de Insumos/Material dentro do Dashboard.

import { Package } from 'lucide-react';
import { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { useSaidasMaterial } from '../../hooks/useSaidasMaterial';
import { useInsumos } from '../../hooks/useInsumos';

interface Props {
  obraId?: string;
  desde?: string;
}

function inicioMesISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ResumoInsumos({ obraId, desde }: Props) {
  const { data: saidas = [] } = useSaidasMaterial();
  const { data: insumos = [] } = useInsumos();
  const inicio = desde ?? inicioMesISO();

  const dados = useMemo(() => {
    const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));
    const filtered = saidas.filter((s) => {
      const data = (s.dataHora || '').slice(0, 10);
      if (data < inicio) return false;
      if (obraId && s.obraId !== obraId) return false;
      return true;
    });
    const totalValor = filtered.reduce((sum, s) => sum + (s.valorTotal || 0), 0);
    const totalItens = filtered.length;

    // Top 3 insumos por valor
    const porInsumo = new Map<string, number>();
    for (const s of filtered) {
      const key = insumosMap.get(s.insumoId) || 'Material';
      porInsumo.set(key, (porInsumo.get(key) || 0) + (s.valorTotal || 0));
    }
    const top = [...porInsumo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nome, valor]) => ({ nome, valor }));

    return { totalValor, totalItens, top };
  }, [saidas, insumos, obraId, inicio]);

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-[var(--color-warning-fg)]" />
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Insumos (este mês)</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Total</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(dados.totalValor)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Saídas</p>
          <p className="text-xl font-semibold tabular-nums">{dados.totalItens}</p>
        </div>
      </div>
      {dados.top.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
            Top insumos
          </p>
          <ul className="space-y-1">
            {dados.top.map((t, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="truncate text-[var(--color-fg)] max-w-[60%]">{t.nome}</span>
                <span className="font-mono text-[var(--color-fg-muted)]">{formatCurrency(t.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dados.totalValor === 0 && (
        <p className="text-xs text-[var(--color-fg-subtle)] mt-2">Sem lançamentos no período.</p>
      )}
    </div>
  );
}
