// Gerador do template "Mensal Consolidado" — PDF + Excel.
// Reusa primitivos de utils/exportTemplate.ts (BRAND, drawPdfBanner,
// renderExcelDetalhamento etc.).
//
// F4.A.1: estrutura sem gráficos (só KPIs + tabelas + slot anomalias
// placeholder). F4.A.2 vai adicionar gráficos via SVG→PNG canvas.

import jsPDF from 'jspdf';
import type {
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  EntradaCombustivel,
  SaidaCombustivel,
} from '../../../../types';
import {
  BRAND,
  PDF_RGB,
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfSectionTitle,
  fmtBRL,
  fmtNum,
  formatMesRef,
  renderExcelBanner,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelDetalhamento,
  renderExcelSectionTitle,
} from '../../../../utils/exportTemplate';
import type { Anomalia } from '../anomalias/detect';
import { drawAnomaliasSlot } from './pdf/anomaliasSlot';
import { renderExcelAnomaliasSheet } from './anomaliasExcelSheet';

const TITULO = 'Combustível · Relatório Mensal Consolidado';
const SUBTITULO_BASE = 'Visão executiva de consumo, custo e operação';
const MARCA = 'Gestão de Obras · Combustível';

/** PNGs (dataURL) capturados pelo modal antes de chamar o exportador.
 *  F4.A.2.1: 2 charts (Top Equipamentos + EvolucaoTemporal). */
export interface ChartImagens {
  topEquipamentos?: string;
  evolucaoTemporal?: string;
}

interface ConsolidadoInput {
  /** Mês referência no formato YYYY-MM. */
  mesReferencia: string;
  saidasNoMes: SaidaCombustivel[];
  entradasNoMes: EntradaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  obras: Obra[];
  combustiveis: Insumo[];
  /** PNGs dos gráficos pra embed no PDF. Opcional — se ausente, o PDF
   *  renderiza só as tabelas (compatível com o caminho atual). */
  charts?: ChartImagens;
  /** F3.C.2 — Anomalias do escopo do mês. Quando ausente, slot fica
   *  com mensagem positiva ("Nenhuma anomalia detectada"). */
  anomalias?: Anomalia[];
}

interface Agg {
  litros: number;
  custo: number;
  qtd: number;
}

function aggBy<T>(items: T[], keyFn: (it: T) => string | null, litrosFn: (it: T) => number, custoFn: (it: T) => number) {
  const map = new Map<string, Agg>();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    const cur = map.get(k) ?? { litros: 0, custo: 0, qtd: 0 };
    cur.litros += litrosFn(it);
    cur.custo += custoFn(it);
    cur.qtd += 1;
    map.set(k, cur);
  }
  return map;
}

function topByLitros<T extends { litros: number }>(map: Map<string, T>, n: number): Array<[string, T]> {
  return Array.from(map.entries())
    .sort((a, b) => b[1].litros - a[1].litros)
    .slice(0, n);
}

function topByCusto<T extends { custo: number }>(map: Map<string, T>, n: number): Array<[string, T]> {
  return Array.from(map.entries())
    .sort((a, b) => b[1].custo - a[1].custo)
    .slice(0, n);
}

