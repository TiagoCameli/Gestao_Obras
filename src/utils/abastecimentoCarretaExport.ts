import jsPDF from 'jspdf';
import type { AbastecimentoCarreta, Insumo } from '../types';
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
  formatMesRef,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelMiniTable,
  saveWorkbook,
} from './exportTemplate';

interface FiltrosExport {
  transportadora: string;
  placa: string;
  combustivelId: string;
  mesReferencia: string;
  dataInicio: string;
  dataFim: string;
}

const TITULO = 'Relatório de Abastecimentos de Carreta';
const SUBTITULO = 'Módulo de Frete • Gestão de Obras';
const MARCA = 'Gestão de Obras • Relatório de Abastecimentos de Carreta';
const SCOPE = 'abastecimentos-carreta';

function aplicarFiltros(
  abastecimentos: AbastecimentoCarreta[],
  filtros: FiltrosExport,
): AbastecimentoCarreta[] {
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

function buildFiltrosList(
  filtros: FiltrosExport,
  combustiveisMap: Map<string, string>,
): Array<[string, string]> {
  const list: Array<[string, string]> = [];
  if (filtros.transportadora) list.push(['Transportadora', filtros.transportadora]);
  if (filtros.placa) list.push(['Placa', filtros.placa]);
  if (filtros.combustivelId) list.push(['Combustível', combustiveisMap.get(filtros.combustivelId) || filtros.combustivelId]);
  if (filtros.mesReferencia) list.push(['Mês de referência', formatMesRef(filtros.mesReferencia)]);
  if (filtros.dataInicio) list.push(['Data início', formatDateBR(filtros.dataInicio)]);
  if (filtros.dataFim) list.push(['Data fim', formatDateBR(filtros.dataFim)]);
  return list;
}

type Agregado = { chave: string; registros: number; litros: number; valor: number };

function agrupar(
  dados: AbastecimentoCarreta[],
  keyFn: (a: AbastecimentoCarreta) => string,
  labelFn: (k: string) => string,
): Agregado[] {
  const map = new Map<string, Agregado>();
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
  return [...map.values()].sort((a, b) => b.valor - a.valor);
}

function totals(dados: AbastecimentoCarreta[]) {
  const totalRegistros = dados.length;
  const totalLitros = dados.reduce((s, a) => s + a.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, a) => s + a.valorTotal, 0);
  const ticketMedio = totalLitros > 0 ? totalValor / totalLitros : 0;
  return { totalRegistros, totalLitros, totalValor, ticketMedio };
}

// =============================================================================
// Excel
// =============================================================================

