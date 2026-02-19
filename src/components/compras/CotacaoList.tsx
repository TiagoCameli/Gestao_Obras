import { useState, useRef } from 'react';
import type { Cotacao, Fornecedor, PedidoCompra } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportarCotacaoPDF } from '../../utils/pdfExport';
import { parsePdfForCotacao, type PdfParseResult } from '../../utils/pdfCotacaoParser';
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
  onEditar?: (cotacao: Cotacao) => void;
  onExcluir?: (cotacao: Cotacao) => void;
  canEdit: boolean;
  canCreate: boolean;
}

export default function CotacaoList({
  cotacoes,
  fornecedores,
  pedidos,
  onSalvarPrecos,
  onGerarOC,
  onEditar,
  onExcluir,
  canEdit,
  canCreate,
}: CotacaoListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preenchendo, setPreenchendo] = useState<{ cotacao: Cotacao; fornecedorId: string } | null>(null);
  const [precos, setPrecos] = useState<{ precoUnitario: number; condicao: string; prazo: string }[]>([]);
  const [selFornecedorIds, setSelFornecedorIds] = useState<string[]>([]);
  const [selItemIds, setSelItemIds] = useState<string[]>([]);
  const [pdfProcessando, setPdfProcessando] = useState(false);
  const [pdfResultado, setPdfResultado] = useState<PdfParseResult | null>(null);
  const [pdfErro, setPdfErro] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
    setPdfResultado(null);
    setPdfErro('');
    setPreenchendo({ cotacao, fornecedorId });
  }

  async function handlePdfUpload(file: File) {
    if (!preenchendo) return;
    setPdfProcessando(true);
    setPdfErro('');
    setPdfResultado(null);

    try {
      const resultado = await parsePdfForCotacao(file, preenchendo.cotacao.itensPedido);

      if (!resultado.textoExtraido) {
        setPdfErro('Nenhum texto encontrado no PDF. O arquivo pode ser uma imagem escaneada.');
        setPdfProcessando(false);
        return;
      }

      setPdfResultado(resultado);

      // Update prices only for matched items (keep existing values for unmatched)
      setPrecos((prev) =>
        prev.map((p, idx) => {
          const pdfItem = resultado.precos[idx];
          if (!pdfItem?.matched) return p;
          return { ...p, precoUnitario: pdfItem.precoUnitario };
        })
      );

      // Update condicao/prazo if found
      if (resultado.condicaoPagamento) {
        setPrecos((prev) => prev.map((p) => ({ ...p, condicao: resultado.condicaoPagamento })));
      }
      if (resultado.prazoEntrega) {
        setPrecos((prev) => prev.map((p) => ({ ...p, prazo: resultado.prazoEntrega })));
      }
    } catch {
      setPdfErro('Erro ao processar o PDF. Verifique se o arquivo não está corrompido ou protegido.');
    } finally {
      setPdfProcessando(false);
    }
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

    // Auto-marcar menor preço como vencedor
    const respondidos = updatedFornecedores.filter((f) => f.respondido && f.total > 0);
    const menorId = respondidos.length > 0
      ? respondidos.reduce((min, cf) => (cf.total < min.total ? cf : min)).fornecedorId
      : null;
    const comVencedor = updatedFornecedores.map((cf) => ({
      ...cf,
      vencedor: cf.fornecedorId === menorId,
    }));

    const totalForn = comVencedor.length;
    let status: Cotacao['status'] = 'em_cotacao';
    if (respondidos.length === totalForn) status = 'cotado';
    else if (respondidos.length > 0) status = 'parcial';

    await onSalvarPrecos({ ...cotacao, fornecedores: comVencedor, status });
    setPreenchendo(null);
    setPdfResultado(null);
    setPdfErro('');
  }

  function getMenorPrecoTotal(cotacao: Cotacao): string | null {
    const respondidos = cotacao.fornecedores.filter((cf) => cf.respondido && cf.total > 0);
    if (respondidos.length === 0) return null;
    const menor = respondidos.reduce((min, cf) => (cf.total < min.total ? cf : min));
    return menor.fornecedorId;
  }

  function toggleSelFornecedor(id: string) {
    setSelFornecedorIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleSelItem(id: string) {
    setSelItemIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
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
                  onClick={() => { setExpanded(isOpen ? null : cot.id); setSelFornecedorIds([]); setSelItemIds([]); }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800 text-base">{cot.numero}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[cot.status]}`}>
                        {STATUS_LABEL[cot.status]}
                      </span>
                      {cot.descricao && (
                        <span className="text-sm text-gray-600 truncate">{cot.descricao}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{formatDate(cot.data)}</span>
                      {pedidoRef && (
                        <span className="text-xs text-gray-400">Ref: {pedidoRef.numero}</span>
                      )}
                      <span className="text-xs text-gray-400">{cot.fornecedores.length} fornecedor(es)</span>
                      <span className="text-xs text-gray-400">{cot.itensPedido.length} {cot.itensPedido.length === 1 ? 'item' : 'itens'}</span>
                      {cot.fornecedores.some((cf) => cf.respondido) && (() => {
                        const menorCf = cot.fornecedores
                          .filter((cf) => cf.respondido && cf.total > 0)
                          .reduce<{ total: number; fornecedorId: string } | null>(
                            (min, cf) => (!min || cf.total < min.total ? cf : min), null
                          );
                        if (!menorCf) return null;
                        const nome = fornecedoresMap.get(menorCf.fornecedorId)?.nome;
                        return (
                          <span className="text-xs font-medium text-green-700">
                            Menor: {formatCurrency(menorCf.total)}{nome ? ` (${nome})` : ''}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <span className="text-gray-400 text-lg ml-4 shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Conteúdo expandido */}
                {isOpen && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    {/* Quadro comparativo */}
                    <div className="overflow-x-auto mt-4 rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200 min-w-[200px]">Material</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-700 border-b border-gray-200 w-24">Qtd</th>
                            {cot.fornecedores.map((cf) => {
                              const forn = fornecedoresMap.get(cf.fornecedorId);
                              const isMenor = cf.fornecedorId === menorPrecoId && cf.respondido;
                              const isSelected = selFornecedorIds.includes(cf.fornecedorId);
                              return (
                                <th
                                  key={cf.id}
                                  className={`text-center px-4 py-3 font-semibold border-b border-l border-gray-200 min-w-[140px] transition-colors ${
                                    isSelected ? 'bg-green-50' : isMenor ? 'bg-green-50/50' : ''
                                  }`}
                                >
                                  <label className="flex flex-col items-center gap-1 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelFornecedor(cf.fornecedorId)}
                                        className="accent-emt-verde w-3.5 h-3.5"
                                      />
                                      <span className="text-gray-700">{forn?.nome || 'Fornecedor'}</span>
                                    </div>
                                    {isMenor && (
                                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold leading-none">
                                        Menor Preço
                                      </span>
                                    )}
                                    {!cf.respondido && (
                                      <span className="text-[10px] text-gray-400 font-normal italic">Aguardando</span>
                                    )}
                                  </label>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {cot.itensPedido.map((item, itemIdx) => {
                            const isItemSelected = selItemIds.includes(item.id);
                            // Find the cheapest unit price for this item across responded suppliers
                            const precosItem = cot.fornecedores
                              .filter((cf) => cf.respondido)
                              .map((cf) => ({
                                fornecedorId: cf.fornecedorId,
                                preco: cf.itensPrecos.find((ip) => ip.itemPedidoId === item.id)?.precoUnitario ?? 0,
                              }))
                              .filter((p) => p.preco > 0);
                            const menorPrecoItem = precosItem.length > 0
                              ? precosItem.reduce((min, p) => (p.preco < min.preco ? p : min)).fornecedorId
                              : null;

                            return (
                              <tr
                                key={item.id}
                                className={`transition-colors ${
                                  isItemSelected
                                    ? 'bg-green-50 hover:bg-green-100/60'
                                    : itemIdx % 2 === 0
                                      ? 'bg-white hover:bg-gray-50'
                                      : 'bg-gray-50/40 hover:bg-gray-100/50'
                                }`}
                              >
                                <td className="px-4 py-2.5 text-gray-700 border-b border-gray-100">
                                  <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isItemSelected}
                                      onChange={() => toggleSelItem(item.id)}
                                      className="accent-emt-verde w-3.5 h-3.5"
                                    />
                                    <span className="font-medium">{item.descricao}</span>
                                  </label>
                                </td>
                                <td className="px-4 py-2.5 text-center text-gray-500 border-b border-gray-100 whitespace-nowrap">
                                  {item.quantidade} <span className="text-gray-400">{item.unidade}</span>
                                </td>
                                {cot.fornecedores.map((cf) => {
                                  const preco = cf.itensPrecos.find((ip) => ip.itemPedidoId === item.id);
                                  const precoUnit = preco?.precoUnitario ?? 0;
                                  const subtotal = precoUnit * item.quantidade;
                                  const isMenorItem = cf.fornecedorId === menorPrecoItem;
                                  const isColSelected = selFornecedorIds.includes(cf.fornecedorId);
                                  return (
                                    <td
                                      key={cf.id}
                                      className={`px-4 py-2.5 text-center border-b border-l border-gray-100 transition-colors ${
                                        isColSelected ? 'bg-green-50/60' : ''
                                      }`}
                                    >
                                      {cf.respondido ? (
                                        <div>
                                          <span className={`font-medium ${isMenorItem ? 'text-green-700' : 'text-gray-800'}`}>
                                            {formatCurrency(precoUnit)}
                                          </span>
                                          <span className="text-[11px] text-gray-400 block leading-tight">
                                            sub {formatCurrency(subtotal)}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-gray-300 text-xs">--</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-semibold">
                            <td className="px-4 py-3 text-gray-700 border-t-2 border-gray-200" colSpan={2}>Total Geral</td>
                            {cot.fornecedores.map((cf) => {
                              const isMenor = cf.fornecedorId === menorPrecoId && cf.respondido;
                              return (
                                <td key={cf.id} className={`px-4 py-3 text-center border-t-2 border-l border-gray-200 ${isMenor ? 'text-green-700' : 'text-gray-800'}`}>
                                  {cf.respondido ? formatCurrency(cf.total) : '--'}
                                </td>
                              );
                            })}
                          </tr>
                          <tr className="bg-gray-50/60">
                            <td className="px-4 py-2 text-xs text-gray-500 font-medium" colSpan={2}>Cond. Pagamento</td>
                            {cot.fornecedores.map((cf) => (
                              <td key={cf.id} className="px-4 py-2 text-center text-xs text-gray-500 border-l border-gray-100">
                                {cf.condicaoPagamento || <span className="text-gray-300">--</span>}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-gray-50/60">
                            <td className="px-4 py-2 text-xs text-gray-500 font-medium" colSpan={2}>Prazo Entrega</td>
                            {cot.fornecedores.map((cf) => (
                              <td key={cf.id} className="px-4 py-2 text-center text-xs text-gray-500 border-l border-gray-100">
                                {cf.prazoEntrega || <span className="text-gray-300">--</span>}
                              </td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <Button
                        variant="secondary"
                        onClick={() => exportarCotacaoPDF(cot, fornecedoresMap)}
                        className="text-xs"
                      >
                        Exportar PDF
                      </Button>
                      {canEdit && onEditar && (
                        <Button variant="secondary" onClick={() => onEditar(cot)} className="text-xs">
                          Editar Cotação
                        </Button>
                      )}
                      {canEdit && onExcluir && (
                        <Button variant="ghost" onClick={() => onExcluir(cot)} className="text-xs text-red-600 hover:text-red-800">
                          Excluir
                        </Button>
                      )}
                      {canEdit && cot.fornecedores.map((cf) => {
                        const forn = fornecedoresMap.get(cf.fornecedorId);
                        return (
                          <Button key={cf.id} variant="secondary" onClick={() => startPreencher(cot, cf.fornecedorId)} className="text-xs">
                            {cf.respondido ? 'Editar' : 'Preencher'} {forn?.nome}
                          </Button>
                        );
                      })}
                      {canCreate && cot.fornecedores.some((cf) => cf.respondido) && (() => {
                        const fornSel = selFornecedorIds.filter((id) => cot.fornecedores.some((cf) => cf.fornecedorId === id && cf.respondido));
                        const itensSel = selItemIds.filter((id) => cot.itensPedido.some((it) => it.id === id));
                        const podeGerar = fornSel.length === 1 && itensSel.length > 0;
                        return (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => onGerarOC(cot, fornSel[0], itensSel)}
                              disabled={!podeGerar}
                              className="text-xs"
                            >
                              Gerar Ordem de Compra
                            </Button>
                            {!podeGerar && (fornSel.length > 0 || itensSel.length > 0) && (
                              <span className="text-xs text-gray-400">
                                {fornSel.length === 0 && 'Selecione 1 fornecedor'}
                                {fornSel.length > 1 && 'Selecione apenas 1 fornecedor'}
                                {fornSel.length === 1 && itensSel.length === 0 && 'Selecione ao menos 1 item'}
                              </span>
                            )}
                          </div>
                        );
                      })()}
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
        onClose={() => { setPreenchendo(null); setPdfResultado(null); setPdfErro(''); }}
        title={`Preços - ${fornecedoresMap.get(preenchendo?.fornecedorId ?? '')?.nome ?? ''}`}
      >
        {preenchendo && (
          <div className="space-y-4">
            {/* Upload PDF */}
            <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfUpload(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfProcessando}
                  className="text-xs"
                >
                  {pdfProcessando ? 'Processando...' : '📄 Upload PDF do Fornecedor'}
                </Button>
                {pdfProcessando && (
                  <span className="text-xs text-gray-500 animate-pulse">Extraindo dados do PDF...</span>
                )}
              </div>
              {pdfErro && (
                <p className="text-xs text-red-600 mt-2">{pdfErro}</p>
              )}
              {pdfResultado && (
                <p className="text-xs text-green-700 mt-2">
                  {pdfResultado.precos.filter((p) => p.matched).length} de {pdfResultado.precos.length} itens preenchidos automaticamente
                </p>
              )}
            </div>

            {/* Lista de itens */}
            {preenchendo.cotacao.itensPedido.map((item, idx) => {
              const pdfItem = pdfResultado?.precos[idx];
              const isAutoFilled = pdfItem?.matched;

              return (
                <div key={item.id} className="flex items-end gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">
                      {item.descricao}
                      {' '}<span className="text-xs text-gray-400">({item.quantidade} {item.unidade})</span>
                      {isAutoFilled && <span className="text-xs text-blue-600 ml-1">(PDF)</span>}
                      {pdfItem && pdfItem.confidence !== 'nenhuma' && (
                        <span className={`ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          pdfItem.confidence === 'alta' ? 'bg-green-100 text-green-800' :
                          pdfItem.confidence === 'media' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {pdfItem.confidence}
                        </span>
                      )}
                    </p>
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
                      className={isAutoFilled ? '!border-green-400 !ring-green-200' : ''}
                    />
                  </div>
                  <div className="w-32 text-right text-sm font-medium text-gray-700 pb-1">
                    {formatCurrency((precos[idx]?.precoUnitario ?? 0) * item.quantidade)}
                  </div>
                </div>
              );
            })}
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

    </div>
  );
}
