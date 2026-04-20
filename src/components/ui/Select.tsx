import type { SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export default function Select({
  label,
  options,
  placeholder = 'Selecione...',
  error,
  id,
  ...props
}: SelectProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
      >
        {label}
        {props.required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
      </label>
      <select
        id={id}
        className={
          'w-full h-[42px] rounded-lg px-3 py-2 text-sm ' +
          'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'border border-[var(--color-border)] ' +
          'transition-[border-color,box-shadow] duration-150 ' +
          'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] ' +
          (error ? 'border-[var(--color-danger)]' : '')
        }
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[var(--color-danger)] text-xs mt-1">{error}</p>}
    </div>
  );
}
