import type {
  AlocacaoEtapa,
  DepositoMaterial,
  EntradaMaterial,
  EtapaObra,
  Fornecedor,
  Insumo,
  Obra,
  SaidaMaterial,
  TransferenciaMaterial,
} from '../types';
import {
  createWorkbook,
  formatDateBR,
  makeFilename,
  renderExcelBanner,
  renderExcelDetalhamento,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelMiniTable,
  saveWorkbook,
} from './exportTemplate';

const SUBTITULO = 'Módulo de Insumos • Gestão de Obras';

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
    const nomes = filtroObraIds.map((id) => obrasMap.get(id) || id);
    list.push(['Obras', nomes.join(', ')]);
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const nomes = filtroDepositoIds.map((id) => depositosMap.get(id) || id);
    list.push(['Depósitos', nomes.join(', ')]);
  }
  if (dataInicio) list.push(['Data início', formatDateBR(dataInicio)]);
  if (dataFim) list.push(['Data fim', formatDateBR(dataFim)]);
  return list;
}

// =============================================================================
// Entradas de Material
// =============================================================================

export async function exportarEntradasMaterialExcel(
  entradas: EntradaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
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
    dados = dados.filter((e) => set.has(e.depositoMaterialId));
  }
  dados = dados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const fornecedoresMap = new Map(lookups.fornecedores.map((f) => [f.id, f.nome]));

  const totalRegistros = dados.length;
  const totalQuantidade = dados.reduce((s, e) => s + e.quantidade, 0);
  const totalValor = dados.reduce((s, e) => s + e.valorTotal, 0);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, 'Relatório de Entradas de Material', SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: totalRegistros, numFmt: '0' },
    { label: 'Quantidade Total', value: totalQuantidade, numFmt: '#,##0.00' },
    { label: 'Valor Total', value: totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'Fornecedores', value: new Set(dados.map((e) => e.fornecedorId)).size, numFmt: '0' },
  ]);

  type Ag = { chave: string; registros: number; quantidade: number; valor: number };
  function agrupar(keyFn: (e: EntradaMaterial) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((e) => {
      const k = keyFn(e);
      if (!k) return;
      const ex = map.get(k);
      if (ex) {
        ex.registros++;
        ex.quantidade += e.quantidade;
        ex.valor += e.valorTotal;
      } else {
        map.set(k, { chave: labelFn(k), registros: 1, quantidade: e.quantidade, valor: e.valorTotal });
      }
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    const rowsMini = sliced.map((r) => ({
      cells: [r.chave, r.registros, r.quantidade, r.valor, r.quantidade / totQtd, r.valor / totVal] as (string | number)[],
    }));
    row = renderExcelMiniTable(
      wsResumo, row, titulo,
      [
        { header: headerLabel, align: 'left' },
        { header: 'Registros', align: 'right', numFmt: '0' },
        { header: 'Quantidade', align: 'right', numFmt: '#,##0.00' },
        { header: 'Valor Total', align: 'right', numFmt: '"R$" #,##0.00' },
        { header: '% Qtd', align: 'right', numFmt: '0.0%' },
        { header: '% Valor', align: 'right', numFmt: '0.0%' },
      ],
      rowsMini,
      [
        'Total',
        sliced.reduce((s, r) => s + r.registros, 0),
        sliced.reduce((s, r) => s + r.quantidade, 0),
        sliced.reduce((s, r) => s + r.valor, 0),
        '', '',
      ],
    );
  }

  mini('POR OBRA', 'Obra', agrupar((e) => e.obraId, (k) => obrasMap.get(k) || '—'));
  mini('POR DEPÓSITO', 'Depósito', agrupar((e) => e.depositoMaterialId, (k) => depositosMap.get(k) || '—'));
  mini('POR MATERIAL (TOP 10)', 'Material', agrupar((e) => e.insumoId, (k) => insumosMap.get(k) || '—'), 10);
  mini('POR FORNECEDOR (TOP 10)', 'Fornecedor', agrupar((e) => e.fornecedorId, (k) => fornecedoresMap.get(k) || '—'), 10);

  renderExcelDetalhamento<EntradaMaterial>(
    wsDetalhe,
    dados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (e) => formatDateTimeBR(e.dataHora) },
      { header: 'Obra', key: 'obra', width: 22, align: 'left', value: (e) => obrasMap.get(e.obraId) || '-' },
      { header: 'Depósito', key: 'deposito', width: 22, align: 'left', value: (e) => depositosMap.get(e.depositoMaterialId) || '-' },
      { header: 'Material', key: 'material', width: 24, align: 'left', value: (e) => insumosMap.get(e.insumoId) || '-' },
      { header: 'Fornecedor', key: 'fornecedor', width: 24, align: 'left', value: (e) => fornecedoresMap.get(e.fornecedorId) || '-' },
      { header: 'Quantidade', key: 'quantidade', width: 14, align: 'right', numFmt: '#,##0.00',
        value: (e) => e.quantidade,
        footerValue: (items) => (items as EntradaMaterial[]).reduce((s, e) => s + e.quantidade, 0) },
      { header: 'Unidade', key: 'unidade', width: 10, align: 'center', value: (e) => insumosUnidadeMap.get(e.insumoId) || '-' },
      { header: 'Valor Total', key: 'valorTotal', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (e) => e.valorTotal,
        footerValue: (items) => (items as EntradaMaterial[]).reduce((s, e) => s + e.valorTotal, 0) },
      { header: 'Nota Fiscal', key: 'nf', width: 16, align: 'center', value: (e) => e.notaFiscal || '-' },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (e) => e.observacoes || '-' },
    ],
    2,
    `TOTAL (${dados.length} ${dados.length === 1 ? 'registro' : 'registros'})`,
  );

  await saveWorkbook(wb, makeFilename('entradas-material', 'xlsx'));
}

