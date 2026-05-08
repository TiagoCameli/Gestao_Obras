// Painel do filtro de período: presets em coluna + range custom.

import { useState } from 'react';
import type { PeriodoPreset } from './types';
import { computePeriodoFromPreset } from './urlState';
import { fmtPeriodo } from '../shared/formatters';

interface Props {
  preset: PeriodoPreset;
  from: string;
  to: string;
  onApply: (preset: PeriodoPreset, from: string, to: string) => void;
  onClose: () => void;
}

const PRESET_LABEL: Record<PeriodoPreset, string> = {
  hoje: 'Hoje',
  ultimos_7: 'Últimos 7 dias',
  ultimos_30: 'Últimos 30 dias',
  mes_atual: 'Mês atual',
  mes_anterior: 'Mês anterior',
  trimestre_atual: 'Trimestre atual',
  ano_atual: 'Ano atual',
  custom: 'Personalizado',
};

const PRESETS: PeriodoPreset[] = [
  'hoje',
  'ultimos_7',
  'ultimos_30',
  'mes_atual',
  'mes_anterior',
  'trimestre_atual',
  'ano_atual',
];

function diasEntre(from: string, to: string): number {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  return Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
}

export default function PeriodoPanel({ preset, from, to, onApply, onClose }: Props) {
  const [draftPreset, setDraftPreset] = useState<PeriodoPreset>(preset);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  function pickPreset(p: PeriodoPreset) {
    setDraftPreset(p);
    if (p !== 'custom') {
      const r = computePeriodoFromPreset(p);
      setDraftFrom(r.from);
      setDraftTo(r.to);
    }
  }

  function aplicar() {
    onApply(draftPreset, draftFrom, draftTo);
    onClose();
  }

  return (
    <div className="flex">
      {/* Presets */}
      <div className="w-[160px] py-1 border-r border-[var(--color-border)]">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => pickPreset(p)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              draftPreset === p
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-medium'
                : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div className="flex-1 p-3 min-w-[260px]">
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-2">
          Personalizado
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] text-[var(--color-fg-muted)] block mb-1">De</span>
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => {
                setDraftFrom(e.target.value);
                setDraftPreset('custom');
              }}
              className="w-full h-9 px-2.5 text-sm rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-[var(--color-fg-muted)] block mb-1">Até</span>
            <input
              type="date"
              value={draftTo}
              onChange={(e) => {
                setDraftTo(e.target.value);
                setDraftPreset('custom');
              }}
              className="w-full h-9 px-2.5 text-sm rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </label>
        </div>
        <div className="mt-3 text-xs text-[var(--color-fg-muted)]">
          {fmtPeriodo(draftFrom, draftTo)} ·{' '}
          <span className="font-medium text-[var(--color-fg)]">{diasEntre(draftFrom, draftTo)} dias</span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
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
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
