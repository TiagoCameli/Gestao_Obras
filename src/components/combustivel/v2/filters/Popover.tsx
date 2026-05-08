// Popover mínimo — botão trigger + painel ancorado embaixo.
// Click outside e Esc fecham. Sem animação pesada.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  /** Largura mínima do painel. */
  minWidth?: number;
  align?: 'start' | 'end';
  className?: string;
}

export default function Popover({
  trigger,
  children,
  minWidth = 240,
  align = 'start',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="contents"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1.5 z-30 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-lg)] overflow-hidden ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
          style={{ minWidth }}
          role="dialog"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
