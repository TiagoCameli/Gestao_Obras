import { X, Search, SlidersHorizontal } from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import FilterCombobox from '../ui/FilterCombobox';

export interface FilterField {
  /** Chave canônica — usada no `activeChips` pra mostrar "Remover X". */
  key: string;
  /** Label curto pra exibir no chip ativo. */
  label: string;
  /** Valor atual. */
  value: string;
  /** Setter. */
  onChange: (v: string) => void;
  /** Options pra combobox. Se omitido, o campo vira input text/search. */
  options?: { value: string; label: string }[];
  /** Placeholder do combobox/input. */
  placeholder: string;
  /** Se "collapsed", só aparece no "Filtros avançados". */
  collapsed?: boolean;
  /** Tipo do input quando não é combobox. */
  type?: 'text' | 'date';
  /** Ícone opcional. */
  icon?: ReactNode;
}

interface FilterBarProps {
  /** Campo de busca livre (opcional — texto que percorre toda a linha). */
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  fields: FilterField[];
  /** Limpa tudo. */
  onClearAll: () => void;
}

/**
 * Barra de filtros "premium": campo de busca + filtros primários na linha
 * + botão "Avançados" expandindo o restante + chips dos filtros ativos +
 * "Limpar tudo". Usa os tokens do DS unificado — funciona em light e dark.
 */
export default function FilterBar({ search, fields, onClearAll }: FilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const primaryFields = fields.filter((f) => !f.collapsed);
  const advancedFields = fields.filter((f) => f.collapsed);

  const activeFields = useMemo(
    () => fields.filter((f) => f.value),
    [fields]
  );
  const anyActive = Boolean(search?.value) || activeFields.length > 0;

  const renderField = (f: FilterField) => {
    if (f.options) {
      return (
        <FilterCombobox
          key={f.key}
          className="w-48"
          value={f.value}
          onChange={f.onChange}
          options={f.options}
          placeholder={f.placeholder}
        />
      );
    }
    return (
      <input
        key={f.key}
        type={f.type ?? 'text'}
        className="rounded-lg px-3 h-[38px] text-sm w-48 bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        value={f.value}
        onChange={(e) => f.onChange(e.target.value)}
        placeholder={f.placeholder}
        title={f.placeholder}
      />
    );
  };

  return (
    <div className="surface-raised p-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {search && (
          <div className="relative flex-1 min-w-[240px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-fg-subtle)] pointer-events-none" />
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Buscar...'}
              className="w-full h-[38px] pl-9 pr-3 rounded-lg text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
            {search.value && (
              <button
                type="button"
                onClick={() => search.onChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {primaryFields.map(renderField)}

        {advancedFields.length > 0 && (
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 h-[38px] rounded-lg text-sm font-medium border transition-colors ${
              advancedOpen
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[color:color-mix(in_srgb,var(--color-accent)_40%,transparent)]'
                : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]'
            }`}
            title="Mostrar / ocultar filtros avançados"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Avançados
            {advancedFields.some((f) => f.value) && (
              <span className="ml-1 text-[10px] font-bold bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] px-1.5 py-0.5 rounded-full leading-none">
                {advancedFields.filter((f) => f.value).length}
              </span>
            )}
          </button>
        )}

        {anyActive && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Limpar tudo
          </button>
        )}
      </div>

      {advancedOpen && advancedFields.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--color-border)]">
          {advancedFields.map(renderField)}
        </div>
      )}

      {activeFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-fg-subtle)] uppercase tracking-wider font-semibold mr-1">
            Filtros ativos
          </span>
          {activeFields.map((f) => {
            const chipLabel = f.options
              ? f.options.find((o) => o.value === f.value)?.label ?? f.value
              : f.value;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => f.onChange('')}
                className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border border-[color:color-mix(in_srgb,var(--color-accent)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--color-accent)_22%,transparent)] transition-colors"
                title={`Remover filtro ${f.label}`}
              >
                <span className="text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent-fg)]">
                  {f.label}:
                </span>
                <span className="max-w-[120px] truncate">{chipLabel}</span>
                <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
