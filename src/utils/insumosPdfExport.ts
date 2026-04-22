import jsPDF from 'jspdf';
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
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfMiniTable,
  fmtBRL,
  fmtNum,
  formatDateBR,
  makeFilename,
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
    list.push(['Obras', filtroObraIds.map((id) => obrasMap.get(id) || id).join(', ')]);
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    list.push(['Depósitos', filtroDepositoIds.map((id) => depositosMap.get(id) || id).join(', ')]);
  }
  if (dataInicio) list.push(['Data início', formatDateBR(dataInicio)]);
  if (dataFim) list.push(['Data fim', formatDateBR(dataFim)]);
  return list;
}

// =============================================================================
// Entradas de Material
// =============================================================================

export function exportarEntradasMaterialPDF(
  entradas: EntradaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
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

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, 'Relatório de Entradas de Material', SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(totalRegistros)],
    ['Quantidade', fmtNum(totalQuantidade)],
    ['Valor Total', fmtBRL(totalValor)],
    ['Fornecedores', String(new Set(dados.map((e) => e.fornecedorId)).size)],
  ], margin);

  type Ag = { chave: string; registros: number; quantidade: number; valor: number };
  function agrupar(keyFn: (e: EntradaMaterial) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((e) => {
      const k = keyFn(e);
      if (!k) return;
      const ex = map.get(k);
      if (ex) { ex.registros++; ex.quantidade += e.quantidade; ex.valor += e.valorTotal; }
      else map.set(k, { chave: labelFn(k), registros: 1, quantidade: e.quantidade, valor: e.valorTotal });
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Quantidade', 'Valor Total', '% Qtd', '% Valor'],
      sliced.map((r) => [
        r.chave,
        String(r.registros),
        fmtNum(r.quantidade),
        fmtBRL(r.valor),
        ((r.quantidade / totQtd) * 100).toFixed(1).replace('.', ',') + '%',
        ((r.valor / totVal) * 100).toFixed(1).replace('.', ',') + '%',
      ]),
      [
        'Total',
        String(sliced.reduce((s, r) => s + r.registros, 0)),
        fmtNum(sliced.reduce((s, r) => s + r.quantidade, 0)),
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
  mini('POR DEPÓSITO', 'Depósito', agrupar((e) => e.depositoMaterialId, (k) => depositosMap.get(k) || '—'));
  mini('POR MATERIAL (TOP 10)', 'Material', agrupar((e) => e.insumoId, (k) => insumosMap.get(k) || '—'), 10);
  mini('POR FORNECEDOR (TOP 10)', 'Fornecedor', agrupar((e) => e.fornecedorId, (k) => fornecedoresMap.get(k) || '—'), 10);

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Entradas', totalRegistros, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Data/Hora', 'Obra', 'Depósito', 'Material', 'Fornecedor', 'Quantidade', 'Valor Total', 'NF'],
    dados.map((e) => [
      formatDateTimeBR(e.dataHora),
      obrasMap.get(e.obraId) || '-',
      depositosMap.get(e.depositoMaterialId) || '-',
      insumosMap.get(e.insumoId) || '-',
      fornecedoresMap.get(e.fornecedorId) || '-',
      `${fmtNum(e.quantidade)} ${insumosUnidadeMap.get(e.insumoId) || ''}`.trim(),
      fmtBRL(e.valorTotal),
      e.notaFiscal || '-',
    ]),
    [
      '',
      `TOTAL (${dados.length})`,
      '', '', '',
      fmtNum(totalQuantidade),
      fmtBRL(totalValor),
      '',
    ],
    {
      0: { halign: 'center', cellWidth: 28 },
      1: { halign: 'left', cellWidth: 36 },
      2: { halign: 'left', cellWidth: 32 },
      3: { halign: 'left', cellWidth: 38 },
      4: { halign: 'left', cellWidth: 36 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 28 },
      7: { halign: 'center', cellWidth: 'auto' },
    },
    'Gestão de Obras • Entradas de Material',
    margin,
  );

  doc.save(makeFilename('entradas-material', 'pdf'));
}

// =============================================================================
// Saídas de Material
// =============================================================================

export function exportarSaidasMaterialPDF(
  saidas: SaidaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
  lookups: { insumos: Insumo[]; etapas: EtapaObra[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string,
): void {
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

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, 'Relatório de Saídas de Material', SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(totalRegistros)],
    ['Quantidade', fmtNum(totalQuantidade)],
    ['Valor Total', fmtBRL(totalValor)],
    ['Depósitos', String(new Set(dados.map((s) => s.depositoMaterialId)).size)],
  ], margin);

  type Ag = { chave: string; registros: number; quantidade: number; valor: number };
  function agrupar(keyFn: (s: SaidaMaterial) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((s) => {
      const k = keyFn(s);
      if (!k) return;
      const ex = map.get(k);
      if (ex) { ex.registros++; ex.quantidade += s.quantidade; ex.valor += s.valorTotal; }
      else map.set(k, { chave: labelFn(k), registros: 1, quantidade: s.quantidade, valor: s.valorTotal });
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Quantidade', 'Valor Total', '% Qtd', '% Valor'],
      sliced.map((r) => [
        r.chave,
        String(r.registros),
        fmtNum(r.quantidade),
        fmtBRL(r.valor),
        ((r.quantidade / totQtd) * 100).toFixed(1).replace('.', ',') + '%',
        ((r.valor / totVal) * 100).toFixed(1).replace('.', ',') + '%',
      ]),
      [
        'Total',
        String(sliced.reduce((s, r) => s + r.registros, 0)),
        fmtNum(sliced.reduce((s, r) => s + r.quantidade, 0)),
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

  mini('POR OBRA', 'Obra', agrupar((s) => s.obraId, (k) => obrasMap.get(k) || '—'));
  mini('POR DEPÓSITO', 'Depósito', agrupar((s) => s.depositoMaterialId, (k) => depositosMap.get(k) || '—'));
  mini('POR MATERIAL (TOP 10)', 'Material', agrupar((s) => s.insumoId, (k) => insumosMap.get(k) || '—'), 10);

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Saídas', totalRegistros, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Data/Hora', 'Obra', 'Depósito', 'Material', 'Quantidade', 'Etapas', 'Valor Total'],
    dados.map((s) => [
      formatDateTimeBR(s.dataHora),
      obrasMap.get(s.obraId) || '-',
      depositosMap.get(s.depositoMaterialId) || '-',
      insumosMap.get(s.insumoId) || '-',
      `${fmtNum(s.quantidade)} ${insumosUnidadeMap.get(s.insumoId) || ''}`.trim(),
      formatarAlocacoes(s.alocacoes),
      fmtBRL(s.valorTotal),
    ]),
    [
      '',
      `TOTAL (${dados.length})`,
      '', '',
      fmtNum(totalQuantidade),
      '',
      fmtBRL(totalValor),
    ],
    {
      0: { halign: 'center', cellWidth: 28 },
      1: { halign: 'left', cellWidth: 36 },
      2: { halign: 'left', cellWidth: 32 },
      3: { halign: 'left', cellWidth: 38 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'left', cellWidth: 'auto' },
      6: { halign: 'right', cellWidth: 30 },
    },
    'Gestão de Obras • Saídas de Material',
    margin,
  );

  doc.save(makeFilename('saidas-material', 'pdf'));
}

// =============================================================================
// Transferências de Material
// =============================================================================

export function exportarTransferenciasMaterialPDF(
  transferencias: TransferenciaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
  lookups: { insumos: Insumo[] },
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

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));

  const totalRegistros = dados.length;
  const totalQuantidade = dados.reduce((s, t) => s + t.quantidade, 0);
  const totalValor = dados.reduce((s, t) => s + t.valorTotal, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  let y = drawPdfBanner(doc, 'Relatório de Transferências de Material', SUBTITULO, margin);
  y = drawPdfFiltros(doc, y, buildFiltrosList(filtroObraIds, filtroDepositoIds, dataInicio, dataFim, obrasMap, depositosMap), margin);
  y = drawPdfKPIs(doc, y, [
    ['Registros', String(totalRegistros)],
    ['Quantidade', fmtNum(totalQuantidade)],
    ['Valor Total', fmtBRL(totalValor)],
    ['Depósitos', String(new Set(dados.flatMap((t) => [t.depositoOrigemId, t.depositoDestinoId])).size)],
  ], margin);

  type Ag = { chave: string; registros: number; quantidade: number; valor: number };
  function agrupar(keyFn: (t: TransferenciaMaterial) => string, labelFn: (k: string) => string): Ag[] {
    const map = new Map<string, Ag>();
    dados.forEach((t) => {
      const k = keyFn(t);
      if (!k) return;
      const ex = map.get(k);
      if (ex) { ex.registros++; ex.quantidade += t.quantidade; ex.valor += t.valorTotal; }
      else map.set(k, { chave: labelFn(k), registros: 1, quantidade: t.quantidade, valor: t.valorTotal });
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }

  function mini(titulo: string, headerLabel: string, ags: Ag[], limit?: number) {
    const sliced = limit ? ags.slice(0, limit) : ags;
    const totVal = ags.reduce((s, r) => s + r.valor, 0) || 1;
    const totQtd = ags.reduce((s, r) => s + r.quantidade, 0) || 1;
    y = drawPdfMiniTable(
      doc, y, titulo,
      [headerLabel, 'Registros', 'Quantidade', 'Valor Total', '% Qtd', '% Valor'],
      sliced.map((r) => [
        r.chave,
        String(r.registros),
        fmtNum(r.quantidade),
        fmtBRL(r.valor),
        ((r.quantidade / totQtd) * 100).toFixed(1).replace('.', ',') + '%',
        ((r.valor / totVal) * 100).toFixed(1).replace('.', ',') + '%',
      ]),
      [
        'Total',
        String(sliced.reduce((s, r) => s + r.registros, 0)),
        fmtNum(sliced.reduce((s, r) => s + r.quantidade, 0)),
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

  mini('POR MATERIAL (TOP 10)', 'Material', agrupar((t) => t.insumoId, (k) => insumosMap.get(k) || '—'), 10);
  mini('POR ORIGEM', 'Origem', agrupar((t) => t.depositoOrigemId, (k) => depositosMap.get(k) || '—'));
  mini('POR DESTINO', 'Destino', agrupar((t) => t.depositoDestinoId, (k) => depositosMap.get(k) || '—'));

  doc.addPage();
  const detailY = drawPdfDetailPageHeader(doc, 'Detalhamento — Transferências', totalRegistros, margin);

  drawPdfDetailTable(
    doc, detailY,
    ['Data/Hora', 'Material', 'Origem', 'Destino', 'Quantidade', 'Valor Total'],
    dados.map((t) => [
      formatDateTimeBR(t.dataHora),
      insumosMap.get(t.insumoId) || '-',
      depositosMap.get(t.depositoOrigemId) || '-',
      depositosMap.get(t.depositoDestinoId) || '-',
      `${fmtNum(t.quantidade)} ${insumosUnidadeMap.get(t.insumoId) || ''}`.trim(),
      fmtBRL(t.valorTotal),
    ]),
    [
      '',
      `TOTAL (${dados.length})`,
      '', '',
      fmtNum(totalQuantidade),
      fmtBRL(totalValor),
    ],
    {
      0: { halign: 'center', cellWidth: 32 },
      1: { halign: 'left', cellWidth: 44 },
      2: { halign: 'left', cellWidth: 40 },
      3: { halign: 'left', cellWidth: 40 },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'right', cellWidth: 'auto' },
    },
    'Gestão de Obras • Transferências de Material',
    margin,
  );

  doc.save(makeFilename('transferencias-material', 'pdf'));
}
