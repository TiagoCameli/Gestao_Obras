import { useState } from 'react';
import type { Deposito, TransferenciaCombustivel } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import AnexosBadge from './AnexosBadge';

interface TransferenciaListProps {
  transferencias: TransferenciaCombustivel[];
  depositos: Deposito[];
  onDelete: (id: string) => void;
  /** F8.5.2 — click numa row (fora dos botões) abre drawer detalhes. */
  onSelect?: (t: TransferenciaCombustivel) => void;
  canDelete?: boolean;
}

export default function TransferenciaList({
  transferencias,
  depositos,
  onDelete,
  onSelect,
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
        <p className="text-gray-500">Nenhuma transferência registrada.</p>
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
                  Origem
                </th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Destino
                </th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">
                  Litros
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
              {sorted.map((t) => {
                const origem = depositosMap.get(t.depositoOrigemId);
                const destino = depositosMap.get(t.depositoDestinoId);
                const rowClickable = !!onSelect;
                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-emt-verde-claro ${rowClickable ? 'cursor-pointer' : ''}`}
                    onClick={rowClickable ? () => onSelect!(t) : undefined}
                  >
                    <td className="px-4 py-3">{formatDateTime(t.dataHora)}</td>
                    <td className="px-4 py-3">
                      {origem?.nome || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {destino?.nome || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emt-verde">
                      {t.quantidadeLitros.toFixed(1)} L
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(t.valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-center items-center gap-2">
                        <AnexosBadge fotoUrls={t.fotoUrls} arquivoUrls={t.arquivoUrls} />
                        {canDelete && (
                          <Button
                            variant="ghost"
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteId(t.id)}
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
        title="Excluir Transferência"
        message="Tem certeza que deseja excluir esta transferência? Os litros serão devolvidos ao tanque de origem e removidos do tanque de destino."
      />
    </>
  );
}
