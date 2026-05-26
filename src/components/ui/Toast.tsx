// Toast — feedback global para ações CRUD (criar / editar / excluir).
//
// Como usar:
//   1. App.tsx já está envolto em <ToastProvider> (vide src/App.tsx).
//   2. Em qualquer componente, chame `const { showToast } = useToast();`.
//   3. showToast({ kind: 'success', message: 'Frete criado!' });
//
// Tipos: 'success' (verde), 'error' (vermelho), 'warning' (amarelo), 'info' (cinza).
// Cada toast some sozinho em 4s; usuário pode fechar antes no X.
//
// Decisão de design: provider próprio em vez de lib externa para manter o bundle
// enxuto (já temos react/recharts/leaflet — qualquer lib de toast custaria 5-10kb).

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  kind?: ToastKind;
  message: string;
  /** Duração em ms. Default: 4000. Use 0 para "permanente" até o usuário fechar. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, 'duration'>> {
  id: number;
  duration: number;
}

interface ToastContextValue {
  showToast: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback silencioso: se o provider não estiver montado, vira no-op em
    // vez de quebrar o render. Útil em testes/storybook.
    return { showToast: () => {} };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = ++idRef.current;
    const t: ToastItem = {
      id,
      kind: input.kind ?? 'info',
      message: input.message,
      duration: input.duration ?? 4000,
    };
    setToasts((prev) => [...prev, t]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Container — fixed top-right; em mobile vira full-width no topo. */}
      <div
        className="fixed z-[9999] top-4 right-4 left-4 sm:left-auto flex flex-col gap-2 max-w-md sm:max-w-sm ml-auto pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastItemView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const t = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(t);
  }, [toast.duration, onDismiss]);

  const palette = {
    success: {
      Icon: CheckCircle2,
      bg: 'bg-green-50 dark:bg-green-950/60',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      text: 'text-green-900 dark:text-green-100',
    },
    error: {
      Icon: AlertCircle,
      bg: 'bg-red-50 dark:bg-red-950/60',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      text: 'text-red-900 dark:text-red-100',
    },
    warning: {
      Icon: AlertCircle,
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-900 dark:text-amber-100',
    },
    info: {
      Icon: Info,
      bg: 'bg-[var(--color-surface-1)]',
      border: 'border-[var(--color-border)]',
      icon: 'text-[var(--color-fg-muted)]',
      text: 'text-[var(--color-fg)]',
    },
  }[toast.kind];
  const Icon = palette.Icon;

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 ${palette.bg} ${palette.border} ${palette.text} border rounded-lg shadow-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2`}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${palette.icon}`} />
      <div className="flex-1 leading-snug">{toast.message}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
