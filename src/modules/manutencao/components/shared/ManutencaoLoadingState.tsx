export interface ManutencaoLoadingStateProps {
  mensagem?: string;
  className?: string;
}

export function ManutencaoLoadingState({ mensagem, className = '' }: ManutencaoLoadingStateProps) {
  return (
    <div className={'w-full ' + className} aria-busy aria-live="polite">
      {mensagem && (
        <p className="mb-3 text-sm text-[var(--color-fg-muted)]">{mensagem}</p>
      )}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={
              'h-32 rounded-2xl border border-[var(--color-border)] ' +
              'bg-[var(--color-surface-1)] overflow-hidden relative manutencao-shimmer'
            }
          />
        ))}
      </div>
      <style>{`
        .manutencao-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--color-surface-2) 50%,
            transparent 100%
          );
          transform: translateX(-100%);
          animation: manutencao-shimmer-keyframes 1.4s ease-in-out infinite;
        }
        @keyframes manutencao-shimmer-keyframes {
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export default ManutencaoLoadingState;
