import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Equipamento, Empresa } from '../types';

const tipoMedicaoLabel: Record<string, string> = {
  horimetro: 'Horímetro',
  odometro: 'Odômetro',
  km: 'Quilometragem',
};

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function buildRows(equipamentos: Equipamento[], empresasMap: Map<string, string>) {
  return equipamentos.map((eq) => ({
    nome: eq.nome,
    tipo: eq.tipo || '—',
    marca: eq.marca || '—',
    ano: eq.ano || '—',
    patrimonio: eq.codigoPatrimonio || '—',
    serie: eq.numeroSerie || '—',
    empresa: empresasMap.get(eq.empresaId) || '—',
    tipoMedicao: tipoMedicaoLabel[eq.tipoMedicao] || eq.tipoMedicao,
    medicaoInicial: eq.medicaoInicial,
    status: eq.ativo ? 'Ativo' : 'Inativo',
    dataAquisicao: formatDate(eq.dataAquisicao),
    dataVenda: formatDate(eq.dataVenda),
  }));
}

export function exportarFrotaPDF(
  equipamentos: Equipamento[],
  empresas: Empresa[],
  filtroLabel?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const empresasMap = new Map(empresas.map((e) => [e.id, e.nome]));
  const rows = buildRows(equipamentos, empresasMap);

  const ativos = equipamentos.filter((e) => e.ativo).length;
  const inativos = equipamentos.length - ativos;

  doc.setFontSize(18);
  doc.text('Relatório de Frota — Equipamentos', 14, 22);

  doc.setFontSize(10);
  let y = 30;
  if (filtroLabel) { doc.text(filtroLabel, 14, y); y += 6; }
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 6;
  doc.text(`Total: ${equipamentos.length} equipamentos (${ativos} ativos, ${inativos} inativos)`, 14, y); y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Nome', 'Tipo', 'Marca', 'Ano', 'Patrimônio', 'N. Série', 'Empresa', 'Medição', 'Med. Inicial', 'Status', 'Aquisição', 'Venda']],
    body: rows.map((r) => [
      r.nome,
      r.tipo,
      r.marca,
      r.ano,
      r.patrimonio,
      r.serie,
      r.empresa,
      r.tipoMedicao,
      String(r.medicaoInicial),
      r.status,
      r.dataAquisicao,
      r.dataVenda,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save('relatorio-frota.pdf');
}

export function exportarFrotaExcel(
  equipamentos: Equipamento[],
  empresas: Empresa[],
  filtroLabel?: string,
) {
  const empresasMap = new Map(empresas.map((e) => [e.id, e.nome]));
  const rows = buildRows(equipamentos, empresasMap);

  const ativos = equipamentos.filter((e) => e.ativo).length;
  const inativos = equipamentos.length - ativos;

  const wb = XLSX.utils.book_new();

  // Resumo sheet
  const resumo = [
    ['Relatório de Frota — Equipamentos'],
    ...(filtroLabel ? [[filtroLabel]] : []),
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total de equipamentos', equipamentos.length],
    ['Ativos', ativos],
    ['Inativos', inativos],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo['!cols'] = [{ wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Dados sheet
  const dados = rows.map((r) => ({
    Nome: r.nome,
    Tipo: r.tipo,
    Marca: r.marca,
    Ano: r.ano,
    'Cód. Patrimônio': r.patrimonio,
    'N. Série': r.serie,
    Empresa: r.empresa,
    'Tipo Medição': r.tipoMedicao,
    'Medição Inicial': r.medicaoInicial,
    Status: r.status,
    'Data Aquisição': r.dataAquisicao,
    'Data Venda': r.dataVenda,
  }));

  const wsDados = XLSX.utils.json_to_sheet(dados);
  wsDados['!cols'] = [
    { wch: 30 }, { wch: 22 }, { wch: 15 }, { wch: 8 },
    { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 15 },
    { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDados, 'Equipamentos');

  XLSX.writeFile(wb, 'relatorio-frota.xlsx');
}
