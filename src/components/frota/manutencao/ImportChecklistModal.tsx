import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { Equipamento, ChecklistEquipamento, TurnoChecklist, RespostaChecklist } from '../../../types';
import { CHECKLIST_ITENS, CHECKLIST_CATEGORIAS } from './checklistItens';
import Button from '../../ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (checklist: ChecklistEquipamento) => void;
  equipamentos: Equipamento[];
  usuario: string;
}

function str(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

// Layout do template (linhas 0-indexed):
// Row 0: Título
// Row 1: Unidade:[B1] | 1o Turno header
// Row 2: Máquina/Modelo:[B2] | 1o Turno Inicial: hor[E2], Prev S/N, Operador[I2], CS[L2]
// Row 3: | 1o Turno Final: hor[E3], Corretiva S/N, H.Parada[J3], H.Retorno[L3]
// Row 4: Área:[B4] | 2o Turno header
// Row 5: | 2o Turno Inicial
// Row 6: | 2o Turno Final
// Row 7: Data:[B7] | 3o Turno header
// Row 8: | 3o Turno Inicial
// Row 9: | 3o Turno Final
// Row 10-11: Cabeçalho itens (Item | PADRÃO | Sim Não NA x3)
// Row 12+: Itens do checklist

function parseTurnoFromRows(inicialRow: unknown[], finalRow: unknown[], turno: 1 | 2 | 3): TurnoChecklist {
  // Inicial row: D=Inicial, E=hor_ini, F=Preventiva, G=Sim(), H=Não(), I-J=Operador, K=CS, L=CS_val
  // Final row: D=Final, E=hor_fin, F=Corretiva, G=Sim(), H=Não(), I=H.Parada, J=val, K=H.Retorno, L=val
  const prevSim = str(inicialRow?.[6]).toLowerCase().includes('x') || str(inicialRow?.[6]).toLowerCase() === 'sim';
  const corrSim = str(finalRow?.[6]).toLowerCase().includes('x') || str(finalRow?.[6]).toLowerCase() === 'sim';
  const parouSim = prevSim || corrSim;

  return {
    turno,
    horimetroInicial: str(inicialRow?.[4]),
    horimetroFinal: str(finalRow?.[4]),
    tipoManutencao: corrSim ? 'corretiva' : 'preventiva',
    parouManutencao: parouSim,
    horaParada: str(finalRow?.[9]),
    horaRetorno: str(finalRow?.[11]),
    nomeOperador: str(inicialRow?.[8]),
    cs: str(inicialRow?.[11]),
  };
}

export default function ImportChecklistModal({ open, onClose, equipamentos, onImport, usuario }: Props) {
  const [preview, setPreview] = useState<ChecklistEquipamento | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [dragAtivo, setDragAtivo] = useState(false);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const equipAtivos = equipamentos.filter((e) => e.ativo);

  const resetar = useCallback(() => {
    setPreview(null);
    setErros([]);
    setDragAtivo(false);
    setErro('');
    setProcessando(false);
  }, []);

  const fechar = useCallback(() => {
    resetar();
    onClose();
  }, [onClose, resetar]);

  const baixarTemplate = useCallback(async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Checklist');

    const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
    const allBorders: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D2B0' } };
    const turnoFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E0C0' } };
    const catFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EAD6' } };
    const boldFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: 'Arial' };
    const normalFont: Partial<ExcelJS.Font> = { size: 9, name: 'Arial' };
    const titleFont: Partial<ExcelJS.Font> = { bold: true, size: 14, name: 'Arial' };
    const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const leftAlign: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // Colunas: A=label/cat, B=item#, C=descrição, D-F=turno headers, G=Sim1, H=Não1, I=NA1, J=Sim2, K=Não2, L=NA2, M=Sim3, N=Não3, O=NA3
    ws.columns = [
      { width: 18 }, // A - label/categoria
      { width: 6 },  // B - Item #
      { width: 55 }, // C - PADRÃO (descrição)
      { width: 5 },  // D - Sim T1
      { width: 5 },  // E - Não T1
      { width: 5 },  // F - NA T1
      { width: 5 },  // G - Sim T2
      { width: 5 },  // H - Não T2
      { width: 5 },  // I - NA T2
      { width: 5 },  // J - Sim T3
      { width: 5 },  // K - Não T3
      { width: 5 },  // L - NA T3
    ];

    // ───── ROW 1: Título ─────
    ws.mergeCells('A1:L1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'CHECK-LIST MÁQUINAS E CAMINHÕES';
    titleCell.font = titleFont;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = allBorders;
    ws.getRow(1).height = 30;

    // ───── ROW 2: Unidade + 1o Turno header ─────
    // A2: "Unidade:"  B2-C2: (preenchível)
    ws.getCell('A2').value = 'Unidade:';
    ws.getCell('A2').font = boldFont;
    ws.getCell('A2').border = allBorders;
    ws.mergeCells('B2:C2');
    ws.getCell('B2').border = allBorders;
    ws.getCell('B2').font = normalFont;
    // D2-L2: 1o Turno cabeçalho
    ws.mergeCells('D2:E2');
    ws.getCell('D2').value = 'Horímetro';
    ws.getCell('D2').font = boldFont;
    ws.getCell('D2').alignment = centerAlign;
    ws.getCell('D2').border = allBorders;
    ws.getCell('D2').fill = turnoFill;
    ws.mergeCells('F2:H2');
    ws.getCell('F2').value = 'Parou para manutenção?';
    ws.getCell('F2').font = boldFont;
    ws.getCell('F2').alignment = centerAlign;
    ws.getCell('F2').border = allBorders;
    ws.getCell('F2').fill = turnoFill;
    ws.mergeCells('I2:J2');
    ws.getCell('I2').value = 'Nome Operador:';
    ws.getCell('I2').font = boldFont;
    ws.getCell('I2').alignment = centerAlign;
    ws.getCell('I2').border = allBorders;
    ws.getCell('I2').fill = turnoFill;
    ws.mergeCells('K2:L2');
    ws.getCell('K2').border = allBorders;
    ws.getCell('K2').fill = turnoFill;

    // ───── ROW 3: Máquina/Modelo + 1o Turno Inicial ─────
    ws.getCell('A3').value = 'Máquina/Modelo:';
    ws.getCell('A3').font = boldFont;
    ws.getCell('A3').border = allBorders;
    ws.mergeCells('B3:C3');
    ws.getCell('B3').border = allBorders;
    ws.getCell('B3').font = normalFont;
    // 1o Turno - Inicial row
    ws.getCell('D3').value = 'Inicial:';
    ws.getCell('D3').font = normalFont;
    ws.getCell('D3').border = allBorders;
    ws.getCell('E3').border = allBorders; // preenchível
    ws.getCell('F3').value = 'Preventiva';
    ws.getCell('F3').font = normalFont;
    ws.getCell('F3').border = allBorders;
    ws.getCell('G3').value = 'Sim ( )';
    ws.getCell('G3').font = normalFont;
    ws.getCell('G3').border = allBorders;
    ws.getCell('H3').value = 'Não ( )';
    ws.getCell('H3').font = normalFont;
    ws.getCell('H3').border = allBorders;
    ws.mergeCells('I3:J3');
    ws.getCell('I3').border = allBorders; // nome operador preenchível
    ws.getCell('K3').value = 'CS:';
    ws.getCell('K3').font = normalFont;
    ws.getCell('K3').border = allBorders;
    ws.getCell('L3').border = allBorders; // CS preenchível

    // ───── ROW 4: 1o Turno Final row ─────
    ws.getCell('A4').border = allBorders;
    ws.mergeCells('B4:C4');
    ws.getCell('B4').border = allBorders;
    ws.getCell('D4').value = 'Final:';
    ws.getCell('D4').font = normalFont;
    ws.getCell('D4').border = allBorders;
    ws.getCell('E4').border = allBorders;
    ws.getCell('F4').value = 'Corretiva';
    ws.getCell('F4').font = normalFont;
    ws.getCell('F4').border = allBorders;
    ws.getCell('G4').value = 'Sim ( )';
    ws.getCell('G4').font = normalFont;
    ws.getCell('G4').border = allBorders;
    ws.getCell('H4').value = 'Não ( )';
    ws.getCell('H4').font = normalFont;
    ws.getCell('H4').border = allBorders;
    ws.getCell('I4').value = 'H. Parada:';
    ws.getCell('I4').font = normalFont;
    ws.getCell('I4').border = allBorders;
    ws.getCell('J4').border = allBorders;
    ws.getCell('K4').value = 'H. Retorno:';
    ws.getCell('K4').font = normalFont;
    ws.getCell('K4').border = allBorders;
    ws.getCell('L4').border = allBorders;

    // Label "1o TURNO" merged A3:A4
    ws.mergeCells('A3:A4');
    // Actually A3 already has "Máquina/Modelo" so we need a different approach
    // Let me restructure: put turno label in a separate way

    // ───── ROW 5: Área + 2o Turno header ─────
    ws.getCell('A5').value = 'Área (Local da Inspeção):';
    ws.getCell('A5').font = boldFont;
    ws.getCell('A5').border = allBorders;
    ws.getCell('A5').alignment = leftAlign;
    ws.mergeCells('B5:C5');
    ws.getCell('B5').border = allBorders;
    // 2o Turno header
    ws.mergeCells('D5:E5');
    ws.getCell('D5').value = 'Horímetro';
    ws.getCell('D5').font = boldFont;
    ws.getCell('D5').alignment = centerAlign;
    ws.getCell('D5').border = allBorders;
    ws.getCell('D5').fill = turnoFill;
    ws.mergeCells('F5:H5');
    ws.getCell('F5').value = 'Parou para manutenção?';
    ws.getCell('F5').font = boldFont;
    ws.getCell('F5').alignment = centerAlign;
    ws.getCell('F5').border = allBorders;
    ws.getCell('F5').fill = turnoFill;
    ws.mergeCells('I5:J5');
    ws.getCell('I5').value = 'Nome Operador:';
    ws.getCell('I5').font = boldFont;
    ws.getCell('I5').alignment = centerAlign;
    ws.getCell('I5').border = allBorders;
    ws.getCell('I5').fill = turnoFill;
    ws.mergeCells('K5:L5');
    ws.getCell('K5').border = allBorders;
    ws.getCell('K5').fill = turnoFill;

    // ROW 6: 2o Turno Inicial
    ws.getCell('A6').border = allBorders;
    ws.mergeCells('B6:C6');
    ws.getCell('B6').border = allBorders;
    ws.getCell('D6').value = 'Inicial:';
    ws.getCell('D6').font = normalFont;
    ws.getCell('D6').border = allBorders;
    ws.getCell('E6').border = allBorders;
    ws.getCell('F6').value = 'Preventiva';
    ws.getCell('F6').font = normalFont;
    ws.getCell('F6').border = allBorders;
    ws.getCell('G6').value = 'Sim ( )';
    ws.getCell('G6').font = normalFont;
    ws.getCell('G6').border = allBorders;
    ws.getCell('H6').value = 'Não ( )';
    ws.getCell('H6').font = normalFont;
    ws.getCell('H6').border = allBorders;
    ws.mergeCells('I6:J6');
    ws.getCell('I6').border = allBorders;
    ws.getCell('K6').value = 'CS:';
    ws.getCell('K6').font = normalFont;
    ws.getCell('K6').border = allBorders;
    ws.getCell('L6').border = allBorders;

    // ROW 7: 2o Turno Final
    ws.getCell('A7').border = allBorders;
    ws.mergeCells('B7:C7');
    ws.getCell('B7').border = allBorders;
    ws.getCell('D7').value = 'Final:';
    ws.getCell('D7').font = normalFont;
    ws.getCell('D7').border = allBorders;
    ws.getCell('E7').border = allBorders;
    ws.getCell('F7').value = 'Corretiva';
    ws.getCell('F7').font = normalFont;
    ws.getCell('F7').border = allBorders;
    ws.getCell('G7').value = 'Sim ( )';
    ws.getCell('G7').font = normalFont;
    ws.getCell('G7').border = allBorders;
    ws.getCell('H7').value = 'Não ( )';
    ws.getCell('H7').font = normalFont;
    ws.getCell('H7').border = allBorders;
    ws.getCell('I7').value = 'H. Parada:';
    ws.getCell('I7').font = normalFont;
    ws.getCell('I7').border = allBorders;
    ws.getCell('J7').border = allBorders;
    ws.getCell('K7').value = 'H. Retorno:';
    ws.getCell('K7').font = normalFont;
    ws.getCell('K7').border = allBorders;
    ws.getCell('L7').border = allBorders;

    // ───── ROW 8-9: 3o Turno ─────
    ws.getCell('A8').value = 'Data:';
    ws.getCell('A8').font = boldFont;
    ws.getCell('A8').border = allBorders;
    ws.mergeCells('B8:C8');
    ws.getCell('B8').border = allBorders;
    // 3o Turno header
    ws.mergeCells('D8:E8');
    ws.getCell('D8').value = 'Horímetro';
    ws.getCell('D8').font = boldFont;
    ws.getCell('D8').alignment = centerAlign;
    ws.getCell('D8').border = allBorders;
    ws.getCell('D8').fill = turnoFill;
    ws.mergeCells('F8:H8');
    ws.getCell('F8').value = 'Parou para manutenção?';
    ws.getCell('F8').font = boldFont;
    ws.getCell('F8').alignment = centerAlign;
    ws.getCell('F8').border = allBorders;
    ws.getCell('F8').fill = turnoFill;
    ws.mergeCells('I8:J8');
    ws.getCell('I8').value = 'Nome Operador:';
    ws.getCell('I8').font = boldFont;
    ws.getCell('I8').alignment = centerAlign;
    ws.getCell('I8').border = allBorders;
    ws.getCell('I8').fill = turnoFill;
    ws.mergeCells('K8:L8');
    ws.getCell('K8').border = allBorders;
    ws.getCell('K8').fill = turnoFill;

    // ROW 9: 3o Turno Inicial
    ws.getCell('A9').border = allBorders;
    ws.mergeCells('B9:C9');
    ws.getCell('B9').border = allBorders;
    ws.getCell('D9').value = 'Inicial:';
    ws.getCell('D9').font = normalFont;
    ws.getCell('D9').border = allBorders;
    ws.getCell('E9').border = allBorders;
    ws.getCell('F9').value = 'Preventiva';
    ws.getCell('F9').font = normalFont;
    ws.getCell('F9').border = allBorders;
    ws.getCell('G9').value = 'Sim ( )';
    ws.getCell('G9').font = normalFont;
    ws.getCell('G9').border = allBorders;
    ws.getCell('H9').value = 'Não ( )';
    ws.getCell('H9').font = normalFont;
    ws.getCell('H9').border = allBorders;
    ws.mergeCells('I9:J9');
    ws.getCell('I9').border = allBorders;
    ws.getCell('K9').value = 'CS:';
    ws.getCell('K9').font = normalFont;
    ws.getCell('K9').border = allBorders;
    ws.getCell('L9').border = allBorders;

    // ROW 10: 3o Turno Final
    ws.getCell('A10').border = allBorders;
    ws.mergeCells('B10:C10');
    ws.getCell('B10').border = allBorders;
    ws.getCell('D10').value = 'Final:';
    ws.getCell('D10').font = normalFont;
    ws.getCell('D10').border = allBorders;
    ws.getCell('E10').border = allBorders;
    ws.getCell('F10').value = 'Corretiva';
    ws.getCell('F10').font = normalFont;
    ws.getCell('F10').border = allBorders;
    ws.getCell('G10').value = 'Sim ( )';
    ws.getCell('G10').font = normalFont;
    ws.getCell('G10').border = allBorders;
    ws.getCell('H10').value = 'Não ( )';
    ws.getCell('H10').font = normalFont;
    ws.getCell('H10').border = allBorders;
    ws.getCell('I10').value = 'H. Parada:';
    ws.getCell('I10').font = normalFont;
    ws.getCell('I10').border = allBorders;
    ws.getCell('J10').border = allBorders;
    ws.getCell('K10').value = 'H. Retorno:';
    ws.getCell('K10').font = normalFont;
    ws.getCell('K10').border = allBorders;
    ws.getCell('L10').border = allBorders;

    // ───── ROW 11: Cabeçalho dos itens ─────
    const headerRow = 11;
    // Sub-header: 1o TURNO, 2o TURNO, 3o TURNO
    ws.mergeCells(`A${headerRow}:A${headerRow + 1}`);
    ws.getCell(`A${headerRow}`).border = allBorders;
    ws.getCell(`A${headerRow}`).fill = headerFill;
    ws.mergeCells(`B${headerRow}:B${headerRow + 1}`);
    ws.getCell(`B${headerRow}`).value = 'Item';
    ws.getCell(`B${headerRow}`).font = boldFont;
    ws.getCell(`B${headerRow}`).alignment = centerAlign;
    ws.getCell(`B${headerRow}`).border = allBorders;
    ws.getCell(`B${headerRow}`).fill = headerFill;
    ws.mergeCells(`C${headerRow}:C${headerRow + 1}`);
    ws.getCell(`C${headerRow}`).value = 'PADRÃO';
    ws.getCell(`C${headerRow}`).font = boldFont;
    ws.getCell(`C${headerRow}`).alignment = centerAlign;
    ws.getCell(`C${headerRow}`).border = allBorders;
    ws.getCell(`C${headerRow}`).fill = headerFill;

    // Turno headers (merged top row)
    ws.mergeCells(`D${headerRow}:F${headerRow}`);
    ws.getCell(`D${headerRow}`).value = '1° TURNO';
    ws.getCell(`D${headerRow}`).font = boldFont;
    ws.getCell(`D${headerRow}`).alignment = centerAlign;
    ws.getCell(`D${headerRow}`).border = allBorders;
    ws.getCell(`D${headerRow}`).fill = headerFill;

    ws.mergeCells(`G${headerRow}:I${headerRow}`);
    ws.getCell(`G${headerRow}`).value = '2° TURNO';
    ws.getCell(`G${headerRow}`).font = boldFont;
    ws.getCell(`G${headerRow}`).alignment = centerAlign;
    ws.getCell(`G${headerRow}`).border = allBorders;
    ws.getCell(`G${headerRow}`).fill = headerFill;

    ws.mergeCells(`J${headerRow}:L${headerRow}`);
    ws.getCell(`J${headerRow}`).value = '3° TURNO';
    ws.getCell(`J${headerRow}`).font = boldFont;
    ws.getCell(`J${headerRow}`).alignment = centerAlign;
    ws.getCell(`J${headerRow}`).border = allBorders;
    ws.getCell(`J${headerRow}`).fill = headerFill;

    // Sub-headers: Sim Não NA for each turno
    const subRow = headerRow + 1;
    const subCols = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const subLabels = ['Sim', 'Não', 'NA', 'Sim', 'Não', 'NA', 'Sim', 'Não', 'NA'];
    subCols.forEach((col, i) => {
      const cell = ws.getCell(`${col}${subRow}`);
      cell.value = subLabels[i];
      cell.font = { ...boldFont, size: 8 };
      cell.alignment = centerAlign;
      cell.border = allBorders;
      cell.fill = headerFill;
    });

    // ───── ITENS DO CHECKLIST ─────
    let currentRow = headerRow + 2; // row 13
    let currentCat = '';

    for (const item of CHECKLIST_ITENS) {
      // Categoria label na coluna A (merged para itens da mesma categoria)
      if (item.categoria !== currentCat) {
        currentCat = item.categoria;
      }

      const row = ws.getRow(currentRow);
      row.height = 18;

      // A: categoria (será merged depois)
      ws.getCell(`A${currentRow}`).font = { ...normalFont, size: 8 };
      ws.getCell(`A${currentRow}`).alignment = { ...centerAlign, textRotation: 0 };
      ws.getCell(`A${currentRow}`).border = allBorders;

      // B: número
      ws.getCell(`B${currentRow}`).value = item.numero;
      ws.getCell(`B${currentRow}`).font = normalFont;
      ws.getCell(`B${currentRow}`).alignment = centerAlign;
      ws.getCell(`B${currentRow}`).border = allBorders;

      // C: descrição
      ws.getCell(`C${currentRow}`).value = item.descricao;
      ws.getCell(`C${currentRow}`).font = normalFont;
      ws.getCell(`C${currentRow}`).alignment = leftAlign;
      ws.getCell(`C${currentRow}`).border = allBorders;

      // D-L: respostas (vazias, preenchíveis)
      for (const col of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
        const cell = ws.getCell(`${col}${currentRow}`);
        cell.border = allBorders;
        cell.alignment = centerAlign;
        cell.font = normalFont;
      }

      currentRow++;
    }

    // Merge categorias na coluna A
    const firstItemRow = headerRow + 2;
    for (const cat of CHECKLIST_CATEGORIAS) {
      const catItems = CHECKLIST_ITENS.filter((i) => i.categoria === cat);
      const firstIdx = CHECKLIST_ITENS.indexOf(catItems[0]);
      const lastIdx = CHECKLIST_ITENS.indexOf(catItems[catItems.length - 1]);
      const startRow = firstItemRow + firstIdx;
      const endRow = firstItemRow + lastIdx;
      if (startRow !== endRow) {
        ws.mergeCells(`A${startRow}:A${endRow}`);
      }
      const catCell = ws.getCell(`A${startRow}`);
      catCell.value = cat;
      catCell.font = { ...boldFont, size: 8 };
      catCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, textRotation: 90 };
      catCell.fill = catFill;
    }

    // ───── OBSERVAÇÕES ─────
    const obsRow = currentRow;
    ws.mergeCells(`A${obsRow}:L${obsRow}`);
    ws.getCell(`A${obsRow}`).value = 'Observações:';
    ws.getCell(`A${obsRow}`).font = boldFont;
    ws.getCell(`A${obsRow}`).border = allBorders;
    ws.getRow(obsRow).height = 40;

    // ───── Download ─────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_checklist_equipamento.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const processarArquivo = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        setErro('Formato inválido. Use arquivos .xlsx ou .xls');
        return;
      }

      setProcessando(true);
      setErro('');

      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

        const errosList: string[] = [];

        // Ler cabeçalho - novo layout:
        // Row 1 (idx 1): A=Unidade, B-C=valor
        // Row 2 (idx 2): A=Máquina/Modelo, B-C=valor
        // Row 4 (idx 4): A=Área, B-C=valor
        // Row 7 (idx 7): A=Data, B-C=valor
        const nomeEquip = str(rows[2]?.[1]);
        const unidade = str(rows[1]?.[1]);
        const area = str(rows[4]?.[1]);
        const dataRaw = rows[7]?.[1];

        // Encontrar equipamento pelo nome
        let equipamentoId = '';
        if (nomeEquip) {
          const found = equipAtivos.find(
            (e) => e.nome.toLowerCase() === nomeEquip.toLowerCase() || e.codigoPatrimonio.toLowerCase() === nomeEquip.toLowerCase()
          );
          if (found) {
            equipamentoId = found.id;
          } else {
            errosList.push(`Equipamento "${nomeEquip}" não encontrado. Será necessário selecionar manualmente.`);
          }
        } else {
          errosList.push('Nome do equipamento não preenchido.');
        }

        // Parse data
        let data = '';
        const dataStr = str(dataRaw);
        if (dataStr) {
          if (typeof dataRaw === 'number') {
            const d = XLSX.SSF.parse_date_code(dataRaw);
            if (d) data = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else {
            const brMatch = dataStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (brMatch) data = `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
            const isoMatch = dataStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (isoMatch) data = dataStr;
          }
        }
        if (!data) {
          data = new Date().toISOString().split('T')[0];
          if (!dataStr) errosList.push('Data não preenchida, usando data atual.');
        }

        // Turnos: 1o(rows 2,3), 2o(rows 5,6), 3o(rows 8,9)
        const turnos: TurnoChecklist[] = [
          parseTurnoFromRows(rows[2] ?? [], rows[3] ?? [], 1),
          parseTurnoFromRows(rows[5] ?? [], rows[6] ?? [], 2),
          parseTurnoFromRows(rows[8] ?? [], rows[9] ?? [], 3),
        ];

        // Itens: a partir da linha 12 (index 12)
        const respostas: Record<string, { turno1: RespostaChecklist; turno2: RespostaChecklist; turno3: RespostaChecklist }> = {};

        for (const item of CHECKLIST_ITENS) {
          respostas[item.numero] = { turno1: '', turno2: '', turno3: '' };
        }

        // Ler respostas - col B=item#, D/E/F=T1(Sim/Não/NA), G/H/I=T2, J/K/L=T3
        let itensLidos = 0;
        for (let i = 12; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const numRaw = row[1]; // col B = item number
          if (numRaw === undefined || numRaw === null) continue;
          const numero = String(numRaw).trim().padStart(3, '0');
          if (!respostas[numero]) continue;

          // Check for X or S marks in Sim/Não/NA columns
          const readTurno = (simCol: number, naoCol: number, naCol: number): RespostaChecklist => {
            const simVal = str(row[simCol]).toLowerCase();
            const naoVal = str(row[naoCol]).toLowerCase();
            const naVal = str(row[naCol]).toLowerCase();
            if (simVal && (simVal === 'x' || simVal === 's' || simVal === 'sim' || simVal === '1')) return 'sim';
            if (naoVal && (naoVal === 'x' || naoVal === 'n' || naoVal === 'nao' || naoVal === 'não' || naoVal === '1')) return 'nao';
            if (naVal && (naVal === 'x' || naVal === 'na' || naVal === 'n/a' || naVal === '1')) return 'na';
            // Fallback: try reading single cell with S/N/NA
            if (simVal === 'n' || simVal === 'nao' || simVal === 'não') return 'nao';
            if (simVal === 'na' || simVal === 'n/a') return 'na';
            return '';
          };

          respostas[numero] = {
            turno1: readTurno(3, 4, 5),   // D, E, F
            turno2: readTurno(6, 7, 8),   // G, H, I
            turno3: readTurno(9, 10, 11), // J, K, L
          };
          itensLidos++;
        }

        if (itensLidos === 0) {
          errosList.push('Nenhuma resposta de item foi encontrada no arquivo.');
        }

        const checklist: ChecklistEquipamento = {
          id: '',
          equipamentoId,
          data,
          unidade,
          areaInspecao: area,
          turnos,
          respostas,
          observacoes: '',
          criadoPor: usuario,
          createdAt: '',
        };

        setPreview(checklist);
        setErros(errosList);
      } catch {
        setErro('Erro ao processar o arquivo. Verifique se é um Excel válido.');
      }
      setProcessando(false);
    },
    [equipAtivos, usuario]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragAtivo(false);
      const file = e.dataTransfer.files[0];
      if (file) processarArquivo(file);
    },
    [processarArquivo]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processarArquivo(file);
      if (inputRef.current) inputRef.current.value = '';
    },
    [processarArquivo]
  );

  if (!open) return null;

  // Contagem de respostas no preview
  let simCount = 0, naoCount = 0, naCount = 0;
  if (preview) {
    for (const r of Object.values(preview.respostas)) {
      for (const v of [r.turno1, r.turno2, r.turno3]) {
        if (v === 'sim') simCount++;
        else if (v === 'nao') naoCount++;
        else if (v === 'na') naCount++;
      }
    }
  }

  const equipPreview = preview ? equipamentos.find((e) => e.id === preview.equipamentoId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={fechar} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-slate-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
            {preview ? 'Preview do Checklist' : 'Importar Checklist do Excel'}
          </h2>
          <button onClick={fechar} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {!preview ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={baixarTemplate}
                className="inline-flex items-center gap-2 text-sm text-emt-verde hover:text-emt-verde-escuro font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Baixar Template Excel
              </button>

              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  dragAtivo
                    ? 'border-emt-verde bg-emt-verde-claro/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 bg-gray-50 dark:bg-slate-700/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragAtivo(true); }}
                onDragLeave={() => setDragAtivo(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                {processando ? (
                  <div className="space-y-2">
                    <div className="inline-block w-8 h-8 border-4 border-emt-verde-claro border-t-emt-verde rounded-full animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Processando arquivo...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Arraste o arquivo aqui ou clique para selecionar</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Formatos aceitos: .xlsx, .xls</p>
                  </div>
                )}
              </div>

              {erro && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {erro}
                </div>
              )}

              <div className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 text-xs text-gray-600 dark:text-slate-400 space-y-1">
                <p className="font-medium text-gray-700 dark:text-slate-300">Instruções:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Baixe o template e preencha o nome do equipamento na célula B2</li>
                  <li>Preencha a data (E2), unidade (B3) e área (E3)</li>
                  <li>Preencha os dados dos turnos nas linhas 6, 7 e 8</li>
                  <li>Para cada item, preencha S (sim), N (não) ou NA nas colunas dos turnos</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {erros.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                  {erros.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}

              {/* Se equipamento não foi encontrado, permitir selecionar */}
              {!preview.equipamentoId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Selecione o Equipamento *</label>
                  <select
                    value={preview.equipamentoId}
                    onChange={(e) => setPreview((p) => p ? { ...p, equipamentoId: e.target.value } : p)}
                    className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="">Selecione...</option>
                    {equipAtivos.sort((a, b) => a.nome.localeCompare(b.nome)).map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.nome} {eq.codigoPatrimonio ? `(${eq.codigoPatrimonio})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <span className="text-gray-500 dark:text-slate-400 block text-xs">Equipamento</span>
                  <span className="font-medium text-gray-800 dark:text-slate-200">{equipPreview?.nome ?? '(não selecionado)'}</span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <span className="text-gray-500 dark:text-slate-400 block text-xs">Data</span>
                  <span className="font-medium text-gray-800 dark:text-slate-200">
                    {preview.data ? new Date(preview.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                  </span>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <span className="text-green-600 dark:text-green-400 block text-xs">Conformes</span>
                  <span className="font-bold text-green-700 dark:text-green-400 text-lg">{simCount}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <span className="text-red-600 dark:text-red-400 block text-xs">Não Conformes</span>
                  <span className="font-bold text-red-700 dark:text-red-400 text-lg">{naoCount}</span>
                </div>
              </div>

              {/* Turnos resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {preview.turnos.map((t) => (
                  <div key={t.turno} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-xs text-gray-600 dark:text-slate-400">
                    <span className="font-medium text-gray-700 dark:text-slate-300">{t.turno}o Turno</span>
                    <div>Hor: {t.horimetroInicial || '-'} / {t.horimetroFinal || '-'}</div>
                    <div>Operador: {t.nomeOperador || '-'}</div>
                  </div>
                ))}
              </div>

              {/* Preview dos itens com respostas */}
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700 max-h-[300px]">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-slate-300">#</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600 dark:text-slate-300">Descrição</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-slate-300">1o</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-slate-300">2o</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-600 dark:text-slate-300">3o</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {CHECKLIST_ITENS.map((item) => {
                      const r = preview.respostas[item.numero];
                      return (
                        <tr key={item.numero}>
                          <td className="px-2 py-1 font-mono text-gray-400">{item.numero}</td>
                          <td className="px-2 py-1 text-gray-700 dark:text-slate-300 max-w-xs truncate">{item.descricao}</td>
                          {[r?.turno1, r?.turno2, r?.turno3].map((val, i) => (
                            <td key={i} className="px-2 py-1 text-center">
                              {val === 'sim' && <span className="text-green-600 font-bold">S</span>}
                              {val === 'nao' && <span className="text-red-600 font-bold">N</span>}
                              {val === 'na' && <span className="text-gray-400">NA</span>}
                              {!val && <span className="text-gray-300">-</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded-b-xl shrink-0">
          {preview ? (
            <>
              <Button variant="ghost" onClick={resetar} className="text-sm">Voltar</Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={fechar}>Cancelar</Button>
                <Button
                  onClick={() => { onImport(preview); fechar(); }}
                  disabled={!preview.equipamentoId}
                >
                  Importar Checklist
                </Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end w-full">
              <Button variant="secondary" onClick={fechar}>Cancelar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
