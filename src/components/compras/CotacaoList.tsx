import { useState, Fragment } from 'react';
import type { Cotacao, Fornecedor, ItemPedidoCompra, CotacaoFornecedor, PedidoCompra } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Input from '../ui/Input';

const STATUS_BADGE: Record<string, string> = {
  em_cotacao: 'bg-yellow-100 text-yellow-800',
  parcial: 'bg-blue-100 text-blue-800',
  cotado: 'bg-green-100 text-green-800',
};
const STATUS_LABEL: Record<string, string> = {
  em_cotacao: 'Em Cotação',
  parcial: 'Parcial',
  cotado: 'Cotado',
};

interface CotacaoListProps {
  cotacoes: Cotacao[];
  fornecedores: Fornecedor[];
  pedidos: PedidoCompra[];
  onSalvarPrecos: (cotacao: Cotacao) => Promise<void>;
  onGerarOC: (cotacao: Cotacao, fornecedorId: string, itemIds: string[]) => void;
  canEdit: boolean;
  canCreate: boolean;
}

export default function CotacaoList({
  cotacoes,
  fornecedores,
  pedidos,
  onSalvarPrecos,
  onGerarOC,
  canEdit,
  canCreate,
}: CotacaoListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preenchendo, setPreenchendo] = useState<{ cotacao: Cotacao; fornecedorId: string } | null>(null);
  const [precos, setPrecos] = useState<{ precoUnitario: number; condicao: string; prazo: string }[]>([]);
  const [gerandoOC, setGerandoOC] = useState<Cotacao | null>(null);
  const [ocFornecedorId, setOcFornecedorId] = useState('');
  const [ocItemIds, setOcItemIds] = useState<string[]>([]);

  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f]));
  const pedidosMap = new Map(pedidos.map((p) => [p.id, p]));

  const sorted = [...cotacoes].sort((a, b) => b.data.localeCompare(a.data) || b.numero.localeCompare(a.numero));

  // Resumo
  const total = cotacoes.length;
  const emAndamento = cotacoes.filter((c) => c.status === 'em_cotacao' || c.status === 'parcial').length;
  const finalizadas = cotacoes.filter((c) => c.status === 'cotado').length;

  function startPreencher(cotacao: Cotacao, fornecedorId: string) {
    const cf = cotacao.fornecedores.find((f) => f.fornecedorId === fornecedorId);
    const itens = cotacao.itensPedido;
    setPrecos(
      itens.map((item) => {
        const preco = cf?.itensPrecos.find((ip) => ip.itemPedidoId === item.id);
        return {
          precoUnitario: preco?.precoUnitario ?? 0,
          condicao: cf?.condicaoPagamento ?? '',
          prazo: cf?.prazoEntrega ?? '',
        };
      })
    );
    setPreenchendo({ cotacao, fornecedorId });
  }

  async function salvarPrecos() {
    if (!preenchendo) return;
    const { cotacao, fornecedorId } = preenchendo;
    const itens = cotacao.itensPedido;

    const updatedFornecedores = cotacao.fornecedores.map((cf) => {
      if (cf.fornecedorId !== fornecedorId) return cf;
      const itensPrecos = itens.map((item, idx) => ({
        itemPedidoId: item.id,
        precoUnitario: precos[idx]?.precoUnitario ?? 0,
      }));
      const total = itens.reduce((sum, item, idx) => sum + item.quantidade * (precos[idx]?.precoUnitario ?? 0), 0);
      return {
        ...cf,
        itensPrecos,
        condicaoPagamento: precos[0]?.condicao ?? '',
        prazoEntrega: precos[0]?.prazo ?? '',
        total,
        respondido: true,
      };
    });

    const respondidos = updatedFornecedores.filter((f) => f.respondido).length;
    const totalForn = updatedFornecedores.length;
    let status: Cotacao['status'] = 'em_cotacao';
    if (respondidos === totalForn) status = 'cotado';
    else if (respondidos > 0) status = 'parcial';

    await onSalvarPrecos({ ...cotacao, fornecedores: updatedFornecedores, status });
    setPreenchendo(null);
  }

  function marcarVencedor(cotacao: Cotacao, fornecedorId: string) {
    const updated = cotacao.fornecedores.map((cf) => ({
      ...cf,
      vencedor: cf.fornecedorId === fornecedorId,
    }));
    onSalvarPrecos({ ...cotacao, fornecedores: updated });
  }

  function getMenorPrecoTotal(cotacao: Cotacao): string | null {
    const respondidos = cotacao.fornecedores.filter((cf) => cf.respondido && cf.total > 0);
    if (respondidos.length === 0) return null;
    const menor = respondidos.reduce((min, cf) => (cf.total < min.total ? cf : min));
    return menor.fornecedorId;
  }

  function startGerarOC(cotacao: Cotacao) {
    setGerandoOC(cotacao);
    setOcFornecedorId('');
    setOcItemIds([]);
  }

  function toggleOcItem(id: string) {
    setOcItemIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  function confirmarGerarOC() {
    if (!gerandoOC || !ocFornecedorId || ocItemIds.length === 0) return;
    onGerarOC(gerandoOC, ocFornecedorId, ocItemIds);
    setGerandoOC(null);
  }

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Total Cotações</p><p className="text-2xl font-bold text-gray-800 mt-1">{total}</p></Card>
        <Card><p className="text-sm text-gray-500">Em Andamento</p><p className="text-2xl font-bold text-yellow-600 mt-1">{emAndamento}</p></Card>
        <Card><p className="text-sm text-gray-500">Finalizadas</p><p className="text-2xl font-bold text-green-600 mt-1">{finalizadas}</p></Card>
      </div>

      {/* Cotações como acordeão */}
      {sorted.length === 0 ? (
        <Card><p className="text-gray-400 text-sm text-center py-8">Nenhuma cotação encontrada.</p></Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((cot) => {
            const isOpen = expanded === cot.id;
            const menorPrecoId = getMenorPrecoTotal(cot);
            const pedidoRef = pedidosMap.get(cot.pedidoCompraId);

            return (
              <Card key={cot.id} className="!p-0 overflow-hidden">
                {/* Header do acordeão */}
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : cot.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-gray-800">{cot.numero}</span>
                    {pedidoRef && <span className="text-xs text-gray-500">Ref: {pedidoRef.numero}</span>}
                    <span className="text-sm text-gray-500">{formatDate(cot.data)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[cot.status]}`}>
                      {STATUS_LABEL[cot.status]}
                    </span>
                    <span className="text-xs text-gray-400">{cot.fornecedores.length} fornecedor(es)</span>
                  </div>
                  <span className="text-gray-400 text-lg">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Conteúdo expandido */}
                {isOpen && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    {/* Quadro comparativo */}
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                            <th className="text-right px-3 py-2 font-medium text-gray-600">Qtd</th>
                            {cot.fornecedores.map((cf) => {
                              const forn = fornecedoresMap.get(cf.fornecedorId);
                              return (
                                <th key={cf.id} className="text-right px-3 py-2 font-medium text-gray-600">
                                  <div className="flex flex-col items-end gap-1">
                                    <span>{forn?.nome || 'Fornecedor'}</span>
                                    <div className="flex gap-1">
                                      {cf.vencedor && (
                                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[10px] font-bold">★ Vencedor</span>
                                      )}
                                      {cf.fornecedorId === menorPrecoId && cf.respondido && (
                                        <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-[10px] font-bold">Menor Preço</span>
                                      )}
                                    </div>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cot.itensPedido.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">{item.descricao}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{item.quantidade} {item.unidade}</td>
                              {cot.fornecedores.map((cf) => {
                                const preco = cf.itensPrecos.find((ip) => ip.itemPedidoId === item.id);
                                const subtotal = (preco?.precoUnitario ?? 0) * item.quantidade;
                                return (
                                  <td key={cf.id} className="px-3 py-2 text-right">
                                    {cf.respondido ? (
                                      <div>
                                        <span className="text-gray-700">{formatCurrency(preco?.precoUnitario ?? 0)}</span>
                                        <span className="text-xs text-gray-400 block">{formatCurrency(subtotal)}</span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200">
                          <tr className="font-semibold">
                            <td className="px-3 py-2 text-gray-700" colSpan={2}>Total</td>
                            {cot.fornecedores.map((cf) => (
                              <td key={cf.id} className="px-3 py-2 text-right text-gray-800">
                                {cf.respondido ? formatCurrency(cf.total) : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-1 text-xs text-gray-500" colSpan={2}>Condição</td>
                            {cot.fornecedores.map((cf) => (
                              <td key={cf.id} className="px-3 py-1 text-right text-xs text-gray-500">{cf.condicaoPagamento || '-'}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-1 text-xs text-gray-500" colSpan={2}>Prazo</td>
                            {cot.fornecedores.map((cf) => (
                              <td key={cf.id} className="px-3 py-1 text-right text-xs text-gray-500">{cf.prazoEntrega || '-'}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {canEdit && cot.fornecedores.map((cf) => {
                        const forn = fornecedoresMap.get(cf.fornecedorId);
                        return (
                          <Fragment key={cf.id}>
                            <Button variant="secondary" onClick={() => startPreencher(cot, cf.fornecedorId)} className="text-xs">
                              {cf.respondido ? 'Editar' : 'Preencher'} {forn?.nome}
                            </Button>
                            {cf.respondido && !cf.vencedor && (
                              <Button variant="ghost" onClick={() => marcarVencedor(cot, cf.fornecedorId)} className="text-xs text-yellow-700">
                                Marcar Vencedor
                              </Button>
                            )}
                          </Fragment>
                        );
                      })}
                      {canCreate && cot.fornecedores.some((cf) => cf.respondido) && (
                        <Button onClick={() => startGerarOC(cot)} className="text-xs">
                          Gerar Ordem de Compra
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal preencher preços */}
      <Modal
        open={preenchendo !== null}
        onClose={() => setPreenchendo(null)}
        title={`Preços - ${fornecedoresMap.get(preenchendo?.fornecedorId ?? '')?.nome ?? ''}`}
      >
        {preenchendo && (
          <div className="space-y-4">
            {preenchendo.cotacao.itensPedido.map((item, idx) => (
              <div key={item.id} className="flex items-end gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">{item.descricao} <span className="text-xs text-gray-400">({item.quantidade} {item.unidade})</span></p>
                </div>
                <div className="w-40">
                  <Input
                    label="Preço Unit. (R$)"
                    id={`preco-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={precos[idx]?.precoUnitario ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPrecos((prev) => prev.map((p, i) => (i === idx ? { ...p, precoUnitario: val } : p)));
                    }}
                  />
                </div>
                <div className="w-32 text-right text-sm font-medium text-gray-700 pb-1">
                  {formatCurrency((precos[idx]?.precoUnitario ?? 0) * item.quantidade)}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Condição de Pagamento"
                id="cond-pag"
                value={precos[0]?.condicao ?? ''}
                onChange={(e) => setPrecos((prev) => prev.map((p) => ({ ...p, condicao: e.target.value })))}
                placeholder="Ex: 30/60/90 dias"
              />
              <Input
                label="Prazo de Entrega"
                id="prazo-ent"
                value={precos[0]?.prazo ?? ''}
                onChange={(e) => setPrecos((prev) => prev.map((p) => ({ ...p, prazo: e.target.value })))}
                placeholder="Ex: 5 dias úteis"
              />
            </div>
            <div className="text-right font-semibold text-lg text-gray-800">
              Total: {formatCurrency(
                preenchendo.cotacao.itensPedido.reduce((sum, item, idx) => sum + item.quantidade * (precos[idx]?.precoUnitario ?? 0), 0)
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPreenchendo(null)}>Cancelar</Button>
              <Button onClick={salvarPrecos}>Salvar Preços</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal gerar OC a partir da cotação */}
      <Modal
        open={gerandoOC !== null}
        onClose={() => setGerandoOC(null)}
        title="Gerar Ordem de Compra"
      >
        {gerandoOC && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Selecione o fornecedor e os materiais para gerar a OC.</p>

            {/* Seleção de fornecedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fornecedor</label>
              <div className="space-y-2">
                {gerandoOC.fornecedores.filter((cf) => cf.respondido).map((cf) => {
                  const forn = fornecedoresMap.get(cf.fornecedorId);
                  const menorPreco = getMenorPrecoTotal(gerandoOC);
                  return (
                    <label key={cf.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      ocFornecedorId === cf.fornecedorId ? 'border-emt-verde bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="oc-fornecedor"
                        checked={ocFornecedorId === cf.fornecedorId}
                        onChange={() => setOcFornecedorId(cf.fornecedorId)}
                        className="accent-emt-verde"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{forn?.nome}</p>
                        <p className="text-xs text-gray-500">Total: {formatCurrency(cf.total)}</p>
                      </div>
                      <div className="flex gap-1">
                        {cf.vencedor && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[10px] font-bold">★ Vencedor</span>}
                        {cf.fornecedorId === menorPreco && <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-[10px] font-bold">Menor Preço</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Seleção de itens */}
            {ocFornecedorId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Materiais</label>
                  <button
                    type="button"
                    className="text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
                    onClick={() => setOcItemIds(
                      ocItemIds.length === gerandoOC.itensPedido.length ? [] : gerandoOC.itensPedido.map((i) => i.id)
                    )}
                  >
                    {ocItemIds.length === gerandoOC.itensPedido.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                </div>
                <div className="space-y-1">
                  {gerandoOC.itensPedido.map((item) => {
                    const cf = gerandoOC.fornecedores.find((f) => f.fornecedorId === ocFornecedorId);
                    const preco = cf?.itensPrecos.find((ip) => ip.itemPedidoId === item.id);
                    return (
                      <label key={item.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                        ocItemIds.includes(item.id) ? 'border-emt-verde bg-green-50' : 'border-gray-200'
                      }`}>
                        <input
                          type="checkbox"
                          checked={ocItemIds.includes(item.id)}
                          onChange={() => toggleOcItem(item.id)}
                          className="accent-emt-verde"
                        />
                        <span className="flex-1 text-sm text-gray-700">{item.descricao}</span>
                        <span className="text-sm text-gray-500">{item.quantidade} {item.unidade}</span>
                        <span className="text-sm font-medium">{formatCurrency((preco?.precoUnitario ?? 0) * item.quantidade)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setGerandoOC(null)}>Cancelar</Button>
              <Button onClick={confirmarGerarOC} disabled={!ocFornecedorId || ocItemIds.length === 0}>
                Gerar OC
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
