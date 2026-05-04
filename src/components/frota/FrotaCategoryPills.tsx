import type { Equipamento, TipoEquipamento } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';

interface FrotaCategoryPillsProps {
  equipamentos: Equipamento[];
  categoriaFiltro: TipoEquipamento | '';
  onSelect: (tipo: TipoEquipamento | '') => void;
}

export default function FrotaCategoryPills({ equipamentos, categoriaFiltro, onSelect }: FrotaCategoryPillsProps) {
  const contagem = new Map<TipoEquipamento, number>();
  for (const eq of equipamentos) {
    if (eq.tipo) {
      contagem.set(eq.tipo, (contagem.get(eq.tipo) ?? 0) + 1);
    }
  }

  const tipos = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  function pillClass(active: boolean): string {
    return (
      'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium ' +
      'transition-all border whitespace-nowrap focus-visible:outline-none ' +
      'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ' +
      (active
        ? 'bg-[var(--color-fg)] text-[var(--color-surface-1)] border-[var(--color-fg)] shadow-[var(--shadow-sm)]'
        : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]')
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => onSelect('')} className={pillClass(categoriaFiltro === '')}>
        <span className="font-semibold">Todos</span>
        <span className={
          'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] tabular-nums font-bold ' +
          (categoriaFiltro === ''
            ? 'bg-[var(--color-surface-1)] text-[var(--color-fg)]'
            : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]')
        }>
          {equipamentos.length}
        </span>
      </button>
      {tipos.map(([tipo, count]) => {
        const cat = getCategoriaFrota(tipo);
        const ativo = categoriaFiltro === tipo;
        return (
          <button key={tipo} onClick={() => onSelect(tipo)} className={pillClass(ativo)}>
            <span className={`w-2 h-2 rounded-full ${cat.cor}`} aria-hidden />
            <span>{cat.label}</span>
            <span className={
              'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] tabular-nums font-bold ' +
              (ativo
                ? 'bg-[var(--color-surface-1)] text-[var(--color-fg)]'
                : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]')
            }>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
