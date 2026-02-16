import { useState } from 'react';
import type { Deposito, TransferenciaCombustivel } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';

interface TransferenciaListProps {
  transferencias: TransferenciaCombustivel[];
  depositos: Deposito[];
  onDelete: (id: string) => void;
  canDelete?: boolean;
}

export default function TransferenciaList({
  transferencias,
  depositos,
  onDelete,
  canDelete = true,
}: TransferenciaListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const depositosMap = new Map(depositos.map((d) => [d.id, d]));

  const sorted = [...transferencias].sort(
    (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhuma transferencia registrada.</p>
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
                  Origem
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Destino
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Litros
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
                const origem = depositosMap.get(t.depositoOrigemId);
                const destino = depositosMap.get(t.depositoDestinoId);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDateTime(t.dataHora)}</td>
                    <td className="px-4 py-3">
                      {origem?.nome || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {destino?.nome || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">
                      {t.quantidadeLitros.toFixed(1)} L
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
        title="Excluir Transferencia"
        message="Tem certeza que deseja excluir esta transferencia? Os litros serao devolvidos ao tanque de origem e removidos do tanque de destino."
      />
    </>
  );
}
