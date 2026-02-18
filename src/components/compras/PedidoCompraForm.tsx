import { useState } from 'react';
import type { PedidoCompra, ItemPedidoCompra, Obra, UrgenciaPedidoCompra, CategoriaMaterialCompra, UnidadeCompra } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

const CATEGORIAS: { value: CategoriaMaterialCompra; label: string }[] = [
  { value: 'concreto_argamassa', label: 'Concreto e Argamassa' },
  { value: 'aco_ferragens', label: 'Aço e Ferragens' },
  { value: 'madeiras', label: 'Madeiras' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'hidraulica', label: 'Hidráulica' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'acabamento', label: 'Acabamento' },
  { value: 'epi', label: 'EPI' },
  { value: 'ferramentas', label: 'Ferramentas' },
  { value: 'outros', label: 'Outros' },
];

const UNIDADES: { value: UnidadeCompra; label: string }[] = [
  { value: 'un', label: 'un' },
  { value: 'kg', label: 'kg' },
  { value: 'm', label: 'm' },
  { value: 'm2', label: 'm²' },
  { value: 'm3', label: 'm³' },
  { value: 'lt', label: 'lt' },
  { value: 'sc', label: 'sc' },
  { value: 'pc', label: 'pç' },
  { value: 'cx', label: 'cx' },
  { value: 'rl', label: 'rl' },
  { value: 'tb', label: 'tb' },
];

const URGENCIAS: { value: UrgenciaPedidoCompra; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface PedidoCompraFormProps {
  initial: PedidoCompra | null;
  obras: Obra[];
  onSubmit: (pedido: PedidoCompra) => Promise<void>;
  onCancel: () => void;
  proximoNumero: string;
}

export default function PedidoCompraForm({ initial, obras, onSubmit, onCancel, proximoNumero }: PedidoCompraFormProps) {
  const [obraId, setObraId] = useState(initial?.obraId ?? '');
  const [solicitante, setSolicitante] = useState(initial?.solicitante ?? '');
  const [urgencia, setUrgencia] = useState<UrgenciaPedidoCompra>(initial?.urgencia ?? 'normal');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [itens, setItens] = useState<ItemPedidoCompra[]>(
    initial?.itens.length ? initial.itens : [{ id: genId(), descricao: '', categoria: 'outros', quantidade: 1, unidade: 'un' }]
  );
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItens([...itens, { id: genId(), descricao: '', categoria: 'outros', quantidade: 1, unidade: 'un' }]);
  }

  function removeItem(id: string) {
    if (itens.length <= 1) return;
    setItens(itens.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof ItemPedidoCompra, value: string | number) {
    setItens(itens.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const pedido: PedidoCompra = {
        id: initial?.id ?? genId(),
        numero: initial?.numero ?? proximoNumero,
        data: initial?.data ?? new Date().toISOString().slice(0, 10),
        obraId,
        solicitante,
        urgencia,
        status: initial?.status ?? 'pendente',
        observacoes,
        itens,
        criadoPor: initial?.criadoPor ?? '',
      };
      await onSubmit(pedido);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Obra"
          id="pedido-obra"
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          required
        />
        <Input
          label="Solicitante"
          id="pedido-solicitante"
          value={solicitante}
          onChange={(e) => setSolicitante(e.target.value)}
          required
        />
      </div>

      <Select
        label="Urgência"
        id="pedido-urgencia"
        options={URGENCIAS}
        value={urgencia}
        onChange={(e) => setUrgencia(e.target.value as UrgenciaPedidoCompra)}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      {/* Itens */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Itens do Pedido</label>
          <Button type="button" variant="secondary" onClick={addItem} className="text-xs px-3 py-1">
            + Adicionar Item
          </Button>
        </div>
        <div className="space-y-3">
          {itens.map((item, idx) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                {itens.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                    Remover
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <Input
                    label="Descrição"
                    id={`item-desc-${item.id}`}
                    value={item.descricao}
                    onChange={(e) => updateItem(item.id, 'descricao', e.target.value)}
                    required
                  />
                </div>
                <Select
                  label="Categoria"
                  id={`item-cat-${item.id}`}
                  options={CATEGORIAS}
                  value={item.categoria}
                  onChange={(e) => updateItem(item.id, 'categoria', e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Qtd"
                    id={`item-qtd-${item.id}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantidade}
                    onChange={(e) => updateItem(item.id, 'quantidade', parseFloat(e.target.value) || 0)}
                    required
                  />
                  <Select
                    label="Unid."
                    id={`item-un-${item.id}`}
                    options={UNIDADES}
                    value={item.unidade}
                    onChange={(e) => updateItem(item.id, 'unidade', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Criar Pedido'}</Button>
      </div>
    </form>
  );
}

export { CATEGORIAS, UNIDADES };
