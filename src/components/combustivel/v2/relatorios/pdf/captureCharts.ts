// Helpers compartilhados pra captura de PNGs dos charts dos templates de
// relatório (Mensal Consolidado, Por Obra, Por Equipamento). Extraídos do
// MensalConsolidadoModal pra reuso. Cada modal monta um <RelatorioCharts>
// off-screen com um `containerKey` único — captureChartImages scope-a a
// busca via [data-relatorio-charts="<key>"] pra evitar colisão quando
// múltiplos modais coexistem na árvore.

import type { ChartImagens } from '../mensalConsolidadoExport';
import { svgElementToPngDataUrl } from './svgToPng';

/** Recharts pode renderizar múltiplos <svg> no mesmo container — bullets
 *  do <Legend> são 8×8, chart real é >100×100. Esta helper retorna o de
 *  MAIOR área, ignorando bullets. */
export function findMainChartSvg(
  containerKey: string,
  chartKey: string,
): SVGElement | null {
  const container = document.querySelector(
    `[data-relatorio-charts="${containerKey}"] [data-chart="${chartKey}"]`,
  );
  if (!container) return null;
  const svgs = Array.from(container.querySelectorAll('svg')) as SVGElement[];
  if (svgs.length === 0) return null;
  return svgs.reduce<SVGElement | null>((biggest, svg) => {
    const r = svg.getBoundingClientRect();
    const area = r.width * r.height;
    if (!biggest) return area > 0 ? svg : null;
    const bigR = biggest.getBoundingClientRect();
    return area > bigR.width * bigR.height ? svg : biggest;
  }, null);
}

/** Captura os 2 charts (top-equipamentos + evolucao-temporal) do container
 *  identificado pelo `containerKey`. Charts ausentes (ex: TopEquipamentos
 *  cai no modo lista quando rows < 3) são pulados via null check. */
export async function captureChartImages(containerKey: string): Promise<ChartImagens> {
  const result: ChartImagens = {};
  const topEqSvg = findMainChartSvg(containerKey, 'top-equipamentos');
  const evolSvg = findMainChartSvg(containerKey, 'evolucao-temporal');
  if (topEqSvg) {
    try {
      result.topEquipamentos = await svgElementToPngDataUrl(topEqSvg, 'auto', 'auto');
    } catch (e) {
      console.warn('captureChartImages: falha em topEquipamentos', e);
    }
  }
  if (evolSvg) {
    try {
      result.evolucaoTemporal = await svgElementToPngDataUrl(evolSvg, 'auto', 'auto');
    } catch (e) {
      console.warn('captureChartImages: falha em evolucaoTemporal', e);
    }
  }
  return result;
}

/** Yield pro event loop (2 RAFs + fonts.ready com timeout próprio) e
 *  captura os charts. Combina o "settle" pré-captura com a captura em si
 *  pra reuso direto nos handlers de Gerar PDF. */
export async function settleAndCapture(containerKey: string): Promise<ChartImagens> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  if (typeof document.fonts?.ready === 'object' && 'then' in document.fonts.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((r) => setTimeout(r, 1000)),
    ]);
  }
  return captureChartImages(containerKey);
}
