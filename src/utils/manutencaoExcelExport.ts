// Relatórios de manutenção em Excel.
// Espelha o padrão visual de extratoExport.ts (ExcelJS + brand colors).

import ExcelJS from 'exceljs';
import type { OrdemServico } from '../types';
import { TIPO_OS_LABEL } from '../types';
import {
  BRAND,
  createWorkbook,
  fillSolid,
  formatDateBR,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelSectionTitle,
  sanitizeFilenamePart,
  saveWorkbook,
  thinBorder,
} from './exportTemplate';
import { montarRelatorioPorMaquina } from './manutencaoRelatorio';

const TITULO = 'Relatório de Manutenção';
const SUBTITULO = 'Módulo de Manutenção · Gestão de Obras';

// ─────────────────────────────────────────────────────────────────────────────
// Tabela de detalhamento de serviços (helper reutilizável)
// ─────────────────────────────────────────────────────────────────────────────

function renderServicosDetalhamento(
  ws: ExcelJS.Worksheet,
  servicos: OrdemServico[],
): void {
  renderExcelDetalhamento(
    ws,
    servicos,
    [
      {
        header: 'Nº OS',
        key: 'numero',
        width: 18,
        align: 'center',
        value: (s) => s.numero,
      },
      {
        header: 'Data',
        key: 'data',
        width: 14,
        align: 'center',
        value: (s) => {
          const d = (s.dataConclusao ?? s.dataAbertura ?? '').slice(0, 10);
          return d ? formatDateBR(d) : '—';
        },
      },
      {
        header: 'Tipo',
        key: 'tipo',
        width: 22,
        align: 'left',
        value: (s) => TIPO_OS_LABEL[s.tipo] ?? s.tipo,
      },
      {
        header: 'Peças (R$)',
        key: 'pecas',
        width: 16,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoPecas ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoPecas ?? 0), 0),
      },
      {
        header: 'Terceiros (R$)',
        key: 'terceiros',
        width: 18,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoTerceiros ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoTerceiros ?? 0), 0),
      },
      {
        header: 'Óleos (R$)',
        key: 'oleos',
        width: 16,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoOleos ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoOleos ?? 0), 0),
      },
      {
        header: 'Total (R$)',
        key: 'total',
        width: 16,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoTotal ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoTotal ?? 0), 0),
        emphasizeValue: true,
      },
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini-table de subtotais (resumo de categorias)
// ─────────────────────────────────────────────────────────────────────────────

function renderSubtotaisTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  pecas: number,
  terceiros: number,
  oleos: number,
  total: number,
): number {
  let row = renderExcelSectionTitle(ws, startRow, 'SUBTOTAIS POR CATEGORIA');
  // Header
  const headers = ['Categoria', 'Valor (R$)', '% do Total'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    cell.fill = fillSolid(BRAND.verde);
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
    cell.border = thinBorder();
  });
  ws.getRow(row).height = 22;
  row++;

  const categorias = [
    { label: 'Peças', valor: pecas },
    { label: 'Serviços de terceiros', valor: terceiros },
    { label: 'Óleos e lubrificantes', valor: oleos },
  ];

  categorias.forEach((cat, idx) => {
    const zebra = idx % 2 === 1;
    const bg = zebra ? BRAND.cinzaZebra : BRAND.branco;
    const pct = total > 0 ? `${((cat.valor / total) * 100).toFixed(1)}%` : '—';

    const c0 = ws.getCell(row, 1);
    c0.value = cat.label;
    c0.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
    c0.fill = fillSolid(bg);
    c0.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c0.border = thinBorder();

    const c1 = ws.getCell(row, 2);
    c1.value = cat.valor;
    c1.numFmt = '"R$" #,##0.00';
    c1.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
    c1.fill = fillSolid(bg);
    c1.alignment = { vertical: 'middle', horizontal: 'right' };
    c1.border = thinBorder();

    const c2 = ws.getCell(row, 3);
    c2.value = pct;
    c2.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
    c2.fill = fillSolid(bg);
    c2.alignment = { vertical: 'middle', horizontal: 'right' };
    c2.border = thinBorder();

    ws.getRow(row).height = 18;
    row++;
  });

  // Footer total
  const ft0 = ws.getCell(row, 1);
  ft0.value = 'TOTAL';
  ft0.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
  ft0.fill = fillSolid(BRAND.verdeEscuro);
  ft0.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ft0.border = thinBorder();

  const ft1 = ws.getCell(row, 2);
  ft1.value = total;
  ft1.numFmt = '"R$" #,##0.00';
  ft1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
  ft1.fill = fillSolid(BRAND.verdeEscuro);
  ft1.alignment = { vertical: 'middle', horizontal: 'right' };
  ft1.border = thinBorder();

  const ft2 = ws.getCell(row, 3);
  ft2.value = '100%';
  ft2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
  ft2.fill = fillSolid(BRAND.verdeEscuro);
  ft2.alignment = { vertical: 'middle', horizontal: 'right' };
  ft2.border = thinBorder();

  ws.getRow(row).height = 20;
  return row + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export: Relatório por máquina
