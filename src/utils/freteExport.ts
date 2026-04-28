import jsPDF from 'jspdf';
import type { Frete, Insumo } from '../types';
import {
  BRAND,
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
  obraId: string;
  transportadora: string;
  motorista: string;
  insumoId: string;
  origem: string;
  destino: string;
  dataInicio: string;
  dataFim: string;
  notaFiscal: string;
}

const TITULO = 'Relatório de Fretes';
const SUBTITULO = 'Módulo de Frete • Gestão de Obras';
const MARCA = 'Gestão de Obras • Relatório de Fretes';
const SCOPE = 'fretes';

function filtrarFretes(fretes: Frete[], filtros: FiltrosExport): Frete[] {
  return fretes
    .filter((f) => {
      if (filtros.obraId && f.obraId !== filtros.obraId) return false;
      if (filtros.transportadora && f.transportadora !== filtros.transportadora) return false;
      if (filtros.motorista) {
        const q = filtros.motorista.toLowerCase();
        if (!f.motorista?.toLowerCase().includes(q)) return false;
      }
      if (filtros.insumoId && f.insumoId !== filtros.insumoId) return false;
      if (filtros.origem && f.origem?.trim() !== filtros.origem) return false;
      if (filtros.destino && f.destino?.trim() !== filtros.destino) return false;
      if (filtros.dataInicio && f.data < filtros.dataInicio) return false;
      if (filtros.dataFim && f.data > filtros.dataFim) return false;
      if (filtros.notaFiscal) {
        const q = filtros.notaFiscal.toLowerCase();
        if (!f.notaFiscal?.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

function buildFiltrosList(
  filtros: FiltrosExport,
  insumosMap: Map<string, string>,
  obrasMap?: Map<string, string>,
): Array<[string, string]> {
  const list: Array<[string, string]> = [];
  if (filtros.obraId) list.push(['Obra', obrasMap?.get(filtros.obraId) || filtros.obraId]);
  if (filtros.transportadora) list.push(['Transportadora', filtros.transportadora]);
  if (filtros.motorista) list.push(['Motorista', filtros.motorista]);
  if (filtros.insumoId) list.push(['Material', insumosMap.get(filtros.insumoId) || filtros.insumoId]);
  if (filtros.origem) list.push(['Origem', filtros.origem]);
  if (filtros.dataInicio) list.push(['Data início', formatDateBR(filtros.dataInicio)]);
  if (filtros.dataFim) list.push(['Data fim', formatDateBR(filtros.dataFim)]);
  if (filtros.notaFiscal) list.push(['Nota Fiscal', filtros.notaFiscal]);
  return list;
}

type Agregado = { chave: string; registros: number; peso: number; valor: number; valorMaterial: number };

function agrupar(
  dados: Frete[],
  keyFn: (f: Frete) => string,
  labelFn: (k: string) => string,
): Agregado[] {
  const map = new Map<string, Agregado>();
  dados.forEach((f) => {
    const k = keyFn(f);
    if (!k) return;
    const exist = map.get(k);
    if (exist) {
      exist.registros++;
      exist.peso += f.pesoToneladas;
      exist.valor += f.valorTotal;
      exist.valorMaterial += f.valorMaterial || 0;
    } else {
      map.set(k, {
        chave: labelFn(k),
        registros: 1,
        peso: f.pesoToneladas,
        valor: f.valorTotal,
        valorMaterial: f.valorMaterial || 0,
      });
    }
  });
  return [...map.values()].sort((a, b) => b.valor - a.valor);
}

function computeTotals(dados: Frete[]) {
  const totalRegistros = dados.length;
  const totalPeso = dados.reduce((s, f) => s + f.pesoToneladas, 0);
  const totalValor = dados.reduce((s, f) => s + f.valorTotal, 0);
  const totalMaterial = dados.reduce((s, f) => s + (f.valorMaterial || 0), 0);
  return { totalRegistros, totalPeso, totalValor, totalMaterial };
}

// =============================================================================
// Excel
// =============================================================================

export async function exportarFretesExcel(
  fretes: Frete[],
  insumos: Insumo[],
  filtros: FiltrosExport,
): Promise<void> {
  const dados = filtrarFretes(fretes, filtros);
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));
  const totals = computeTotals(dados);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  // ── Resumo ──
  let row = renderExcelBanner(wsResumo, TITULO, SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtros, insumosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: totals.totalRegistros, numFmt: '0' },
    { label: 'Peso Total', value: totals.totalPeso, numFmt: '#,##0.00 "t"' },
    { label: 'Valor Fretes', value: totals.totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'Valor Material', value: totals.totalMaterial, numFmt: '"R$" #,##0.00' },
  ]);

  function miniTable(
    titulo: string,
    headerLabel: string,
    ags: Agregado[],
    limit?: number,
  ) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totalPeso = ags.reduce((s, r) => s + r.peso, 0) || 1;
    const totalValor = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const rows = sliced.map((r) => ({
      cells: [
        r.chave,
        r.registros,
        r.peso,
        r.valor,
        r.peso / totalPeso,
        r.valor / totalValor,
      ] as (string | number)[],
    }));
    const totRegistros = sliced.reduce((s, r) => s + r.registros, 0);
    const totPeso = sliced.reduce((s, r) => s + r.peso, 0);
    const totValor = sliced.reduce((s, r) => s + r.valor, 0);
    row = renderExcelMiniTable(
      wsResumo,
      row,
      titulo,
      [
        { header: headerLabel, align: 'left' },
        { header: 'Registros', align: 'right', numFmt: '0' },
        { header: 'Peso (t)', align: 'right', numFmt: '#,##0.00' },
        { header: 'Valor Total', align: 'right', numFmt: '"R$" #,##0.00' },
        { header: '% Peso', align: 'right', numFmt: '0.0%' },
        { header: '% Valor', align: 'right', numFmt: '0.0%' },
      ],
      rows,
      ['Total', totRegistros, totPeso, totValor, '', ''],
    );
  }

  miniTable('POR TRANSPORTADORA', 'Transportadora', agrupar(dados, (f) => f.transportadora, (k) => k));
  miniTable('POR MATERIAL', 'Material', agrupar(dados, (f) => f.insumoId, (k) => insumosMap.get(k) || k));
  miniTable('POR ORIGEM', 'Origem', agrupar(dados, (f) => f.origem || '—', (k) => k));
  miniTable('POR MOTORISTA (TOP 10)', 'Motorista', agrupar(dados, (f) => f.motorista || '—', (k) => k), 10);

  // ── Detalhamento ──
  renderExcelDetalhamento<Frete>(
    wsDetalhe,
    dados,
    [
      { header: 'Saída', key: 'data', width: 12, align: 'center', value: (f) => formatDateBR(f.data) },
      { header: 'Chegada', key: 'dataChegada', width: 12, align: 'center', value: (f) => formatDateBR(f.dataChegada) },
      { header: 'Origem', key: 'origem', width: 20, align: 'left', value: (f) => f.origem || '-' },
      { header: 'Destino', key: 'destino', width: 20, align: 'left', value: (f) => f.destino || '-' },
      { header: 'Transportadora', key: 'transportadora', width: 24, align: 'left', value: (f) => f.transportadora || '-' },
      { header: 'Motorista', key: 'motorista', width: 20, align: 'left', value: (f) => f.motorista || '-' },
      { header: 'Placa', key: 'placaCarreta', width: 12, align: 'center', value: (f) => f.placaCarreta || '-' },
      { header: 'Material', key: 'material', width: 22, align: 'left', value: (f) => insumosMap.get(f.insumoId) || '-' },
      { header: 'Peso (t)', key: 'peso', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (f) => f.pesoToneladas,
        footerValue: (items) => (items as Frete[]).reduce((s, f) => s + f.pesoToneladas, 0) },
      { header: 'KM', key: 'km', width: 10, align: 'right', numFmt: '#,##0.0', value: (f) => f.kmRodados },
      { header: 'R$/TKM', key: 'valorTkm', width: 12, align: 'right', numFmt: '#,##0.0000', value: (f) => f.valorTkm },
      { header: 'Valor Total', key: 'valorTotal', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (f) => f.valorTotal,
        footerValue: (items) => (items as Frete[]).reduce((s, f) => s + f.valorTotal, 0) },
      { header: 'Preço Material', key: 'valorMaterial', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        value: (f) => f.valorMaterial || 0,
        footerValue: (items) => (items as Frete[]).reduce((s, f) => s + (f.valorMaterial || 0), 0) },
      { header: 'Preço Unit. Material (R$/t)', key: 'valorMaterialUnit', width: 22, align: 'right', numFmt: '"R$" #,##0.0000',
        value: (f) => (f.valorMaterial && f.pesoToneladas ? +(f.valorMaterial / f.pesoToneladas).toFixed(4) : 0) },
      { header: 'NF', key: 'notaFiscal', width: 14, align: 'center', value: (f) => f.notaFiscal || '-' },
      { header: 'NF 2', key: 'notaFiscal2', width: 14, align: 'center', value: (f) => f.notaFiscal2 || '-' },
      { header: 'ID', key: 'id', width: 32, align: 'left', value: (f) => f.id },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (f) => f.observacoes || '-' },
    ],
    5,
    `TOTAL (${dados.length} registro${dados.length !== 1 ? 's' : ''})`,
  );
  // Ensure tab color stays green
  wsDetalhe.properties.tabColor = { argb: BRAND.verdeEscuro };

  await saveWorkbook(wb, makeFilename(SCOPE, 'xlsx'));
}

