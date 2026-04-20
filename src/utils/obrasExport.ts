import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Obra, EtapaObra } from '../types';
import { formatCurrency, formatDate } from './formatters';

const STATUS_LABELS: Record<string, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
};

export function exportarOrcamentoPDF(
  obras: Obra[],
  todasEtapas: EtapaObra[],
) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Relatório de Orçamentos — Obras', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total de obras: ${obras.length}`, 14, y); y += 6;

  const orcamentoGeral = obras.reduce((sum, o) => sum + o.orcamento, 0);
  doc.text(`Orçamento total: ${formatCurrency(orcamentoGeral)}`, 14, y); y += 10;

  for (const obra of obras) {
    const etapas = todasEtapas.filter((e) => e.obraId === obra.id);
    const totalEtapas = etapas.reduce((sum, e) => sum + e.quantidade * e.valorUnitario, 0);

    // Check page space
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    // Obra header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(obra.nome, 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Status: ${STATUS_LABELS[obra.status] ?? obra.status}  |  Responsável: ${obra.responsavel || '—'}  |  Início: ${formatDate(obra.dataInicio)}  |  Previsão: ${formatDate(obra.dataPrevisaoFim)}`, 14, y); y += 5;
    doc.text(`Orçamento: ${formatCurrency(obra.orcamento)}  |  Total etapas: ${formatCurrency(totalEtapas)}`, 14, y); y += 4;

    if (etapas.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Etapa', 'Unidade', 'Quantidade', 'Valor Unitário', 'Valor Total']],
        body: etapas.map((e, i) => [
          String(i + 1),
          e.nome,
          e.unidade || '—',
          String(e.quantidade),
          formatCurrency(e.valorUnitario),
          formatCurrency(e.quantidade * e.valorUnitario),
        ]),
        foot: [['', '', '', '', 'Total:', formatCurrency(totalEtapas)]],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(8);
      doc.text('Nenhuma etapa cadastrada.', 14, y); y += 10;
    }
  }

  doc.save('relatorio-orcamentos-obras.pdf');
}

export function exportarOrcamentoExcel(
  obras: Obra[],
  todasEtapas: EtapaObra[],
) {
  const wb = XLSX.utils.book_new();

  const orcamentoGeral = obras.reduce((sum, o) => sum + o.orcamento, 0);

  // Resumo sheet
  const resumo = [
    ['Relatório de Orçamentos — Obras'],
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total de obras', obras.length],
    ['Orçamento total (R$)', orcamentoGeral],
    [],
    ['Obra', 'Status', 'Responsável', 'Início', 'Previsão Término', 'Orçamento (R$)', 'Total Etapas (R$)', 'Qtd Etapas'],
    ...obras.map((o) => {
      const etapas = todasEtapas.filter((e) => e.obraId === o.id);
      const totalEtapas = etapas.reduce((sum, e) => sum + e.quantidade * e.valorUnitario, 0);
      return [
        o.nome,
        STATUS_LABELS[o.status] ?? o.status,
        o.responsavel || '—',
        formatDate(o.dataInicio),
        formatDate(o.dataPrevisaoFim),
        o.orcamento,
        totalEtapas,
        etapas.length,
      ];
    }),
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Detalhamento sheet - all etapas with obra name
  const rows = obras.flatMap((o) => {
    const etapas = todasEtapas.filter((e) => e.obraId === o.id);
    if (etapas.length === 0) {
      return [{
        Obra: o.nome,
        Etapa: '(sem etapas)',
        Unidade: '',
        Quantidade: 0,
        'Valor Unitário (R$)': 0,
        'Valor Total (R$)': 0,
      }];
    }
    return etapas.map((e) => ({
      Obra: o.nome,
      Etapa: e.nome,
      Unidade: e.unidade || '—',
      Quantidade: e.quantidade,
      'Valor Unitário (R$)': e.valorUnitario,
      'Valor Total (R$)': e.quantidade * e.valorUnitario,
    }));
  });

  const wsDetalhe = XLSX.utils.json_to_sheet(rows);
  wsDetalhe['!cols'] = [
    { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetalhe, 'Detalhamento Etapas');

  XLSX.writeFile(wb, 'relatorio-orcamentos-obras.xlsx');
}
