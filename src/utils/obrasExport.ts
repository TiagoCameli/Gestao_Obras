import jsPDF from 'jspdf';
import type { Obra, EtapaObra } from '../types';
import {
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfMiniTable,
  fmtBRL,
  formatDateBR,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelMiniTable,
  saveWorkbook,
} from './exportTemplate';

const STATUS_LABELS: Record<string, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
};

const TITULO = 'Relatório de Orçamentos — Obras';
const SUBTITULO = 'Módulo de Obras • Gestão de Obras';
const MARCA = 'Gestão de Obras • Orçamentos de Obras';
const SCOPE = 'orcamentos-obras';

interface LinhaObra {
  nome: string;
  status: string;
  responsavel: string;
  dataInicio: string;
  dataPrevisaoFim: string;
  orcamento: number;
  totalEtapas: number;
  qtdEtapas: number;
  diff: number;
}

interface LinhaEtapa {
  obra: string;
  etapa: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

function computeRows(obras: Obra[], etapas: EtapaObra[]): { linhas: LinhaObra[]; linhasEtapas: LinhaEtapa[] } {
  const linhas: LinhaObra[] = obras.map((o) => {
    const es = etapas.filter((e) => e.obraId === o.id);
    const totalEtapas = es.reduce((sum, e) => sum + e.quantidade * e.valorUnitario, 0);
    return {
      nome: o.nome,
      status: STATUS_LABELS[o.status] ?? o.status,
      responsavel: o.responsavel || '—',
      dataInicio: o.dataInicio,
      dataPrevisaoFim: o.dataPrevisaoFim,
      orcamento: o.orcamento,
      totalEtapas,
      qtdEtapas: es.length,
      diff: o.orcamento - totalEtapas,
    };
  });

  const linhasEtapas: LinhaEtapa[] = obras.flatMap((o) => {
    const es = etapas.filter((e) => e.obraId === o.id);
    if (es.length === 0) {
      return [{
        obra: o.nome,
        etapa: '(sem etapas)',
        unidade: '',
        quantidade: 0,
        valorUnitario: 0,
        valorTotal: 0,
      }];
    }
    return es.map((e) => ({
      obra: o.nome,
      etapa: e.nome,
      unidade: e.unidade || '—',
      quantidade: e.quantidade,
      valorUnitario: e.valorUnitario,
      valorTotal: e.quantidade * e.valorUnitario,
    }));
  });

  return { linhas, linhasEtapas };
}

// =============================================================================
// Excel
// =============================================================================

export async function exportarOrcamentoExcel(
  obras: Obra[],
  todasEtapas: EtapaObra[],
): Promise<void> {
  const { linhas, linhasEtapas } = computeRows(obras, todasEtapas);
  const totalOrcamento = linhas.reduce((s, l) => s + l.orcamento, 0);
  const totalEtapas = linhas.reduce((s, l) => s + l.totalEtapas, 0);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, TITULO, SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, []);
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Obras', value: obras.length, numFmt: '0' },
    { label: 'Orçamento Total', value: totalOrcamento, numFmt: '"R$" #,##0.00' },
    { label: 'Soma Etapas', value: totalEtapas, numFmt: '"R$" #,##0.00' },
    { label: 'Diferença', value: totalOrcamento - totalEtapas, numFmt: '"R$" #,##0.00' },
  ]);

  // Por status
  const porStatusMap = new Map<string, { count: number; orcamento: number; etapas: number }>();
  linhas.forEach((l) => {
    const e = porStatusMap.get(l.status);
    if (e) {
      e.count++;
      e.orcamento += l.orcamento;
      e.etapas += l.totalEtapas;
    } else {
      porStatusMap.set(l.status, { count: 1, orcamento: l.orcamento, etapas: l.totalEtapas });
    }
  });
  const porStatus = [...porStatusMap.entries()].map(([k, v]) => ({ chave: k, ...v }))
    .sort((a, b) => b.orcamento - a.orcamento);

  row = renderExcelMiniTable(
    wsResumo, row, 'POR STATUS',
    [
      { header: 'Status', align: 'left' },
      { header: 'Obras', align: 'right', numFmt: '0' },
      { header: 'Orçamento', align: 'right', numFmt: '"R$" #,##0.00' },
      { header: 'Soma Etapas', align: 'right', numFmt: '"R$" #,##0.00' },
    ],
    porStatus.map((s) => ({ cells: [s.chave, s.count, s.orcamento, s.etapas] })),
    [
      'Total',
      porStatus.reduce((s, r) => s + r.count, 0),
      porStatus.reduce((s, r) => s + r.orcamento, 0),
      porStatus.reduce((s, r) => s + r.etapas, 0),
    ],
  );

  // Por obra (top 10 por orçamento)
  const topObras = [...linhas].sort((a, b) => b.orcamento - a.orcamento).slice(0, 10);
  row = renderExcelMiniTable(
    wsResumo, row, 'TOP 10 OBRAS (POR ORÇAMENTO)',
    [
      { header: 'Obra', align: 'left' },
      { header: 'Status', align: 'left' },
      { header: 'Orçamento', align: 'right', numFmt: '"R$" #,##0.00' },
      { header: 'Soma Etapas', align: 'right', numFmt: '"R$" #,##0.00' },
      { header: 'Diferença', align: 'right', numFmt: '"R$" #,##0.00' },
    ],
    topObras.map((o) => ({ cells: [o.nome, o.status, o.orcamento, o.totalEtapas, o.diff] })),
    [
      'Total',
      '',
      topObras.reduce((s, o) => s + o.orcamento, 0),
      topObras.reduce((s, o) => s + o.totalEtapas, 0),
      topObras.reduce((s, o) => s + o.diff, 0),
    ],
  );

  // Detalhamento = linhas de etapas
  renderExcelDetalhamento<LinhaEtapa>(
    wsDetalhe,
    linhasEtapas,
    [
      { header: 'Obra', key: 'obra', width: 30, align: 'left', value: (r) => r.obra },
      { header: 'Etapa', key: 'etapa', width: 30, align: 'left', value: (r) => r.etapa },
      { header: 'Unidade', key: 'unidade', width: 12, align: 'center', value: (r) => r.unidade },
      { header: 'Quantidade', key: 'quantidade', width: 14, align: 'right', numFmt: '#,##0.00',
        value: (r) => r.quantidade,
        footerValue: (items) => (items as LinhaEtapa[]).reduce((s, r) => s + r.quantidade, 0) },
      { header: 'Valor Unitário', key: 'valorUnitario', width: 18, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.valorUnitario },
      { header: 'Valor Total', key: 'valorTotal', width: 18, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (r) => r.valorTotal,
        footerValue: (items) => (items as LinhaEtapa[]).reduce((s, r) => s + r.valorTotal, 0) },
    ],
    2,
    `TOTAL (${linhasEtapas.length} ${linhasEtapas.length === 1 ? 'etapa' : 'etapas'})`,
  );

  await saveWorkbook(wb, makeFilename(SCOPE, 'xlsx'));
}

