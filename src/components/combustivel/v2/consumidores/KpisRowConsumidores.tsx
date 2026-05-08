// 4 KPIs adaptativos pra aba Equipamentos/Carretas:
//   Volume · Custo · Consumidores ativos · Top consumidor
// Mode='proprios': consumidor=equipamentoId (sentinel agrupado em "Não
// identificado" com indicador visual cinza).
// Mode='carretas': consumidor=placa (terceirizado, mais granular que transp).

import { useMemo } from 'react';
import { Crown, Droplet, Truck, Wallet, Wrench } from 'lucide-react';
import type { Equipamento, Fornecedor, SaidaCombustivel } from '../../../../types';
import KpiCard from '../visao-geral/KpiCard';
import { fmtBRL, fmtBRLCompact, fmtL, fmtLCompact, fmtNumDec } from '../shared/formatters';
import { bucketByDia, pctChange } from '../shared/stats';
import type { ConsumidorMode } from '../filters/types';

interface Props {
  mode: ConsumidorMode;
  saidasNoPeriodo: SaidaCombustivel[];
  saidasPeriodoAnterior: SaidaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  periodo: { from: string; to: string };
}

const SENTINEL_LABEL = 'Não identificado';

export default function KpisRowConsumidores({
  mode,
  saidasNoPeriodo,
  saidasPeriodoAnterior,
  equipamentos,
  transportadoras,
  periodo,
}: Props) {
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e])), [equipamentos]);
  const transpMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);

  const kpis = useMemo(() => {
    let volume = 0;
    let custo = 0;
    const consumidorSet = new Set<string>();
    const litrosPorConsumidor = new Map<string, number>();

    let qtdSentinel = 0;
    for (const s of saidasNoPeriodo) {
      volume += s.litros;
      custo += s.valorTotal;
      let key: string | null = null;
      if (mode === 'proprios') {
        // Sentinel agrupa numa categoria visível, não some — mas NÃO conta
        // em consumidorSet (que mede equipamentos cadastrados ativos).
        // Consistência com KpisRow da Visão Geral.
        key = s.equipamentoId === 'desconhecido' ? '_naoid' : (s.equipamentoId || null);
      } else {
        key = (s.placa || '').trim() || null;
      }
      if (key) {
        if (key !== '_naoid') consumidorSet.add(key);
        else qtdSentinel += 1;
        litrosPorConsumidor.set(key, (litrosPorConsumidor.get(key) ?? 0) + s.litros);
      }
    }

    let topKey: string | null = null;
    let topLitros = 0;
    for (const [k, l] of litrosPorConsumidor) {
      if (l > topLitros) {
        topLitros = l;
        topKey = k;
      }
    }
    let topLabel: string | null = null;
    let topMeta = '';
    let topIsSentinel = false;
    if (topKey) {
      if (mode === 'proprios') {
        if (topKey === '_naoid') {
          topLabel = SENTINEL_LABEL;
          topMeta = '';
          topIsSentinel = true;
        } else {
          const eq = equipMap.get(topKey) ?? null;
          topLabel = eq?.nome ?? topKey;
          topMeta = eq?.codigoPatrimonio || eq?.tipo || '';
        }
      } else {
        const ref = saidasNoPeriodo.find((s) => (s.placa || '').trim() === topKey);
        const transp = ref?.transportadoraId ? transpMap.get(ref.transportadoraId) : null;
        topLabel = topKey;
        topMeta = transp ?? '';
      }
    }
    const topPct = volume > 0 ? (topLitros / volume) * 100 : 0;

    // Período anterior
    let volumeAnt = 0;
    let custoAnt = 0;
    const consumidorSetAnt = new Set<string>();
    for (const s of saidasPeriodoAnterior) {
      volumeAnt += s.litros;
      custoAnt += s.valorTotal;
      let key: string | null = null;
      if (mode === 'proprios') {
        key = s.equipamentoId === 'desconhecido' ? '_naoid' : (s.equipamentoId || null);
      } else {
        key = (s.placa || '').trim() || null;
      }
      if (key && key !== '_naoid') consumidorSetAnt.add(key);
    }

    const sparkVolume = bucketByDia(saidasNoPeriodo, (s) => s.data, (s) => s.litros, periodo.from, periodo.to);
    const sparkCusto = bucketByDia(saidasNoPeriodo, (s) => s.data, (s) => s.valorTotal, periodo.from, periodo.to);

    return {
      volume,
      custo,
      qtdConsumidores: consumidorSet.size,
      qtdSentinel,
      qtdConsumidoresAnt: consumidorSetAnt.size,
      diffConsumidores: consumidorSet.size - consumidorSetAnt.size,
      topLabel,
      topMeta,
      topLitros,
      topPct,
      topIsSentinel,
      deltaVolume: pctChange(volume, volumeAnt),
      deltaCusto: pctChange(custo, custoAnt),
      deltaConsumidores: pctChange(consumidorSet.size, consumidorSetAnt.size),
      sparkVolume: sparkVolume.map((d) => d.valor),
      sparkCusto: sparkCusto.map((d) => d.valor),
    };
  }, [mode, saidasNoPeriodo, saidasPeriodoAnterior, equipMap, transpMap, periodo]);

  const empty = saidasNoPeriodo.length === 0;
  const labelQtd = mode === 'proprios' ? 'Equipamentos ativos' : 'Carretas ativas';
  const tooltipQtd =
    mode === 'proprios'
      ? 'Quantidade distinta de equipamentos cadastrados com pelo menos uma saída no período. Saídas sem identificação não entram no total (mostradas separadamente como "+N sem ID" no hint).'
      : 'Quantidade distinta de placas com pelo menos uma saída no período.';
  const IconQtd = mode === 'proprios' ? Wrench : Truck;
  const labelTop = mode === 'proprios' ? 'Top equipamento' : 'Top carreta';

  let topOverride: string | undefined;
  if (kpis.qtdConsumidoresAnt < 5 && Math.abs(kpis.diffConsumidores) > 0) {
    const sign = kpis.diffConsumidores > 0 ? '+' : '−';
    topOverride = `${sign}${Math.abs(kpis.diffConsumidores)}`;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Volume total"
        value={fmtLCompact(kpis.volume)}
        hint={empty ? '' : `${fmtL(kpis.volume)} no período`}
        delta={empty ? undefined : kpis.deltaVolume}
        neutral
        spark={kpis.sparkVolume}
        icon={Droplet}
        tooltip="Soma de litros das saídas no período (mode + filtros)."
        empty={empty}
      />
      <KpiCard
        label="Custo total"
        value={fmtBRLCompact(kpis.custo)}
        hint={empty ? '' : fmtBRL(kpis.custo)}
        delta={empty ? undefined : kpis.deltaCusto}
        invertTrend
        spark={kpis.sparkCusto}
        icon={Wallet}
        tooltip="Soma do valor total das saídas no período. Alta de custo = vermelho."
        empty={empty}
      />
      <KpiCard
        label={labelQtd}
        value={fmtNumDec(kpis.qtdConsumidores, 0)}
        hint={
          empty
            ? ''
            : mode === 'proprios' && kpis.qtdSentinel > 0
              ? `+${kpis.qtdSentinel} saída${kpis.qtdSentinel !== 1 ? 's' : ''} sem ID`
              : 'no período'
        }
        delta={empty || topOverride ? undefined : kpis.deltaConsumidores}
        trendOverride={empty ? undefined : topOverride}
        neutral
        icon={IconQtd}
        tooltip={tooltipQtd}
        empty={empty}
      />
      <KpiCard
        label={labelTop}
        value={
          kpis.topLabel ? (
            kpis.topIsSentinel ? (
              <span className="text-amber-700 dark:text-amber-400">{kpis.topLabel}</span>
            ) : (
              kpis.topLabel
            )
          ) : (
            '—'
          )
        }
        hint={
          kpis.topLabel
            ? [
                fmtL(kpis.topLitros),
                kpis.topPct > 0 ? `${fmtNumDec(kpis.topPct, 0)}% do total` : '',
                kpis.topMeta,
              ]
                .filter(Boolean)
                .join(' · ')
            : ''
        }
        icon={Crown}
        tooltip={
          kpis.topIsSentinel
            ? 'Maior consumidor é o grupo "Não identificado" — atribuir retroativamente vai mudar este número.'
            : 'Consumidor com mais litros no período.'
        }
        empty={!kpis.topLabel}
      />
    </div>
  );
}