// ─────────────────────────────────────────────────────────────────────────────

export async function exportarRelatorioPorMaquinaExcel(
  equipamento: { id: string; nome: string },
  periodo: { de: string; ate: string },
  servicos: OrdemServico[],
): Promise<void> {
  const { linhas, subtotais } = montarRelatorioPorMaquina(servicos);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Serviços';

  // ── Sheet Resumo ──
  let row = renderExcelBanner(wsResumo, TITULO, `${equipamento.nome} · ${SUBTITULO}`);
  row += 1;

  const deLabel = periodo.de ? formatDateBR(periodo.de) : '—';
  const ateLabel = periodo.ate ? formatDateBR(periodo.ate) : '—';
  const fmtPeriodo = `${deLabel} a ${ateLabel}`;
  row = renderExcelFiltros(wsResumo, row, [
    ['Equipamento', equipamento.nome],
    ['Período', fmtPeriodo],
    ['Serviços concluídos', String(linhas.length)],
  ]);
  row += 1;

  row = renderExcelKPIs(wsResumo, row, [
    { label: 'CUSTO TOTAL', value: subtotais.total, numFmt: '"R$" #,##0.00' },
    { label: 'PEÇAS', value: subtotais.pecas, numFmt: '"R$" #,##0.00' },
    { label: 'TERCEIROS', value: subtotais.terceiros, numFmt: '"R$" #,##0.00' },
    { label: 'ÓLEOS', value: subtotais.oleos, numFmt: '"R$" #,##0.00' },
  ]);
  row += 1;

  renderSubtotaisTable(wsResumo, row, subtotais.pecas, subtotais.terceiros, subtotais.oleos, subtotais.total);

  // ── Sheet Serviços (detalhamento) ──
  renderServicosDetalhamento(wsDetalhe, servicos);

  const nomeSanitizado = sanitizeFilenamePart(equipamento.nome).slice(0, 30);
  await saveWorkbook(wb, makeFilename(`Manutencao-${nomeSanitizado}`, 'xlsx'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Export: Relatório mensal (todas as máquinas)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportarRelatorioMensalExcel(
  mes: Date,
  servicos: OrdemServico[],
  equipamentos: Array<{ id: string; nome: string }>,
): Promise<void> {
  // Filtra concluídas no mês
  const ano = mes.getFullYear();
  const mesNum = mes.getMonth();
  const inicio = new Date(ano, mesNum, 1);
  const fim = new Date(ano, mesNum + 1, 0, 23, 59, 59, 999);

  const doMes = servicos.filter((s) => {
    if (s.status !== 'concluida') return false;
    const dataStr = (s.dataConclusao ?? s.dataAbertura ?? '').slice(0, 10);
    if (!dataStr) return false;
    const d = new Date(dataStr);
    return d >= inicio && d <= fim;
  });

  const { subtotais: grandTotal } = montarRelatorioPorMaquina(doMes);

  // Agrupa por equipamento
  const eqMap = new Map(equipamentos.map((e) => [e.id, e.nome]));
  const porEq = new Map<string, OrdemServico[]>();
  for (const s of doMes) {
    const list = porEq.get(s.equipamentoId) ?? [];
    list.push(s);
    porEq.set(s.equipamentoId, list);
  }

  const grupos = Array.from(porEq.entries())
    .map(([eqId, items]) => ({
      eqId,
      nome: eqMap.get(eqId) ?? eqId,
      items,
      relatorio: montarRelatorioPorMaquina(items),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mesLabel = `${mesesNomes[mesNum]}/${ano}`;

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Todos os Serviços';

  // ── Sheet Resumo ──
  let row = renderExcelBanner(wsResumo, `${TITULO} · ${mesLabel}`, SUBTITULO);
  row += 1;

  row = renderExcelFiltros(wsResumo, row, [
    ['Período', mesLabel],
    ['Serviços concluídos', String(doMes.length)],
    ['Equipamentos', String(grupos.length)],
  ]);
  row += 1;

  row = renderExcelKPIs(wsResumo, row, [
    { label: 'CUSTO TOTAL', value: grandTotal.total, numFmt: '"R$" #,##0.00' },
    { label: 'PEÇAS', value: grandTotal.pecas, numFmt: '"R$" #,##0.00' },
    { label: 'TERCEIROS', value: grandTotal.terceiros, numFmt: '"R$" #,##0.00' },
    { label: 'ÓLEOS', value: grandTotal.oleos, numFmt: '"R$" #,##0.00' },
  ]);
  row += 1;

  // Tabela por equipamento
  row = renderExcelSectionTitle(wsResumo, row, 'CUSTO POR EQUIPAMENTO');

  // Header
  const colsEq = ['Equipamento', 'Serviços', 'Peças (R$)', 'Terceiros (R$)', 'Óleos (R$)', 'Total (R$)'];
  colsEq.forEach((h, i) => {
    const cell = wsResumo.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    cell.fill = fillSolid(BRAND.verde);
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
    cell.border = thinBorder();
  });
  wsResumo.getRow(row).height = 22;
  row++;

  grupos.forEach(({ nome, items, relatorio }, idx) => {
    const { subtotais } = relatorio;
    const zebra = idx % 2 === 1;
    const bg = zebra ? BRAND.cinzaZebra : BRAND.branco;
    const vals = [nome, items.length, subtotais.pecas, subtotais.terceiros, subtotais.oleos, subtotais.total];
    vals.forEach((v, i) => {
      const cell = wsResumo.getCell(row, i + 1);
      cell.value = v as ExcelJS.CellValue;
      if (i >= 2) cell.numFmt = '"R$" #,##0.00';
      cell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
      cell.fill = fillSolid(bg);
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
      cell.border = thinBorder();
    });
    wsResumo.getRow(row).height = 18;
    row++;
  });

  // Footer grand total
  const totals = ['TOTAL', doMes.length, grandTotal.pecas, grandTotal.terceiros, grandTotal.oleos, grandTotal.total];
  totals.forEach((v, i) => {
    const cell = wsResumo.getCell(row, i + 1);
    cell.value = v as ExcelJS.CellValue;
    if (i >= 2) cell.numFmt = '"R$" #,##0.00';
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
    cell.fill = fillSolid(BRAND.verdeEscuro);
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
    cell.border = thinBorder();
  });
  wsResumo.getRow(row).height = 20;

  // ── Sheet Todos os Serviços (detalhamento) ──
  // Inclui coluna de Equipamento além das demais
  renderExcelDetalhamento(
    wsDetalhe,
    doMes,
    [
      {
        header: 'Equipamento',
        key: 'equipamento',
        width: 30,
        align: 'left',
        value: (s) => eqMap.get(s.equipamentoId) ?? s.equipamentoId,
      },
      {
        header: 'Nº OS',
        key: 'numero',
        width: 16,
        align: 'center',
        value: (s) => s.numero,
      },
      {
        header: 'Data',
        key: 'data',
        width: 14,
        align: 'center',
        value: (s) => {
          const d = (s.dataConclusao ?? s.dataAbertura ?? '').slice(0, 10);
          return d ? formatDateBR(d) : '—';
        },
      },
      {
        header: 'Tipo',
        key: 'tipo',
        width: 22,
        align: 'left',
        value: (s) => TIPO_OS_LABEL[s.tipo] ?? s.tipo,
      },
      {
        header: 'Peças (R$)',
        key: 'pecas',
        width: 16,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoPecas ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoPecas ?? 0), 0),
      },
      {
        header: 'Terceiros (R$)',
        key: 'terceiros',
        width: 18,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoTerceiros ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoTerceiros ?? 0), 0),
      },
      {
        header: 'Óleos (R$)',
        key: 'oleos',
        width: 16,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoOleos ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoOleos ?? 0), 0),
      },
      {
        header: 'Total (R$)',
        key: 'total',
        width: 16,
        align: 'right',
        numFmt: '"R$" #,##0.00',
        value: (s) => s.custoTotal ?? 0,
        footerValue: (items) => items.reduce((acc, s) => acc + (s.custoTotal ?? 0), 0),
        emphasizeValue: true,
      },
    ],
  );

  const anoMes = `${ano}-${String(mesNum + 1).padStart(2, '0')}`;
  await saveWorkbook(wb, makeFilename(`Manutencao-Mensal-${anoMes}`, 'xlsx'));
}
