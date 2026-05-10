// F9.4 — Badge inline pra mostrar contagem de anexos numa row de lista.
// Reduz overhead visual: só aparece quando há anexos. Tooltip explica o
// breakdown foto/arquivo. Click é opcional — caller decide se navega
// (drawer detalhes) ou só serve como indicador visual.

import { Paperclip } from 'lucide-react';

interface Props {
  fotoUrls?: string[] | null;
  arquivoUrls?: string[] | null;
  className?: string;
}

export default function AnexosBadge({ fotoUrls, arquivoUrls, className = '' }: Props) {
  const fotos = fotoUrls?.length ?? 0;
  const arquivos = arquivoUrls?.length ?? 0;
  const total = fotos + arquivos;
  if (total === 0) return null;

  // Tooltip detalhado: "3 fotos · 2 arquivos" ou só 1 lado quando o outro é 0
  const parts: string[] = [];
  if (fotos > 0) parts.push(`${fotos} foto${fotos !== 1 ? 's' : ''}`);
  if (arquivos > 0) parts.push(`${arquivos} arquivo${arquivos !== 1 ? 's' : ''}`);
  const title = parts.join(' · ');

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] tabular-nums ${className}`}
      title={title}
      aria-label={title}
    >
      <Paperclip className="w-3 h-3" aria-hidden />
      {total}
    </span>
  );
}
