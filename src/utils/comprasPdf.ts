/**
 * Geradores de PDF do módulo Compras (jsPDF + jspdf-autotable).
 *
 * Layout: header com logo EMT (carregada de /logo-emt.png — basta
 * salvar o arquivo em public/), título do documento, dados básicos,
 * tabela de itens, totais, condição de pagamento, espaço de assinatura,
 * footer com data de geração.
 *
 * Logo:
 *   1. Salve a logo em /Users/tiagocameli/projects/Gestao_Obras/public/logo-emt.png
 *   2. Esse arquivo é servido pelo Vite em runtime como /logo-emt.png
 *   3. Os PDFs carregam essa URL; se falhar, cai num header de texto (graceful fallback)
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Cotacao,
  CotacaoFornecedor,
  Fornecedor,
  Obra,
  OrdemCompra,
  PedidoCompra,
} from '../types';

const COR_VERDE_EMT = '#1f7a3a';
const COR_TEXTO = '#0f172a';
const COR_TEXTO_MUTED = '#64748b';

interface DadosEmpresa {
  nome: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
}

const EMPRESA_DEFAULT: DadosEmpresa = {
  nome: 'EMT Construtora Ltda',
};

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(s: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR');
  } catch { return s; }
}

/** Carrega imagem como dataURL pra embutir no PDF. Resolve null se falhar. */
async function carregarImagem(url: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      try {
        resolve({ data: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Header padrão dos PDFs do módulo: logo + nome empresa + nº doc + data */
async function montarHeader(doc: jsPDF, titulo: string, numero: string, dataDoc: string, _empresa = EMPRESA_DEFAULT) {
  void _empresa;
  const pageW = doc.internal.pageSize.getWidth();
  const margem = 14;

  // Tenta carregar a logo (se existir em public/)
  const logo = await carregarImagem('/logo-emt.png');
  if (logo) {
    const altura = 18;
    const largura = (logo.w / logo.h) * altura;
    doc.addImage(logo.data, 'PNG', margem, 10, largura, altura);
  } else {
    // Fallback: nome em destaque
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(COR_VERDE_EMT);
    doc.text('EMT', margem, 18);
    doc.setFontSize(9);
    doc.setTextColor(COR_TEXTO_MUTED);
    doc.text('Construtora Ltda', margem, 24);
  }

  // Bloco do documento (direita)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COR_TEXTO);
  doc.text(titulo, pageW - margem, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COR_TEXTO_MUTED);
  doc.text(`Nº ${numero}`, pageW - margem, 19, { align: 'right' });
  doc.text(`Data: ${fmtData(dataDoc)}`, pageW - margem, 24, { align: 'right' });

  // Linha verde divisória
  doc.setDrawColor(COR_VERDE_EMT);
  doc.setLineWidth(0.6);
  doc.line(margem, 32, pageW - margem, 32);
}

/** Footer com nº de página + data de geração */
function montarFooter(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COR_TEXTO_MUTED);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema EMT Construtora`,
      14, pageH - 8
    );
    doc.text(`Página ${i} de ${total}`, pageW - 14, pageH - 8, { align: 'right' });
  }
}

// ════════════════════════════════════════════════════════════════════════
// PDF — Pedido de Compra
// ════════════════════════════════════════════════════════════════════════
export async function gerarPdfPedido(pedido: PedidoCompra, obras: Obra[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await montarHeader(doc, 'Pedido de Compra', pedido.numero, pedido.data);

  let y = 40;
  const obraNome = obras.find((o) => o.id === pedido.obraId)?.nome ?? '—';

  // Bloco de info
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 0, right: 4 }, textColor: COR_TEXTO },
    body: [
      ['Obra:', obraNome, 'Solicitante:', pedido.solicitante],
      ['Urgência:', pedido.urgencia.toUpperCase(), 'Status:', pedido.status.toUpperCase()],
      ...(pedido.valorEstimado != null ? [['Valor estimado:', fmtMoeda(pedido.valorEstimado), '', '']] : []),
    ] as string[][],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      2: { fontStyle: 'bold', cellWidth: 28 },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 4;

  // Itens
  if (pedido.itens.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Descrição', 'Tipo', 'Categoria', 'Qtd', 'Un']],
      body: pedido.itens.map((it, i) => [
        String(i + 1),
        it.descricao,
        (it.tipo ?? 'material') === 'servico' ? 'Serviço' : 'Material',
        it.categoria,
        String(it.quantidade),
        it.unidade,
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 122, 58], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 8 }, 4: { halign: 'right', cellWidth: 18 }, 5: { cellWidth: 14 } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Descrição livre
  if (pedido.descricaoLivre) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(COR_TEXTO);
    doc.text('Descrição:', 14, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const linhas = doc.splitTextToSize(pedido.descricaoLivre, 180);
    doc.text(linhas, 14, y);
    y += linhas.length * 4 + 3;
  }

  // Observações
  if (pedido.observacoes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observações:', 14, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const linhas = doc.splitTextToSize(pedido.observacoes, 180);
    doc.text(linhas, 14, y);
    y += linhas.length * 4 + 3;
  }

  // Auditoria
  doc.setDrawColor(229, 231, 235);
  doc.line(14, y + 4, 196, y + 4);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO_MUTED);
  if (pedido.criadoPor) doc.text(`Criado por: ${pedido.criadoPor}`, 14, y);
  if (pedido.aprovadoPor) doc.text(`Aprovado por: ${pedido.aprovadoPor} em ${fmtData(pedido.aprovadoEm || '')}`, 14, y + 4);

  montarFooter(doc);
  doc.save(`Pedido_${pedido.numero}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════
// PDF — Cotação Comparativa (vários fornecedores lado a lado)
// ════════════════════════════════════════════════════════════════════════
export async function gerarPdfCotacaoComparativo(
  cotacao: Cotacao,
  fornecedores: Fornecedor[]
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  await montarHeader(doc, 'Mapa Comparativo de Cotação', cotacao.numero, cotacao.data);

  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f]));
  const cfs = cotacao.fornecedores;

  let y = 40;
  if (cotacao.descricao) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(COR_TEXTO);
    doc.text(cotacao.descricao, 14, y);
    y += 5;
  }

  // Tabela: linhas = itens, colunas = qty/unit + um por fornecedor (preço)
  const headers = ['Item', 'Qtd', 'Un', ...cfs.map((cf) => fornecedoresMap.get(cf.fornecedorId)?.nome ?? '?')];
  const corpo: string[][] = cotacao.itensPedido.map((item) => {
    const linha = [item.descricao, String(item.quantidade), item.unidade];
    for (const cf of cfs) {
      const ip = cf.itensPrecos.find((x) => x.itemPedidoId === item.id);
      const subtotal = (ip?.precoUnitario ?? 0) * item.quantidade;
      linha.push(ip?.precoUnitario ? `${fmtMoeda(subtotal)}\n${ip.marca ? `(${ip.marca})` : ''}` : '—');
    }
    return linha;
  });

  // Linha de totais
  const totais = ['Total', '', '', ...cfs.map((cf) => fmtMoeda(cf.total))];
  corpo.push(totais);

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: corpo,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [31, 122, 58], textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'normal' },
      1: { halign: 'right', cellWidth: 14 },
      2: { cellWidth: 12 },
    },
    didParseCell: (data) => {
      if (data.row.index === corpo.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 244, 248];
      }
      if (data.column.index >= 3) {
        data.cell.styles.halign = 'right';
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // Condição/prazo por fornecedor
  if (cfs.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Fornecedor', 'Condição de pagamento', 'Prazo de entrega', 'Total']],
      body: cfs.map((cf) => [
        fornecedoresMap.get(cf.fornecedorId)?.nome ?? '?',
        cf.condicaoPagamento || '—',
        cf.prazoEntrega || '—',
        fmtMoeda(cf.total),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [241, 245, 249], textColor: COR_TEXTO, fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' } },
    });
  }

  montarFooter(doc);
  doc.save(`Cotacao_Comparativo_${cotacao.numero}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════
// PDF — Cotação Individual (um fornecedor — pra mandar pra ele confirmar)
// ════════════════════════════════════════════════════════════════════════
export async function gerarPdfCotacaoIndividual(
  cotacao: Cotacao,
  cf: CotacaoFornecedor,
  fornecedor?: Fornecedor
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await montarHeader(doc, 'Cotação', cotacao.numero, cotacao.data);

  let y = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(COR_TEXTO);
  doc.text(`Fornecedor: ${fornecedor?.nome ?? 'não informado'}`, 14, y);
  y += 6;
  if (cotacao.descricao) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(cotacao.descricao, 14, y);
    y += 5;
  }

  const corpo = cotacao.itensPedido.map((item, i) => {
    const ip = cf.itensPrecos.find((x) => x.itemPedidoId === item.id);
    const subtotal = (ip?.precoUnitario ?? 0) * item.quantidade;
    return [
      String(i + 1),
      item.descricao,
      ip?.marca ?? '',
      String(item.quantidade),
      item.unidade,
      fmtMoeda(ip?.precoUnitario ?? 0),
      fmtMoeda(subtotal),
    ];
  });
  // Linha de total
  corpo.push(['', '', '', '', '', 'TOTAL', fmtMoeda(cf.total)]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Descrição', 'Marca', 'Qtd', 'Un', 'Preço unit.', 'Subtotal']],
    body: corpo,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [31, 122, 58], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { halign: 'right', cellWidth: 16 },
      4: { cellWidth: 12 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.row.index === corpo.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 244, 248];
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let yEnd = (doc as any).lastAutoTable.finalY + 6;

  // Condição + prazo
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COR_TEXTO);
  doc.text('Condição de pagamento:', 14, yEnd);
  doc.setFont('helvetica', 'normal');
  doc.text(cf.condicaoPagamento || '—', 60, yEnd);
  doc.setFont('helvetica', 'bold');
  doc.text('Prazo de entrega:', 14, yEnd + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(cf.prazoEntrega || '—', 60, yEnd + 5);
  yEnd += 14;

  // Espaço de assinatura
  doc.setDrawColor(180);
  doc.line(14, yEnd + 18, 100, yEnd + 18);
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO_MUTED);
  doc.text('Assinatura do fornecedor', 14, yEnd + 22);

  doc.line(120, yEnd + 18, 196, yEnd + 18);
  doc.text('Data', 120, yEnd + 22);

  montarFooter(doc);
  doc.save(`Cotacao_${cotacao.numero}_${fornecedor?.nome ?? 'fornecedor'}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════
// PDF — Ordem de Compra
// ════════════════════════════════════════════════════════════════════════
export async function gerarPdfOrdemCompra(
  oc: OrdemCompra,
  fornecedor: Fornecedor | undefined,
  obra?: Obra
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await montarHeader(doc, 'Ordem de Compra', oc.numero, oc.dataCriacao);

  let y = 40;

  // Bloco fornecedor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(COR_TEXTO);
  doc.text('FORNECEDOR', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(fornecedor?.nome ?? 'não informado', 14, y + 5);
  if (fornecedor?.cnpj) doc.text(`CNPJ: ${fornecedor.cnpj}`, 14, y + 10);
  if (fornecedor?.telefone) doc.text(`Tel: ${fornecedor.telefone}`, 14, y + 15);
  if (fornecedor?.email) doc.text(`Email: ${fornecedor.email}`, 14, y + 20);

  // Bloco destino (à direita)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DESTINO', 110, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const linhasDestino: string[] = [];
  switch (oc.tipoDestino) {
    case 'obra_etapa':
      linhasDestino.push('Obra (etapa específica)');
      if (obra) linhasDestino.push(obra.nome);
      break;
    case 'obra_deposito':
      linhasDestino.push('Obra (depósito)');
      if (obra) linhasDestino.push(obra.nome);
      break;
    case 'deposito_central':
      linhasDestino.push('Depósito Central');
      break;
    case 'sede':
      linhasDestino.push('Sede da empresa');
      break;
    case 'manutencao_equipamento':
      linhasDestino.push('Manutenção de equipamento');
      break;
    default:
      linhasDestino.push('—');
  }
  linhasDestino.forEach((l, i) => doc.text(l, 110, y + 5 + i * 5));

  y += 30;

  // Itens
  autoTable(doc, {
    startY: y,
    head: [['#', 'Descrição', 'Tipo', 'Qtd', 'Un', 'Preço unit.', 'Subtotal']],
    body: oc.itens.map((it, i) => [
      String(i + 1),
      it.descricao + (it.marca ? ` (${it.marca})` : ''),
      (it.tipo ?? 'material') === 'servico' ? 'Serv' : 'Mat',
      String(it.quantidade),
      it.unidade,
      fmtMoeda(it.precoUnitario),
      fmtMoeda(it.subtotal),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [31, 122, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { cellWidth: 14 },
      3: { halign: 'right', cellWidth: 16 },
      4: { cellWidth: 12 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 28 },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let yEnd = (doc as any).lastAutoTable.finalY + 6;

  // Bloco totais (à direita)
  const totaisBox = [
    ['Total materiais/serviços', fmtMoeda(oc.totalMateriais)],
    ['Frete', fmtMoeda(oc.custosAdicionais.frete)],
    ['Outras despesas', fmtMoeda(oc.custosAdicionais.outrasDespesas)],
    ['Impostos', fmtMoeda(oc.custosAdicionais.impostos)],
    ['Desconto', `- ${fmtMoeda(oc.custosAdicionais.desconto)}`],
    ['TOTAL GERAL', fmtMoeda(oc.totalGeral)],
  ];
  autoTable(doc, {
    startY: yEnd,
    body: totaisBox,
    theme: 'plain',
    margin: { left: 110 },
    styles: { fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 2, right: 2 } },
    columnStyles: {
      0: { fontStyle: 'normal', halign: 'right', cellWidth: 50 },
      1: { fontStyle: 'normal', halign: 'right', cellWidth: 36 },
    },
    didParseCell: (data) => {
      if (data.row.index === totaisBox.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 244, 248];
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yEnd = (doc as any).lastAutoTable.finalY + 6;

  // Condição + prazo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COR_TEXTO);
  doc.text('Condição de pagamento:', 14, yEnd);
  doc.setFont('helvetica', 'normal');
  doc.text(oc.condicaoPagamento || '—', 60, yEnd);
  doc.setFont('helvetica', 'bold');
  doc.text('Prazo de entrega:', 14, yEnd + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(oc.prazoEntrega || '—', 60, yEnd + 5);
  if (oc.empresaFaturamento) {
    doc.setFont('helvetica', 'bold');
    doc.text('Faturar para:', 14, yEnd + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(oc.empresaFaturamento, 60, yEnd + 10);
  }
  yEnd += 16;

  // Observações
  if (oc.observacoes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observações:', 14, yEnd);
    doc.setFont('helvetica', 'normal');
    const linhas = doc.splitTextToSize(oc.observacoes, 180);
    doc.text(linhas, 14, yEnd + 4);
    yEnd += 4 + linhas.length * 4 + 4;
  }

  // Espaço de assinaturas
  doc.setDrawColor(180);
  doc.line(14, yEnd + 14, 100, yEnd + 14);
  doc.setFontSize(8);
  doc.setTextColor(COR_TEXTO_MUTED);
  doc.text('Assinatura — EMT Construtora', 14, yEnd + 18);

  doc.line(120, yEnd + 14, 196, yEnd + 14);
  doc.text('Assinatura — Fornecedor', 120, yEnd + 18);

  // Auditoria
  if (oc.aprovadaPor) {
    doc.setFontSize(8);
    doc.setTextColor(COR_TEXTO_MUTED);
    doc.text(
      `Aprovada por ${oc.aprovadaPor} em ${fmtData(oc.aprovadaEm || '')}`,
      14, yEnd + 26
    );
  }

  montarFooter(doc);
  doc.save(`OC_${oc.numero}_${fornecedor?.nome ?? ''}.pdf`);
}
