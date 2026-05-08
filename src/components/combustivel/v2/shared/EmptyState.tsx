// Empty state padrão pra gráficos/tabelas sem dado no recorte filtrado.

import { Fuel } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export default function EmptyState({
  title = 'Sem dados no período',
  description = 'Ajuste o filtro pra ver resultados.',
  icon: Icon = Fuel,
  className = '',
}: Props) {
  return (
    <div className={`h-full w-full flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[var(--color-fg-subtle)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
      <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-[260px]">{description}</p>
    </div>
  );
}
