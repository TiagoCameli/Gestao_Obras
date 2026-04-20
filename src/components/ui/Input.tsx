import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function Input({ label, error, id, className = '', ...props }: InputProps) {
  const base =
    'w-full h-[42px] rounded-lg px-3 py-2 text-sm ' +
    'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
    'border border-[var(--color-border)] ' +
    'placeholder:text-[var(--color-fg-subtle)] ' +
    'transition-[border-color,box-shadow] duration-150 ' +
    'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]';
  const errorCls = error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : '';
  const readOnlyCls = props.readOnly
    ? 'bg-[var(--color-surface-2)] cursor-not-allowed opacity-90'
    : '';

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
      >
        {label}
        {props.required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
      </label>
      <input
        id={id}
        className={`${base} ${errorCls} ${readOnlyCls} ${className}`}
        {...props}
      />
      {error && <p className="text-[var(--color-danger)] text-xs mt-1">{error}</p>}
    </div>
  );
}
