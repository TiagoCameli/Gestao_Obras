// Export PDF/Excel pra extrato cronológico de transportadora.
// Reusa helpers do exportTemplate.ts pra manter visual consistente.

import jsPDF from 'jspdf';
import type { TransportadoraMovimento, TipoMovimentoTransportadora, MetodoPagamentoFrete } from '../types';
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

const METODO_LABEL: Record<MetodoPagamentoFrete, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  combustivel: 'Combustível',
};

function categoriaAbastecimento(tipo: TipoMovimentoTransportadora): string {
  if (tipo === 'debito_abastecimento_transterra') return 'Transterra';
  if (tipo === 'debito_abastecimento_emt') return 'EMT';
  return '';
}

/** Contexto opcional pro export — Maps id→nome pra resolver FKs soft. */
export interface ExtratoExportContext {
  insumosMap?: Map<string, string>;
  obrasMap?: Map<string, string>;
}

function resolverNome(map: Map<string, string> | undefined) {
  return (id: string | null | undefined): string => {
    if (!id) return '';
    return map?.get(id) ?? id;
  };
}

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
// Excel — workbook com 6 sheets:
//   Resumo · Todos · Fretes · Abastecimentos · Pagamentos · Ajustes
// Cada sheet de tipo é filtrada pelo mês (filtros.mesReferencia) e
// mostra colunas detalhadas próprias (espelha as abas da UI).
// ════════════════════════════════════════════════════════════════════

