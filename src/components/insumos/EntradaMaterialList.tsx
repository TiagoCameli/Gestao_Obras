import { useState } from 'react';
import type { DepositoMaterial, EntradaMaterial, Obra } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';

interface EntradaMaterialListProps {
  entradas: EntradaMaterial[];
  obras: Obra[];
  depositosMaterial: DepositoMaterial[];
  onEdit: (entrada: EntradaMaterial) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function EntradaMaterialList({
  entradas,
  obras,
  depositosMaterial,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: EntradaMaterialListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositosMaterial.map((d) => [d.id, d.nome]));

  const { data: insumosData } = useInsumos();
  const { data: fornecedoresData } = useFornecedores();

  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i]));
  const fornecedoresMap = new Map((fornecedoresData ?? []).map((f) => [f.id, f.nome]));

  const sorted = [...entradas].sort(
    (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhuma entrada de material registrada.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-emt-verde text-white">
              <tr>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Data/Hora
                </th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Obra
                </th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Depósito
                </th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Material
                </th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Fornecedor
                </th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">
                  Quantidade
                </th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">
                  Valor
                </th>
                <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-emt-cinza-claro">
              {sorted.map((e) => {
                const insumo = insumosMap.get(e.insumoId);
                return (
                  <tr key={e.id} className="hover:bg-emt-verde-claro">
                    <td className="px-4 py-3">{formatDateTime(e.dataHora)}</td>
                    <td className="px-4 py-3">
                      {obrasMap.get(e.obraId) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {depositosMap.get(e.depositoMaterialId) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emt-verde-claro text-emt-verde-escuro">
                        {insumo?.nome || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {fornecedoresMap.get(e.fornecedorId) || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      +{e.quantidade} {insumo?.unidade || ''}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(e.valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            className="text-xs px-2 py-1"
                            onClick={() => onEdit(e)}
                          >
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteId(e.id)}
                          >
                            Excluir
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
          setDeleteId(null);
        }}
        title="Excluir Entrada de Material"
        message="Tem certeza que deseja excluir esta entrada? O estoque sera recalculado."
      />
    </>
  );
}
