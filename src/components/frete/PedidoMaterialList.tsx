import { useState, useMemo } from 'react';
import type { PedidoMaterial, Fornecedor, Insumo } from '../../types';
import Button from '../ui/Button';

interface PedidoMaterialListProps {
  pedidos: PedidoMaterial[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  onEdit: (pedido: PedidoMaterial) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function calcValorTotal(pedido: PedidoMaterial): number {
  return pedido.itens.reduce((sum, i) => sum + i.quantidade * i.valorUnitario, 0);
}

export default function PedidoMaterialList({
  pedidos,
  fornecedores,
  insumos,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: PedidoMaterialListProps) {
  const [pagina, setPagina] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const porPagina = 15;

  const fornecedoresMap = useMemo(
    () => new Map(fornecedores.map((f) => [f.id, f.nome])),
    [fornecedores]
  );
  const insumosMap = useMemo(
    () => new Map(insumos.map((i) => [i.id, i.nome])),
    [insumos]
  );

  const sorted = useMemo(() => {
    return [...pedidos].sort((a, b) => b.data.localeCompare(a.data));
  }, [pedidos]);

  const totalPaginas = Math.ceil(sorted.length / porPagina);
  const paginados = sorted.slice(pagina * porPagina, (pagina + 1) * porPagina);

  const totalGeral = sorted.reduce((sum, p) => sum + calcValorTotal(p), 0);

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhum pedido de material encontrado.</p>
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
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs w-8" />
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Data</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Fornecedor</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Qtd Itens</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Valor Total</th>
                <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-emt-cinza-claro">
              {paginados.map((pedido) => {
                const valorTotal = calcValorTotal(pedido);
                const isExpanded = expandedId === pedido.id;
                return (
                  <>
                    <tr
                      key={pedido.id}
                      className="hover:bg-emt-verde-claro cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : pedido.id)}
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                        {pedido.data
                          ? new Date(pedido.data + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {fornecedoresMap.get(pedido.fornecedorId) || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800">
                        {pedido.itens.length}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emt-verde whitespace-nowrap">
                        {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              className="text-xs px-2 py-1"
                              onClick={() => onEdit(pedido)}
                            >
                              Editar
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                              onClick={() => onDelete(pedido.id)}
                            >
                              Excluir
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={pedido.id + '-detail'}>
                        <td colSpan={6} className="px-8 py-3 bg-gray-50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1 font-medium">Material</th>
                                <th className="text-right py-1 font-medium">Quantidade</th>
                                <th className="text-right py-1 font-medium">Vlr Unitario</th>
                                <th className="text-right py-1 font-medium">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {pedido.itens.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="py-1 text-gray-700">
                                    {insumosMap.get(item.insumoId) || item.insumoId}
                                  </td>
                                  <td className="py-1 text-right text-gray-700">
                                    {item.quantidade.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="py-1 text-right text-gray-700">
                                    {item.valorUnitario.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </td>
                                  <td className="py-1 text-right font-medium text-emt-verde">
                                    {(item.quantidade * item.valorUnitario).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {pedido.observacoes && (
                            <p className="mt-2 text-xs text-gray-500">
                              <span className="font-medium">Obs:</span> {pedido.observacoes}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-right text-gray-700">
                  Total ({sorted.length} pedido{sorted.length !== 1 ? 's' : ''}):
                </td>
                <td className="px-4 py-3 text-right text-emt-verde whitespace-nowrap">
                  {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {sorted.length} pedido{sorted.length !== 1 ? 's' : ''} encontrado{sorted.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="text-xs"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-gray-600 flex items-center px-2">
              {pagina + 1} / {totalPaginas}
            </span>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina((p) => p + 1)}
            >
              Proximo
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
