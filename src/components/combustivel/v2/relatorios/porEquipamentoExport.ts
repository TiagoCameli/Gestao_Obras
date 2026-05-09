// Gerador do template "Por Equipamento" — PDF + Excel.
// Espelha porObraExport.ts mas escopado a um equipamento próprio em range
// arbitrário (default: últimos 90 dias). Sem TopEquipamentos chart (escopo
// já é o equipamento, single-bar não diz nada). Tabela "Top obras
// frequentes" no lugar.

import jsPDF from 'jspdf';
import type {
  Equipamento,
  Insumo,
  Obra,
  EntradaCombustivel,
  SaidaCombustivel,
} from '../../../../types';
import {
  BRAND,
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfSectionTitle,
  fmtBRL,
  fmtNum,
  formatDateBR,
  renderExcelBanner,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelDetalhamento,
  renderExcelSectionTitle,
  sanitizeFilenamePart,
} from '../../../../utils/exportTemplate';
import type { ChartImagens } from './mensalConsolidadoExport';
import type { Anomalia } from '../anomalias/detect';
import { drawAnomaliasSlot } from './pdf/anomaliasSlot';
import { renderExcelAnomaliasSheet } from './anomaliasExcelSheet';

const TITULO = 'Combustível · Relatório Por Equipamento';
const SUBTITULO_BASE = 'Histórico de consumo escopado por equipamento';
const MARCA = 'Gestão de Obras · Combustível';

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface PorEquipamentoInput {
  equipamento: Equipamento;
  /** Range inclusive em ISO YYYY-MM-DD. */
  from: string;
  to: string;
  /** Saídas já filtradas: tipoConsumidor='equipamento_proprio' + equip + range. */
  saidasEquipamento: SaidaCombustivel[];
  entradasNoPeriodo: EntradaCombustivel[];
  obras: Obra[];
  combustiveis: Insumo[];
  charts?: ChartImagens;
  /** F3.C.2 — Anomalias do escopo (saidasEquipamento). */
  anomalias?: Anomalia[];
}

interface Agg { litros: number; custo: number; qtd: number; }

/** Label compacto pro range — "Fev-Mai-2026" se mesmo ano,
 *  "Out-2025-Jan-2026" se cross-year. Filename-safe (sem /). */
export function formatRangeLabel(from: string, to: string): string {
  const [yFrom, mFrom] = from.split('-');
  const [yTo, mTo] = to.split('-');
  const mFromIdx = parseInt(mFrom, 10) - 1;
  const mToIdx = parseInt(mTo, 10) - 1;
  if (mFromIdx < 0 || mFromIdx > 11 || mToIdx < 0 || mToIdx > 11) return `${from} a ${to}`;
  if (yFrom === yTo) {
    if (mFrom === mTo) return `${MESES_CURTOS[mFromIdx]}-${yFrom}`;
    return `${MESES_CURTOS[mFromIdx]}-${MESES_CURTOS[mToIdx]}-${yFrom}`;
  }
  return `${MESES_CURTOS[mFromIdx]}-${yFrom}-${MESES_CURTOS[mToIdx]}-${yTo}`;
}

function topByLitros<T extends { litros: number }>(map: Map<string, T>, n: number): Array<[string, T]> {
  return Array.from(map.entries())
    .sort((a, b) => b[1].litros - a[1].litros)
    .slice(0, n);
}

