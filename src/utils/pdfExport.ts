import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Abastecimento, AlocacaoEtapa, Deposito, EntradaCombustivel, Equipamento, EtapaObra, Fornecedor, Insumo, Obra, TransferenciaCombustivel } from '../types';
import { formatCurrency, formatDateTime, formatLitros } from './formatters';

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
    return `Tanques: ${nomes.join(', ')}`;
  }
  return 'Todas as obras e tanques';
}

export function exportarSaidasPDF(
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

  const doc = new jsPDF();
  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const equipMap = new Map(lookups.equipamentos.map((e) => [e.id, e.nome]));
  const etapasMap = new Map(lookups.etapas.map((e) => [e.id, e.nome]));

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);
  const periodo = formatarPeriodo(dataInicio, dataFim);

  doc.setFontSize(18);
  doc.text('Relatório de Saídas de Combustível', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  doc.text(subtitulo, 14, y); y += 6;
  if (periodo) { doc.text(periodo, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de registros: ${dados.length}`, 14, y); y += 6;

  const totalGasto = dados.reduce((sum, a) => sum + a.valorTotal, 0);
  const totalLitros = dados.reduce((sum, a) => sum + a.quantidadeLitros, 0);
  doc.text(`Valor total: ${formatCurrency(totalGasto)}`, 14, y); y += 6;
  doc.text(`Total litros: ${formatLitros(totalLitros)}`, 14, y); y += 6;

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
    .map((a) => [
      formatDateTime(a.dataHora),
      obrasMap.get(a.obraId) || '-',
      formatarAlocacoes(a.alocacoes, a.etapaId),
      depositosMap.get(a.depositoId) || '-',
      equipMap.get(a.veiculo) || a.veiculo || '-',
      insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel,
      formatLitros(a.quantidadeLitros),
      formatCurrency(a.valorTotal),
    ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['Data/Hora', 'Obra', 'Etapa', 'Tanque', 'Equipamento', 'Combustivel', 'Litros', 'Valor']],
    body: rows,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save('relatorio-saidas-combustivel.pdf');
}

export function exportarEntradasPDF(
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

  const doc = new jsPDF();
  const insumosMap = new Map(lookups.insumos.map((i) => [i.id, i.nome]));
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const fornecedoresMap = new Map(lookups.fornecedores.map((f) => [f.id, f.nome]));
  const periodo = formatarPeriodo(dataInicio, dataFim);

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);

  doc.setFontSize(18);
  doc.text('Relatório de Entradas de Combustível', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  doc.text(subtitulo, 14, y); y += 6;
  if (periodo) { doc.text(periodo, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de registros: ${dados.length}`, 14, y); y += 6;

  const totalGasto = dados.reduce((sum, e) => sum + e.valorTotal, 0);
  const totalLitros = dados.reduce((sum, e) => sum + e.quantidadeLitros, 0);
  doc.text(`Valor total: ${formatCurrency(totalGasto)}`, 14, y); y += 6;
  doc.text(`Total litros: ${formatLitros(totalLitros)}`, 14, y); y += 6;

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((e) => [
      formatDateTime(e.dataHora),
      obrasMap.get(e.obraId) || '-',
      depositosMap.get(e.depositoId) || '-',
      insumosMap.get(e.tipoCombustivel) || e.tipoCombustivel,
      fornecedoresMap.get(e.fornecedor) || e.fornecedor || '-',
      formatLitros(e.quantidadeLitros),
      formatCurrency(e.valorTotal),
    ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['Data/Hora', 'Obra', 'Tanque', 'Combustivel', 'Fornecedor', 'Litros', 'Valor']],
    body: rows,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save('relatorio-entradas-combustivel.pdf');
}

export function exportarTransferenciasPDF(
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

  const doc = new jsPDF();
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositos.map((d) => [d.id, d.nome]));
  const periodo = formatarPeriodo(dataInicio, dataFim);

  const subtitulo = formatarSubtituloFiltro(filtroObraIds || [], filtroDepositoIds || [], obrasMap, depositosMap);

  doc.setFontSize(18);
  doc.text('Relatório de Transferências de Combustível', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  doc.text(subtitulo, 14, y); y += 6;
  if (periodo) { doc.text(periodo, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de registros: ${dados.length}`, 14, y); y += 6;

  const totalLitros = dados.reduce((sum, t) => sum + t.quantidadeLitros, 0);
  const totalValor = dados.reduce((sum, t) => sum + t.valorTotal, 0);
  doc.text(`Total litros: ${formatLitros(totalLitros)}`, 14, y); y += 6;
  doc.text(`Valor total: ${formatCurrency(totalValor)}`, 14, y); y += 6;

  const rows = dados
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    .map((t) => [
      formatDateTime(t.dataHora),
      depositosMap.get(t.depositoOrigemId) || '-',
      depositosMap.get(t.depositoDestinoId) || '-',
      formatLitros(t.quantidadeLitros),
      formatCurrency(t.valorTotal),
    ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['Data/Hora', 'Origem', 'Destino', 'Litros', 'Valor']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save('relatorio-transferencias-combustivel.pdf');
}
