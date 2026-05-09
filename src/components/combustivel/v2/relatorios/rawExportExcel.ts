// Gerador do template "Raw Export" — Excel multi-aba (sem PDF).
//
// Diferente dos templates Mensal/PorObra/PorEquipamento (que agregam +
// gráficos), este é dado cru — todas as 3 tabelas operacionais
// (saidas, entradas, transferencias) com FKs soft resolvidas pra nome
// humano. Útil pra entrega DNIT/contador que precisa do dado linha-a-linha
// pra cruzar com outras fontes.

import type {
  Deposito,
  EntradaCombustivel,
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
  TransferenciaCombustivel,
} from '../../../../types';
import {
  BRAND,
  createWorkbook,
  fillSolid,
  formatDateBR,
  formatMesRef,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelSectionTitle,
  thinBorder,
} from '../../../../utils/exportTemplate';

const TITULO = 'Combustível · Raw Export';
const SUBTITULO_BASE = 'Dados crus por mês — saídas, entradas, transferências';

interface RawExportInput {
  /** Mês referência YYYY-MM. */
  mesReferencia: string;
  saidasNoMes: SaidaCombustivel[];
  entradasNoMes: EntradaCombustivel[];
  transferenciasNoMes: TransferenciaCombustivel[];
  /** Cadastros pra resolver FK soft + sheet de referência. */
  obras: Obra[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  depositos: Deposito[];
}

const TIPO_CONSUMIDOR_LABEL: Record<string, string> = {
  equipamento_proprio: 'Equipamento próprio',
  carreta_transportadora: 'Carreta terceirizada',
};

const ORIGEM_LABEL: Record<string, string> = {
  tanque: 'Tanque',
  dinheiro: 'Dinheiro',
  requisicao: 'Requisição',
};

function nomeArquivo(mesRef: string): string {
  // formatMesRef → "Abr/2026"; troca / por - filename-safe.
  const slug = formatMesRef(mesRef).replace('/', '-');
  return `EMT - Raw Export - ${slug}.xlsx`;
}

function consumidorLabel(
  s: SaidaCombustivel,
  eqMap: Map<string, Equipamento>,
  transpMap: Map<string, string>,
): string {
  if (s.tipoConsumidor === 'equipamento_proprio') {
    if (s.equipamentoId === 'desconhecido') return 'Não identificado';
    if (!s.equipamentoId) return '—';
    const eq = eqMap.get(s.equipamentoId);
    if (!eq) return s.equipamentoId;
    const codigo = eq.codigoPatrimonio || eq.tipo || '';
    return codigo ? `${codigo} · ${eq.nome}` : eq.nome;
  }
  // Carreta
  const transp = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '') : '';
  return `${s.placa ?? '—'}${transp ? ` · ${transp}` : ''}`;
}

