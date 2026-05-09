// Calcula os 6 KPIs da Visão Geral em memória sobre as saídas filtradas.
// Cada KPI tem trend (vs período anterior de mesma duração) e
// sparkline (série diária do próprio KPI no período atual).

import { useMemo } from 'react';
import { Droplet, Wallet, Gauge, Truck, Crown, Wrench, AlertTriangle } from 'lucide-react';
import type { Equipamento, Fornecedor, Insumo, Obra, SaidaCombustivel } from '../../../../types';
import type { ConsumidorMode } from '../filters/types';
import KpiCard from './KpiCard';
import { fmtBRL, fmtBRLCompact, fmtL, fmtLCompact, fmtNumDec } from '../shared/formatters';
import { bucketByDia, media, pctChange } from '../shared/stats';
import { detectAnomalias, type Severidade } from '../anomalias/detect';

interface Props {
  mode: ConsumidorMode;
  /** Saídas já filtradas pelo período + outros filtros globais. */
  saidasNoPeriodo: SaidaCombustivel[];
  /** Mesmas saídas pra janela imediatamente anterior (mesma duração) — pra delta vs período. */
  saidasPeriodoAnterior: SaidaCombustivel[];
  /** Saídas TODAS — D3 (hist 90d) e D5 (gap 60d) precisam do banco completo. */
  saidasTodas: SaidaCombustivel[];
  /** Equipamentos pra resolver nome do "Maior consumidor" em mode='proprios'. */
  equipamentos: Equipamento[];
  /** Transportadoras pra resolver nome em mode='carretas'. */
  transportadoras: Fornecedor[];
  /** Catálogos pra resolver nomes de combustíveis e obras nas anomalias. */
  combustiveis: Insumo[];
  obras: Obra[];
  periodo: { from: string; to: string };
  /** Click no KPI Anomalias → navega aba Anomalias com pré-filtro de severity. */
  onClickAnomalias?: (severityPrefill: Severidade[]) => void;
}

