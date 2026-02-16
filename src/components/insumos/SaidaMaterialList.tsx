import { useState } from 'react';
import type { DepositoMaterial, EtapaObra, Obra, SaidaMaterial } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';

interface SaidaMaterialListProps {
  saidas: SaidaMaterial[];
  obras: Obra[];
  depositosMaterial: DepositoMaterial[];
  etapas: EtapaObra[];
  onEdit: (saida: SaidaMaterial) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function SaidaMaterialList({
  saidas,
  obras,
  depositosMaterial,
  etapas,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: SaidaMaterialListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const depositosMap = new Map(depositosMaterial.map((d) => [d.id, d.nome]));
  const etapasMap = new Map(etapas.map((e) => [e.id, e.nome]));

  const { data: insumosData } = useInsumos();
  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i]));

  const sorted = [...saidas].sort(
    (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhuma saida de material registrada.</p>
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
                  Obra
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Deposito
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Material
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Quantidade
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Etapas
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
              {sorted.map((s) => {
                const insumo = insumosMap.get(s.insumoId);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDateTime(s.dataHora)}</td>
                    <td className="px-4 py-3">
                      {obrasMap.get(s.obraId) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {depositosMap.get(s.depositoMaterialId) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {insumo?.nome || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-700">
                      -{s.quantidade} {insumo?.unidade || ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.alocacoes.map((a, i) => (
                          <span
                            key={i}
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                          >
                            {etapasMap.get(a.etapaId) || 'Etapa?'}:{' '}
                            {a.percentual}%
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(s.valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            className="text-xs px-2 py-1"
                            onClick={() => onEdit(s)}
                          >
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteId(s.id)}
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
        title="Excluir Saida de Material"
        message="Tem certeza que deseja excluir esta saida? O estoque sera recalculado."
      />
    </>
  );
}