interface PorEquipData {
  totais: {
    volume: number;
    custo: number;
    rPorL: number;
    qtdSaidas: number;
    qtdObras: number;
    diasAtivos: number;
    volumeCompras: number;
    custoCompras: number;
    qtdFornecedores: number;
  };
  topObras: Array<{ nome: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  fornecedores: Array<{ nome: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  saidasDesc: SaidaCombustivel[];
}

function compute(input: PorEquipamentoInput): PorEquipData {
  const obraMap = new Map(input.obras.map((o) => [o.id, o]));

  let volume = 0;
  let custo = 0;
  const obraSet = new Set<string>();
  const diasSet = new Set<string>();
  const aggObra = new Map<string, Agg>();

  for (const s of input.saidasEquipamento) {
    volume += s.litros;
    custo += s.valorTotal;
    diasSet.add(s.data.slice(0, 10));
    if (s.obraId) {
      obraSet.add(s.obraId);
      const cur = aggObra.get(s.obraId) ?? { litros: 0, custo: 0, qtd: 0 };
      cur.litros += s.litros;
      cur.custo += s.valorTotal;
      cur.qtd += 1;
      aggObra.set(s.obraId, cur);
    }
  }

  let volumeCompras = 0;
  let custoCompras = 0;
  const fornSet = new Set<string>();
  const aggForn = new Map<string, Agg>();
  for (const e of input.entradasNoPeriodo) {
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

  const saidasDesc = [...input.saidasEquipamento].sort((a, b) => b.data.localeCompare(a.data));

  return {
    totais: {
      volume,
      custo,
      rPorL: volume > 0 ? custo / volume : 0,
      qtdSaidas: input.saidasEquipamento.length,
      qtdObras: obraSet.size,
      diasAtivos: diasSet.size,
      volumeCompras,
      custoCompras,
      qtdFornecedores: fornSet.size,
    },
    topObras: topByLitros(aggObra, 10).map(([id, v]) => ({
      nome: obraMap.get(id)?.nome ?? id,
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
    saidasDesc,
  };
}

function nomeArquivo(input: PorEquipamentoInput, ext: 'pdf' | 'xlsx'): string {
  const slug = sanitizeFilenamePart(input.equipamento.codigoPatrimonio || input.equipamento.nome);
  const rangeSlug = formatRangeLabel(input.from, input.to);
  return `EMT - Por Equipamento - ${slug} - ${rangeSlug}.${ext}`;
}

function equipamentoLabel(eq: Equipamento): string {
  const codigo = eq.codigoPatrimonio || eq.tipo || '';
  return codigo ? `${codigo} · ${eq.nome}` : eq.nome;
}

// ════════════════════════════════════════════════════════════════════
// PDF
// ════════════════════════════════════════════════════════════════════

export function exportarPorEquipamentoPDF(input: PorEquipamentoInput): void {
  const data = compute(input);
  const t = data.totais;
  const eqLabel = equipamentoLabel(input.equipamento);
  const rangeLabel = `${formatDateBR(input.from)} a ${formatDateBR(input.to)}`;
  const subtitulo = `${eqLabel} · ${rangeLabel}`;
  const combMap = new Map(input.combustiveis.map((c) => [c.id, c.nome]));
  const obraMap = new Map(input.obras.map((o) => [o.id, o.nome]));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Página 1: Capa ──
  let y = drawPdfBanner(doc, TITULO, `${SUBTITULO_BASE} · ${subtitulo}`);
  y = drawPdfFiltros(doc, y + 4, [
    ['Equipamento', eqLabel],
    ['Período', rangeLabel],
    ['Tipo / marca', `${input.equipamento.tipo || '—'} ${input.equipamento.marca ? `· ${input.equipamento.marca}` : ''}`.trim()],
    ['Total saídas', `${t.qtdSaidas} registros · ${t.diasAtivos} dia(s) ativo(s)`],
  ]);
  y = drawPdfKPIs(doc, y + 4, [
    ['Volume Total', `${fmtNum(t.volume, 0)} L`],
    ['Custo Total', fmtBRL(t.custo)],
    ['R$/L Médio', t.rPorL > 0 ? `R$ ${fmtNum(t.rPorL, 4)}` : '—'],
    ['Saídas', String(t.qtdSaidas)],
  ]);
  y = drawPdfKPIs(doc, y + 4, [
    ['Obras atendidas', String(t.qtdObras)],
    ['Dias ativos', String(t.diasAtivos)],
    ['Fornecedores (período)', String(t.qtdFornecedores)],
    ['Compras no período', fmtBRL(t.custoCompras)],
  ]);

  // ── Página 2: Evolução temporal (chart) + Top obras frequentes (tabela) ──
  doc.addPage();
  drawPdfDetailPageHeader(doc, 'Evolução temporal + Top 10 obras frequentes', t.qtdSaidas);
  let yPg2 = 20;
  if (input.charts?.evolucaoTemporal) {
    const pageWmm = doc.internal.pageSize.getWidth();
    const imgW = 240;
    const imgH = imgW * (280 / 800);
    const x = (pageWmm - imgW) / 2;
    doc.addImage(input.charts.evolucaoTemporal, 'PNG', x, yPg2, imgW, imgH);
    yPg2 += imgH + 6;
  }
  if (data.topObras.length > 0) {
    drawPdfDetailTable(
      doc,
      yPg2,
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
        1: { halign: 'left', cellWidth: 110 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 36 },
        5: { halign: 'right', cellWidth: 26 },
      },
      MARCA,
    );
  }

  // ── Página 3: Saídas detalhadas (cronológico DESC) ──
  if (data.saidasDesc.length > 0) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Saídas detalhadas', data.saidasDesc.length);
    drawPdfDetailTable(
      doc,
      20,
      ['Data', 'Obra', 'Combustível', 'Litros', 'R$/L', 'Custo'],
      data.saidasDesc.map((s) => {
        const obra = s.obraId ? (obraMap.get(s.obraId) ?? '—') : '—';
        const rPorL = s.litros > 0 ? s.valorTotal / s.litros : 0;
        return [
          formatDateBR(s.data),
          obra,
          combMap.get(s.tipoCombustivel) ?? s.tipoCombustivel,
          fmtNum(s.litros, 0),
          rPorL > 0 ? `R$ ${fmtNum(rPorL, 4)}` : '—',
          fmtBRL(s.valorTotal),
        ];
      }),
      ['', 'Total', '',
        fmtNum(data.saidasDesc.reduce((s, x) => s + x.litros, 0), 0),
        '',
        fmtBRL(data.saidasDesc.reduce((s, x) => s + x.valorTotal, 0)),
      ],
      {
        0: { halign: 'left', cellWidth: 24 },
        1: { halign: 'left', cellWidth: 110 },
        2: { halign: 'left', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 22 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 32 },
      },
      MARCA,
    );
  }

  // ── Página final: Fornecedores + slot Anomalias placeholder ──
  // Padrão Mensal/PorObra: Anomalias renderiza no pé da mesma página
  // dos Fornecedores (yAnom = pageH - 50).
  doc.addPage();
  drawPdfDetailPageHeader(doc, 'Fornecedores e Anomalias', data.fornecedores.length);

  if (data.fornecedores.length > 0) {
    let yF = 18;
    yF = drawPdfSectionTitle(doc, yF, 'FORNECEDORES (COMPRAS NO PERÍODO — TANQUES EMT)');
    drawPdfDetailTable(
      doc,
      yF,
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

  // F3.C.2 — Slot Anomalias populated.
  drawAnomaliasSlot(doc, input.anomalias ?? [], MARCA);

  doc.save(nomeArquivo(input, 'pdf'));
}

// ════════════════════════════════════════════════════════════════════
// Excel — workbook com 4 sheets:
//   Resumo · Saídas · Obras · Fornecedores
// ════════════════════════════════════════════════════════════════════

export async function exportarPorEquipamentoExcel(input: PorEquipamentoInput): Promise<void> {
  const data = compute(input);
  const t = data.totais;
  const eqLabel = equipamentoLabel(input.equipamento);
  const rangeLabel = `${formatDateBR(input.from)} a ${formatDateBR(input.to)}`;
  const subtitulo = `${eqLabel} · ${rangeLabel}`;
  const combMap = new Map(input.combustiveis.map((c) => [c.id, c.nome]));
  const obraMap = new Map(input.obras.map((o) => [o.id, o.nome]));

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Saídas';

  // ── Resumo ──
  let row = renderExcelBanner(wsResumo, TITULO, subtitulo);
  row += 1;
  row = renderExcelFiltros(wsResumo, row, [
    ['Equipamento', eqLabel],
    ['Período', rangeLabel],
    ['Tipo / marca', `${input.equipamento.tipo || '—'} ${input.equipamento.marca ? `· ${input.equipamento.marca}` : ''}`.trim()],
    ['Total saídas', `${t.qtdSaidas} registros · ${t.diasAtivos} dia(s) ativo(s)`],
  ]);
  row += 1;
  renderExcelKPIs(wsResumo, row, [
    { label: 'Volume Total', value: t.volume, numFmt: '#,##0 "L"' },
    { label: 'Custo Total', value: t.custo, numFmt: '"R$" #,##0.00' },
    { label: 'R$/L Médio', value: t.rPorL, numFmt: '"R$" #,##0.0000' },
    { label: 'Saídas', value: t.qtdSaidas },
    { label: 'Obras atendidas', value: t.qtdObras },
    { label: 'Dias ativos', value: t.diasAtivos },
    { label: 'Fornecedores (período)', value: t.qtdFornecedores },
    { label: 'Compras no período', value: t.custoCompras, numFmt: '"R$" #,##0.00' },
  ]);

  if (t.qtdSaidas === 0) {
    row += 12;
    renderExcelSectionTitle(wsResumo, row, 'Sem saídas para este equipamento no período.');
    row += 1;
    wsResumo.getRow(row).getCell(1).value =
      'Tente um range maior ou outro equipamento.';
    wsResumo.getRow(row).getCell(1).font = { italic: true, size: 9, color: { argb: BRAND.cinzaMedio } };
  }

  // ── Sheet "Saídas" ──
  renderExcelDetalhamento(wsDetalhe, data.saidasDesc, [
    { header: 'Data', key: 'data', width: 14, value: (s) => formatDateBR(s.data) },
    { header: 'Obra', key: 'obra', width: 40, value: (s) => (s.obraId ? (obraMap.get(s.obraId) ?? '—') : '—') },
    { header: 'Combustível', key: 'comb', width: 18, value: (s) => combMap.get(s.tipoCombustivel) ?? s.tipoCombustivel },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (s) => s.litros,
      footerValue: (items) => items.reduce((acc, s) => acc + s.litros, 0),
    },
    {
      header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (s) => (s.litros > 0 ? s.valorTotal / s.litros : 0),
    },
    {
      header: 'Custo', key: 'custo', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (s) => s.valorTotal,
      footerValue: (items) => items.reduce((acc, s) => acc + s.valorTotal, 0),
    },
  ]);

  // ── Sheet "Obras" (top obras frequentes) ──
  const rankObras = data.topObras.map((r, i) => ({ ...r, rank: i + 1 }));
  const wsObras = wb.addWorksheet('Obras', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento(wsObras, rankObras, [
    { header: '#', key: 'rank', width: 6, align: 'right', value: (r) => r.rank },
    { header: 'Obra', key: 'nome', width: 50, value: (r) => r.nome },
    { header: 'Saídas', key: 'qtd', width: 10, align: 'right', value: (r) => r.qtd, footerValue: (items) => items.reduce((s, r) => s + r.qtd, 0) },
    { header: 'Litros', key: 'litros', width: 14, align: 'right', numFmt: '#,##0', value: (r) => r.litros, footerValue: (items) => items.reduce((s, r) => s + r.litros, 0) },
    { header: 'Custo', key: 'custo', width: 18, align: 'right', numFmt: '"R$" #,##0.00', value: (r) => r.custo, footerValue: (items) => items.reduce((s, r) => s + r.custo, 0) },
    { header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.rPorL },
  ]);

  // ── Sheet "Fornecedores" ──
  const rankForn = data.fornecedores.map((r, i) => ({ ...r, rank: i + 1 }));
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

  // F3.C.2 — Sheet "Anomalias" do escopo do equipamento
  renderExcelAnomaliasSheet(wb, input.anomalias ?? []);

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo(input, 'xlsx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
