/**
 * ErrorState — padrão global pra queries que falharam.
 *
 * Distinção vs `combustivel/v2/shared/ErrorState`:
 *  - Este aqui é o componente global novo (Onda 1 do roadmap premium).
 *  - O do combustivel continua funcionando — migração gradual.
 *
 * Uso:
 *   <ErrorState
 *     title="Falha ao carregar fretes"
 *     onRetry={() => query.refetch()}
 *     error={query.error}
 *   />
 */
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

interface Props {
  title?: string;
  description?: string;
  /** Erro técnico — mostrado em <details> colapsável. Aceita Error ou string. */
  error?: Error | string | unknown;
  onRetry?: () => void;
  /** Slot pra ações adicionais além do retry (ex: link "Reportar problema"). */
  action?: React.ReactNode;
  size?: 'default' | 'compact';
  className?: string;
}

function formatError(e: unknown): string {
  if (!e) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.stack ?? e.message;
  try { return JSON.stringify(e, null, 2); } catch { return String(e); }
}

export default function ErrorState({
  title = 'Algo deu errado',
  description = 'Não conseguimos carregar os dados. Verifique sua conexão.',
  error,
  onRetry,
  action,
  size = 'default',
  className = '',
}: Props) {
  const isCompact = size === 'compact';
  return (
    <div
      role="alert"
      className={
        'rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] ' +
        (isCompact ? 'p-4' : 'p-6') + ' ' +
        className
      }
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className={(isCompact ? 'w-4 h-4' : 'w-5 h-5') + ' text-[var(--color-danger)] shrink-0 mt-0.5'}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className={(isCompact ? 'text-xs' : 'text-sm') + ' font-semibold text-[var(--color-danger-fg)]'}>
            {title}
          </p>
          <p
            className={
              (isCompact ? 'text-2xs' : 'text-xs') +
              ' text-[var(--color-danger-fg)]/85 mt-1'
            }
          >
            {description}
          </p>

          {error != null && (
            <details className="mt-2">
              <summary className="text-2xs text-[var(--color-fg-muted)] cursor-pointer hover:text-[var(--color-fg)] transition-colors">
                Detalhes técnicos
              </summary>
              <pre className="text-2xs font-mono mt-1 p-2 bg-[var(--color-surface-1)] rounded overflow-auto max-h-32 text-[var(--color-fg-muted)]">
                {formatError(error)}
              </pre>
            </details>
          )}

          {(onRetry || action) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {onRetry && (
                <Button variant="secondary" type="button" onClick={onRetry} className={isCompact ? 'text-xs' : 'text-sm'}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tentar novamente
                </Button>
              )}
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
