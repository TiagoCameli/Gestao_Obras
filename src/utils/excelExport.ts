import ExcelJS from 'exceljs';
import type {
  Abastecimento,
  AlocacaoEtapa,
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
  BRAND,
  createWorkbook,
  fillSolid,
  formatDateBR,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelMiniTable,
  renderExcelSectionTitle,
  saveWorkbook,
  thinBorder,
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
// Saídas (abastecimentos)
// =============================================================================

export async function exportarSaidasExcel(
  abastecimentos: Abastecimento[],
  obras: Obra[],
  depositos: Deposito[],
  lookups: { insumos: Insumo[]; equipamentos: Equipamento[]; etapas: EtapaObra[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): Promise<void> {
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

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, 'Relatório de Saídas de Combustível', SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: dados.length, numFmt: '0' },
    { label: 'Litros Totais', value: totalLitros, numFmt: '#,##0.00 "L"' },
    { label: 'Valor Total', value: totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'R$/Litro Médio', value: totalLitros > 0 ? totalValor / totalLitros : 0, numFmt: '"R$" #,##0.0000' },
  ]);

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
      sliced.map((r) => ({ cells: [r.chave, r.registros, r.litros, r.valor, r.litros / totL, r.valor / totVal] })),
      [
        'Total',
        sliced.reduce((s, r) => s + r.registros, 0),
        sliced.reduce((s, r) => s + r.litros, 0),
        sliced.reduce((s, r) => s + r.valor, 0),
        '', '',
      ],
    );
  }

  mini('POR OBRA', 'Obra', agrupar((a) => a.obraId, (k) => obrasMap.get(k) || '—'));
  mini('POR TANQUE', 'Tanque', agrupar((a) => a.depositoId, (k) => depositosMap.get(k) || '—'));
  mini('POR EQUIPAMENTO (TOP 10)', 'Equipamento', agrupar((a) => a.equipamentoId || a.veiculo || '__sem__', (k) => k === '__sem__' ? 'Sem equipamento atrelado' : (equipMap.get(k) || k)), 10);
  mini('POR COMBUSTÍVEL', 'Combustível', agrupar((a) => a.tipoCombustivel, (k) => insumosMap.get(k) || k));

  renderExcelDetalhamento<Abastecimento>(
    wsDetalhe,
    dados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (a) => formatDateTimeBR(a.dataHora) },
      { header: 'Obra', key: 'obra', width: 22, align: 'left', value: (a) => obrasMap.get(a.obraId) || '-' },
      { header: 'Etapas', key: 'etapas', width: 28, align: 'left', value: (a) => formatarAlocacoes(a.alocacoes, a.etapaId) },
      { header: 'Tanque', key: 'tanque', width: 22, align: 'left', value: (a) => depositosMap.get(a.depositoId) || '-' },
      { header: 'Equipamento', key: 'equipamento', width: 24, align: 'left', value: (a) => equipMap.get(a.equipamentoId) || equipMap.get(a.veiculo) || a.veiculo || 'Sem equipamento atrelado' },
      { header: 'Combustível', key: 'combustivel', width: 18, align: 'left', value: (a) => insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel },
      { header: 'Origem', key: 'origem', width: 14, align: 'center',
        value: (a) => (a.origemCombustivel === 'dinheiro' ? 'Dinheiro' : a.origemCombustivel === 'requisicao' ? 'Requisição' : 'Tanque') },
      { header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (a) => a.quantidadeLitros,
        footerValue: (items) => (items as Abastecimento[]).reduce((s, a) => s + a.quantidadeLitros, 0) },
      { header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (a) => a.valorTotal,
        footerValue: (items) => (items as Abastecimento[]).reduce((s, a) => s + a.valorTotal, 0) },
      { header: 'Fornecedor', key: 'fornecedor', width: 20, align: 'left', value: (a) => a.fornecedor || '-' },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (a) => a.observacoes || '-' },
    ],
    2,
    `TOTAL (${dados.length} ${dados.length === 1 ? 'registro' : 'registros'})`,
  );

  await saveWorkbook(wb, makeFilename('saidas-combustivel', 'xlsx'));
}

