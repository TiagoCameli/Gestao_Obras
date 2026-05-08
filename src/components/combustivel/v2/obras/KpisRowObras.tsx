// 4 KPIs específicos da aba Obras: Volume · Custo · Obras ativas · Top obra.
// Computa em memória sobre as saídas filtradas; trends vs período anterior
// (mesma duração) e sparklines diários.

import { useMemo } from 'react';
import { Building, Droplet, FolderOpen, Wallet } from 'lucide-react';
import type { Obra, SaidaCombustivel } from '../../../../types';
import KpiCard from '../visao-geral/KpiCard';
import { fmtBRL, fmtBRLCompact, fmtL, fmtLCompact, fmtNumDec } from '../shared/formatters';
import { bucketByDia, pctChange } from '../shared/stats';

interface Props {
  saidasNoPeriodo: SaidaCombustivel[];
  saidasPeriodoAnterior: SaidaCombustivel[];
  obras: Obra[];
  periodo: { from: string; to: string };
}

export default function KpisRowObras({ saidasNoPeriodo, saidasPeriodoAnterior, obras, periodo }: Props) {
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const kpis = useMemo(() => {
    let volume = 0;
    let custo = 0;
    const obraSet = new Set<string>();
    const litrosPorObra = new Map<string, number>();

    for (const s of saidasNoPeriodo) {
      volume += s.litros;
      custo += s.valorTotal;
      const oid = s.obraId ?? null;
      if (oid) {
        obraSet.add(oid);
        litrosPorObra.set(oid, (litrosPorObra.get(oid) ?? 0) + s.litros);
      }
    }

    // Top obra (mais litros)
    let topId: string | null = null;
    let topLitros = 0;
    for (const [id, l] of litrosPorObra) {
      if (l > topLitros) {
        topLitros = l;
        topId = id;
      }
    }
    const topNome = topId ? (obrasMap.get(topId) ?? topId) : null;
    const topPct = volume > 0 ? (topLitros / volume) * 100 : 0;

    // Período anterior — só pra deltas
    let volumeAnt = 0;
    let custoAnt = 0;
    const obraSetAnt = new Set<string>();
    for (const s of saidasPeriodoAnterior) {
      volumeAnt += s.litros;
      custoAnt += s.valorTotal;
      if (s.obraId) obraSetAnt.add(s.obraId);
    }

    // Sparklines (período atual)
    const sparkVolume = bucketByDia(saidasNoPeriodo, (s) => s.data, (s) => s.litros, periodo.from, periodo.to);
    const sparkCusto = bucketByDia(saidasNoPeriodo, (s) => s.data, (s) => s.valorTotal, periodo.from, periodo.to);

    return {
      volume,
      custo,
      qtdObras: obraSet.size,
      topId,
      topNome,
      topLitros,
      topPct,
      deltaVolume: pctChange(volume, volumeAnt),
      deltaCusto: pctChange(custo, custoAnt),
      deltaObras: pctChange(obraSet.size, obraSetAnt.size),
      diffObras: obraSet.size - obraSetAnt.size,
      qtdObrasAnt: obraSetAnt.size,
      sparkVolume: sparkVolume.map((d) => d.valor),
      sparkCusto: sparkCusto.map((d) => d.valor),
    };
  }, [saidasNoPeriodo, saidasPeriodoAnterior, obrasMap, periodo]);

  const empty = saidasNoPeriodo.length === 0;

  // Override do trend de "Obras ativas" quando base anterior é pequena
  // (mesmo padrão do KpisRow — % engana com base ≤4).
  let obrasOverride: string | undefined;
  if (kpis.qtdObrasAnt < 5 && Math.abs(kpis.diffObras) > 0) {
    const sign = kpis.diffObras > 0 ? '+' : '−';
    obrasOverride = `${sign}${Math.abs(kpis.diffObras)}`;
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
        tooltip="Soma de litros das saídas no período (respeita mode + filtros)."
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
        label="Obras ativas"
        value={fmtNumDec(kpis.qtdObras, 0)}
        hint={empty ? '' : 'com ao menos uma saída no período'}
        delta={empty || obrasOverride ? undefined : kpis.deltaObras}
        trendOverride={empty ? undefined : obrasOverride}
        neutral
        icon={FolderOpen}
        tooltip="Quantidade distinta de obras com pelo menos uma saída no período."
        empty={empty}
      />
      <KpiCard
        label="Top obra"
        value={kpis.topNome ?? '—'}
        hint={
          kpis.topNome
            ? `${fmtL(kpis.topLitros)}${kpis.topPct > 0 ? ` · ${fmtNumDec(kpis.topPct, 0)}% do total` : ''}`
            : ''
        }
        icon={Building}
        tooltip="Obra com mais litros consumidos no período."
        empty={!kpis.topNome}
      />
    </div>
  );
}
