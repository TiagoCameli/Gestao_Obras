import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import MarkdownDisplay from '../displays/MarkdownDisplay';
import type { ProcedimentoStep } from '../../types';

export interface ChecklistProcedimentoProps {
  steps: ProcedimentoStep[];
  /** Array paralelo a `steps` (mesma ordem do steps já ordenado por `order`). */
  concluidos: boolean[];
  onToggle: (index: number, valor: boolean) => void;
  className?: string;
}

export function ChecklistProcedimento({
  steps,
  concluidos,
  onToggle,
  className = '',
}: ChecklistProcedimentoProps) {
  if (steps.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Esta tarefa não tem procedimento cadastrado.
      </p>
    );
  }

  const ordenados = [...steps].sort((a, b) => a.order - b.order);
  const totalChecked = concluidos.filter(Boolean).length;
  const total = ordenados.length;
  const pct = total === 0 ? 0 : Math.round((totalChecked / total) * 100);

  return (
    <div className={'flex flex-col gap-4 ' + className}>
      <div>
        <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)] mb-1.5">
          <span className="font-medium">
            {totalChecked} de {total} passo(s) concluído(s)
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {ordenados.map((s, i) => {
          const checked = concluidos[i] ?? false;
          const id = `passo-${i}`;
          return (
            <li
              key={s.order}
              className={
                'flex gap-3 p-3 rounded-xl border transition-colors ' +
                (checked
                  ? 'border-[var(--color-success)]/40 bg-[var(--color-success-soft)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-1)]')
              }
            >
              <div className="pt-0.5">
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggle(i, e.target.checked)}
                  aria-label={`Marcar passo ${s.order} como concluído`}
                  className="w-5 h-5 cursor-pointer accent-[var(--color-accent)]"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={id}
                  className="block text-sm font-semibold text-[var(--color-fg)] cursor-pointer"
                >
                  <span className="text-[var(--color-fg-muted)] font-normal mr-1">
                    {s.order}.
                  </span>
                  {s.title}
                  {checked && (
                    <CheckCircle2
                      aria-hidden
                      className="inline w-4 h-4 ml-1.5 text-[var(--color-success-fg)]"
                    />
                  )}
                </label>
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
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default ChecklistProcedimento;
