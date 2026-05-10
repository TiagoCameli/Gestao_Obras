import { useEffect, useRef, type ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const widthClasses: Record<NonNullable<DrawerProps['width']>, string> = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
};

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'lg',
}: DrawerProps) {
  // F6.B — A11y: foca no botão Fechar quando o drawer abre. Pra usuários
  // de teclado/screen reader, isso garante que Tab cycle começa de um
  // ponto previsível (atalho intuitivo: ESC pra cancelar, Tab pra próximo).
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Foco no botão close após mount (RAF garante render completo)
    requestAnimationFrame(() => closeBtnRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={
          'absolute inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/70 ' +
          'transition-opacity duration-[var(--dur-base)] ease-[var(--ease-out)] ' +
          (open ? 'opacity-100' : 'opacity-0')
        }
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          `absolute top-0 right-0 h-full w-full ${widthClasses[width]} ` +
          'flex flex-col bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'border-l border-[var(--color-border)] shadow-[var(--shadow-xl)] ' +
          'transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] ' +
          (open ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/95 backdrop-blur-sm">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[var(--color-fg-muted)] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
