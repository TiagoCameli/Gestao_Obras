/**
 * SmartSelect — Drop-in replacement do <select> nativo com busca por texto.
 *
 * Mantém a mesma API do <select> (children <option>, value, onChange com
 * e.target.value) para que a substituição em formulários existentes seja
 * apenas trocar a tag.
 *
 * Exemplo:
 *   <SmartSelect value={obraId} onChange={(e) => setObraId(e.target.value)}>
 *     <option value="">— selecione —</option>
 *     {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
 *   </SmartSelect>
 */
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type OptionItem = { value: string; label: string; disabled?: boolean };

type SyntheticChange = { target: { value: string; name?: string } };

interface SmartSelectProps {
  value?: string | number;
  onChange?: (e: SyntheticChange) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  /** Classes aplicadas ao botão (substitui o estilo padrão se fornecido). */
  className?: string;
  /** Classes aplicadas no wrapper externo (default: 'relative inline-block w-full'). */
  wrapperClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Texto exibido quando nenhum item está selecionado e não há option com value="". */
  placeholder?: string;
  /** Mostrar a busca somente quando houver pelo menos N opções (default: 6 — listas curtas não precisam de busca). */
  searchThreshold?: number;
  /** Título HTML (tooltip) propagado para o botão. */
  title?: string;
  /** Para uso em testes ou refs externas. */
  'aria-label'?: string;
  /** Sinaliza ao SR que o valor é inválido (ex: erro de validação). */
  'aria-invalid'?: boolean;
  /** Vincula o botão a um elemento descritor (ex: id do <p> de erro). */
  'aria-describedby'?: string;
  /**
   * Renderiza o popup via React Portal (position: fixed) — evita clipping
   * quando o componente está dentro de containers com `overflow: hidden`,
   * como células de tabelas. Default: false.
   */
  usePortal?: boolean;
}

/** Extrai recursivamente os <option> filhos (suporta Fragments, arrays e map). */
function collectOptions(nodes: ReactNode, out: OptionItem[] = []): OptionItem[] {
  Children.forEach(nodes, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return;
    if (Array.isArray(child)) {
      collectOptions(child as ReactNode, out);
      return;
    }
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>;
    if (el.type === Fragment) {
      collectOptions(el.props.children, out);
      return;
    }
    if (el.type === 'option') {
      const value = el.props.value === undefined ? '' : String(el.props.value);
      const label = nodeToText(el.props.children);
      out.push({ value, label, disabled: !!el.props.disabled });
    }
  });
  return out;
}

function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    return nodeToText(el.props.children);
  }
  return '';
}

const DEFAULT_BTN_CLASS =
  'w-full h-[42px] rounded-lg px-3 py-2 text-sm text-left ' +
  'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
  'border border-[var(--color-border)] ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]';

