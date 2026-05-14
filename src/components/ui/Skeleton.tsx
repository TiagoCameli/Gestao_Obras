/**
 * Skeleton loader genérico. Substitui o texto "Carregando…" por uma
 * representação visual da forma do conteúdo, reduzindo a percepção de
 * lentidão. Usa CSS animation (pulse + shimmer) sem JS.
 */
interface SkeletonProps {
  /** Largura — qualquer valor CSS (ex: "100%", "32px", "12rem"). */
  width?: string;
  /** Altura — qualquer valor CSS. */
  height?: string;
  /** Border radius. Default: "0.5rem". Use "9999px" para círculo. */
  rounded?: string;
  /** Classes extras pra ajustar margem/posição. */
  className?: string;
}

export default function Skeleton({
  width = "100%",
  height = "1rem",
  rounded = "0.5rem",
  className = "",
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-[var(--color-surface-2)] ${className}`}
      style={{ width, height, borderRadius: rounded }}
    />
  );
}

/** Skeleton em linhas — útil pra parágrafos / tabelas. */
export function SkeletonLines({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width={i === count - 1 ? "70%" : "100%"} height="0.75rem" />
      ))}
    </div>
  );
}

/** Skeleton de card (avatar + nome + 2 linhas). Usado em listas de pessoas. */
export function SkeletonCard() {
  return (
    <div
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <Skeleton width="2.5rem" height="2.5rem" rounded="9999px" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton width="60%" height="0.875rem" />
          <Skeleton width="40%" height="0.75rem" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton width="100%" height="2rem" rounded="0.5rem" />
      </div>
    </div>
  );
}

/** Skeleton de linha de tabela. */
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr aria-busy="true" className="border-t border-[var(--color-border)]">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton height="0.75rem" />
        </td>
      ))}
    </tr>
  );
}