// =============================================================================
// Entradas
// =============================================================================

export async function exportarEntradasExcel(
  entradas: EntradaCombustivel[],
  obras: Obra[],
  depositos: Deposito[],
  lookups: { insumos: Insumo[]; fornecedores: Fornecedor[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): Promise<void> {
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

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, 'Relatório de Entradas de Combustível', SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: dados.length, numFmt: '0' },
    { label: 'Litros Totais', value: totalLitros, numFmt: '#,##0.00 "L"' },
    { label: 'Valor Total', value: totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'R$/Litro Médio', value: totalLitros > 0 ? totalValor / totalLitros : 0, numFmt: '"R$" #,##0.0000' },
  ]);

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
      sliced.map((r) => ({ cells: [r.chave, r.registros, r.litros, r.valor, r.litros / totL, r.valor / totVal] })),
      [
        'Total',
        sliced.reduce((s, r) => s + r.registros, 0),
        sliced.reduce((s, r) => s + r.litros, 0),
        sliced.reduce((s, r) => s + r.valor, 0),
        '', '',
      ],
    );
  }

  mini('POR OBRA', 'Obra', agrupar((e) => e.obraId, (k) => obrasMap.get(k) || '—'));
  mini('POR TANQUE', 'Tanque', agrupar((e) => e.depositoId, (k) => depositosMap.get(k) || '—'));
  mini('POR COMBUSTÍVEL', 'Combustível', agrupar((e) => e.tipoCombustivel, (k) => insumosMap.get(k) || k));
  mini('POR FORNECEDOR (TOP 10)', 'Fornecedor', agrupar((e) => e.fornecedor, (k) => fornecedoresMap.get(k) || k || '—'), 10);

  renderExcelDetalhamento<EntradaCombustivel>(
    wsDetalhe,
    dados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (e) => formatDateTimeBR(e.dataHora) },
      { header: 'Obra', key: 'obra', width: 22, align: 'left', value: (e) => obrasMap.get(e.obraId) || '-' },
      { header: 'Tanque', key: 'tanque', width: 22, align: 'left', value: (e) => depositosMap.get(e.depositoId) || '-' },
      { header: 'Combustível', key: 'combustivel', width: 18, align: 'left', value: (e) => insumosMap.get(e.tipoCombustivel) || e.tipoCombustivel },
      { header: 'Fornecedor', key: 'fornecedor', width: 22, align: 'left', value: (e) => fornecedoresMap.get(e.fornecedor) || e.fornecedor || '-' },
      { header: 'Nota Fiscal', key: 'nf', width: 16, align: 'center', value: (e) => e.notaFiscal || '-' },
      { header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (e) => e.quantidadeLitros,
        footerValue: (items) => (items as EntradaCombustivel[]).reduce((s, e) => s + e.quantidadeLitros, 0) },
      { header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (e) => e.valorTotal,
        footerValue: (items) => (items as EntradaCombustivel[]).reduce((s, e) => s + e.valorTotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (e) => e.observacoes || '-' },
    ],
    2,
    `TOTAL (${dados.length} ${dados.length === 1 ? 'registro' : 'registros'})`,
  );

  await saveWorkbook(wb, makeFilename('entradas-combustivel', 'xlsx'));
}

// =============================================================================
// Transferências
// =============================================================================

