import * as XLSX from 'xlsx';
import type { Abastecimento, AlocacaoEtapa, Deposito, EntradaCombustivel, Equipamento, EtapaObra, Fornecedor, Insumo, Obra, TransferenciaCombustivel } from '../types';
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
  totalLitros: number,
  totalValor: number
) {
  const dados = [
    [titulo],
    [subtitulo],
    ...(periodo ? [[periodo]] : []),
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total de registros', totalRegistros],
    ['Total litros', totalLitros],
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
    return `Tanques: ${nomes.join(', ')}`;
  }
  return 'Todas as obras e tanques';
}

function formatarPeriodo(dataInicio?: string, dataFim?: string): string {
  if (!dataInicio && !dataFim) return '';
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  if (dataInicio && dataFim) return `Periodo: ${fmt(dataInicio)} a ${fmt(dataFim)}`;
  if (dataInicio) return `A partir de: ${fmt(dataInicio)}`;
  return `Ate: ${fmt(dataFim!)}`;
}

export function exportarSaidasExcel(
  abastecimentos: Abastecimento[],
  obras: Obra[],
  depositos: Deposito[],
  lookups: { insumos: Insumo[]; equipamentos: Equipamento[]; etapas: EtapaObra[] },
  filtroObraIds?: string[],
  filtroDepositoIds?: string[],
  dataInicio?: string,
  dataFim?: string
) {
  let dados = [...abastecimentos];
  if (filtroObraIds && filtroObraIds.length > 0) {
    const set = new Set(filtroObraIds);
    dados = dados.filter((a) => set.has(a.obraId));
  }
  if (filtroDepositoIds && filtroDepositoIds.length > 0) {
    const set = new Set(filtroDepositoIds);
    dados = dados.filter((a) => set.has(a.depositoId));
  }

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const equipMap = new Map(lookups.equipamentos.map((e) => [e.id, e.nome]));
  const etapasMap = new Map(lookups.etapas.map((e) => [e.id, e.nome]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const totalLitros = dados.reduce((sum, a) => sum + a.quantidadeLitros, 0);
  const totalValor = dados.reduce((sum, a) => sum + a.valorTotal, 0);

  const wb = XLSX.utils.book_new();

  addResumoSheet(wb, 'Relatorio de Saidas de Combustivel', subtitulo, periodo, dados.length, totalLitros, totalValor);

  function formatarAlocacoes(alocacoes?: AlocacaoEtapa[], etapaId?: string): string {
    const alocs = alocacoes && alocacoes.length > 0
      ? alocacoes
      : etapaId ? [{ etapaId, percentual: 100 }] : [];
    return alocs
      .map((a) => `${etapasMap.get(a.etapaId) || '?'}: ${a.percentual}%`)
      .join(' | ') || '-';
  }

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((a) => ({
      'Data/Hora': formatDateTime(a.dataHora),
      'Obra': obrasMap.get(a.obraId) || '-',
      'Etapas': formatarAlocacoes(a.alocacoes, a.etapaId),
      'Tanque': depositosMap.get(a.depositoId) || '-',
      'Equipamento': equipMap.get(a.veiculo) || a.veiculo || '-',
      'Combustivel': insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel,
      'Litros': a.quantidadeLitros,
      'Valor (R$)': a.valorTotal,
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Saidas');

  salvarExcel(wb, 'relatorio-saidas-combustivel.xlsx');
}

export function exportarEntradasExcel(
  entradas: EntradaCombustivel[],
  obras: Obra[],
  depositos: Deposito[],
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
    dados = dados.filter((e) => set.has(e.depositoId));
  }

  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const fornecedoresMap = new Map(lookups.fornecedores.map((f) => [f.id, f.nome]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const totalLitros = dados.reduce((sum, e) => sum + e.quantidadeLitros, 0);
  const totalValor = dados.reduce((sum, e) => sum + e.valorTotal, 0);

  const wb = XLSX.utils.book_new();

  addResumoSheet(wb, 'Relatorio de Entradas de Combustivel', subtitulo, periodo, dados.length, totalLitros, totalValor);

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((e) => ({
      'Data/Hora': formatDateTime(e.dataHora),
      'Obra': obrasMap.get(e.obraId) || '-',
      'Tanque': depositosMap.get(e.depositoId) || '-',
      'Combustivel': insumosMap.get(e.tipoCombustivel) || e.tipoCombustivel,
      'Fornecedor': fornecedoresMap.get(e.fornecedor) || e.fornecedor || '-',
      'Litros': e.quantidadeLitros,
      'Valor (R$)': e.valorTotal,
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Entradas');

  salvarExcel(wb, 'relatorio-entradas-combustivel.xlsx');
}

export function exportarTransferenciasExcel(
  transferencias: TransferenciaCombustivel[],
  obras: Obra[],
  depositos: Deposito[],
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

  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const totalLitros = dados.reduce((sum, t) => sum + t.quantidadeLitros, 0);
  const totalValor = dados.reduce((sum, t) => sum + t.valorTotal, 0);

  const wb = XLSX.utils.book_new();

  addResumoSheet(wb, 'Relatorio de Transferencias de Combustivel', subtitulo, periodo, dados.length, totalLitros, totalValor);

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((t) => ({
      'Data/Hora': formatDateTime(t.dataHora),
      'Origem': depositosMap.get(t.depositoOrigemId) || '-',
      'Destino': depositosMap.get(t.depositoDestinoId) || '-',
      'Litros': t.quantidadeLitros,
      'Valor (R$)': t.valorTotal,
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Transferencias');

  salvarExcel(wb, 'relatorio-transferencias-combustivel.xlsx');
}
