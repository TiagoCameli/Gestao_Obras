import jsPDF from 'jspdf';
import type { Equipamento, Empresa } from '../types';
import {
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfMiniTable,
  formatDateBR,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelMiniTable,
  saveWorkbook,
} from './exportTemplate';

const TITULO = 'Relatório de Frota — Equipamentos';
const SUBTITULO = 'Módulo de Frota • Gestão de Obras';
const MARCA = 'Gestão de Obras • Frota de Equipamentos';
const SCOPE = 'frota';

const tipoMedicaoLabel: Record<string, string> = {
  horimetro: 'Horímetro',
  odometro: 'Odômetro',
  km: 'Quilometragem',
};

function normalizeDate(d: string): string {
  if (!d) return '—';
  return formatDateBR(d);
}

function parseFiltroLabel(filtroLabel?: string): Array<[string, string]> {
  if (!filtroLabel) return [];
  return filtroLabel.split(' | ').map((chunk) => {
    const [k, ...rest] = chunk.split(':');
    return [k.trim(), rest.join(':').trim()] as [string, string];
  });
}

type Agregado = { chave: string; total: number; ativos: number; inativos: number };

function agrupar(
  equipamentos: Equipamento[],
  keyFn: (e: Equipamento) => string,
  labelFn: (k: string) => string,
): Agregado[] {
  const map = new Map<string, Agregado>();
  equipamentos.forEach((e) => {
    const k = keyFn(e) || '—';
    const exist = map.get(k);
    if (exist) {
      exist.total++;
      if (e.ativo) exist.ativos++;
      else exist.inativos++;
    } else {
      map.set(k, {
        chave: labelFn(k),
        total: 1,
        ativos: e.ativo ? 1 : 0,
        inativos: e.ativo ? 0 : 1,
      });
    }
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// =============================================================================
// Excel
// =============================================================================

export async function exportarFrotaExcel(
  equipamentos: Equipamento[],
  empresas: Empresa[],
  filtroLabel?: string,
): Promise<void> {
  const empresasMap = new Map(empresas.map((e) => [e.id, e.nome]));
  const ativos = equipamentos.filter((e) => e.ativo).length;
  const inativos = equipamentos.length - ativos;

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, TITULO, SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, parseFiltroLabel(filtroLabel));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Total', value: equipamentos.length, numFmt: '0' },
    { label: 'Ativos', value: ativos, numFmt: '0' },
    { label: 'Inativos', value: inativos, numFmt: '0' },
    { label: '% Ativos', value: equipamentos.length > 0 ? ativos / equipamentos.length : 0, numFmt: '0.0%' },
  ]);

  function mini(titulo: string, headerLabel: string, ags: Agregado[]) {
    const rows = ags.map((a) => ({
      cells: [a.chave, a.total, a.ativos, a.inativos] as (string | number)[],
    }));
    row = renderExcelMiniTable(
      wsResumo, row, titulo,
      [
        { header: headerLabel, align: 'left' },
        { header: 'Total', align: 'right', numFmt: '0' },
        { header: 'Ativos', align: 'right', numFmt: '0' },
        { header: 'Inativos', align: 'right', numFmt: '0' },
      ],
      rows,
      [
        'Total',
        ags.reduce((s, a) => s + a.total, 0),
        ags.reduce((s, a) => s + a.ativos, 0),
        ags.reduce((s, a) => s + a.inativos, 0),
      ],
    );
  }

  mini('POR TIPO', 'Tipo', agrupar(equipamentos, (e) => e.tipo || '—', (k) => k));
  mini('POR EMPRESA', 'Empresa', agrupar(equipamentos, (e) => e.empresaId, (k) => empresasMap.get(k) || '—'));
  mini('POR MARCA', 'Marca', agrupar(equipamentos, (e) => e.marca || '—', (k) => k));

  renderExcelDetalhamento<Equipamento>(
    wsDetalhe,
    equipamentos,
    [
      { header: 'Nome', key: 'nome', width: 28, align: 'left', value: (e) => e.nome },
      { header: 'Tipo', key: 'tipo', width: 20, align: 'left', value: (e) => e.tipo || '—' },
      { header: 'Marca', key: 'marca', width: 16, align: 'left', value: (e) => e.marca || '—' },
      { header: 'Ano', key: 'ano', width: 10, align: 'center', value: (e) => e.ano || '—' },
      { header: 'Cód. Patrimônio', key: 'patrimonio', width: 18, align: 'center', value: (e) => e.codigoPatrimonio || '—' },
      { header: 'N. Série', key: 'serie', width: 20, align: 'center', value: (e) => e.numeroSerie || '—' },
      { header: 'Empresa', key: 'empresa', width: 24, align: 'left', value: (e) => empresasMap.get(e.empresaId) || '—' },
      { header: 'Medição', key: 'tipoMedicao', width: 14, align: 'center', value: (e) => tipoMedicaoLabel[e.tipoMedicao] || e.tipoMedicao },
      { header: 'Medição Inicial', key: 'medicaoInicial', width: 16, align: 'right', numFmt: '#,##0.00', value: (e) => e.medicaoInicial },
      { header: 'Status', key: 'status', width: 12, align: 'center', value: (e) => (e.ativo ? 'Ativo' : 'Inativo') },
      { header: 'Data Aquisição', key: 'dataAquisicao', width: 14, align: 'center', value: (e) => normalizeDate(e.dataAquisicao) },
      { header: 'Data Venda', key: 'dataVenda', width: 14, align: 'center', value: (e) => normalizeDate(e.dataVenda) },
    ],
    1,
    `TOTAL (${equipamentos.length} ${equipamentos.length === 1 ? 'equipamento' : 'equipamentos'})`,
  );

  await saveWorkbook(wb, makeFilename(SCOPE, 'xlsx'));
}

