import { useState, useMemo } from 'react';
import type { OrdemCompra, ItemOrdemCompra, CustosAdicionaisOC, Obra, EtapaObra, Fornecedor } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface OrdemCompraFormProps {
  initial: OrdemCompra | null;
  obras: Obra[];
  etapas: EtapaObra[];
  fornecedores: Fornecedor[];
  onSubmit: (oc: OrdemCompra) => Promise<void>;
  onCancel: () => void;
  proximoNumero: string;
}

export default function OrdemCompraForm({
  initial,
  obras,
  etapas,
  fornecedores,
  onSubmit,
  onCancel,
  proximoNumero,
}: OrdemCompraFormProps) {
  const [obraId, setObraId] = useState(initial?.obraId ?? '');
  const [etapaObraId, setEtapaObraId] = useState(initial?.etapaObraId ?? '');
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId ?? '');
  const [condicaoPagamento, setCondicaoPagamento] = useState(initial?.condicaoPagamento ?? '');
  const [prazoEntrega, setPrazoEntrega] = useState(initial?.prazoEntrega ?? '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [entradaInsumos, setEntradaInsumos] = useState(initial?.entradaInsumos ?? false);
  const [itens, setItens] = useState<ItemOrdemCompra[]>(
    initial?.itens.length ? initial.itens : [{ id: genId(), descricao: '', quantidade: 1, unidade: 'un', precoUnitario: 0, subtotal: 0 }]
  );
  const [custos, setCustos] = useState<CustosAdicionaisOC>(
    initial?.custosAdicionais ?? { frete: 0, outrasDespesas: 0, impostos: 0, desconto: 0 }
  );
  const [saving, setSaving] = useState(false);

  const etapasFiltradas = etapas.filter((e) => e.obraId === obraId);
  const fornecedoresAtivos = fornecedores.filter((f) => f.ativo !== false);
  const fornecedorSelecionado = fornecedores.find((f) => f.id === fornecedorId);

  const totalMateriais = useMemo(() => itens.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0), [itens]);
  const totalGeral = useMemo(() => totalMateriais + custos.frete + custos.outrasDespesas + custos.impostos - custos.desconto, [totalMateriais, custos]);

  function addItem() {
    setItens([...itens, { id: genId(), descricao: '', quantidade: 1, unidade: 'un', precoUnitario: 0, subtotal: 0 }]);
  }

  function removeItem(id: string) {
    if (itens.length <= 1) return;
    setItens(itens.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof ItemOrdemCompra, value: string | number) {
    setItens(itens.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      updated.subtotal = updated.quantidade * updated.precoUnitario;
      return updated;
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const oc: OrdemCompra = {
        id: initial?.id ?? genId(),
        numero: initial?.numero ?? proximoNumero,
        dataCriacao: initial?.dataCriacao ?? new Date().toISOString().slice(0, 10),
        dataEntrega: initial?.dataEntrega ?? '',
        obraId,
        etapaObraId: entradaInsumos ? '' : etapaObraId,
        fornecedorId,
        cotacaoId: initial?.cotacaoId ?? '',
        pedidoCompraId: initial?.pedidoCompraId ?? '',
        itens: itens.map((i) => ({ ...i, subtotal: i.quantidade * i.precoUnitario })),
        custosAdicionais: custos,
        totalMateriais,
        totalGeral,
        condicaoPagamento,
        prazoEntrega,
        status: initial?.status ?? 'emitida',
        observacoes,
        entradaInsumos,
        criadoPor: initial?.criadoPor ?? '',
      };
      await onSubmit(oc);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Fornecedor"
          id="oc-fornecedor"
          options={fornecedoresAtivos.map((f) => ({ value: f.id, label: f.nome }))}
          value={fornecedorId}
          onChange={(e) => setFornecedorId(e.target.value)}
          required
        />
        <Select
          label="Obra"
          id="oc-obra"
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          value={obraId}
          onChange={(e) => { setObraId(e.target.value); setEtapaObraId(''); }}
          required
        />
      </div>

      {/* Preview fornecedor */}
      {fornecedorSelecionado && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
          <div><span className="text-gray-500">Fornecedor:</span> <span className="font-medium">{fornecedorSelecionado.nome}</span></div>
          {fornecedorSelecionado.cnpj && <div><span className="text-gray-500">CNPJ:</span> <span className="font-medium">{fornecedorSelecionado.cnpj}</span></div>}
          {fornecedorSelecionado.telefone && <div><span className="text-gray-500">Telefone:</span> <span className="font-medium">{fornecedorSelecionado.telefone}</span></div>}
          {fornecedorSelecionado.email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{fornecedorSelecionado.email}</span></div>}
        </div>
      )}

      {/* Entrada no estoque */}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={entradaInsumos} onChange={(e) => setEntradaInsumos(e.target.checked)} className="accent-emt-verde" />
        <span className="text-gray-700">Entrada no estoque de insumos (gasto alocado na saída)</span>
      </label>

      {/* Etapa */}
      {!entradaInsumos && obraId && etapasFiltradas.length > 0 && (
        <Select
          label="Etapa da Obra"
          id="oc-etapa"
          options={etapasFiltradas.map((e) => ({ value: e.id, label: e.nome }))}
          value={etapaObraId}
          onChange={(e) => setEtapaObraId(e.target.value)}
          placeholder="Selecione a etapa..."
        />
      )}

      {/* Itens */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Itens</label>
          <Button type="button" variant="secondary" onClick={addItem} className="text-xs px-3 py-1">+ Item</Button>
        </div>
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                {itens.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Remover</button>
                )}
              </div>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <Input label="Descrição" id={`oc-desc-${item.id}`} value={item.descricao} onChange={(e) => updateItem(item.id, 'descricao', e.target.value)} required />
                </div>
                <div className="col-span-2">
                  <Input label="Qtd" id={`oc-qtd-${item.id}`} type="number" min="0.01" step="0.01" value={item.quantidade} onChange={(e) => updateItem(item.id, 'quantidade', parseFloat(e.target.value) || 0)} required />
                </div>
                <div className="col-span-2">
                  <Input label="Unid." id={`oc-un-${item.id}`} value={item.unidade} onChange={(e) => updateItem(item.id, 'unidade', e.target.value)} required />
                </div>
                <div className="col-span-2">
                  <Input label="Preço Unit." id={`oc-preco-${item.id}`} type="number" min="0" step="0.01" value={item.precoUnitario} onChange={(e) => updateItem(item.id, 'precoUnitario', parseFloat(e.target.value) || 0)} required />
                </div>
                <div className="col-span-2 flex items-end pb-1">
                  <p className="text-sm font-medium text-gray-700 text-right w-full">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantidade * item.precoUnitario)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custos adicionais */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Outros Custos</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Frete (R$)" id="oc-frete" type="number" min="0" step="0.01" value={custos.frete} onChange={(e) => setCustos({ ...custos, frete: parseFloat(e.target.value) || 0 })} />
          <Input label="Outras Despesas" id="oc-despesas" type="number" min="0" step="0.01" value={custos.outrasDespesas} onChange={(e) => setCustos({ ...custos, outrasDespesas: parseFloat(e.target.value) || 0 })} />
          <Input label="Impostos" id="oc-impostos" type="number" min="0" step="0.01" value={custos.impostos} onChange={(e) => setCustos({ ...custos, impostos: parseFloat(e.target.value) || 0 })} />
          <Input label="Desconto" id="oc-desconto" type="number" min="0" step="0.01" value={custos.desconto} onChange={(e) => setCustos({ ...custos, desconto: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Totais */}
      <div className="bg-gray-50 rounded-lg p-4 text-right space-y-1">
        <p className="text-sm text-gray-600">Materiais: <span className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMateriais)}</span></p>
        <p className="text-lg font-bold text-gray-800">Total Geral: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Condição de Pagamento" id="oc-cond" value={condicaoPagamento} onChange={(e) => setCondicaoPagamento(e.target.value)} placeholder="Ex: 30/60/90 dias" />
        <Input label="Prazo de Entrega" id="oc-prazo-ent" value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} placeholder="Ex: 10 dias úteis" />
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
        <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar OC'}</Button>
      </div>
    </form>
  );
}
