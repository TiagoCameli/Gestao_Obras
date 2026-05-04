import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Abastecimento,
  AlocacaoEtapa,
  Cotacao,
  Deposito,
  EntradaCombustivel,
  Equipamento,
  EtapaObra,
  Fornecedor,
  Insumo,
  Obra,
  TransferenciaCombustivel,
} from '../types';
import {
  PDF_RGB,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfMiniTable,
  drawPdfSectionTitle,
  fmtBRL,
  fmtNum,
  formatDateBR,
  generatedAtStamp,
  makeFilename,
} from './exportTemplate';

const SUBTITULO = 'Módulo de Combustível • Gestão de Obras';

function formatDateTimeBR(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function buildFiltrosList(
  filtroObraIds: string[] | undefined,
  filtroDepositoIds: string[] | undefined,
  dataInicio: string | undefined,
  dataFim: string | undefined,
  obrasMap: Map<string, string>,
  depositosMap: Map<string, string>,
): Array<[string, string]> {
  const list: Array<[string, string]> = [];
  if (filtroObraIds && filtroObraIds.length > 0) {
    list.push(['Obras', filtroObraIds.map((id) => obrasMap.get(id) || id).join(', ')]);
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    list.push(['Tanques', filtroDepositoIds.map((id) => depositosMap.get(id) || id).join(', ')]);
  }
  if (dataInicio) list.push(['Data início', formatDateBR(dataInicio)]);
  if (dataFim) list.push(['Data fim', formatDateBR(dataFim)]);
  return list;
}

// =============================================================================
// Saídas
// =============================================================================

export function exportarSaidasPDF(
  abastecimentos: Abastecimento[],
  obras: Obra[],
  depositos: Deposito[],
  lookups: { insumos: Insumo[]; equipamentos: Equipamento[]; etapas: EtapaObra[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): void {
  let dados = [...abastecimentos];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const set = new Set(filtroObraIds);
    dados = dados.filter((a) => set.has(a.obraId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((a) => set.has(a.depositoId));
  }
  dados = dados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const equipMap = new Map(lookups.equipamentos.map((e) => [e.id, e.nome]));
  const etapasMap = new Map(lookups.etapas.map((e) => [e.id, e.nome]));

  function formatarAlocacoes(alocacoes?: AlocacaoEtapa[], etapaId?: string): string {
    const alocs = alocacoes && alocacoes.length > 0 ? alocacoes : etapaId ? [{ etapaId, percentual: 100 }] : [];
    return alocs.map((a) => `${etapasMap.get(a.etapaId) || '?'}: ${a.percentual}%`).join(' | ') || '-';
  }

  const totalLitros = dados.reduce((s, a) => s + a.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, a) => s + a.valorTotal, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, 'Relatório de Saídas de Combustível', SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(dados.length)],
    ['Litros Totais', `${fmtNum(totalLitros)} L`],
    ['Valor Total', fmtBRL(totalValor)],
    ['R$/Litro Médio', fmtBRL(totalLitros > 0 ? totalValor / totalLitros : 0, 4)],
  ], margin);

  type Ag = { chave: string; registros: number; litros: number; valor: number };
  function agrupar(keyFn: (a: Abastecimento) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((a) => {
      const k = keyFn(a);
      if (!k) return;
      const ex = map.get(k);
      if (ex) { ex.registros++; ex.litros += a.quantidadeLitros; ex.valor += a.valorTotal; }
      else map.set(k, { chave: labelFn(k), registros: 1, litros: a.quantidadeLitros, valor: a.valorTotal });
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totL = ags.reduce((s, r) => s + r.litros, 0) || 1;
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Litros', 'Valor Total', '% Litros', '% Valor'],
      sliced.map((r) => [
        r.chave,
        String(r.registros),
        fmtNum(r.litros),
        fmtBRL(r.valor),
        ((r.litros / totL) * 100).toFixed(1).replace('.', ',') + '%',
        ((r.valor / totVal) * 100).toFixed(1).replace('.', ',') + '%',
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

  mini('POR OBRA', 'Obra', agrupar((a) => a.obraId, (k) => obrasMap.get(k) || '—'));
  mini('POR TANQUE', 'Tanque', agrupar((a) => a.depositoId, (k) => depositosMap.get(k) || '—'));
  mini('POR EQUIPAMENTO (TOP 10)', 'Equipamento', agrupar((a) => a.equipamentoId || a.veiculo || '__sem__', (k) => k === '__sem__' ? 'Sem equipamento atrelado' : (equipMap.get(k) || k)), 10);
  mini('POR COMBUSTÍVEL', 'Combustível', agrupar((a) => a.tipoCombustivel, (k) => insumosMap.get(k) || k));

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Saídas de Combustível', dados.length, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Data/Hora', 'Obra', 'Etapas', 'Tanque', 'Equipamento', 'Combustível', 'Litros', 'Valor Total'],
    dados.map((a) => [
      formatDateTimeBR(a.dataHora),
      obrasMap.get(a.obraId) || '-',
      formatarAlocacoes(a.alocacoes, a.etapaId),
      depositosMap.get(a.depositoId) || '-',
      equipMap.get(a.equipamentoId) || equipMap.get(a.veiculo) || a.veiculo || 'Sem equipamento atrelado',
      insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel,
      fmtNum(a.quantidadeLitros),
      fmtBRL(a.valorTotal),
    ]),
    [
      '',
      `TOTAL (${dados.length})`,
      '', '', '', '',
      fmtNum(totalLitros),
      fmtBRL(totalValor),
    ],
    {
      0: { halign: 'center', cellWidth: 26 },
      1: { halign: 'left', cellWidth: 34 },
      2: { halign: 'left', cellWidth: 40 },
      3: { halign: 'left', cellWidth: 30 },
      4: { halign: 'left', cellWidth: 34 },
      5: { halign: 'left', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 'auto' },
    },
    'Gestão de Obras • Saídas de Combustível',
    margin,
  );

  doc.save(makeFilename('saidas-combustivel', 'pdf'));
}

// =============================================================================
// Entradas
// =============================================================================

export function exportarEntradasPDF(
  entradas: EntradaCombustivel[],
  obras: Obra[],
  depositos: Deposito[],
  lookups: { insumos: Insumo[]; fornecedores: Fornecedor[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): void {
  let dados = [...entradas];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const set = new Set(filtroObraIds);
    dados = dados.filter((e) => set.has(e.obraId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((e) => set.has(e.depositoId));
  }
  dados = dados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const fornecedoresMap = new Map(lookups.fornecedores.map((f) => [f.id, f.nome]));

  const totalLitros = dados.reduce((s, e) => s + e.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, e) => s + e.valorTotal, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, 'Relatório de Entradas de Combustível', SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(dados.length)],
    ['Litros Totais', `${fmtNum(totalLitros)} L`],
    ['Valor Total', fmtBRL(totalValor)],
    ['R$/Litro Médio', fmtBRL(totalLitros > 0 ? totalValor / totalLitros : 0, 4)],
  ], margin);

  type Ag = { chave: string; registros: number; litros: number; valor: number };
  function agrupar(keyFn: (e: EntradaCombustivel) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((e) => {
      const k = keyFn(e);
      if (!k) return;
      const ex = map.get(k);
      if (ex) { ex.registros++; ex.litros += e.quantidadeLitros; ex.valor += e.valorTotal; }
      else map.set(k, { chave: labelFn(k), registros: 1, litros: e.quantidadeLitros, valor: e.valorTotal });
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totL = ags.reduce((s, r) => s + r.litros, 0) || 1;
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Litros', 'Valor Total', '% Litros', '% Valor'],
      sliced.map((r) => [
        r.chave,
        String(r.registros),
        fmtNum(r.litros),
        fmtBRL(r.valor),
        ((r.litros / totL) * 100).toFixed(1).replace('.', ',') + '%',
        ((r.valor / totVal) * 100).toFixed(1).replace('.', ',') + '%',
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

  mini('POR OBRA', 'Obra', agrupar((e) => e.obraId, (k) => obrasMap.get(k) || '—'));
  mini('POR TANQUE', 'Tanque', agrupar((e) => e.depositoId, (k) => depositosMap.get(k) || '—'));
  mini('POR COMBUSTÍVEL', 'Combustível', agrupar((e) => e.tipoCombustivel, (k) => insumosMap.get(k) || k));
  mini('POR FORNECEDOR (TOP 10)', 'Fornecedor', agrupar((e) => e.fornecedor, (k) => fornecedoresMap.get(k) || k || '—'), 10);

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Entradas de Combustível', dados.length, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Data/Hora', 'Obra', 'Tanque', 'Combustível', 'Fornecedor', 'Nota Fiscal', 'Litros', 'Valor Total'],
    dados.map((e) => [
      formatDateTimeBR(e.dataHora),
      obrasMap.get(e.obraId) || '-',
      depositosMap.get(e.depositoId) || '-',
      insumosMap.get(e.tipoCombustivel) || e.tipoCombustivel,
      fornecedoresMap.get(e.fornecedor) || e.fornecedor || '-',
      e.notaFiscal || '-',
      fmtNum(e.quantidadeLitros),
      fmtBRL(e.valorTotal),
    ]),
    [
      '',
      `TOTAL (${dados.length})`,
      '', '', '', '',
      fmtNum(totalLitros),
      fmtBRL(totalValor),
    ],
    {
      0: { halign: 'center', cellWidth: 28 },
      1: { halign: 'left', cellWidth: 34 },
      2: { halign: 'left', cellWidth: 32 },
      3: { halign: 'left', cellWidth: 28 },
      4: { halign: 'left', cellWidth: 34 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 'auto' },
    },
    'Gestão de Obras • Entradas de Combustível',
    margin,
  );

  doc.save(makeFilename('entradas-combustivel', 'pdf'));
}

// =============================================================================
// Transferências
// =============================================================================

export function exportarTransferenciasPDF(
  transferencias: TransferenciaCombustivel[],
  obras: Obra[],
  depositos: Deposito[],
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): void {
  let dados = [...transferencias];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const depositosDasObras = new Set(
      depositos.filter((d) => filtroObraIds.includes(d.obraId)).map((d) => d.id),
    );
    dados = dados.filter((t) => depositosDasObras.has(t.depositoOrigemId) || depositosDasObras.has(t.depositoDestinoId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((t) => set.has(t.depositoOrigemId) || set.has(t.depositoDestinoId));
  }
  dados = dados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));

  const totalLitros = dados.reduce((s, t) => s + t.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, t) => s + t.valorTotal, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, 'Relatório de Transferências de Combustível', SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(dados.length)],
    ['Litros Totais', `${fmtNum(totalLitros)} L`],
    ['Valor Total', fmtBRL(totalValor)],
    ['Tanques', String(new Set(dados.flatMap((t) => [t.depositoOrigemId, t.depositoDestinoId])).size)],
  ], margin);

  type Ag = { chave: string; registros: number; litros: number; valor: number };
  function agrupar(keyFn: (t: TransferenciaCombustivel) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((t) => {
      const k = keyFn(t);
      if (!k) return;
      const ex = map.get(k);
      if (ex) { ex.registros++; ex.litros += t.quantidadeLitros; ex.valor += t.valorTotal; }
      else map.set(k, { chave: labelFn(k), registros: 1, litros: t.quantidadeLitros, valor: t.valorTotal });
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[]) {
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totL = ags.reduce((s, r) => s + r.litros, 0) || 1;
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Litros', 'Valor Total', '% Litros', '% Valor'],
      ags.map((r) => [
        r.chave,
        String(r.registros),
        fmtNum(r.litros),
        fmtBRL(r.valor),
        ((r.litros / totL) * 100).toFixed(1).replace('.', ',') + '%',
        ((r.valor / totVal) * 100).toFixed(1).replace('.', ',') + '%',
      ]),
      [
        'Total',
        String(ags.reduce((s, r) => s + r.registros, 0)),
        fmtNum(ags.reduce((s, r) => s + r.litros, 0)),
        fmtBRL(ags.reduce((s, r) => s + r.valor, 0)),
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

  mini('POR ORIGEM', 'Origem', agrupar((t) => t.depositoOrigemId, (k) => depositosMap.get(k) || '—'));
  mini('POR DESTINO', 'Destino', agrupar((t) => t.depositoDestinoId, (k) => depositosMap.get(k) || '—'));

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Transferências de Combustível', dados.length, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Data/Hora', 'Origem', 'Destino', 'Litros', 'Valor Total', 'Observações'],
    dados.map((t) => [
      formatDateTimeBR(t.dataHora),
      depositosMap.get(t.depositoOrigemId) || '-',
      depositosMap.get(t.depositoDestinoId) || '-',
      fmtNum(t.quantidadeLitros),
      fmtBRL(t.valorTotal),
      t.observacoes || '-',
    ]),
    [
      '',
      `TOTAL (${dados.length})`,
      '',
      fmtNum(totalLitros),
      fmtBRL(totalValor),
      '',
    ],
    {
      0: { halign: 'center', cellWidth: 32 },
      1: { halign: 'left', cellWidth: 48 },
      2: { halign: 'left', cellWidth: 48 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'left', cellWidth: 'auto' },
    },
    'Gestão de Obras • Transferências de Combustível',
    margin,
  );

  doc.save(makeFilename('transferencias-combustivel', 'pdf'));
}

// =============================================================================
// Cotação (detail-of-one)
// =============================================================================

export function exportarCotacaoPDF(
  cotacao: Cotacao,
  fornecedoresMap: Map<string, Fornecedor>,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Banner (no KPI cards for detail-of-one)
  let y = drawPdfBanner(
    doc,
    `Cotação ${cotacao.numero}`,
    cotacao.descricao || 'Módulo de Compras • Gestão de Obras',
    margin,
  );

  // Meta chips (similar to filtros)
  const metaList: Array<[string, string]> = [
    ['Data', formatDateBR(cotacao.data)],
  ];
  if (cotacao.prazoResposta) metaList.push(['Prazo resposta', formatDateBR(cotacao.prazoResposta)]);
  metaList.push([
    'Status',
    cotacao.status === 'em_cotacao' ? 'Em Cotação' : cotacao.status === 'parcial' ? 'Parcial' : 'Cotado',
  ]);
  metaList.push(['Fornecedores', String(cotacao.fornecedores.length)]);
  y = drawPdfFiltros(doc, y, metaList, margin);

  y = drawPdfSectionTitle(doc, y, 'COMPARATIVO DE FORNECEDORES', margin);

  // Build comparison table
  const fornecedoresResp = cotacao.fornecedores;
  const headRow: string[] = ['Material', 'Qtd', 'Unid.'];
  for (const cf of fornecedoresResp) {
    const nome = fornecedoresMap.get(cf.fornecedorId)?.nome || 'Fornecedor';
    headRow.push(nome);
  }

  const bodyRows: string[][] = cotacao.itensPedido.map((item) => {
    const row: string[] = [item.descricao, String(item.quantidade), item.unidade];
    for (const cf of fornecedoresResp) {
      if (!cf.respondido) {
        row.push('--');
        continue;
      }
      const preco = cf.itensPrecos.find((ip) => ip.itemPedidoId === item.id);
      const unit = preco?.precoUnitario ?? 0;
      const sub = unit * item.quantidade;
      row.push(`${fmtBRL(unit)}\n(${fmtBRL(sub)})`);
    }
    return row;
  });

  const totalRow: string[] = ['Total', '', ''];
  const condRow: string[] = ['Cond. Pagamento', '', ''];
  const prazoRow: string[] = ['Prazo Entrega', '', ''];
  for (const cf of fornecedoresResp) {
    totalRow.push(cf.respondido ? fmtBRL(cf.total) : '--');
    condRow.push(cf.condicaoPagamento || '--');
    prazoRow.push(cf.prazoEntrega || '--');
  }

  const respondidos = fornecedoresResp.filter((cf) => cf.respondido && cf.total > 0);
  const menorId = respondidos.length > 0
    ? respondidos.reduce((min, cf) => (cf.total < min.total ? cf : min)).fornecedorId
    : null;
  const menorColIdx = menorId
    ? fornecedoresResp.findIndex((cf) => cf.fornecedorId === menorId) + 3
    : -1;

  autoTable(doc, {
    startY: y,
    head: [headRow],
    body: [...bodyRows, totalRow, condRow, prazoRow],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: PDF_RGB.bordaLeve,
      lineWidth: 0.1,
      textColor: PDF_RGB.cinzaEscuro,
    },
    headStyles: {
      fillColor: PDF_RGB.verde,
      textColor: PDF_RGB.branco,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: { fillColor: PDF_RGB.zebra },
    columnStyles: {
      0: { cellWidth: 60, halign: 'left' },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 18 },
    },
    margin: { left: margin, right: margin, top: 18 },
    didParseCell(data) {
      if (data.column.index >= 3) {
        data.cell.styles.halign = 'center';
      }
      const totalRowIdx = bodyRows.length;
      if (data.row.index === totalRowIdx && data.row.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = PDF_RGB.verdeClaro;
        data.cell.styles.textColor = PDF_RGB.verdeEscuro;
        if (data.column.index === menorColIdx) {
          data.cell.styles.textColor = PDF_RGB.verde;
        }
      }
      if ((data.row.index === totalRowIdx + 1 || data.row.index === totalRowIdx + 2) && data.row.section === 'body') {
        data.cell.styles.fontSize = 7.5;
        data.cell.styles.textColor = PDF_RGB.cinzaMedio;
        data.cell.styles.fillColor = PDF_RGB.branco;
      }
    },
    didDrawPage: (data) => {
      const totalPages = doc.getNumberOfPages();
      doc.setTextColor(...PDF_RGB.cinzaMedio);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Página ${data.pageNumber} de ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
      doc.text(`Gestão de Obras • Cotação ${cotacao.numero}`, margin, pageH - 4);
    },
  });

  if (cotacao.observacoes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY as number;
    doc.setTextColor(...PDF_RGB.cinzaEscuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observações', margin, finalY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.text(cotacao.observacoes, margin, finalY + 13, { maxWidth: pageW - margin * 2 });
  }

  void generatedAtStamp;

  doc.save(`cotacao-${cotacao.numero}.pdf`);
}
