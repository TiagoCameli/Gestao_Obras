import { useState } from 'react';
import type { DepositoMaterial, TransferenciaMaterial } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';

interface TransferenciaMaterialListProps {
  transferencias: TransferenciaMaterial[];
  depositosMaterial: DepositoMaterial[];
  onDelete: (id: string) => void;
  canDelete?: boolean;
}

export default function TransferenciaMaterialList({
  transferencias,
  depositosMaterial,
  onDelete,
  canDelete = true,
}: TransferenciaMaterialListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const depositosMap = new Map(depositosMaterial.map((d) => [d.id, d.nome]));

  const { data: insumosData } = useInsumos();
  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i]));

  const sorted = [...transferencias].sort(
    (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">
          Nenhuma transferencia de material registrada.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Data/Hora
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Material
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Origem
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Destino
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Quantidade
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Valor
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((t) => {
                const insumo = insumosMap.get(t.insumoId);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {formatDateTime(t.dataHora)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {insumo?.nome || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {depositosMap.get(t.depositoOrigemId) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {depositosMap.get(t.depositoDestinoId) || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">
                      {t.quantidade} {insumo?.unidade || ''}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(t.valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canDelete && (
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteId(t.id)}
                        >
                          Excluir
                        </Button>
                      )}
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
        title="Excluir Transferencia de Material"
        message="Tem certeza que deseja excluir esta transferencia? O estoque sera recalculado."
      />
    </>
  );
}
