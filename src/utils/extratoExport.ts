// Export PDF/Excel pra extrato cronológico de transportadora.
// Reusa helpers do exportTemplate.ts pra manter visual consistente.

import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import type { TransportadoraMovimento, TipoMovimentoTransportadora, MetodoPagamentoFrete } from '../types';
import {
  BRAND,
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  fmtBRL,
  formatDateBR,
  fillSolid,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelSectionTitle,
  saveWorkbook,
  thinBorder,
  type ExcelMiniTableColumn,
  type ExcelMiniTableRow,
} from './exportTemplate';

export interface ExtratoFiltros {
  mesReferencia: string;
  tipos: TipoMovimentoTransportadora[];
  busca: string;
}

const TITULO = 'Extrato de Conta-Corrente';
const SUBTITULO = 'Transportadora · Movimentos';
const SCOPE = 'extrato_transportadora';
const MARCA = 'Gestão de Obras · Conta Corrente Transportadora';

export const TIPO_LABEL: Record<TipoMovimentoTransportadora, string> = {
  credito_frete: 'Crédito · Frete',
  debito_pagamento_frete: 'Débito · Pagamento',
  credito_abastecimento_transterra: 'Crédito · Abast. (Transterra)',
  debito_abastecimento_transterra: 'Débito · Abast. (Transterra)',
  debito_abastecimento_emt: 'Débito · Abast. (EMT)',
  ajuste_manual_credito: 'Crédito · Ajuste manual',
  ajuste_manual_debito: 'Débito · Ajuste manual',
};

export const TIPOS_CREDITO: ReadonlySet<TipoMovimentoTransportadora> = new Set([
  'credito_frete',
  'credito_abastecimento_transterra',
  'ajuste_manual_credito',
]);

const METODO_LABEL: Record<MetodoPagamentoFrete, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  combustivel: 'Combustível',
};

function categoriaAbastecimento(tipo: TipoMovimentoTransportadora): string {
  if (tipo === 'debito_abastecimento_transterra') return 'Transterra';
  if (tipo === 'debito_abastecimento_emt') return 'EMT';
  return '';
}

// ────────────────────────────────────────────────────────────────────
// TEMA — paleta estendida do Resumo (espelha mockup Areacre).
// Cores semânticas por aba; KPIs com 6 cores distintas; "Como auditar"
// com badges; "Fórmula" com pílulas verdes.
// ────────────────────────────────────────────────────────────────────

interface TemaAba { title: string; header: string; cell: string; }

const TEMA = {
  // 6 KPIs do header
  kpiSaldo:      'FF1E5A38',
  kpiCreditos:   'FF16A34A',
  kpiDebitos:    'FFDC2626',
  kpiTotal:      'FF2563EB',
  kpiFretes:     'FF7C3AED',
  kpiPagamentos: 'FFEA580C',
  // Tabelas tematizadas por aba
  fretes:     { title: 'FF16A34A', header: 'FF15803D', cell: 'FFF0FDF4' } as TemaAba,
  tanque:     { title: 'FF0891B2', header: 'FF0E7490', cell: 'FFECFEFF' } as TemaAba,
  pagamentos: { title: 'FFDC2626', header: 'FFB91C1C', cell: 'FFFEF2F2' } as TemaAba,
  ajustes:    { title: 'FF7C3AED', header: 'FF6D28D9', cell: 'FFF5F3FF' } as TemaAba,
  abast:      { title: 'FFEA580C', header: 'FFC2410C', cell: 'FFFFF7ED' } as TemaAba,
  todos:      { title: 'FF1E5A38', header: 'FF14532D', cell: 'FFF0FDF4' } as TemaAba,
  // "AS 7 ABAS" — header dark gray
  abas7Title:  'FF1E5A38',
  abas7Header: 'FF374151',
  // Badges "Como auditar"
  badge: {
    emerald: { circle: 'FF16A34A', bg: 'FFDCFCE7' },
    red:     { circle: 'FFDC2626', bg: 'FFFEE2E2' },
    blue:    { circle: 'FF2563EB', bg: 'FFDBEAFE' },
  },
  // Pílulas "Fórmula"
  pillBg: 'FFDCFCE7',
  pillFg: 'FF15803D',
};

/** Renderiza 6 KPI cards coloridos (label colorido + valor branco com texto na cor). */
function renderColoredKPIs(
  ws: ExcelJS.Worksheet,
  startRow: number,
  kpis: Array<{ label: string; value: number | string; numFmt?: string; color: string }>,
): number {
  let row = renderExcelSectionTitle(ws, startRow, 'INDICADORES');
  row++;
  const labelRow = row;
  const valueRow = row + 1;
  kpis.forEach((k, i) => {
    const col = i + 1;
    const labelCell = ws.getCell(labelRow, col);
    labelCell.value = k.label;
    labelCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: BRAND.branco } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    labelCell.fill = fillSolid(k.color);
    labelCell.border = thinBorder();
    const valCell = ws.getCell(valueRow, col);
    valCell.value = k.value;
    if (k.numFmt) valCell.numFmt = k.numFmt;
    valCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: k.color } };
    valCell.alignment = { vertical: 'middle', horizontal: 'center' };
    valCell.fill = fillSolid(BRAND.branco);
    valCell.border = thinBorder();
  });
  ws.getRow(labelRow).height = 22;
  ws.getRow(valueRow).height = 36;
  return valueRow + 2;
}

