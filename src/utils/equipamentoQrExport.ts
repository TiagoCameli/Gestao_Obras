// Marco 7 / PR31 — Gera etiqueta PDF com QR code do equipamento.
//
// QR aponta pra /m/eq/:id (hub mobile do PR32). O operador escaneia com a
// câmera do celular e cai direto no menu de ações daquele equipamento.
//
// Layout da etiqueta: A6 paisagem (105×148 mm) cortável de uma A4 (8 por
// folha). QR grande à esquerda, identificação à direita com código, nome,
// tipo, marca/modelo. Margem suficiente pra cortar e laminar.

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Equipamento } from '../types';
import { PDF_RGB, makeFilename } from './exportTemplate';

/** URL pública que o QR codifica. SEMPRE aponta pro domínio público fixo —
 * QR é impresso fisicamente e fica permanente, não pode codificar localhost
 * (dev) nem URL de preview Vercel. Override possível via VITE_QR_BASE_URL
 * pra ambientes alternativos (staging, etc). */
function buildScanUrl(equipamentoId: string): string {
  const envBase = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_QR_BASE_URL;
  const base = (envBase || 'https://emtconstrutora.com').replace(/\/$/, '');
  return `${base}/m/eq/${encodeURIComponent(equipamentoId)}`;
}

/** Gera Data URL do QR (PNG 512x512) — usado por jsPDF.addImage. */
async function qrAsDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: 'H',  // alta correção: aguenta sujeira/risco
    color: {
      dark: '#1E5A38',  // verde escuro EMT (combina com a marca)
      light: '#FFFFFF',
    },
  });
}

