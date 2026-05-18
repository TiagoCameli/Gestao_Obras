/**
 * Componentes reutilizáveis de filtros para as listas de Compras.
 *
 * Padrão visual: pills no topo, com indicador de "ativo" quando o valor
 * difere do default. Tudo num grid flex que envolve no mobile.
 *
 * Inclui:
 *  - FilterPill (select dropdown)
 *  - FilterDateRange (de/até em pill)
 *  - FilterValueRange (min/max numérico)
 *  - FilterMultiCheck (multi-select com checkboxes)
 *  - FilterClearButton ("Limpar" quando há filtros ativos)
 *  - useFilterPeriod (helper para filtrar por período)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X, Filter } from 'lucide-react';
import SmartSelect from '../ui/SmartSelect';

// ─────────────── Wrapper / Header ──────────────────────────────────────

export function FiltrosBarra({
  totalAtivos, total, onLimpar, children,
}: {
  totalAtivos: number;
  total: number;
  onLimpar?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] mr-1 shrink-0">
        <Filter className="w-3.5 h-3.5" /> Filtros:
      </div>
      {children}
      {onLimpar && totalAtivos > 0 && (
        <button
          type="button"
          onClick={onLimpar}
          className="inline-flex items-center gap-1 px-2.5 h-8 rounded-md text-xs font-medium text-[var(--color-fg-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <X className="w-3 h-3" /> Limpar ({totalAtivos})
        </button>
      )}
      <span className="ml-auto text-xs text-[var(--color-fg-muted)]">
        {totalAtivos > 0 ? `${total} resultado${total !== 1 ? 's' : ''}` : `${total} total`}
      </span>
    </div>
  );
}

// ─────────────── FilterPill (select) ───────────────────────────────────

export function FilterPill<T extends string>({
  label, value, onChange, options, ativoQuando = (v) => v !== '',
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ativoQuando?: (v: T) => boolean;
}) {
  const ativo = ativoQuando(value);
  return (
    <div className={
      'inline-flex items-center gap-1.5 pl-2.5 pr-1 h-8 rounded-md text-xs font-medium border transition-colors ' +
      (ativo
        ? 'bg-[var(--color-accent)]/10 text-[var(--color-fg)] border-[var(--color-accent)]/30'
        : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]')
    }>
      <span>{label}:</span>
      <SmartSelect
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        wrapperClassName="relative"
        className="bg-transparent border-0 focus:outline-none text-xs font-medium pr-1 max-w-[200px] h-7 flex items-center cursor-pointer"
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </SmartSelect>
    </div>
  );
}

// ─────────────── FilterDateRange ───────────────────────────────────────

export function FilterDateRange({
  label, de, ate, onChange, presets = true,
}: {
  label: string;
  de: string;
  ate: string;
  onChange: (de: string, ate: string) => void;
  presets?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ativo = !!de || !!ate;

  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aberto]);

  const aplicarPreset = (preset: 'mes' | '7d' | '30d' | '90d' | 'ano') => {
    const fim = new Date();
    const inicio = new Date();
    if (preset === 'mes') inicio.setDate(1);
    else if (preset === '7d') inicio.setDate(fim.getDate() - 7);
    else if (preset === '30d') inicio.setDate(fim.getDate() - 30);
    else if (preset === '90d') inicio.setDate(fim.getDate() - 90);
    else if (preset === 'ano') { inicio.setMonth(0); inicio.setDate(1); }
    onChange(inicio.toISOString().slice(0, 10), fim.toISOString().slice(0, 10));
    setAberto(false);
  };

  const labelExibida = de && ate
    ? `${formatarBR(de)} → ${formatarBR(ate)}`
    : de
      ? `desde ${formatarBR(de)}`
      : ate
        ? `até ${formatarBR(ate)}`
        : 'qualquer data';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium border transition-colors ' +
          (ativo
            ? 'bg-[var(--color-accent)]/10 text-[var(--color-fg)] border-[var(--color-accent)]/30'
            : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]')
        }
      >
        <span>{label}:</span>
        <span className="font-medium">{labelExibida}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {aberto && (
        <div className="absolute z-30 top-full left-0 mt-1 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg p-3">
          {presets && (
            <div className="grid grid-cols-2 gap-1 mb-2">
              {[
                { p: 'mes' as const, label: 'Este mês' },
                { p: '7d' as const, label: 'Últimos 7 dias' },
                { p: '30d' as const, label: 'Últimos 30 dias' },
                { p: '90d' as const, label: 'Últimos 90 dias' },
                { p: 'ano' as const, label: 'Este ano' },
              ].map((b) => (
                <button
                  key={b.p}
                  type="button"
                  onClick={() => aplicarPreset(b.p)}
                  className="px-2 py-1.5 text-xs rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-left text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-[var(--color-fg-muted)] uppercase tracking-wide">De</span>
              <input
                type="date"
                value={de}
                onChange={(e) => onChange(e.target.value, ate)}
                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-[var(--color-fg-muted)] uppercase tracking-wide">Até</span>
              <input
                type="date"
                value={ate}
                onChange={(e) => onChange(de, e.target.value)}
                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </label>
          </div>
          <div className="flex justify-between gap-2 pt-2 mt-2 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => { onChange('', ''); setAberto(false); }}
              className="text-xs text-[var(--color-fg-muted)] hover:text-rose-600 transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="px-2 py-1 text-xs rounded bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:opacity-90 transition-opacity"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────── FilterValueRange ──────────────────────────────────────

export function FilterValueRange({
  label, min, max, onChange, prefix = 'R$',
}: {
  label: string;
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
  prefix?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ativo = !!min || !!max;

  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aberto]);

  const labelExibida = min && max
    ? `${prefix} ${min} - ${max}`
    : min
      ? `≥ ${prefix} ${min}`
      : max
        ? `≤ ${prefix} ${max}`
        : 'qualquer valor';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium border transition-colors ' +
          (ativo
            ? 'bg-[var(--color-accent)]/10 text-[var(--color-fg)] border-[var(--color-accent)]/30'
            : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]')
        }
      >
        <span>{label}:</span>
        <span className="font-medium">{labelExibida}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {aberto && (
        <div className="absolute z-30 top-full left-0 mt-1 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-[var(--color-fg-muted)] uppercase tracking-wide">Min</span>
              <input
                type="number" min="0" step="0.01"
                value={min}
                onChange={(e) => onChange(e.target.value, max)}
                placeholder="0"
                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-[var(--color-fg-muted)] uppercase tracking-wide">Max</span>
              <input
                type="number" min="0" step="0.01"
                value={max}
                onChange={(e) => onChange(min, e.target.value)}
                placeholder="∞"
                className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </label>
          </div>
          <div className="flex justify-between gap-2 pt-2 mt-2 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => { onChange('', ''); setAberto(false); }}
              className="text-xs text-[var(--color-fg-muted)] hover:text-rose-600 transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="px-2 py-1 text-xs rounded bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:opacity-90"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────── FilterMultiCheck ──────────────────────────────────────

export function FilterMultiCheck({
  label, selected, onChange, options,
}: {
  label: string;
  selected: string[];
  onChange: (next: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const ativo = selected.length > 0;

  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aberto]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return options.filter((o) => !q || o.label.toLowerCase().includes(q));
  }, [busca, options]);

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const labelExibida = selected.length === 0
    ? 'todos'
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? '1'
      : `${selected.length} selecionados`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium border transition-colors max-w-[240px] ' +
          (ativo
            ? 'bg-[var(--color-accent)]/10 text-[var(--color-fg)] border-[var(--color-accent)]/30'
            : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]')
        }
      >
        <span>{label}:</span>
        <span className="font-medium truncate">{labelExibida}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {aberto && (
        <div className="absolute z-30 top-full left-0 mt-1 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg overflow-hidden">
          {options.length > 6 && (
            <div className="px-2 pt-2">
              <input
                type="text"
                placeholder="Buscar…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto p-1">
            {filtrados.length === 0 ? (
              <div className="text-xs text-[var(--color-fg-subtle)] text-center py-4">
                Nada encontrado
              </div>
            ) : (
              filtrados.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="text-[var(--color-fg)] truncate">{o.label}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-[var(--color-border)] px-2 py-1.5 flex justify-between">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-[var(--color-fg-muted)] hover:text-rose-600"
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-xs text-[var(--color-accent)] font-medium"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────── helper de formatação local ────────────────────────────

function formatarBR(d: string): string {
  if (!d) return '';
  try {
    const [a, m, dd] = d.split('-');
    return `${dd}/${m}/${a.slice(2)}`;
  } catch { return d; }
}
