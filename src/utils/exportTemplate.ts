/**
 * Shared premium export template helpers.
 *
 * Every Excel/PDF export in the app follows the same branded layout:
 *  - Excel: "Resumo" sheet with banner + filters + KPIs + demonstrative tables,
 *           "Detalhamento" sheet with frozen header + zebra + totals + auto-filter.
 *  - PDF:   Landscape A4 with banner + filters + KPI cards + mini-tables (page 1),
 *           then a full detail table on following pages with footer page counter.
 *
 * Reference implementation: src/utils/abastecimentoCarretaExport.ts (gold standard).
 */

import ExcelJS from 'exceljs';
import type jsPDF from 'jspdf';
import autoTable, { type RowInput, type UserOptions } from 'jspdf-autotable';

// =============================================================================
// Brand palette
// =============================================================================

/** ARGB colors (Excel / ExcelJS). */
export const BRAND = {
  verde: 'FF2D7F4F',
  verdeEscuro: 'FF1E5A38',
  verdeClaro: 'FFE8F5E9',
  amarelo: 'FFFDB933',
  cinzaEscuro: 'FF1F2937',
  cinzaMedio: 'FF6B7280',
  cinzaClaro: 'FFF3F4F6',
  cinzaZebra: 'FFF9FAFB',
  branco: 'FFFFFFFF',
  bordaLeve: 'FFE5E7EB',
};

/** RGB tuples (PDF / jsPDF). */
export const PDF_RGB = {
  verde: [45, 127, 79] as [number, number, number],
  verdeEscuro: [30, 90, 56] as [number, number, number],
  verdeClaro: [232, 245, 233] as [number, number, number],
  cinzaEscuro: [31, 41, 55] as [number, number, number],
  cinzaMedio: [107, 114, 128] as [number, number, number],
  cinzaClaro: [243, 244, 246] as [number, number, number],
  zebra: [249, 250, 251] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
  bordaLeve: [229, 231, 235] as [number, number, number],
};

