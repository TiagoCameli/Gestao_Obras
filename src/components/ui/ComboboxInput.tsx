/**
 * ComboboxInput — Campo de texto livre com sugestões em dropdown.
 *
 * Diferente do SmartSelect (que aceita só valores da lista), este componente
 * permite que o usuário digite qualquer texto livre. As sugestões aparecem
 * filtradas conforme o usuário digita.
 *
 * Usado para campos como "Condição de pagamento" e "Forma de pagamento" onde
 * existem opções comuns no Brasil mas o usuário pode precisar de algo customizado.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

interface ComboboxInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function ComboboxInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  style,
  id,
  name,
  disabled,
  required,
}: ComboboxInputProps) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [value, suggestions]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHi(-1);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (!open || hi < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  function commit(v: string) {
    onChange(v);
    setOpen(false);
    setHi(-1);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
      }
      setOpen(false);
      setHi(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHi((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (hi >= 0 && hi < filtered.length) {
        e.preventDefault();
        commit(filtered[hi]);
      }
    }
  }

  const baseInputClass =
    className ||
    'w-full h-[42px] rounded-lg px-3 py-2 text-sm ' +
      'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
      'border border-[var(--color-border)] ' +
      'placeholder:text-[var(--color-fg-subtle)] ' +
      'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]';

  return (
    <div ref={wrapRef} className="relative w-full" style={style}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        className={baseInputClass + ' pr-9'}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Fechar sugestões' : 'Abrir sugestões'}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) {
            inputRef.current?.focus();
            setHi(0);
          }
        }}
        disabled={disabled}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] rounded"
      >
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && !disabled && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 left-0 right-0 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg,0_8px_24px_rgba(0,0,0,0.12))] max-h-56 overflow-auto py-1"
        >
          {filtered.map((s, idx) => (
            <li
              key={`${s}-${idx}`}
              role="option"
              aria-selected={s === value}
              data-idx={idx}
              className={
                'px-3 py-2 text-sm mx-1 rounded-md cursor-pointer truncate ' +
                (idx === hi ? 'bg-[var(--color-surface-2)] ' : 'hover:bg-[var(--color-surface-2)] ') +
                (s === value ? 'text-[var(--color-accent-fg)] font-medium' : 'text-[var(--color-fg)]')
              }
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
              }}
              onMouseEnter={() => setHi(idx)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