// =============================================================================
// PDF
// =============================================================================

export function exportarFretesPDF(
  fretes: Frete[],
  insumos: Insumo[],
  filtros: FiltrosExport,
): void {
  const dados = filtrarFretes(fretes, filtros);
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));
  const totals = computeTotals(dados);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, TITULO, SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtros, insumosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(totals.totalRegistros)],
    ['Peso Total', `${fmtNum(totals.totalPeso)} t`],
    ['Valor Fretes', fmtBRL(totals.totalValor)],
    ['Valor Material', fmtBRL(totals.totalMaterial)],
  ], margin);

  function miniTable(titulo: string, headerLabel: string, ags: Agregado[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totalPeso = ags.reduce((s, r) => s + r.peso, 0) || 1;
    const totalValor = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const body = sliced.map((r) => [
      r.chave,
      String(r.registros),
      fmtNum(r.peso),
      fmtBRL(r.valor),
      ((r.peso / totalPeso) * 100).toFixed(1).replace('.', ',') + '%',
      ((r.valor / totalValor) * 100).toFixed(1).replace('.', ',') + '%',
    ]);
    const totRegistros = sliced.reduce((s, r) => s + r.registros, 0);
    const totPeso = sliced.reduce((s, r) => s + r.peso, 0);
    const totValor = sliced.reduce((s, r) => s + r.valor, 0);
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Peso (t)', 'Valor Total', '% Peso', '% Valor'],
      body,
      ['Total', String(totRegistros), fmtNum(totPeso), fmtBRL(totValor), '', ''],
      {
        0: { halign: 'left', cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 20 },
      },
      margin,
    );
  }

  miniTable('POR TRANSPORTADORA', 'Transportadora', agrupar(dados, (f) => f.transportadora, (k) => k));
  miniTable('POR MATERIAL', 'Material', agrupar(dados, (f) => f.insumoId, (k) => insumosMap.get(k) || k));
  miniTable('POR ORIGEM', 'Origem', agrupar(dados, (f) => f.origem || '—', (k) => k));
  miniTable('POR MOTORISTA (TOP 10)', 'Motorista', agrupar(dados, (f) => f.motorista || '—', (k) => k), 10);

  // ── Detalhamento em nova página ──
  doc.addPage();
  const detailStartY = drawPdfDetailPageHeader(doc, 'Detalhamento dos Fretes', totals.totalRegistros, margin);

  const detRows = dados.map((f) => [
    formatDateBR(f.data),
    formatDateBR(f.dataChegada),
    `${f.origem || '-'} → ${f.destino || '-'}`,
    f.transportadora || '-',
    f.motorista || '-',
    f.placaCarreta || '-',
    insumosMap.get(f.insumoId) || '-',
    fmtNum(f.pesoToneladas),
    fmtNum(f.kmRodados, 1),
    fmtNum(f.valorTkm, 4),
    fmtBRL(f.valorTotal),
    f.valorMaterial ? fmtBRL(f.valorMaterial) : '-',
    f.notaFiscal || '-',
    f.notaFiscal2 || '-',
  ]);

  drawPdfDetailTable(
    doc,
    detailStartY,
    ['Saída', 'Chegada', 'Origem → Destino', 'Transportadora', 'Motorista', 'Placa', 'Material', 'Peso (t)', 'KM', 'R$/TKM', 'Total', 'Preço Material', 'NF', 'NF 2'],
    detRows,
    [
      '', '',
      `TOTAL (${dados.length})`,
      '', '', '', '',
      fmtNum(totals.totalPeso), '', '',
      fmtBRL(totals.totalValor),
      totals.totalMaterial > 0 ? fmtBRL(totals.totalMaterial) : '',
      '', '',
    ],
    {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'left', cellWidth: 40 },
      3: { halign: 'left', cellWidth: 32 },
      4: { halign: 'left', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'left', cellWidth: 30 },
      7: { halign: 'right', cellWidth: 18 },
      8: { halign: 'right', cellWidth: 16 },
      9: { halign: 'right', cellWidth: 18 },
      10: { halign: 'right', cellWidth: 24 },
      11: { halign: 'right', cellWidth: 24 },
      12: { halign: 'center', cellWidth: 16 },
      13: { halign: 'center', cellWidth: 16 },
    },
    MARCA,
    margin,
  );

  doc.save(makeFilename(SCOPE, 'pdf'));
}