interface ConsolidadoData {
  totais: {
    volume: number;
    custo: number;
    rPorL: number;
    qtdSaidas: number;
    qtdEquipamentosProprios: number;
    qtdSentinel: number;
    qtdCarretas: number;
    qtdObras: number;
    volumeCompras: number;
    custoCompras: number;
    qtdFornecedores: number;
  };
  topEquipamentos: Array<{ nome: string; codigo: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  topCarretas: Array<{ placa: string; transportadora: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  topObras: Array<{ nome: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  fornecedores: Array<{ nome: string; litros: number; custo: number; rPorL: number; qtd: number }>;
}

function compute(input: ConsolidadoInput): ConsolidadoData {
  const eqMap = new Map(input.equipamentos.map((e) => [e.id, e]));
  const transpMap = new Map(input.transportadoras.map((t) => [t.id, t.nome]));
  const obraMap = new Map(input.obras.map((o) => [o.id, o.nome]));

  let volume = 0;
  let custo = 0;
  let qtdSentinel = 0;
  const eqSet = new Set<string>();
  const carretaSet = new Set<string>();
  const obraSet = new Set<string>();

  // Aggregates por dimensão
  const aggEq = new Map<string, Agg & { codigoPatrimonio: string; tipo: string }>();
  const aggCarreta = new Map<string, Agg & { transportadora: string }>();
  const aggObra = aggBy(input.saidasNoMes, (s) => s.obraId, (s) => s.litros, (s) => s.valorTotal);
  // Rebuild aggObra to standard Agg type
  const aggObra2 = new Map<string, Agg>(aggObra);

  for (const s of input.saidasNoMes) {
    volume += s.litros;
    custo += s.valorTotal;
    if (s.obraId) obraSet.add(s.obraId);
    if (s.tipoConsumidor === 'equipamento_proprio') {
      if (s.equipamentoId === 'desconhecido') {
        qtdSentinel += 1;
      } else if (s.equipamentoId) {
        eqSet.add(s.equipamentoId);
        const eq = eqMap.get(s.equipamentoId);
        const cur = aggEq.get(s.equipamentoId) ?? {
          litros: 0,
          custo: 0,
          qtd: 0,
          codigoPatrimonio: eq?.codigoPatrimonio ?? '',
          tipo: eq?.tipo ?? '',
        };
        cur.litros += s.litros;
        cur.custo += s.valorTotal;
        cur.qtd += 1;
        aggEq.set(s.equipamentoId, cur);
      }
    } else if (s.tipoConsumidor === 'carreta_transportadora') {
      const placa = (s.placa || '').trim();
      if (placa) {
        carretaSet.add(placa);
        const transpNome = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '') : '';
        const cur = aggCarreta.get(placa) ?? { litros: 0, custo: 0, qtd: 0, transportadora: transpNome };
        cur.litros += s.litros;
        cur.custo += s.valorTotal;
        cur.qtd += 1;
        aggCarreta.set(placa, cur);
      }
    }
  }

  // Entradas (compras)
  let volumeCompras = 0;
  let custoCompras = 0;
  const fornSet = new Set<string>();
  const aggForn = new Map<string, Agg>();
  for (const e of input.entradasNoMes) {
    volumeCompras += e.quantidadeLitros;
    custoCompras += e.valorTotal;
    const nome = (e.fornecedor || '').trim();
    if (nome) {
      fornSet.add(nome);
      const cur = aggForn.get(nome) ?? { litros: 0, custo: 0, qtd: 0 };
      cur.litros += e.quantidadeLitros;
      cur.custo += e.valorTotal;
      cur.qtd += 1;
      aggForn.set(nome, cur);
    }
  }

  return {
    totais: {
      volume,
      custo,
      rPorL: volume > 0 ? custo / volume : 0,
      qtdSaidas: input.saidasNoMes.length,
      qtdEquipamentosProprios: eqSet.size,
      qtdSentinel,
      qtdCarretas: carretaSet.size,
      qtdObras: obraSet.size,
      volumeCompras,
      custoCompras,
      qtdFornecedores: fornSet.size,
    },
    topEquipamentos: topByLitros(aggEq, 10).map(([id, v]) => {
      const eq = eqMap.get(id);
      return {
        nome: eq?.nome ?? id,
        codigo: v.codigoPatrimonio || v.tipo || '',
        litros: v.litros,
        custo: v.custo,
        rPorL: v.litros > 0 ? v.custo / v.litros : 0,
        qtd: v.qtd,
      };
    }),
    topCarretas: topByLitros(aggCarreta, 10).map(([placa, v]) => ({
      placa,
      transportadora: v.transportadora,
      litros: v.litros,
      custo: v.custo,
      rPorL: v.litros > 0 ? v.custo / v.litros : 0,
      qtd: v.qtd,
    })),
    topObras: topByCusto(aggObra2, 10).map(([id, v]) => ({
      nome: obraMap.get(id) ?? id,
      litros: v.litros,
      custo: v.custo,
      rPorL: v.litros > 0 ? v.custo / v.litros : 0,
      qtd: v.qtd,
    })),
    fornecedores: Array.from(aggForn.entries())
      .sort((a, b) => b[1].litros - a[1].litros)
      .map(([nome, v]) => ({
        nome,
        litros: v.litros,
        custo: v.custo,
        rPorL: v.litros > 0 ? v.custo / v.litros : 0,
        qtd: v.qtd,
      })),
  };
}

function nomeArquivo(mesRef: string, ext: 'pdf' | 'xlsx'): string {
  // formatMesRef retorna "Abr/2026"; troca / por - pra ficar
  // filename-safe (Windows/macOS bloqueiam / em nome de arquivo).
  const slug = formatMesRef(mesRef).replace('/', '-');
  return `EMT - Mensal Consolidado - ${slug}.${ext}`;
}

// ════════════════════════════════════════════════════════════════════
// PDF
// ════════════════════════════════════════════════════════════════════

export function exportarMensalConsolidadoPDF(input: ConsolidadoInput): void {
  const data = compute(input);
  const t = data.totais;
  const subtitulo = `${SUBTITULO_BASE} · ${formatMesRef(input.mesReferencia)}`;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Página 1: Resumo executivo ──
  let y = drawPdfBanner(doc, TITULO, subtitulo);
  y = drawPdfFiltros(doc, y + 4, [
    ['Mês referência', formatMesRef(input.mesReferencia)],
    ['Total saídas', `${t.qtdSaidas} registros`],
  ]);
  y = drawPdfKPIs(doc, y + 4, [
    ['Volume Total', `${fmtNum(t.volume, 0)} L`],
    ['Custo Total', fmtBRL(t.custo)],
    ['R$/L Médio', t.rPorL > 0 ? `R$ ${fmtNum(t.rPorL, 4)}` : '—'],
    ['Compras (Entradas)', fmtBRL(t.custoCompras)],
  ]);
  y = drawPdfKPIs(doc, y + 4, [
    ['Equipamentos próprios', String(t.qtdEquipamentosProprios)],
    ['Carretas (placas)', String(t.qtdCarretas)],
    ['Obras com saída', String(t.qtdObras)],
    ['Fornecedores', String(t.qtdFornecedores)],
  ]);

  // Aviso de sentinel (se houver) — análogo ao banner da Visão Geral
  if (t.qtdSentinel > 0) {
    y = drawPdfSectionTitle(doc, y + 6, `ATENÇÃO: ${t.qtdSentinel} saída(s) sem equipamento identificado`);
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      'Atribuir retroativamente via aba "Saídas" (filtro "Apenas sem equipamento") melhora a precisão deste relatório.',
      10, y,
    );
  }

  // ── Página 2: Top Equipamentos próprios (chart + table) ──
  if (data.topEquipamentos.length > 0) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Top 10 equipamentos próprios', data.topEquipamentos.length);
    let yEq = 20;
    if (input.charts?.topEquipamentos) {
      const pageWmm = doc.internal.pageSize.getWidth();
      const imgW = 240;
      const imgH = imgW * (360 / 800); // 108mm — alinha com CHART_DIMENSIONS
      const x = (pageWmm - imgW) / 2;
      doc.addImage(input.charts.topEquipamentos, 'PNG', x, yEq, imgW, imgH);
      yEq += imgH + 4;
    }
    drawPdfDetailTable(
      doc,
      yEq,
      ['#', 'Equipamento', 'Código', 'Saídas', 'Litros', 'Custo', 'R$/L'],
      data.topEquipamentos.map((r, i) => [
        String(i + 1),
        r.nome,
        r.codigo,
        String(r.qtd),
        fmtNum(r.litros, 0),
        fmtBRL(r.custo),
        r.rPorL > 0 ? `R$ ${fmtNum(r.rPorL, 4)}` : '—',
      ]),
      ['', 'Total', '', String(data.topEquipamentos.reduce((s, r) => s + r.qtd, 0)),
        fmtNum(data.topEquipamentos.reduce((s, r) => s + r.litros, 0), 0),
        fmtBRL(data.topEquipamentos.reduce((s, r) => s + r.custo, 0)),
        ''],
      {
        0: { halign: 'right', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 80 },
        2: { halign: 'left', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 32 },
        6: { halign: 'right', cellWidth: 26 },
      },
      MARCA,
    );
  }

