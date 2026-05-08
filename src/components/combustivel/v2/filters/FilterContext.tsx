// Context global do filtro do módulo Combustível.
//
// Sincroniza state ↔ URL via useSearchParams. Hover state pra
// cross-highlight é separado (não vai pra URL — é volátil).

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CombustivelFilterState, ConsumidorMode, CrossHighlight, PeriodoPreset } from './types';
import { computePeriodoFromPreset, defaultFilterState, fromSearchParams, hasActiveFilters, toSearchParams } from './urlState';

interface FilterContextValue {
  state: CombustivelFilterState;
  /** Atualiza o estado completo (substitui — usado por savedViews). */
  setState: (next: CombustivelFilterState) => void;

  /** Switcha o mode (próprios ↔ carretas). Limpa filtros específicos do
   *  mode anterior pra evitar combinações sem sentido (ex: equipamentoIds
   *  selecionado em mode=carretas). */
  setMode: (mode: ConsumidorMode) => void;

  /** Define um preset de período (recalcula from/to automaticamente). */
  setPreset: (preset: PeriodoPreset) => void;
  /** Período custom — força preset='custom'. */
  setPeriodoCustom: (from: string, to: string) => void;

  /** Add/remove valor numa lista (idempotente). */
  toggleObra: (id: string) => void;
  toggleEquipamento: (id: string) => void;
  toggleTipoCombustivel: (id: string) => void;
  toggleFornecedor: (nome: string) => void;
  toggleOperador: (nome: string) => void;
  toggleTransportadora: (id: string) => void;
  togglePlaca: (placa: string) => void;
  toggleTanqueOrigem: (id: string) => void;
  toggleTanqueDestino: (id: string) => void;

  /** Substitui lista inteira (multi-select submete tudo de uma vez). */
  setObraIds: (ids: string[]) => void;
  setEquipamentoIds: (ids: string[]) => void;
  setTipoCombustiveis: (ids: string[]) => void;
  setFornecedores: (nomes: string[]) => void;
  setOperadores: (nomes: string[]) => void;
  setTransportadoraIds: (ids: string[]) => void;
  setPlacas: (placas: string[]) => void;
  setTanqueOrigemIds: (ids: string[]) => void;
  setTanqueDestinoIds: (ids: string[]) => void;
  /** Liga/desliga "apenas sem equipamento identificado". Combina com
   *  outros filtros (intersect). Ignora equipamentoIds quando true. */
  setApenasSentinel: (v: boolean) => void;

  /** Remove um valor específico (clique no chip ✕). */
  removeFilter: (kind: ChipKind, value: string) => void;
  /** Limpa todos os filtros — volta pro default. */
  clearAll: () => void;

  /** True quando há ≥1 filtro além do período default. */
  hasActive: boolean;

  /** Hover state pra cross-highlight (não persiste). */
  hovered: CrossHighlight;
  setHovered: (h: CrossHighlight) => void;
}

export type ChipKind =
  | 'periodo'
  | 'obra'
  | 'equipamento'
  | 'tipo'
  | 'fornecedor'
  | 'operador'
  | 'transportadora'
  | 'placa'
  | 'tanque_origem'
  | 'tanque_destino'
  | 'sentinel';

const Ctx = createContext<FilterContextValue | null>(null);

