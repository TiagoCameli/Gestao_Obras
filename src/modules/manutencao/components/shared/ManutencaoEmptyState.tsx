import type { ReactNode } from 'react';
import Button from '../../../../components/ui/Button';

export interface ManutencaoEmptyStateProps {
  titulo: string;
  mensagem?: string;
  icone?: ReactNode;
  acao?: { label: string; onClick: () => void };
  className?: string;
}

export function ManutencaoEmptyState({
  titulo,
  mensagem,
  icone,
  acao,
  className = '',
}: ManutencaoEmptyStateProps) {
  return (
    <div
      role="status"
      className={
        'flex flex-col items-center justify-center text-center px-6 py-12 ' +
        'rounded-2xl bg-[var(--color-surface-1)] border border-dashed border-[var(--color-border)] ' +
        className
      }
    >
      {icone && (
        <div
          aria-hidden
          className="mb-4 text-[var(--color-fg-subtle)] [&>*]:w-12 [&>*]:h-12"
        >
          {icone}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-fg)]">{titulo}</h3>
      {mensagem && (
        <p className="mt-1.5 text-sm text-[var(--color-fg-muted)] max-w-md">{mensagem}</p>
      )}
      {acao && (
        <div className="mt-5">
          <Button onClick={acao.onClick} variant="primary">
            {acao.label}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ManutencaoEmptyState;