export async function exportarAbastecimentosCarretaExcel(
  abastecimentos: AbastecimentoCarreta[],
  combustiveis: Insumo[],
  filtros: FiltrosExport,
): Promise<void> {
  const dados = aplicarFiltros(abastecimentos, filtros);
  const combustiveisMap = new Map(combustiveis.map((c) => [c.id, c.nome]));
  const t = totals(dados);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, TITULO, SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtros, combustiveisMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: t.totalRegistros, numFmt: '0' },
    { label: 'Litros Totais', value: t.totalLitros, numFmt: '#,##0.00 "L"' },
    { label: 'Valor Total', value: t.totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'Ticket Médio (R$/L)', value: t.ticketMedio, numFmt: '"R$" #,##0.0000' },
  ]);

  function mini(titulo: string, headerLabel: string, ags: Agregado[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totL = ags.reduce((s, r) => s + r.litros, 0) || 1;
    const totV = ags.reduce((s, r) => s + r.valor, 0) || 1;
    row = renderExcelMiniTable(
      wsResumo, row, titulo,
      [
        { header: headerLabel, align: 'left' },
        { header: 'Registros', align: 'right', numFmt: '0' },
        { header: 'Litros', align: 'right', numFmt: '#,##0.00' },
        { header: 'Valor Total', align: 'right', numFmt: '"R$" #,##0.00' },
        { header: '% Litros', align: 'right', numFmt: '0.0%' },
        { header: '% Valor', align: 'right', numFmt: '0.0%' },
      ],
      sliced.map((r) => ({ cells: [r.chave, r.registros, r.litros, r.valor, r.litros / totL, r.valor / totV] })),
      [
        'Total',
        sliced.reduce((s, r) => s + r.registros, 0),
        sliced.reduce((s, r) => s + r.litros, 0),
        sliced.reduce((s, r) => s + r.valor, 0),
        '', '',
      ],
    );
  }

  mini('POR TRANSPORTADORA', 'Transportadora', agrupar(dados, (a) => a.transportadora, (k) => k));
  mini('POR PLACA (TOP 10)', 'Placa', agrupar(dados, (a) => a.placaCarreta, (k) => k), 10);
  mini('POR COMBUSTÍVEL', 'Combustível', agrupar(dados, (a) => a.tipoCombustivel || '—', (k) => combustiveisMap.get(k) || k));
  mini(
    'POR MÊS DE REFERÊNCIA',
    'Mês de Referência',
    agrupar(dados, (a) => a.mesReferencia || '', (k) => formatMesRef(k)).sort((x, y) => x.chave.localeCompare(y.chave)),
  );

  renderExcelDetalhamento<AbastecimentoCarreta>(
    wsDetalhe,
    dados,
    [
      { header: 'Data', key: 'data', width: 14, align: 'center', value: (a) => formatDateBR(a.data) },
      { header: 'Transportadora', key: 'transportadora', width: 28, align: 'left', value: (a) => a.transportadora || '-' },
      { header: 'Placa', key: 'placa', width: 12, align: 'center', value: (a) => a.placaCarreta || '-' },
      { header: 'Mês Ref.', key: 'mes', width: 12, align: 'center', value: (a) => formatMesRef(a.mesReferencia) },
      { header: 'Combustível', key: 'combustivel', width: 18, align: 'left', value: (a) => combustiveisMap.get(a.tipoCombustivel) || a.tipoCombustivel || '-' },
      { header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (a) => a.quantidadeLitros,
        footerValue: (items) => (items as AbastecimentoCarreta[]).reduce((s, a) => s + a.quantidadeLitros, 0) },
      { header: 'Valor Unit.', key: 'valorUnit', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (a) => a.valorUnidade },
      { header: 'Valor Total', key: 'valorTotal', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (a) => a.valorTotal,
        footerValue: (items) => (items as AbastecimentoCarreta[]).reduce((s, a) => s + a.valorTotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 32, align: 'left', value: (a) => a.observacoes || '' },
    ],
    2,
    `TOTAL (${dados.length} ${dados.length === 1 ? 'registro' : 'registros'})`,
  );

  await saveWorkbook(wb, makeFilename(SCOPE, 'xlsx'));
}

// =============================================================================
// PDF
// =============================================================================

export function exportarAbastecimentosCarretaPDF(
  abastecimentos: AbastecimentoCarreta[],
  combustiveis: Insumo[],
  filtros: FiltrosExport,
): void {
  const dados = aplicarFiltros(abastecimentos, filtros);
  const combustiveisMap = new Map(combustiveis.map((c) => [c.id, c.nome]));
  const t = totals(dados);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, TITULO, SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtros, combustiveisMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(t.totalRegistros)],
    ['Litros Totais', `${fmtNum(t.totalLitros)} L`],
    ['Valor Total', fmtBRL(t.totalValor)],
    ['Ticket Médio', `${fmtBRL(t.ticketMedio, 4)}/L`],
  ], margin);

  function mini(titulo: string, headerLabel: string, ags: Agregado[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totL = ags.reduce((s, r) => s + r.litros, 0) || 1;
    const totV = ags.reduce((s, r) => s + r.valor, 0) || 1;
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Litros', 'Valor Total', '% Litros', '% Valor'],
      sliced.map((r) => [
        r.chave,
        String(r.registros),
        fmtNum(r.litros),
        fmtBRL(r.valor),
        ((r.litros / totL) * 100).toFixed(1).replace('.', ',') + '%',
        ((r.valor / totV) * 100).toFixed(1).replace('.', ',') + '%',
      ]),
      [
        'Total',
        String(sliced.reduce((s, r) => s + r.registros, 0)),
        fmtNum(sliced.reduce((s, r) => s + r.litros, 0)),
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

  mini('POR TRANSPORTADORA', 'Transportadora', agrupar(dados, (a) => a.transportadora, (k) => k));
  mini('POR PLACA (TOP 10)', 'Placa', agrupar(dados, (a) => a.placaCarreta, (k) => k), 10);
  mini('POR COMBUSTÍVEL', 'Combustível', agrupar(dados, (a) => a.tipoCombustivel || '—', (k) => combustiveisMap.get(k) || k));
  mini(
    'POR MÊS DE REFERÊNCIA',
    'Mês de Referência',
    agrupar(dados, (a) => a.mesReferencia || '', (k) => formatMesRef(k)).sort((x, y2) => x.chave.localeCompare(y2.chave)),
  );

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento dos Abastecimentos', t.totalRegistros, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Data', 'Transportadora', 'Placa', 'Mês Ref.', 'Combustível', 'Litros', 'Valor Unit.', 'Valor Total', 'Observações'],
    dados.map((a) => [
      formatDateBR(a.data),
      a.transportadora || '-',
      a.placaCarreta || '-',
      formatMesRef(a.mesReferencia),
      combustiveisMap.get(a.tipoCombustivel) || a.tipoCombustivel || '-',
      fmtNum(a.quantidadeLitros),
      fmtBRL(a.valorUnidade, 4),
      fmtBRL(a.valorTotal),
      a.observacoes || '-',
    ]),
    [
      '',
      `TOTAL (${dados.length})`,
      '', '', '',
      fmtNum(t.totalLitros),
      '',
      fmtBRL(t.totalValor),
      '',
    ],
    {
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
    MARCA,
    margin,
  );

  doc.save(makeFilename(SCOPE, 'pdf'));
}