export async function exportarExtratoExcel(
  transportadoraNome: string,
  movimentos: TransportadoraMovimento[],
  filtros: ExtratoFiltros,
  context?: ExtratoExportContext,
): Promise<void> {
  const insumoNome = resolverNome(context?.insumosMap);
  const obraNome = resolverNome(context?.obrasMap);

  // "Todos" — cronológico com saldo acumulado, aplica filtros completos.
  const dadosTodos = prepararExtrato(movimentos, filtros);
  const totais = totaisFromList(dadosTodos);

  // Subsets por tipo — só o filtro de mês importa (tipos/busca não fazem
  // sentido aqui; cada aba tem seu próprio escopo).
  const movsMes = filtros.mesReferencia
    ? movimentos.filter((m) => m.mesReferencia === filtros.mesReferencia)
    : movimentos;

  const sortDesc = (a: TransportadoraMovimento, b: TransportadoraMovimento) =>
    b.data.localeCompare(a.data);

  const fretes = movsMes.filter((m) => m.tipo === 'credito_frete').sort(sortDesc);
  const abastecimentos = movsMes
    .filter((m) => m.tipo === 'debito_abastecimento_transterra' || m.tipo === 'debito_abastecimento_emt')
    .sort(sortDesc);
  // Créditos de tanque: outras transportadoras abastecem em tanque
  // próprio da transportadora atual (típico Areacre como dona da
  // Transterra). Sheet/página dedicada — em transportadoras que não
  // são donas de tanque, lista vai vazia (mesma semântica de Abastecimentos
  // pra Areacre).
  const creditosTanque = movsMes.filter((m) => m.tipo === 'credito_abastecimento_transterra').sort(sortDesc);
  const pagamentos = movsMes.filter((m) => m.tipo === 'debito_pagamento_frete').sort(sortDesc);
  const ajustes = movsMes
    .filter((m) => m.tipo === 'ajuste_manual_credito' || m.tipo === 'ajuste_manual_debito')
    .sort(sortDesc);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Todos';

  // ── Sheet "Resumo" ──
  let row = renderExcelBanner(wsResumo, TITULO, `${transportadoraNome} · ${SUBTITULO}`);
  row += 1;
  row = renderExcelFiltros(wsResumo, row, filtrosToTuples(filtros));
  row += 1;
  renderExcelKPIs(wsResumo, row, [
    { label: 'Saldo do Período', value: totais.saldoFinal, numFmt: '"R$" #,##0.00' },
    { label: 'Créditos', value: totais.creditos, numFmt: '"R$" #,##0.00' },
    { label: 'Débitos', value: totais.debitos, numFmt: '"R$" #,##0.00' },
    { label: 'Total Movimentos', value: totais.qtd },
    { label: 'Fretes', value: fretes.length },
    { label: 'Abastecimentos', value: abastecimentos.length },
    { label: 'Abast. Tanque', value: creditosTanque.length },
    { label: 'Pagamentos', value: pagamentos.length },
    { label: 'Ajustes', value: ajustes.length },
  ]);

  // ── Sheet "Todos" (cronológico com saldo acumulado) ──
  renderExcelDetalhamento<MovimentoComSaldo>(wsDetalhe, dadosTodos, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Tipo', key: 'tipo', width: 32, value: (m) => TIPO_LABEL[m.tipo] },
    { header: 'Descrição', key: 'descricao', width: 42, value: (m) => m.descricao ?? '' },
    { header: 'Cálculo', key: 'calculo', width: 50, value: (m) => formatBreakdown(m) },
    {
      header: 'Crédito', key: 'credito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (TIPOS_CREDITO.has(m.tipo) ? m.valor : ''),
      footerValue: (items) => items.reduce((s, m) => s + (TIPOS_CREDITO.has(m.tipo) ? m.valor : 0), 0),
    },
    {
      header: 'Débito', key: 'debito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (TIPOS_CREDITO.has(m.tipo) ? '' : m.valor),
      footerValue: (items) => items.reduce((s, m) => s + (TIPOS_CREDITO.has(m.tipo) ? 0 : m.valor), 0),
    },
    {
      header: 'Saldo', key: 'saldo', width: 18, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.saldoAcumulado,
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Fretes" ──
  const wsFretes = wb.addWorksheet('Fretes', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsFretes, fretes, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Origem', key: 'origem', width: 22, value: (m) => m.freteOrigem ?? '' },
    { header: 'Destino', key: 'destino', width: 22, value: (m) => m.freteDestino ?? '' },
    { header: 'Insumo', key: 'insumo', width: 24, value: (m) => insumoNome(m.freteInsumoId) },
    { header: 'Obra', key: 'obra', width: 24, value: (m) => obraNome(m.obraId) },
    {
      header: 'Peso (t)', key: 'peso', width: 12, align: 'right', numFmt: '#,##0.00',
      value: (m) => m.fretePesoToneladas ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.fretePesoToneladas ?? 0), 0),
    },
    {
      header: 'KM', key: 'km', width: 12, align: 'right', numFmt: '#,##0.0',
      value: (m) => m.freteKmRodados ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.freteKmRodados ?? 0), 0),
    },
    {
      header: 'R$/tkm', key: 'tkm', width: 12, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) => m.freteValorTkm ?? 0,
    },
    { header: 'NF', key: 'nf', width: 14, value: (m) => m.freteNotaFiscal ?? '' },
    { header: 'NF 2', key: 'nf2', width: 14, value: (m) => m.freteNotaFiscal2 ?? '' },
    { header: 'Placa', key: 'placa', width: 12, value: (m) => m.fretePlacaCarreta ?? '' },
    { header: 'Motorista', key: 'motorista', width: 22, value: (m) => m.freteMotorista ?? '' },
    {
      header: 'Valor', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Abastecimentos" (apenas débitos) ──
  const wsAbast = wb.addWorksheet('Abastecimentos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsAbast, abastecimentos, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Categoria', key: 'cat', width: 14, value: (m) => categoriaAbastecimento(m.tipo) },
    { header: 'Combustível', key: 'comb', width: 22, value: (m) => insumoNome(m.saidaTipoCombustivel) },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (m) => m.saidaLitros ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.saidaLitros ?? 0), 0),
    },
    {
      header: 'Preço/L', key: 'preco', width: 14, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) =>
        m.tipo === 'debito_abastecimento_emt'
          ? (m.saidaPrecoMedioTanque ?? m.saidaPrecoCombustivel ?? 0)
          : (m.saidaPrecoCombustivel ?? 0),
    },
    {
      header: 'Taxa/L', key: 'taxa', width: 12, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) => m.saidaTaxaLitro ?? 0,
    },
    { header: 'Placa', key: 'placa', width: 12, value: (m) => m.saidaPlaca ?? '' },
    { header: 'Motorista', key: 'motorista', width: 22, value: (m) => m.saidaMotorista ?? '' },
    { header: 'Observações', key: 'obs', width: 32, value: (m) => m.saidaObservacoes ?? '' },
    {
      header: 'Total', key: 'total', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Abast. Tanque" (créditos quando outras transportadoras
  //    abastecem em tanque próprio — ex: Areacre dona da Transterra) ──
  const wsCredTq = wb.addWorksheet('Abast. Tanque', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsCredTq, creditosTanque, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Combustível', key: 'comb', width: 22, value: (m) => insumoNome(m.saidaTipoCombustivel) },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (m) => m.saidaLitros ?? 0,
      footerValue: (items) => items.reduce((s, m) => s + (m.saidaLitros ?? 0), 0),
    },
    {
      // Crédito vem do preço cobrado pela dona do tanque (preco_combustivel_areacre).
      header: 'Preço Tanque/L', key: 'preco', width: 16, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (m) => m.saidaPrecoCombustivelAreacre ?? 0,
    },
    { header: 'Placa', key: 'placa', width: 12, value: (m) => m.saidaPlaca ?? '' },
    { header: 'Motorista', key: 'motorista', width: 22, value: (m) => m.saidaMotorista ?? '' },
    { header: 'Observações', key: 'obs', width: 32, value: (m) => m.saidaObservacoes ?? '' },
    {
      header: 'Crédito', key: 'credito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Pagamentos" ──
  const wsPagto = wb.addWorksheet('Pagamentos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsPagto, pagamentos, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    { header: 'Mês ref', key: 'mes', width: 12, value: (m) => m.mesReferencia?.slice(0, 7) ?? '' },
    {
      header: 'Método', key: 'metodo', width: 16,
      value: (m) =>
        m.pagamentoMetodo
          ? METODO_LABEL[m.pagamentoMetodo as MetodoPagamentoFrete] ?? m.pagamentoMetodo
          : '',
    },
    { header: 'NF', key: 'nf', width: 14, value: (m) => m.pagamentoNotaFiscal ?? '' },
    { header: 'Responsável', key: 'resp', width: 22, value: (m) => m.pagamentoResponsavel ?? '' },
    { header: 'Pago por', key: 'pago', width: 22, value: (m) => m.pagamentoPagoPor ?? '' },
    {
      header: 'Combustível (L)', key: 'litros', width: 16, align: 'right', numFmt: '#,##0',
      value: (m) => m.pagamentoQuantidadeCombustivel ?? '',
      footerValue: (items) => items.reduce((s, m) => s + (m.pagamentoQuantidadeCombustivel ?? 0), 0),
    },
    { header: 'Observações', key: 'obs', width: 32, value: (m) => m.pagamentoObservacoes ?? m.descricao ?? '' },
    {
      header: 'Valor', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => m.valor,
      footerValue: (items) => items.reduce((s, m) => s + m.valor, 0),
      emphasizeValue: true,
    },
  ]);

  // ── Sheet "Ajustes" ──
  const wsAjustes = wb.addWorksheet('Ajustes', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento<TransportadoraMovimento>(wsAjustes, ajustes, [
    { header: 'Data', key: 'data', width: 14, value: (m) => formatDateBR(m.data) },
    {
      header: 'Sinal', key: 'sinal', width: 12,
      value: (m) => (m.tipo === 'ajuste_manual_credito' ? 'Crédito' : 'Débito'),
    },
    { header: 'Descrição', key: 'descricao', width: 42, value: (m) => m.descricao ?? '' },
    { header: 'Obra', key: 'obra', width: 24, value: (m) => obraNome(m.obraId) },
    { header: 'Criado por', key: 'autor', width: 22, value: (m) => m.createdBy ?? '' },
    {
      header: 'Crédito', key: 'credito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (m.tipo === 'ajuste_manual_credito' ? m.valor : ''),
      footerValue: (items) =>
        items.reduce((s, m) => s + (m.tipo === 'ajuste_manual_credito' ? m.valor : 0), 0),
    },
    {
      header: 'Débito', key: 'debito', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (m) => (m.tipo === 'ajuste_manual_debito' ? m.valor : ''),
      footerValue: (items) =>
        items.reduce((s, m) => s + (m.tipo === 'ajuste_manual_debito' ? m.valor : 0), 0),
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

  // Subset de créditos de tanque pra página dedicada (típico Areacre).
  // Em transportadoras sem tanque próprio, lista vazia → seção é
  // suprimida (sem página em branco).
  const movsMes = filtros.mesReferencia
    ? movimentos.filter((m) => m.mesReferencia === filtros.mesReferencia)
    : movimentos;
  const creditosTanque = movsMes
    .filter((m) => m.tipo === 'credito_abastecimento_transterra')
    .sort((a, b) => b.data.localeCompare(a.data));

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

  // Página dedicada "Abast. Tanque" — só renderiza quando há entradas
  // (transportadoras donas de tanque). Mantém paridade com sheet do Excel.
  if (creditosTanque.length > 0) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Abastecimentos no tanque (créditos)', creditosTanque.length);
    const headCT = ['Data', 'Combustível', 'Litros', 'Preço Tanque/L', 'Placa', 'Motorista', 'Crédito'];
    const totalCT = creditosTanque.reduce((s, m) => s + m.valor, 0);
    const totalLitrosCT = creditosTanque.reduce((s, m) => s + (m.saidaLitros ?? 0), 0);
    const bodyCT = creditosTanque.map((m) => [
      formatDateBR(m.data),
      // Sem insumosMap no PDF (não recebido); usa id se vier sem nome.
      m.saidaTipoCombustivel ?? '—',
      m.saidaLitros != null ? m.saidaLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
      m.saidaPrecoCombustivelAreacre != null
        ? `R$ ${m.saidaPrecoCombustivelAreacre.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
        : '—',
      m.saidaPlaca ?? '',
      m.saidaMotorista ?? '',
      fmtBRL(m.valor),
    ]);
    const footCT = ['', '', totalLitrosCT.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), '', '', 'Total', fmtBRL(totalCT)];
    drawPdfDetailTable(
      doc,
      20,
      headCT,
      bodyCT,
      footCT,
      {
        0: { halign: 'left', cellWidth: 24 },
        1: { halign: 'left', cellWidth: 50 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'left', cellWidth: 26 },
        5: { halign: 'left', cellWidth: 50 },
        6: { halign: 'right', cellWidth: 32 },
      },
      MARCA
    );
  }

  doc.save(makeFilename(`${SCOPE}_${transportadoraNome.toLowerCase().replace(/\s+/g, '_')}`, 'pdf'));
}