export default function KpisRow({
  mode,
  saidasNoPeriodo,
  saidasPeriodoAnterior,
  saidasTodas,
  equipamentos,
  transportadoras,
  combustiveis,
  obras,
  periodo,
  onClickAnomalias,
}: Props) {
  // KPI #6 — Anomalias críticas + atenção (D5 info é rotineiro, fica fora)
  const combustivelNome = useMemo(
    () => new Map(combustiveis.map((c) => [c.id, c.nome])),
    [combustiveis],
  );
  const obraNome = useMemo(
    () => new Map(obras.map((o) => [o.id, o.nome])),
    [obras],
  );
  const anomaliasStats = useMemo(() => {
    const result = detectAnomalias({
      saidasNoPeriodo,
      saidasTodas,
      equipamentos,
      combustivelNome,
      obraNome,
    });
    let critical = 0;
    let warning = 0;
    for (const a of result) {
      if (a.severity === 'critical') critical++;
      else if (a.severity === 'warning') warning++;
    }
    return { critical, warning, total: critical + warning };
  }, [saidasNoPeriodo, saidasTodas, equipamentos, combustivelNome, obraNome]);
  // Cor do card: vermelho se há crítica, amber se só warnings, verde se 0.
  const anomAccent: 'danger' | 'warning' | 'success' =
    anomaliasStats.critical > 0
      ? 'danger'
      : anomaliasStats.warning > 0
        ? 'warning'
        : 'success';
  const anomHint =
    anomaliasStats.total === 0
      ? 'Nenhuma detectada'
      : [
          anomaliasStats.critical > 0
            ? `${anomaliasStats.critical} crítica${anomaliasStats.critical > 1 ? 's' : ''}`
            : null,
          anomaliasStats.warning > 0
            ? `${anomaliasStats.warning} atenção`
            : null,
        ]
          .filter(Boolean)
          .join(' · ');
  const kpis = useMemo(() => {
    // Totais período atual
    let volume = 0;
    let custo = 0;
    const consumidorSet = new Set<string>();
    const consumoPorConsumidor = new Map<string, number>();
    for (const s of saidasNoPeriodo) {
      volume += s.litros;
      custo += s.valorTotal;
      // Identifica o "consumidor" desta saída segundo o mode atual.
      let key: string | null = null;
      if (mode === 'proprios') {
        key = s.equipamentoId && s.equipamentoId !== 'desconhecido' ? s.equipamentoId : null;
      } else {
        // mode='carretas' — chave = placa (texto livre, mais granular que transportadora)
        key = (s.placa || '').trim() || null;
      }
      if (key) {
        consumidorSet.add(key);
        consumoPorConsumidor.set(key, (consumoPorConsumidor.get(key) ?? 0) + s.litros);
      }
    }
    const rPorL = volume > 0 ? custo / volume : 0;

    // Maior consumidor — adapta ao mode
    let maiorKey: string | null = null;
    let maiorLitros = 0;
    for (const [id, l] of consumoPorConsumidor) {
      if (l > maiorLitros) {
        maiorLitros = l;
        maiorKey = id;
      }
    }
    let maiorLabel: string | null = null;
    let maiorMeta: string = ''; // info adicional (código, transportadora)
    if (maiorKey) {
      if (mode === 'proprios') {
        const eq = equipamentos.find((e) => e.id === maiorKey) ?? null;
        if (eq) {
          maiorLabel = eq.nome;
          maiorMeta = eq.codigoPatrimonio || eq.tipo || '';
        }
      } else {
        // Acha a saída mais recente com essa placa pra extrair transportadora
        const ref = saidasNoPeriodo.find((s) => (s.placa || '').trim() === maiorKey);
        const transp = ref?.transportadoraId
          ? transportadoras.find((t) => t.id === ref.transportadoraId)
          : null;
        maiorLabel = maiorKey;
        maiorMeta = transp?.nome ?? '';
      }
    }

    // Período anterior — totais (consumidores distinct contam)
    let volumeAnt = 0;
    let custoAnt = 0;
    let qtdSaidasAnt = 0;
    const consumidorSetAnt = new Set<string>();
    for (const s of saidasPeriodoAnterior) {
      volumeAnt += s.litros;
      custoAnt += s.valorTotal;
      qtdSaidasAnt += 1;
      let key: string | null = null;
      if (mode === 'proprios') {
        key = s.equipamentoId && s.equipamentoId !== 'desconhecido' ? s.equipamentoId : null;
      } else {
        key = (s.placa || '').trim() || null;
      }
      if (key) consumidorSetAnt.add(key);
    }
    const rPorLAnt = volumeAnt > 0 ? custoAnt / volumeAnt : 0;

    // Sparklines por dia (período atual)
    const sparkVolume = bucketByDia(saidasNoPeriodo, (s) => s.data, (s) => s.litros, periodo.from, periodo.to);
    const sparkCusto = bucketByDia(saidasNoPeriodo, (s) => s.data, (s) => s.valorTotal, periodo.from, periodo.to);
    const sparkRpL = sparkVolume.map((d, i) => {
      const c = sparkCusto[i]?.valor ?? 0;
      return d.valor > 0 ? c / d.valor : 0;
    });

    // % do total do "maior consumidor" — dá peso real ao número.
    const maiorPct = volume > 0 ? (maiorLitros / volume) * 100 : 0;

    return {
      volume,
      custo,
      rPorL,
      qtdConsumidores: consumidorSet.size,
      maiorLabel,
      maiorLitros,
      maiorPct,
      // Hint refinado: "200 L · 62% · VL-007" — % do total dá peso real
      // ao número (sem ele, "200 L" não diz se é grande ou pequeno).
      maiorHintRefined: maiorLabel
        ? [
            fmtL(maiorLitros),
            maiorPct > 0 ? `${fmtNumDec(maiorPct, 0)}%` : '',
            maiorMeta,
          ]
            .filter(Boolean)
            .join(' · ')
        : '',
      deltaVolume: pctChange(volume, volumeAnt),
      deltaCusto: pctChange(custo, custoAnt),
      deltaRpL: rPorLAnt > 0 ? pctChange(rPorL, rPorLAnt) : 0,
      deltaConsumidores: pctChange(consumidorSet.size, consumidorSetAnt.size),
      // Diferenças absolutas (current - anterior) — usadas pelo trendOverride
      // quando base anterior é pequena demais pro % fazer sentido.
      diffVolume: volume - volumeAnt,
      diffConsumidores: consumidorSet.size - consumidorSetAnt.size,
      // Bases anteriores — usadas pra decidir trendOverride (% engana com base pequena)
      qtdSaidasAnt,
      qtdConsumidoresAnt: consumidorSetAnt.size,
      sparkVolume: sparkVolume.map((d) => d.valor),
      sparkCusto: sparkCusto.map((d) => d.valor),
      // Filtra zeros: dias sem volume produzem R$/L=0 que rebaixam a
      // sparkline pra ~0 e descaracterizam o trend real do preço.
      sparkRpL: sparkRpL.filter((v) => Number.isFinite(v) && v > 0),
      mediaRpL: media(sparkRpL.filter((v) => v > 0)),
    };
  }, [mode, saidasNoPeriodo, saidasPeriodoAnterior, equipamentos, transportadoras, periodo]);

  const empty = saidasNoPeriodo.length === 0;

  // Helper: decide se troca o chip de Δ% por valor absoluto quando a base
  // anterior é tão pequena que o % ficaria enganoso (ex: 0→1 = +∞%).
  // Limite: <5 amostras na base.
  function pickTrend(absDelta: number, baseAnt: number, unidade: 'pct' | 'count' | 'L', diff: number) {
    if (baseAnt < 5 && Math.abs(diff) > 0) {
      const sign = diff > 0 ? '+' : '−';
      if (unidade === 'count') return { override: `${sign}${Math.abs(diff)}` };
      if (unidade === 'L') return { override: `${sign}${fmtL(Math.abs(diff))}` };
      return { override: `${sign}${fmtNumDec(Math.abs(diff), 0)}` };
    }
    return { delta: absDelta };
  }

  // Rótulos dinâmicos por mode
  const labelQtd = mode === 'proprios' ? 'Equipamentos' : 'Carretas';
  const hintQtd = mode === 'proprios' ? 'abastecidos no período' : 'placas distintas no período';
  const tooltipQtd =
    mode === 'proprios'
      ? 'Quantidade distinta de equipamentos com pelo menos uma saída no período.'
      : 'Quantidade distinta de placas com pelo menos uma saída no período.';
  const IconQtd = mode === 'proprios' ? Wrench : Truck;

  const labelMaior = mode === 'proprios' ? 'Maior equipamento' : 'Maior carreta';
  const tooltipMaior =
    mode === 'proprios'
      ? 'Equipamento com mais litros no período.'
      : 'Carreta (placa) com mais litros no período.';

  // Decisões de trend por KPI: Volume e Equipamentos = neutros (alta não
  // tem leitura semântica clara). Custo e R$/L = invertTrend (alta = ruim).
  // pickTrend recebe o diff REAL (current - anterior), não o valor atual.
  const trVolume = pickTrend(kpis.deltaVolume, kpis.qtdSaidasAnt, 'L', kpis.diffVolume);
  const trEquip = pickTrend(kpis.deltaConsumidores, kpis.qtdConsumidoresAnt, 'count', kpis.diffConsumidores);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        label="Volume total"
        value={fmtLCompact(kpis.volume)}
        hint={empty ? '' : `${fmtL(kpis.volume)} no período`}
        delta={empty ? undefined : trVolume.delta}
        trendOverride={empty ? undefined : trVolume.override}
        neutral
        spark={kpis.sparkVolume}
        icon={Droplet}
        tooltip="Soma de litros das saídas no período filtrado."
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
        label="R$/L médio"
        value={empty ? '—' : `R$ ${fmtNumDec(kpis.rPorL, 2)}`}
        hint={empty ? '' : 'custo ÷ volume'}
        delta={empty || kpis.mediaRpL === 0 ? undefined : kpis.deltaRpL}
        invertTrend
        spark={kpis.sparkRpL}
        icon={Gauge}
        tooltip="Custo total ÷ volume total no período (precisão de 4 casas na tabela detalhada)."
        empty={empty}
      />
      <KpiCard
        label={labelQtd}
        value={fmtNumDec(kpis.qtdConsumidores, 0)}
        hint={empty ? '' : hintQtd}
        delta={empty ? undefined : trEquip.delta}
        trendOverride={empty ? undefined : trEquip.override}
        neutral
        icon={IconQtd}
        tooltip={tooltipQtd}
        empty={empty}
      />
      <KpiCard
        label={labelMaior}
        value={kpis.maiorLabel ?? '—'}
        hint={kpis.maiorHintRefined}
        icon={Crown}
        tooltip={tooltipMaior}
        empty={!kpis.maiorLabel}
      />
      <KpiCard
        label="Anomalias"
        value={fmtNumDec(anomaliasStats.total, 0)}
        hint={anomHint}
        icon={AlertTriangle}
        accent={anomAccent}
        tooltip="Anomalias críticas e de atenção detectadas no período (D1-D4). D5 informativos não contam aqui."
        onClick={
          onClickAnomalias && anomaliasStats.total > 0
            ? () => onClickAnomalias(['critical', 'warning'])
            : onClickAnomalias
              ? () => onClickAnomalias([])
              : undefined
        }
      />
    </div>
  );
}
