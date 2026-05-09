// F3.C.2 — Helper compartilhado pra adicionar a sheet "Anomalias" em
// cada workbook xlsx (Mensal Consolidado / Por Obra / Por Equipamento).
//
// Quando 0 anomalias: única célula com mensagem positiva. Quando 1+:
// header verde + linhas ordenadas por severity desc + data desc.
//
// Mantém os mesmos rótulos pt-BR latin-1 (CRITICA/ATENCAO/INFO) usados
// no PDF helper pra consistência cross-formato.

import type { Workbook } from 'exceljs';
import { BRAND } from '../../../../utils/exportTemplate';
import type { Anomalia } from '../anomalias/detect';

const SEV_LABEL: Record<Anomalia['severity'], string> = {
  critical: 'CRITICA',
  warning: 'ATENCAO',
  info: 'INFO',
};
const SEV_RANK: Record<Anomalia['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Adiciona sheet "Anomalias" ao workbook. Idempotente — o caller é
 *  responsável por garantir que não há sheet "Anomalias" pré-existente. */
export function renderExcelAnomaliasSheet(wb: Workbook, anomalias: Anomalia[]): void {
  const ws = wb.addWorksheet('Anomalias', {
    properties: { tabColor: { argb: BRAND.amarelo } },
  });

  ws.getCell('A1').value = 'Anomalias detectadas';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: BRAND.verdeEscuro } };

  if (anomalias.length === 0) {
    ws.getCell('A3').value = 'Nenhuma anomalia detectada no periodo.';
    ws.getCell('A3').font = { italic: true, size: 11, color: { argb: BRAND.cinzaMedio } };
    ws.getColumn('A').width = 60;
    return;
  }

  const sorted = [...anomalias].sort((a, b) => {
    const r = SEV_RANK[a.severity] - SEV_RANK[b.severity];
    if (r !== 0) return r;
    return b.data.localeCompare(a.data);
  });

  ws.getCell('A3').value = `${anomalias.length} anomalia(s) — ordenadas por severidade desc + data desc`;
  ws.getCell('A3').font = { italic: true, size: 10, color: { argb: BRAND.cinzaMedio } };

  // Header
  const headerRow = 5;
  const headers = ['Severidade', 'Detector', 'Data', 'Titulo', 'Descricao', 'Acao sugerida'];
  headers.forEach((h, i) => {
    const c = ws.getCell(headerRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: BRAND.branco } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.verde } };
    c.alignment = { horizontal: 'center' };
  });

  sorted.forEach((a, i) => {
    const r = headerRow + 1 + i;
    ws.getCell(r, 1).value = SEV_LABEL[a.severity] ?? a.severity;
    ws.getCell(r, 2).value = a.detector;
    ws.getCell(r, 3).value = a.data;
    ws.getCell(r, 4).value = a.title;
    ws.getCell(r, 5).value = a.description;
    ws.getCell(r, 6).value = a.acaoSugerida ?? '';
  });

  [12, 10, 12, 50, 60, 50].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}
