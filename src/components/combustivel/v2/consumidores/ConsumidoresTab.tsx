// ConsumidoresTab — aba Equipamentos/Carretas (F2.B.1).
// Mode-aware: rotula "Equipamentos" em proprios, "Carretas" em carretas.
// Reusa TopEquipamentos/TopCarretas da Visão Geral pro top 10 visual.
// Filtragem inline (mesma lógica do ObrasTab — refatora pra shared/
// quando F2.D virar 4º consumer; F2.D ainda só lê entradas).

import { useMemo } from 'react';
import type {
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
  TipoConsumidorSaida,
} from '../../../../types';
import { useCombustivelFilter } from '../filters/FilterContext';
import KpisRowConsumidores from './KpisRowConsumidores';
import ConsumidoresRankingTable from './ConsumidoresRankingTable';
import TopEquipamentos from '../visao-geral/charts/TopEquipamentos';
import TopCarretas from '../visao-geral/charts/TopCarretas';
import EmptyState from '../shared/EmptyState';

interface Props {
  saidas: SaidaCombustivel[];
  obras: Obra[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  /** Click no row sentinel ou em qualquer atalho "atribuir" → liga
   *  apenasSentinel + vai pra Saídas. */
  onAtribuirSentinels: () => void;
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

export default function ConsumidoresTab({
  saidas,
  equipamentos,
  transportadoras,
  onAtribuirSentinels,
}: Props) {
  const { state } = useCombustivelFilter();
  const tipoConsumidorAlvo = TIPO_POR_MODE[state.mode];

  const saidasFiltradas = useMemo(() => {
    const obraSet = new Set(state.obraIds);
    const equipSet = new Set(state.equipamentoIds);
    const tipoSet = new Set(state.tipoCombustiveis);
    const opSet = new Set(state.operadores);
    const transpSet = new Set(state.transportadoraIds);
    const placaSet = new Set(state.placas.map((p) => p.toLowerCase()));
    const tanqueSet = new Set(state.tanqueIds);
    return saidas.filter((s) => {
      if (s.tipoConsumidor !== tipoConsumidorAlvo) return false;
      if (!isInRange(s.data, state.periodo.from, state.periodo.to)) return false;
      if (obraSet.size > 0 && (!s.obraId || !obraSet.has(s.obraId))) return false;
      if (tanqueSet.size > 0 && (!s.tanqueId || !tanqueSet.has(s.tanqueId))) return false;
      if (state.mode === 'proprios') {
        if (state.apenasSentinel) {
          if (s.equipamentoId !== 'desconhecido') return false;
        } else if (equipSet.size > 0) {
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
    const tanqueSet = new Set(state.tanqueIds);
    return saidas.filter((s) => {
      if (s.tipoConsumidor !== tipoConsumidorAlvo) return false;
      if (!isInRange(s.data, periodoAnterior.from, periodoAnterior.to)) return false;
      if (obraSet.size > 0 && (!s.obraId || !obraSet.has(s.obraId))) return false;
      if (tanqueSet.size > 0 && (!s.tanqueId || !tanqueSet.has(s.tanqueId))) return false;
      if (state.mode === 'proprios') {
        if (state.apenasSentinel) {
          if (s.equipamentoId !== 'desconhecido') return false;
        } else if (equipSet.size > 0) {
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

  if (saidasFiltradas.length === 0) {
    return (
      <EmptyState
        description={
          state.mode === 'proprios'
            ? 'Nenhuma saída de equipamento próprio no período. Ajuste os filtros.'
            : 'Nenhuma saída de carreta no período. Ajuste os filtros.'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <KpisRowConsumidores
        mode={state.mode}
        saidasNoPeriodo={saidasFiltradas}
        saidasPeriodoAnterior={saidasPeriodoAnterior}
        equipamentos={equipamentos}
        transportadoras={transportadoras}
        periodo={state.periodo}
      />

      {state.mode === 'proprios' ? (
        <TopEquipamentos
          saidasNoPeriodo={saidasFiltradas}
          equipamentos={equipamentos}
          onAtribuirSentinels={onAtribuirSentinels}
        />
      ) : (
        <TopCarretas saidasNoPeriodo={saidasFiltradas} transportadoras={transportadoras} />
      )}

      <ConsumidoresRankingTable
        mode={state.mode}
        saidasNoPeriodo={saidasFiltradas}
        equipamentos={equipamentos}
        transportadoras={transportadoras}
        periodo={state.periodo}
        onAtribuirSentinels={onAtribuirSentinels}
      />
    </div>
  );
}