export async function exportarEtiquetaEquipamentoPdf(eq: Equipamento): Promise<void> {
  const url = buildScanUrl(eq.id);
  const qrDataUrl = await qrAsDataUrl(url);

  // A4 retrato, mas a etiqueta ocupa só a metade superior pra facilitar
  // dobrar / cortar / colar. Layout: cabeçalho verde + bloco da etiqueta
  // + bloco de instruções de uso.
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Cabeçalho da página
  doc.setFillColor(...PDF_RGB.verde);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFillColor(...PDF_RGB.verdeEscuro);
  doc.rect(0, 22, pageW, 4, 'F');
  doc.setTextColor(...PDF_RGB.branco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Etiqueta QR · EMT Construtora', margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Imprima, recorte e cole na máquina', margin, 20);

  // Etiqueta: bloco branco grande com QR (esquerda) e identificação (direita)
  // Recortável: borda tracejada
  const etiquetaY = 38;
  const etiquetaH = 95;
  const etiquetaW = pageW - margin * 2;
  doc.setDrawColor(...PDF_RGB.cinzaMedio);
  doc.setLineDashPattern([2, 2], 0);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, etiquetaY, etiquetaW, etiquetaH, 2, 2, 'S');
  doc.setLineDashPattern([], 0);

  // QR à esquerda (80x80mm)
  const qrSize = 80;
  const qrX = margin + 7;
  const qrY = etiquetaY + (etiquetaH - qrSize) / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // Identificação à direita
  const textX = qrX + qrSize + 10;
  let textY = etiquetaY + 18;

  // Logo / marca
  doc.setFillColor(...PDF_RGB.verde);
  doc.roundedRect(textX, textY - 6, 18, 8, 1.5, 1.5, 'F');
  doc.setTextColor(...PDF_RGB.branco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EMT', textX + 9, textY - 0.5, { align: 'center' });

  // Código patrimônio (grande)
  textY += 12;
  doc.setTextColor(...PDF_RGB.cinzaEscuro);
  doc.setFont('courier', 'bold');
  doc.setFontSize(28);
  doc.text(eq.codigoPatrimonio || eq.id.slice(0, 12), textX, textY);

  // Nome
  textY += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const nomeLines = doc.splitTextToSize(eq.nome, etiquetaW - (textX - margin) - 5);
  doc.text(nomeLines.slice(0, 2), textX, textY);
  textY += nomeLines.length * 6 + 2;

  // Tipo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_RGB.cinzaMedio);
  doc.text(eq.tipo || '—', textX, textY);

  // Marca · Modelo · Ano
  textY += 5.5;
  const detalhes = [eq.marca, eq.modelo, eq.ano].filter(Boolean).join(' · ');
  if (detalhes) doc.text(detalhes, textX, textY);

  // Instrução de uso
  textY += 12;
  doc.setFillColor(...PDF_RGB.verdeClaro);
  doc.roundedRect(textX, textY - 4, etiquetaW - (textX - margin) - 5, 14, 1.5, 1.5, 'F');
  doc.setTextColor(...PDF_RGB.verdeEscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ESCANEIE COM A CÂMERA', textX + 3, textY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Checklist · Saída combustível · Abrir OS', textX + 3, textY + 4.5);

  // Bloco de instruções (parte inferior da página)
  const instrY = etiquetaY + etiquetaH + 15;
  doc.setTextColor(...PDF_RGB.cinzaEscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Como usar', margin, instrY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_RGB.cinzaMedio);
  const instrucoes = [
    '1.  Imprima esta página em papel A4 comum.',
    '2.  Recorte na linha tracejada.',
    '3.  Plastifique ou cole com fita adesiva transparente (proteção contra chuva e óleo).',
    '4.  Fixe em local visível na máquina (porta da cabine, lateral, painel).',
    '5.  Operador abre a câmera do celular sobre o QR e cai direto no menu do equipamento.',
  ];
  instrucoes.forEach((linha, i) => {
    doc.text(linha, margin, instrY + 8 + i * 5.5);
  });

  // URL que o QR codifica (pra debug ou pra digitar manualmente)
  doc.setFontSize(7);
  doc.setTextColor(...PDF_RGB.cinzaMedio);
  doc.text(`URL: ${url}`, margin, instrY + 8 + instrucoes.length * 5.5 + 5);

  // Marca EMT no rodapé
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.text('EMT Construtora · Gestão de Obras', margin, pageH - 6);
  doc.text(new Date().toLocaleDateString('pt-BR'), pageW - margin, pageH - 6, { align: 'right' });

  // Salvar
  const filename = makeFilename(`QR-${eq.codigoPatrimonio || eq.id}`, 'pdf');
  doc.save(filename);
}

// =====================================================================
// Lote: várias etiquetas no mesmo PDF (4 por página A4 retrato).
// Só a etiqueta — sem cabeçalho grande nem instruções.
// =====================================================================

/** Desenha 1 etiqueta numa posição arbitrária da página.
 *  Layout horizontal (largura ~2x a altura) igual ao QR individual:
 *  QR à esquerda ocupando a altura quase total + identificação à direita. */
async function desenharEtiqueta(
  doc: jsPDF,
  eq: Equipamento,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  const url = buildScanUrl(eq.id);
  const qrDataUrl = await qrAsDataUrl(url);

  // Borda recortável tracejada
  doc.setDrawColor(...PDF_RGB.cinzaMedio);
  doc.setLineDashPattern([2, 2], 0);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  doc.setLineDashPattern([], 0);

  // QR à esquerda — ocupa toda a altura útil (menos margem)
  const pad = 4;
  const qrSize = h - pad * 2;
  const qrX = x + pad;
  const qrY = y + pad;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // Identificação à direita
  const textX = qrX + qrSize + 5;
  const textW = w - (textX - x) - pad;
  let textY = y + pad + 5;

  // Badge EMT verde
  doc.setFillColor(...PDF_RGB.verde);
  doc.roundedRect(textX, textY - 4, 14, 6, 1, 1, 'F');
  doc.setTextColor(...PDF_RGB.branco);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('EMT', textX + 7, textY, { align: 'center' });

  // Código patrimônio em fonte mono grande
  textY += 8;
  doc.setTextColor(...PDF_RGB.cinzaEscuro);
  doc.setFont('courier', 'bold');
  doc.setFontSize(20);
  doc.text(eq.codigoPatrimonio || eq.id.slice(0, 12), textX, textY);

  // Nome (até 2 linhas)
  textY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const nomeLines = doc.splitTextToSize(eq.nome, textW);
  doc.text(nomeLines.slice(0, 2), textX, textY);
  textY += Math.min(nomeLines.length, 2) * 4 + 1;

  // Tipo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_RGB.cinzaMedio);
  if (eq.tipo) {
    doc.text(eq.tipo, textX, textY);
    textY += 4;
  }

  // Marca · Modelo
  const detalhes = [eq.marca, eq.modelo].filter(Boolean).join(' · ');
  if (detalhes) {
    doc.text(detalhes, textX, textY);
    textY += 4;
  }

  // Chamada verde (sempre no rodapé do bloco de texto)
  const chamadaH = 11;
  const chamadaY = y + h - pad - chamadaH;
  doc.setFillColor(...PDF_RGB.verdeClaro);
  doc.roundedRect(textX, chamadaY, textW, chamadaH, 1.2, 1.2, 'F');
  doc.setTextColor(...PDF_RGB.verdeEscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('ESCANEIE COM A CÂMERA', textX + 2.5, chamadaY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Checklist · Saída combustível · Abrir OS', textX + 2.5, chamadaY + 8.5);
}

/** Gera 1 PDF com TODAS as etiquetas (6 por página A4 paisagem, 2×3). */
export async function exportarEtiquetasEmLotePdf(equipamentos: Equipamento[]): Promise<void> {
  if (equipamentos.length === 0) return;

  // A4 paisagem (297×210) com 2 colunas × 3 linhas = 6 etiquetas/página.
  // Cada célula = ~143×64mm (ratio ~2.2:1, horizontal igual ao QR individual).
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const cols = 2;
  const rows = 3;
  const perPage = cols * rows;
  const margem = 8;
  const gap = 4;
  const cellW = (pageW - margem * 2 - gap * (cols - 1)) / cols;
  const cellH = (pageH - margem * 2 - gap * (rows - 1)) / rows;

  // Faixa verde fina no topo da página
  doc.setFillColor(...PDF_RGB.verde);
  doc.rect(0, 0, pageW, 4, 'F');

  for (let i = 0; i < equipamentos.length; i++) {
    const eq = equipamentos[i];
    const posOnPage = i % perPage;

    if (i > 0 && posOnPage === 0) {
      doc.addPage();
      doc.setFillColor(...PDF_RGB.verde);
      doc.rect(0, 0, pageW, 4, 'F');
    }

    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);
    const x = margem + col * (cellW + gap);
    const y = margem + row * (cellH + gap);

    await desenharEtiqueta(doc, eq, x, y, cellW, cellH);
  }

  // Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(
      `EMT Construtora · ${equipamentos.length} etiqueta${equipamentos.length > 1 ? 's' : ''} · ${new Date().toLocaleDateString('pt-BR')}`,
      pageW / 2,
      pageH - 3,
      { align: 'center' }
    );
    doc.text(`${p} / ${totalPages}`, pageW - 6, pageH - 3, { align: 'right' });
  }

  const filename = makeFilename(`QR-frota-${equipamentos.length}-equipamentos`, 'pdf');
  doc.save(filename);
}
