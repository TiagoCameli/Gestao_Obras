import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StatusEquipamento } from '../../types';
import { STATUS_EQUIPAMENTO_LABEL } from '../../types';
import { Check, ChevronDown } from 'lucide-react';

export interface StatusOption {
  value: StatusEquipamento;
  bg: string;
  fg: string;
  border: string;
  dot: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'ativa',
    bg: 'var(--color-success-soft)',
    fg: 'var(--color-success-fg)',
    border: 'var(--color-success)',
    dot: 'var(--color-success)',
  },
  {
    value: 'manutencao_preventiva',
    bg: 'var(--color-warning-soft)',
    fg: 'var(--color-warning-fg)',
    border: 'var(--color-warning)',
    dot: 'var(--color-warning)',
  },
  {
    value: 'manutencao_corretiva',
    bg: 'var(--color-danger-soft)',
    fg: 'var(--color-danger-fg)',
    border: 'var(--color-danger)',
    dot: 'var(--color-danger)',
  },
  {
    value: 'fora_funcionamento',
    bg: 'var(--color-surface-2)',
    fg: 'var(--color-fg-muted)',
    border: 'var(--color-border-strong)',
    dot: 'var(--color-fg-subtle)',
  },
];

export function getStatusOption(s: StatusEquipamento): StatusOption {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? STATUS_OPTIONS[0];
}

interface Props {
  value: StatusEquipamento;
  onChange: (v: StatusEquipamento) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const MENU_WIDTH = 240;
const MENU_GAP = 6;

export default function StatusDropdown({ value, onChange, disabled, size = 'sm', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'bottom' | 'top' }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });
  const opt = getStatusOption(value);

  // Posiciona o menu via getBoundingClientRect do botão (position fixed)
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    function place() {
      const rect = buttonRef.current!.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < menuHeight + MENU_GAP + 8;
      const top = placeAbove ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP;
      // Alinha à direita do botão; clamp dentro da viewport
      let left = rect.right - MENU_WIDTH;
      if (left < 8) left = 8;
      if (left + MENU_WIDTH > window.innerWidth - 8) left = window.innerWidth - MENU_WIDTH - 8;
      setCoords({ top, left, placement: placeAbove ? 'top' : 'bottom' });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <div className={'inline-block ' + className}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          'inline-flex items-center gap-1.5 rounded-full font-medium border transition-all ' +
          padding +
          ' ' +
          (disabled ? 'cursor-not-allowed opacity-60 ' : 'hover:brightness-110 cursor-pointer ')
        }
        style={{
          backgroundColor: opt.bg,
          color: opt.fg,
          borderColor: `color-mix(in srgb, ${opt.border} 30%, transparent)`,
        }}
      >
        <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: opt.dot }} />
        <span className="truncate">{STATUS_EQUIPAMENTO_LABEL[value]}</span>
        {!disabled && <ChevronDown aria-hidden className="w-3 h-3 shrink-0 opacity-70" />}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              zIndex: 9999,
            }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-lg)] py-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {STATUS_OPTIONS.map((o) => {
              const ativo = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={ativo}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ' +
                    (ativo ? 'bg-[var(--color-surface-2)]' : 'hover:bg-[var(--color-surface-2)]')
                  }
                >
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: o.dot }}
                  />
                  <span className="flex-1 text-[var(--color-fg)]">
                    {STATUS_EQUIPAMENTO_LABEL[o.value]}
                  </span>
                  {ativo && <Check aria-hidden className="w-4 h-4 text-[var(--color-accent-fg)]" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
