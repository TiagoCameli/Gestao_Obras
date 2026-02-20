import { useState } from 'react';
import type { OrdemCompra, Obra, EtapaObra, Fornecedor, Cotacao, PedidoCompra } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const STATUS_BADGE: Record<string, string> = {
  emitida: 'bg-blue-100 text-blue-800',
  entregue: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
};
const STATUS_LABEL: Record<string, string> = {
  emitida: 'Emitida',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

interface OrdemCompraListProps {
  ordens: OrdemCompra[];
  obras: Obra[];
  etapas: EtapaObra[];
  fornecedores: Fornecedor[];
  cotacoes: Cotacao[];
  pedidos: PedidoCompra[];
  onEdit: (oc: OrdemCompra) => void;
  onMarcarEntregue: (oc: OrdemCompra) => void;
  onReabrir: (oc: OrdemCompra) => void;
  onCancelar: (oc: OrdemCompra) => void;
  onAprovar: (oc: OrdemCompra) => void;
  canEdit: boolean;
}

export default function OrdemCompraList({
  ordens,
  obras,
  etapas,
  fornecedores,
  cotacoes,
  pedidos,
  onEdit,
  onMarcarEntregue,
  onReabrir,
  onCancelar,
  onAprovar,
  canEdit,
}: OrdemCompraListProps) {
  const [visualizando, setVisualizando] = useState<OrdemCompra | null>(null);

  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const etapasMap = new Map(etapas.map((e) => [e.id, e.nome]));
  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f]));
  const cotacoesMap = new Map(cotacoes.map((c) => [c.id, c.numero]));
  const pedidosMap = new Map(pedidos.map((p) => [p.id, p.numero]));

  const sorted = [...ordens].sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao) || b.numero.localeCompare(a.numero));

  const totalOCs = ordens.length;
  const valorTotal = ordens.filter((o) => o.status !== 'cancelada').reduce((sum, o) => sum + o.totalGeral, 0);
  const entregues = ordens.filter((o) => o.status === 'entregue').length;

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Total OCs</p><p className="text-2xl font-bold text-gray-800 mt-1">{totalOCs}</p></Card>
        <Card><p className="text-sm text-gray-500">Valor Total (Ativas)</p><p className="text-2xl font-bold text-emt-verde mt-1">{formatCurrency(valorTotal)}</p></Card>
        <Card><p className="text-sm text-gray-500">Entregues</p><p className="text-2xl font-bold text-green-600 mt-1">{entregues}</p></Card>
      </div>

      {/* Tabela */}
      <Card>
        {sorted.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Nenhuma ordem de compra encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Nº OC</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Criação</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Entrega</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Obra</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Etapa</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Fornecedor</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Ref. Cotação</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((oc) => {
                  const forn = fornecedoresMap.get(oc.fornecedorId);
                  return (
                    <tr key={oc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{oc.numero}</td>
                      <td className="px-4 py-2 text-gray-600">{formatDate(oc.dataCriacao)}</td>
                      <td className="px-4 py-2 text-gray-600">{oc.dataEntrega ? formatDate(oc.dataEntrega) : '-'}</td>
                      <td className="px-4 py-2 text-gray-600">{obrasMap.get(oc.obraId) || '-'}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {oc.entradaInsumos ? <span className="text-xs text-purple-600 font-medium">Estoque</span> : (etapasMap.get(oc.etapaObraId) || '-')}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{forn?.nome || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {oc.cotacaoId ? cotacoesMap.get(oc.cotacaoId) || '-' : '-'}
                        {oc.pedidoCompraId ? ` / ${pedidosMap.get(oc.pedidoCompraId) || ''}` : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">{formatCurrency(oc.totalGeral)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[oc.status]}`}>
                          {STATUS_LABEL[oc.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <button onClick={() => setVisualizando(oc)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                            Visualizar
                          </button>
                          {oc.status === 'emitida' && canEdit && (
                            <>
                              <button onClick={() => onEdit(oc)} className="text-xs text-emt-verde hover:text-emt-verde-escuro font-medium">
                                Editar
                              </button>
                              <button onClick={() => onMarcarEntregue(oc)} className="text-xs text-green-600 hover:text-green-800 font-medium">
                                Entregue
                              </button>
                              <button onClick={() => onCancelar(oc)} className="text-xs text-red-600 hover:text-red-800 font-medium">
                                Cancelar
                              </button>
                            </>
                          )}
                          {oc.status === 'entregue' && canEdit && (
                            <button onClick={() => onReabrir(oc)} className="text-xs text-orange-600 hover:text-orange-800 font-medium">
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Visualização OC formal */}
      <Modal open={visualizando !== null} onClose={() => setVisualizando(null)} title={visualizando ? `Ordem de Compra ${visualizando.numero}` : ''}>
        {visualizando && (() => {
          const forn = fornecedoresMap.get(visualizando.fornecedorId);
          return (
            <div className="space-y-5">
              {/* Cabeçalho formal */}
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold text-gray-800">EMT Construtora</h2>
                <p className="text-sm text-gray-500">Ordem de Compra</p>
                <p className="text-lg font-semibold text-emt-verde mt-1">{visualizando.numero}</p>
                <p className="text-xs text-gray-400">Data: {formatDate(visualizando.dataCriacao)}</p>
              </div>

              {/* Dados fornecedor */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fornecedor</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Nome:</span> <span className="font-medium">{forn?.nome || '-'}</span></div>
                  <div><span className="text-gray-500">CNPJ:</span> <span className="font-medium">{forn?.cnpj || '-'}</span></div>
                  <div><span className="text-gray-500">Telefone:</span> <span className="font-medium">{forn?.telefone || '-'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{forn?.email || '-'}</span></div>
                </div>
              </div>

              {/* Dados obra + referências */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Obra:</span> <span className="font-medium">{obrasMap.get(visualizando.obraId) || '-'}</span></div>
                <div><span className="text-gray-500">Etapa:</span> <span className="font-medium">{visualizando.entradaInsumos ? 'Estoque de Insumos' : (etapasMap.get(visualizando.etapaObraId) || '-')}</span></div>
                {visualizando.cotacaoId && <div><span className="text-gray-500">Cotação:</span> <span className="font-medium">{cotacoesMap.get(visualizando.cotacaoId) || '-'}</span></div>}
                {visualizando.pedidoCompraId && <div><span className="text-gray-500">Pedido:</span> <span className="font-medium">{pedidosMap.get(visualizando.pedidoCompraId) || '-'}</span></div>}
              </div>

              {/* Tabela de itens */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Descrição</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Qtd</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Unid.</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Preço Unit.</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visualizando.itens.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{item.descricao}</td>
                        <td className="px-3 py-2 text-right">{item.quantidade}</td>
                        <td className="px-3 py-2">{item.unidade}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.precoUnitario)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Custos */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal Materiais</span><span className="font-medium">{formatCurrency(visualizando.totalMateriais)}</span></div>
                {visualizando.custosAdicionais.frete > 0 && <div className="flex justify-between"><span className="text-gray-600">Frete</span><span>{formatCurrency(visualizando.custosAdicionais.frete)}</span></div>}
                {visualizando.custosAdicionais.outrasDespesas > 0 && <div className="flex justify-between"><span className="text-gray-600">Outras Despesas</span><span>{formatCurrency(visualizando.custosAdicionais.outrasDespesas)}</span></div>}
                {visualizando.custosAdicionais.impostos > 0 && <div className="flex justify-between"><span className="text-gray-600">Impostos</span><span>{formatCurrency(visualizando.custosAdicionais.impostos)}</span></div>}
                {visualizando.custosAdicionais.desconto > 0 && <div className="flex justify-between"><span className="text-gray-600">Desconto</span><span className="text-red-600">-{formatCurrency(visualizando.custosAdicionais.desconto)}</span></div>}
                <div className="flex justify-between pt-2 border-t border-gray-200 text-lg font-bold">
                  <span>Total Geral</span>
                  <span className="text-emt-verde">{formatCurrency(visualizando.totalGeral)}</span>
                </div>
              </div>

              {/* Condições */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {visualizando.condicaoPagamento && (
                  <div><span className="text-gray-500">Condição de Pagamento:</span><p className="font-medium mt-0.5">{visualizando.condicaoPagamento}</p></div>
                )}
                {visualizando.prazoEntrega && (
                  <div><span className="text-gray-500">Prazo de Entrega:</span><p className="font-medium mt-0.5">{visualizando.prazoEntrega}</p></div>
                )}
              </div>

              {/* Observações */}
              {visualizando.observacoes && (
                <div className="text-sm">
                  <span className="text-gray-500">Observações:</span>
                  <p className="text-gray-700 mt-0.5">{visualizando.observacoes}</p>
                </div>
              )}

              {/* Aprovação */}
              {canEdit && visualizando.status === 'emitida' && (
                <label className="flex items-center gap-3 bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visualizando.aprovada}
                    onChange={() => {
                      const atualizada = { ...visualizando, aprovada: !visualizando.aprovada };
                      onAprovar(atualizada);
                      setVisualizando(atualizada);
                    }}
                    className="w-5 h-5 accent-emt-verde"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">Aprovar Ordem de Compra</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {visualizando.aprovada ? 'Ordem de compra aprovada' : 'Marque para aprovar esta ordem de compra'}
                    </p>
                  </div>
                  {visualizando.aprovada && (
                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aprovada</span>
                  )}
                </label>
              )}
              {visualizando.aprovada && visualizando.status !== 'emitida' && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aprovada</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="secondary" onClick={() => setVisualizando(null)}>Fechar</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
