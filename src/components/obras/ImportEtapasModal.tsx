import { useCallback } from 'react';
import type { EtapaObra } from '../../types';
import ImportExcelModal, { parseNumero, parseStr, type ParsedRow } from '../ui/ImportExcelModal';

interface ImportEtapasModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (etapas: EtapaObra[]) => void;
  etapasExistentes: EtapaObra[];
  obraId: string;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TEMPLATE_DATA = [
  ['Nome da Etapa', 'Unidade de Medida', 'Quantidade', 'Valor Unitario'],
  ['Escavacao', 'm3', 150.0, 45.0],
  ['Fundacao (sapata)', 'm3', 80.0, 380.0],
  ['Impermeabilizacao', 'm2', 200.0, 25.0],
  ['Concreto estrutural', 'm3', 120.0, 450.0],
  ['Alvenaria', 'm2', 500.0, 65.0],
];

export default function ImportEtapasModal({
  open,
  onClose,
  onImport,
  etapasExistentes,
  obraId,
}: ImportEtapasModalProps) {
  const parseRow = useCallback(
    (row: unknown[]): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const unidade = parseStr(row[1]);

      if (!nome) erros.push('Nome vazio');

      let quantidade = 0;
      const qtdRaw = parseNumero(row[2]);
      if (qtdRaw === null || qtdRaw <= 0) {
        erros.push('Falta quantidade');
      } else {
        quantidade = qtdRaw;
      }

      let valorUnitario = 0;
      const valorRaw = parseNumero(row[3]);
      if (valorRaw === null || valorRaw <= 0) {
        erros.push('Falta valor');
      } else {
        valorUnitario = valorRaw;
      }

      // Resolver duplicatas
      let nomeFinal = nome;
      const nomeLower = nome.toLowerCase();
      const count = etapasExistentes.filter((e) => e.nome.toLowerCase() === nomeLower).length;
      if (count > 0) nomeFinal = `${nome} ${count + 1}`;

      return {
        valido: erros.length === 0,
        erros,
        resumo: `${nomeFinal || '(sem nome)'} | ${unidade || '-'} | Qtd: ${quantidade} | R$ ${valorUnitario > 0 ? valorUnitario.toFixed(4) : '0,00'}`,
        dados: { nome: nomeFinal, unidade, quantidade, valorUnitario },
      };
    },
    [etapasExistentes]
  );

  const toEntity = useCallback(
    (row: ParsedRow): Record<string, unknown> => {
      const d = row.dados;
      return {
        id: gerarId(),
        nome: d.nome,
        obraId,
        unidade: d.unidade,
        quantidade: d.quantidade,
        valorUnitario: d.valorUnitario,
        criadoPor: '',
      };
    },
    [obraId]
  );

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={(items) => onImport(items as unknown as EtapaObra[])}
      title="Importar Etapas do Excel"
      entityLabel="Etapa"
      genderFem
      templateData={TEMPLATE_DATA}
      templateFileName="template_etapas.xlsx"
      sheetName="Etapas"
      templateColWidths={[30, 20, 12, 15]}
      formatHintHeaders={['Nome da Etapa', 'Unidade', 'Quantidade', 'Valor Unitario']}
      formatHintExample={['Escavacao', 'm3', '150.00', '45.00']}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