// =============================================================================
// Shared formatters
// =============================================================================

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Format ISO date (yyyy-mm-dd) to dd/mm/yyyy. Returns `-` when input is empty. */
export function formatDateBR(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Format month reference (yyyy-mm) to short month/year (e.g. "Jan/2024"). */
export function formatMesRef(mes: string): string {
  if (!mes) return '-';
  const [ano, m] = mes.split('-');
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return mes;
  return `${MESES_CURTOS[idx]}/${ano}`;
}

/** Brazilian currency string. */
export function fmtBRL(v: number, dec = 2): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/** Brazilian number (no currency symbol). */
export function fmtNum(v: number, dec = 2): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Build file name in the shape `<scope>-YYYY-MM-DD.<ext>`. */
export function makeFilename(scope: string, ext: 'xlsx' | 'pdf'): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${scope}-${stamp}.${ext}`;
}

/** Current generated-at stamp in pt-BR, e.g. "Gerado em 20/04/2026 às 14:32". */
export function generatedAtStamp(): string {
  const now = new Date();
  return `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// =============================================================================
// Excel helpers
// =============================================================================

/** Light grey thin border for cells. */
export function thinBorder(): ExcelJS.Borders {
  return {
    top: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
    left: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
    bottom: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
    right: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
  } as unknown as ExcelJS.Borders;
}

/** Solid background fill with the given ARGB color. */
export function fillSolid(argb: string): ExcelJS.FillPattern {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
}

/**
 * Render the premium header block on a "Resumo" worksheet:
 *  - Title banner (rows 1-2, verde)
 *  - Subtitle strip (row 3, verdeEscuro)
 *  - Generated-at timestamp (row 5, right-aligned)
 * Returns the next free row (row 7 currently).
 */
export function renderExcelBanner(
  ws: ExcelJS.Worksheet,
  titulo: string,
  subtitulo: string,
  lastCol: string = 'F',
): number {
  ws.views = [{ showGridLines: false }];

  ws.mergeCells(`A1:${lastCol}2`);
  const title = ws.getCell('A1');
  title.value = titulo;
  title.font = { name: 'Calibri', size: 22, bold: true, color: { argb: BRAND.branco } };
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  title.fill = fillSolid(BRAND.verde);
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 28;

  ws.mergeCells(`A3:${lastCol}3`);
  const sub = ws.getCell('A3');
  sub.value = subtitulo;
  sub.font = { name: 'Calibri', size: 10, color: { argb: BRAND.branco } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sub.fill = fillSolid(BRAND.verdeEscuro);
  ws.getRow(3).height = 20;

  ws.mergeCells(`A5:${lastCol}5`);
  const stamp = ws.getCell('A5');
  stamp.value = generatedAtStamp();
  stamp.font = { name: 'Calibri', size: 9, italic: true, color: { argb: BRAND.cinzaMedio } };
  stamp.alignment = { horizontal: 'right' };

  return 7;
}

/**
 * Render a green-underlined section title spanning A..lastCol on the given row.
 * Returns `row + 1` for convenience.
 */
export function renderExcelSectionTitle(
  ws: ExcelJS.Worksheet,
  row: number,
  text: string,
  lastCol: string = 'F',
): number {
  ws.mergeCells(`A${row}:${lastCol}${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND.verdeEscuro } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border = { bottom: { style: 'medium', color: { argb: BRAND.verde } } } as unknown as ExcelJS.Borders;
  ws.getRow(row).height = 22;
  return row + 1;
}

/**
 * Render the "FILTROS APLICADOS" two-column key/value block.
 * Shows "Nenhum filtro aplicado (todos os registros)" when list is empty.
 * Returns the next free row.
 */
export function renderExcelFiltros(
  ws: ExcelJS.Worksheet,
  startRow: number,
  filtros: Array<[string, string]>,
  lastCol: string = 'F',
): number {
  let row = renderExcelSectionTitle(ws, startRow, 'FILTROS APLICADOS', lastCol);
  const list = filtros.length > 0 ? filtros : [['—', 'Nenhum filtro aplicado (todos os registros)'] as [string, string]];

  for (const [label, value] of list) {
    ws.mergeCells(`A${row}:B${row}`);
    const k = ws.getCell(`A${row}`);
    k.value = label;
    k.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.cinzaEscuro } };
    k.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    k.fill = fillSolid(BRAND.cinzaClaro);

    ws.mergeCells(`C${row}:${lastCol}${row}`);
    const v = ws.getCell(`C${row}`);
    v.value = value;
    v.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
    v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    v.fill = fillSolid(BRAND.branco);
    ws.getRow(row).height = 20;
    row++;
  }
  return row;
}

export interface KPICell {
  label: string;
  value: number | string;
  /** Excel numFmt string (e.g. `"R$" #,##0.00`). */
  numFmt?: string;
}

/**
 * Render the "INDICADORES" section with N KPI cards (4 recommended) in columns B..E.
 * Returns the next free row (after KPI rows + 1-row gap).
 */
export function renderExcelKPIs(
  ws: ExcelJS.Worksheet,
  startRow: number,
  kpis: KPICell[],
  lastCol: string = 'F',
): number {
  let row = renderExcelSectionTitle(ws, startRow, 'INDICADORES', lastCol);
  // 1-row gap
  row++;
  const labelRow = row;
  const valueRow = row + 1;
  const kpiCols = ['B', 'C', 'D', 'E'];
  kpis.slice(0, 4).forEach((k, i) => {
    const col = kpiCols[i];
    const labelCell = ws.getCell(`${col}${labelRow}`);
    labelCell.value = k.label;
    labelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.cinzaMedio } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
    labelCell.fill = fillSolid(BRAND.verdeClaro);
    labelCell.border = thinBorder();

    const valCell = ws.getCell(`${col}${valueRow}`);
    valCell.value = k.value;
    if (k.numFmt) valCell.numFmt = k.numFmt;
    valCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: BRAND.verdeEscuro } };
    valCell.alignment = { vertical: 'middle', horizontal: 'center' };
    valCell.fill = fillSolid(BRAND.branco);
    valCell.border = thinBorder();
  });
  ws.getRow(labelRow).height = 18;
  ws.getRow(valueRow).height = 32;
  return valueRow + 2;
}

export interface ExcelMiniTableColumn {
  header: string;
  /** Alignment for both header and data cells. Header is always bold on green. */
  align?: 'left' | 'right' | 'center';
  /** Excel numFmt for data cells. */
  numFmt?: string;
  /** Column width (optional). */
  width?: number;
}

export interface ExcelMiniTableRow {
  /** Values in column order matching `columns`. */
  cells: (string | number | Date)[];
}

/**
 * Render a demonstrative "mini" table on a "Resumo" sheet.
 *
 * Layout:
 *  - Green underlined title (renders as section title)
 *  - Green header row with white bold text
 *  - Zebra body rows
 *  - Verde-claro footer row (totals).
 *
 * Totals are passed as a pre-computed array of footer cells. Non-numeric footer
 * slots (blanks, 'Total' label) should use empty string or literal text.
 *
 * Returns the next free row (with a 1-row gap after the footer).
 */
