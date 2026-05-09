// F6.A — Error state padrão pra queries que falharam (network, RLS, etc).
// Mensagem amigável + botão Tentar novamente que dispara o refetch passado
// pelo caller (tipicamente queries de useQuery do React Query).
//
// Quando usar:
//   <ErrorState onRetry={() => query.refetch()} />
//
// Inline em painéis pequenos: passar size='compact' pra reduzir padding.

import { AlertOctagon, RefreshCw } from 'lucide-react';
import Button from '../../../ui/Button';

interface Props {
  /** Título visível. Padrão genérico — caller pode customizar pra contexto. */
  title?: string;
  /** Descrição explicativa abaixo do título. */
  description?: string;
  /** Mensagem técnica do erro (mostrada em monospace pequeno, opcional). */
  errorMessage?: string;
  /** Handler do botão "Tentar novamente". Sem onRetry → botão escondido. */
  onRetry?: () => void;
  /** Variante compacta pra inline em cards/listas. */
  size?: 'default' | 'compact';
  className?: string;
}

export default function ErrorState({
  title = 'Não foi possível carregar',
  description = 'Verifique sua conexão e tente novamente. Se o problema persistir, recarregue a página.',
  errorMessage,
  onRetry,
  size = 'default',
  className = '',
}: Props) {
  const isCompact = size === 'compact';
  return (
    <div
      className={`h-full w-full flex flex-col items-center justify-center text-center ${
        isCompact ? 'px-4 py-6' : 'px-6 py-10'
      } ${className}`}
      role="alert"
    >
      <div
        className={`${
          isCompact ? 'w-8 h-8' : 'w-10 h-10'
        } rounded-full bg-[var(--color-danger-soft)] flex items-center justify-center mb-3`}
      >
        <AlertOctagon
          className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-[var(--color-danger)]`}
        />
      </div>
      <p
        className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-[var(--color-fg)]`}
      >
        {title}
      </p>
      <p
        className={`${isCompact ? 'text-[11px]' : 'text-xs'} text-[var(--color-fg-muted)] mt-1 max-w-[280px]`}
      >
        {description}
      </p>
      {errorMessage && (
        <p
          className={`${
            isCompact ? 'text-[10px]' : 'text-[11px]'
          } font-mono text-[var(--color-fg-subtle)] mt-2 max-w-[320px] break-all`}
        >
          {errorMessage}
        </p>
      )}
      {onRetry && (
        <Button
          type="button"
          variant="secondary"
          onClick={onRetry}
          className={`mt-4 inline-flex items-center gap-1.5 ${isCompact ? 'text-xs' : 'text-sm'}`}
        >
          <RefreshCw className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
