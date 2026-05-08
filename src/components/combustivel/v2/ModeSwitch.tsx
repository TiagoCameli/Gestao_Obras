// Segmented control prominente de mode de consumidor.
// Posicionado acima das tabs — separa "dois mundos" da operação:
// equipamento próprio vs carreta terceirizada. Lê/escreve do FilterContext.

import { Truck, Wrench } from 'lucide-react';
import type { ConsumidorMode } from './filters/types';
import { useCombustivelFilter } from './filters/FilterContext';

const MODES: { id: ConsumidorMode; label: string; Icon: typeof Wrench }[] = [
  { id: 'proprios', label: 'Equipamentos Próprios', Icon: Wrench },
  { id: 'carretas', label: 'Carretas Terceirizadas', Icon: Truck },
];

export default function ModeSwitch() {
  const { state, setMode } = useCombustivelFilter();
  const current = state.mode;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] font-semibold px-1">
        Modo de consumidor
      </div>
      <div
        role="tablist"
        aria-label="Modo de consumidor de combustível"
        className="relative inline-flex self-start items-stretch rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1 w-full sm:w-auto"
      >
        {MODES.map(({ id, label, Icon }) => {
          const ativo = current === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={ativo}
              type="button"
              onClick={() => setMode(id)}
              className={`relative z-10 flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ease-out whitespace-nowrap ${
                ativo
                  ? 'bg-[var(--color-accent)] text-white shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
