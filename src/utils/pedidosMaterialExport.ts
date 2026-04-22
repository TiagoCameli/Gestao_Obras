import jsPDF from 'jspdf';
import type { PedidoMaterial, Fornecedor, Insumo } from '../types';
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

interface FiltrosExport {
  fornecedorId: string;
  materialId: string;
  dataInicio: string;
  dataFim: string;
}

const TITULO = 'Relatório de Pedidos de Material';
const SUBTITULO = 'Módulo de Frete • Gestão de Obras';
const MARCA = 'Gestão de Obras • Pedidos de Material';
const SCOPE = 'pedidos-material';

interface PedidoItemFlat {
  data: string;
  fornecedor: string;
  material: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
  observacoes: string;
}

function filtrar(pedidos: PedidoMaterial[], filtros: FiltrosExport): PedidoMaterial[] {
  return pedidos
    .filter((p) => {
      if (filtros.fornecedorId && p.fornecedorId !== filtros.fornecedorId) return false;
      if (filtros.materialId && !p.itens.some((i) => i.insumoId === filtros.materialId)) return false;
      if (filtros.dataInicio && p.data < filtros.dataInicio) return false;
      if (filtros.dataFim && p.data > filtros.dataFim) return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

function flattenItens(
  dados: PedidoMaterial[],
  fornecedoresMap: Map<string, string>,
  insumosMap: Map<string, string>,
  filtroMaterialId: string,
): PedidoItemFlat[] {
  const out: PedidoItemFlat[] = [];
  dados.forEach((p) => {
    const fornecedor = fornecedoresMap.get(p.fornecedorId) || '-';
    p.itens.forEach((item) => {
      if (filtroMaterialId && item.insumoId !== filtroMaterialId) return;
      out.push({
        data: p.data,
        fornecedor,
        material: insumosMap.get(item.insumoId) || item.insumoId,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        subtotal: item.quantidade * item.valorUnitario,
        observacoes: p.observacoes || '-',
      });
    });
  });
  return out;
}

function buildFiltrosList(
  filtros: FiltrosExport,
  fornecedoresMap: Map<string, string>,
  insumosMap: Map<string, string>,
): Array<[string, string]> {
  const list: Array<[string, string]> = [];
  if (filtros.fornecedorId) list.push(['Fornecedor', fornecedoresMap.get(filtros.fornecedorId) || filtros.fornecedorId]);
  if (filtros.materialId) list.push(['Material', insumosMap.get(filtros.materialId) || filtros.materialId]);
  if (filtros.dataInicio) list.push(['Data início', formatDateBR(filtros.dataInicio)]);
  if (filtros.dataFim) list.push(['Data fim', formatDateBR(filtros.dataFim)]);
  return list;
}

type Agregado = { chave: string; registros: number; quantidade: number; valor: number };

function agruparItens(
  itens: PedidoItemFlat[],
  keyFn: (i: PedidoItemFlat) => string,
): Agregado[] {
  const map = new Map<string, Agregado>();
  itens.forEach((i) => {
    const k = keyFn(i);
    if (!k) return;
    const ex = map.get(k);
    if (ex) {
      ex.registros++;
      ex.quantidade += i.quantidade;
      ex.valor += i.subtotal;
    } else {
      map.set(k, { chave: k, registros: 1, quantidade: i.quantidade, valor: i.subtotal });
    }
  });
  return [...map.values()].sort((x, y) => y.valor - x.valor);
}

function computeTotals(dados: PedidoMaterial[], itens: PedidoItemFlat[]) {
  const totalPedidos = dados.length;
  const totalItens = itens.length;
  const totalQuantidade = itens.reduce((s, i) => s + i.quantidade, 0);
  const totalValor = itens.reduce((s, i) => s + i.subtotal, 0);
  return { totalPedidos, totalItens, totalQuantidade, totalValor };
}

// =============================================================================
// Excel
// =============================================================================

export async function exportarPedidosMaterialExcel(
  pedidos: PedidoMaterial[],
  fornecedores: Fornecedor[],
  insumos: Insumo[],
  filtros: FiltrosExport,
): Promise<void> {
  const dados = filtrar(pedidos, filtros);
  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f.nome]));
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));
  const itens = flattenItens(dados, fornecedoresMap, insumosMap, filtros.materialId);
  const totals = computeTotals(dados, itens);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, TITULO, SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtros, fornecedoresMap, insumosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Pedidos', value: totals.totalPedidos, numFmt: '0' },
    { label: 'Itens', value: totals.totalItens, numFmt: '0' },
    { label: 'Qtd. Total', value: totals.totalQuantidade, numFmt: '#,##0.00' },
    { label: 'Valor Total', value: totals.totalValor, numFmt: '"R$" #,##0.00' },
  ]);

  function miniTable(titulo: string, headerLabel: string, ags: Agregado[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totalValor = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totalQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    const rows = sliced.map((r) => ({
      cells: [r.chave, r.registros, r.quantidade, r.valor, r.quantidade / totalQtd, r.valor / totalValor] as (string | number)[],
    }));
    const totRegistros = sliced.reduce((s, r) => s + r.registros, 0);
    const totQtd = sliced.reduce((s, r) => s + r.quantidade, 0);
    const totVal = sliced.reduce((s, r) => s + r.valor, 0);
    row = renderExcelMiniTable(
      wsResumo,
      row,
      titulo,
      [
        { header: headerLabel, align: 'left' },
        { header: 'Itens', align: 'right', numFmt: '0' },
        { header: 'Quantidade', align: 'right', numFmt: '#,##0.00' },
        { header: 'Valor Total', align: 'right', numFmt: '"R$" #,##0.00' },
        { header: '% Qtd', align: 'right', numFmt: '0.0%' },
        { header: '% Valor', align: 'right', numFmt: '0.0%' },
      ],
      rows,
      ['Total', totRegistros, totQtd, totVal, '', ''],
    );
  }

  miniTable('POR FORNECEDOR', 'Fornecedor', agruparItens(itens, (i) => i.fornecedor));
  miniTable('POR MATERIAL', 'Material', agruparItens(itens, (i) => i.material));

  renderExcelDetalhamento<PedidoItemFlat>(
    wsDetalhe,
    itens,
    [
      { header: 'Data', key: 'data', width: 12, align: 'center', value: (i) => formatDateBR(i.data) },
      { header: 'Fornecedor', key: 'fornecedor', width: 26, align: 'left', value: (i) => i.fornecedor },
      { header: 'Material', key: 'material', width: 28, align: 'left', value: (i) => i.material },
      { header: 'Quantidade', key: 'quantidade', width: 14, align: 'right', numFmt: '#,##0.00',
        value: (i) => i.quantidade,
        footerValue: (items) => (items as PedidoItemFlat[]).reduce((s, x) => s + x.quantidade, 0) },
      { header: 'Valor Unit.', key: 'valorUnitario', width: 16, align: 'right', numFmt: '"R$" #,##0.0000', value: (i) => i.valorUnitario },
      { header: 'Subtotal', key: 'subtotal', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (i) => i.subtotal,
        footerValue: (items) => (items as PedidoItemFlat[]).reduce((s, x) => s + x.subtotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (i) => i.observacoes },
    ],
    2,
    `TOTAL (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})`,
  );

  await saveWorkbook(wb, makeFilename(SCOPE, 'xlsx'));
}

// =============================================================================
// PDF
// =============================================================================

export function exportarPedidosMaterialPDF(
  pedidos: PedidoMaterial[],
  fornecedores: Fornecedor[],
  insumos: Insumo[],
  filtros: FiltrosExport,
): void {
  const dados = filtrar(pedidos, filtros);
  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f.nome]));
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));
  const itens = flattenItens(dados, fornecedoresMap, insumosMap, filtros.materialId);
  const totals = computeTotals(dados, itens);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, TITULO, SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtros, fornecedoresMap, insumosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Pedidos', String(totals.totalPedidos)],
    ['Itens', String(totals.totalItens)],
    ['Qtd. Total', fmtNum(totals.totalQuantidade)],
    ['Valor Total', fmtBRL(totals.totalValor)],
  ], margin);

  function miniTable(titulo: string, headerLabel: string, ags: Agregado[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totalVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totalQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    const body = sliced.map((r) => [
      r.chave,
      String(r.registros),
      fmtNum(r.quantidade),
      fmtBRL(r.valor),
      ((r.quantidade / totalQtd) * 100).toFixed(1).replace('.', ',') + '%',
      ((r.valor / totalVal) * 100).toFixed(1).replace('.', ',') + '%',
    ]);
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Itens', 'Quantidade', 'Valor Total', '% Qtd', '% Valor'],
      body,
      [
        'Total',
        String(sliced.reduce((s, r) => s + r.registros, 0)),
        fmtNum(sliced.reduce((s, r) => s + r.quantidade, 0)),
        fmtBRL(sliced.reduce((s, r) => s + r.valor, 0)),
        '', '',
      ],
      {
        0: { halign: 'left', cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 22 },
      },
      margin,
    );
  }

  miniTable('POR FORNECEDOR', 'Fornecedor', agruparItens(itens, (i) => i.fornecedor));
  miniTable('POR MATERIAL', 'Material', agruparItens(itens, (i) => i.material));

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento dos Pedidos', itens.length, margin);

  const detRows = itens.map((i) => [
    formatDateBR(i.data),
    i.fornecedor,
    i.material,
    fmtNum(i.quantidade),
    fmtBRL(i.valorUnitario, 4),
    fmtBRL(i.subtotal),
    i.observacoes,
  ]);

  drawPdfDetailTable(
    doc,
    detailY,
    ['Data', 'Fornecedor', 'Material', 'Quantidade', 'Valor Unit.', 'Subtotal', 'Observações'],
    detRows,
    [
      '',
      `TOTAL (${itens.length})`,
      '',
      fmtNum(totals.totalQuantidade),
      '',
      fmtBRL(totals.totalValor),
      '',
    ],
    {
      0: { halign: 'center', cellWidth: 22 },
      1: { halign: 'left', cellWidth: 50 },
      2: { halign: 'left', cellWidth: 60 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 30 },
      6: { halign: 'left', cellWidth: 'auto' },
    },
    MARCA,
    margin,
  );

  doc.save(makeFilename(SCOPE, 'pdf'));
}
