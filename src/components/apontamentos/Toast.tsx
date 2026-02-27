import { useCallback, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning';

const COLORS: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-600',
};

export function ToastContainer({ message, type = 'success' }: { message: string; type?: ToastType }) {
  if (!message) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[60] ${COLORS[type]} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium`} aria-live="polite">
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const toastElement = toast ? <ToastContainer message={toast.message} type={toast.type} /> : null;

  return { showToast, toastElement };
}
