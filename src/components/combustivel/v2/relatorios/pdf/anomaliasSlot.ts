// F3.C.2 — Renderiza o slot "Anomalias Detectadas" nos 3 templates de
// relatório (Mensal Consolidado, Por Obra, Por Equipamento), substituindo
// o placeholder "Detecção em desenvolvimento".
//
// Estratégia:
// - 0 anomalias: renderiza inline ao final da página atual (espaço de 50pt
//   reservado pelo template original) com mensagem positiva.
// - 1+ anomalias: nova página dedicada com banner header + tabela top N
//   (default 10). Linha de overflow mostra "+X adicionais" no foot quando
//   total > N.
//
// Ordenação: severity desc (critical > warning > info) + data desc dentro
// da mesma severity. Usa rótulos localizados em pt-BR.
//
// Restrição importante: jsPDF helvetica não suporta certos Unicode
// (símbolos como ✓, ⚠). Texto fica restrito a Latin-1 (acentos OK).

import type { jsPDF } from 'jspdf';
import type { Anomalia } from '../../anomalias/detect';
import {
  PDF_RGB,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfSectionTitle,
} from '../../../../../utils/exportTemplate';

const SEV_LABEL: Record<Anomalia['severity'], string> = {
  critical: 'CRITICA',
  warning: 'ATENCAO',
  info: 'INFO',
};

// Ordem desc na ranking — menor número = mais severo.
const SEV_RANK: Record<Anomalia['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function sortAnomalias(anomalias: Anomalia[]): Anomalia[] {
  return [...anomalias].sort((a, b) => {
    const r = SEV_RANK[a.severity] - SEV_RANK[b.severity];
    if (r !== 0) return r;
    return b.data.localeCompare(a.data); // data desc
  });
}

/** Formata data ISO YYYY-MM-DD em DD/MM/YY pra caber em coluna estreita. */
function fmtDataCurta(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

interface DrawAnomaliasOptions {
  /** Limite de linhas na tabela. Excedente vai pro foot ("+X adicionais"). */
  maxRows?: number;
  /** Y inline pra empty state. Padrão = pageH - 50 (slot original). */
  inlineFallbackY?: number;
}

/** Renderiza o slot Anomalias no PDF.
 *
 *  Comportamento:
 *  - 0 anomalias: chama drawPdfSectionTitle no Y inline (rodapé da página
 *    de Fornecedores) + texto curto positivo.
 *  - 1+ anomalias: doc.addPage() + drawPdfDetailPageHeader + tabela top N.
 *
 *  Caller é responsável por garantir que a página atual tem espaço pro slot
 *  inline (caso 0 anomalias). Nos templates atuais isso é garantido pelo
 *  layout fixo.
 */
export function drawAnomaliasSlot(
  doc: jsPDF,
  anomalias: Anomalia[],
  marca: string,
  options: DrawAnomaliasOptions = {},
): void {
  const { maxRows = 10, inlineFallbackY } = options;

  if (anomalias.length === 0) {
    const pageH = doc.internal.pageSize.getHeight();
    const yAnom = inlineFallbackY ?? pageH - 50;
    drawPdfSectionTitle(doc, yAnom, 'ANOMALIAS DETECTADAS');
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      'Nenhuma anomalia detectada no periodo.',
      10,
      yAnom + 6,
    );
    return;
  }

  // 1+ anomalias → nova página dedicada
  doc.addPage();
  drawPdfDetailPageHeader(doc, 'Anomalias Detectadas', anomalias.length);

  const sorted = sortAnomalias(anomalias).slice(0, maxRows);
  const total = anomalias.length;
  const rest = total > maxRows ? total - maxRows : 0;

  let y = 18;
  const tituloSecao =
    total <= maxRows
      ? `${total} ANOMALIA${total > 1 ? 'S' : ''} · POR SEVERIDADE`
      : `TOP ${maxRows} ANOMALIAS · POR SEVERIDADE (de ${total})`;
  y = drawPdfSectionTitle(doc, y, tituloSecao);

  drawPdfDetailTable(
    doc,
    y,
    ['Severidade', 'Det.', 'Data', 'Titulo', 'Descricao'],
    sorted.map((a) => [
      SEV_LABEL[a.severity] ?? a.severity,
      a.detector,
      fmtDataCurta(a.data),
      a.title,
      a.description,
    ]),
    rest > 0
      ? ['', '', '', `+${rest} ${rest > 1 ? 'adicionais' : 'adicional'} no escopo`, '']
      : ['', '', '', '', ''],
    {
      0: { halign: 'center', cellWidth: 24 },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'left', cellWidth: 70 },
      4: { halign: 'left' }, // resto
    },
    marca,
  );
}
