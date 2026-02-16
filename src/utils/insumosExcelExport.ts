import * as XLSX from 'xlsx';
import type { AlocacaoEtapa, DepositoMaterial, EntradaMaterial, EtapaObra, Fornecedor, Insumo, Obra, SaidaMaterial, TransferenciaMaterial } from '../types';
import { formatDateTime } from './formatters';

function salvarExcel(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function addResumoSheet(
  wb: XLSX.WorkBook,
  titulo: string,
  subtitulo: string,
  periodo: string,
  totalRegistros: number,
  totalValor: number
) {
  const dados = [
    [titulo],
    [subtitulo],
    ...(periodo ? [[periodo]] : []),
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total de registros', totalRegistros],
    ['Valor total (R$)', totalValor],
  ];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
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

function formatarPeriodo(dataInicio?: string, dataFim?: string): string {
  if (!dataInicio && !dataFim) return '';
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  if (dataInicio && dataFim) return `Periodo: ${fmt(dataInicio)} a ${fmt(dataFim)}`;
  if (dataInicio) return `A partir de: ${fmt(dataInicio)}`;
  return `Ate: ${fmt(dataFim!)}`;
}

export function exportarEntradasMaterialExcel(
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

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const fornecedoresMap = new Map(lookups.fornecedores.map((f) => [f.id, f.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const totalValor = dados.reduce((sum, e) => sum + e.valorTotal, 0);

  const wb = XLSX.utils.book_new();
  addResumoSheet(wb, 'Relatorio de Entradas de Material', subtitulo, periodo, dados.length, totalValor);

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((e) => ({
      'Data/Hora': formatDateTime(e.dataHora),
      'Obra': obrasMap.get(e.obraId) || '-',
      'Deposito': depositosMap.get(e.depositoMaterialId) || '-',
      'Material': insumosMap.get(e.insumoId) || '-',
      'Fornecedor': fornecedoresMap.get(e.fornecedorId) || '-',
      'Quantidade': e.quantidade,
      'Unidade': insumosUnidadeMap.get(e.insumoId) || '-',
      'Valor (R$)': e.valorTotal,
      'Nota Fiscal': e.notaFiscal || '-',
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Entradas');

  salvarExcel(wb, 'relatorio-entradas-material.xlsx');
}

export function exportarSaidasMaterialExcel(
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

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const etapasMap = new Map(lookups.etapas.map((e) => [e.id, e.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));

  function formatarAlocacoes(alocacoes: AlocacaoEtapa[]): string {
    return alocacoes
      .map((a) => `${etapasMap.get(a.etapaId) || '?'}: ${a.percentual}%`)
      .join(' | ') || '-';
  }

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const totalValor = dados.reduce((sum, s) => sum + s.valorTotal, 0);

  const wb = XLSX.utils.book_new();
  addResumoSheet(wb, 'Relatorio de Saidas de Material', subtitulo, periodo, dados.length, totalValor);

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((s) => ({
      'Data/Hora': formatDateTime(s.dataHora),
      'Obra': obrasMap.get(s.obraId) || '-',
      'Deposito': depositosMap.get(s.depositoMaterialId) || '-',
      'Material': insumosMap.get(s.insumoId) || '-',
      'Quantidade': s.quantidade,
      'Unidade': insumosUnidadeMap.get(s.insumoId) || '-',
      'Etapas': formatarAlocacoes(s.alocacoes),
      'Valor (R$)': s.valorTotal,
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Saidas');

  salvarExcel(wb, 'relatorio-saidas-material.xlsx');
}

export function exportarTransferenciasMaterialExcel(
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

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const insumosUnidadeMap = new Map(lookups.insumos.map((i) => [i.id, i.unidade]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const totalValor = dados.reduce((sum, t) => sum + t.valorTotal, 0);

  const wb = XLSX.utils.book_new();
  addResumoSheet(wb, 'Relatorio de Transferencias de Material', subtitulo, periodo, dados.length, totalValor);

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((t) => ({
      'Data/Hora': formatDateTime(t.dataHora),
      'Material': insumosMap.get(t.insumoId) || '-',
      'Origem': depositosMap.get(t.depositoOrigemId) || '-',
      'Destino': depositosMap.get(t.depositoDestinoId) || '-',
      'Quantidade': t.quantidade,
      'Unidade': insumosUnidadeMap.get(t.insumoId) || '-',
      'Valor (R$)': t.valorTotal,
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Transferencias');

  salvarExcel(wb, 'relatorio-transferencias-material.xlsx');
}