export default function SmartSelect({
  value,
  onChange,
  name,
  id,
  disabled,
  required: _required,
  className,
  wrapperClassName,
  style,
  children,
  placeholder = '— selecione —',
  searchThreshold = 6,
  title,
  usePortal = false,
  ...rest
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0, left: 0, width: 0,
  });

  const allOptions = useMemo(() => collectOptions(children), [children]);

  // Trata o option com value="" como placeholder (não aparece na lista nem na busca)
  const placeholderOpt = allOptions.find((o) => o.value === '');
  const realOptions = useMemo(
    () => allOptions.filter((o) => o.value !== ''),
    [allOptions],
  );
  const placeholderLabel = placeholderOpt?.label || placeholder;

  const valueStr = value === undefined || value === null ? '' : String(value);
  const selected = allOptions.find((o) => o.value === valueStr);

  const showSearch = realOptions.length >= searchThreshold;

  const filtered = useMemo(() => {
    if (!search) return realOptions;
    const q = search.trim().toLowerCase();
    if (!q) return realOptions;
    return realOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [realOptions, search]);

  // Fecha ao clicar fora (também leva em conta popup em portal)
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const insideWrap = wrapRef.current?.contains(target);
      const insidePopup = usePortal
        ? !!document.querySelector('[data-smartselect-popup="true"]')?.contains(target)
        : false;
      if (!insideWrap && !insidePopup) {
        setOpen(false);
        setSearch('');
        setHi(-1);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [usePortal]);

  // Quando usar portal: reposiciona em open/scroll/resize
  useLayoutEffect(() => {
    if (!open || !usePortal || !btnRef.current) return;
    function reposicionar() {
      const rect = btnRef.current!.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 200),
      });
    }
    reposicionar();
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    return () => {
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
    };
  }, [open, usePortal]);

  // Foca a busca ao abrir
  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  // Mantém o item destacado visível na rolagem
  useEffect(() => {
    if (!open || hi < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  function commit(opt: OptionItem | undefined) {
    if (!opt || opt.disabled) return;
    onChange?.({ target: { value: opt.value, name } });
    setOpen(false);
    setSearch('');
    setHi(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Escape') {
      // Se o popup está aberto, fecha só ele e impede que o modal/parent
      // capture o Escape e feche também.
      if (open) {
        e.preventDefault();
        e.stopPropagation();
      }
      setOpen(false);
      setSearch('');
      setHi(-1);
      return;
    }
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setHi(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hi >= 0 && hi < filtered.length) commit(filtered[hi]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHi(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHi(filtered.length - 1);
    }
  }

  const btnClassName = className || DEFAULT_BTN_CLASS;
  const isPlaceholder = !selected || selected.value === '';
  const displayText = isPlaceholder ? placeholderLabel : selected!.label;

  return (
    <div
      ref={wrapRef}
      className={wrapperClassName ?? 'relative inline-block w-full'}
      style={style}
      onKeyDown={handleKeyDown}
      data-smart-select={name || id || ''}
    >
      <button
        ref={btnRef}
        type="button"
        id={id}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        aria-invalid={rest['aria-invalid']}
        aria-describedby={rest['aria-describedby']}
        disabled={disabled}
        className={`${btnClassName} flex items-center justify-between gap-2 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setSearch('');
          // Posiciona destaque no item atualmente selecionado, se houver
          const idx = filtered.findIndex((o) => o.value === valueStr);
          setHi(idx >= 0 ? idx : 0);
        }}
      >
        <span
          className={`truncate ${isPlaceholder ? 'text-[var(--color-fg-subtle)]' : ''}`}
        >
          {displayText}
        </span>
        <svg
          className="w-4 h-4 shrink-0 opacity-70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            d="M19 9l-7 7-7-7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && !disabled && (() => {
        const popupClassBase =
          'bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg,0_8px_24px_rgba(0,0,0,0.18))] overflow-hidden';
        const popupContent = (
          <>
            {showSearch && (
              <div className="p-2 border-b border-[var(--color-border)]">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHi(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            )}
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-72 overflow-auto py-1"
            >
              {placeholderOpt && !search && (
                <li
                  role="option"
                  aria-selected={valueStr === ''}
                  data-idx="-1"
                  className={
                    'px-3 py-2 text-sm cursor-pointer mx-1 rounded-md ' +
                    (valueStr === ''
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-medium'
                      : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-2)]')
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(placeholderOpt);
                  }}
                >
                  {placeholderOpt.label}
                </li>
              )}
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--color-fg-subtle)] italic">
                  Nenhum resultado
                </li>
              ) : (
                filtered.map((o, idx) => (
                  <li
                    key={`${o.value}-${idx}`}
                    role="option"
                    aria-selected={o.value === valueStr}
                    aria-disabled={o.disabled || undefined}
                    data-idx={idx}
                    className={
                      'px-3 py-2 text-sm mx-1 rounded-md truncate ' +
                      (o.disabled
                        ? 'text-[var(--color-fg-subtle)] cursor-not-allowed opacity-60 '
                        : 'cursor-pointer hover:bg-[var(--color-surface-2)] ') +
                      (idx === hi && !o.disabled
                        ? 'bg-[var(--color-surface-2)] '
                        : '') +
                      (o.value === valueStr
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-medium'
                        : 'text-[var(--color-fg)]')
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(o);
                    }}
                    onMouseEnter={() => !o.disabled && setHi(idx)}
                  >
                    {o.label}
                  </li>
                ))
              )}
            </ul>
          </>
        );

        if (usePortal) {
          return createPortal(
            <div
              data-smartselect-popup="true"
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
              className={`z-[200] ${popupClassBase}`}
              onKeyDown={handleKeyDown}
            >
              {popupContent}
            </div>,
            document.body
          );
        }

        return (
          <div className={`absolute z-50 mt-1 left-0 right-0 ${popupClassBase}`}>
            {popupContent}
          </div>
        );
      })()}
    </div>
  );
}
