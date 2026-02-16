import { useState } from 'react';
import type { Abastecimento, Obra } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { useEtapas } from '../../hooks/useEtapas';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { formatCurrency, formatDateTime, formatLitros } from '../../utils/formatters';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';

interface ListProps {
  abastecimentos: Abastecimento[];
  obras: Obra[];
  onEdit: (abastecimento: Abastecimento) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function AbastecimentoList({
  abastecimentos,
  obras,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: ListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));

  const { data: insumosData } = useInsumos();
  const { data: etapasData } = useEtapas();
  const { data: equipamentosData } = useEquipamentos();

  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i.nome]));
  const etapasMap = new Map((etapasData ?? []).map((e) => [e.id, e.nome]));
  const equipMap = new Map((equipamentosData ?? []).map((e) => [e.id, e.nome]));

  const sorted = [...abastecimentos].sort(
    (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
  );

  function getEtapasDisplay(a: Abastecimento) {
    if (a.alocacoes && a.alocacoes.length > 0) {
      return a.alocacoes;
    }
    if (a.etapaId) {
      return [{ etapaId: a.etapaId, percentual: 100 }];
    }
    return [];
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhum abastecimento encontrado.</p>
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
                  Etapas
                </th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Equipamento
                </th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">
                  Combustivel
                </th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">
                  Litros
                </th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">
                  Valor
                </th>
                <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-emt-cinza-claro">
              {sorted.map((a) => (
                <tr key={a.id} className="hover:bg-emt-verde-claro">
                  <td className="px-4 py-3">{formatDateTime(a.dataHora)}</td>
                  <td className="px-4 py-3">{obrasMap.get(a.obraId) || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {getEtapasDisplay(a).map((aloc, i) => (
                        <span
                          key={i}
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emt-verde-claro text-emt-verde-escuro"
                        >
                          {etapasMap.get(aloc.etapaId) || 'Etapa?'}: {aloc.percentual}%
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {equipMap.get(a.veiculo) || a.veiculo || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      {insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatLitros(a.quantidadeLitros)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(a.valorTotal)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1"
                          onClick={() => onEdit(a)}
                        >
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteId(a.id)}
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
        title="Excluir Abastecimento"
        message="Tem certeza que deseja excluir este abastecimento? Esta acao nao pode ser desfeita."
      />
    </>
  );
}