function toggleInArray(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function CombustivelFilterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [hovered, setHovered] = useState<CrossHighlight>(null);

  const state = useMemo(() => fromSearchParams(searchParams), [searchParams]);

  const apply = useCallback(
    (next: CombustivelFilterState) => {
      setSearchParams(toSearchParams(next), { replace: true });
    },
    [setSearchParams],
  );

  const setState = apply;

  // Switch de mode: limpa filtros específicos do mode anterior pra evitar
  // estado inconsistente (ex: ficar com equipamentoIds=['ESC-01'] depois
  // de ir pra mode=carretas — esses filtros simplesmente não se aplicam).
  const setMode = useCallback(
    (mode: ConsumidorMode) => {
      if (mode === state.mode) return;
      apply({
        ...state,
        mode,
        equipamentoIds: [],
        transportadoraIds: [],
        placas: [],
      });
    },
    [state, apply],
  );

  const setPreset = useCallback(
    (preset: PeriodoPreset) => {
      apply({ ...state, preset, periodo: computePeriodoFromPreset(preset, state.periodo.from, state.periodo.to) });
    },
    [state, apply],
  );

  const setPeriodoCustom = useCallback(
    (from: string, to: string) => {
      apply({ ...state, preset: 'custom', periodo: { from, to } });
    },
    [state, apply],
  );

  const toggleObra = useCallback((id: string) => apply({ ...state, obraIds: toggleInArray(state.obraIds, id) }), [state, apply]);
  const toggleEquipamento = useCallback((id: string) => apply({ ...state, equipamentoIds: toggleInArray(state.equipamentoIds, id) }), [state, apply]);
  const toggleTipoCombustivel = useCallback((id: string) => apply({ ...state, tipoCombustiveis: toggleInArray(state.tipoCombustiveis, id) }), [state, apply]);
  const toggleFornecedor = useCallback((nome: string) => apply({ ...state, fornecedores: toggleInArray(state.fornecedores, nome) }), [state, apply]);
  const toggleOperador = useCallback((nome: string) => apply({ ...state, operadores: toggleInArray(state.operadores, nome) }), [state, apply]);
  const toggleTransportadora = useCallback((id: string) => apply({ ...state, transportadoraIds: toggleInArray(state.transportadoraIds, id) }), [state, apply]);
  const togglePlaca = useCallback((placa: string) => apply({ ...state, placas: toggleInArray(state.placas, placa) }), [state, apply]);
  const toggleTanqueOrigem = useCallback((id: string) => apply({ ...state, tanqueOrigemIds: toggleInArray(state.tanqueOrigemIds, id) }), [state, apply]);
  const toggleTanqueDestino = useCallback((id: string) => apply({ ...state, tanqueDestinoIds: toggleInArray(state.tanqueDestinoIds, id) }), [state, apply]);

  const setObraIds = useCallback((ids: string[]) => apply({ ...state, obraIds: ids }), [state, apply]);
  const setEquipamentoIds = useCallback((ids: string[]) => apply({ ...state, equipamentoIds: ids }), [state, apply]);
  const setTipoCombustiveis = useCallback((ids: string[]) => apply({ ...state, tipoCombustiveis: ids }), [state, apply]);
  const setFornecedores = useCallback((nomes: string[]) => apply({ ...state, fornecedores: nomes }), [state, apply]);
  const setOperadores = useCallback((nomes: string[]) => apply({ ...state, operadores: nomes }), [state, apply]);
  const setTransportadoraIds = useCallback((ids: string[]) => apply({ ...state, transportadoraIds: ids }), [state, apply]);
  const setPlacas = useCallback((placas: string[]) => apply({ ...state, placas: placas }), [state, apply]);
  const setTanqueOrigemIds = useCallback((ids: string[]) => apply({ ...state, tanqueOrigemIds: ids }), [state, apply]);
  const setTanqueDestinoIds = useCallback((ids: string[]) => apply({ ...state, tanqueDestinoIds: ids }), [state, apply]);
  const setApenasSentinel = useCallback((v: boolean) => apply({ ...state, apenasSentinel: v }), [state, apply]);

  const removeFilter = useCallback(
    (kind: ChipKind, value: string) => {
      switch (kind) {
        case 'periodo':
          apply({ ...state, preset: 'ultimos_30', periodo: computePeriodoFromPreset('ultimos_30') });
          break;
        case 'obra':
          apply({ ...state, obraIds: state.obraIds.filter((x) => x !== value) });
          break;
        case 'equipamento':
          apply({ ...state, equipamentoIds: state.equipamentoIds.filter((x) => x !== value) });
          break;
        case 'tipo':
          apply({ ...state, tipoCombustiveis: state.tipoCombustiveis.filter((x) => x !== value) });
          break;
        case 'fornecedor':
          apply({ ...state, fornecedores: state.fornecedores.filter((x) => x !== value) });
          break;
        case 'operador':
          apply({ ...state, operadores: state.operadores.filter((x) => x !== value) });
          break;
        case 'transportadora':
          apply({ ...state, transportadoraIds: state.transportadoraIds.filter((x) => x !== value) });
          break;
        case 'placa':
          apply({ ...state, placas: state.placas.filter((x) => x !== value) });
          break;
        case 'tanque_origem':
          apply({ ...state, tanqueOrigemIds: state.tanqueOrigemIds.filter((x) => x !== value) });
          break;
        case 'tanque_destino':
          apply({ ...state, tanqueDestinoIds: state.tanqueDestinoIds.filter((x) => x !== value) });
          break;
        case 'sentinel':
          apply({ ...state, apenasSentinel: false });
          break;
      }
    },
    [state, apply],
  );

  const clearAll = useCallback(() => apply(defaultFilterState()), [apply]);

  const value: FilterContextValue = useMemo(
    () => ({
      state,
      setState,
      setMode,
      setPreset,
      setPeriodoCustom,
      toggleObra,
      toggleEquipamento,
      toggleTipoCombustivel,
      toggleFornecedor,
      toggleOperador,
      toggleTransportadora,
      togglePlaca,
      toggleTanqueOrigem,
      toggleTanqueDestino,
      setObraIds,
      setEquipamentoIds,
      setTipoCombustiveis,
      setFornecedores,
      setOperadores,
      setTransportadoraIds,
      setPlacas,
      setTanqueOrigemIds,
      setTanqueDestinoIds,
      setApenasSentinel,
      removeFilter,
      clearAll,
      hasActive: hasActiveFilters(state),
      hovered,
      setHovered,
    }),
    [
      state, setState, setMode, setPreset, setPeriodoCustom,
      toggleObra, toggleEquipamento, toggleTipoCombustivel, toggleFornecedor, toggleOperador,
      toggleTransportadora, togglePlaca, toggleTanqueOrigem, toggleTanqueDestino,
      setObraIds, setEquipamentoIds, setTipoCombustiveis, setFornecedores, setOperadores,
      setTransportadoraIds, setPlacas, setTanqueOrigemIds, setTanqueDestinoIds,
      setApenasSentinel,
      removeFilter, clearAll, hovered,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCombustivelFilter(): FilterContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCombustivelFilter precisa estar dentro de <CombustivelFilterProvider>');
  return v;
}
