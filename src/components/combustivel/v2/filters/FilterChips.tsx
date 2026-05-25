// Chips removíveis dos filtros ativos. Renderizam abaixo da barra
// principal e refletem estado atual do FilterContext.

import { X } from 'lucide-react';
import { useCombustivelFilter, type ChipKind } from './FilterContext';
import { fmtPeriodo } from '../shared/formatters';

interface Props {
  /** Maps id→label pra resolver chips de FK soft (obras, equipamentos, tipos, transportadoras, tanques). */
  obrasMap: Map<string, string>;
  equipamentosMap: Map<string, string>;
  insumosMap: Map<string, string>;
  transportadorasMap: Map<string, string>;
  /** Tanques — opcional, só aparece chip quando aba=Transferências usar esses filtros. */
  tanquesMap?: Map<string, string>;
}

interface Chip {
  kind: ChipKind;
  value: string;
  label: string;
}

export default function FilterChips({ obrasMap, equipamentosMap, insumosMap, transportadorasMap, tanquesMap }: Props) {
  const { state, removeFilter, clearAll, hasActive } = useCombustivelFilter();

  if (!hasActive) return null;

  const chips: Chip[] = [];
  const labelOperador = state.mode === 'carretas' ? 'Motorista' : 'Operador';

  if (state.preset !== 'ultimos_30') {
    chips.push({
      kind: 'periodo',
      value: '',
      label: `Período: ${fmtPeriodo(state.periodo.from, state.periodo.to)}`,
    });
  }
  for (const id of state.obraIds) {
    chips.push({ kind: 'obra', value: id, label: `Obra: ${obrasMap.get(id) ?? id}` });
  }
  for (const id of state.equipamentoIds) {
    chips.push({ kind: 'equipamento', value: id, label: `Equip: ${equipamentosMap.get(id) ?? id}` });
  }
  for (const id of state.transportadoraIds) {
    chips.push({ kind: 'transportadora', value: id, label: `Transp: ${transportadorasMap.get(id) ?? id}` });
  }
  for (const v of state.placas) {
    chips.push({ kind: 'placa', value: v, label: `Placa: ${v}` });
  }
  for (const id of state.tipoCombustiveis) {
    chips.push({ kind: 'tipo', value: id, label: `Combustível: ${insumosMap.get(id) ?? id}` });
  }
  for (const v of state.fornecedores) {
    chips.push({ kind: 'fornecedor', value: v, label: `Fornecedor: ${v}` });
  }
  for (const v of state.operadores) {
    chips.push({ kind: 'operador', value: v, label: `${labelOperador}: ${v}` });
  }
  for (const id of state.tanqueIds) {
    chips.push({ kind: 'tanque', value: id, label: `Tanque: ${tanquesMap?.get(id) ?? id}` });
  }
  for (const id of state.tanqueOrigemIds) {
    chips.push({ kind: 'tanque_origem', value: id, label: `Tanque origem: ${tanquesMap?.get(id) ?? id}` });
  }
  for (const id of state.tanqueDestinoIds) {
    chips.push({ kind: 'tanque_destino', value: id, label: `Tanque destino: ${tanquesMap?.get(id) ?? id}` });
  }
  if (state.apenasSentinel) {
    chips.push({ kind: 'sentinel', value: '', label: 'Apenas sem equipamento' });
  }
  if (state.saidasView !== 'todas') {
    const labelView = state.saidasView === 'internas' ? 'Internas' : 'Externas';
    chips.push({ kind: 'saidas_view', value: '', label: `Saídas: ${labelView}` });
  }
  for (const o of state.origensExterna) {
    const labelOrigem = o === 'dinheiro' ? 'Dinheiro' : o === 'requisicao' ? 'Requisição' : 'Tanque Externo';
    chips.push({ kind: 'origem_externa', value: o, label: `Origem: ${labelOrigem}` });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]">
      {chips.map((c) => (
        <button
          key={`${c.kind}-${c.value}`}
          type="button"
          onClick={() => removeFilter(c.kind, c.value)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent-soft)]/80 transition-colors"
        >
          <span className="max-w-[260px] truncate">{c.label}</span>
          <X className="w-3 h-3" strokeWidth={2.5} />
        </button>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="ml-1 text-[11px] text-[var(--color-fg-muted)] hover:text-red-600 underline"
      >
        Limpar tudo
      </button>
    </div>
  );
}
