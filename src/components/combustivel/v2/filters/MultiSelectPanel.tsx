// Painel de multi-select com busca, pra usar dentro de Popover.
// Aceita opções planas ou agrupadas. Confirma a seleção via "Aplicar"
// (não atualiza filtro a cada toque pra evitar URL refresh excessivo).

import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';

export interface MultiOption {
  id: string;
  label: string;
  /** Opcional: agrupador (ex: "Escavadeira"). Renderiza header sticky. */
  grupo?: string;
  /** Opcional: badge à direita (categoria, código curto). */
  badge?: string;
}

interface Props {
  options: MultiOption[];
  selected: string[];
  onApply: (next: string[]) => void;
  onClose: () => void;
  placeholder?: string;
  emptyMessage?: string;
}

export default function MultiSelectPanel({
  options,
  selected,
  onApply,
  onClose,
  placeholder = 'Buscar...',
  emptyMessage = 'Nenhum item.',
}: Props) {
  const [busca, setBusca] = useState('');
  const [draft, setDraft] = useState<string[]>(selected);

  // Sync quando selected muda externamente (ex: clearAll)
  useEffect(() => setDraft(selected), [selected]);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return options;
    const q = busca.trim().toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.grupo ?? '').toLowerCase().includes(q),
    );
  }, [options, busca]);

  // Agrupa preservando ordem original (se houver `grupo`)
  const groups = useMemo(() => {
    const map = new Map<string, MultiOption[]>();
    for (const opt of filtradas) {
      const k = opt.grupo ?? '';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(opt);
    }
    return Array.from(map.entries()); // [['', [...]], ['Escavadeira', [...]]]
  }, [filtradas]);

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function aplicar() {
    onApply(draft);
    onClose();
  }

  function selecionarTodos() {
    setDraft(filtradas.map((o) => o.id));
  }

  function limpar() {
    setDraft([]);
  }

  return (
    <div className="w-[320px]">
      {/* Busca */}
      <div className="p-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--color-surface-2)]">
          <Search className="w-3.5 h-3.5 text-[var(--color-fg-subtle)]" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)]"
            autoFocus
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Atalhos */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
        <span>{draft.length} de {options.length}</span>
        <div className="flex gap-3">
          <button type="button" onClick={selecionarTodos} className="hover:text-[var(--color-accent)]">
            Selecionar todos
          </button>
          <button type="button" onClick={limpar} className="hover:text-red-600">
            Limpar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="max-h-[280px] overflow-y-auto py-1">
        {filtradas.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-fg-muted)]">{emptyMessage}</div>
        ) : (
          groups.map(([grupo, items]) => (
            <div key={grupo || '_'}>
              {grupo && (
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] bg-[var(--color-surface-2)]/60 sticky top-0">
                  {grupo}
                </div>
              )}
              {items.map((opt) => {
                const ativo = draft.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-surface-2)] transition-colors ${
                      ativo ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        ativo
                          ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                          : 'border-[var(--color-border-strong)]'
                      }`}
                    >
                      {ativo && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)] font-mono">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={aplicar}
          className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] font-medium"
        >
          Aplicar ({draft.length})
        </button>
      </div>
    </div>
  );
}
