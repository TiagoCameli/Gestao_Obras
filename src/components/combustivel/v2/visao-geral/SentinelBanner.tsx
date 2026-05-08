// Banner de saúde do dado: quando >10% do volume das saídas filtradas
// (mode='proprios') está sem equipamento identificado, mostra aviso
// amber com ação rápida pra atribuir. Some sob 5% (histerese pra não
// piscar entre filtros borderline).
//
// Calcula pctSentinel sobre `saidasFiltradas` — exatamente o que o usuário
// está vendo (KPIs + charts). Filtrar por equipamento_id real → 0% →
// banner some. Coerência com o resto da página.

import { useMemo } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type { SaidaCombustivel } from '../../../../types';
import { fmtL, fmtNumDec } from '../shared/formatters';

interface Props {
  /** Mesmas saídas que alimentam KPIs e charts da página. */
  saidasFiltradas: SaidaCombustivel[];
  /** Callback do "Atribuir agora" — container faz setApenasSentinel(true) + setSubTab('saidas'). */
  onAtribuirAgora: () => void;
  /** Quando true, banner é suprimido — usuário já está olhando só sentinels,
   *  banner com "100% sem ID" seria redundante. */
  suppressed?: boolean;
}

export default function SentinelBanner({ saidasFiltradas, onAtribuirAgora, suppressed }: Props) {
  const stats = useMemo(() => {
    let volumeTotal = 0;
    let volumeSentinel = 0;
    for (const s of saidasFiltradas) {
      volumeTotal += s.litros;
      if (s.equipamentoId === 'desconhecido') volumeSentinel += s.litros;
    }
    return { volumeTotal, volumeSentinel };
  }, [saidasFiltradas]);

  if (suppressed) return null;
  if (stats.volumeTotal <= 0) return null;
  const pct = (stats.volumeSentinel / stats.volumeTotal) * 100;
  // Histerese: aparece >10%, esconde <5%. Threshold único piscaria com
  // filtros borderline.
  if (pct < 10) return null;

  return (
    <div
      role="status"
      className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-4 py-2.5 flex items-center gap-3"
    >
      <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
      <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
        <span className="font-semibold tabular-nums">{fmtNumDec(pct, 0)}%</span>{' '}
        do volume no escopo atual (<span className="tabular-nums">{fmtL(stats.volumeSentinel)}</span>) está
        sem equipamento identificado. Atribuir retroativamente melhora o cálculo
        de consumo e R$/L por equipamento.
      </div>
      <button
        type="button"
        onClick={onAtribuirAgora}
        className="text-xs font-semibold text-amber-900 dark:text-amber-200 inline-flex items-center gap-1 hover:underline whitespace-nowrap"
      >
        Atribuir agora
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