export function renderExcelMiniTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  titulo: string,
  columns: ExcelMiniTableColumn[],
  rows: ExcelMiniTableRow[],
  footer: (string | number)[],
  lastCol: string = 'F',
): number {
  let row = renderExcelSectionTitle(ws, startRow, titulo, lastCol);

  // Header
  columns.forEach((col, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    cell.fill = fillSolid(BRAND.verde);
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.align || (i === 0 ? 'left' : 'right'),
      indent: (col.align || (i === 0 ? 'left' : 'right')) === 'left' ? 1 : 0,
    };
    cell.border = thinBorder();
  });
  ws.getRow(row).height = 22;
  row++;

  // Body rows
  rows.forEach((r, idx) => {
    const zebra = idx % 2 === 1;
    const bg = zebra ? BRAND.cinzaZebra : BRAND.branco;
    r.cells.forEach((val, i) => {
      const col = columns[i];
      const cell = ws.getCell(row, i + 1);
      cell.value = val as ExcelJS.CellValue;
      if (col?.numFmt) cell.numFmt = col.numFmt;
      cell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
      const align = col?.align || (i === 0 ? 'left' : 'right');
      cell.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
      cell.fill = fillSolid(bg);
      cell.border = thinBorder();
    });
    ws.getRow(row).height = 18;
    row++;
  });

  // Footer
  footer.forEach((val, i) => {
    const col = columns[i];
    const cell = ws.getCell(row, i + 1);
    cell.value = val as ExcelJS.CellValue;
    if (col?.numFmt && typeof val === 'number') cell.numFmt = col.numFmt;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.verdeEscuro } };
    const align = col?.align || (i === 0 ? 'left' : 'right');
    cell.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
    cell.fill = fillSolid(BRAND.verdeClaro);
    cell.border = thinBorder();
  });
  ws.getRow(row).height = 20;
  return row + 2;
}

export interface DetalhamentoColumn {
  header: string;
  key: string;
  width: number;
  /** Alignment for data cells. Header is always center. */
  align?: 'left' | 'right' | 'center';
  /** Excel numFmt for numeric cells. */
  numFmt?: string;
  /** Render value for row data. */
  value: (item: unknown) => string | number | Date;
  /** Render value for footer row. Leave undefined for blank/non-totaled cells. */
  footerValue?: (items: readonly unknown[]) => string | number | undefined;
  /** When true, data cell is bolded verdeEscuro (e.g. "Valor Total" columns). */
  emphasizeValue?: boolean;
}

/**
 * Render the "Detalhamento" worksheet (frozen header row, zebra body, total row,
 * autoFilter across all columns).
 *
 * Columns are defined with `value` and optional `footerValue` accessors. Footer
 * is always added (verde-claro) even when all footerValue entries are blank,
 * matching the gold standard.
 */
export function renderExcelDetalhamento<T>(
  ws: ExcelJS.Worksheet,
  items: T[],
  columns: Array<{
    header: string;
    key: string;
    width: number;
    align?: 'left' | 'right' | 'center';
    numFmt?: string;
    value: (item: T) => string | number | Date;
    footerValue?: (items: readonly T[]) => string | number | undefined;
    emphasizeValue?: boolean;
  }>,
  footerLabelColIndex: number = 1,
  footerLabel: string = `TOTAL (${items.length} registros)`,
) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];

  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    cell.fill = fillSolid(BRAND.verde);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });

  items.forEach((item, idx) => {
    const zebra = idx % 2 === 1;
    const bg = zebra ? BRAND.cinzaZebra : BRAND.branco;
    const data: Record<string, string | number | Date> = {};
    columns.forEach((c) => {
      data[c.key] = c.value(item);
    });
    const row = ws.addRow(data);
    row.height = 20;
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      cell.font = col.emphasizeValue
        ? { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.verdeEscuro } }
        : { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
      cell.fill = fillSolid(bg);
      cell.border = thinBorder();
      const align = col.align || (i === 0 ? 'center' : typeof data[col.key] === 'number' ? 'right' : 'left');
      cell.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
      if (col.numFmt && typeof data[col.key] === 'number') cell.numFmt = col.numFmt;
    });
  });

  // Total row
  const totalData: Record<string, string | number | Date> = {};
  columns.forEach((c, idx) => {
    if (idx + 1 === footerLabelColIndex) {
      totalData[c.key] = footerLabel;
    } else if (c.footerValue) {
      const v = c.footerValue(items);
      totalData[c.key] = v ?? '';
    } else {
      totalData[c.key] = '';
    }
  });
  const totalRow = ws.addRow(totalData);
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    const col = columns[colNumber - 1];
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.verdeEscuro } };
    cell.fill = fillSolid(BRAND.verdeClaro);
    cell.border = {
      top: { style: 'medium', color: { argb: BRAND.verde } },
      left: { style: 'thin', color: { argb: BRAND.bordaLeve } },
      bottom: { style: 'medium', color: { argb: BRAND.verde } },
      right: { style: 'thin', color: { argb: BRAND.bordaLeve } },
    } as unknown as ExcelJS.Borders;
    const align = col?.align || (typeof totalData[col.key] === 'number' ? 'right' : colNumber === footerLabelColIndex ? 'right' : 'center');
    cell.alignment = { vertical: 'middle', horizontal: align, indent: align === 'right' && colNumber === footerLabelColIndex ? 1 : 0 };
    if (col?.numFmt && typeof totalData[col.key] === 'number') cell.numFmt = col.numFmt;
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: items.length + 1, column: columns.length },
  };
}

