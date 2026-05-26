import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label opcional. Quando omitido, o Input não renderiza o <label> próprio —
   *  útil em forms que usam um <Label> externo (ex: módulo Compras). */
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  // Gera id estável pra ligar erro/label ↔ input via aria. Usa o `id` do
  // caller se passado; senão cria via useId() pra não conflitar entre instances.
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  // Merge aria-describedby do caller com o id do erro (quando há erro).
  const describedBy = [ariaDescribedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ') || undefined;

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
      {label !== undefined && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
        >
          {label}
          {props.required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${base} ${errorCls} ${readOnlyCls} ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-[var(--color-danger)] text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
