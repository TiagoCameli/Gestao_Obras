import { CheckCircle2, XCircle } from 'lucide-react';
import type { CriterioAceite } from '../../types';

export interface CriteriosAceiteListProps {
  criterios: CriterioAceite[];
  className?: string;
}

export function CriteriosAceiteList({ criterios, className = '' }: CriteriosAceiteListProps) {
  if (criterios.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Nenhum critério de aceite definido.
      </p>
    );
  }

  const ordenados = [...criterios].sort((a, b) => a.ordem - b.ordem);

  return (
    <ol className={'flex flex-col gap-3 ' + className}>
      {ordenados.map((c) => (
        <li key={c.ordem} className="flex gap-3">
          <CheckCircle2
            aria-hidden
            className="w-5 h-5 mt-0.5 shrink-0 text-[var(--color-success-fg)]"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--color-fg)]">
              <span className="font-semibold mr-1">{c.ordem}.</span>
              {c.descricao}
            </p>
            {c.comoVerificar && (
              <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                <span className="font-medium text-[var(--color-fg)]">Como verificar: </span>
                {c.comoVerificar}
              </p>
            )}
            {c.acaoSeReprovar && (
              <p className="mt-1 text-xs text-[var(--color-danger-fg)] flex items-start gap-1">
                <XCircle aria-hidden className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">Se reprovar: </span>
                  {c.acaoSeReprovar}
                </span>
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default CriteriosAceiteList;
