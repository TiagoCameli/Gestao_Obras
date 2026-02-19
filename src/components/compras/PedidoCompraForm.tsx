import { useState, useRef, useEffect } from 'react';
import type { PedidoCompra, ItemPedidoCompra, Obra, Insumo, UnidadeMedida, UrgenciaPedidoCompra, CategoriaMaterialCompra, UnidadeCompra } from '../../types';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

function InsumoCombobox({ id, insumos, value, onChange }: {
  id: string;
  insumos: Insumo[];
  value: string;
  onChange: (insumoId: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const insumoSelecionado = insumos.find((i) => i.id === value);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtrados = insumos.filter((i) =>
    i.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        type="text"
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
        placeholder="Buscar insumo..."
        value={aberto ? busca : (insumoSelecionado?.nome ?? '')}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); setBusca(''); }}
        autoComplete="off"
        required={!value}
      />
      {aberto && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhum insumo encontrado</li>
          ) : (
            filtrados.map((ins) => (
              <li
                key={ins.id}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${ins.id === value ? 'bg-green-100 font-medium' : ''}`}
                onMouseDown={() => { onChange(ins.id); setAberto(false); setBusca(''); }}
              >
                {ins.nome} <span className="text-gray-400 text-xs">({ins.unidade})</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

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
  insumos: Insumo[];
  unidades: UnidadeMedida[];
  categorias: { value: string; label: string }[];
  onSubmit: (pedido: PedidoCompra) => Promise<void>;
  onCancel: () => void;
  proximoNumero: string;
  nomeUsuario?: string;
}

export default function PedidoCompraForm({ initial, obras, insumos, unidades, categorias, onSubmit, onCancel, proximoNumero, nomeUsuario }: PedidoCompraFormProps) {
  const [obraId, setObraId] = useState(initial?.obraId ?? '');
  const [solicitante, setSolicitante] = useState(initial?.solicitante ?? nomeUsuario ?? '');
  const [urgencia, setUrgencia] = useState<UrgenciaPedidoCompra>(initial?.urgencia ?? 'normal');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [itens, setItens] = useState<ItemPedidoCompra[]>(
    initial?.itens.length ? initial.itens : [{ id: genId(), descricao: '', categoria: 'outros', quantidade: 1, unidade: 'un' }]
  );
  const [saving, setSaving] = useState(false);

  // Inline insumo creation
  const adicionarInsumoMutation = useAdicionarInsumo();
  const [listaInsumosLocal, setListaInsumosLocal] = useState<Insumo[]>([]);
  const [novoInsumoAberto, setNovoInsumoAberto] = useState<string | null>(null);
  const [novoInsumoNome, setNovoInsumoNome] = useState('');
  const [novoInsumoUnidade, setNovoInsumoUnidade] = useState('');
  const [novoInsumoCategoria, setNovoInsumoCategoria] = useState<CategoriaMaterialCompra>('outros');

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

  function selectInsumo(itemId: string, insumoId: string) {
    const insumo = insumosAtivos.find((i) => i.id === insumoId);
    if (!insumo) return;
    setItens(itens.map((i) =>
      i.id === itemId
        ? { ...i, descricao: insumo.nome, unidade: (insumo.unidade || 'un') as UnidadeCompra, categoria: insumo.categoria || 'outros' }
        : i
    ));
  }

  const insumosAtivos = [...insumos.filter((i) => i.ativo !== false), ...listaInsumosLocal];

  function insumoSelecionadoParaItem(item: ItemPedidoCompra) {
    return insumosAtivos.find((ins) => ins.nome === item.descricao);
  }

  async function handleCriarInsumo(itemId: string) {
    if (!novoInsumoNome || !novoInsumoUnidade) return;
    const novoInsumo: Insumo = {
      id: genId(),
      nome: novoInsumoNome,
      tipo: 'material',
      unidade: novoInsumoUnidade,
      descricao: '',
      ativo: true,
      criadoPor: '',
      categoria: novoInsumoCategoria,
    };
    try {
      await adicionarInsumoMutation.mutateAsync(novoInsumo);
      setListaInsumosLocal((prev) => [...prev, novoInsumo]);
      selectInsumoDirectly(itemId, novoInsumo);
      setNovoInsumoAberto(null);
      setNovoInsumoNome('');
      setNovoInsumoUnidade('');
      setNovoInsumoCategoria('outros');
    } catch {
      // mutation error handled by react-query
    }
  }

  function selectInsumoDirectly(itemId: string, insumo: Insumo) {
    setItens((prev) => prev.map((i) =>
      i.id === itemId
        ? { ...i, descricao: insumo.nome, unidade: (insumo.unidade || 'un') as UnidadeCompra, categoria: insumo.categoria || 'outros' }
        : i
    ));
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
          readOnly={!initial && !!nomeUsuario}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`item-insumo-${item.id}`}>Insumo</label>
                  <InsumoCombobox
                    id={`item-insumo-${item.id}`}
                    insumos={insumosAtivos}
                    value={insumosAtivos.find((ins) => ins.nome === item.descricao)?.id ?? ''}
                    onChange={(insumoId) => selectInsumo(item.id, insumoId)}
                  />
                  {novoInsumoAberto !== item.id && (
                    <button
                      type="button"
                      className="text-xs text-green-700 hover:text-green-900 mt-1 font-medium"
                      onClick={() => { setNovoInsumoAberto(item.id); setNovoInsumoNome(''); setNovoInsumoUnidade(''); setNovoInsumoCategoria('outros'); }}
                    >
                      + Novo Insumo
                    </button>
                  )}
                  {novoInsumoAberto === item.id && (
                    <div className="mt-2 border border-green-200 rounded-lg p-3 bg-green-50 space-y-2">
                      <p className="text-xs font-medium text-green-800">Cadastrar novo insumo</p>
                      <Input
                        label="Nome"
                        id={`novo-insumo-nome-${item.id}`}
                        value={novoInsumoNome}
                        onChange={(e) => setNovoInsumoNome(e.target.value)}
                        placeholder="Nome do insumo"
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          label="Unidade"
                          id={`novo-insumo-un-${item.id}`}
                          options={unidades.filter((u) => u.ativo).map((u) => ({ value: u.sigla, label: u.nome }))}
                          value={novoInsumoUnidade}
                          onChange={(e) => setNovoInsumoUnidade(e.target.value)}
                          placeholder="Selecione"
                          required
                        />
                        <Select
                          label="Categoria"
                          id={`novo-insumo-cat-${item.id}`}
                          options={categorias}
                          value={novoInsumoCategoria}
                          onChange={(e) => setNovoInsumoCategoria(e.target.value as CategoriaMaterialCompra)}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="secondary" className="text-xs px-3 py-1" onClick={() => setNovoInsumoAberto(null)}>
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          className="text-xs px-3 py-1"
                          disabled={!novoInsumoNome || !novoInsumoUnidade || adicionarInsumoMutation.isPending}
                          onClick={() => handleCriarInsumo(item.id)}
                        >
                          {adicionarInsumoMutation.isPending ? 'Salvando...' : 'Salvar Insumo'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <Select
                  label="Categoria"
                  id={`item-cat-${item.id}`}
                  options={categorias}
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
                  {insumoSelecionadoParaItem(item) ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unid.</label>
                      <div className="w-full h-[38px] flex items-center justify-center border border-gray-200 bg-gray-50 rounded-lg px-2 text-sm text-gray-600">
                        {item.unidade}
                      </div>
                    </div>
                  ) : (
                    <Select
                      label="Unid."
                      id={`item-un-${item.id}`}
                      options={UNIDADES}
                      value={item.unidade}
                      onChange={(e) => updateItem(item.id, 'unidade', e.target.value)}
                      required
                    />
                  )}
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

export { UNIDADES };
