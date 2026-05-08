// FornecedoresTab — aba analítica F2.D.
// Mode-agnostic: entradas não têm tipoConsumidor, então a aba não filtra
// por mode (mas continua visível em ambos pra coerência de navegação).
//
// Pós F2.D.0 a coluna entradas_combustivel.fornecedor está 100%
// normalizada como nome textual; sem banner UUID-órfão (bucket D=0).

import { useMemo } from 'react';
import type { EntradaCombustivel } from '../../../../types';
import { useCombustivelFilter } from '../filters/FilterContext';
import KpisRowFornecedores from './KpisRowFornecedores';
import FornecedoresRankingTable from './FornecedoresRankingTable';
import CustoPorFornecedor from '../visao-geral/charts/CustoPorFornecedor';
import EmptyState from '../shared/EmptyState';

interface Props {
  entradas: EntradaCombustivel[];
}

function isInRange(iso: string, from: string, to: string): boolean {
  const dia = iso.slice(0, 10);
  return dia >= from && dia <= to;
}

function shiftBackPeriodo(from: string, to: string): { from: string; to: string } {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  const dur = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
  const newTo = new Date(f);
  newTo.setDate(newTo.getDate() - 1);
  const newFrom = new Date(newTo);
  newFrom.setDate(newFrom.getDate() - (dur - 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(newFrom), to: fmt(newTo) };
}

export default function FornecedoresTab({ entradas }: Props) {
  const { state } = useCombustivelFilter();

  // Filtros aplicáveis: período + tipoCombustiveis + fornecedores.
  // Mode/obra/equipamento/transp/placa/operador/sentinel não fazem
  // sentido em entradas (entradas não têm consumidor nem obra direta).
  const entradasFiltradas = useMemo(() => {
    const tipoSet = new Set(state.tipoCombustiveis);
    const fornSet = new Set(state.fornecedores.map((f) => f.toLowerCase()));
    return entradas.filter((e) => {
      if (!isInRange(e.dataHora, state.periodo.from, state.periodo.to)) return false;
      if (tipoSet.size > 0 && (!e.tipoCombustivel || !tipoSet.has(e.tipoCombustivel))) return false;
      if (fornSet.size > 0 && !fornSet.has((e.fornecedor || '').trim().toLowerCase())) return false;
      return true;
    });
  }, [entradas, state.periodo.from, state.periodo.to, state.tipoCombustiveis, state.fornecedores]);

  const periodoAnterior = useMemo(
    () => shiftBackPeriodo(state.periodo.from, state.periodo.to),
    [state.periodo.from, state.periodo.to],
  );
  const entradasPeriodoAnterior = useMemo(() => {
    const tipoSet = new Set(state.tipoCombustiveis);
    const fornSet = new Set(state.fornecedores.map((f) => f.toLowerCase()));
    return entradas.filter((e) => {
      if (!isInRange(e.dataHora, periodoAnterior.from, periodoAnterior.to)) return false;
      if (tipoSet.size > 0 && (!e.tipoCombustivel || !tipoSet.has(e.tipoCombustivel))) return false;
      if (fornSet.size > 0 && !fornSet.has((e.fornecedor || '').trim().toLowerCase())) return false;
      return true;
    });
  }, [entradas, periodoAnterior, state.tipoCombustiveis, state.fornecedores]);

  if (entradasFiltradas.length === 0) {
    return <EmptyState description="Nenhuma entrada de combustível no período. Ajuste os filtros." />;
  }

  return (
    <div className="space-y-4">
      <KpisRowFornecedores
        entradasNoPeriodo={entradasFiltradas}
        entradasPeriodoAnterior={entradasPeriodoAnterior}
        periodo={state.periodo}
      />

      <CustoPorFornecedor entradasNoPeriodo={entradasFiltradas} />

      <FornecedoresRankingTable
        entradasNoPeriodo={entradasFiltradas}
        periodo={state.periodo}
      />
    </div>
  );
}
