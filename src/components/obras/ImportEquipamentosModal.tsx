import { useCallback } from 'react';
import type { Equipamento } from '../../types';
import ImportExcelModal, { parseNumero, parseData, parseStr, type ParsedRow } from '../ui/ImportExcelModal';

interface ImportEquipamentosModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (equipamentos: Equipamento[]) => void;
  equipamentosExistentes: Equipamento[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TEMPLATE_DATA = [
  ['Nome', 'Codigo Patrimonio', 'Numero de Serie', 'Marca', 'Ano', 'Tipo Medicao', 'Medicao Inicial', 'Data Aquisicao'],
  ['Escavadeira CAT 320', 'PAT-001', 'CAT320-2024-001', 'Caterpillar', '2024', 'horimetro', 0, '2024-01-15'],
  ['Retroescavadeira JCB 3CX', 'PAT-002', 'JCB3CX-2023-045', 'JCB', '2023', 'horimetro', 150, '2023-06-20'],
  ['Caminhao Basculante', 'PAT-003', 'VW-2022-123', 'Volkswagen', '2022', 'odometro', 45000, '2022-03-10'],
];

export default function ImportEquipamentosModal({
  open,
  onClose,
  onImport,
  equipamentosExistentes,
}: ImportEquipamentosModalProps) {
  const parseRow = useCallback(
    (row: unknown[]): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const codigoPatrimonio = parseStr(row[1]);
      const numeroSerie = parseStr(row[2]);
      const marca = parseStr(row[3]);
      const ano = parseStr(row[4]);
      const tipoMedicaoRaw = parseStr(row[5]).toLowerCase();
      const medicaoRaw = row[6];
      const dataRaw = row[7];

      if (!nome) erros.push('Nome vazio');

      let tipoMedicao = 'horimetro';
      if (tipoMedicaoRaw) {
        if (tipoMedicaoRaw === 'horimetro' || tipoMedicaoRaw === 'horímetro') {
          tipoMedicao = 'horimetro';
        } else if (tipoMedicaoRaw === 'odometro' || tipoMedicaoRaw === 'odômetro' || tipoMedicaoRaw === 'km') {
          tipoMedicao = 'odometro';
        } else {
          erros.push('Tipo medicao invalido (use horimetro ou odometro)');
        }
      }

      const medicaoInicial = parseNumero(medicaoRaw) ?? 0;

      const dataAquisicao = parseData(dataRaw) || '';

      // Resolver duplicatas
      let nomeFinal = nome;
      const nomeLower = nome.toLowerCase();
      const count = equipamentosExistentes.filter((e) => e.nome.toLowerCase() === nomeLower).length;
      if (count > 0) nomeFinal = `${nome} ${count + 1}`;

      const resumoParts = [nomeFinal || '(sem nome)'];
      if (marca) resumoParts.push(marca);
      if (tipoMedicao) resumoParts.push(tipoMedicao);
      if (medicaoInicial) resumoParts.push(`${medicaoInicial} ${tipoMedicao === 'horimetro' ? 'h' : 'km'}`);
      if (dataAquisicao) resumoParts.push(dataAquisicao);

      return {
        valido: erros.length === 0,
        erros,
        resumo: resumoParts.join(' | '),
        dados: { nome: nomeFinal, codigoPatrimonio, numeroSerie, marca, ano, tipoMedicao, medicaoInicial: medicaoInicial ?? 0, dataAquisicao },
      };
    },
    [equipamentosExistentes]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      nome: d.nome,
      codigoPatrimonio: d.codigoPatrimonio,
      numeroSerie: d.numeroSerie,
      marca: d.marca,
      ano: d.ano,
      tipoMedicao: d.tipoMedicao,
      medicaoInicial: d.medicaoInicial,
      ativo: true,
      dataAquisicao: d.dataAquisicao,
      dataVenda: '',
      criadoPor: '',
    };
  }, []);

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={(items) => onImport(items as unknown as Equipamento[])}
      title="Importar Equipamentos do Excel"
      entityLabel="Equipamento"
      templateData={TEMPLATE_DATA}
      templateFileName="template_equipamentos.xlsx"
      sheetName="Equipamentos"
      templateColWidths={[28, 18, 22, 16, 6, 14, 15, 14]}
      formatHintHeaders={['Nome', 'Patrimonio', 'N. Serie', 'Marca', 'Ano', 'Tipo Med.', 'Med. Ini.', 'Dt. Aquis.']}
      formatHintExample={['Escavadeira', 'PAT-001', 'CAT-001', 'CAT', '2024', 'horimetro', '0', '2024-01-15']}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
