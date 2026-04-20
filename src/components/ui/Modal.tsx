import { useEffect, type ReactNode } from 'react';

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
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/70"
        onClick={onClose}
      />
      <div
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
          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-fg)] tracking-tight">
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
    </div>
  );
}
