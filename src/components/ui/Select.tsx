import type { SelectHTMLAttributes } from 'react';
import SmartSelect from './SmartSelect';

interface Option {
  value: string;
  label: string;
}

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** Label opcional. Quando omitido, o Select não renderiza o <label> próprio. */
  label?: string;
  options: Option[];
  placeholder?: string;
  error?: string;
  /** onChange compatível com a API nativa do <select>: recebe e.target.value. */
  onChange?: (e: { target: { value: string; name?: string } }) => void;
}

export default function Select({
  label,
  options,
  placeholder = 'Selecione...',
  error,
  id,
  className: _className, // SmartSelect tem estilo próprio padronizado
  value,
  onChange,
  name,
  disabled,
  required,
  title,
  ...rest
}: SelectProps) {
  void rest; // ignora atributos extras incompatíveis (size, multiple, etc.)
  return (
    <div>
      {label !== undefined && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
        >
          {label}
          {required && (
            <span className="text-[var(--color-danger)] ml-0.5">*</span>
          )}
        </label>
      )}
      <SmartSelect
        id={id}
        name={name}
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={onChange}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        title={title}
        className={
          'w-full h-[42px] rounded-lg px-3 py-2 text-sm text-left ' +
          'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          (error
            ? 'border border-[var(--color-danger)] '
            : 'border border-[var(--color-border)] ') +
          'transition-[border-color,box-shadow] duration-150 ' +
          'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]'
        }
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </SmartSelect>
      {error && (
        <p className="text-[var(--color-danger)] text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