  // ── Página 3: Evolução temporal (chart) + Top Carretas (table) ──
  if (data.topCarretas.length > 0 || input.charts?.evolucaoTemporal) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Evolução do mês + Top 10 carretas', data.topCarretas.length);
    let yC = 20;
    if (input.charts?.evolucaoTemporal) {
      const pageWmm = doc.internal.pageSize.getWidth();
      const imgW = 240;
      const imgH = imgW * (280 / 800); // 84mm
      const x = (pageWmm - imgW) / 2;
      doc.addImage(input.charts.evolucaoTemporal, 'PNG', x, yC, imgW, imgH);
      yC += imgH + 6;
    }
    if (data.topCarretas.length > 0) drawPdfDetailTable(
      doc,
      yC,
      ['#', 'Placa', 'Transportadora', 'Saídas', 'Litros', 'Custo', 'R$/L'],
      data.topCarretas.map((r, i) => [
        String(i + 1),
        r.placa,
        r.transportadora,
        String(r.qtd),
        fmtNum(r.litros, 0),
        fmtBRL(r.custo),
        r.rPorL > 0 ? `R$ ${fmtNum(r.rPorL, 4)}` : '—',
      ]),
      ['', 'Total', '', String(data.topCarretas.reduce((s, r) => s + r.qtd, 0)),
        fmtNum(data.topCarretas.reduce((s, r) => s + r.litros, 0), 0),
        fmtBRL(data.topCarretas.reduce((s, r) => s + r.custo, 0)),
        ''],
      {
        0: { halign: 'right', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 28 },
        2: { halign: 'left', cellWidth: 70 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 32 },
        6: { halign: 'right', cellWidth: 26 },
      },
      MARCA,
    );
  }

  // ── Página 4: Top Obras + Fornecedores ──
  doc.addPage();
  drawPdfDetailPageHeader(doc, 'Top 10 obras (por custo) + Fornecedores', data.topObras.length + data.fornecedores.length);

  let yp = 18;
  if (data.topObras.length > 0) {
    yp = drawPdfSectionTitle(doc, yp, 'TOP 10 OBRAS · POR CUSTO');
    drawPdfDetailTable(
      doc,
      yp,
      ['#', 'Obra', 'Saídas', 'Litros', 'Custo', 'R$/L'],
      data.topObras.map((r, i) => [
        String(i + 1),
        r.nome,
        String(r.qtd),
        fmtNum(r.litros, 0),
        fmtBRL(r.custo),
        r.rPorL > 0 ? `R$ ${fmtNum(r.rPorL, 4)}` : '—',
      ]),
      ['', 'Total', String(data.topObras.reduce((s, r) => s + r.qtd, 0)),
        fmtNum(data.topObras.reduce((s, r) => s + r.litros, 0), 0),
        fmtBRL(data.topObras.reduce((s, r) => s + r.custo, 0)),
        ''],
      {
        0: { halign: 'right', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 100 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 36 },
        5: { halign: 'right', cellWidth: 26 },
      },
      MARCA,
    );
  }

  // Página 5: Anomalias placeholder + Fornecedores
  doc.addPage();
  drawPdfDetailPageHeader(doc, 'Fornecedores e Anomalias', data.fornecedores.length);

  let y2 = 18;
  if (data.fornecedores.length > 0) {
    y2 = drawPdfSectionTitle(doc, y2, 'FORNECEDORES (COMPRAS NO PERÍODO)');
    drawPdfDetailTable(
      doc,
      y2,
      ['#', 'Fornecedor', 'Compras', 'Litros', 'Custo', 'R$/L médio'],
      data.fornecedores.map((r, i) => [
        String(i + 1),
        r.nome,
        String(r.qtd),
        fmtNum(r.litros, 0),
        fmtBRL(r.custo),
        r.rPorL > 0 ? `R$ ${fmtNum(r.rPorL, 4)}` : '—',
      ]),
      ['', 'Total', String(data.fornecedores.reduce((s, r) => s + r.qtd, 0)),
        fmtNum(data.fornecedores.reduce((s, r) => s + r.litros, 0), 0),
        fmtBRL(data.fornecedores.reduce((s, r) => s + r.custo, 0)),
        ''],
      {
        0: { halign: 'right', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 110 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 36 },
        5: { halign: 'right', cellWidth: 26 },
      },
      MARCA,
    );
  }

  // F3.C.2 — Slot Anomalias populated. 0 anomalias = inline positivo,
  // 1+ = nova página dedicada com top 10.
  drawAnomaliasSlot(doc, input.anomalias ?? [], MARCA);

  doc.save(nomeArquivo(input.mesReferencia, 'pdf'));
}