// =============================================================================
// PDF
// =============================================================================

export function exportarOrcamentoPDF(
  obras: Obra[],
  todasEtapas: EtapaObra[],
): void {
  const { linhas, linhasEtapas } = computeRows(obras, todasEtapas);
  const totalOrcamento = linhas.reduce((s, l) => s + l.orcamento, 0);
  const totalEtapas = linhas.reduce((s, l) => s + l.totalEtapas, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, TITULO, SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, [], margin);
  y = drawPdfKPIs(doc, y, [
    ['Obras', String(obras.length)],
    ['Orçamento', fmtBRL(totalOrcamento)],
    ['Soma Etapas', fmtBRL(totalEtapas)],
    ['Diferença', fmtBRL(totalOrcamento - totalEtapas)],
  ], margin);

  // Por status
  const porStatusMap = new Map<string, { count: number; orcamento: number; etapas: number }>();
  linhas.forEach((l) => {
    const e = porStatusMap.get(l.status);
    if (e) {
      e.count++;
      e.orcamento += l.orcamento;
      e.etapas += l.totalEtapas;
    } else {
      porStatusMap.set(l.status, { count: 1, orcamento: l.orcamento, etapas: l.totalEtapas });
    }
  });
  const porStatus = [...porStatusMap.entries()].map(([k, v]) => ({ chave: k, ...v }))
    .sort((a, b) => b.orcamento - a.orcamento);

  y = drawPdfMiniTable(
    doc, y, 'POR STATUS',
    ['Status', 'Obras', 'Orçamento', 'Soma Etapas'],
    porStatus.map((s) => [s.chave, String(s.count), fmtBRL(s.orcamento), fmtBRL(s.etapas)]),
    [
      'Total',
      String(porStatus.reduce((s, r) => s + r.count, 0)),
      fmtBRL(porStatus.reduce((s, r) => s + r.orcamento, 0)),
      fmtBRL(porStatus.reduce((s, r) => s + r.etapas, 0)),
    ],
    {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 40 },
    },
    margin,
  );

  // Por obra (todas)
  y = drawPdfMiniTable(
    doc, y, 'POR OBRA',
    ['Obra', 'Status', 'Início', 'Previsão', 'Orçamento', 'Soma Etapas', 'Etapas'],
    linhas.map((l) => [
      l.nome,
      l.status,
      formatDateBR(l.dataInicio),
      formatDateBR(l.dataPrevisaoFim),
      fmtBRL(l.orcamento),
      fmtBRL(l.totalEtapas),
      String(l.qtdEtapas),
    ]),
    [
      `Total (${linhas.length})`,
      '',
      '',
      '',
      fmtBRL(totalOrcamento),
      fmtBRL(totalEtapas),
      String(linhas.reduce((s, l) => s + l.qtdEtapas, 0)),
    ],
    {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'left', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'right', cellWidth: 32 },
      6: { halign: 'right', cellWidth: 18 },
    },
    margin,
  );

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Etapas de Obras', linhasEtapas.length, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Obra', 'Etapa', 'Unidade', 'Quantidade', 'Valor Unitário', 'Valor Total'],
    linhasEtapas.map((r) => [
      r.obra,
      r.etapa,
      r.unidade,
      r.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      fmtBRL(r.valorUnitario, 4),
      fmtBRL(r.valorTotal),
    ]),
    [
      `TOTAL (${linhasEtapas.length})`,
      '',
      '',
      '',
      '',
      fmtBRL(linhasEtapas.reduce((s, r) => s + r.valorTotal, 0)),
    ],
    {
      0: { halign: 'left', cellWidth: 46 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 32 },
    },
    MARCA,
    margin,
  );

  doc.save(makeFilename(SCOPE, 'pdf'));
}
