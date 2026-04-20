import { useCallback } from 'react';
import ExcelJS from 'exceljs';
import type { Apontamento, Colaborador, Obra, EtapaObra } from '../../types';
import ImportExcelModal, { parseData, parseStr, type ParsedRow } from '../ui/ImportExcelModal';
import { gerarId, calcHoras, hojeStr } from './helpers';

interface ImportApontamentosModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (apontamentos: Apontamento[]) => void;
  colaboradores: Colaborador[];
  obras: Obra[];
  etapas: EtapaObra[];
  criadoPor: string;
}

const TEMPLATE_DATA = [
  ['Colaborador', 'Data', 'Obra', 'Etapa', 'Hora Inicio', 'Hora Fim', 'Status', 'Observacoes'],
  ['', '', '', '', '07:00', '17:00', 'encerrado', ''],
];

const STATUS_LABELS = ['encerrado', 'aberto', 'falta', 'licenca_medica', 'ferias', 'manutencao', 'ocioso'];

function parseHora(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'number') {
    const totalMinutes = Math.round(raw * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const str = String(raw).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return str;
}

const STATUS_VALIDOS = ['aberto', 'encerrado', 'falta', 'licenca_medica', 'ferias', 'manutencao', 'ocioso'];
const STATUS_AUSENCIA = ['falta', 'licenca_medica', 'ferias', 'manutencao', 'ocioso'];

const TEMPLATE_ROWS = 200;

export default function ImportApontamentosModal({
  open,
  onClose,
  onImport,
  colaboradores,
  obras,
  etapas,
  criadoPor,
}: ImportApontamentosModalProps) {
  const hoje = hojeStr();

  const colabMap = new Map(colaboradores.map((c) => [c.nome.toLowerCase().trim(), c.id]));
  const obraMap = new Map(obras.map((o) => [o.nome.toLowerCase().trim(), o.id]));
  const etapaMap = new Map(etapas.map((e) => [`${e.obraId}::${e.nome.toLowerCase().trim()}`, e.id]));

  const handleDownloadTemplate = useCallback(async () => {
    const wb = new ExcelJS.Workbook();
    const colabNomes = colaboradores.map((c) => c.nome).sort();
    const obraNomes = obras.map((o) => o.nome).sort();
    const etapaNomes = [...new Set(etapas.map((e) => e.nome))].sort();

    // -- Main sheet (first) --
    const wsMain = wb.addWorksheet('Apontamentos');
    wsMain.columns = [
      { header: 'Colaborador', width: 25 },
      { header: 'Data', width: 15 },
      { header: 'Obra', width: 25 },
      { header: 'Etapa', width: 20 },
      { header: 'Hora Inicio', width: 15 },
      { header: 'Hora Fim', width: 15 },
      { header: 'Status', width: 18 },
      { header: 'Observacoes', width: 30 },
    ];
    const headerRow = wsMain.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    wsMain.addRow(['', '', '', '', '07:00', '17:00', 'encerrado', '']);

    // -- Sheet "Dados" with option lists --
    const wsDados = wb.addWorksheet('Dados');
    wsDados.columns = [
      { header: 'Colaboradores', width: 30 },
      { header: 'Obras', width: 30 },
      { header: 'Etapas', width: 25 },
      { header: 'Status', width: 20 },
    ];
    const maxRows = Math.max(colabNomes.length, obraNomes.length, etapaNomes.length, STATUS_LABELS.length);
    for (let i = 0; i < maxRows; i++) {
      wsDados.addRow([colabNomes[i] ?? '', obraNomes[i] ?? '', etapaNomes[i] ?? '', STATUS_LABELS[i] ?? '']);
    }

    // -- Data Validations (dropdowns) --
    const colabRef = `'Dados'!$A$2:$A$${colabNomes.length + 1}`;
    const obraRef = `'Dados'!$B$2:$B$${obraNomes.length + 1}`;
    const etapaRef = `'Dados'!$C$2:$C$${etapaNomes.length + 1}`;
    const statusRef = `'Dados'!$D$2:$D$${STATUS_LABELS.length + 1}`;

    for (let r = 2; r <= TEMPLATE_ROWS; r++) {
      wsMain.getCell(`A${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [colabRef],
        showErrorMessage: true, errorTitle: 'Valor invalido', error: 'Selecione um colaborador da lista.',
      };
      wsMain.getCell(`C${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [obraRef],
        showErrorMessage: true, errorTitle: 'Valor invalido', error: 'Selecione uma obra da lista.',
      };
      wsMain.getCell(`D${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [etapaRef],
        showErrorMessage: true, errorTitle: 'Valor invalido', error: 'Selecione uma etapa da lista.',
      };
      wsMain.getCell(`G${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [statusRef],
        showErrorMessage: true, errorTitle: 'Valor invalido', error: 'Selecione um status da lista.',
      };
    }

    // Generate and download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_apontamentos_colaboradores.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }, [colaboradores, obras, etapas]);

  const parseRow = useCallback(
    (row: unknown[]): ParsedRow => {
      const erros: string[] = [];

      const colaboradorNome = parseStr(row[0]);
      const dataRaw = parseData(row[1]);
      const obraNome = parseStr(row[2]);
      const etapaNome = parseStr(row[3]);
      const horaInicio = parseHora(row[4]);
      const horaFim = parseHora(row[5]);
      const statusRaw = parseStr(row[6]).toLowerCase().replace(/\s+/g, '_').replace(/é/g, 'e').replace(/ç/g, 'c');
      const observacoes = parseStr(row[7]);

      if (!colaboradorNome) erros.push('Colaborador vazio');
      const colaboradorId = colabMap.get(colaboradorNome.toLowerCase().trim()) || '';
      if (colaboradorNome && !colaboradorId) erros.push(`Colaborador "${colaboradorNome}" não encontrado`);

      if (!dataRaw) erros.push('Data vazia');
      if (dataRaw && dataRaw > hoje) erros.push('Data futura não permitida');

      const status = statusRaw || 'encerrado';
      if (!STATUS_VALIDOS.includes(status)) erros.push(`Status "${parseStr(row[6])}" inválido`);

      const isAusencia = STATUS_AUSENCIA.includes(status);

      let obraId = '';
      let etapaId = '';
      if (!isAusencia) {
        if (!obraNome) erros.push('Obra vazia (obrigatória para registros de trabalho)');
        obraId = obraMap.get(obraNome.toLowerCase().trim()) || '';
        if (obraNome && !obraId) erros.push(`Obra "${obraNome}" não encontrada`);

        if (!etapaNome) erros.push('Etapa vazia (obrigatória para registros de trabalho)');
        if (obraId && etapaNome) {
          etapaId = etapaMap.get(`${obraId}::${etapaNome.toLowerCase().trim()}`) || '';
          if (!etapaId) erros.push(`Etapa "${etapaNome}" não encontrada na obra "${obraNome}"`);
        }

        if (!horaInicio) erros.push('Hora Início vazia');
        if (!horaFim && status === 'encerrado') erros.push('Hora Fim vazia para status encerrado');

        if (horaInicio && horaFim) {
          const horas = calcHoras(horaInicio, horaFim);
          if (horas <= 0) erros.push('Hora Fim deve ser maior que Hora Início');
        }
      }

      const horasTrabalhadas = horaInicio && horaFim ? calcHoras(horaInicio, horaFim) : 0;

      const resumoParts = [colaboradorNome || '(sem nome)'];
      if (dataRaw) {
        const [y, m, d] = dataRaw.split('-');
        resumoParts.push(`${d}/${m}/${y}`);
      }
      if (isAusencia) {
        resumoParts.push(parseStr(row[6]) || status);
      } else {
        resumoParts.push(obraNome || '(sem obra)');
        if (horaInicio && horaFim) resumoParts.push(`${horaInicio}-${horaFim}`);
      }

      return {
        valido: erros.length === 0,
        erros,
        resumo: resumoParts.join(' | '),
        dados: {
          colaboradorId,
          data: dataRaw,
          obraId,
          etapaId,
          horaInicio: isAusencia ? '' : horaInicio,
          horaFim: isAusencia ? '' : horaFim,
          horasTrabalhadas: isAusencia ? 0 : horasTrabalhadas,
          status,
          observacoes,
        },
      };
    },
    [colabMap, obraMap, etapaMap, hoje]
  );

  const toEntity = useCallback(
    (row: ParsedRow): Record<string, unknown> => {
      const d = row.dados;
      const apontamento: Apontamento = {
        id: gerarId(),
        data: d.data as string,
        horaInicio: d.horaInicio as string,
        horaFim: d.horaFim as string,
        obraId: d.obraId as string,
        etapaObraId: d.etapaId as string,
        equipamentoId: '',
        colaboradorId: d.colaboradorId as string,
        tipo: 'colaborador',
        horasTrabalhadas: d.horasTrabalhadas as number,
        observacoes: d.observacoes as string,
        status: d.status as Apontamento['status'],
        criadoPor,
      };
      return apontamento as unknown as Record<string, unknown>;
    },
    [criadoPor]
  );

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={(items) => onImport(items as unknown as Apontamento[])}
      title="Importar Apontamentos de Colaboradores"
      entityLabel="Registro"
      templateData={TEMPLATE_DATA}
      templateFileName="template_apontamentos_colaboradores.xlsx"
      sheetName="Apontamentos"
      templateColWidths={[25, 15, 25, 20, 15, 15, 18, 30]}
      formatHintHeaders={['Colaborador', 'Data', 'Obra', 'Etapa', 'Hr Início', 'Hr Fim', 'Status', 'Obs']}
      formatHintExample={['(dropdown)', 'DD/MM/AAAA', '(dropdown)', '(dropdown)', '07:00', '17:00', '(dropdown)', '']}
      parseRow={parseRow}
      toEntity={toEntity}
      onDownloadTemplate={handleDownloadTemplate}
    />
  );
}
