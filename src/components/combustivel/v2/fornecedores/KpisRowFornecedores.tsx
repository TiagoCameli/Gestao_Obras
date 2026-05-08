// 4 KPIs específicos da aba Fornecedores: Volume · Custo · Ativos · Melhor preço.
// Mode-agnostic — entradas não têm tipoConsumidor.
//
// "Melhor preço" só aparece com ≥2 fornecedores distintos no período (se
// houver 1 dominante, "menor R$/L" = nome óbvio = ruído). Gate via tooltip.

import { useMemo } from 'react';
import { Award, Droplet, Truck, Wallet } from 'lucide-react';
import type { EntradaCombustivel } from '../../../../types';
import KpiCard from '../visao-geral/KpiCard';
import { fmtBRL, fmtBRLCompact, fmtL, fmtLCompact, fmtNumDec } from '../shared/formatters';
import { bucketByDia, pctChange } from '../shared/stats';

interface Props {
  entradasNoPeriodo: EntradaCombustivel[];
  entradasPeriodoAnterior: EntradaCombustivel[];
  periodo: { from: string; to: string };
}

export default function KpisRowFornecedores({ entradasNoPeriodo, entradasPeriodoAnterior, periodo }: Props) {
  const kpis = useMemo(() => {
    let volume = 0;
    let custo = 0;
    const fornSet = new Set<string>();
    const acc = new Map<string, { litros: number; custo: number }>();

    for (const e of entradasNoPeriodo) {
      const litros = e.quantidadeLitros;
      const valor = e.valorTotal;
      volume += litros;
      custo += valor;
      const f = (e.fornecedor || '').trim();
      if (f) {
        fornSet.add(f);
        const cur = acc.get(f) ?? { litros: 0, custo: 0 };
        cur.litros += litros;
        cur.custo += valor;
        acc.set(f, cur);
      }
    }

    // Melhor preço — R$/L mais baixo ponderado pelo total de litros
    // comprados desse fornecedor (R$/L do agregado, não da entrada
    // individual mais barata — média ponderada é o que importa pra
    // decisão "qual usar mais").
    let melhorNome: string | null = null;
    let melhorRpL: number | null = null;
    if (fornSet.size >= 2) {
      for (const [nome, v] of acc) {
        if (v.litros <= 0) continue;
        const rpl = v.custo / v.litros;
        if (melhorRpL === null || rpl < melhorRpL) {
          melhorRpL = rpl;
          melhorNome = nome;
        }
      }
    }

    // Período anterior — só pros deltas
    let volumeAnt = 0;
    let custoAnt = 0;
    const fornSetAnt = new Set<string>();
    for (const e of entradasPeriodoAnterior) {
      volumeAnt += e.quantidadeLitros;
      custoAnt += e.valorTotal;
      const f = (e.fornecedor || '').trim();
      if (f) fornSetAnt.add(f);
    }

    const sparkVolume = bucketByDia(entradasNoPeriodo, (e) => e.dataHora, (e) => e.quantidadeLitros, periodo.from, periodo.to);
    const sparkCusto = bucketByDia(entradasNoPeriodo, (e) => e.dataHora, (e) => e.valorTotal, periodo.from, periodo.to);

    return {
      volume,
      custo,
      qtdFornecedores: fornSet.size,
      qtdFornecedoresAnt: fornSetAnt.size,
      diffFornecedores: fornSet.size - fornSetAnt.size,
      melhorNome,
      melhorRpL,
      deltaVolume: pctChange(volume, volumeAnt),
      deltaCusto: pctChange(custo, custoAnt),
      deltaFornecedores: pctChange(fornSet.size, fornSetAnt.size),
      sparkVolume: sparkVolume.map((d) => d.valor),
      sparkCusto: sparkCusto.map((d) => d.valor),
    };
  }, [entradasNoPeriodo, entradasPeriodoAnterior, periodo]);

  const empty = entradasNoPeriodo.length === 0;

  let fornOverride: string | undefined;
  if (kpis.qtdFornecedoresAnt < 5 && Math.abs(kpis.diffFornecedores) > 0) {
    const sign = kpis.diffFornecedores > 0 ? '+' : '−';
    fornOverride = `${sign}${Math.abs(kpis.diffFornecedores)}`;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Volume comprado"
        value={fmtLCompact(kpis.volume)}
        hint={empty ? '' : `${fmtL(kpis.volume)} no período`}
        delta={empty ? undefined : kpis.deltaVolume}
        neutral
        spark={kpis.sparkVolume}
        icon={Droplet}
        tooltip="Soma de litros das entradas no período (compras de combustível)."
        empty={empty}
      />
      <KpiCard
        label="Custo das compras"
        value={fmtBRLCompact(kpis.custo)}
        hint={empty ? '' : fmtBRL(kpis.custo)}
        delta={empty ? undefined : kpis.deltaCusto}
        invertTrend
        spark={kpis.sparkCusto}
        icon={Wallet}
        tooltip="Soma do valor total das entradas no período. Alta de custo = vermelho."
        empty={empty}
      />
      <KpiCard
        label="Fornecedores ativos"
        value={fmtNumDec(kpis.qtdFornecedores, 0)}
        hint={empty ? '' : 'com ao menos uma compra no período'}
        delta={empty || fornOverride ? undefined : kpis.deltaFornecedores}
        trendOverride={empty ? undefined : fornOverride}
        neutral
        icon={Truck}
        tooltip="Quantidade distinta de fornecedores que apareceram em entradas no período."
        empty={empty}
      />
      <KpiCard
        label="Melhor preço"
        value={
          kpis.melhorNome && kpis.melhorRpL !== null
            ? `R$ ${fmtNumDec(kpis.melhorRpL, 4)}`
            : '—'
        }
        hint={
          kpis.melhorNome
            ? kpis.melhorNome
            : kpis.qtdFornecedores < 2
              ? 'precisa ≥2 fornecedores para comparar'
              : ''
        }
        icon={Award}
        tooltip="R$/L médio ponderado do fornecedor com menor preço no período. Disponível apenas com 2+ fornecedores distintos."
        empty={!kpis.melhorNome}
      />
    </div>
  );
}
