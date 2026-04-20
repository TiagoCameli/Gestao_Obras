import { useState, useEffect, useRef } from 'react';

interface FilterComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}

export default function FilterCombobox({
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: FilterComboboxProps) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selecionado = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtrados = options.filter((o) =>
    o.label.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        className={
          'w-full h-[38px] rounded-lg px-3 py-2 pr-8 text-sm ' +
          'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'border border-[var(--color-border)] ' +
          'placeholder:text-[var(--color-fg-subtle)] ' +
          'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]'
        }
        placeholder={placeholder}
        value={aberto ? busca : (selecionado?.label ?? '')}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); setBusca(''); }}
        autoComplete="off"
      />
      {value && !aberto && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] text-xs w-5 h-5 rounded hover:bg-[var(--color-surface-2)] flex items-center justify-center"
          onClick={() => { onChange(''); setBusca(''); }}
          title="Limpar"
        >
          ✕
        </button>
      )}
      {aberto && (
        <ul
          className={
            'absolute z-50 w-full mt-1 max-h-56 overflow-auto ' +
            'bg-[var(--color-surface-1)] border border-[var(--color-border)] ' +
            'rounded-lg shadow-[var(--shadow-lg)] py-1'
          }
        >
          <li
            className={
              'px-3 py-2 text-sm cursor-pointer rounded-md mx-1 ' +
              'hover:bg-[var(--color-surface-2)] ' +
              (!value
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-medium'
                : 'text-[var(--color-fg-subtle)]')
            }
            onMouseDown={() => { onChange(''); setAberto(false); setBusca(''); }}
          >
            {placeholder}
          </li>
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--color-fg-subtle)]">Nenhum resultado</li>
          ) : (
            filtrados.map((o) => (
              <li
                key={o.value}
                className={
                  'px-3 py-2 text-sm cursor-pointer rounded-md mx-1 ' +
                  'hover:bg-[var(--color-surface-2)] ' +
                  (o.value === value
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-medium'
                    : 'text-[var(--color-fg)]')
                }
                onMouseDown={() => { onChange(o.value); setAberto(false); setBusca(''); }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
