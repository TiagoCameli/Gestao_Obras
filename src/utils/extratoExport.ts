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

// ────────────────────────────────────────────────────────────────────
// formatBreakdown — fórmula que produziu o valor do movimento.
//
// Usado em 3 lugares (modal, Excel, PDF) — fonte única evita drift.
// Retorna string vazia quando não há dados pra calcular (evita ruído
// tipo "× R$ 0 = R$ 0" em ajustes manuais sem origem).
// ────────────────────────────────────────────────────────────────────

function fmtNumDec(n: number, dec: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}
function fmtL(n: number): string {
  return `${fmtNumDec(n, 0)} L`;
}
function fmtTon(n: number): string {
  return `${fmtNumDec(n, 2)} t`;
}
function fmtKm(n: number): string {
  return `${fmtNumDec(n, 1)} km`;
}
function fmtPrecoL(n: number): string {
  return `R$ ${fmtNumDec(n, 4)}/L`;
}
function fmtPrecoTkm(n: number): string {
  return `R$ ${fmtNumDec(n, 4)}/tkm`;
}

export function formatBreakdown(m: TransportadoraMovimento): string {
  switch (m.tipo) {
    case 'credito_frete': {
      const peso = m.fretePesoToneladas ?? 0;
      const km = m.freteKmRodados ?? 0;
      const tkm = m.freteValorTkm ?? 0;
      if (peso <= 0 || km <= 0 || tkm <= 0) return '';
      return `${fmtTon(peso)} × ${fmtKm(km)} × ${fmtPrecoTkm(tkm)} = ${fmtBRL(peso * km * tkm)}`;
    }

    case 'debito_abastecimento_transterra': {
      const litros = m.saidaLitros ?? 0;
      const preco = m.saidaPrecoCombustivel ?? 0;
      const taxa = m.saidaTaxaLitro ?? 0;
      if (litros <= 0 || preco <= 0) return '';
      const precoFinal = preco + taxa;
      return taxa > 0
        ? `${fmtL(litros)} × (${fmtPrecoL(preco)} + ${fmtPrecoL(taxa)} taxa) = ${fmtBRL(litros * precoFinal)}`
        : `${fmtL(litros)} × ${fmtPrecoL(preco)} = ${fmtBRL(litros * precoFinal)}`;
    }

    case 'credito_abastecimento_transterra': {
      const litros = m.saidaLitros ?? 0;
      const preco = m.saidaPrecoCombustivelAreacre ?? m.saidaPrecoCombustivel ?? 0;
      const taxa = m.saidaTaxaLitro ?? 0;
      if (litros <= 0 || preco <= 0) return '';
      const precoFinal = preco + taxa;
      return taxa > 0
        ? `${fmtL(litros)} × (${fmtPrecoL(preco)} Areacre + ${fmtPrecoL(taxa)} taxa) = ${fmtBRL(litros * precoFinal)}`
        : `${fmtL(litros)} × ${fmtPrecoL(preco)} (Areacre) = ${fmtBRL(litros * precoFinal)}`;
    }

    case 'debito_abastecimento_emt': {
      const litros = m.saidaLitros ?? 0;
      // Em tanque EMT, preco_combustivel guarda preço médio + taxa (precoUnitario);
      // preco_medio_tanque_snapshot guarda só o médio sem taxa.
      const precoMedio = m.saidaPrecoMedioTanque ?? 0;
      const taxa = m.saidaTaxaLitro ?? 0;
      if (litros <= 0 || precoMedio <= 0) {
        // Fallback: deriva preço pelo total / litros
        if (litros > 0) return `${fmtL(litros)} × ${fmtPrecoL(m.valor / litros)} (preço médio)`;
        return '';
      }
      return taxa > 0
        ? `${fmtL(litros)} × (${fmtPrecoL(precoMedio)} médio + ${fmtPrecoL(taxa)} taxa) = ${fmtBRL(litros * (precoMedio + taxa))}`
        : `${fmtL(litros)} × ${fmtPrecoL(precoMedio)} (preço médio do tanque) = ${fmtBRL(litros * precoMedio)}`;
    }

    case 'debito_pagamento_frete': {
      const partes: string[] = [];
      if (m.pagamentoMetodo) partes.push(`Método: ${m.pagamentoMetodo}`);
      if (m.mesReferencia) partes.push(`Ref: ${m.mesReferencia.slice(0, 7)}`);
      return partes.join(' · ');
    }

    case 'ajuste_manual_credito':
    case 'ajuste_manual_debito':
      return 'Ajuste manual lançado no extrato';
  }
  return '';
}

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
    { header: 'Descrição', key: 'descricao', width: 42, value: (m) => m.descricao ?? '' },
    { header: 'Cálculo', key: 'calculo', width: 50, value: (m) => formatBreakdown(m) },
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

  const head = ['Data', 'Tipo', 'Descrição', 'Cálculo', 'Crédito', 'Débito', 'Saldo'];
  const body = dados.map((m) => [
    formatDateBR(m.data),
    TIPO_LABEL[m.tipo],
    m.descricao ?? '',
    formatBreakdown(m),
    TIPOS_CREDITO.has(m.tipo) ? fmtBRL(m.valor) : '',
    TIPOS_CREDITO.has(m.tipo) ? '' : fmtBRL(m.valor),
    fmtBRL(m.saldoAcumulado),
  ]);
  const foot = ['', '', 'Saldo final', '', '', '', fmtBRL(totais.saldoFinal)];

  drawPdfDetailTable(
    doc,
    20,
    head,
    body,
    foot,
    {
      0: { halign: 'left', cellWidth: 22 },
      1: { halign: 'left', cellWidth: 48 },
      2: { halign: 'left', cellWidth: 60 },
      3: { halign: 'left', cellWidth: 65 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 28 },
    },
    MARCA
  );

  doc.save(makeFilename(`${SCOPE}_${transportadoraNome.toLowerCase().replace(/\s+/g, '_')}`, 'pdf'));
}
