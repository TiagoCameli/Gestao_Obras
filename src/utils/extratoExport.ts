// Export PDF/Excel pra extrato cronológico de transportadora.
// Reusa helpers do exportTemplate.ts pra manter visual consistente.

import jsPDF from 'jspdf';
import type { TransportadoraMovimento, TipoMovimentoTransportadora } from '../types';
import {
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  fmtBRL,
  formatDateBR,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  saveWorkbook,
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
// Excel
// ════════════════════════════════════════════════════════════════════

export async function exportarExtratoExcel(
  transportadoraNome: string,
  movimentos: TransportadoraMovimento[],
  filtros: ExtratoFiltros
): Promise<void> {
  const dados = prepararExtrato(movimentos, filtros);
  const totais = totaisFromList(dados);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, TITULO, `${transportadoraNome} · ${SUBTITULO}`);
  row += 1;
  row = renderExcelFiltros(wsResumo, row, filtrosToTuples(filtros));
  row += 1;
  renderExcelKPIs(wsResumo, row, [
    { label: 'Saldo Final', value: totais.saldoFinal, numFmt: '"R$" #,##0.00' },
    { label: 'Créditos', value: totais.creditos, numFmt: '"R$" #,##0.00' },
    { label: 'Débitos', value: totais.debitos, numFmt: '"R$" #,##0.00' },
    { label: 'Movimentos', value: totais.qtd },
  ]);

  // Sheet de detalhe
  renderExcelDetalhamento<MovimentoComSaldo>(wsDetalhe, dados, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Tipo', key: 'tipo', width: 36, value: (m) => TIPO_LABEL[m.tipo] },
    { header: 'Descrição', key: 'descricao', width: 50, value: (m) => m.descricao ?? '' },
    {
      header: 'Crédito', key: 'credito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => TIPOS_CREDITO.has(m.tipo) ? m.valor : '',
      footerValue: (items) => items.reduce((s, m) => s + (TIPOS_CREDITO.has(m.tipo) ? m.valor : 0), 0),
    },
    {
      header: 'Débito', key: 'debito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => TIPOS_CREDITO.has(m.tipo) ? '' : m.valor,
      footerValue: (items) => items.reduce((s, m) => s + (TIPOS_CREDITO.has(m.tipo) ? 0 : m.valor), 0),
    },
    {
      header: 'Saldo', key: 'saldo', width: 18, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.saldoAcumulado,
      emphasizeValue: true,
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

  const head = ['Data', 'Tipo', 'Descrição', 'Crédito', 'Débito', 'Saldo'];
  const body = dados.map((m) => [
    formatDateBR(m.data),
    TIPO_LABEL[m.tipo],
    m.descricao ?? '',
    TIPOS_CREDITO.has(m.tipo) ? fmtBRL(m.valor) : '',
    TIPOS_CREDITO.has(m.tipo) ? '' : fmtBRL(m.valor),
    fmtBRL(m.saldoAcumulado),
  ]);
  const foot = ['', '', 'Saldo final', '', '', fmtBRL(totais.saldoFinal)];

  drawPdfDetailTable(
    doc,
    20,
    head,
    body,
    foot,
    {
      0: { halign: 'left', cellWidth: 25 },
      1: { halign: 'left', cellWidth: 55 },
      2: { halign: 'left', cellWidth: 90 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 35 },
    },
    MARCA
  );

  doc.save(makeFilename(`${SCOPE}_${transportadoraNome.toLowerCase().replace(/\s+/g, '_')}`, 'pdf'));
}
