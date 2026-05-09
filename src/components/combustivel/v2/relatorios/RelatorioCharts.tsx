// Container off-screen pra montar charts em estado "pronto pra captura".
//
// Mount on demand: o modal seta um flag → React monta este componente em
// container absolute @ left:-10000px → próximo frame já temos os SVGs no
// DOM com computed styles válidos → captura via svgElementToPngDataUrl →
// flag false → unmount.
//
// Por que NÃO display:none? CSS vars / computed styles ficam em estado
// `null` em elementos com display none, e o Recharts depende de
// width/height calculáveis pra ResponsiveContainer renderizar. A solução
// padrão é mover off-screen com left negativo grande.

import type { Equipamento, SaidaCombustivel } from '../../../../types';
import EvolucaoTemporal from '../visao-geral/charts/EvolucaoTemporal';
import TopEquipamentos from '../visao-geral/charts/TopEquipamentos';

/** Dimensões dos containers de cada chart. ResponsiveContainer precisa
 *  destes valores em px (não 100%) — sem parent dimensions o gráfico vai
 *  pra 0×0.
 *
 *  Aspectos calibrados pro PDF landscape (página A4 = 297×210mm, área útil
 *  ~277×190mm). Embed em width=240mm preserva folga lateral; alturas
 *  proporcionais deixam ~80mm pra tabela na mesma página:
 *    topEquipamentos 800×360 → ~108mm de altura no PDF
 *    evolucaoTemporal 800×280 → ~84mm de altura no PDF */
export const CHART_DIMENSIONS = {
  topEquipamentos: { width: 800, height: 360 },
  evolucaoTemporal: { width: 800, height: 280 },
} as const;

interface Props {
  /** Identificador único pra scope da captura — quando múltiplos modais
   *  coexistem (ex: Mensal + Por Obra), cada um deve passar uma key
   *  distinta. captureChartImages usa [data-relatorio-charts="<key>"]. */
  containerKey: string;
  saidasNoMes: SaidaCombustivel[];
  equipamentos: Equipamento[];
  periodo: { from: string; to: string };
}

export default function RelatorioCharts({ containerKey, saidasNoMes, equipamentos, periodo }: Props) {
  return (
    <div
      data-relatorio-charts={containerKey}
      aria-hidden
      style={{
        // Fixed (não absolute) pra escapar de qualquer overflow:hidden no
        // ancestor — o modal usa overflow-hidden no shell e clipparia um
        // child absolute. Position fixed posiciona relativo ao viewport.
        position: 'fixed',
        left: '-10000px',
        top: 0,
        // Não pode ser display:none nem visibility:hidden (quebra computed
        // styles + ResponsiveContainer). Mantém pointer-events off pra
        // garantir que cliques na área off-screen não atinjam os charts
        // (que têm onClick em barras).
        pointerEvents: 'none',
        // Width/height EXPLÍCITOS — sem isso, position:fixed + max-content
        // gera getBoundingClientRect retornando -1×-1 em alguns browsers,
        // o que faz Recharts ResponsiveContainer warnar "width(-1)" e
        // nunca medir o SVG. Soma das alturas dos charts internos + folga.
        width: 1000,
        height: 800,
        // z-index alto: permanece acima de qualquer overlay no DOM mesmo
        // que clipping fosse problema.
        zIndex: 9999,
      }}
    >
      <div
        data-chart="top-equipamentos"
        style={{ width: CHART_DIMENSIONS.topEquipamentos.width, height: CHART_DIMENSIONS.topEquipamentos.height }}
      >
        <TopEquipamentos
          saidasNoPeriodo={saidasNoMes}
          equipamentos={equipamentos}
          topN={10}
          disableAnimation
        />
      </div>
      <div
        data-chart="evolucao-temporal"
        style={{ width: CHART_DIMENSIONS.evolucaoTemporal.width, height: CHART_DIMENSIONS.evolucaoTemporal.height }}
      >
        <EvolucaoTemporal
          saidasNoPeriodo={saidasNoMes}
          periodo={periodo}
          granularidade="dia"
          onChangeGranularidade={() => {}}
          disableAnimation
        />
      </div>
    </div>
  );
}
