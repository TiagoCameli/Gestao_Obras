// Placeholder pras abas analíticas/relatórios entregues em fases
// posteriores (F2/F3/F4). Visual coerente com EmptyState mas com
// rótulo "Em breve" e descrição da promessa.

import { Sparkles } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  /** Rótulo da fase em que vai chegar (F2, F3, F4). */
  phase: string;
}

export default function ComingSoon({ title, description, phase }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-16 px-6 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center mb-4">
        <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] font-semibold mb-1">
        Em breve · {phase}
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-fg)] tracking-tight">{title}</h3>
      <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-md mx-auto">{description}</p>
    </div>
  );
}