export async function exportarTransferenciasExcel(
  transferencias: TransferenciaCombustivel[],
  obras: Obra[],
  depositos: Deposito[],
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): Promise<void> {
  let dados = [...transferencias];
  // Tanques globais (Fase 6) — filtro por obra perdeu sentido em transferências
  // (movimento entre tanques sem dono semântico). filtroDepositoIds segue válido.
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((t) => set.has(t.depositoOrigemId) || set.has(t.depositoDestinoId));
  }
  dados = dados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));

  const totalLitros = dados.reduce((s, t) => s + t.quantidadeLitros, 0);
  const totalValor = dados.reduce((s, t) => s + t.valorTotal, 0);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, 'Relatório de Transferências de Combustível', SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: dados.length, numFmt: '0' },
    { label: 'Litros Totais', value: totalLitros, numFmt: '#,##0.00 "L"' },
    { label: 'Valor Total', value: totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'Tanques', value: new Set(dados.flatMap((t) => [t.depositoOrigemId, t.depositoDestinoId])).size, numFmt: '0' },
  ]);

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
      ags.map((r) => ({ cells: [r.chave, r.registros, r.litros, r.valor, r.litros / totL, r.valor / totVal] })),
      [
        'Total',
        ags.reduce((s, r) => s + r.registros, 0),
        ags.reduce((s, r) => s + r.litros, 0),
        ags.reduce((s, r) => s + r.valor, 0),
        '', '',
      ],
    );
  }

  mini('POR ORIGEM', 'Origem', agrupar((t) => t.depositoOrigemId, (k) => depositosMap.get(k) || '—'));
  mini('POR DESTINO', 'Destino', agrupar((t) => t.depositoDestinoId, (k) => depositosMap.get(k) || '—'));

  renderExcelDetalhamento<TransferenciaCombustivel>(
    wsDetalhe,
    dados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (t) => formatDateTimeBR(t.dataHora) },
      { header: 'Origem', key: 'origem', width: 26, align: 'left', value: (t) => depositosMap.get(t.depositoOrigemId) || '-' },
      { header: 'Destino', key: 'destino', width: 26, align: 'left', value: (t) => depositosMap.get(t.depositoDestinoId) || '-' },
      { header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (t) => t.quantidadeLitros,
        footerValue: (items) => (items as TransferenciaCombustivel[]).reduce((s, t) => s + t.quantidadeLitros, 0) },
      { header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (t) => t.valorTotal,
        footerValue: (items) => (items as TransferenciaCombustivel[]).reduce((s, t) => s + t.valorTotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (t) => t.observacoes || '-' },
    ],
    2,
    `TOTAL (${dados.length} ${dados.length === 1 ? 'registro' : 'registros'})`,
  );

  await saveWorkbook(wb, makeFilename('transferencias-combustivel', 'xlsx'));
}

// =============================================================================
// Relatório Completo de Combustível
// =============================================================================

