import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

const variants = {
  primary: 'bg-emt-verde text-white hover:bg-emt-verde-escuro transition-colors duration-200',
  secondary: 'border border-emt-verde text-emt-verde dark:text-emerald-400 dark:border-emerald-400 hover:bg-emt-verde-claro bg-transparent transition-colors duration-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 transition-colors duration-200',
  ghost: 'bg-transparent text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-200',
};

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
