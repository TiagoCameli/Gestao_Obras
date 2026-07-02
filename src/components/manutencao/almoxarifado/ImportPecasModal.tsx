import { useMemo } from 'react';
import ImportExcelModal, { type ParsedRow } from '../../ui/ImportExcelModal';
import { criarDedupCtx, parseRowPeca, pecaRowToInsumo, TEMPLATE_PECAS } from '../../../utils/importPecasAlmoxarifado';
import { useImportarInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../ui/Toast';
import type { Insumo } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  insumos: Insumo[];
}

export default function ImportPecasModal({ open, onClose, insumos }: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const importar = useImportarInsumos();

  // ctx de dedup contra o catálogo atual. Estável enquanto `insumos` não muda,
  // então as chamadas sequenciais de parseRow num mesmo arquivo compartilham o
  // acumulador (que se reseta no index 0 a cada novo upload, ver parseRowPeca).
  const ctx = useMemo(() => criarDedupCtx(insumos), [insumos]);

  const parseRow = (row: unknown[], index: number): ParsedRow =>
    parseRowPeca(row, index, ctx);

  const toEntity = (r: ParsedRow): Record<string, unknown> =>
    pecaRowToInsumo(r.dados, usuario?.nome ?? '') as unknown as Record<string, unknown>;

  const handleImport = (items: Record<string, unknown>[]) => {
    const novos = items as unknown as Insumo[];
    importar.mutate(novos, {
      onSuccess: () => showToast({ kind: 'success', message: `${novos.length} peça(s) importada(s).` }),
      onError: (e) => showToast({ kind: 'error', message: e instanceof Error ? e.message : 'Falha ao importar peças.' }),
    });
  };

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={handleImport}
      title="Importar peças (Excel)"
      entityLabel="peça"
      genderFem
      templateData={[TEMPLATE_PECAS.headers, TEMPLATE_PECAS.exemplo]}
      templateFileName="template-pecas-almoxarifado.xlsx"
      sheetName="Peças"
      templateColWidths={TEMPLATE_PECAS.colWidths}
      formatHintHeaders={TEMPLATE_PECAS.headers}
      formatHintExample={TEMPLATE_PECAS.exemplo}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
