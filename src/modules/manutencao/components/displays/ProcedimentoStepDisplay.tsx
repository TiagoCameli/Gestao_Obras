import { Clock, AlertTriangle } from 'lucide-react';
import type { ProcedimentoStep } from '../../types';
import MarkdownDisplay from './MarkdownDisplay';

export interface ProcedimentoStepDisplayProps {
  steps: ProcedimentoStep[];
  className?: string;
}

export function ProcedimentoStepDisplay({ steps, className = '' }: ProcedimentoStepDisplayProps) {
  if (steps.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Nenhum passo definido.
      </p>
    );
  }

  const ordenados = [...steps].sort((a, b) => a.order - b.order);

  return (
    <ol className={'flex flex-col gap-4 ' + className}>
      {ordenados.map((s) => (
        <li key={s.order} className="flex gap-3">
          <div
            aria-hidden
            className={
              'shrink-0 w-7 h-7 rounded-full flex items-center justify-center ' +
              'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] ' +
              'text-xs font-semibold'
            }
          >
            {s.order}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">{s.title}</h4>
            <div className="mt-1">
              <MarkdownDisplay markdown={s.description} />
            </div>
            {s.estimatedMinutes !== undefined && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-[var(--color-fg-subtle)]">
                <Clock aria-hidden className="w-3.5 h-3.5" />
                {s.estimatedMinutes} min
              </div>
            )}
            {s.warningNotes && (
              <div
                className={
                  'mt-2 flex items-start gap-2 px-3 py-2 rounded-lg text-sm ' +
                  'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] ' +
                  'border border-[var(--color-warning)]/20'
                }
              >
                <AlertTriangle aria-hidden className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap">{s.warningNotes}</span>
              </div>
            )}
            {s.imageUrl && (
              <img
                src={s.imageUrl}
                alt={`Ilustração do passo ${s.order}`}
                loading="lazy"
                className="mt-2 max-w-md w-full rounded-lg border border-[var(--color-border)]"
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default ProcedimentoStepDisplay;
