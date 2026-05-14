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
import { useAuth } from '../../../contexts/AuthContext';

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
  | 'relatorios'
  | 'lixeira';

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

/** Mapeia cada aba para a chave de permissão correspondente. */
const PERM_BY_TAB: Record<CombustivelTabId, string> = {
  visao_geral: 'aba_combustivel_visao_geral',
  saidas: 'aba_combustivel_saidas',
  entradas: 'aba_combustivel_entradas',
  transferencias: 'aba_combustivel_transferencias',
  tanques: 'aba_combustivel_tanques',
  consumidores: 'aba_combustivel_consumidores',
  obras: 'aba_combustivel_obras',
  fornecedores: 'aba_combustivel_fornecedores',
  anomalias: 'aba_combustivel_anomalias',
  relatorios: 'aba_combustivel_relatorios',
  lixeira: 'aba_combustivel_lixeira',
};

function buildGroups(
  consumidoresLabel: string,
  temAcao: (chave: string) => boolean,
): GroupDef[] {
  const filterTabs = (tabs: TabDef[]) => tabs.filter((t) => temAcao(PERM_BY_TAB[t.key]));
  const groups: GroupDef[] = [
    { label: '', tabs: filterTabs([{ key: 'visao_geral', label: 'Visão Geral' }]) },
    {
      label: 'Operacional',
      tabs: filterTabs([
        { key: 'saidas', label: 'Saídas' },
        { key: 'entradas', label: 'Entradas' },
        { key: 'transferencias', label: 'Transferências' },
        { key: 'tanques', label: 'Tanques' },
      ]),
    },
    {
      label: 'Analítico',
      tabs: filterTabs([
        { key: 'consumidores', label: consumidoresLabel },
        { key: 'obras', label: 'Obras' },
        { key: 'fornecedores', label: 'Fornecedores' },
        { key: 'anomalias', label: 'Anomalias' },
      ]),
    },
    { label: '', tabs: filterTabs([{ key: 'relatorios', label: 'Relatórios' }]) },
    { label: '', tabs: filterTabs([{ key: 'lixeira', label: 'Lixeira' }]) },
  ];
  // Filtra grupos sem nenhuma aba permitida (não renderiza header vazio)
  return groups.filter((g) => g.tabs.length > 0);
}

interface Props {
  active: CombustivelTabId;
  onChange: (key: CombustivelTabId) => void;
  /** F10 — quando true, mostra subtab Lixeira no fim do nav. */
  isAdmin?: boolean;
}

export default function CombustivelTabsNav({ active, onChange, isAdmin: _isAdmin = false }: Props) {
  const { state } = useCombustivelFilter();
  const { temAcao } = useAuth();
  const consumidoresLabel = state.mode === 'carretas' ? 'Carretas' : 'Equipamentos';
  const groups = buildGroups(consumidoresLabel, temAcao);
  void _isAdmin; // mantido por compatibilidade — gating agora é via temAcao('aba_combustivel_lixeira')
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
