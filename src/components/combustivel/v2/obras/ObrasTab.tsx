// ObrasTab — primeira aba analítica fora da Visão Geral (F2.C).
// Smoke-test do padrão "nova aba reusa primitivos": KpiCard, ChartCard,
// CustoPorObra, Sparkline, EmptyState, bucketByDia.
//
// Filtragem inline (mesma lógica do VisaoGeralTab). Quando F2.B chegar,
// extrai pra shared/filterApply.ts (3º consumer = momento do helper).

import { useMemo } from 'react';
import type {
  Equipamento,
  Fornecedor,
  Obra,
  SaidaCombustivel,
  TipoConsumidorSaida,
} from '../../../../types';
import { useCombustivelFilter } from '../filters/FilterContext';
import KpisRowObras from './KpisRowObras';
import ObrasRankingTable from './ObrasRankingTable';
import CustoPorObra from '../visao-geral/charts/CustoPorObra';
import EmptyState from '../shared/EmptyState';

interface Props {
  saidas: SaidaCombustivel[];
  obras: Obra[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
}

const TIPO_POR_MODE: Record<'proprios' | 'carretas', TipoConsumidorSaida> = {
  proprios: 'equipamento_proprio',
  carretas: 'carreta_transportadora',
};

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

export default function ObrasTab({ saidas, obras, equipamentos }: Props) {
  const { state } = useCombustivelFilter();
  const tipoConsumidorAlvo = TIPO_POR_MODE[state.mode];

  const saidasFiltradas = useMemo(() => {
    const obraSet = new Set(state.obraIds);
    const equipSet = new Set(state.equipamentoIds);
    const tipoSet = new Set(state.tipoCombustiveis);
    const opSet = new Set(state.operadores);
    const transpSet = new Set(state.transportadoraIds);
    const placaSet = new Set(state.placas.map((p) => p.toLowerCase()));
    return saidas.filter((s) => {
      if (s.tipoConsumidor !== tipoConsumidorAlvo) return false;
      if (!isInRange(s.data, state.periodo.from, state.periodo.to)) return false;
      if (obraSet.size > 0 && (!s.obraId || !obraSet.has(s.obraId))) return false;
      if (state.mode === 'proprios') {
        if (equipSet.size > 0) {
          const eq = s.equipamentoId && s.equipamentoId !== 'desconhecido' ? s.equipamentoId : null;
          if (!eq || !equipSet.has(eq)) return false;
        }
      } else {
        if (transpSet.size > 0 && (!s.transportadoraId || !transpSet.has(s.transportadoraId))) return false;
        if (placaSet.size > 0 && !placaSet.has((s.placa || '').toLowerCase())) return false;
      }
      if (tipoSet.size > 0 && (!s.tipoCombustivel || !tipoSet.has(s.tipoCombustivel))) return false;
      if (opSet.size > 0 && !opSet.has((s.motorista || '').trim())) return false;
      return true;
    });
  }, [saidas, state, tipoConsumidorAlvo]);

  const periodoAnterior = useMemo(
    () => shiftBackPeriodo(state.periodo.from, state.periodo.to),
    [state.periodo.from, state.periodo.to],
  );
  const saidasPeriodoAnterior = useMemo(() => {
    const obraSet = new Set(state.obraIds);
    const equipSet = new Set(state.equipamentoIds);
    const tipoSet = new Set(state.tipoCombustiveis);
    const opSet = new Set(state.operadores);
    const transpSet = new Set(state.transportadoraIds);
    const placaSet = new Set(state.placas.map((p) => p.toLowerCase()));
    return saidas.filter((s) => {
      if (s.tipoConsumidor !== tipoConsumidorAlvo) return false;
      if (!isInRange(s.data, periodoAnterior.from, periodoAnterior.to)) return false;
      if (obraSet.size > 0 && (!s.obraId || !obraSet.has(s.obraId))) return false;
      if (state.mode === 'proprios') {
        if (equipSet.size > 0) {
          const eq = s.equipamentoId && s.equipamentoId !== 'desconhecido' ? s.equipamentoId : null;
          if (!eq || !equipSet.has(eq)) return false;
        }
      } else {
        if (transpSet.size > 0 && (!s.transportadoraId || !transpSet.has(s.transportadoraId))) return false;
        if (placaSet.size > 0 && !placaSet.has((s.placa || '').toLowerCase())) return false;
      }
      if (tipoSet.size > 0 && (!s.tipoCombustivel || !tipoSet.has(s.tipoCombustivel))) return false;
      if (opSet.size > 0 && !opSet.has((s.motorista || '').trim())) return false;
      return true;
    });
  }, [saidas, periodoAnterior, state, tipoConsumidorAlvo]);

  // Obras com saída no período (subset de `obras` pra ranking não pintar
  // obras sem volume).
  const obrasComSaida = useMemo(() => {
    const ids = new Set(saidasFiltradas.map((s) => s.obraId).filter((id): id is string => Boolean(id)));
    return obras.filter((o) => ids.has(o.id));
  }, [saidasFiltradas, obras]);

  return (
    <div className="space-y-4">
      <KpisRowObras
        saidasNoPeriodo={saidasFiltradas}
        saidasPeriodoAnterior={saidasPeriodoAnterior}
        obras={obras}
        periodo={state.periodo}
      />

      <CustoPorObra saidasNoPeriodo={saidasFiltradas} obras={obras} />

      {obrasComSaida.length > 0 ? (
        <ObrasRankingTable
          saidasNoPeriodo={saidasFiltradas}
          obras={obrasComSaida}
          equipamentos={equipamentos}
          periodo={state.periodo}
        />
      ) : (
        <EmptyState description="Nenhuma obra com saída no período. Ajuste filtros ou amplie o range." />
      )}
    </div>
  );
}
