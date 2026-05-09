// Serializa CombustivelFilterState ↔ URLSearchParams.
//
// Compactação:
//   ?preset=ultimos_30&from=2026-04-01&to=2026-04-30
//   &obras=id1,id2&equips=id1,id2&tipos=id1,id2
//   &forns=Areacre,Posto%20BR&ops=Joao,Maria
//
// Listas vão como CSV. Strings com vírgula NÃO são suportadas (defensivo:
// fornecedores/operadores virgulados ficam truncados — improvável na
// operação, mas se aparecer trato depois).

import type { CombustivelFilterState, ConsumidorMode, PeriodoPreset } from './types';

const PRESETS: PeriodoPreset[] = [
  'hoje',
  'ultimos_7',
  'ultimos_30',
  'mes_atual',
  'mes_anterior',
  'trimestre_atual',
  'ano_atual',
  'custom',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

function endOfMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/** Computa o período concreto a partir de um preset (relativo a hoje). */
export function computePeriodoFromPreset(preset: PeriodoPreset, customFrom?: string, customTo?: string) {
  const today = todayIso();
  switch (preset) {
    case 'hoje':
      return { from: today, to: today };
    case 'ultimos_7':
      return { from: addDays(today, -6), to: today };
    case 'ultimos_30':
      return { from: addDays(today, -29), to: today };
    case 'mes_atual':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'mes_anterior': {
      const d = new Date(today + 'T00:00:00');
      d.setDate(0); // último dia do mês anterior
      const ref = d.toISOString().slice(0, 10);
      return { from: startOfMonth(ref), to: ref };
    }
    case 'trimestre_atual': {
      const d = new Date(today + 'T00:00:00');
      const q = Math.floor(d.getMonth() / 3);
      const start = new Date(d.getFullYear(), q * 3, 1);
      const end = new Date(d.getFullYear(), q * 3 + 3, 0);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      };
    }
    case 'ano_atual': {
      const yyyy = today.slice(0, 4);
      return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31` };
    }
    case 'custom':
      return {
        from: customFrom ?? today,
        to: customTo ?? today,
      };
  }
}

export function defaultFilterState(): CombustivelFilterState {
  return {
    mode: 'proprios',
    preset: 'ultimos_30',
    periodo: computePeriodoFromPreset('ultimos_30'),
    obraIds: [],
    equipamentoIds: [],
    tipoCombustiveis: [],
    fornecedores: [],
    operadores: [],
    transportadoraIds: [],
    placas: [],
    tanqueIds: [],
    tanqueOrigemIds: [],
    tanqueDestinoIds: [],
    apenasSentinel: false,
  };
}

function parseList(s: string | null): string[] {
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function listToParam(arr: string[]): string {
  return arr.join(',');
}

const MODES: ConsumidorMode[] = ['proprios', 'carretas'];

export function fromSearchParams(params: URLSearchParams): CombustivelFilterState {
  const modeRaw = params.get('mode');
  const mode: ConsumidorMode = MODES.includes(modeRaw as ConsumidorMode)
    ? (modeRaw as ConsumidorMode)
    : 'proprios';

  const presetRaw = params.get('preset');
  const preset: PeriodoPreset = (PRESETS.includes(presetRaw as PeriodoPreset)
    ? (presetRaw as PeriodoPreset)
    : 'ultimos_30');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const periodo =
    preset === 'custom' && from && to
      ? { from, to }
      : computePeriodoFromPreset(preset);

  return {
    mode,
    preset,
    periodo,
    obraIds: parseList(params.get('obras')),
    equipamentoIds: parseList(params.get('equips')),
    tipoCombustiveis: parseList(params.get('tipos')),
    fornecedores: parseList(params.get('forns')),
    operadores: parseList(params.get('ops')),
    transportadoraIds: parseList(params.get('transp')),
    placas: parseList(params.get('placas')),
    tanqueIds: parseList(params.get('tanques')),
    tanqueOrigemIds: parseList(params.get('tan_orig')),
    tanqueDestinoIds: parseList(params.get('tan_dest')),
    apenasSentinel: params.get('sentinel') === '1',
  };
}

export function toSearchParams(s: CombustivelFilterState): URLSearchParams {
  const p = new URLSearchParams();
  // Só serializa o que difere do default — URL fica limpa.
  if (s.mode !== 'proprios') p.set('mode', s.mode);
  if (s.preset !== 'ultimos_30') p.set('preset', s.preset);
  if (s.preset === 'custom') {
    p.set('from', s.periodo.from);
    p.set('to', s.periodo.to);
  }
  if (s.obraIds.length) p.set('obras', listToParam(s.obraIds));
  if (s.equipamentoIds.length) p.set('equips', listToParam(s.equipamentoIds));
  if (s.tipoCombustiveis.length) p.set('tipos', listToParam(s.tipoCombustiveis));
  if (s.fornecedores.length) p.set('forns', listToParam(s.fornecedores));
  if (s.operadores.length) p.set('ops', listToParam(s.operadores));
  if (s.transportadoraIds.length) p.set('transp', listToParam(s.transportadoraIds));
  if (s.placas.length) p.set('placas', listToParam(s.placas));
  if (s.tanqueIds.length) p.set('tanques', listToParam(s.tanqueIds));
  if (s.tanqueOrigemIds.length) p.set('tan_orig', listToParam(s.tanqueOrigemIds));
  if (s.tanqueDestinoIds.length) p.set('tan_dest', listToParam(s.tanqueDestinoIds));
  if (s.apenasSentinel) p.set('sentinel', '1');
  return p;
}

/** Verdadeiro quando há ≥1 filtro ativo além dos defaults (mode + período). */
export function hasActiveFilters(s: CombustivelFilterState): boolean {
  return (
    s.preset !== 'ultimos_30' ||
    s.obraIds.length > 0 ||
    s.equipamentoIds.length > 0 ||
    s.tipoCombustiveis.length > 0 ||
    s.fornecedores.length > 0 ||
    s.operadores.length > 0 ||
    s.transportadoraIds.length > 0 ||
    s.placas.length > 0 ||
    s.tanqueIds.length > 0 ||
    s.tanqueOrigemIds.length > 0 ||
    s.tanqueDestinoIds.length > 0 ||
    s.apenasSentinel
  );
}