// =============================================================================
// Save Excel workbook as file
// =============================================================================

/** Save an ExcelJS workbook via an anchor + Blob. */
export async function saveWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Create a premium-branded workbook with "Resumo" + "Detalhamento" sheets. */
export function createWorkbook(): {
  wb: ExcelJS.Workbook;
  wsResumo: ExcelJS.Worksheet;
  wsDetalhe: ExcelJS.Worksheet;
} {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestão de Obras';
  wb.created = new Date();
  wb.properties.date1904 = false;

  const wsResumo = wb.addWorksheet('Resumo', {
    properties: { tabColor: { argb: BRAND.verde } },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  wsResumo.columns = [
    { width: 24 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
  ];

  const wsDetalhe = wb.addWorksheet('Detalhamento', {
    properties: { tabColor: { argb: BRAND.verdeEscuro } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });

  return { wb, wsResumo, wsDetalhe };
}

// =============================================================================
// PDF helpers
// =============================================================================

/**
 * Draw the premium 2-tone banner at the top of the current PDF page and the
 * right-aligned generated-at timestamp. Returns the next free y coordinate
 * (just below the banner).
 */
export function drawPdfBanner(
  doc: jsPDF,
  titulo: string,
  subtitulo: string,
  margin: number = 10,
): number {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_RGB.verde);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFillColor(...PDF_RGB.verdeEscuro);
  doc.rect(0, 22, pageW, 6, 'F');

  doc.setTextColor(...PDF_RGB.branco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(titulo, margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitulo, margin, 26);

  doc.setFontSize(8);
  doc.text(generatedAtStamp(), pageW - margin, 26, { align: 'right' });

  return 36;
}

/** Draw a green section title with underline (horizontal rule), returns next y. */
export function drawPdfSectionTitle(
  doc: jsPDF,
  y: number,
  text: string,
  margin: number = 10,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setTextColor(...PDF_RGB.verdeEscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(text, margin, y);
  doc.setDrawColor(...PDF_RGB.verde);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 1.2, pageW - margin, y + 1.2);
  return y + 5;
}

/**
 * Draw the "FILTROS APLICADOS" section as 2-column chips. Empty list renders
 * a single "Nenhum filtro aplicado" chip. Returns next y.
 */
export function drawPdfFiltros(
  doc: jsPDF,
  y: number,
  filtros: Array<[string, string]>,
  margin: number = 10,
): number {
  y = drawPdfSectionTitle(doc, y, 'FILTROS APLICADOS', margin);

  const list = filtros.length > 0 ? filtros : [['—', 'Nenhum filtro aplicado (todos os registros)'] as [string, string]];
  const pageW = doc.internal.pageSize.getWidth();
  const innerW = pageW - margin * 2;
  const colW = innerW / 2 - 2;
  const chipH = 8;

  list.forEach((pair, i) => {
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    const x = margin + col * (colW + 4);
    const cy = y + rowIdx * (chipH + 2);
    doc.setFillColor(...PDF_RGB.cinzaClaro);
    doc.roundedRect(x, cy, colW, chipH, 1.2, 1.2, 'F');
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(pair[0].toUpperCase(), x + 3, cy + 3.3);
    doc.setTextColor(...PDF_RGB.cinzaEscuro);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(pair[1], x + 3, cy + 6.8);
  });
  const rows = Math.ceil(list.length / 2);
  return y + rows * (chipH + 2) + 4;
}

/** Draw the "INDICADORES" section with up to 4 KPI cards in a row. Returns next y. */
export function drawPdfKPIs(
  doc: jsPDF,
  y: number,
  kpis: Array<[string, string]>,
  margin: number = 10,
): number {
  y = drawPdfSectionTitle(doc, y, 'INDICADORES', margin);

  const pageW = doc.internal.pageSize.getWidth();
  const innerW = pageW - margin * 2;
  const cards = kpis.slice(0, 4);
  const kpiW = (innerW - 9) / 4;
  const kpiH = 18;

  cards.forEach(([label, value], i) => {
    const x = margin + i * (kpiW + 3);
    doc.setFillColor(...PDF_RGB.branco);
    doc.setDrawColor(...PDF_RGB.bordaLeve);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, kpiW, kpiH, 1.5, 1.5, 'FD');

    doc.setFillColor(...PDF_RGB.verdeClaro);
    doc.roundedRect(x, y, kpiW, 5, 1.5, 1.5, 'F');
    doc.setFillColor(...PDF_RGB.verdeClaro);
    doc.rect(x, y + 3, kpiW, 2, 'F');

    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + kpiW / 2, y + 3.5, { align: 'center' });

    doc.setTextColor(...PDF_RGB.verdeEscuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(value, x + kpiW / 2, y + 13.5, { align: 'center' });
  });

  return y + kpiH + 6;
}

export interface PdfMiniTableColumnStyle {
  halign?: 'left' | 'right' | 'center';
  cellWidth?: number | 'auto';
}

/**
 * Draw a demonstrative mini-table on the current PDF page (with a section title
 * above it). Automatically adds a new page when there's not enough vertical room.
 * Returns the y coordinate right after the rendered table.
 */
export function drawPdfMiniTable(
  doc: jsPDF,
  startY: number,
  titulo: string,
  head: string[],
  body: RowInput[],
  foot: RowInput,
  columnStyles: Record<number, PdfMiniTableColumnStyle> = {},
  margin: number = 10,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = startY;
  if (y > pageH - 40) {
    doc.addPage();
    y = margin + 4;
  }
  y = drawPdfSectionTitle(doc, y, titulo, margin);

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot: [foot],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1.6,
      lineColor: PDF_RGB.bordaLeve,
      lineWidth: 0.1,
      textColor: PDF_RGB.cinzaEscuro,
    },
    headStyles: {
      fillColor: PDF_RGB.verde,
      textColor: PDF_RGB.branco,
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: PDF_RGB.verdeClaro,
      textColor: PDF_RGB.verdeEscuro,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: PDF_RGB.zebra },
    columnStyles,
    margin: { left: margin, right: margin },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 5;
  void pageW;
}

/**
 * Draw the small banner at the top of a detail page ("X registros" on the
 * right) and return the y coordinate where the detail table should start.
 */
export function drawPdfDetailPageHeader(
  doc: jsPDF,
  titulo: string,
  totalRegistros: number,
  margin: number = 10,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_RGB.verde);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(...PDF_RGB.branco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(titulo, margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${totalRegistros} registro${totalRegistros !== 1 ? 's' : ''}`, pageW - margin, 9, { align: 'right' });
  return 20;
}

/**
 * Render the full detail table on the current PDF. Adds a `didDrawPage` hook
 * that draws the page-counter footer and the Gestão de Obras marca.
 *
 * The caller is responsible for calling `drawPdfDetailPageHeader` on the first
 * detail page before calling this (so a header banner sits above the table).
 */
export function drawPdfDetailTable(
  doc: jsPDF,
  startY: number,
  head: string[],
  body: RowInput[],
  foot: RowInput,
  columnStyles: Record<number, PdfMiniTableColumnStyle>,
  footerMarca: string,
  margin: number = 10,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const opts: UserOptions = {
    startY,
    head: [head],
    body,
    foot: [foot],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      lineColor: PDF_RGB.bordaLeve,
      lineWidth: 0.1,
      textColor: PDF_RGB.cinzaEscuro,
    },
    headStyles: {
      fillColor: PDF_RGB.verde,
      textColor: PDF_RGB.branco,
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: PDF_RGB.verdeClaro,
      textColor: PDF_RGB.verdeEscuro,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: PDF_RGB.zebra },
    columnStyles,
    margin: { left: margin, right: margin, top: 18 },
    didDrawPage: (data) => {
      const totalPages = doc.getNumberOfPages();
      doc.setTextColor(...PDF_RGB.cinzaMedio);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Página ${data.pageNumber} de ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
      doc.text(footerMarca, margin, pageH - 4);
    },
  };

  autoTable(doc, opts);
}