export async function exportarRelatorioCompletoCombustivelExcel(
  abastecimentos: Abastecimento[],
  entradas: EntradaCombustivel[],
  transferencias: TransferenciaCombustivel[],
  obras: Obra[],
  depositos: Deposito[],
  lookups: { insumos: Insumo[]; equipamentos: Equipamento[]; etapas: EtapaObra[]; fornecedores: Fornecedor[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): Promise<void> {
  let saidasDados = [...abastecimentos];
  let entradasDados = [...entradas];
  let transferenciasDados = [...transferencias];

  if (filtroObraIds && filtroObraIds.length > 0) {
    const set = new Set(filtroObraIds);
    saidasDados = saidasDados.filter((a) => set.has(a.obraId));
    entradasDados = entradasDados.filter((e) => set.has(e.obraId));
    // Tanques globais (Fase 6) — transferências não têm obra. Sem filtro aqui.
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    saidasDados = saidasDados.filter((a) => set.has(a.depositoId));
    entradasDados = entradasDados.filter((e) => set.has(e.depositoId));
    transferenciasDados = transferenciasDados.filter((t) => set.has(t.depositoOrigemId) || set.has(t.depositoDestinoId));
  }

  saidasDados = saidasDados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
  entradasDados = entradasDados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
  transferenciasDados = transferenciasDados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const equipMap = new Map(lookups.equipamentos.map((e) => [e.id, e.nome]));
  const etapasMap = new Map(lookups.etapas.map((e) => [e.id, e.nome]));
  const fornecedoresMap = new Map(lookups.fornecedores.map((f) => [f.id, f.nome]));

  function formatarAlocacoes(alocacoes?: AlocacaoEtapa[], etapaId?: string): string {
    const alocs = alocacoes && alocacoes.length > 0 ? alocacoes : etapaId ? [{ etapaId, percentual: 100 }] : [];
    return alocs.map((a) => `${etapasMap.get(a.etapaId) || '?'}: ${a.percentual}%`).join(' | ') || '-';
  }

  const totalLitrosEntradas = entradasDados.reduce((s, e) => s + e.quantidadeLitros, 0);
  const totalValorEntradas = entradasDados.reduce((s, e) => s + e.valorTotal, 0);
  const totalLitrosSaidas = saidasDados.reduce((s, a) => s + a.quantidadeLitros, 0);
  const totalValorSaidas = saidasDados.reduce((s, a) => s + a.valorTotal, 0);
  const totalLitrosTransf = transferenciasDados.reduce((s, t) => s + t.quantidadeLitros, 0);
  const totalValorTransf = transferenciasDados.reduce((s, t) => s + t.valorTotal, 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestão de Obras';
  wb.created = new Date();
  wb.properties.date1904 = false;

  const wsResumo = wb.addWorksheet('Resumo', {
    properties: { tabColor: { argb: BRAND.verde } },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  wsResumo.columns = [
    { width: 24 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
  ];

  let row = renderExcelBanner(wsResumo, 'Relatório Completo de Combustível', SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Total Registros', value: entradasDados.length + saidasDados.length + transferenciasDados.length, numFmt: '0' },
    { label: 'Litros Entradas', value: totalLitrosEntradas, numFmt: '#,##0.00 "L"' },
    { label: 'Litros Saídas', value: totalLitrosSaidas, numFmt: '#,##0.00 "L"' },
    { label: 'Valor Entradas', value: totalValorEntradas, numFmt: '"R$" #,##0.00' },
  ]);

  row = renderExcelMiniTable(
    wsResumo, row, 'BALANÇO CONSOLIDADO',
    [
      { header: 'Operação', align: 'left' },
      { header: 'Registros', align: 'right', numFmt: '0' },
      { header: 'Litros', align: 'right', numFmt: '#,##0.00' },
      { header: 'Valor', align: 'right', numFmt: '"R$" #,##0.00' },
    ],
    [
      { cells: ['Entradas', entradasDados.length, totalLitrosEntradas, totalValorEntradas] },
      { cells: ['Saídas', saidasDados.length, totalLitrosSaidas, totalValorSaidas] },
      { cells: ['Transferências', transferenciasDados.length, totalLitrosTransf, totalValorTransf] },
    ],
    [
      'Total Geral',
      entradasDados.length + saidasDados.length + transferenciasDados.length,
      totalLitrosEntradas + totalLitrosSaidas + totalLitrosTransf,
      totalValorEntradas + totalValorSaidas + totalValorTransf,
    ],
  );

  // Helper to render a detail sheet
  async function addSheet(nome: string, tabColor: string): Promise<ExcelJS.Worksheet> {
    return wb.addWorksheet(nome, {
      properties: { tabColor: { argb: tabColor } },
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
    });
  }

  // ── Entradas ──
  const wsEntradas = await addSheet('Entradas', BRAND.verdeEscuro);
  renderExcelDetalhamento<EntradaCombustivel>(
    wsEntradas,
    entradasDados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (e) => formatDateTimeBR(e.dataHora) },
      { header: 'Obra', key: 'obra', width: 22, align: 'left', value: (e) => obrasMap.get(e.obraId) || '-' },
      { header: 'Tanque', key: 'tanque', width: 22, align: 'left', value: (e) => depositosMap.get(e.depositoId) || '-' },
      { header: 'Combustível', key: 'combustivel', width: 18, align: 'left', value: (e) => insumosMap.get(e.tipoCombustivel) || e.tipoCombustivel },
      { header: 'Fornecedor', key: 'fornecedor', width: 22, align: 'left', value: (e) => fornecedoresMap.get(e.fornecedor) || e.fornecedor || '-' },
      { header: 'Nota Fiscal', key: 'nf', width: 16, align: 'center', value: (e) => e.notaFiscal || '-' },
      { header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (e) => e.quantidadeLitros,
        footerValue: (items) => (items as EntradaCombustivel[]).reduce((s, e) => s + e.quantidadeLitros, 0) },
      { header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (e) => e.valorTotal,
        footerValue: (items) => (items as EntradaCombustivel[]).reduce((s, e) => s + e.valorTotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (e) => e.observacoes || '-' },
    ],
    2,
    `TOTAL (${entradasDados.length})`,
  );

  // ── Saídas ──
  const wsSaidas = await addSheet('Saídas', BRAND.verdeEscuro);
  renderExcelDetalhamento<Abastecimento>(
    wsSaidas,
    saidasDados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (a) => formatDateTimeBR(a.dataHora) },
      { header: 'Obra', key: 'obra', width: 22, align: 'left', value: (a) => obrasMap.get(a.obraId) || '-' },
      { header: 'Etapas', key: 'etapas', width: 28, align: 'left', value: (a) => formatarAlocacoes(a.alocacoes, a.etapaId) },
      { header: 'Tanque', key: 'tanque', width: 22, align: 'left', value: (a) => depositosMap.get(a.depositoId) || '-' },
      { header: 'Equipamento', key: 'equipamento', width: 24, align: 'left', value: (a) => equipMap.get(a.equipamentoId) || equipMap.get(a.veiculo) || a.veiculo || 'Sem equipamento atrelado' },
      { header: 'Combustível', key: 'combustivel', width: 18, align: 'left', value: (a) => insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel },
      { header: 'Origem', key: 'origem', width: 14, align: 'center',
        value: (a) => (a.origemCombustivel === 'dinheiro' ? 'Dinheiro' : a.origemCombustivel === 'requisicao' ? 'Requisição' : 'Tanque') },
      { header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (a) => a.quantidadeLitros,
        footerValue: (items) => (items as Abastecimento[]).reduce((s, a) => s + a.quantidadeLitros, 0) },
      { header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (a) => a.valorTotal,
        footerValue: (items) => (items as Abastecimento[]).reduce((s, a) => s + a.valorTotal, 0) },
      { header: 'Fornecedor', key: 'fornecedor', width: 20, align: 'left', value: (a) => a.fornecedor || '-' },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (a) => a.observacoes || '-' },
    ],
    2,
    `TOTAL (${saidasDados.length})`,
  );

  // ── Transferências ──
  const wsTransf = await addSheet('Transferências', BRAND.verdeEscuro);
  renderExcelDetalhamento<TransferenciaCombustivel>(
    wsTransf,
    transferenciasDados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (t) => formatDateTimeBR(t.dataHora) },
      { header: 'Origem', key: 'origem', width: 26, align: 'left', value: (t) => depositosMap.get(t.depositoOrigemId) || '-' },
      { header: 'Destino', key: 'destino', width: 26, align: 'left', value: (t) => depositosMap.get(t.depositoDestinoId) || '-' },
      { header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0.00',
        value: (t) => t.quantidadeLitros,
        footerValue: (items) => (items as TransferenciaCombustivel[]).reduce((s, t) => s + t.quantidadeLitros, 0) },
      { header: 'Valor Total', key: 'valor', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (t) => t.valorTotal,
        footerValue: (items) => (items as TransferenciaCombustivel[]).reduce((s, t) => s + t.valorTotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (t) => t.observacoes || '-' },
    ],
    2,
    `TOTAL (${transferenciasDados.length})`,
  );

  void fillSolid;
  void thinBorder;
  void renderExcelSectionTitle;

  await saveWorkbook(wb, makeFilename('combustivel-completo', 'xlsx'));
}
