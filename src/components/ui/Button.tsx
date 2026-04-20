import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed select-none ' +
  'focus-visible:outline-none';

const sizes = {
  sm: 'px-3 py-1.5 text-xs min-h-[34px]',
  md: 'px-4 py-2.5 text-sm min-h-[40px]',
};

const variants = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] ' +
    'border border-transparent ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),var(--shadow-xs)] ' +
    'hover:bg-[var(--color-accent-hover)] active:translate-y-px',
  secondary:
    'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
    'border border-[var(--color-border)] ' +
    'hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
  danger:
    'bg-[var(--color-danger)] text-white border border-transparent ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),var(--shadow-xs)] ' +
    'hover:brightness-110 active:translate-y-px',
  ghost:
    'bg-transparent text-[var(--color-fg-muted)] border border-transparent ' +
    'hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
