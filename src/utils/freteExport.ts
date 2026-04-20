import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Frete, Insumo } from '../types';
import { formatCurrency } from './formatters';

function formatDate(date: string): string {
  if (!date) return '-';
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatarPeriodo(dataInicio?: string, dataFim?: string): string {
  if (!dataInicio && !dataFim) return '';
  if (dataInicio && dataFim) return `Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}`;
  if (dataInicio) return `A partir de: ${formatDate(dataInicio)}`;
  return `Até: ${formatDate(dataFim!)}`;
}

interface FiltrosExport {
  obraId: string;
  transportadora: string;
  motorista: string;
  insumoId: string;
  origem: string;
  dataInicio: string;
  dataFim: string;
  notaFiscal: string;
}

function filtrarFretes(fretes: Frete[], filtros: FiltrosExport): Frete[] {
  return fretes
    .filter((f) => {
      if (filtros.obraId && f.obraId !== filtros.obraId) return false;
      if (filtros.transportadora && f.transportadora !== filtros.transportadora) return false;
      if (filtros.motorista) {
        const q = filtros.motorista.toLowerCase();
        if (!f.motorista?.toLowerCase().includes(q)) return false;
      }
      if (filtros.insumoId && f.insumoId !== filtros.insumoId) return false;
      if (filtros.origem && f.origem?.trim() !== filtros.origem) return false;
      if (filtros.dataInicio && f.data < filtros.dataInicio) return false;
      if (filtros.dataFim && f.data > filtros.dataFim) return false;
      if (filtros.notaFiscal) {
        const q = filtros.notaFiscal.toLowerCase();
        if (!f.notaFiscal?.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function exportarFretesPDF(
  fretes: Frete[],
  insumos: Insumo[],
  filtros: FiltrosExport
) {
  const dados = filtrarFretes(fretes, filtros);
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));

  const doc = new jsPDF({ orientation: 'landscape' });
  const periodo = formatarPeriodo(filtros.dataInicio, filtros.dataFim);

  doc.setFontSize(18);
  doc.text('Relatório de Fretes', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  if (filtros.transportadora) { doc.text(`Transportadora: ${filtros.transportadora}`, 14, y); y += 6; }
  if (filtros.origem) { doc.text(`Origem: ${filtros.origem}`, 14, y); y += 6; }
  if (periodo) { doc.text(periodo, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de registros: ${dados.length}`, 14, y); y += 6;

  const totalValor = dados.reduce((sum, f) => sum + f.valorTotal, 0);
  const totalPeso = dados.reduce((sum, f) => sum + f.pesoToneladas, 0);
  const totalMaterial = dados.reduce((sum, f) => sum + (f.valorMaterial || 0), 0);
  doc.text(`Valor total fretes: ${formatCurrency(totalValor)}`, 14, y); y += 6;
  doc.text(`Peso total: ${totalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t`, 14, y); y += 6;
  if (totalMaterial > 0) {
    doc.text(`Valor total material: ${formatCurrency(totalMaterial)}`, 14, y); y += 6;
  }

  const rows = dados.map((f) => [
    formatDate(f.data),
    formatDate(f.dataChegada),
    `${f.origem} → ${f.destino}`,
    f.transportadora,
    f.motorista || '-',
    f.placaCarreta || '-',
    insumosMap.get(f.insumoId) || '-',
    f.pesoToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    f.kmRodados.toLocaleString('pt-BR', { minimumFractionDigits: 1 }),
    f.valorTkm.toLocaleString('pt-BR', { minimumFractionDigits: 4 }),
    formatCurrency(f.valorTotal),
    f.valorMaterial ? formatCurrency(f.valorMaterial) : '-',
    f.notaFiscal || '-',
    f.notaFiscal2 || '-',
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [['Saída', 'Chegada', 'Origem → Destino', 'Transportadora', 'Motorista', 'Placa', 'Material', 'Peso (t)', 'KM', 'R$/TKM', 'Total', 'Preço Material', 'NF', 'NF 2']],
    body: rows,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [34, 87, 60] },
  });

  doc.save('relatorio-fretes.pdf');
}

export function exportarFretesExcel(
  fretes: Frete[],
  insumos: Insumo[],
  filtros: FiltrosExport
) {
  const dados = filtrarFretes(fretes, filtros);
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));
  const periodo = formatarPeriodo(filtros.dataInicio, filtros.dataFim);

  const totalValor = dados.reduce((sum, f) => sum + f.valorTotal, 0);
  const totalPeso = dados.reduce((sum, f) => sum + f.pesoToneladas, 0);
  const totalMaterial = dados.reduce((sum, f) => sum + (f.valorMaterial || 0), 0);

  const wb = XLSX.utils.book_new();

  // Resumo sheet
  const resumo = [
    ['Relatório de Fretes'],
    ...(filtros.transportadora ? [[`Transportadora: ${filtros.transportadora}`]] : []),
    ...(filtros.origem ? [[`Origem: ${filtros.origem}`]] : []),
    ...(periodo ? [[periodo]] : []),
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total de registros', dados.length],
    ['Peso total (t)', totalPeso],
    ['Valor total fretes (R$)', totalValor],
    ['Valor total material (R$)', totalMaterial],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Dados sheet
  const rows = dados.map((f) => ({
    'ID': f.id,
    'Data Saída': formatDate(f.data),
    'Data Chegada': formatDate(f.dataChegada),
    'Origem': f.origem,
    'Destino': f.destino,
    'Transportadora': f.transportadora,
    'Motorista': f.motorista || '-',
    'Placa': f.placaCarreta || '-',
    'Material': insumosMap.get(f.insumoId) || '-',
    'Peso (t)': f.pesoToneladas,
    'KM': f.kmRodados,
    'R$/TKM': f.valorTkm,
    'Valor Total (R$)': f.valorTotal,
    'Preço Material (R$)': f.valorMaterial || 0,
    'Preço Unit. Material (R$/t)': f.valorMaterial && f.pesoToneladas ? +(f.valorMaterial / f.pesoToneladas).toFixed(4) : 0,
    'Nota Fiscal': f.notaFiscal || '-',
    'Nota Fiscal 2': f.notaFiscal2 || '-',
    'Observações': f.observacoes || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
    { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Fretes');

  XLSX.writeFile(wb, 'relatorio-fretes.xlsx');
}
