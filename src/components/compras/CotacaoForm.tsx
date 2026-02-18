import { useState, useMemo } from 'react';
import type { Cotacao, PedidoCompra, Fornecedor, CotacaoFornecedor, ItemPedidoCompra, ItemPrecoCotacao } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface CotacaoFormProps {
  initial: Cotacao | null;
  pedidosAprovados: PedidoCompra[];
  fornecedores: Fornecedor[];
  onSubmit: (cotacao: Cotacao) => Promise<void>;
  onCancel: () => void;
  proximoNumero: string;
  pedidoPreSelecionado?: PedidoCompra | null;
}

export default function CotacaoForm({
  initial,
  pedidosAprovados,
  fornecedores,
  onSubmit,
  onCancel,
  proximoNumero,
  pedidoPreSelecionado,
}: CotacaoFormProps) {
  const [pedidoId, setPedidoId] = useState(initial?.pedidoCompraId ?? pedidoPreSelecionado?.id ?? '');
  const [prazoResposta, setPrazoResposta] = useState(initial?.prazoResposta ?? '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<string[]>(
    initial?.fornecedores.map((f) => f.fornecedorId) ?? []
  );
  // For cotacao criada direto (sem pedido), permita adicionar itens manualmente
  const [itensManual, setItensManual] = useState<ItemPedidoCompra[]>(
    initial?.itensPedido.length ? initial.itensPedido : []
  );
  const [saving, setSaving] = useState(false);

  const fornecedoresAtivos = fornecedores.filter((f) => f.ativo !== false);
  const pedidoSelecionado = pedidosAprovados.find((p) => p.id === pedidoId);
  const itensDoPedido: ItemPedidoCompra[] = pedidoSelecionado ? pedidoSelecionado.itens : itensManual;

  // Existing prices from initial
  const precosExistentes = useMemo(() => {
    const map = new Map<string, CotacaoFornecedor>();
    (initial?.fornecedores ?? []).forEach((cf) => map.set(cf.fornecedorId, cf));
    return map;
  }, [initial]);

  function toggleFornecedor(id: string) {
    setFornecedoresSelecionados((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  function addItemManual() {
    setItensManual([...itensManual, { id: genId(), descricao: '', categoria: 'outros', quantidade: 1, unidade: 'un' }]);
  }

  function removeItemManual(id: string) {
    setItensManual(itensManual.filter((i) => i.id !== id));
  }

  function updateItemManual(id: string, field: string, value: string | number) {
    setItensManual(itensManual.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fornecedoresSelecionados.length === 0) return;
    if (itensDoPedido.length === 0) return;
    setSaving(true);
    try {
      const cotFornecedores: CotacaoFornecedor[] = fornecedoresSelecionados.map((fId) => {
        const existing = precosExistentes.get(fId);
        if (existing) return existing;
        return {
          id: genId(),
          fornecedorId: fId,
          itensPrecos: itensDoPedido.map((item) => ({
            itemPedidoId: item.id,
            precoUnitario: 0,
          })),
          condicaoPagamento: '',
          prazoEntrega: '',
          total: 0,
          respondido: false,
          vencedor: false,
        };
      });

      const cotacao: Cotacao = {
        id: initial?.id ?? genId(),
        numero: initial?.numero ?? proximoNumero,
        data: initial?.data ?? new Date().toISOString().slice(0, 10),
        pedidoCompraId: pedidoId,
        prazoResposta,
        status: initial?.status ?? 'em_cotacao',
        fornecedores: cotFornecedores,
        itensPedido: itensDoPedido,
        observacoes,
        criadoPor: initial?.criadoPor ?? '',
      };
      await onSubmit(cotacao);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pedido de Referência</label>
          <select
            className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
            value={pedidoId}
            onChange={(e) => setPedidoId(e.target.value)}
          >
            <option value="">Sem pedido (cotação avulsa)</option>
            {pedidosAprovados.map((p) => (
              <option key={p.id} value={p.id}>{p.numero} - {p.solicitante}</option>
            ))}
          </select>
        </div>
        <Input
          label="Prazo para Respostas"
          id="cot-prazo"
          type="date"
          value={prazoResposta}
          onChange={(e) => setPrazoResposta(e.target.value)}
        />
      </div>

      {/* Itens manuais se sem pedido */}
      {!pedidoSelecionado && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Itens da Cotação</label>
            <Button type="button" variant="secondary" onClick={addItemManual} className="text-xs px-3 py-1">
              + Item
            </Button>
          </div>
          {itensManual.map((item, idx) => (
            <div key={item.id} className="flex gap-2 mb-2 items-end">
              <div className="flex-1">
                <Input label={`Descrição #${idx + 1}`} id={`cot-item-${item.id}`} value={item.descricao} onChange={(e) => updateItemManual(item.id, 'descricao', e.target.value)} required />
              </div>
              <div className="w-20">
                <Input label="Qtd" id={`cot-qtd-${item.id}`} type="number" min="0.01" step="0.01" value={item.quantidade} onChange={(e) => updateItemManual(item.id, 'quantidade', parseFloat(e.target.value) || 0)} required />
              </div>
              <div className="w-16">
                <Input label="Unid." id={`cot-un-${item.id}`} value={item.unidade} onChange={(e) => updateItemManual(item.id, 'unidade', e.target.value)} required />
              </div>
              {itensManual.length > 1 && (
                <button type="button" onClick={() => removeItemManual(item.id)} className="text-red-500 hover:text-red-700 text-sm pb-1">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview itens do pedido */}
      {pedidoSelecionado && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Itens do pedido ({pedidoSelecionado.itens.length})</p>
          <ul className="text-sm text-gray-700 space-y-1">
            {pedidoSelecionado.itens.map((item) => (
              <li key={item.id}>• {item.descricao} — {item.quantidade} {item.unidade}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Seleção de fornecedores */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Fornecedores<span className="text-red-500 ml-0.5">*</span></label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {fornecedoresAtivos.map((f) => (
            <label key={f.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              fornecedoresSelecionados.includes(f.id) ? 'border-emt-verde bg-green-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={fornecedoresSelecionados.includes(f.id)}
                onChange={() => toggleFornecedor(f.id)}
                className="accent-emt-verde"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{f.nome}</p>
                {f.cnpj && <p className="text-xs text-gray-500">{f.cnpj}</p>}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving || fornecedoresSelecionados.length === 0 || itensDoPedido.length === 0}>
          {saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar Cotação'}
        </Button>
      </div>
    </form>
  );
}