// =============================================================================
// PDF
// =============================================================================

export function exportarFrotaPDF(
  equipamentos: Equipamento[],
  empresas: Empresa[],
  filtroLabel?: string,
): void {
  const empresasMap = new Map(empresas.map((e) => [e.id, e.nome]));
  const ativos = equipamentos.filter((e) => e.ativo).length;
  const inativos = equipamentos.length - ativos;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, TITULO, SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, parseFiltroLabel(filtroLabel), margin);
  y = drawPdfKPIs(doc, y, [
    ['Total', String(equipamentos.length)],
    ['Ativos', String(ativos)],
    ['Inativos', String(inativos)],
    ['% Ativos', equipamentos.length > 0 ? ((ativos / equipamentos.length) * 100).toFixed(1).replace('.', ',') + '%' : '-'],
  ], margin);

  function mini(titulo: string, headerLabel: string, ags: Agregado[]) {
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Total', 'Ativos', 'Inativos'],
      ags.map((a) => [a.chave, String(a.total), String(a.ativos), String(a.inativos)]),
      [
        'Total',
        String(ags.reduce((s, a) => s + a.total, 0)),
        String(ags.reduce((s, a) => s + a.ativos, 0)),
        String(ags.reduce((s, a) => s + a.inativos, 0)),
      ],
      {
        0: { halign: 'left', cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 28 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 28 },
      },
      margin,
    );
  }

  mini('POR TIPO', 'Tipo', agrupar(equipamentos, (e) => e.tipo || '—', (k) => k));
  mini('POR EMPRESA', 'Empresa', agrupar(equipamentos, (e) => e.empresaId, (k) => empresasMap.get(k) || '—'));
  mini('POR MARCA', 'Marca', agrupar(equipamentos, (e) => e.marca || '—', (k) => k));

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Frota', equipamentos.length, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Nome', 'Tipo', 'Marca', 'Ano', 'Patrimônio', 'N. Série', 'Empresa', 'Medição', 'Med. Inicial', 'Status', 'Aquisição', 'Venda'],
    equipamentos.map((e) => [
      e.nome,
      e.tipo || '—',
      e.marca || '—',
      e.ano || '—',
      e.codigoPatrimonio || '—',
      e.numeroSerie || '—',
      empresasMap.get(e.empresaId) || '—',
      tipoMedicaoLabel[e.tipoMedicao] || e.tipoMedicao,
      String(e.medicaoInicial),
      e.ativo ? 'Ativo' : 'Inativo',
      normalizeDate(e.dataAquisicao),
      normalizeDate(e.dataVenda),
    ]),
    [
      `TOTAL (${equipamentos.length})`,
      '', '', '', '', '', '', '', '', '', '', '',
    ],
    {
      0: { halign: 'left', cellWidth: 34 },
      1: { halign: 'left', cellWidth: 26 },
      2: { halign: 'left', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'left', cellWidth: 30 },
      7: { halign: 'center', cellWidth: 20 },
      8: { halign: 'right', cellWidth: 20 },
      9: { halign: 'center', cellWidth: 16 },
      10: { halign: 'center', cellWidth: 20 },
      11: { halign: 'center', cellWidth: 20 },
    },
    MARCA,
    margin,
  );

  doc.save(makeFilename(SCOPE, 'pdf'));
}
