// Skeleton genérico — bloco com pulse suave. Sem shimmer pesado pra
// evitar custo de paint em devices fracos.

interface Props {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export default function SkeletonBlock({ className = '', width, height }: Props) {
  return (
    <div
      className={`bg-[var(--color-surface-2)] rounded-lg animate-pulse ${className}`}
      style={{ width, height }}
      aria-hidden
    />
  );
}
