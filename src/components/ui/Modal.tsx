import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'default' | 'lg' | 'xl';
}

const sizeClasses = {
  default: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
};

export default function Modal({ open, onClose, title, children, size = 'default' }: ModalProps) {
  // F6.B — A11y: dialog ganha role="dialog" + aria-modal="true" + aria-labelledby
  // pra screen readers anunciarem corretamente. ESC fecha (faltava). useRef pro
  // título permite linkar com aria-labelledby.
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 8)}`);
  // Smoke-fix: só fecha o modal se o gesto COMEÇOU no backdrop. Antes, um
  // mousedown dentro do form (texto selecionado, drag de scroll) que terminava
  // no backdrop fechava o modal acidentalmente.
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onKey);
      };
    }
    document.body.style.overflow = '';
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    mouseDownOnBackdrop.current = e.target === e.currentTarget;
  };
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
      onClose();
    }
    mouseDownOnBackdrop.current = false;
  };

  // Renderiza via portal direto no document.body para escapar de
  // qualquer <form> ancestral. Sem isso, modais com <form> interno
  // (como cadastros rápidos de insumo/peça dentro do form da OC)
  // ficam com forms aninhados, que são HTML inválido — o navegador
  // descarta o form interno e o submit acaba no form externo.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/70"
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        className={
          'relative bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'sm:rounded-2xl shadow-[var(--shadow-xl)] ' +
          'border border-[var(--color-border)] ' +
          `w-full ${sizeClasses[size]} max-h-[100dvh] sm:max-h-[90vh] ` +
          'overflow-y-auto sm:mx-4 elevate-top'
        }
      >
        <div
          className={
            'flex items-center justify-between p-4 sm:p-5 ' +
            'border-b border-[var(--color-border)] ' +
            'sticky top-0 bg-[var(--color-surface-1)]/95 backdrop-blur-sm z-10'
          }
        >
          <h2
            id={titleId.current}
            className="text-base sm:text-lg font-semibold text-[var(--color-fg)] tracking-tight"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className={
              'w-9 h-9 inline-flex items-center justify-center rounded-lg ' +
              'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] ' +
              'hover:bg-[var(--color-surface-2)] transition-colors'
            }
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