// ════════════════════════════════════════════════════════════════════
// Excel — workbook com sheets:
//   Resumo · Equipamentos · Carretas · Obras · Fornecedores · Anomalias
// ════════════════════════════════════════════════════════════════════

export async function exportarMensalConsolidadoExcel(input: ConsolidadoInput): Promise<void> {
  const data = compute(input);
  const t = data.totais;
  const subtitulo = `${SUBTITULO_BASE} · ${formatMesRef(input.mesReferencia)}`;

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Equipamentos';

  // ── Resumo ──
  let row = renderExcelBanner(wsResumo, TITULO, subtitulo);
  row += 1;
  row = renderExcelFiltros(wsResumo, row, [
    ['Mês referência', formatMesRef(input.mesReferencia)],
    ['Total saídas', `${t.qtdSaidas} registros`],
  ]);
  row += 1;
  renderExcelKPIs(wsResumo, row, [
    { label: 'Volume Total', value: t.volume, numFmt: '#,##0 "L"' },
    { label: 'Custo Total', value: t.custo, numFmt: '"R$" #,##0.00' },
    { label: 'R$/L Médio', value: t.rPorL, numFmt: '"R$" #,##0.0000' },
    { label: 'Compras', value: t.custoCompras, numFmt: '"R$" #,##0.00' },
    { label: 'Equipamentos próprios', value: t.qtdEquipamentosProprios },
    { label: 'Carretas (placas)', value: t.qtdCarretas },
    { label: 'Obras com saída', value: t.qtdObras },
    { label: 'Fornecedores', value: t.qtdFornecedores },
  ]);

  // Sentinel warning
  if (t.qtdSentinel > 0) {
    row += 12;
    renderExcelSectionTitle(wsResumo, row, `Atenção: ${t.qtdSentinel} saída(s) sem equipamento identificado`);
    row += 1;
    wsResumo.getRow(row).getCell(1).value =
      'Atribuir retroativamente via aba "Saídas" (filtro "Apenas sem equipamento").';
    wsResumo.getRow(row).getCell(1).font = { italic: true, size: 9, color: { argb: BRAND.cinzaMedio } };
  }

  // Helper: enriquece arrays com rank (renderExcelDetalhamento.value
  // recebe só item, não index).
  const rankEq = data.topEquipamentos.map((r, i) => ({ ...r, rank: i + 1 }));
  const rankCar = data.topCarretas.map((r, i) => ({ ...r, rank: i + 1 }));
  const rankObra = data.topObras.map((r, i) => ({ ...r, rank: i + 1 }));
  const rankForn = data.fornecedores.map((r, i) => ({ ...r, rank: i + 1 }));

  // ── Sheet "Equipamentos" (top 10) ──
  renderExcelDetalhamento(wsDetalhe, rankEq, [
    { header: '#', key: 'rank', width: 6, align: 'right', value: (r) => r.rank },
    { header: 'Equipamento', key: 'nome', width: 36, value: (r) => r.nome },
    { header: 'Código', key: 'codigo', width: 18, value: (r) => r.codigo },
    { header: 'Saídas', key: 'qtd', width: 10, align: 'right', value: (r) => r.qtd, footerValue: (items) => items.reduce((s, r) => s + r.qtd, 0) },
    { header: 'Litros', key: 'litros', width: 14, align: 'right', numFmt: '#,##0', value: (r) => r.litros, footerValue: (items) => items.reduce((s, r) => s + r.litros, 0) },
    { header: 'Custo', key: 'custo', width: 18, align: 'right', numFmt: '"R$" #,##0.00', value: (r) => r.custo, footerValue: (items) => items.reduce((s, r) => s + r.custo, 0) },
    { header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.rPorL },
  ]);

  // ── Sheet "Carretas" ──
  const wsCarretas = wb.addWorksheet('Carretas', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento(wsCarretas, rankCar, [
    { header: '#', key: 'rank', width: 6, align: 'right', value: (r) => r.rank },
    { header: 'Placa', key: 'placa', width: 14, value: (r) => r.placa },
    { header: 'Transportadora', key: 'transp', width: 30, value: (r) => r.transportadora },
    { header: 'Saídas', key: 'qtd', width: 10, align: 'right', value: (r) => r.qtd, footerValue: (items) => items.reduce((s, r) => s + r.qtd, 0) },
    { header: 'Litros', key: 'litros', width: 14, align: 'right', numFmt: '#,##0', value: (r) => r.litros, footerValue: (items) => items.reduce((s, r) => s + r.litros, 0) },
    { header: 'Custo', key: 'custo', width: 18, align: 'right', numFmt: '"R$" #,##0.00', value: (r) => r.custo, footerValue: (items) => items.reduce((s, r) => s + r.custo, 0) },
    { header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.rPorL },
  ]);

  // ── Sheet "Obras" ──
  const wsObras = wb.addWorksheet('Obras', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento(wsObras, rankObra, [
    { header: '#', key: 'rank', width: 6, align: 'right', value: (r) => r.rank },
    { header: 'Obra', key: 'nome', width: 50, value: (r) => r.nome },
    { header: 'Saídas', key: 'qtd', width: 10, align: 'right', value: (r) => r.qtd, footerValue: (items) => items.reduce((s, r) => s + r.qtd, 0) },
    { header: 'Litros', key: 'litros', width: 14, align: 'right', numFmt: '#,##0', value: (r) => r.litros, footerValue: (items) => items.reduce((s, r) => s + r.litros, 0) },
    { header: 'Custo', key: 'custo', width: 18, align: 'right', numFmt: '"R$" #,##0.00', value: (r) => r.custo, footerValue: (items) => items.reduce((s, r) => s + r.custo, 0) },
    { header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.rPorL },
  ]);

  // ── Sheet "Fornecedores" ──
  const wsForn = wb.addWorksheet('Fornecedores', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento(wsForn, rankForn, [
    { header: '#', key: 'rank', width: 6, align: 'right', value: (r) => r.rank },
    { header: 'Fornecedor', key: 'nome', width: 50, value: (r) => r.nome },
    { header: 'Compras', key: 'qtd', width: 10, align: 'right', value: (r) => r.qtd, footerValue: (items) => items.reduce((s, r) => s + r.qtd, 0) },
    { header: 'Litros', key: 'litros', width: 14, align: 'right', numFmt: '#,##0', value: (r) => r.litros, footerValue: (items) => items.reduce((s, r) => s + r.litros, 0) },
    { header: 'Custo', key: 'custo', width: 18, align: 'right', numFmt: '"R$" #,##0.00', value: (r) => r.custo, footerValue: (items) => items.reduce((s, r) => s + r.custo, 0) },
    { header: 'R$/L médio', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.rPorL },
  ]);

  // ── Sheet "Anomalias" (F3.C.2) — helper compartilhado entre os 3 exports
  renderExcelAnomaliasSheet(wb, input.anomalias ?? []);

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo(input.mesReferencia, 'xlsx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
