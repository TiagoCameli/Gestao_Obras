import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AbastecimentoCarreta, Insumo } from '../types';

interface FiltrosExport {
  transportadora: string;
  placa: string;
  combustivelId: string;
  mesReferencia: string;
  dataInicio: string;
  dataFim: string;
}

const BRAND = {
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

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatDateBR(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatMesRef(mes: string): string {
  if (!mes) return '-';
  const [ano, m] = mes.split('-');
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return mes;
  return `${MESES_CURTOS[idx]}/${ano}`;
}

function aplicarFiltros(abastecimentos: AbastecimentoCarreta[], filtros: FiltrosExport): AbastecimentoCarreta[] {
  return abastecimentos
    .filter((a) => {
      if (filtros.transportadora && a.transportadora !== filtros.transportadora) return false;
      if (filtros.placa && a.placaCarreta !== filtros.placa) return false;
      if (filtros.combustivelId && a.tipoCombustivel !== filtros.combustivelId) return false;
      if (filtros.mesReferencia && a.mesReferencia !== filtros.mesReferencia) return false;
      if (filtros.dataInicio && a.data < filtros.dataInicio) return false;
      if (filtros.dataFim && a.data > filtros.dataFim) return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
    left: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
    bottom: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
    right: { style: 'thin' as const, color: { argb: BRAND.bordaLeve } },
  };
}

function fillSolid(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
}

function renderResumo(
  ws: ExcelJS.Worksheet,
  dados: AbastecimentoCarreta[],
  combustiveisMap: Map<string, string>,
  filtros: FiltrosExport,
) {
  ws.columns = [
    { width: 24 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
  ];
  ws.views = [{ showGridLines: false }];

  // Title banner
  ws.mergeCells('A1:F2');
  const title = ws.getCell('A1');
  title.value = 'Relatório de Abastecimentos de Carreta';
  title.font = { name: 'Calibri', size: 22, bold: true, color: { argb: BRAND.branco } };
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  title.fill = fillSolid(BRAND.verde);
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 28;

  ws.mergeCells('A3:F3');
  const subtitle = ws.getCell('A3');
  subtitle.value = 'Módulo de Frete • Gestão de Obras';
  subtitle.font = { name: 'Calibri', size: 10, color: { argb: BRAND.branco } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  subtitle.fill = fillSolid(BRAND.verdeEscuro);
  ws.getRow(3).height = 20;

  // Generated at
  ws.mergeCells('A5:F5');
  const stamp = ws.getCell('A5');
  const now = new Date();
  stamp.value = `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  stamp.font = { name: 'Calibri', size: 9, italic: true, color: { argb: BRAND.cinzaMedio } };
  stamp.alignment = { horizontal: 'right' };

  // ===== Filtros aplicados =====
  ws.mergeCells('A7:F7');
  const filtrosHeader = ws.getCell('A7');
  filtrosHeader.value = 'FILTROS APLICADOS';
  filtrosHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND.verdeEscuro } };
  filtrosHeader.alignment = { vertical: 'middle', horizontal: 'left' };
  filtrosHeader.border = { bottom: { style: 'medium', color: { argb: BRAND.verde } } };
  ws.getRow(7).height = 22;

  const filtrosList: Array<[string, string]> = [];
  if (filtros.transportadora) filtrosList.push(['Transportadora', filtros.transportadora]);
  if (filtros.placa) filtrosList.push(['Placa', filtros.placa]);
  if (filtros.combustivelId) filtrosList.push(['Combustível', combustiveisMap.get(filtros.combustivelId) || filtros.combustivelId]);
  if (filtros.mesReferencia) filtrosList.push(['Mês de referência', formatMesRef(filtros.mesReferencia)]);
  if (filtros.dataInicio) filtrosList.push(['Data início', formatDateBR(filtros.dataInicio)]);
  if (filtros.dataFim) filtrosList.push(['Data fim', formatDateBR(filtros.dataFim)]);
  if (filtrosList.length === 0) filtrosList.push(['—', 'Nenhum filtro aplicado (todos os registros)']);

  let rowIdx = 8;
  for (const [label, value] of filtrosList) {
    ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
    const k = ws.getCell(`A${rowIdx}`);
    k.value = label;
    k.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.cinzaEscuro } };
    k.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    k.fill = fillSolid(BRAND.cinzaClaro);

    ws.mergeCells(`C${rowIdx}:F${rowIdx}`);
    const v = ws.getCell(`C${rowIdx}`);
    v.value = value;
    v.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
    v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    v.fill = fillSolid(BRAND.branco);
    ws.getRow(rowIdx).height = 20;
    rowIdx++;
  }

  // ===== KPIs =====
  const startKpi = rowIdx + 2;
  ws.mergeCells(`A${startKpi}:F${startKpi}`);
  const kpiHeader = ws.getCell(`A${startKpi}`);
  kpiHeader.value = 'INDICADORES';
  kpiHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND.verdeEscuro } };
  kpiHeader.alignment = { vertical: 'middle', horizontal: 'left' };
  kpiHeader.border = { bottom: { style: 'medium', color: { argb: BRAND.verde } } };
  ws.getRow(startKpi).height = 22;

  const totalRegistros = dados.length;
  const totalLitros = dados.reduce((s, a) => s + a.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, a) => s + a.valorTotal, 0);
  const ticketMedio = totalLitros > 0 ? totalValor / totalLitros : 0;

  const kpis: Array<[string, string | number, string]> = [
    ['Registros', totalRegistros, '0'],
    ['Litros Totais', totalLitros, '#,##0.00 "L"'],
    ['Valor Total', totalValor, '"R$" #,##0.00'],
    ['Ticket Médio (R$/L)', ticketMedio, '"R$" #,##0.0000'],
  ];

  const kpiLabelRow = startKpi + 2;
  const kpiValueRow = startKpi + 3;
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  // KPI columns: A-B, C, D, E (4 KPIs in columns 1, 3, 4, 5). Use merges A-B, C, D, E-F.
  const cardMerges: Array<[string, string]> = [
    [`A${kpiLabelRow}`, `A${kpiValueRow}`],
  ];
  // Simpler: 4 columns equal — use C..F merged into pairs doesn't fit; use columns B..E widened.
  void cols;
  void cardMerges;

  // Redo KPI layout: 4 cards, each spans ~1.5 columns. Use A-B, C, D, E-F? Too irregular.
  // Cleaner: make each card span one column, 4 cards in columns B, C, D, E (with A and F as gutters visually).
  // We'll write labels in kpiLabelRow and values in kpiValueRow for columns B..E.
  const kpiCols = ['B', 'C', 'D', 'E'];
  kpis.forEach(([label, value, fmt], i) => {
    const col = kpiCols[i];
    const labelCell = ws.getCell(`${col}${kpiLabelRow}`);
    labelCell.value = label;
    labelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.cinzaMedio } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
    labelCell.fill = fillSolid(BRAND.verdeClaro);
    labelCell.border = thinBorder();

    const valCell = ws.getCell(`${col}${kpiValueRow}`);
    valCell.value = value;
    valCell.numFmt = fmt;
    valCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: BRAND.verdeEscuro } };
    valCell.alignment = { vertical: 'middle', horizontal: 'center' };
    valCell.fill = fillSolid(BRAND.branco);
    valCell.border = thinBorder();
  });
  ws.getRow(kpiLabelRow).height = 18;
  ws.getRow(kpiValueRow).height = 32;

  // ===== Tabelas demonstrativas =====
  let cursor = kpiValueRow + 3;

  type Agregado = { chave: string; registros: number; litros: number; valor: number };

  function agrupar(
    keyFn: (a: AbastecimentoCarreta) => string,
    labelFn: (k: string) => string,
  ): Agregado[] {
    const map = new Map<string, Agregado>();
    dados.forEach((a) => {
      const k = keyFn(a);
      if (!k) return;
      const exist = map.get(k);
      if (exist) {
        exist.registros++;
        exist.litros += a.quantidadeLitros;
        exist.valor += a.valorTotal;
      } else {
        map.set(k, { chave: labelFn(k), registros: 1, litros: a.quantidadeLitros, valor: a.valorTotal });
      }
    });
    return [...map.values()].sort((x, y) => y.valor - x.valor);
  }

  function renderTabelaAgregada(titulo: string, header: string, rows: Agregado[], limit?: number) {
    // Section title
    ws.mergeCells(`A${cursor}:F${cursor}`);
    const h = ws.getCell(`A${cursor}`);
    h.value = titulo;
    h.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND.verdeEscuro } };
    h.alignment = { vertical: 'middle', horizontal: 'left' };
    h.border = { bottom: { style: 'medium', color: { argb: BRAND.verde } } };
    ws.getRow(cursor).height = 22;
    cursor++;

    // Table header
    const headerRow = cursor;
    const headers = [header, 'Registros', 'Litros', 'Valor Total', '% Litros', '% Valor'];
    headers.forEach((txt, i) => {
      const c = ws.getCell(headerRow, i + 1);
      c.value = txt;
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
      c.fill = fillSolid(BRAND.verde);
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
      c.border = thinBorder();
    });
    ws.getRow(headerRow).height = 22;
    cursor++;

    const totalL = rows.reduce((s, r) => s + r.litros, 0) || 1;
    const totalV = rows.reduce((s, r) => s + r.valor, 0) || 1;
    const sliced = limit ? rows.slice(0, limit) : rows;

    sliced.forEach((r, idx) => {
      const zebra = idx % 2 === 1;
      const bg = zebra ? BRAND.cinzaZebra : BRAND.branco;
      const cells: Array<[ExcelJS.CellValue, string | undefined, 'left' | 'right']> = [
        [r.chave, undefined, 'left'],
        [r.registros, '0', 'right'],
        [r.litros, '#,##0.00', 'right'],
        [r.valor, '"R$" #,##0.00', 'right'],
        [r.litros / totalL, '0.0%', 'right'],
        [r.valor / totalV, '0.0%', 'right'],
      ];
      cells.forEach(([val, fmt, align], i) => {
        const c = ws.getCell(cursor, i + 1);
        c.value = val;
        if (fmt) c.numFmt = fmt;
        c.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
        c.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
        c.fill = fillSolid(bg);
        c.border = thinBorder();
      });
      ws.getRow(cursor).height = 18;
      cursor++;
    });

    // Total row
    const totalRegistros = sliced.reduce((s, r) => s + r.registros, 0);
    const totalLitros = sliced.reduce((s, r) => s + r.litros, 0);
    const totalValor = sliced.reduce((s, r) => s + r.valor, 0);
    const totalCells: Array<[ExcelJS.CellValue, string | undefined, 'left' | 'right']> = [
      ['Total', undefined, 'left'],
      [totalRegistros, '0', 'right'],
      [totalLitros, '#,##0.00', 'right'],
      [totalValor, '"R$" #,##0.00', 'right'],
      ['', undefined, 'right'],
      ['', undefined, 'right'],
    ];
    totalCells.forEach(([val, fmt, align], i) => {
      const c = ws.getCell(cursor, i + 1);
      c.value = val;
      if (fmt) c.numFmt = fmt;
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.verdeEscuro } };
      c.alignment = { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 };
      c.fill = fillSolid(BRAND.verdeClaro);
      c.border = thinBorder();
    });
    ws.getRow(cursor).height = 20;
    cursor += 2;
  }

  // Por Transportadora
  renderTabelaAgregada(
    'POR TRANSPORTADORA',
    'Transportadora',
    agrupar((a) => a.transportadora, (k) => k),
  );

  // Por Placa (Top 10)
  renderTabelaAgregada(
    'POR PLACA (TOP 10)',
    'Placa',
    agrupar((a) => a.placaCarreta, (k) => k),
    10,
  );

  // Por Combustível
  renderTabelaAgregada(
    'POR COMBUSTÍVEL',
    'Combustível',
    agrupar(
      (a) => a.tipoCombustivel || '—',
      (k) => combustiveisMap.get(k) || k,
    ),
  );

  // Por Mês de Referência
  renderTabelaAgregada(
    'POR MÊS DE REFERÊNCIA',
    'Mês de Referência',
    agrupar((a) => a.mesReferencia || '', (k) => formatMesRef(k))
      .sort((x, y) => x.chave.localeCompare(y.chave)),
  );
}

function renderDetalhamento(
  ws: ExcelJS.Worksheet,
  dados: AbastecimentoCarreta[],
  combustiveisMap: Map<string, string>,
) {
  ws.columns = [
    { header: 'Data', key: 'data', width: 14 },
    { header: 'Transportadora', key: 'transportadora', width: 28 },
    { header: 'Placa', key: 'placa', width: 12 },
    { header: 'Mês Ref.', key: 'mes', width: 12 },
    { header: 'Combustível', key: 'combustivel', width: 18 },
    { header: 'Litros', key: 'litros', width: 12 },
    { header: 'Valor Unit.', key: 'valorUnit', width: 14 },
    { header: 'Valor Total', key: 'valorTotal', width: 16 },
    { header: 'Observações', key: 'observacoes', width: 32 },
  ];
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    cell.fill = fillSolid(BRAND.verde);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });

  // Data rows
  dados.forEach((a, idx) => {
    const zebra = idx % 2 === 1;
    const bg = zebra ? BRAND.cinzaZebra : BRAND.branco;
    const row = ws.addRow({
      data: formatDateBR(a.data),
      transportadora: a.transportadora || '-',
      placa: a.placaCarreta || '-',
      mes: formatMesRef(a.mesReferencia),
      combustivel: combustiveisMap.get(a.tipoCombustivel) || a.tipoCombustivel || '-',
      litros: a.quantidadeLitros,
      valorUnit: a.valorUnidade,
      valorTotal: a.valorTotal,
      observacoes: a.observacoes || '',
    });
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
      cell.fill = fillSolid(bg);
      cell.border = thinBorder();
      if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber >= 6 && colNumber <= 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      }
    });
    row.getCell('litros').numFmt = '#,##0.00';
    row.getCell('valorUnit').numFmt = '"R$" #,##0.0000';
    row.getCell('valorTotal').numFmt = '"R$" #,##0.00';
    row.getCell('valorTotal').font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.verdeEscuro } };
  });

  // Totals row
  const totalLitros = dados.reduce((s, a) => s + a.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, a) => s + a.valorTotal, 0);
  const totalRow = ws.addRow({
    data: '',
    transportadora: `TOTAL (${dados.length} registro${dados.length !== 1 ? 's' : ''})`,
    placa: '',
    mes: '',
    combustivel: '',
    litros: totalLitros,
    valorUnit: '',
    valorTotal: totalValor,
    observacoes: '',
  });
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.verdeEscuro } };
    cell.fill = fillSolid(BRAND.verdeClaro);
    cell.border = {
      top: { style: 'medium', color: { argb: BRAND.verde } },
      left: { style: 'thin', color: { argb: BRAND.bordaLeve } },
      bottom: { style: 'medium', color: { argb: BRAND.verde } },
      right: { style: 'thin', color: { argb: BRAND.bordaLeve } },
    };
    if (colNumber >= 6) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNumber === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });
  totalRow.getCell('litros').numFmt = '#,##0.00';
  totalRow.getCell('valorTotal').numFmt = '"R$" #,##0.00';

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: dados.length + 1, column: 9 },
  };
}

// ===== PDF =====

const PDF_RGB = {
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

function fmtBRL(v: number, dec = 2): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtNum(v: number, dec = 2): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

type PDFAgregado = { chave: string; registros: number; litros: number; valor: number };

function agruparParaPDF(
  dados: AbastecimentoCarreta[],
  keyFn: (a: AbastecimentoCarreta) => string,
  labelFn: (k: string) => string,
): PDFAgregado[] {
  const map = new Map<string, PDFAgregado>();
  dados.forEach((a) => {
    const k = keyFn(a);
    if (!k) return;
    const ex = map.get(k);
    if (ex) {
      ex.registros++;
      ex.litros += a.quantidadeLitros;
      ex.valor += a.valorTotal;
    } else {
      map.set(k, { chave: labelFn(k), registros: 1, litros: a.quantidadeLitros, valor: a.valorTotal });
    }
  });
  return [...map.values()].sort((x, y) => y.valor - x.valor);
}

export function exportarAbastecimentosCarretaPDF(
  abastecimentos: AbastecimentoCarreta[],
  combustiveis: Insumo[],
  filtros: FiltrosExport,
): void {
  const dados = aplicarFiltros(abastecimentos, filtros);
  const combustiveisMap = new Map(combustiveis.map((c) => [c.id, c.nome]));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const innerW = pageW - margin * 2;

  // ===== Banner =====
  doc.setFillColor(...PDF_RGB.verde);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFillColor(...PDF_RGB.verdeEscuro);
  doc.rect(0, 22, pageW, 6, 'F');

  doc.setTextColor(...PDF_RGB.branco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Relatório de Abastecimentos de Carreta', margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Módulo de Frete • Gestão de Obras', margin, 26);

  const now = new Date();
  const stamp = `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(8);
  doc.text(stamp, pageW - margin, 26, { align: 'right' });

  let y = 36;

  // ===== Filtros aplicados =====
  doc.setTextColor(...PDF_RGB.verdeEscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FILTROS APLICADOS', margin, y);
  doc.setDrawColor(...PDF_RGB.verde);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 1.2, pageW - margin, y + 1.2);
  y += 5;

  const filtrosList: Array<[string, string]> = [];
  if (filtros.transportadora) filtrosList.push(['Transportadora', filtros.transportadora]);
  if (filtros.placa) filtrosList.push(['Placa', filtros.placa]);
  if (filtros.combustivelId) filtrosList.push(['Combustível', combustiveisMap.get(filtros.combustivelId) || filtros.combustivelId]);
  if (filtros.mesReferencia) filtrosList.push(['Mês de referência', formatMesRef(filtros.mesReferencia)]);
  if (filtros.dataInicio) filtrosList.push(['Data início', formatDateBR(filtros.dataInicio)]);
  if (filtros.dataFim) filtrosList.push(['Data fim', formatDateBR(filtros.dataFim)]);
  if (filtrosList.length === 0) filtrosList.push(['—', 'Nenhum filtro aplicado (todos os registros)']);

  // Two-column layout for filters
  const colW = innerW / 2 - 2;
  const chipH = 8;
  filtrosList.forEach((pair, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (colW + 4);
    const cy = y + row * (chipH + 2);
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
  const rows = Math.ceil(filtrosList.length / 2);
  y += rows * (chipH + 2) + 4;

  // ===== KPIs =====
  doc.setTextColor(...PDF_RGB.verdeEscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INDICADORES', margin, y);
  doc.setDrawColor(...PDF_RGB.verde);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 1.2, pageW - margin, y + 1.2);
  y += 5;

  const totalRegistros = dados.length;
  const totalLitros = dados.reduce((s, a) => s + a.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, a) => s + a.valorTotal, 0);
  const ticketMedio = totalLitros > 0 ? totalValor / totalLitros : 0;

  const kpis: Array<[string, string]> = [
    ['Registros', String(totalRegistros)],
    ['Litros Totais', `${fmtNum(totalLitros)} L`],
    ['Valor Total', fmtBRL(totalValor)],
    ['Ticket Médio', `${fmtBRL(ticketMedio, 4)}/L`],
  ];
  const kpiW = (innerW - 9) / 4;
  const kpiH = 18;
  kpis.forEach(([label, value], i) => {
    const x = margin + i * (kpiW + 3);
    // Card background
    doc.setFillColor(...PDF_RGB.branco);
    doc.setDrawColor(...PDF_RGB.bordaLeve);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, kpiW, kpiH, 1.5, 1.5, 'FD');
    // Accent strip
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
  y += kpiH + 6;

  // ===== Tabelas demonstrativas =====
  function miniTabela(titulo: string, headerLabel: string, rows: PDFAgregado[], limit?: number) {
    const sliced = limit ? rows.slice(0, limit) : rows;
    const totalL = rows.reduce((s, r) => s + r.litros, 0) || 1;
    const totalV = rows.reduce((s, r) => s + r.valor, 0) || 1;
    const body = sliced.map((r) => [
      r.chave,
      String(r.registros),
      fmtNum(r.litros),
      fmtBRL(r.valor),
      ((r.litros / totalL) * 100).toFixed(1).replace('.', ',') + '%',
      ((r.valor / totalV) * 100).toFixed(1).replace('.', ',') + '%',
    ]);
    const totRegistros = sliced.reduce((s, r) => s + r.registros, 0);
    const totLitros = sliced.reduce((s, r) => s + r.litros, 0);
    const totValor = sliced.reduce((s, r) => s + r.valor, 0);

    // Title
    if (y > pageH - 40) {
      doc.addPage();
      y = margin + 4;
    }
    doc.setTextColor(...PDF_RGB.verdeEscuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(titulo, margin, y);
    doc.setDrawColor(...PDF_RGB.verde);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 1.2, pageW - margin, y + 1.2);
    y += 2.5;

    autoTable(doc, {
      startY: y,
      head: [[headerLabel, 'Registros', 'Litros', 'Valor Total', '% Litros', '% Valor']],
      body,
      foot: [['Total', String(totRegistros), fmtNum(totLitros), fmtBRL(totValor), '', '']],
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
      columnStyles: {
        0: { halign: 'left', cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  miniTabela(
    'POR TRANSPORTADORA',
    'Transportadora',
    agruparParaPDF(dados, (a) => a.transportadora, (k) => k),
  );

  miniTabela(
    'POR PLACA (TOP 10)',
    'Placa',
    agruparParaPDF(dados, (a) => a.placaCarreta, (k) => k),
    10,
  );

  miniTabela(
    'POR COMBUSTÍVEL',
    'Combustível',
    agruparParaPDF(dados, (a) => a.tipoCombustivel || '—', (k) => combustiveisMap.get(k) || k),
  );

  miniTabela(
    'POR MÊS DE REFERÊNCIA',
    'Mês de Referência',
    agruparParaPDF(dados, (a) => a.mesReferencia || '', (k) => formatMesRef(k))
      .sort((x, y2) => x.chave.localeCompare(y2.chave)),
  );

  // ===== Detalhamento em nova página =====
  doc.addPage();
  doc.setFillColor(...PDF_RGB.verde);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(...PDF_RGB.branco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Detalhamento dos Abastecimentos', margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${totalRegistros} registro${totalRegistros !== 1 ? 's' : ''}`, pageW - margin, 9, { align: 'right' });

  const detRows = dados.map((a) => [
    formatDateBR(a.data),
    a.transportadora || '-',
    a.placaCarreta || '-',
    formatMesRef(a.mesReferencia),
    combustiveisMap.get(a.tipoCombustivel) || a.tipoCombustivel || '-',
    fmtNum(a.quantidadeLitros),
    fmtBRL(a.valorUnidade, 4),
    fmtBRL(a.valorTotal),
    a.observacoes || '-',
  ]);

  autoTable(doc, {
    startY: 20,
    head: [['Data', 'Transportadora', 'Placa', 'Mês Ref.', 'Combustível', 'Litros', 'Valor Unit.', 'Valor Total', 'Observações']],
    body: detRows,
    foot: [[
      '',
      `TOTAL (${dados.length})`,
      '',
      '',
      '',
      fmtNum(totalLitros),
      '',
      fmtBRL(totalValor),
      '',
    ]],
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
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'left', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'left', cellWidth: 32 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 26 },
      7: { halign: 'right', cellWidth: 28 },
      8: { halign: 'left', cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin, top: 18 },
    didDrawPage: (data) => {
      const page = doc.getNumberOfPages();
      doc.setTextColor(...PDF_RGB.cinzaMedio);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Página ${data.pageNumber} de ${page}`, pageW - margin, pageH - 4, { align: 'right' });
      doc.text('Gestão de Obras • Relatório de Abastecimentos de Carreta', margin, pageH - 4);
    },
  });

  const stampFile = new Date().toISOString().slice(0, 10);
  doc.save(`abastecimentos-carreta-${stampFile}.pdf`);
}

export async function exportarAbastecimentosCarretaExcel(
  abastecimentos: AbastecimentoCarreta[],
  combustiveis: Insumo[],
  filtros: FiltrosExport,
): Promise<void> {
  const dados = aplicarFiltros(abastecimentos, filtros);
  const combustiveisMap = new Map(combustiveis.map((c) => [c.id, c.nome]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestão de Obras';
  wb.created = new Date();
  wb.properties.date1904 = false;

  const wsResumo = wb.addWorksheet('Resumo', {
    properties: { tabColor: { argb: BRAND.verde } },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  renderResumo(wsResumo, dados, combustiveisMap, filtros);

  const wsDet = wb.addWorksheet('Detalhamento', {
    properties: { tabColor: { argb: BRAND.verdeEscuro } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderDetalhamento(wsDet, dados, combustiveisMap);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `abastecimentos-carreta-${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
