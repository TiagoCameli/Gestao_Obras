import { useState, useMemo, useRef, useEffect } from 'react';
import type { Cotacao, PedidoCompra, Fornecedor, CotacaoFornecedor, ItemPedidoCompra, Insumo, UnidadeMedida, CategoriaMaterialCompra, UnidadeCompra } from '../../types';
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

function FornecedorMultiSelect({
  fornecedores,
  selecionados,
  onToggle,
  onCreateFornecedor,
}: {
  fornecedores: Fornecedor[];
  selecionados: string[];
  onToggle: (id: string) => void;
  onCreateFornecedor?: (nome: string) => Promise<string>;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtrados = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj && f.cnpj.includes(busca))
  );

  const selecionadosInfo = fornecedores.filter((f) => selecionados.includes(f.id));

  return (
    <div ref={ref} className="relative">
      {/* Chips dos selecionados */}
      {selecionadosInfo.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selecionadosInfo.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
            >
              {f.nome}
              <button
                type="button"
                onClick={() => onToggle(f.id)}
                className="text-green-600 hover:text-green-900 font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input de busca */}
      <input
        type="text"
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
        placeholder={selecionados.length > 0 ? 'Buscar mais fornecedores...' : 'Buscar fornecedores...'}
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        autoComplete="off"
      />

      {/* Dropdown */}
      {aberto && (
        <ul className="absolute z-50 w-full mt-1 max-h-52 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhum fornecedor encontrado</li>
          ) : (
            filtrados.map((f) => {
              const checked = selecionados.includes(f.id);
              return (
                <li
                  key={f.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${checked ? 'bg-green-50' : ''}`}
                  onMouseDown={() => onToggle(f.id)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="accent-emt-verde pointer-events-none"
                  />
                  <div>
                    <span className="font-medium text-gray-800">{f.nome}</span>
                    {f.cnpj && <span className="text-xs text-gray-400 ml-2">{f.cnpj}</span>}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}

      {/* Criar novo fornecedor inline */}
      {onCreateFornecedor && !criando && (
        <button
          type="button"
          className="text-xs text-emt-verde hover:underline mt-1"
          onClick={() => { setCriando(true); setNovoNome(busca); }}
        >
          + Novo fornecedor
        </button>
      )}
      {criando && (
        <div className="mt-2 flex gap-2 items-end">
          <input
            className="flex-1 h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do fornecedor"
            autoFocus
          />
          <button
            type="button"
            disabled={!novoNome.trim() || salvando}
            className="px-3 py-2 bg-emt-verde text-white rounded-lg text-sm font-medium disabled:opacity-50 h-[38px]"
            onClick={async () => {
              if (!onCreateFornecedor || !novoNome.trim()) return;
              setSalvando(true);
              try {
                const id = await onCreateFornecedor(novoNome.trim());
                onToggle(id);
                setCriando(false);
                setNovoNome('');
                setBusca('');
              } finally {
                setSalvando(false);
              }
            }}
          >
            {salvando ? '...' : 'Salvar'}
          </button>
          <button
            type="button"
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium h-[38px]"
            onClick={() => { setCriando(false); setNovoNome(''); }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface CotacaoFormProps {
  initial: Cotacao | null;
  pedidosAprovados: PedidoCompra[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  unidades: UnidadeMedida[];
  categorias: { value: string; label: string }[];
  onSubmit: (cotacao: Cotacao) => Promise<void>;
  onCancel: () => void;
  proximoNumero: string;
  pedidoPreSelecionado?: PedidoCompra | null;
  onCreateFornecedor?: (nome: string) => Promise<string>;
}

export default function CotacaoForm({
  initial,
  pedidosAprovados,
  fornecedores,
  insumos,
  unidades,
  categorias,
  onSubmit,
  onCancel,
  proximoNumero,
  pedidoPreSelecionado,
  onCreateFornecedor,
}: CotacaoFormProps) {
  const [pedidoId, setPedidoId] = useState(initial?.pedidoCompraId ?? pedidoPreSelecionado?.id ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
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

  // Inline insumo creation
  const adicionarInsumoMutation = useAdicionarInsumo();
  const [listaInsumosLocal, setListaInsumosLocal] = useState<Insumo[]>([]);
  const [novoInsumoAberto, setNovoInsumoAberto] = useState<string | null>(null);
  const [novoInsumoNome, setNovoInsumoNome] = useState('');
  const [novoInsumoUnidade, setNovoInsumoUnidade] = useState('');
  const [novoInsumoCategoria, setNovoInsumoCategoria] = useState<CategoriaMaterialCompra>('outros');
  const insumosAtivos = useMemo(() => [...insumos.filter((i) => i.ativo !== false), ...listaInsumosLocal], [insumos, listaInsumosLocal]);

  const fornecedoresAtivos = fornecedores.filter((f) => f.ativo !== false);
  const pedidoSelecionado = pedidosAprovados.find((p) => p.id === pedidoId);
  const isEditing = !!initial;
  // When editing, always use itensManual (editable); for new cotação with pedido, use pedido items read-only
  const itensDoPedido: ItemPedidoCompra[] = (pedidoSelecionado && !isEditing) ? pedidoSelecionado.itens : itensManual;

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

  function selectInsumo(itemId: string, insumoId: string) {
    const insumo = insumosAtivos.find((i) => i.id === insumoId);
    if (!insumo) return;
    setItensManual((prev) => prev.map((i) =>
      i.id === itemId
        ? { ...i, descricao: insumo.nome, unidade: (insumo.unidade || 'un') as UnidadeCompra, categoria: insumo.categoria || 'outros' }
        : i
    ));
  }

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
      // Select the newly created insumo for the item
      setItensManual((prev) => prev.map((i) =>
        i.id === itemId
          ? { ...i, descricao: novoInsumo.nome, unidade: (novoInsumo.unidade || 'un') as UnidadeCompra, categoria: novoInsumo.categoria || 'outros' }
          : i
      ));
      setNovoInsumoAberto(null);
      setNovoInsumoNome('');
      setNovoInsumoUnidade('');
      setNovoInsumoCategoria('outros');
    } catch {
      // mutation error handled by react-query
    }
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
        descricao,
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
      <Input
        label="Descrição"
        id="cot-descricao"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Ex: Materiais para fundação Bloco A"
        required
      />

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

      {/* Editable items: when editing OR no pedido linked */}
      {(isEditing || !pedidoSelecionado) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Itens da Cotação</label>
            <Button type="button" variant="secondary" onClick={addItemManual} className="text-xs px-3 py-1">
              + Item
            </Button>
          </div>
          <div className="space-y-3">
            {itensManual.map((item, idx) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                  {itensManual.length > 1 && (
                    <button type="button" onClick={() => removeItemManual(item.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                      Remover
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`cot-insumo-${item.id}`}>Insumo</label>
                    <InsumoCombobox
                      id={`cot-insumo-${item.id}`}
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
                  <div>
                    <Input
                      label="Qtd"
                      id={`cot-qtd-${item.id}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantidade}
                      onChange={(e) => updateItemManual(item.id, 'quantidade', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div>
                    {insumoSelecionadoParaItem(item) ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unid.</label>
                        <div className="w-full h-[38px] flex items-center justify-center border border-gray-200 bg-gray-50 rounded-lg px-2 text-sm text-gray-600">
                          {item.unidade}
                        </div>
                      </div>
                    ) : (
                      <Input label="Unid." id={`cot-un-${item.id}`} value={item.unidade} onChange={(e) => updateItemManual(item.id, 'unidade', e.target.value)} required />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Read-only preview: only for new cotação linked to a pedido */}
      {pedidoSelecionado && !isEditing && (
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fornecedores<span className="text-red-500 ml-0.5">*</span>
          {fornecedoresSelecionados.length > 0 && (
            <span className="text-xs text-gray-400 font-normal ml-2">({fornecedoresSelecionados.length} selecionado{fornecedoresSelecionados.length !== 1 ? 's' : ''})</span>
          )}
        </label>
        <FornecedorMultiSelect
          fornecedores={fornecedoresAtivos}
          selecionados={fornecedoresSelecionados}
          onToggle={toggleFornecedor}
          onCreateFornecedor={onCreateFornecedor}
        />
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
