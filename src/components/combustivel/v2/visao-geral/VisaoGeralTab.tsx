// VisaoGeralTab — orquestrador da aba "Visão Geral".
// Aplica filtros globais às listas brutas e distribui pra KPIs +
// gráficos. Computa janela do "período anterior" (mesma duração) pra
// trends.

import { useEffect, useMemo, useState } from 'react';
import type {
  EntradaCombustivel,
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
  TipoConsumidorSaida,
} from '../../../../types';
import { useCombustivelFilter } from '../filters/FilterContext';
import KpisRow from './KpisRow';
import SentinelBanner from './SentinelBanner';
import EvolucaoTemporal, { type Granularidade } from './charts/EvolucaoTemporal';
import MixCombustivel from './charts/MixCombustivel';
import TopEquipamentos from './charts/TopEquipamentos';
import TopCarretas from './charts/TopCarretas';
import CustoPorObra from './charts/CustoPorObra';
import CustoPorFornecedor from './charts/CustoPorFornecedor';
import DiaHoraHeatmap from './charts/DiaHoraHeatmap';
import UltimosAbastecimentosTable from './UltimosAbastecimentosTable';

interface Props {
  saidas: SaidaCombustivel[];
  entradas: EntradaCombustivel[];
  obras: Obra[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  /** Quando o usuário pedir "Ver todos" → muda pra aba Saídas. */
  onVerTodasSaidas?: () => void;
  /** "Atribuir agora" do banner sentinel → liga apenasSentinel + vai pra Saídas. */
  onAtribuirSentinels?: () => void;
}

const TIPO_POR_MODE: Record<'proprios' | 'carretas', TipoConsumidorSaida> = {
  proprios: 'equipamento_proprio',
  carretas: 'carreta_transportadora',
};

function isInRange(iso: string, from: string, to: string): boolean {
  const dia = iso.slice(0, 10);
  return dia >= from && dia <= to;
}

function diasNoPeriodo(p: { from: string; to: string }): number {
  const f = new Date(p.from + 'T00:00:00');
  const t = new Date(p.to + 'T00:00:00');
  return Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
}

/** Granularidade automática pra Evolução Temporal — evita travar a UI
 *  com 365 buckets de 'dia' em range "ano atual" (e ainda pior em ranges
 *  multi-ano). Usuário pode sobrescrever com o toggle; mudança de período
 *  re-avalia (caso típico: range diminui, volta pra 'dia' faz sentido).
 *
 *  Limites de borda escolhidos pra cobrir presets reais:
 *    - 92 inclui qualquer trimestre (Q1=90, Q2=91, Q3/Q4=92).
 *    - 731 inclui "2 anos exatos" (08/05/24 → 08/05/26 = 731 dias inclusivos). */
function autoGranularidade(from: string, to: string): Granularidade {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  const dias = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
  if (dias > 731) return 'mes';      // >2 anos → bucket mensal
  if (dias > 92) return 'semana';    // >92d e ≤2 anos → semanal
  return 'dia';                      // ≤92d (cobre qualquer trimestre) → diário
}

function shiftBackPeriodo(from: string, to: string): { from: string; to: string } {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  const dur = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1; // dias inclusivo
  const newTo = new Date(f);
  newTo.setDate(newTo.getDate() - 1);
  const newFrom = new Date(newTo);
  newFrom.setDate(newFrom.getDate() - (dur - 1));
  return {
    from: newFrom.toISOString().slice(0, 10),
    to: newTo.toISOString().slice(0, 10),
  };
}

export default function VisaoGeralTab({
  saidas,
  entradas,
  obras,
  equipamentos,
  transportadoras,
  combustiveis,
  onVerTodasSaidas,
  onAtribuirSentinels,
}: Props) {
  const { state } = useCombustivelFilter();
  const autoG = useMemo(
    () => autoGranularidade(state.periodo.from, state.periodo.to),
    [state.periodo.from, state.periodo.to],
  );
  const [granularidade, setGranularidade] = useState<Granularidade>(autoG);
  // Mudança de período → re-aplica auto. Toggle manual continua disponível
  // mas é "soft" (não persiste cross-period). Se isso virar irritante,
  // adicionar flag "userOverrideActive" depois.
  useEffect(() => {
    setGranularidade(autoG);
  }, [autoG]);
  const tipoConsumidorAlvo = TIPO_POR_MODE[state.mode];

  // Aplica filtros nas saídas: mode (tipoConsumidor) + período + obra +
  // tipoCombustível + operador, e os filtros específicos de cada mode.
  // Sentinel mode (apenasSentinel=true) força equipamentoId='desconhecido'
  // e ignora equipamentoIds (mutuamente excludentes).
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

  const entradasFiltradas = useMemo(() => {
    const tipoSet = new Set(state.tipoCombustiveis);
    const fornSet = new Set(state.fornecedores.map((f) => f.toLowerCase()));
    return entradas.filter((e) => {
      if (!isInRange(e.dataHora, state.periodo.from, state.periodo.to)) return false;
      if (tipoSet.size > 0 && (!e.tipoCombustivel || !tipoSet.has(e.tipoCombustivel))) return false;
      if (fornSet.size > 0 && !fornSet.has((e.fornecedor || '').trim().toLowerCase())) return false;
      return true;
    });
  }, [entradas, state]);

  // Período anterior (mesma duração) pra deltas de KPI
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

  return (
    <div className="space-y-4">
      {state.mode === 'proprios' && onAtribuirSentinels && (
        <SentinelBanner
          saidasFiltradas={saidasFiltradas}
          onAtribuirAgora={onAtribuirSentinels}
          suppressed={state.apenasSentinel}
        />
      )}
      <KpisRow
        mode={state.mode}
        saidasNoPeriodo={saidasFiltradas}
        saidasPeriodoAnterior={saidasPeriodoAnterior}
        equipamentos={equipamentos}
        transportadoras={transportadoras}
        periodo={state.periodo}
      />

      {/* Linha 1: Evolução (8 col) + Mix (4 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EvolucaoTemporal
            saidasNoPeriodo={saidasFiltradas}
            periodo={state.periodo}
            granularidade={granularidade}
            onChangeGranularidade={setGranularidade}
          />
        </div>
        <MixCombustivel saidasNoPeriodo={saidasFiltradas} combustiveis={combustiveis} />
      </div>

      {/* Linha 2: Top consumidores (varia por mode) + Custo por obra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.mode === 'proprios' ? (
          <TopEquipamentos
            saidasNoPeriodo={saidasFiltradas}
            equipamentos={equipamentos}
            onAtribuirSentinels={onAtribuirSentinels}
          />
        ) : (
          <TopCarretas saidasNoPeriodo={saidasFiltradas} transportadoras={transportadoras} />
        )}
        <CustoPorObra saidasNoPeriodo={saidasFiltradas} obras={obras} />
      </div>

      {/* Linha 3: Fornecedor + Heatmap. Heatmap só faz sentido em
          range ≥14 dias — em recorte curto, vira grade quase vazia. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CustoPorFornecedor entradasNoPeriodo={entradasFiltradas} />
        {diasNoPeriodo(state.periodo) >= 14 ? (
          <DiaHoraHeatmap saidasNoPeriodo={saidasFiltradas} />
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>

      {/* Linha 4: Últimos abastecimentos */}
      <UltimosAbastecimentosTable
        mode={state.mode}
        saidasNoPeriodo={saidasFiltradas}
        equipamentos={equipamentos}
        transportadoras={transportadoras}
        obras={obras}
        combustiveis={combustiveis}
        onVerTodos={onVerTodasSaidas}
      />
    </div>
  );
}
