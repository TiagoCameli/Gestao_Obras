import * as XLSX from 'xlsx';
import type { PedidoMaterial, Fornecedor, Insumo } from '../types';

interface FiltrosExport {
  fornecedorId: string;
  materialId: string;
  dataInicio: string;
  dataFim: string;
}

function formatDate(date: string): string {
  if (!date) return '-';
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
}

function filtrar(pedidos: PedidoMaterial[], filtros: FiltrosExport): PedidoMaterial[] {
  return pedidos
    .filter((p) => {
      if (filtros.fornecedorId && p.fornecedorId !== filtros.fornecedorId) return false;
      if (filtros.materialId && !p.itens.some((i) => i.insumoId === filtros.materialId)) return false;
      if (filtros.dataInicio && p.data < filtros.dataInicio) return false;
      if (filtros.dataFim && p.data > filtros.dataFim) return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function exportarPedidosMaterialExcel(
  pedidos: PedidoMaterial[],
  fornecedores: Fornecedor[],
  insumos: Insumo[],
  filtros: FiltrosExport
) {
  const dados = filtrar(pedidos, filtros);
  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f.nome]));
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));

  const totalGeral = dados.reduce(
    (sum, p) => sum + p.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0),
    0
  );

  const wb = XLSX.utils.book_new();

  // Resumo
  const resumo = [
    ['Relatório de Pedidos de Material'],
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
    [],
    ['Total de pedidos', dados.length],
    ['Valor total (R$)', totalGeral],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Detalhes - uma linha por item
  const rows = dados.flatMap((p) => {
    const fornecedor = fornecedoresMap.get(p.fornecedorId) || '-';
    return p.itens.map((item) => ({
      'Data': formatDate(p.data),
      'Fornecedor': fornecedor,
      'Material': insumosMap.get(item.insumoId) || item.insumoId,
      'Quantidade': item.quantidade,
      'Valor Unitário (R$)': item.valorUnitario,
      'Subtotal (R$)': item.quantidade * item.valorUnitario,
      'Observações': p.observacoes || '-',
    }));
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');

  XLSX.writeFile(wb, 'relatorio-pedidos-material.xlsx');
}
