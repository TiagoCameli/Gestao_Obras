/**
 * Spinner — indicador circular de carregamento.
 *
 * Usado SÓ em:
 *  - Botões em loading state (size="sm" inline)
 *  - LoadingState mode="inline"
 *
 * Para listas/dashboards, preferir Skeleton (formato do conteúdo final).
 */
import { Loader2 } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Texto pra screen readers. Default: "Carregando" */
  label?: string;
}

const sizeMap = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export default function Spinner({ size = 'md', className = '', label = 'Carregando' }: Props) {
  return (
    <>
      <Loader2
        className={`${sizeMap[size]} animate-spin text-current ${className}`}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </>
  );
}
