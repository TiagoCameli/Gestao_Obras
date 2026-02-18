import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AlocacaoEtapa, DepositoMaterial, EntradaMaterial, EtapaObra, Fornecedor, Insumo, Obra, SaidaMaterial, TransferenciaMaterial } from '../types';
import { formatCurrency, formatDateTime } from './formatters';

function formatarPeriodo(dataInicio?: string, dataFim?: string): string {
  if (!dataInicio && !dataFim) return '';
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  if (dataInicio && dataFim) return `Periodo: ${fmt(dataInicio)} a ${fmt(dataFim)}`;
  if (dataInicio) return `A partir de: ${fmt(dataInicio)}`;
  return `Ate: ${fmt(dataFim!)}`;
}

function formatarSubtituloFiltro(
  obraIds: string[],
  depositoIds: string[],
  obrasMap: Map<string, string>,
  depositosMap: Map<string, string>
): string {
  if (obraIds.length > 0) {
    const nomes = obraIds.map((id) => obrasMap.get(id) || id);
    return `Obras: ${nomes.join(', ')}`;
  }
  if (depositoIds.length > 0) {
    const nomes = depositoIds.map((id) => depositosMap.get(id) || id);
    return `Depositos: ${nomes.join(', ')}`;
  }
  return 'Todas as obras e depositos';
}

export function exportarEntradasMaterialPDF(
  entradas: EntradaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
  lookups: { insumos: Insumo[]; fornecedores: Fornecedor[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string
) {
  let dados = [...entradas];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const set = new Set(filtroObraIds);
    dados = dados.filter((e) => set.has(e.obraId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((e) => set.has(e.depositoMaterialId));
  }

  const doc = new jsPDF();
  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const fornecedoresMap = new Map(lookups.fornecedores.map((f) => [f.id, f.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);

  doc.setFontSize(18);
  doc.text('Relatório de Entradas de Material', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  doc.text(subtitulo, 14, y); y += 6;
  if (periodo) { doc.text(periodo, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de registros: ${dados.length}`, 14, y); y += 6;

  const totalValor = dados.reduce((sum, e) => sum + e.valorTotal, 0);
  doc.text(`Valor total: ${formatCurrency(totalValor)}`, 14, y); y += 6;

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((e) => {
      const unidade = insumosUnidadeMap.get(e.insumoId) || '';
      return [
        formatDateTime(e.dataHora),
        obrasMap.get(e.obraId) || '-',
        depositosMap.get(e.depositoMaterialId) || '-',
        insumosMap.get(e.insumoId) || '-',
        fornecedoresMap.get(e.fornecedorId) || '-',
        `${e.quantidade} ${unidade}`,
        formatCurrency(e.valorTotal),
        e.notaFiscal || '-',
      ];
    });

  autoTable(doc, {
    startY: y + 2,
    head: [['Data/Hora', 'Obra', 'Deposito', 'Material', 'Fornecedor', 'Quantidade', 'Valor', 'NF']],
    body: rows,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save('relatorio-entradas-material.pdf');
}

export function exportarSaidasMaterialPDF(
  saidas: SaidaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
  lookups: { insumos: Insumo[]; etapas: EtapaObra[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string
) {
  let dados = [...saidas];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const set = new Set(filtroObraIds);
    dados = dados.filter((s) => set.has(s.obraId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((s) => set.has(s.depositoMaterialId));
  }

  const doc = new jsPDF();
  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const etapasMap = new Map(lookups.etapas.map((e) => [e.id, e.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);

  function formatarAlocacoes(alocacoes: AlocacaoEtapa[]): string {
    return alocacoes
      .map((a) => `${etapasMap.get(a.etapaId) || '?'}: ${a.percentual}%`)
      .join(' | ') || '-';
  }

  doc.setFontSize(18);
  doc.text('Relatório de Saídas de Material', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  doc.text(subtitulo, 14, y); y += 6;
  if (periodo) { doc.text(periodo, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de registros: ${dados.length}`, 14, y); y += 6;

  const totalValor = dados.reduce((sum, s) => sum + s.valorTotal, 0);
  doc.text(`Valor total: ${formatCurrency(totalValor)}`, 14, y); y += 6;

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((s) => {
      const unidade = insumosUnidadeMap.get(s.insumoId) || '';
      return [
        formatDateTime(s.dataHora),
        obrasMap.get(s.obraId) || '-',
        depositosMap.get(s.depositoMaterialId) || '-',
        insumosMap.get(s.insumoId) || '-',
        `${s.quantidade} ${unidade}`,
        formatarAlocacoes(s.alocacoes),
        formatCurrency(s.valorTotal),
      ];
    });

  autoTable(doc, {
    startY: y + 2,
    head: [['Data/Hora', 'Obra', 'Deposito', 'Material', 'Quantidade', 'Etapas', 'Valor']],
    body: rows,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save('relatorio-saidas-material.pdf');
}

export function exportarTransferenciasMaterialPDF(
  transferencias: TransferenciaMaterial[],
  obras: Obra[],
  depositos: DepositoMaterial[],
  lookups: { insumos: Insumo[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string
) {
  let dados = [...transferencias];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const depositosDasObras = new Set(
      depositos.filter((d) => filtroObraIds.includes(d.obraId)).map((d) => d.id)
    );
    dados = dados.filter((t) => depositosDasObras.has(t.depositoOrigemId) || depositosDasObras.has(t.depositoDestinoId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((t) => set.has(t.depositoOrigemId) || set.has(t.depositoDestinoId));
  }

  const doc = new jsPDF();
  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);

  doc.setFontSize(18);
  doc.text('Relatório de Transferências de Material', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  doc.text(subtitulo, 14, y); y += 6;
  if (periodo) { doc.text(periodo, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de registros: ${dados.length}`, 14, y); y += 6;

  const totalValor = dados.reduce((sum, t) => sum + t.valorTotal, 0);
  doc.text(`Valor total: ${formatCurrency(totalValor)}`, 14, y); y += 6;

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((t) => {
      const unidade = insumosUnidadeMap.get(t.insumoId) || '';
      return [
        formatDateTime(t.dataHora),
        insumosMap.get(t.insumoId) || '-',
        depositosMap.get(t.depositoOrigemId) || '-',
        depositosMap.get(t.depositoDestinoId) || '-',
        `${t.quantidade} ${unidade}`,
        formatCurrency(t.valorTotal),
      ];
    });

  autoTable(doc, {
    startY: y + 2,
    head: [['Data/Hora', 'Material', 'Origem', 'Destino', 'Quantidade', 'Valor']],
    body: rows,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save('relatorio-transferencias-material.pdf');
}
