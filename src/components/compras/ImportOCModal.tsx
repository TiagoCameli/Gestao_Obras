import { useCallback } from 'react';
import ImportExcelModal, { parseNumero, parseStr, type ParsedRow } from '../ui/ImportExcelModal';

interface ImportOCModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (items: Record<string, unknown>[]) => void;
}

const TEMPLATE_DATA = [
  ['Fornecedor', 'Descricao do Item', 'Quantidade', 'Unidade', 'Preco Unitario', 'Empresa Faturamento', 'Observacoes'],
  ['Madeireira ABC', 'Cimento CP-II', 100, 'sc', 32.50, 'EMT Construtora', 'Urgente'],
  ['Madeireira ABC', 'Areia media', 20, 'm3', 120.00, 'EMT Construtora', ''],
  ['Ferro e Aco Ltda', 'Vergalhao 10mm', 500, 'kg', 8.90, '', ''],
];

export default function ImportOCModal({ open, onClose, onImport }: ImportOCModalProps) {
  const parseRow = useCallback((_row: unknown[]): ParsedRow => {
    const erros: string[] = [];
    const fornecedor = parseStr(_row[0]);
    const descricao = parseStr(_row[1]);
    const unidade = parseStr(_row[3]);
    const empresaFaturamento = parseStr(_row[5]);
    const observacoes = parseStr(_row[6]);

    if (!fornecedor) erros.push('Fornecedor vazio');
    if (!descricao) erros.push('Descricao vazia');
    if (!unidade) erros.push('Unidade vazia');

    let quantidade = 0;
    const qtdRaw = parseNumero(_row[2]);
    if (qtdRaw === null || qtdRaw <= 0) {
      erros.push('Quantidade invalida');
    } else {
      quantidade = qtdRaw;
    }

    let precoUnitario = 0;
    const precoRaw = parseNumero(_row[4]);
    if (precoRaw === null || precoRaw < 0) {
      erros.push('Preco invalido');
    } else {
      precoUnitario = precoRaw;
    }

    return {
      valido: erros.length === 0,
      erros,
      resumo: `${fornecedor || '(sem fornecedor)'} | ${descricao || '(sem descricao)'} | ${quantidade} x R$ ${precoUnitario.toFixed(2)}`,
      dados: { fornecedor, descricao, quantidade, unidade, precoUnitario, empresaFaturamento, observacoes },
    };
  }, []);

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    return { ...row.dados };
  }, []);

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={onImport}
      title="Importar Ordens de Compra do Excel"
      entityLabel="Item"
      templateData={TEMPLATE_DATA}
      templateFileName="template_ordens_compra.xlsx"
      sheetName="Ordens de Compra"
      templateColWidths={[25, 25, 12, 10, 15, 25, 25]}
      formatHintHeaders={['Fornecedor', 'Descricao', 'Qtd', 'Unidade', 'Preco Unit.', 'Empresa Fat.', 'Obs.']}
      formatHintExample={['Madeireira ABC', 'Cimento CP-II', '100', 'sc', '32.50', 'EMT Construtora', 'Urgente']}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
