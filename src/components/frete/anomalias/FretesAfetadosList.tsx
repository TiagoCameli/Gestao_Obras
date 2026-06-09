import type { Frete } from '../../../types';
import { Pencil } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface Props {
  fretes: Frete[];
  insumoNome: Map<string, string>;
  onEditFrete?: (f: Frete) => void;
}

export default function FretesAfetadosList({ fretes, insumoNome, onEditFrete }: Props) {
  if (fretes.length === 0) {
    return <p className="text-sm text-[var(--color-fg-muted)] italic">Anomalia agregada por material e fornecedor (sem fretes específicos).</p>;
  }
  return (
    <ul className="space-y-2">
      {fretes.map((f) => {
        const unit = f.pesoToneladas > 0 ? f.valorMaterial / f.pesoToneladas : 0;
        return (
          <li key={f.id} className="rounded-lg border border-[var(--color-border)] p-2.5 text-sm flex items-start justify-between gap-2">
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{f.data} · {f.origem || '—'} → {f.destino || '—'}</span>
              <span className="text-xs text-[var(--color-fg-muted)]">
                {insumoNome.get(f.insumoId) || f.insumoId} · {f.pesoToneladas.toLocaleString('pt-BR')} t · {f.placaCarreta || 's/ placa'} · NF {f.notaFiscal || '—'}
              </span>
              <span className="text-xs text-[var(--color-fg-muted)]">
                Material {formatCurrency(f.valorMaterial)} ({unit > 0 ? `${formatCurrency(unit)}/t` : '—'})
              </span>
            </div>
            {onEditFrete && (
              <button
                type="button"
                onClick={() => onEditFrete(f)}
                className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
                title="Editar frete"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
