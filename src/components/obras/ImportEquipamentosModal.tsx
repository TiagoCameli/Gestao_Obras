import { useCallback } from 'react';
import type { Equipamento } from '../../types';
import ImportExcelModal, { parseNumero, parseData, parseStr, type ParsedRow } from '../ui/ImportExcelModal';
import { useAuth } from '../../contexts/AuthContext';

interface ImportEquipamentosModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (equipamentos: Equipamento[]) => void;
  equipamentosExistentes: Equipamento[];
  empresasMap?: Map<string, string>; // nome lowercase -> id
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TEMPLATE_DATA = [
  ['Nome', 'Tipo', 'Empresa', 'Codigo Patrimonio', 'Numero de Serie', 'Marca', 'Ano', 'Tipo Medicao', 'Medicao Inicial', 'Data Aquisicao'],
  ['Escavadeira CAT 320', 'Escavadeira Hidráulica', 'Empresa X', 'EH-001', 'CAT320-2024-001', 'Caterpillar', '2024', 'horimetro', 0, '2024-01-15'],
  ['Retroescavadeira JCB 3CX', 'Retroescavadeira', 'Empresa Y', 'RT-001', 'JCB3CX-2023-045', 'JCB', '2023', 'horimetro', 150, '2023-06-20'],
  ['Caminhão Basculante VW', 'Caminhão Basculante', 'Empresa X', 'CB-001', 'VW-2022-123', 'Volkswagen', '2022', 'odometro', 45000, '2022-03-10'],
];

export default function ImportEquipamentosModal({
  open,
  onClose,
  onImport,
  equipamentosExistentes,
  empresasMap,
}: ImportEquipamentosModalProps) {
  const { temAcao } = useAuth();
  if (open && !temAcao('importar_equipamentos_obra')) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-gray-800 mb-3">Sem permissão para importar equipamentos.</p>
          <button onClick={onClose} className="text-xs text-emt-verde">Fechar</button>
        </div>
      </div>
    );
  }
  const parseRow = useCallback(
    (row: unknown[]): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const tipo = parseStr(row[1]);
      const empresa = parseStr(row[2]);
      const codigoPatrimonio = parseStr(row[3]);
      const numeroSerie = parseStr(row[4]);
      const marca = parseStr(row[5]);
      const ano = parseStr(row[6]);
      const tipoMedicaoRaw = parseStr(row[7]).toLowerCase();
      const medicaoRaw = row[8];
      const dataRaw = row[9];

      if (!nome) erros.push('Nome vazio');

      const empresaId = empresa && empresasMap ? (empresasMap.get(empresa.toLowerCase()) || '') : '';

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
      if (tipo) resumoParts.push(tipo);
      if (marca) resumoParts.push(marca);
      if (codigoPatrimonio) resumoParts.push(codigoPatrimonio);

      return {
        valido: erros.length === 0,
        erros,
        resumo: resumoParts.join(' | '),
        dados: { nome: nomeFinal, tipo, empresaId, codigoPatrimonio, numeroSerie, marca, ano, tipoMedicao, medicaoInicial: medicaoInicial ?? 0, dataAquisicao },
      };
    },
    [equipamentosExistentes, empresasMap]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      nome: d.nome,
      tipo: d.tipo || '',
      empresaId: d.empresaId || '',
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
      templateColWidths={[28, 22, 18, 12, 22, 16, 6, 14, 15, 14]}
      formatHintHeaders={['Nome', 'Tipo', 'Empresa', 'Patrimônio', 'N. Série', 'Marca', 'Ano', 'Tipo Med.', 'Med. Ini.', 'Dt. Aquis.']}
      formatHintExample={['Escavadeira CAT 320', 'Escavadeira Hidráulica', 'Empresa X', 'EH-001', 'CAT-001', 'CAT', '2024', 'horimetro', '0', '2024-01-15']}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
