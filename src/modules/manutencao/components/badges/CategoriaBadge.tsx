import { CATEGORIA_LABELS, type ManutencaoCategoria } from '../../types';

export interface CategoriaBadgeProps {
  categoria: ManutencaoCategoria;
  className?: string;
}

export function CategoriaBadge({ categoria, className = '' }: CategoriaBadgeProps) {
  return (
    <span
      className={
        'inline-flex items-center px-2 py-0.5 rounded-full ' +
        'text-[12px] font-medium leading-tight ' +
        'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] ' +
        'border border-[var(--color-border)] ' +
        className
      }
    >
      {CATEGORIA_LABELS[categoria]}
    </span>
  );
}

export default CategoriaBadge;
