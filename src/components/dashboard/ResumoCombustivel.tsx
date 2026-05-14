// ResumoCombustivel — mini-painel de Combustível dentro do Dashboard principal.
// Mostra: total gasto no período, litros consumidos, top 3 equipamentos.

import { Fuel } from 'lucide-react';
import { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { useSaidasCombustivel } from '../../hooks/useSaidasCombustivel';
import { useEquipamentos } from '../../hooks/useEquipamentos';

interface Props {
  obraId?: string;
  /** Data inicial ISO yyyy-mm-dd; default = primeiro dia do mês atual. */
  desde?: string;
}

function inicioMesISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ResumoCombustivel({ obraId, desde }: Props) {
  const { data: saidas = [] } = useSaidasCombustivel();
  const { data: equipamentos = [] } = useEquipamentos();
  const inicio = desde ?? inicioMesISO();

  const dados = useMemo(() => {
    const filtered = saidas.filter((s) => {
      const data = (s.data || '').slice(0, 10);
      if (data < inicio) return false;
      if (obraId && s.obraId !== obraId) return false;
      return true;
    });
    const totalValor = filtered.reduce((sum, s) => sum + (s.valorTotal || 0), 0);
    const totalLitros = filtered.reduce((sum, s) => sum + (s.litros || 0), 0);

    // Top 3 equipamentos por consumo
    const porEquip = new Map<string, { litros: number; valor: number }>();
    for (const s of filtered) {
      const id = s.equipamentoId ?? 'desconhecido';
      if (id === 'desconhecido') continue;
      const cur = porEquip.get(id) ?? { litros: 0, valor: 0 };
      cur.litros += s.litros || 0;
      cur.valor += s.valorTotal || 0;
      porEquip.set(id, cur);
    }
    const equipMap = new Map(equipamentos.map((e) => [e.id, e.nome]));
    const top = [...porEquip.entries()]
      .map(([id, v]) => ({ nome: equipMap.get(id) ?? id, ...v }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3);

    return { totalValor, totalLitros, top };
  }, [saidas, equipamentos, obraId, inicio]);

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-2 mb-3">
        <Fuel className="w-4 h-4 text-[var(--color-info-fg)]" />
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Combustível (este mês)</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Total</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(dados.totalValor)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Litros</p>
          <p className="text-xl font-semibold tabular-nums">
            {dados.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
          </p>
        </div>
      </div>
      {dados.top.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
            Top equipamentos
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
