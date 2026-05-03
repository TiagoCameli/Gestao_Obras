import { AlertCircle } from 'lucide-react';
import Button from '../../../../components/ui/Button';

export interface ManutencaoErrorStateProps {
  erro: Error | unknown;
  onRetry?: () => void;
  className?: string;
}

function extrairMensagem(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'string') return erro;
  if (erro && typeof erro === 'object' && 'message' in erro) {
    const m = (erro as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Ocorreu um erro inesperado.';
}

export function ManutencaoErrorState({ erro, onRetry, className = '' }: ManutencaoErrorStateProps) {
  return (
    <div
      role="alert"
      className={
        'flex items-start gap-3 px-4 py-4 rounded-xl ' +
        'bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 ' +
        className
      }
    >
      <AlertCircle
        aria-hidden
        className="w-5 h-5 mt-0.5 shrink-0 text-[var(--color-danger)]"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-danger-fg)]">
          Não foi possível carregar
        </p>
        <p className="mt-1 text-sm text-[var(--color-fg)] break-words whitespace-pre-wrap">
          {extrairMensagem(erro)}
        </p>
        {onRetry && (
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Tentar de novo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManutencaoErrorState;
