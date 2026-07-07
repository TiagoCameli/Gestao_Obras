// Import de entradas de peças em estoque via Excel (várias NFs num arquivo).
// Modal fino: monta o contexto de validação com os dados dos hooks e delega
// UI/fluxo ao ImportExcelModal genérico. Espelha o ImportPecasModal.

import { useMemo } from 'react';
import ImportExcelModal, { type ParsedRow } from '../../ui/ImportExcelModal';
import {
  criarEntradasCtx, parseRowEntrada, entradaRowToEntradaMaterial, TEMPLATE_ENTRADAS_PECAS,
} from '../../../utils/importEntradasPecas';
import { useEntradasMaterial, useImportarEntradasMaterial } from '../../../hooks/useEntradasMaterial';
import { useDepositosMaterial } from '../../../hooks/useDepositosMaterial';
import { useFornecedores } from '../../../hooks/useFornecedores';
import { useInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../ui/Toast';
import type { EntradaMaterial } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImportEntradasModal({ open, onClose }: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const importar = useImportarEntradasMaterial();
  const { data: insumos = [] } = useInsumos();
  const { data: depositos = [] } = useDepositosMaterial();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: entradas = [] } = useEntradasMaterial();

  // Ctx de validação contra catálogo/depósitos/fornecedores/NFs lançadas.
  // O acumulador intra-arquivo se reseta no index 0 (ver parseRowEntrada).
  const ctx = useMemo(
    () => criarEntradasCtx(insumos, depositos, fornecedores, entradas),
    [insumos, depositos, fornecedores, entradas]
  );

  const parseRow = (row: unknown[], index: number): ParsedRow =>
    parseRowEntrada(row, index, ctx);

  const toEntity = (r: ParsedRow): Record<string, unknown> =>
    entradaRowToEntradaMaterial(r.dados, usuario?.nome ?? '') as unknown as Record<string, unknown>;

  const handleImport = (items: Record<string, unknown>[]) => {
    const novas = items as unknown as EntradaMaterial[];
    importar.mutate(novas, {
      onSuccess: () => showToast({ kind: 'success', message: `${novas.length} entrada(s) importada(s).` }),
      onError: (e) => showToast({ kind: 'error', message: e instanceof Error ? e.message : 'Falha ao importar entradas.' }),
    });
  };

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={handleImport}
      title="Importar entradas de peças (Excel)"
      entityLabel="entrada"
      genderFem
      templateData={[TEMPLATE_ENTRADAS_PECAS.headers, TEMPLATE_ENTRADAS_PECAS.exemplo]}
      templateFileName="template-entradas-pecas.xlsx"
      sheetName="Entradas"
      templateColWidths={TEMPLATE_ENTRADAS_PECAS.colWidths}
      formatHintHeaders={TEMPLATE_ENTRADAS_PECAS.headers}
      formatHintExample={TEMPLATE_ENTRADAS_PECAS.exemplo}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
