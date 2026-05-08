// Popover de visões salvas — listar, aplicar, salvar nova, remover.

import { useState } from 'react';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import type { CombustivelFilterState, SavedView } from './types';
import { addSavedView, removeSavedView } from './savedViews';

interface Props {
  views: SavedView[];
  currentFilters: CombustivelFilterState;
  onApplyView: (s: CombustivelFilterState) => void;
  onChange: (views: SavedView[]) => void;
  onClose: () => void;
}

export default function SavedViewsPopover({
  views,
  currentFilters,
  onApplyView,
  onChange,
  onClose,
}: Props) {
  const [savingNew, setSavingNew] = useState(false);
  const [nome, setNome] = useState('');

  function salvar() {
    if (!nome.trim()) return;
    const novas = addSavedView(nome, currentFilters);
    onChange(novas);
    setSavingNew(false);
    setNome('');
  }

  function remover(id: string) {
    const novas = removeSavedView(id);
    onChange(novas);
  }

  return (
    <div className="w-[280px]">
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Visões salvas
        </span>
        {!savingNew && (
          <button
            type="button"
            onClick={() => setSavingNew(true)}
            className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Salvar atual
          </button>
        )}
      </div>

      {savingNew && (
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && salvar()}
            placeholder="Ex: Diesel S10 · Lote 9"
            className="w-full h-9 px-2.5 text-sm rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setSavingNew(false); setNome(''); }}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!nome.trim()}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 font-medium"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="max-h-[280px] overflow-y-auto py-1">
        {views.length === 0 && !savingNew ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-fg-muted)]">
            Nenhuma visão salva ainda.
          </div>
        ) : (
          views.map((v) => (
            <div key={v.id} className="group flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-surface-2)]">
              <button
                type="button"
                onClick={() => { onApplyView(v.filtros); onClose(); }}
                className="flex-1 flex items-center gap-2 text-left text-sm text-[var(--color-fg)]"
              >
                <Bookmark className="w-3.5 h-3.5 text-[var(--color-fg-subtle)]" />
                <span className="truncate">{v.nome}</span>
              </button>
              <button
                type="button"
                onClick={() => remover(v.id)}
                className="opacity-0 group-hover:opacity-100 text-[var(--color-fg-subtle)] hover:text-red-600 transition-opacity"
                aria-label="Remover visão"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