/** Título de seção colorido (espelha renderExcelSectionTitle mas com cor custom). */
function renderColoredTitle(
  ws: ExcelJS.Worksheet,
  row: number,
  text: string,
  color: string,
): number {
  ws.mergeCells(`A${row}:F${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: color } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border = { bottom: { style: 'medium', color: { argb: color } } } as unknown as ExcelJS.Borders;
  ws.getRow(row).height = 22;
  return row + 1;
}

/** Mini-table tematizada por aba (título colorido, header sólido escuro, células tinted). */
function renderThemedMiniTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  titulo: string,
  columns: ExcelMiniTableColumn[],
  rows: ExcelMiniTableRow[],
  footer: (string | number)[],
  tema: TemaAba,
): number {
  let row = renderColoredTitle(ws, startRow, titulo, tema.title);
  // Header (cor escura do tema, texto branco)
  columns.forEach((col, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    cell.fill = fillSolid(tema.header);
    const align = col.align || (i === 0 ? 'left' : 'right');
    cell.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
    cell.border = thinBorder();
  });
  ws.getRow(row).height = 22;
  row++;
  // Body (bg tinted do tema, texto cinza escuro)
  rows.forEach((r) => {
    r.cells.forEach((val, i) => {
      const col = columns[i];
      const cell = ws.getCell(row, i + 1);
      cell.value = val as ExcelJS.CellValue;
      if (col?.numFmt) cell.numFmt = col.numFmt;
      cell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
      const align = col?.align || (i === 0 ? 'left' : 'right');
      cell.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
      cell.fill = fillSolid(tema.cell);
      cell.border = thinBorder();
    });
    ws.getRow(row).height = 18;
    row++;
  });
  // Footer (cor escura do tema, texto branco — mesmo do header)
  footer.forEach((val, i) => {
    const col = columns[i];
    const cell = ws.getCell(row, i + 1);
    cell.value = val as ExcelJS.CellValue;
    if (col?.numFmt && typeof val === 'number') cell.numFmt = col.numFmt;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    const align = col?.align || (i === 0 ? 'left' : 'right');
    cell.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
    cell.fill = fillSolid(tema.header);
    cell.border = thinBorder();
  });
  ws.getRow(row).height = 20;
  return row + 2;
}

/** "Como auditar" — lista de itens em formato badge (# circle + título + texto). */
function renderAuditBadgeList(
  ws: ExcelJS.Worksheet,
  startRow: number,
  items: Array<{ num: string; titulo: string; texto: string; tom: 'emerald' | 'red' | 'blue' }>,
): number {
  let row = renderExcelSectionTitle(ws, startRow, 'Como auditar / conferir os números');
  items.forEach((it) => {
    const tom = TEMA.badge[it.tom];
    // # (círculo)
    const numCell = ws.getCell(row, 1);
    numCell.value = it.num;
    numCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND.branco } };
    numCell.alignment = { vertical: 'middle', horizontal: 'center' };
    numCell.fill = fillSolid(tom.circle);
    numCell.border = thinBorder();
    // Título (cor do círculo, bg suave)
    const tituloCell = ws.getCell(row, 2);
    tituloCell.value = it.titulo;
    tituloCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: tom.circle } };
    tituloCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    tituloCell.fill = fillSolid(tom.bg);
    tituloCell.border = thinBorder();
    // Texto explicativo (C..F merged, bg suave)
    ws.mergeCells(`C${row}:F${row}`);
    const textoCell = ws.getCell(row, 3);
    textoCell.value = it.texto;
    textoCell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
    textoCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    textoCell.fill = fillSolid(tom.bg);
    textoCell.border = thinBorder();
    ws.getRow(row).height = 24;
    row++;
  });
  return row + 1;
}

/** Renderiza linha-equação com pílulas verdes + operadores + final em verde sólido. */
function renderFormulaEquation(
  ws: ExcelJS.Worksheet,
  row: number,
  cells: Array<{ kind: 'pill' | 'op' | 'final'; label: string; valor?: number }>,
  finalSpansLastTwo: boolean = false,
): number {
  const labelRow = ws.getRow(row);
  const valueRow = ws.getRow(row + 1);

  cells.forEach((c, i) => {
    const colIdx = i + 1;
    const lc = labelRow.getCell(colIdx);
    const vc = valueRow.getCell(colIdx);

    lc.alignment = { vertical: 'middle', horizontal: 'center' };
    vc.alignment = { vertical: 'middle', horizontal: 'center' };
    lc.border = thinBorder();
    vc.border = thinBorder();

    if (c.kind === 'op') {
      lc.value = c.label;
      lc.font = { name: 'Calibri', size: 14, bold: true, color: { argb: BRAND.cinzaMedio } };
      lc.fill = fillSolid(BRAND.branco);
      vc.value = '';
      vc.fill = fillSolid(BRAND.branco);
    } else if (c.kind === 'pill') {
      lc.value = c.label;
      lc.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEMA.pillFg } };
      lc.fill = fillSolid(TEMA.pillBg);
      vc.value = c.valor ?? 0;
      vc.numFmt = '"R$" #,##0.00';
      vc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: TEMA.pillFg } };
      vc.fill = fillSolid(TEMA.pillBg);
    } else {
      // final
      lc.value = c.label;
      lc.font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.branco } };
      lc.fill = fillSolid(BRAND.verdeEscuro);
      vc.value = c.valor ?? 0;
      vc.numFmt = '"R$" #,##0.00';
      vc.font = { name: 'Calibri', size: 12, bold: true, color: { argb: BRAND.branco } };
      vc.fill = fillSolid(BRAND.verdeEscuro);
    }
  });

  if (finalSpansLastTwo && cells.length === 5) {
    ws.mergeCells(`E${row}:F${row}`);
    ws.mergeCells(`E${row + 1}:F${row + 1}`);
  }

  labelRow.height = 20;
  valueRow.height = 28;
  return row + 2;
}

/** Contexto opcional pro export — Maps id→nome pra resolver FKs soft. */
export interface ExtratoExportContext {
  insumosMap?: Map<string, string>;
  obrasMap?: Map<string, string>;
}

function resolverNome(map: Map<string, string> | undefined) {
  return (id: string | null | undefined): string => {
    if (!id) return '';
    return map?.get(id) ?? id;
  };
}

// ────────────────────────────────────────────────────────────────────
// formatBreakdown — fórmula que produziu o valor do movimento.
//
// Usado em 3 lugares (modal, Excel, PDF) — fonte única evita drift.
// Retorna string vazia quando não há dados pra calcular (evita ruído
// tipo "× R$ 0 = R$ 0" em ajustes manuais sem origem).
// ────────────────────────────────────────────────────────────────────

function fmtNumDec(n: number, dec: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}
function fmtL(n: number): string {
  return `${fmtNumDec(n, 0)} L`;
}
function fmtTon(n: number): string {
  return `${fmtNumDec(n, 2)} t`;
}
function fmtKm(n: number): string {
  return `${fmtNumDec(n, 1)} km`;
}
function fmtPrecoL(n: number): string {
  return `R$ ${fmtNumDec(n, 4)}/L`;
}
function fmtPrecoTkm(n: number): string {
  return `R$ ${fmtNumDec(n, 4)}/tkm`;
}

export function formatBreakdown(m: TransportadoraMovimento): string {
  switch (m.tipo) {
    case 'credito_frete': {
      const peso = m.fretePesoToneladas ?? 0;
      const km = m.freteKmRodados ?? 0;
      const tkm = m.freteValorTkm ?? 0;
      if (peso <= 0 || km <= 0 || tkm <= 0) return '';
      return `${fmtTon(peso)} × ${fmtKm(km)} × ${fmtPrecoTkm(tkm)} = ${fmtBRL(peso * km * tkm)}`;
    }

    case 'debito_abastecimento_transterra': {
      const litros = m.saidaLitros ?? 0;
      const preco = m.saidaPrecoCombustivel ?? 0;
      const taxa = m.saidaTaxaLitro ?? 0;
      if (litros <= 0 || preco <= 0) return '';
      const precoFinal = preco + taxa;
      return taxa > 0
        ? `${fmtL(litros)} × (${fmtPrecoL(preco)} + ${fmtPrecoL(taxa)} taxa) = ${fmtBRL(litros * precoFinal)}`
        : `${fmtL(litros)} × ${fmtPrecoL(preco)} = ${fmtBRL(litros * precoFinal)}`;
    }

    case 'credito_abastecimento_transterra': {
      const litros = m.saidaLitros ?? 0;
      const preco = m.saidaPrecoCombustivelAreacre ?? m.saidaPrecoCombustivel ?? 0;
      const taxa = m.saidaTaxaLitro ?? 0;
      if (litros <= 0 || preco <= 0) return '';
      const precoFinal = preco + taxa;
      return taxa > 0
        ? `${fmtL(litros)} × (${fmtPrecoL(preco)} Areacre + ${fmtPrecoL(taxa)} taxa) = ${fmtBRL(litros * precoFinal)}`
        : `${fmtL(litros)} × ${fmtPrecoL(preco)} (Areacre) = ${fmtBRL(litros * precoFinal)}`;
    }

    case 'debito_abastecimento_emt': {
      const litros = m.saidaLitros ?? 0;
      // Em tanque EMT, preco_combustivel guarda preço médio + taxa (precoUnitario);
      // preco_medio_tanque_snapshot guarda só o médio sem taxa.
      const precoMedio = m.saidaPrecoMedioTanque ?? 0;
      const taxa = m.saidaTaxaLitro ?? 0;
      if (litros <= 0 || precoMedio <= 0) {
        // Fallback: deriva preço pelo total / litros
        if (litros > 0) return `${fmtL(litros)} × ${fmtPrecoL(m.valor / litros)} (preço médio)`;
        return '';
      }
      return taxa > 0
        ? `${fmtL(litros)} × (${fmtPrecoL(precoMedio)} médio + ${fmtPrecoL(taxa)} taxa) = ${fmtBRL(litros * (precoMedio + taxa))}`
        : `${fmtL(litros)} × ${fmtPrecoL(precoMedio)} (preço médio do tanque) = ${fmtBRL(litros * precoMedio)}`;
    }

    case 'debito_pagamento_frete': {
      const partes: string[] = [];
      if (m.pagamentoMetodo) partes.push(`Método: ${m.pagamentoMetodo}`);
      if (m.mesReferencia) partes.push(`Ref: ${m.mesReferencia.slice(0, 7)}`);
      return partes.join(' · ');
    }

    case 'ajuste_manual_credito':
    case 'ajuste_manual_debito':
      return 'Ajuste manual lançado no extrato';
  }
  return '';
}

interface MovimentoComSaldo extends TransportadoraMovimento {
  saldoAcumulado: number;
}

function prepararExtrato(
  movimentos: TransportadoraMovimento[],
  filtros: ExtratoFiltros
): MovimentoComSaldo[] {
  let filtrados = movimentos;
  if (filtros.mesReferencia) {
    filtrados = filtrados.filter((m) => m.mesReferencia === filtros.mesReferencia);
  }
  if (filtros.tipos.length > 0) {
    const setTipos = new Set(filtros.tipos);
    filtrados = filtrados.filter((m) => setTipos.has(m.tipo));
  }
  if (filtros.busca.trim()) {
    const q = filtros.busca.trim().toLowerCase();
    filtrados = filtrados.filter((m) => (m.descricao ?? '').toLowerCase().includes(q));
  }
  // Saldo acumulado em ordem ASC, retorna DESC pra display tipo extrato bancário.
  const asc = [...filtrados].sort((a, b) => a.data.localeCompare(b.data));
  let acc = 0;
  const comSaldo = asc.map((m) => {
    acc += TIPOS_CREDITO.has(m.tipo) ? m.valor : -m.valor;
    return { ...m, saldoAcumulado: acc };
  });
  return comSaldo.reverse();
}

function totaisFromList(movs: MovimentoComSaldo[]) {
  let creditos = 0;
  let debitos = 0;
  for (const m of movs) {
    if (TIPOS_CREDITO.has(m.tipo)) creditos += m.valor;
    else debitos += m.valor;
  }
  const saldoFinal = movs[0]?.saldoAcumulado ?? 0;
  return { creditos, debitos, saldoFinal, qtd: movs.length };
}

function filtrosToTuples(filtros: ExtratoFiltros): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (filtros.mesReferencia) out.push(['Mês de Referência', filtros.mesReferencia]);
  if (filtros.tipos.length > 0) {
    out.push(['Tipos', filtros.tipos.map((t) => TIPO_LABEL[t]).join(' · ')]);
  }
  if (filtros.busca.trim()) out.push(['Busca', filtros.busca.trim()]);
  return out;
}

// ════════════════════════════════════════════════════════════════════
// Excel — workbook com 6 sheets:
//   Resumo · Todos · Fretes · Abastecimentos · Pagamentos · Ajustes
// Cada sheet de tipo é filtrada pelo mês (filtros.mesReferencia) e
// mostra colunas detalhadas próprias (espelha as abas da UI).
// ════════════════════════════════════════════════════════════════════

export async function exportarExtratoExcel(
  transportadoraNome: string,
  movimentos: TransportadoraMovimento[],
  filtros: ExtratoFiltros,
  context?: ExtratoExportContext,
): Promise<void> {
  const insumoNome = resolverNome(context?.insumosMap);
  const obraNome = resolverNome(context?.obrasMap);

  // "Todos" — cronológico com saldo acumulado, aplica filtros completos.
  const dadosTodos = prepararExtrato(movimentos, filtros);
  const totais = totaisFromList(dadosTodos);

  // Subsets por tipo — só o filtro de mês importa (tipos/busca não fazem
  // sentido aqui; cada aba tem seu próprio escopo).
  const movsMes = filtros.mesReferencia
    ? movimentos.filter((m) => m.mesReferencia === filtros.mesReferencia)
    : movimentos;

  const sortDesc = (a: TransportadoraMovimento, b: TransportadoraMovimento) =>
    b.data.localeCompare(a.data);

  const fretes = movsMes.filter((m) => m.tipo === 'credito_frete').sort(sortDesc);
  const abastecimentos = movsMes
    .filter((m) => m.tipo === 'debito_abastecimento_transterra' || m.tipo === 'debito_abastecimento_emt')
    .sort(sortDesc);
  // Créditos de tanque: outras transportadoras abastecem em tanque
  // próprio da transportadora atual (típico Areacre como dona da
  // Transterra). Sheet/página dedicada — em transportadoras que não
  // são donas de tanque, lista vai vazia (mesma semântica de Abastecimentos
  // pra Areacre).
  const creditosTanque = movsMes.filter((m) => m.tipo === 'credito_abastecimento_transterra').sort(sortDesc);
  const pagamentos = movsMes.filter((m) => m.tipo === 'debito_pagamento_frete').sort(sortDesc);
  const ajustes = movsMes
    .filter((m) => m.tipo === 'ajuste_manual_credito' || m.tipo === 'ajuste_manual_debito')
    .sort(sortDesc);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Todos';

  // ── Sheet "Resumo" ──
  let row = renderExcelBanner(wsResumo, TITULO, `${transportadoraNome} · ${SUBTITULO}`);
  row += 1;
  row = renderExcelFiltros(wsResumo, row, filtrosToTuples(filtros));
  row += 1;
  row = renderColoredKPIs(wsResumo, row, [
    { label: 'SALDO DO PERÍODO', value: totais.saldoFinal, numFmt: '"R$" #,##0.00', color: TEMA.kpiSaldo },
    { label: 'CRÉDITOS (A RECEBER)', value: totais.creditos, numFmt: '"R$" #,##0.00', color: TEMA.kpiCreditos },
    { label: 'DÉBITOS (RECEBIDOS)', value: totais.debitos, numFmt: '"R$" #,##0.00', color: TEMA.kpiDebitos },
    { label: 'TOTAL MOVIMENTOS', value: totais.qtd, color: TEMA.kpiTotal },
    { label: 'FRETES NO MÊS', value: fretes.length, color: TEMA.kpiFretes },
    { label: 'PAGAMENTOS NO MÊS', value: pagamentos.length, color: TEMA.kpiPagamentos },
  ]);
  row += 1;

  // ────────────────────────────────────────────────────────────────────
  // SEÇÃO "COMO LER ESTA PLANILHA — PASSO A PASSO"
  // ────────────────────────────────────────────────────────────────────
  row = renderExcelSectionTitle(wsResumo, row, 'Como ler esta planilha — passo a passo');
  row += 1;

  // O QUE É ESTA PLANILHA?
  row = renderExcelSectionTitle(wsResumo, row, 'O que é esta planilha?');
  wsResumo.mergeCells(`A${row}:F${row + 1}`);
  const oqueCell = wsResumo.getCell(`A${row}`);
  oqueCell.value =
    `É um extrato de conta-corrente da transportadora ${transportadoraNome.toUpperCase()} com a EMT Construtora. ` +
    `A transportadora gera créditos quando presta serviços (fretes) e/ou fornece combustível, e a EMT gera débitos quando paga por esses serviços. ` +
    `O saldo mostra quem deve a quem ao final do mês.`;
  oqueCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
  oqueCell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
  wsResumo.getRow(row).height = 32;
  wsResumo.getRow(row + 1).height = 16;
  row += 3;

  // AS 7 ABAS DA PLANILHA
  const abasRows = [
    { cells: ['Resumo', 'Painel', 'Painel de bordo com os números finais do mês', '—', '—', '—'] },
    { cells: ['Todos', 'Extrato', 'Extrato completo com todos os lançamentos do mês, em ordem cronológica decrescente', 'Consolida as demais abas', dadosTodos.length, totais.saldoFinal] },
    { cells: ['Fretes', 'Crédito', 'Cada viagem de carreta (pedreira → usina), com NF, placa e motorista', 'Peso (t) × KM × R$/tkm', fretes.length, fretes.reduce((s, m) => s + m.valor, 0)] },
    { cells: ['Abastecimentos', 'Débito', 'Abastecimentos da própria transportadora em tanques externos (Transterra/EMT)', 'Litros × Preço/L', abastecimentos.length, abastecimentos.reduce((s, m) => s + m.valor, 0)] },
    { cells: ['Abast. Tanque', 'Crédito', 'Combustível fornecido pela transportadora no próprio tanque (quando aplicável)', 'Litros × Preço/L (tanque)', creditosTanque.length, creditosTanque.reduce((s, m) => s + m.valor, 0)] },
    { cells: ['Pagamentos', 'Débito', 'Pagamentos recebidos da EMT Construtora', 'Valor da NF de cada pagamento', pagamentos.length, pagamentos.reduce((s, m) => s + m.valor, 0)] },
    { cells: ['Ajustes', '—', 'Correções manuais (ex: diferença de preço de combustível de mês anterior)', 'Valor lançado manualmente', ajustes.length, ajustes.reduce((s, m) => s + (TIPOS_CREDITO.has(m.tipo) ? m.valor : -m.valor), 0)] },
  ];
  row = renderThemedMiniTable(
    wsResumo,
    row,
    'As 7 abas da planilha',
    [
      { header: 'Aba', align: 'left', width: 18 },
      { header: 'Grupo', align: 'left', width: 12 },
      { header: 'Para que serve', align: 'left', width: 54 },
      { header: 'Cálculo', align: 'left', width: 30 },
      { header: 'Registros', align: 'right', width: 12, numFmt: '#,##0' },
      { header: 'Total (R$)', align: 'right', width: 18, numFmt: '"R$" #,##0.00' },
    ],
    abasRows,
    ['—', '—', '—', '—', dadosTodos.length, totais.saldoFinal],
    { title: TEMA.abas7Title, header: TEMA.abas7Header, cell: BRAND.branco },
  );
  row += 1;

  // COMO LER UMA LINHA DA ABA TODOS — exemplo real da 1ª linha de dado
  const exemploRow = dadosTodos[0];
  if (exemploRow) {
    const exemploCalculo = formatBreakdown(exemploRow);
    const exemploCredito = TIPOS_CREDITO.has(exemploRow.tipo) ? fmtBRL(exemploRow.valor) : '—';
    const exemploDebito = TIPOS_CREDITO.has(exemploRow.tipo) ? '—' : fmtBRL(exemploRow.valor);
    row = renderThemedMiniTable(
      wsResumo,
      row,
      'Como ler uma linha da aba "Todos"',
      [
        { header: 'Coluna', align: 'center', width: 10 },
        { header: 'Nome', align: 'left', width: 16 },
        { header: 'O que mostra', align: 'left', width: 50 },
        { header: 'Exemplo real (1ª linha)', align: 'left', width: 50 },
      ],
      [
        { cells: ['A', 'Data', 'Dia em que o lançamento ocorreu', formatDateBR(exemploRow.data)] },
        { cells: ['B', 'Tipo', 'Origem do lançamento (frete / abast. / ajuste / pagamento)', TIPO_LABEL[exemploRow.tipo]] },
        { cells: ['C', 'Descrição', 'Detalhe: NF, rota, etc.', exemploRow.descricao ?? '—'] },
        { cells: ['D', 'Cálculo', 'Memória de cálculo — explica como o valor foi obtido', exemploCalculo || '—'] },
        { cells: ['E', 'Crédito', 'Valor positivo (entrada para a transportadora)', exemploCredito] },
        { cells: ['F', 'Débito', 'Valor negativo (pagamento recebido pela transportadora)', exemploDebito] },
        { cells: ['G', 'Saldo', 'Saldo acumulado até aquela linha. A 1ª linha = saldo final do mês', `${fmtBRL(exemploRow.saldoAcumulado)} (1ª linha = fim do mês)`] },
      ],
      ['—', '—', '—', '—'],
      TEMA.todos,
    );
    row += 1;
  }

  // COMO AUDITAR / CONFERIR OS NÚMEROS — badges semânticos
  row = renderAuditBadgeList(wsResumo, row, [
    { num: '1º', titulo: 'Conferir um frete', texto: 'Abra a aba "Fretes", localize a NF, multiplique Peso (t) × KM × R$/tkm e confira a coluna Valor.', tom: 'emerald' },
    { num: '2º', titulo: 'Conferir um abastecimento', texto: 'Abra a aba "Abast. Tanque" (ou "Abastecimentos"), multiplique Litros × Preço/L e confira a coluna Crédito (ou Total).', tom: 'emerald' },
    { num: '3º', titulo: 'Conferir um pagamento', texto: 'Abra a aba "Pagamentos". Cada linha tem a NF, os litros pagos, o valor médio/L e o valor total.', tom: 'red' },
    { num: '4º', titulo: 'Conferir o saldo total', texto: 'Veja a 1ª linha de dados da aba "Todos" — a coluna "Saldo" da 1ª linha é o saldo final do mês.', tom: 'blue' },
  ]);

  // FÓRMULA DO SALDO DO PERÍODO
  const totalFretes = fretes.reduce((s, m) => s + m.valor, 0);
  const totalAbastTanque = creditosTanque.reduce((s, m) => s + m.valor, 0);
  const totalAjustesCredito = ajustes.filter((m) => m.tipo === 'ajuste_manual_credito').reduce((s, m) => s + m.valor, 0);
  const totalPagamentos = pagamentos.reduce((s, m) => s + m.valor, 0);
  const totalCreditosCalc = totalFretes + totalAbastTanque + totalAjustesCredito;

  row = renderExcelSectionTitle(wsResumo, row, 'Fórmula do Saldo do Período');
  // Eq 1: Fretes + Abast. Tanque + Ajustes = Créditos (6 colunas)
  row = renderFormulaEquation(wsResumo, row, [
    { kind: 'pill', label: 'Fretes', valor: totalFretes },
    { kind: 'op', label: '+' },
    { kind: 'pill', label: 'Abast. Tanque', valor: totalAbastTanque },
    { kind: 'op', label: '+' },
    { kind: 'pill', label: 'Ajustes', valor: totalAjustesCredito },
    { kind: 'final', label: '= Créditos', valor: totalCreditosCalc },
  ]);
  row++;
  // Eq 2: Créditos − Pagamentos = Saldo do Período (E:F merged no final)
  row = renderFormulaEquation(wsResumo, row, [
    { kind: 'pill', label: 'Créditos', valor: totalCreditosCalc },
    { kind: 'op', label: '−' },
    { kind: 'pill', label: 'Pagamentos', valor: totalPagamentos },
    { kind: 'op', label: '=' },
    { kind: 'final', label: 'Saldo do Período', valor: totais.saldoFinal },
  ], true);
  row += 2;

  // ────────────────────────────────────────────────────────────────────
  // SEÇÃO "DETALHAMENTO POR ABA"
  // ────────────────────────────────────────────────────────────────────
  row = renderExcelSectionTitle(wsResumo, row, 'Detalhamento por aba');
  row += 1;

  // ABA FRETES
  if (fretes.length > 0) {
    const totalToneladas = fretes.reduce((s, m) => s + (m.fretePesoToneladas ?? 0), 0);
    const totalKm = fretes.reduce((s, m) => s + (m.freteKmRodados ?? 0), 0);
    const valorMedioFrete = fretes.length > 0 ? totalFretes / fretes.length : 0;
    const pesoMedio = fretes.length > 0 ? totalToneladas / fretes.length : 0;
    const tarifaMedia = fretes.length > 0
      ? fretes.reduce((s, m) => s + (m.freteValorTkm ?? 0), 0) / fretes.length
      : 0;

    row = renderThemedMiniTable(
      wsResumo,
      row,
      '🚚  Aba Fretes — Viagens de carreta',
      [
        { header: 'Indicador', align: 'left', width: 30 },
        { header: 'Valor', align: 'right', width: 18, numFmt: '#,##0.0000' },
        { header: 'Fórmula / explicação', align: 'left', width: 60 },
      ],
      [
        { cells: ['Total de viagens', fretes.length, 'Conta as linhas da aba Fretes'] },
        { cells: ['Total transportado (t)', totalToneladas, 'Soma da coluna "Peso (t)"'] },
        { cells: ['Peso médio por viagem (t)', pesoMedio, 'Média da coluna "Peso (t)"'] },
        { cells: ['Valor médio por viagem', valorMedioFrete, 'Média da coluna "Valor"'] },
        { cells: ['KM total rodado', totalKm, 'Soma da coluna "KM"'] },
        { cells: ['Tarifa (R$/tkm)', tarifaMedia, 'Média da coluna "R$/tkm"'] },
        { cells: ['Valor total em fretes', totalFretes, 'Soma da coluna "Valor" (crédito)'] },
      ],
      ['—', '—', '—'],
      TEMA.fretes,
    );
    row += 1;
  }

  // ABA ABAST. TANQUE
  if (creditosTanque.length > 0) {
    const litrosTotalCT = creditosTanque.reduce((s, m) => s + (m.saidaLitros ?? 0), 0);
    const placasUnicas = new Set(creditosTanque.map((m) => (m.saidaPlaca ?? '').trim()).filter(Boolean)).size;
    const precoMedioCT = litrosTotalCT > 0 ? totalAbastTanque / litrosTotalCT : 0;

    row = renderThemedMiniTable(
      wsResumo,
      row,
      '⛽  Aba Abast. Tanque — Combustível fornecido pela transportadora',
      [
        { header: 'Indicador', align: 'left', width: 30 },
        { header: 'Valor', align: 'right', width: 18, numFmt: '#,##0.0000' },
        { header: 'Fórmula / explicação', align: 'left', width: 60 },
      ],
      [
        { cells: ['Total de abastecimentos', creditosTanque.length, 'Quantidade de lançamentos na aba'] },
        { cells: ['Litros totais abastecidos', litrosTotalCT, 'Total da coluna "Litros" na aba'] },
        { cells: ['Preço médio por litro', precoMedioCT, 'Valor total ÷ Litros totais'] },
        { cells: ['Qtd de placas diferentes', placasUnicas, 'Carretas distintas que abasteceram'] },
        { cells: ['Valor total fornecido', totalAbastTanque, 'Total da coluna "Crédito"'] },
      ],
      ['—', '—', '—'],
      TEMA.tanque,
    );
    row += 1;
  }

  // ABA PAGAMENTOS
  if (pagamentos.length > 0) {
    const litrosPagos = pagamentos.reduce((s, m) => s + (m.pagamentoQuantidadeCombustivel ?? 0), 0);
    const valorMedioPagto = pagamentos.length > 0 ? totalPagamentos / pagamentos.length : 0;
    const valorMedioPorLPago = litrosPagos > 0 ? totalPagamentos / litrosPagos : 0;

    row = renderThemedMiniTable(
      wsResumo,
      row,
      '💰  Aba Pagamentos — Recebidos da EMT Construtora',
      [
        { header: 'Indicador', align: 'left', width: 30 },
        { header: 'Valor', align: 'right', width: 18, numFmt: '#,##0.0000' },
        { header: 'Fórmula / explicação', align: 'left', width: 60 },
      ],
      [
        { cells: ['Qtd de pagamentos', pagamentos.length, 'Notas fiscais recebidas no mês'] },
        { cells: ['Litros totais pagos', litrosPagos, 'Soma da coluna "Combustível (L)"'] },
        { cells: ['Valor médio por litro pago', valorMedioPorLPago, 'Valor total ÷ Litros totais pagos'] },
        { cells: ['Valor médio por pagamento', valorMedioPagto, 'Média da coluna "Valor"'] },
        { cells: ['Valor total recebido', totalPagamentos, 'Total da coluna "Valor" (débito)'] },
      ],
      ['—', '—', '—'],
      TEMA.pagamentos,
    );
    row += 1;
  }

  // ABA AJUSTES
  if (ajustes.length > 0) {
    const ajustesCredito = ajustes.filter((m) => m.tipo === 'ajuste_manual_credito');
    const ajustesDebito = ajustes.filter((m) => m.tipo === 'ajuste_manual_debito');
    const totalAjusteCred = ajustesCredito.reduce((s, m) => s + m.valor, 0);
    const totalAjusteDeb = ajustesDebito.reduce((s, m) => s + m.valor, 0);

    row = renderThemedMiniTable(
      wsResumo,
      row,
      '⚖️  Aba Ajustes — Correções manuais',
      [
        { header: 'Indicador', align: 'left', width: 30 },
        { header: 'Valor', align: 'right', width: 18, numFmt: '"R$" #,##0.00' },
        { header: 'Fórmula / explicação', align: 'left', width: 60 },
      ],
      [
        { cells: ['Qtd de ajustes', ajustes.length, 'Lançamentos manuais no mês'] },
        { cells: ['Total créditos (ajustes)', totalAjusteCred, `${ajustesCredito.length} lançamento(s) de crédito`] },
        { cells: ['Total débitos (ajustes)', totalAjusteDeb, `${ajustesDebito.length} lançamento(s) de débito`] },
      ],
      ['—', '—', '—'],
      TEMA.ajustes,
    );
    row += 1;
  }

  // ABA ABASTECIMENTOS (débito) — KPIs quando tem dado, status quando vazia.
  // Pra transportadoras sem tanque próprio (típico) é onde a maioria dos
  // débitos de combustível aparece (carretas abastecendo em Transterra/EMT).
  if (abastecimentos.length > 0) {
    const litrosTotalAb = abastecimentos.reduce((s, m) => s + (m.saidaLitros ?? 0), 0);
    const totalAbDeb = abastecimentos.reduce((s, m) => s + m.valor, 0);
    const placasUnicasAb = new Set(abastecimentos.map((m) => (m.saidaPlaca ?? '').trim()).filter(Boolean)).size;
    const precoMedioAb = litrosTotalAb > 0 ? totalAbDeb / litrosTotalAb : 0;
    const transterraN = abastecimentos.filter((m) => m.tipo === 'debito_abastecimento_transterra').length;
    const emtN = abastecimentos.filter((m) => m.tipo === 'debito_abastecimento_emt').length;

    row = renderThemedMiniTable(
      wsResumo,
      row,
      '⛽  Aba Abastecimentos — Em tanques externos (débito)',
      [
        { header: 'Indicador', align: 'left', width: 30 },
        { header: 'Valor', align: 'right', width: 18, numFmt: '#,##0.0000' },
        { header: 'Fórmula / explicação', align: 'left', width: 60 },
      ],
      [
        { cells: ['Total de abastecimentos', abastecimentos.length, 'Quantidade de lançamentos na aba'] },
        { cells: ['Categoria Transterra', transterraN, 'Abastecimentos no tanque da Areacre'] },
        { cells: ['Categoria EMT', emtN, 'Abastecimentos em tanque interno EMT'] },
        { cells: ['Litros totais', litrosTotalAb, 'Soma da coluna "Litros"'] },
        { cells: ['Preço médio por litro', precoMedioAb, 'Valor total ÷ Litros totais'] },
        { cells: ['Qtd de placas diferentes', placasUnicasAb, 'Carretas distintas que abasteceram'] },
        { cells: ['Valor total (débito)', totalAbDeb, 'Total da coluna "Valor"'] },
      ],
      ['—', '—', '—'],
      TEMA.abast,
    );
    row += 1;
  } else {
    row = renderColoredTitle(wsResumo, row, '⛽  Aba Abastecimentos — Em tanques externos', TEMA.abast.title);
    wsResumo.mergeCells(`A${row}:F${row + 1}`);
    const c = wsResumo.getCell(`A${row}`);
    c.value = 'Status no mês: vazia — 0 registros. Esta aba registra abastecimentos da transportadora em tanques de terceiros (Transterra/EMT).';
    c.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
    c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: BRAND.cinzaMedio } };
    c.fill = fillSolid(TEMA.abast.cell);
    wsResumo.getCell(`A${row + 1}`).fill = fillSolid(TEMA.abast.cell);
    wsResumo.getRow(row).height = 18;
    wsResumo.getRow(row + 1).height = 14;
    row += 3;
  }

  // ABA TODOS — consolidação (tema verde-escuro)
  row = renderThemedMiniTable(
    wsResumo,
    row,
    '📒  Aba Todos — Extrato consolidado',
    [
      { header: 'Indicador', align: 'left', width: 30 },
      { header: 'Valor', align: 'right', width: 18, numFmt: '"R$" #,##0.00' },
      { header: 'Fórmula / explicação', align: 'left', width: 60 },
    ],
    [
      { cells: ['Total de lançamentos', dadosTodos.length, `Fretes (${fretes.length}) + Abastecimentos (${abastecimentos.length}) + Abast. Tanque (${creditosTanque.length}) + Ajustes (${ajustes.length}) + Pagamentos (${pagamentos.length})`] },
      { cells: ['Total de créditos', totais.creditos, 'Soma da coluna "Crédito" na aba Todos'] },
      { cells: ['Total de débitos', totais.debitos, 'Soma da coluna "Débito" na aba Todos'] },
      { cells: ['Saldo final (1ª linha)', totais.saldoFinal, 'Saldo acumulado até o último lançamento do mês'] },
    ],
    ['—', '—', '—'],
    TEMA.todos,
  );

  // ── Sheet "Todos" (cronológico com saldo acumulado) ──
  renderExcelDetalhamento<MovimentoComSaldo>(wsDetalhe, dadosTodos, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Tipo', key: 'tipo', width: 32, value: (m) => TIPO_LABEL[m.tipo] },
    { header: 'Descrição', key: 'descricao', width: 42, value: (m) => m.descricao ?? '' },
    { header: 'Cálculo', key: 'calculo', width: 50, value: (m) => formatBreakdown(m) },
    {
      header: 'Crédito', key: 'credito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (TIPOS_CREDITO.has(m.tipo) ? m.valor : ''),
      footerValue: (items) => items.reduce((s, m) => s + (TIPOS_CREDITO.has(m.tipo) ? m.valor : 0), 0),
    },
    {
      header: 'Débito', key: 'debito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (TIPOS_CREDITO.has(m.tipo) ? '' : m.valor),
      footerValue: (items) => items.reduce((s, m) => s + (TIPOS_CREDITO.has(m.tipo) ? 0 : m.valor), 0),
    },
    {
      header: 'Saldo', key: 'saldo', width: 18, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.saldoAcumulado,
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Fretes" ──
  const wsFretes = wb.addWorksheet('Fretes', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsFretes, fretes, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Origem', key: 'origem', width: 22, value: (m) => m.freteOrigem ?? '' },
    { header: 'Destino', key: 'destino', width: 22, value: (m) => m.freteDestino ?? '' },
    { header: 'Insumo', key: 'insumo', width: 24, value: (m) => insumoNome(m.freteInsumoId) },
    { header: 'Obra', key: 'obra', width: 24, value: (m) => obraNome(m.obraId) },
    {
      header: 'Peso (t)', key: 'peso', width: 12, align: 'right', numFmt: '#,##0.00',
      value: (m) => m.fretePesoToneladas ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.fretePesoToneladas ?? 0), 0),
    },
    {
      header: 'KM', key: 'km', width: 12, align: 'right', numFmt: '#,##0.0',
      value: (m) => m.freteKmRodados ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.freteKmRodados ?? 0), 0),
    },
    {
      header: 'R$/tkm', key: 'tkm', width: 12, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) => m.freteValorTkm ?? 0,
    },
    { header: 'NF', key: 'nf', width: 14, value: (m) => m.freteNotaFiscal ?? '' },
    { header: 'NF 2', key: 'nf2', width: 14, value: (m) => m.freteNotaFiscal2 ?? '' },
    { header: 'Placa', key: 'placa', width: 12, value: (m) => m.fretePlacaCarreta ?? '' },
    { header: 'Motorista', key: 'motorista', width: 22, value: (m) => m.freteMotorista ?? '' },
    {
      header: 'Valor', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Abastecimentos" (apenas débitos) ──
  const wsAbast = wb.addWorksheet('Abastecimentos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsAbast, abastecimentos, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Categoria', key: 'cat', width: 14, value: (m) => categoriaAbastecimento(m.tipo) },
    { header: 'Combustível', key: 'comb', width: 22, value: (m) => insumoNome(m.saidaTipoCombustivel) },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (m) => m.saidaLitros ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.saidaLitros ?? 0), 0),
    },
    {
      header: 'Preço/L', key: 'preco', width: 14, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) =>
        m.tipo === 'debito_abastecimento_emt'
          ? (m.saidaPrecoMedioTanque ?? m.saidaPrecoCombustivel ?? 0)
          : (m.saidaPrecoCombustivel ?? 0),
    },
    {
      header: 'Taxa/L', key: 'taxa', width: 12, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) => m.saidaTaxaLitro ?? 0,
    },
    { header: 'Placa', key: 'placa', width: 12, value: (m) => m.saidaPlaca ?? '' },
    { header: 'Motorista', key: 'motorista', width: 22, value: (m) => m.saidaMotorista ?? '' },
    { header: 'Observações', key: 'obs', width: 32, value: (m) => m.saidaObservacoes ?? '' },
    {
      header: 'Total', key: 'total', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Abast. Tanque" (créditos quando outras transportadoras
  //    abastecem em tanque próprio — ex: Areacre dona da Transterra) ──
  const wsCredTq = wb.addWorksheet('Abast. Tanque', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsCredTq, creditosTanque, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Combustível', key: 'comb', width: 22, value: (m) => insumoNome(m.saidaTipoCombustivel) },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (m) => m.saidaLitros ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.saidaLitros ?? 0), 0),
    },
    {
      // Crédito vem do preço cobrado pela dona do tanque (preco_combustivel_areacre).
      header: 'Preço Tanque/L', key: 'preco', width: 16, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) => m.saidaPrecoCombustivelAreacre ?? 0,
    },
    { header: 'Placa', key: 'placa', width: 12, value: (m) => m.saidaPlaca ?? '' },
    { header: 'Motorista', key: 'motorista', width: 22, value: (m) => m.saidaMotorista ?? '' },
    { header: 'Observações', key: 'obs', width: 32, value: (m) => m.saidaObservacoes ?? '' },
    {
      header: 'Crédito', key: 'credito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Pagamentos" ──
  const wsPagto = wb.addWorksheet('Pagamentos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsPagto, pagamentos, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Mês ref', key: 'mes', width: 12, value: (m) => m.mesReferencia?.slice(0, 7) ?? '' },
    {
      header: 'Método', key: 'metodo', width: 16,
      value: (m) =>
        m.pagamentoMetodo
          ? METODO_LABEL[m.pagamentoMetodo as MetodoPagamentoFrete] ?? m.pagamentoMetodo
          : '',
    },
    { header: 'NF', key: 'nf', width: 14, value: (m) => m.pagamentoNotaFiscal ?? '' },
    { header: 'Responsável', key: 'resp', width: 22, value: (m) => m.pagamentoResponsavel ?? '' },
    { header: 'Pago por', key: 'pago', width: 22, value: (m) => m.pagamentoPagoPor ?? '' },
    {
      header: 'Combustível (L)', key: 'litros', width: 16, align: 'right', numFmt: '#,##0',
      value: (m) => m.pagamentoQuantidadeCombustivel ?? '',
      footerValue: (items) => items.reduce((s, m) => s + (m.pagamentoQuantidadeCombustivel ?? 0), 0),
    },
    { header: 'Observações', key: 'obs', width: 32, value: (m) => m.pagamentoObservacoes ?? m.descricao ?? '' },
    {
      header: 'Valor', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Ajustes" ──
  const wsAjustes = wb.addWorksheet('Ajustes', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsAjustes, ajustes, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    {
      header: 'Sinal', key: 'sinal', width: 12,
      value: (m) => (m.tipo === 'ajuste_manual_credito' ? 'Crédito' : 'Débito'),
    },
    { header: 'Descrição', key: 'descricao', width: 42, value: (m) => m.descricao ?? '' },
    { header: 'Obra', key: 'obra', width: 24, value: (m) => obraNome(m.obraId) },
    { header: 'Criado por', key: 'autor', width: 22, value: (m) => m.createdBy ?? '' },
    {
      header: 'Crédito', key: 'credito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (m.tipo === 'ajuste_manual_credito' ? m.valor : ''),
      footerValue: (items) =>
        items.reduce((s, m) => s + (m.tipo === 'ajuste_manual_credito' ? m.valor : 0), 0),
    },
    {
      header: 'Débito', key: 'debito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (m.tipo === 'ajuste_manual_debito' ? m.valor : ''),
      footerValue: (items) =>
        items.reduce((s, m) => s + (m.tipo === 'ajuste_manual_debito' ? m.valor : 0), 0),
    },
  ]);

  await saveWorkbook(wb, makeFilename(`${SCOPE}_${transportadoraNome.toLowerCase().replace(/\s+/g, '_')}`, 'xlsx'));
}

// ════════════════════════════════════════════════════════════════════
// PDF
// ════════════════════════════════════════════════════════════════════

export function exportarExtratoPDF(
  transportadoraNome: string,
  movimentos: TransportadoraMovimento[],
  filtros: ExtratoFiltros
): void {
  const dados = prepararExtrato(movimentos, filtros);
  const totais = totaisFromList(dados);

  // Subset de créditos de tanque pra página dedicada (típico Areacre).
  // Em transportadoras sem tanque próprio, lista vazia → seção é
  // suprimida (sem página em branco).
  const movsMes = filtros.mesReferencia
    ? movimentos.filter((m) => m.mesReferencia === filtros.mesReferencia)
    : movimentos;
  const creditosTanque = movsMes
    .filter((m) => m.tipo === 'credito_abastecimento_transterra')
    .sort((a, b) => b.data.localeCompare(a.data));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let y = drawPdfBanner(doc, TITULO, `${transportadoraNome} · ${SUBTITULO}`);

  y = drawPdfFiltros(doc, y + 4, filtrosToTuples(filtros));

  y = drawPdfKPIs(doc, y + 4, [
    ['Saldo Final', fmtBRL(totais.saldoFinal)],
    ['Créditos', fmtBRL(totais.creditos)],
    ['Débitos', fmtBRL(totais.debitos)],
    ['Movimentos', String(totais.qtd)],
  ]);

  // Página de detalhe
  doc.addPage();
  drawPdfDetailPageHeader(doc, 'Movimentos', dados.length);

  const head = ['Data', 'Tipo', 'Descrição', 'Cálculo', 'Crédito', 'Débito', 'Saldo'];
  const body = dados.map((m) => [
    formatDateBR(m.data),
    TIPO_LABEL[m.tipo],
    m.descricao ?? '',
    formatBreakdown(m),
    TIPOS_CREDITO.has(m.tipo) ? fmtBRL(m.valor) : '',
    TIPOS_CREDITO.has(m.tipo) ? '' : fmtBRL(m.valor),
    fmtBRL(m.saldoAcumulado),
  ]);
  const foot = ['', '', 'Saldo final', '', '', '', fmtBRL(totais.saldoFinal)];

  drawPdfDetailTable(
    doc,
    20,
    head,
    body,
    foot,
    {
      0: { halign: 'left', cellWidth: 22 },
      1: { halign: 'left', cellWidth: 48 },
      2: { halign: 'left', cellWidth: 60 },
      3: { halign: 'left', cellWidth: 65 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 28 },
    },
    MARCA
  );

  // Página dedicada "Abast. Tanque" — só renderiza quando há entradas
  // (transportadoras donas de tanque). Mantém paridade com sheet do Excel.
  if (creditosTanque.length > 0) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Abastecimentos no tanque (créditos)', creditosTanque.length);
    const headCT = ['Data', 'Combustível', 'Litros', 'Preço Tanque/L', 'Placa', 'Motorista', 'Crédito'];
    const totalCT = creditosTanque.reduce((s, m) => s + m.valor, 0);
    const totalLitrosCT = creditosTanque.reduce((s, m) => s + (m.saidaLitros ?? 0), 0);
    const bodyCT = creditosTanque.map((m) => [
      formatDateBR(m.data),
      // Sem insumosMap no PDF (não recebido); usa id se vier sem nome.
      m.saidaTipoCombustivel ?? '—',
      m.saidaLitros != null ? m.saidaLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
      m.saidaPrecoCombustivelAreacre != null
        ? `R$ ${m.saidaPrecoCombustivelAreacre.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
        : '—',
      m.saidaPlaca ?? '',
      m.saidaMotorista ?? '',
      fmtBRL(m.valor),
    ]);
    const footCT = ['', '', totalLitrosCT.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), '', '', 'Total', fmtBRL(totalCT)];
    drawPdfDetailTable(
      doc,
      20,
      headCT,
      bodyCT,
      footCT,
      {
        0: { halign: 'left', cellWidth: 24 },
        1: { halign: 'left', cellWidth: 50 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'left', cellWidth: 26 },
        5: { halign: 'left', cellWidth: 50 },
        6: { halign: 'right', cellWidth: 32 },
      },
      MARCA
    );
  }

  doc.save(makeFilename(`${SCOPE}_${transportadoraNome.toLowerCase().replace(/\s+/g, '_')}`, 'pdf'));
}
