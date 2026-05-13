import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { formatCPF, formatTelefone } from '../../utils/formatters';
import { formatCNPJ } from './utils';
import type { FieldConfig } from './types';

interface FieldRendererProps<T> {
  field: FieldConfig<T>;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

export default function FieldRenderer<T>({
  field,
  value,
  onChange,
  error,
}: FieldRendererProps<T>) {
  const id = `f-${field.key}`;

  if (field.type === 'select') {
    const options =
      field.useOptions
        ? field.useOptions()
        : field.staticOptions ?? [];
    return (
      <Select
        id={id}
        label={field.label}
        required={field.required}
        options={options}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        error={error}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label
          htmlFor={id}
          className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
        >
          {field.label}
          {field.required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
        </label>
        <textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className={
            'w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
            'border border-[var(--color-border)] placeholder:text-[var(--color-fg-subtle)] ' +
            'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] ' +
            (error ? 'border-[var(--color-danger)] ' : '')
          }
        />
        {error && <p className="text-[var(--color-danger)] text-xs mt-1">{error}</p>}
        {field.helpText && !error && (
          <p className="text-[var(--color-fg-subtle)] text-xs mt-1">{field.helpText}</p>
        )}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label
        htmlFor={id}
        className="inline-flex items-center gap-2 cursor-pointer select-none mt-6"
      >
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-[var(--color-accent)]"
        />
        <span className="text-sm text-[var(--color-fg)]">{field.label}</span>
      </label>
    );
  }

  // Mask handlers for special text fields
  let inputType = 'text';
  let inputMode: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' = 'text';
  let formatter: ((raw: string) => string) | undefined = field.format;
  let step: string | undefined;

  if (field.type === 'number' || field.type === 'currency') {
    inputType = 'number';
    inputMode = 'decimal';
    step = field.type === 'currency' ? '0.01' : 'any';
  } else if (field.type === 'date') {
    inputType = 'date';
  } else if (field.type === 'email') {
    inputType = 'email';
    inputMode = 'email';
  } else if (field.type === 'tel') {
    inputType = 'tel';
    inputMode = 'tel';
    formatter = formatter ?? formatTelefone;
  } else if (field.type === 'cpf') {
    inputMode = 'numeric';
    formatter = formatter ?? formatCPF;
  } else if (field.type === 'cnpj') {
    inputMode = 'numeric';
    formatter = formatter ?? formatCNPJ;
  }

  const stringValue =
    field.type === 'number' || field.type === 'currency'
      ? value === '' || value === undefined || value === null
        ? ''
        : String(value)
      : (value as string) ?? '';

  const datalistId = field.suggestions && field.suggestions.length > 0
    ? `${id}-suggestions`
    : undefined;

  return (
    <>
      <Input
        id={id}
        label={field.label}
        type={inputType}
        inputMode={inputMode}
        step={step}
        required={field.required}
        placeholder={field.placeholder}
        value={stringValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === 'number' || field.type === 'currency') {
            onChange(raw === '' ? '' : Number(raw));
          } else {
            onChange(formatter ? formatter(raw) : raw);
          }
        }}
        error={error}
        list={datalistId}
      />
      {datalistId && (
        <datalist id={datalistId}>
          {field.suggestions!.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      )}
    </>
  );
}