export async function exportarRawExcel(input: RawExportInput): Promise<void> {
  const subtitulo = `${SUBTITULO_BASE} · ${formatMesRef(input.mesReferencia)}`;
  const obraMap = new Map(input.obras.map((o) => [o.id, o.nome]));
  const eqMap = new Map(input.equipamentos.map((e) => [e.id, e]));
  const transpMap = new Map(input.transportadoras.map((t) => [t.id, t.nome]));
  const combMap = new Map(input.combustiveis.map((c) => [c.id, c.nome]));
  const depMap = new Map(input.depositos.map((d) => [d.id, d.apelido || d.nome]));

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Saídas';

  // ── Sheet 1: Resumo ──
  let row = renderExcelBanner(wsResumo, TITULO, subtitulo);
  row += 1;
  row = renderExcelFiltros(wsResumo, row, [
    ['Mês referência', formatMesRef(input.mesReferencia)],
    ['Saídas', `${input.saidasNoMes.length} registros`],
    ['Entradas', `${input.entradasNoMes.length} registros`],
    ['Transferências', `${input.transferenciasNoMes.length} registros`],
  ]);
  row += 1;
  const totalLitrosSaidas = input.saidasNoMes.reduce((a, s) => a + s.litros, 0);
  const totalCustoSaidas = input.saidasNoMes.reduce((a, s) => a + s.valorTotal, 0);
  const totalLitrosEntradas = input.entradasNoMes.reduce((a, e) => a + e.quantidadeLitros, 0);
  const totalCustoEntradas = input.entradasNoMes.reduce((a, e) => a + e.valorTotal, 0);
  const totalLitrosTransf = input.transferenciasNoMes.reduce((a, t) => a + t.quantidadeLitros, 0);
  renderExcelKPIs(wsResumo, row, [
    { label: 'Volume saídas', value: totalLitrosSaidas, numFmt: '#,##0 "L"' },
    { label: 'Custo saídas', value: totalCustoSaidas, numFmt: '"R$" #,##0.00' },
    { label: 'Volume entradas', value: totalLitrosEntradas, numFmt: '#,##0 "L"' },
    { label: 'Custo entradas', value: totalCustoEntradas, numFmt: '"R$" #,##0.00' },
    { label: 'Volume transferências', value: totalLitrosTransf, numFmt: '#,##0 "L"' },
    { label: 'Qtd saídas', value: input.saidasNoMes.length },
    { label: 'Qtd entradas', value: input.entradasNoMes.length },
    { label: 'Qtd transferências', value: input.transferenciasNoMes.length },
  ]);

  // ── Sheet 2: Saídas (cronológico DESC) ──
  const saidasDesc = [...input.saidasNoMes].sort((a, b) => b.data.localeCompare(a.data));
  renderExcelDetalhamento(wsDetalhe, saidasDesc, [
    { header: 'Data', key: 'data', width: 14, value: (s) => formatDateBR(s.data) },
    {
      header: 'Tipo Consumidor', key: 'tipoCons', width: 22,
      value: (s) => TIPO_CONSUMIDOR_LABEL[s.tipoConsumidor] ?? s.tipoConsumidor,
    },
    { header: 'Consumidor', key: 'cons', width: 36, value: (s) => consumidorLabel(s, eqMap, transpMap) },
    {
      header: 'Origem', key: 'origem', width: 14,
      value: (s) => ORIGEM_LABEL[s.origem] ?? s.origem,
    },
    { header: 'Tanque', key: 'tanque', width: 22, value: (s) => (s.tanqueId ? (depMap.get(s.tanqueId) ?? '—') : '—') },
    { header: 'Obra', key: 'obra', width: 36, value: (s) => (s.obraId ? (obraMap.get(s.obraId) ?? '—') : '—') },
    { header: 'Combustível', key: 'comb', width: 18, value: (s) => combMap.get(s.tipoCombustivel) ?? s.tipoCombustivel },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (s) => s.litros,
      footerValue: (items) => items.reduce((a, s) => a + s.litros, 0),
    },
    {
      header: 'Preço/L', key: 'precoL', width: 14, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (s) => s.precoUnitario ?? (s.litros > 0 ? s.valorTotal / s.litros : 0),
    },
    {
      header: 'R$/L Total', key: 'rplTotal', width: 14, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (s) => (s.litros > 0 ? s.valorTotal / s.litros : 0),
    },
    {
      header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (s) => s.valorTotal,
      footerValue: (items) => items.reduce((a, s) => a + s.valorTotal, 0),
    },
    { header: 'Motorista', key: 'mot', width: 22, value: (s) => s.motorista ?? '' },
    {
      header: 'Pago', key: 'pago', width: 8,
      // Só relevante quando origem='requisicao'; em outros casos mostra "—".
      value: (s) => (s.origem === 'requisicao' ? (s.pago ? 'Sim' : 'Não') : '—'),
    },
    { header: 'Pago em', key: 'pagoEm', width: 14, value: (s) => (s.pagoEm ? formatDateBR(s.pagoEm) : '—') },
    { header: 'Observações', key: 'obs', width: 30, value: (s) => s.observacoes ?? '' },
    { header: 'Criado por', key: 'cBy', width: 22, value: (s) => s.createdBy ?? '' },
  ]);

  // ── Sheet 3: Entradas ──
  const wsEntradas = wb.addWorksheet('Entradas', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  const entradasDesc = [...input.entradasNoMes].sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  renderExcelDetalhamento(wsEntradas, entradasDesc, [
    { header: 'Data', key: 'data', width: 14, value: (e) => formatDateBR(e.dataHora) },
    { header: 'Tanque', key: 'tanque', width: 26, value: (e) => depMap.get(e.depositoId) ?? '—' },
    { header: 'Combustível', key: 'comb', width: 18, value: (e) => combMap.get(e.tipoCombustivel) ?? e.tipoCombustivel },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (e) => e.quantidadeLitros,
      footerValue: (items) => items.reduce((a, e) => a + e.quantidadeLitros, 0),
    },
    {
      header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (e) => (e.quantidadeLitros > 0 ? e.valorTotal / e.quantidadeLitros : 0),
    },
    {
      header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (e) => e.valorTotal,
      footerValue: (items) => items.reduce((a, e) => a + e.valorTotal, 0),
    },
    { header: 'Fornecedor', key: 'forn', width: 30, value: (e) => e.fornecedor ?? '—' },
    { header: 'Nota Fiscal', key: 'nf', width: 16, value: (e) => e.notaFiscal ?? '' },
    { header: 'Observações', key: 'obs', width: 30, value: (e) => e.observacoes ?? '' },
    { header: 'Criado por', key: 'cBy', width: 22, value: (e) => e.criadoPor ?? '' },
  ]);

  // ── Sheet 4: Transferências ──
  const wsTransf = wb.addWorksheet('Transferências', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  const transfDesc = [...input.transferenciasNoMes].sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  renderExcelDetalhamento(wsTransf, transfDesc, [
    { header: 'Data', key: 'data', width: 14, value: (t) => formatDateBR(t.dataHora) },
    { header: 'Tanque Origem', key: 'orig', width: 26, value: (t) => depMap.get(t.depositoOrigemId) ?? '—' },
    { header: 'Tanque Destino', key: 'dest', width: 26, value: (t) => depMap.get(t.depositoDestinoId) ?? '—' },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (t) => t.quantidadeLitros,
      footerValue: (items) => items.reduce((a, t) => a + t.quantidadeLitros, 0),
    },
    {
      header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (t) => t.valorTotal,
      footerValue: (items) => items.reduce((a, t) => a + t.valorTotal, 0),
    },
    { header: 'Observações', key: 'obs', width: 30, value: (t) => t.observacoes ?? '' },
    { header: 'Criado por', key: 'cBy', width: 22, value: (t) => t.criadoPor ?? '' },
  ]);

  // ── Sheet 5: Cadastros (referência inline) ──
  // 4 blocos empilhados verticalmente — Depósitos, Equipamentos,
  // Fornecedores (transportadoras + texto livre de entradas), Combustíveis.
  const wsCadastros = wb.addWorksheet('Cadastros', {
    properties: { tabColor: { argb: BRAND.cinzaMedio } },
  });
  wsCadastros.views = [{ showGridLines: false }];
  wsCadastros.columns = [
    { width: 36 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 30 },
  ];

  // Helper interno pra renderizar mini-bloco com header verde + linhas
  function renderRefBlock(
    titulo: string,
    startRow: number,
    headers: string[],
    rows: (string | number)[][],
  ): number {
    let r = renderExcelSectionTitle(wsCadastros, startRow, titulo);
    // Header
    headers.forEach((h, i) => {
      const cell = wsCadastros.getCell(r, i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND.branco } };
      cell.fill = fillSolid(BRAND.verde);
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = thinBorder();
    });
    wsCadastros.getRow(r).height = 22;
    r++;
    // Body
    rows.forEach((cols, idx) => {
      const zebra = idx % 2 === 1;
      cols.forEach((v, i) => {
        const cell = wsCadastros.getCell(r, i + 1);
        cell.value = v;
        cell.font = { name: 'Calibri', size: 10, color: { argb: BRAND.cinzaEscuro } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.fill = fillSolid(zebra ? BRAND.cinzaZebra : BRAND.branco);
        cell.border = thinBorder();
      });
      wsCadastros.getRow(r).height = 18;
      r++;
    });
    return r + 1;
  }

  let cadRow = 2;
  const transpProprMap = new Map(input.transportadoras.map((t) => [t.id, t.nome]));
  const depAtivos = input.depositos.filter((d) => d.ativo !== false);
  cadRow = renderRefBlock(
    'Tanques / Depósitos',
    cadRow,
    ['Nome', 'Apelido', 'Capacidade (L)', 'Externo', 'Proprietária'],
    depAtivos.map((d) => [
      d.nome,
      d.apelido ?? '',
      d.capacidadeLitros,
      d.ehExterno ? 'Sim' : 'Não',
      d.transportadoraProprietariaId
        ? (transpProprMap.get(d.transportadoraProprietariaId) ?? '—')
        : 'EMT (interno)',
    ]),
  );

  const equipsAtivos = input.equipamentos.filter((e) => e.ativo !== false);
  cadRow = renderRefBlock(
    'Equipamentos',
    cadRow,
    ['Nome', 'Código', 'Tipo', 'Marca / Modelo'],
    equipsAtivos.map((e) => [
      e.nome,
      e.codigoPatrimonio ?? '',
      e.tipo ?? '',
      `${e.marca ?? ''}${e.modelo ? ` · ${e.modelo}` : ''}`.trim(),
    ]),
  );

  cadRow = renderRefBlock(
    'Transportadoras',
    cadRow,
    ['Nome'],
    input.transportadoras
      .filter((t) => t.ehTransportadora)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((t) => [t.nome]),
  );

  const combsAtivos = input.combustiveis.filter((c) => c.ativo !== false);
  cadRow = renderRefBlock(
    'Combustíveis',
    cadRow,
    ['Nome', 'Unidade'],
    combsAtivos.map((c) => [c.nome, c.unidade]),
  );

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo(input.mesReferencia);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