// =============================================================================
// Saídas de Material
// =============================================================================

export async function exportarSaidasMaterialExcel(
  saidas: SaidaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
  lookups: { insumos: Insumo[]; etapas: EtapaObra[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): Promise<void> {
  let dados = [...saidas];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const set = new Set(filtroObraIds);
    dados = dados.filter((s) => set.has(s.obraId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((s) => set.has(s.depositoMaterialId));
  }
  dados = dados.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const etapasMap = new Map(lookups.etapas.map((e) => [e.id, e.nome]));

  function formatarAlocacoes(alocacoes: AlocacaoEtapa[]): string {
    return alocacoes
      .map((a) => `${etapasMap.get(a.etapaId) || '?'}: ${a.percentual}%`)
      .join(' | ') || '-';
  }

  const totalRegistros = dados.length;
  const totalQuantidade = dados.reduce((s, x) => s + x.quantidade, 0);
  const totalValor = dados.reduce((s, x) => s + x.valorTotal, 0);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, 'Relatório de Saídas de Material', SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: totalRegistros, numFmt: '0' },
    { label: 'Quantidade Total', value: totalQuantidade, numFmt: '#,##0.00' },
    { label: 'Valor Total', value: totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'Depósitos', value: new Set(dados.map((s) => s.depositoMaterialId)).size, numFmt: '0' },
  ]);

  type Ag = { chave: string; registros: number; quantidade: number; valor: number };
  function agrupar(keyFn: (s: SaidaMaterial) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((s) => {
      const k = keyFn(s);
      if (!k) return;
      const ex = map.get(k);
      if (ex) {
        ex.registros++;
        ex.quantidade += s.quantidade;
        ex.valor += s.valorTotal;
      } else {
        map.set(k, { chave: labelFn(k), registros: 1, quantidade: s.quantidade, valor: s.valorTotal });
      }
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    row = renderExcelMiniTable(
      wsResumo, row, titulo,
      [
        { header: headerLabel, align: 'left' },
        { header: 'Registros', align: 'right', numFmt: '0' },
        { header: 'Quantidade', align: 'right', numFmt: '#,##0.00' },
        { header: 'Valor Total', align: 'right', numFmt: '"R$" #,##0.00' },
        { header: '% Qtd', align: 'right', numFmt: '0.0%' },
        { header: '% Valor', align: 'right', numFmt: '0.0%' },
      ],
      sliced.map((r) => ({ cells: [r.chave, r.registros, r.quantidade, r.valor, r.quantidade / totQtd, r.valor / totVal] })),
      [
        'Total',
        sliced.reduce((s, r) => s + r.registros, 0),
        sliced.reduce((s, r) => s + r.quantidade, 0),
        sliced.reduce((s, r) => s + r.valor, 0),
        '', '',
      ],
    );
  }

  mini('POR OBRA', 'Obra', agrupar((s) => s.obraId, (k) => obrasMap.get(k) || '—'));
  mini('POR DEPÓSITO', 'Depósito', agrupar((s) => s.depositoMaterialId, (k) => depositosMap.get(k) || '—'));
  mini('POR MATERIAL (TOP 10)', 'Material', agrupar((s) => s.insumoId, (k) => insumosMap.get(k) || '—'), 10);

  renderExcelDetalhamento<SaidaMaterial>(
    wsDetalhe,
    dados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (s) => formatDateTimeBR(s.dataHora) },
      { header: 'Obra', key: 'obra', width: 22, align: 'left', value: (s) => obrasMap.get(s.obraId) || '-' },
      { header: 'Depósito', key: 'deposito', width: 22, align: 'left', value: (s) => depositosMap.get(s.depositoMaterialId) || '-' },
      { header: 'Material', key: 'material', width: 24, align: 'left', value: (s) => insumosMap.get(s.insumoId) || '-' },
      { header: 'Quantidade', key: 'quantidade', width: 14, align: 'right', numFmt: '#,##0.00',
        value: (s) => s.quantidade,
        footerValue: (items) => (items as SaidaMaterial[]).reduce((sum, s) => sum + s.quantidade, 0) },
      { header: 'Unidade', key: 'unidade', width: 10, align: 'center', value: (s) => insumosUnidadeMap.get(s.insumoId) || '-' },
      { header: 'Etapas', key: 'etapas', width: 32, align: 'left', value: (s) => formatarAlocacoes(s.alocacoes) },
      { header: 'Valor Total', key: 'valorTotal', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (s) => s.valorTotal,
        footerValue: (items) => (items as SaidaMaterial[]).reduce((sum, s) => sum + s.valorTotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (s) => s.observacoes || '-' },
    ],
    2,
    `TOTAL (${dados.length} ${dados.length === 1 ? 'registro' : 'registros'})`,
  );

  await saveWorkbook(wb, makeFilename('saidas-material', 'xlsx'));
}

// =============================================================================
// Transferências de Material
// =============================================================================

export async function exportarTransferenciasMaterialExcel(
  transferencias: TransferenciaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
  lookups: { insumos: Insumo[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): Promise<void> {
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

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));

  const totalRegistros = dados.length;
  const totalQuantidade = dados.reduce((s, t) => s + t.quantidade, 0);
  const totalValor = dados.reduce((s, t) => s + t.valorTotal, 0);

  const { wb, wsResumo, wsDetalhe } = createWorkbook();

  let row = renderExcelBanner(wsResumo, 'Relatório de Transferências de Material', SUBTITULO);
  row = renderExcelFiltros(wsResumo, row, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap));
  row++;
  row = renderExcelKPIs(wsResumo, row, [
    { label: 'Registros', value: totalRegistros, numFmt: '0' },
    { label: 'Quantidade Total', value: totalQuantidade, numFmt: '#,##0.00' },
    { label: 'Valor Total', value: totalValor, numFmt: '"R$" #,##0.00' },
    { label: 'Depósitos', value: new Set(dados.flatMap((t) => [t.depositoOrigemId, t.depositoDestinoId])).size, numFmt: '0' },
  ]);

  type Ag = { chave: string; registros: number; quantidade: number; valor: number };
  function agrupar(keyFn: (t: TransferenciaMaterial) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((t) => {
      const k = keyFn(t);
      if (!k) return;
      const ex = map.get(k);
      if (ex) {
        ex.registros++;
        ex.quantidade += t.quantidade;
        ex.valor += t.valorTotal;
      } else {
        map.set(k, { chave: labelFn(k), registros: 1, quantidade: t.quantidade, valor: t.valorTotal });
      }
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    row = renderExcelMiniTable(
      wsResumo, row, titulo,
      [
        { header: headerLabel, align: 'left' },
        { header: 'Registros', align: 'right', numFmt: '0' },
        { header: 'Quantidade', align: 'right', numFmt: '#,##0.00' },
        { header: 'Valor Total', align: 'right', numFmt: '"R$" #,##0.00' },
        { header: '% Qtd', align: 'right', numFmt: '0.0%' },
        { header: '% Valor', align: 'right', numFmt: '0.0%' },
      ],
      sliced.map((r) => ({ cells: [r.chave, r.registros, r.quantidade, r.valor, r.quantidade / totQtd, r.valor / totVal] })),
      [
        'Total',
        sliced.reduce((s, r) => s + r.registros, 0),
        sliced.reduce((s, r) => s + r.quantidade, 0),
        sliced.reduce((s, r) => s + r.valor, 0),
        '', '',
      ],
    );
  }

  mini('POR MATERIAL (TOP 10)', 'Material', agrupar((t) => t.insumoId, (k) => insumosMap.get(k) || '—'), 10);
  mini('POR ORIGEM', 'Origem', agrupar((t) => t.depositoOrigemId, (k) => depositosMap.get(k) || '—'));
  mini('POR DESTINO', 'Destino', agrupar((t) => t.depositoDestinoId, (k) => depositosMap.get(k) || '—'));

  renderExcelDetalhamento<TransferenciaMaterial>(
    wsDetalhe,
    dados,
    [
      { header: 'Data/Hora', key: 'dataHora', width: 18, align: 'center', value: (t) => formatDateTimeBR(t.dataHora) },
      { header: 'Material', key: 'material', width: 24, align: 'left', value: (t) => insumosMap.get(t.insumoId) || '-' },
      { header: 'Origem', key: 'origem', width: 24, align: 'left', value: (t) => depositosMap.get(t.depositoOrigemId) || '-' },
      { header: 'Destino', key: 'destino', width: 24, align: 'left', value: (t) => depositosMap.get(t.depositoDestinoId) || '-' },
      { header: 'Quantidade', key: 'quantidade', width: 14, align: 'right', numFmt: '#,##0.00',
        value: (t) => t.quantidade,
        footerValue: (items) => (items as TransferenciaMaterial[]).reduce((s, t) => s + t.quantidade, 0) },
      { header: 'Unidade', key: 'unidade', width: 10, align: 'center', value: (t) => insumosUnidadeMap.get(t.insumoId) || '-' },
      { header: 'Valor Total', key: 'valorTotal', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
        emphasizeValue: true,
        value: (t) => t.valorTotal,
        footerValue: (items) => (items as TransferenciaMaterial[]).reduce((s, t) => s + t.valorTotal, 0) },
      { header: 'Observações', key: 'observacoes', width: 30, align: 'left', value: (t) => t.observacoes || '-' },
    ],
    2,
    `TOTAL (${dados.length} ${dados.length === 1 ? 'registro' : 'registros'})`,
  );

  await saveWorkbook(wb, makeFilename('transferencias-material', 'xlsx'));
}
