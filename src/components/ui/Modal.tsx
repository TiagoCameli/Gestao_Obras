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
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className={`relative bg-white dark:bg-slate-800 sm:rounded-xl shadow-xl w-full ${sizeClasses[size]} max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto sm:mx-4`}>
        <div className="flex items-center justify-between p-4 sm:p-6 border-b dark:border-slate-600 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 text-2xl leading-none p-2 -m-2"
          >
            &times;
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
