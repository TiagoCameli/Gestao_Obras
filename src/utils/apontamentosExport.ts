import jsPDF from 'jspdf';
import {
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfMiniTable,
  fmtBRL,
  fmtNum,
  formatDateBR,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelMiniTable,
  saveWorkbook,
} from './exportTemplate';

const SUBTITULO = 'Módulo de Apontamentos • Gestão de Obras';

function fmtHoras(h: number): string {
  if (!h) return '-';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h${mins > 0 ? ` ${mins}min` : ''}`;
}

function buildPeriodoFiltros(di: string, df: string): Array<[string, string]> {
  const list: Array<[string, string]> = [];
  if (di) list.push(['Data início', formatDateBR(di)]);
  if (df) list.push(['Data fim', formatDateBR(df)]);
  return list;
}

// =============================================================================
// Equipamentos / Colaboradores (same shape)
// =============================================================================

type RelatorioRegistro = { nome: string; dias: number; registros: number; horas: number };

function renderHorasExcel(
  titulo: string,
  marcaFooter: string,
  scope: string,
  entidadeLabel: string,
  relatorio: RelatorioRegistro[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
): Promise<void> {
  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, titulo, SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildPeriodoFiltros(dataInicio, dataFim));
  row++;

  const totalRegistros = relatorio.reduce((s, r) => s + r.registros, 0);
  const totalDias = relatorio.reduce((s, r) => s + r.dias, 0);

  row = renderExcelKPIs(wsResumo, row, [
    { label: entidadeLabel, value: relatorio.length, numFmt: '0' },
    { label: 'Horas Totais', value: totalHoras, numFmt: '#,##0.00 "h"' },
    { label: 'Registros', value: totalRegistros, numFmt: '0' },
    { label: 'Soma de Dias', value: totalDias, numFmt: '0' },
  ]);

  // Top 10 mini-table
  const top = [...relatorio].sort((a, b) => b.horas - a.horas).slice(0, 10);
  const totalHorasTop = top.reduce((s, r) => s + r.horas, 0);
  row = renderExcelMiniTable(
    wsResumo,
    row,
    `TOP 10 ${entidadeLabel.toUpperCase()} (POR HORAS)`,
    [
      { header: entidadeLabel, align: 'left' },
      { header: 'Dias', align: 'right', numFmt: '0' },
      { header: 'Registros', align: 'right', numFmt: '0' },
      { header: 'Horas', align: 'right', numFmt: '#,##0.00' },
      { header: '% Horas', align: 'right', numFmt: '0.0%' },
    ],
    top.map((r) => ({
      cells: [r.nome, r.dias, r.registros, r.horas, totalHoras > 0 ? r.horas / totalHoras : 0],
    })),
    [
      'Total',
      top.reduce((s, r) => s + r.dias, 0),
      top.reduce((s, r) => s + r.registros, 0),
      totalHorasTop,
      '',
    ],
  );

  renderExcelDetalhamento<RelatorioRegistro>(
    wsDetalhe,
    relatorio,
    [
      { header: entidadeLabel, key: 'nome', width: 34, align: 'left', value: (r) => r.nome },
      { header: 'Dias', key: 'dias', width: 10, align: 'right', numFmt: '0',
        value: (r) => r.dias,
        footerValue: (items) => (items as RelatorioRegistro[]).reduce((s, r) => s + r.dias, 0) },
      { header: 'Registros', key: 'registros', width: 12, align: 'right', numFmt: '0',
        value: (r) => r.registros,
        footerValue: (items) => (items as RelatorioRegistro[]).reduce((s, r) => s + r.registros, 0) },
      { header: 'Horas', key: 'horas', width: 14, align: 'right', numFmt: '#,##0.00',
        emphasizeValue: true,
        value: (r) => r.horas,
        footerValue: (items) => (items as RelatorioRegistro[]).reduce((s, r) => s + r.horas, 0) },
    ],
    1,
    `TOTAL (${relatorio.length} ${relatorio.length === 1 ? 'registro' : 'registros'})`,
  );
  void marcaFooter;

  return saveWorkbook(wb, makeFilename(scope, 'xlsx'));
}

function renderHorasPDF(
  titulo: string,
  marca: string,
  scope: string,
  entidadeLabel: string,
  relatorio: RelatorioRegistro[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, titulo, SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildPeriodoFiltros(dataInicio, dataFim), margin);

  const totalRegistros = relatorio.reduce((s, r) => s + r.registros, 0);
  const totalDias = relatorio.reduce((s, r) => s + r.dias, 0);
  y = drawPdfKPIs(doc, y, [
    [entidadeLabel, String(relatorio.length)],
    ['Horas Totais', fmtHoras(totalHoras)],
    ['Registros', String(totalRegistros)],
    ['Soma de Dias', String(totalDias)],
  ], margin);

  // TOP 10
  const top = [...relatorio].sort((a, b) => b.horas - a.horas).slice(0, 10);
  const totalHorasTop = top.reduce((s, r) => s + r.horas, 0);
  y = drawPdfMiniTable(
    doc, y, `TOP 10 ${entidadeLabel.toUpperCase()} (POR HORAS)`,
    [entidadeLabel, 'Dias', 'Registros', 'Horas', '% Horas'],
    top.map((r) => [
      r.nome,
      String(r.dias),
      String(r.registros),
      fmtNum(r.horas),
      totalHoras > 0 ? ((r.horas / totalHoras) * 100).toFixed(1).replace('.', ',') + '%' : '-',
    ]),
    [
      'Total',
      String(top.reduce((s, r) => s + r.dias, 0)),
      String(top.reduce((s, r) => s + r.registros, 0)),
      fmtNum(totalHorasTop),
      '',
    ],
    {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 22 },
    },
    margin,
  );

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, `Detalhamento — ${entidadeLabel}`, relatorio.length, margin);

  const body = relatorio.map((r) => [r.nome, String(r.dias), String(r.registros), fmtHoras(r.horas)]);
  drawPdfDetailTable(
    doc, detailY,
    [entidadeLabel, 'Dias', 'Registros', 'Horas'],
    body,
    [
      `TOTAL (${relatorio.length})`,
      String(totalDias),
      String(totalRegistros),
      fmtHoras(totalHoras),
    ],
    {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 40 },
    },
    marca,
    margin,
  );

  doc.save(makeFilename(scope, 'pdf'));
}

export function exportarRelatorioEquipPDF(
  relatorio: RelatorioRegistro[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
): void {
  renderHorasPDF(
    'Relatório de Horas — Equipamentos',
    'Gestão de Obras • Horas de Equipamentos',
    'horas-equipamentos',
    'Equipamento',
    relatorio, totalHoras, dataInicio, dataFim,
  );
}

export function exportarRelatorioEquipExcel(
  relatorio: RelatorioRegistro[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
): Promise<void> {
  return renderHorasExcel(
    'Relatório de Horas — Equipamentos',
    'Gestão de Obras • Horas de Equipamentos',
    'horas-equipamentos',
    'Equipamento',
    relatorio, totalHoras, dataInicio, dataFim,
  );
}

export function exportarRelatorioColabPDF(
  relatorio: RelatorioRegistro[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
): void {
  renderHorasPDF(
    'Relatório de Horas — Colaboradores',
    'Gestão de Obras • Horas de Colaboradores',
    'horas-colaboradores',
    'Colaborador',
    relatorio, totalHoras, dataInicio, dataFim,
  );
}

export function exportarRelatorioColabExcel(
  relatorio: RelatorioRegistro[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
): Promise<void> {
  return renderHorasExcel(
    'Relatório de Horas — Colaboradores',
    'Gestão de Obras • Horas de Colaboradores',
    'horas-colaboradores',
    'Colaborador',
    relatorio, totalHoras, dataInicio, dataFim,
  );
}

// =============================================================================
// Diaristas
// =============================================================================

type DiaristaRegistro = {
  obra: string;
  dias: number;
  valor: number;
  abertas: number;
  fechadas: number;
  pagas: number;
};

const DIARIAS_TITULO = 'Relatório de Diárias';
const DIARIAS_MARCA = 'Gestão de Obras • Diárias';
const DIARIAS_SCOPE = 'diarias';

export function exportarRelatorioDiaristasPDF(
  porObra: DiaristaRegistro[],
  totais: { totalAPagar: number; totalPago: number },
  dataInicio: string,
  dataFim: string,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, DIARIAS_TITULO, SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildPeriodoFiltros(dataInicio, dataFim), margin);

  const totalObras = porObra.length;
  const totalValor = porObra.reduce((s, r) => s + r.valor, 0);
  const totalDias = porObra.reduce((s, r) => s + r.dias, 0);

  y = drawPdfKPIs(doc, y, [
    ['Obras', String(totalObras)],
    ['Dias', String(totalDias)],
    ['Valor Total', fmtBRL(totalValor)],
    ['A Pagar', fmtBRL(totais.totalAPagar)],
  ], margin);

  // Mini-table: por obra
  y = drawPdfMiniTable(
    doc, y, 'POR OBRA',
    ['Obra', 'Dias', 'Valor', 'Abertas', 'Fechadas', 'Pagas'],
    porObra.map((r) => [r.obra, String(r.dias), fmtBRL(r.valor), String(r.abertas), String(r.fechadas), String(r.pagas)]),
    [
      'Total',
      String(totalDias),
      fmtBRL(totalValor),
      String(porObra.reduce((s, r) => s + r.abertas, 0)),
      String(porObra.reduce((s, r) => s + r.fechadas, 0)),
      String(porObra.reduce((s, r) => s + r.pagas, 0)),
    ],
    {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 36 },
      3: { halign: 'right', cellWidth: 22 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
    },
    margin,
  );

  // Totais de pagamento
  y = drawPdfMiniTable(
    doc, y, 'TOTAIS DE PAGAMENTO',
    ['Item', 'Valor'],
    [
      ['A Pagar', fmtBRL(totais.totalAPagar)],
      ['Pago', fmtBRL(totais.totalPago)],
    ],
    ['Total Geral', fmtBRL(totais.totalAPagar + totais.totalPago)],
    {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 50 },
    },
    margin,
  );

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Diárias', porObra.length, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Obra', 'Dias', 'Valor', 'Abertas', 'Fechadas', 'Pagas'],
    porObra.map((r) => [r.obra, String(r.dias), fmtBRL(r.valor), String(r.abertas), String(r.fechadas), String(r.pagas)]),
    [
      `TOTAL (${porObra.length})`,
      String(totalDias),
      fmtBRL(totalValor),
      String(porObra.reduce((s, r) => s + r.abertas, 0)),
      String(porObra.reduce((s, r) => s + r.fechadas, 0)),
      String(porObra.reduce((s, r) => s + r.pagas, 0)),
    ],
    {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 24 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 26 },
    },
    DIARIAS_MARCA,
    margin,
  );

  doc.save(makeFilename(DIARIAS_SCOPE, 'pdf'));
}

export async function exportarRelatorioDiaristasExcel(
  porObra: DiaristaRegistro[],
  totais: { totalAPagar: number; totalPago: number },
  dataInicio: string,
  dataFim: string,
): Promise<void> {
  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, DIARIAS_TITULO, SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildPeriodoFiltros(dataInicio, dataFim));
  row++;

  const totalObras = porObra.length;
  const totalValor = porObra.reduce((s, r) => s + r.valor, 0);
  const totalDias = porObra.reduce((s, r) => s + r.dias, 0);

  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Obras', value: totalObras, numFmt: '0' },
    { label: 'Dias', value: totalDias, numFmt: '0' },
    { label: 'Valor Total', value: totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'A Pagar', value: totais.totalAPagar, numFmt: '"R$" #,##0.00' },
  ]);

  row = renderExcelMiniTable(
    wsResumo, row, 'TOTAIS DE PAGAMENTO',
    [
      { header: 'Item', align: 'left' },
      { header: 'Valor', align: 'right', numFmt: '"R$" #,##0.00' },
    ],
    [
      { cells: ['A Pagar', totais.totalAPagar] },
      { cells: ['Pago', totais.totalPago] },
    ],
    ['Total Geral', totais.totalAPagar + totais.totalPago],
  );

  renderExcelDetalhamento<DiaristaRegistro>(
    wsDetalhe,
    porObra,
    [
      { header: 'Obra', key: 'obra', width: 34, align: 'left', value: (r) => r.obra },
      { header: 'Dias', key: 'dias', width: 10, align: 'right', numFmt: '0',
        value: (r) => r.dias,
        footerValue: (items) => (items as DiaristaRegistro[]).reduce((s, r) => s + r.dias, 0) },
      { header: 'Valor', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (r) => r.valor,
        footerValue: (items) => (items as DiaristaRegistro[]).reduce((s, r) => s + r.valor, 0) },
      { header: 'Abertas', key: 'abertas', width: 12, align: 'right', numFmt: '0',
        value: (r) => r.abertas,
        footerValue: (items) => (items as DiaristaRegistro[]).reduce((s, r) => s + r.abertas, 0) },
      { header: 'Fechadas', key: 'fechadas', width: 12, align: 'right', numFmt: '0',
        value: (r) => r.fechadas,
        footerValue: (items) => (items as DiaristaRegistro[]).reduce((s, r) => s + r.fechadas, 0) },
      { header: 'Pagas', key: 'pagas', width: 12, align: 'right', numFmt: '0',
        value: (r) => r.pagas,
        footerValue: (items) => (items as DiaristaRegistro[]).reduce((s, r) => s + r.pagas, 0) },
    ],
    1,
    `TOTAL (${porObra.length} ${porObra.length === 1 ? 'obra' : 'obras'})`,
  );

  await saveWorkbook(wb, makeFilename(DIARIAS_SCOPE, 'xlsx'));
}
