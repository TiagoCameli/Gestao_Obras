// Navegação principal do módulo Combustível (v2).
// 4 grupos visuais: Visão Geral · Operacional · Analítico · Relatórios.
// Grupos com label uppercase muted no topo. Divisores verticais finos
// entre grupos. Em mobile, scroll horizontal com snap.
//
// A aba 'consumidores' é adaptativa: rotula "Equipamentos" em
// mode='proprios' e "Carretas" em mode='carretas'. Lógica analítica é
// idêntica (consumo por consumidor), só a dimensão muda.

import type { ReactNode } from 'react';
import { useCombustivelFilter } from './filters/FilterContext';

export type CombustivelTabId =
  | 'visao_geral'
  | 'saidas'
  | 'entradas'
  | 'transferencias'
  | 'tanques'
  | 'consumidores'
  | 'obras'
  | 'fornecedores'
  | 'anomalias'
  | 'relatorios';

interface TabDef {
  key: CombustivelTabId;
  label: string;
  /** Placeholder "Em breve" — entrega prevista em fase futura. */
  soon?: boolean;
}

interface GroupDef {
  /** Label do grupo (uppercase, 11px). String vazia = sem header. */
  label: string;
  tabs: TabDef[];
}

function buildGroups(consumidoresLabel: string): GroupDef[] {
  return [
    { label: '', tabs: [{ key: 'visao_geral', label: 'Visão Geral' }] },
    {
      label: 'Operacional',
      tabs: [
        { key: 'saidas', label: 'Saídas' },
        { key: 'entradas', label: 'Entradas' },
        { key: 'transferencias', label: 'Transferências' },
        { key: 'tanques', label: 'Tanques' },
      ],
    },
    {
      label: 'Analítico',
      tabs: [
        { key: 'consumidores', label: consumidoresLabel },
        { key: 'obras', label: 'Obras' },
        { key: 'fornecedores', label: 'Fornecedores', soon: true },
        { key: 'anomalias', label: 'Anomalias', soon: true },
      ],
    },
    { label: '', tabs: [{ key: 'relatorios', label: 'Relatórios', soon: true }] },
  ];
}

interface Props {
  active: CombustivelTabId;
  onChange: (key: CombustivelTabId) => void;
}

export default function CombustivelTabsNav({ active, onChange }: Props) {
  const { state } = useCombustivelFilter();
  const consumidoresLabel = state.mode === 'carretas' ? 'Carretas' : 'Equipamentos';
  const groups = buildGroups(consumidoresLabel);
  return (
    <nav
      aria-label="Seções do módulo Combustível"
      className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4"
    >
      <div className="inline-flex items-stretch gap-0 min-w-max snap-x">
        {groups.map((g, gi) => (
          <Group
            key={g.label || `g-${gi}`}
            def={g}
            isFirst={gi === 0}
            active={active}
            onChange={onChange}
          />
        ))}
      </div>
    </nav>
  );
}

function Group({
  def,
  isFirst,
  active,
  onChange,
}: {
  def: GroupDef;
  isFirst: boolean;
  active: CombustivelTabId;
  onChange: (k: CombustivelTabId) => void;
}) {
  return (
    <div className={`flex flex-col ${isFirst ? '' : 'border-l border-[var(--color-border)] ml-2 pl-2'}`}>
      <div className="h-4 text-[10px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] font-semibold px-1">
        {def.label}
      </div>
      <div className="flex items-center gap-0.5 pt-0.5">
        {def.tabs.map((t) => (
          <TabButton
            key={t.key}
            tab={t}
            isActive={active === t.key}
            onClick={() => onChange(t.key)}
          />
        ))}
      </div>
    </div>
  );
}

function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: TabDef;
  isActive: boolean;
  onClick: () => void;
}) {
  const base =
    'snap-start px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5';
  const activeCls = 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]';
  const idleCls = 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]';

  let content: ReactNode = tab.label;
  if (tab.soon) {
    content = (
      <>
        <span>{tab.label}</span>
        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)] font-semibold">
          Em breve
        </span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${isActive ? activeCls : idleCls}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
    </button>
  );
}
