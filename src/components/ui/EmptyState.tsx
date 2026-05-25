/**
 * EmptyState — padrão global pra listas/tabelas/painéis sem dado.
 *
 * Distinção vs `combustivel/v2/shared/EmptyState`:
 *  - Este aqui é o componente global novo (Onda 1 do roadmap premium).
 *  - O do combustivel/v2/shared continua funcionando — migração gradual
 *    nas ondas que tocarem aquelas telas.
 *
 * Uso:
 *   <EmptyState
 *     icon={ClipboardList}
 *     title="Nenhum frete encontrado"
 *     description="Ajuste os filtros ou crie um novo."
 *     action={<Button onClick={onNew}>Novo frete</Button>}
 *   />
 */
import { ClipboardList, type LucideIcon } from 'lucide-react';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** `compact` reduz padding pra usar inline em painéis pequenos. */
  size?: 'default' | 'compact';
  className?: string;
}

export default function EmptyState({
  icon: Icon = ClipboardList,
  title,
  description,
  action,
  size = 'default',
  className = '',
}: Props) {
  const isCompact = size === 'compact';
  return (
    <div
      className={
        'surface-raised text-center flex flex-col items-center justify-center ' +
        (isCompact ? 'p-6' : 'p-10') + ' ' +
        className
      }
    >
      <div
        className={
          'rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mb-3 ' +
          (isCompact ? 'w-10 h-10' : 'w-12 h-12')
        }
      >
        <Icon
          className={(isCompact ? 'w-5 h-5' : 'w-6 h-6') + ' text-[var(--color-fg-subtle)]'}
          aria-hidden
        />
      </div>
      <p className={(isCompact ? 'text-xs' : 'text-sm') + ' font-semibold text-[var(--color-fg)]'}>
        {title}
      </p>
      {description && (
        <p
          className={
            (isCompact ? 'text-2xs' : 'text-xs') +
            ' text-[var(--color-fg-muted)] mt-1 max-w-sm'
          }
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
