import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function fmtPeriodo(di: string, df: string): string {
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  return `Período: ${fmt(di)} a ${fmt(df)}`;
}

function fmtHoras(h: number): string {
  if (!h) return '-';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h${mins > 0 ? ` ${mins}min` : ''}`;
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// ── PDF Exports ──

export function exportarRelatorioEquipPDF(
  relatorio: { nome: string; dias: number; registros: number; horas: number }[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Relatório de Horas — Equipamentos', 14, 20);
  doc.setFontSize(10);
  doc.text(fmtPeriodo(dataInicio, dataFim), 14, 28);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 34);

  autoTable(doc, {
    startY: 42,
    head: [['Equipamento', 'Dias', 'Registros', 'Horas']],
    body: relatorio.map((r) => [r.nome, r.dias, r.registros, fmtHoras(r.horas)]),
    foot: [['Total', '', relatorio.length.toString(), fmtHoras(totalHoras)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
    footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
  });

  doc.save('relatorio-horas-equipamentos.pdf');
}

export function exportarRelatorioColabPDF(
  relatorio: { nome: string; dias: number; registros: number; horas: number }[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Relatório de Horas — Colaboradores', 14, 20);
  doc.setFontSize(10);
  doc.text(fmtPeriodo(dataInicio, dataFim), 14, 28);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 34);

  autoTable(doc, {
    startY: 42,
    head: [['Colaborador', 'Dias', 'Registros', 'Horas']],
    body: relatorio.map((r) => [r.nome, r.dias, r.registros, fmtHoras(r.horas)]),
    foot: [['Total', '', relatorio.length.toString(), fmtHoras(totalHoras)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
    footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
  });

  doc.save('relatorio-horas-colaboradores.pdf');
}

export function exportarRelatorioDiaristasPDF(
  porObra: { obra: string; dias: number; valor: number; abertas: number; fechadas: number; pagas: number }[],
  totais: { totalAPagar: number; totalPago: number },
  dataInicio: string,
  dataFim: string,
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Relatório de Diárias', 14, 20);
  doc.setFontSize(10);
  doc.text(fmtPeriodo(dataInicio, dataFim), 14, 28);
  doc.text(`Total a Pagar: ${fmtBRL(totais.totalAPagar)} | Total Pago: ${fmtBRL(totais.totalPago)}`, 14, 34);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 40);

  autoTable(doc, {
    startY: 48,
    head: [['Obra', 'Dias', 'Valor', 'Abertas', 'Fechadas', 'Pagas']],
    body: porObra.map((r) => [r.obra, r.dias, fmtBRL(r.valor), r.abertas, r.fechadas, r.pagas]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save('relatorio-diarias.pdf');
}

// ── Excel Exports ──

export function exportarRelatorioEquipExcel(
  relatorio: { nome: string; dias: number; registros: number; horas: number }[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
) {
  const wb = XLSX.utils.book_new();
  const rows = relatorio.map((r) => ({
    Equipamento: r.nome,
    Dias: r.dias,
    Registros: r.registros,
    Horas: +r.horas.toFixed(2),
  }));
  rows.push({ Equipamento: 'TOTAL', Dias: 0, Registros: relatorio.length, Horas: +totalHoras.toFixed(2) });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');

  const resumo = XLSX.utils.aoa_to_sheet([
    ['Relatório de Horas — Equipamentos'],
    [fmtPeriodo(dataInicio, dataFim)],
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total equipamentos', relatorio.length],
    ['Total horas', +totalHoras.toFixed(2)],
  ]);
  resumo['!cols'] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, resumo, 'Resumo');

  XLSX.writeFile(wb, 'relatorio-horas-equipamentos.xlsx');
}

export function exportarRelatorioColabExcel(
  relatorio: { nome: string; dias: number; registros: number; horas: number }[],
  totalHoras: number,
  dataInicio: string,
  dataFim: string,
) {
  const wb = XLSX.utils.book_new();
  const rows = relatorio.map((r) => ({
    Colaborador: r.nome,
    Dias: r.dias,
    Registros: r.registros,
    Horas: +r.horas.toFixed(2),
  }));
  rows.push({ Colaborador: 'TOTAL', Dias: 0, Registros: relatorio.length, Horas: +totalHoras.toFixed(2) });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');

  const resumo = XLSX.utils.aoa_to_sheet([
    ['Relatório de Horas — Colaboradores'],
    [fmtPeriodo(dataInicio, dataFim)],
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total colaboradores', relatorio.length],
    ['Total horas', +totalHoras.toFixed(2)],
  ]);
  resumo['!cols'] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, resumo, 'Resumo');

  XLSX.writeFile(wb, 'relatorio-horas-colaboradores.xlsx');
}

export function exportarRelatorioDiaristasExcel(
  porObra: { obra: string; dias: number; valor: number; abertas: number; fechadas: number; pagas: number }[],
  totais: { totalAPagar: number; totalPago: number },
  dataInicio: string,
  dataFim: string,
) {
  const wb = XLSX.utils.book_new();
  const rows = porObra.map((r) => ({
    Obra: r.obra,
    Dias: r.dias,
    'Valor (R$)': +r.valor.toFixed(2),
    Abertas: r.abertas,
    Fechadas: r.fechadas,
    Pagas: r.pagas,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Diárias');

  const resumo = XLSX.utils.aoa_to_sheet([
    ['Relatório de Diárias'],
    [fmtPeriodo(dataInicio, dataFim)],
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total a pagar', totais.totalAPagar],
    ['Total pago', totais.totalPago],
  ]);
  resumo['!cols'] = [{ wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, resumo, 'Resumo');

  XLSX.writeFile(wb, 'relatorio-diarias.xlsx');
}
