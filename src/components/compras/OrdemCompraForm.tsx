import { useState, useMemo, useRef, useEffect } from 'react';
import type { OrdemCompra, ItemOrdemCompra, CustosAdicionaisOC, Obra, EtapaObra, Fornecedor, ParcelaPagamento, Insumo } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

function GenericCombobox<T extends { id: string }>({ id, label, items, value, onChange, placeholder, getLabel, getDetail }: {
  id: string;
  label: string;
  items: T[];
  value: string;
  onChange: (itemId: string) => void;
  placeholder: string;
  getLabel: (item: T) => string;
  getDetail?: (item: T) => string;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selecionado = items.find((i) => i.id === value);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtrados = items.filter((i) =>
    getLabel(i).toLowerCase().includes(busca.toLowerCase()) ||
    (getDetail && getDetail(i).toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id}>{label}<span className="text-red-500 ml-0.5">*</span></label>
      <input
        id={id}
        type="text"
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
        placeholder={placeholder}
        value={aberto ? busca : (selecionado ? getLabel(selecionado) : '')}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); setBusca(''); }}
        autoComplete="off"
        required={!value}
      />
      {aberto && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhum resultado encontrado</li>
          ) : (
            filtrados.map((item) => (
              <li
                key={item.id}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${item.id === value ? 'bg-green-100 font-medium' : ''}`}
                onMouseDown={() => { onChange(item.id); setAberto(false); setBusca(''); }}
              >
                {getLabel(item)}
                {getDetail && <span className="text-gray-400 text-xs ml-2">{getDetail(item)}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function EtapaCombobox({ id, etapas, value, onChange }: {
  id: string;
  etapas: EtapaObra[];
  value: string;
  onChange: (etapaId: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const etapaSelecionada = etapas.find((e) => e.id === value);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtradas = etapas.filter((e) =>
    e.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id}>Etapa da Obra</label>
      <input
        id={id}
        type="text"
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
        placeholder="Buscar etapa..."
        value={aberto ? busca : (etapaSelecionada?.nome ?? '')}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); setBusca(''); }}
        autoComplete="off"
      />
      {aberto && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhuma etapa encontrada</li>
          ) : (
            filtradas.map((e) => (
              <li
                key={e.id}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${e.id === value ? 'bg-green-100 font-medium' : ''}`}
                onMouseDown={() => { onChange(e.id); setAberto(false); setBusca(''); }}
              >
                {e.nome}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

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

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface OrdemCompraFormProps {
  initial: OrdemCompra | null;
  obras: Obra[];
  etapas: EtapaObra[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  onSubmit: (oc: OrdemCompra) => Promise<void>;
  onCancel: () => void;
  proximoNumero: string;
  onCreateFornecedor?: (nome: string) => Promise<string>;
}

export default function OrdemCompraForm({
  initial,
  obras,
  etapas,
  fornecedores,
  insumos,
  onSubmit,
  onCancel,
  proximoNumero,
  onCreateFornecedor,
}: OrdemCompraFormProps) {
  const [obraId, setObraId] = useState(initial?.obraId ?? '');
  const [etapaObraId, setEtapaObraId] = useState(initial?.etapaObraId ?? '');
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId ?? '');
  const [condicaoPagamento, setCondicaoPagamento] = useState(initial?.condicaoPagamento ?? '');
  const [formaPagamento, setFormaPagamento] = useState(initial?.formaPagamento ?? '');
  const [parcelas, setParcelas] = useState<ParcelaPagamento[]>(initial?.parcelas ?? []);
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
  const [erro, setErro] = useState('');

  // Inline fornecedor creation
  const [criandoFornecedor, setCriandoFornecedor] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);

  const etapasFiltradas = etapas.filter((e) => e.obraId === obraId);
  const fornecedoresAtivos = fornecedores.filter((f) => f.ativo !== false);
  const fornecedorSelecionado = fornecedores.find((f) => f.id === fornecedorId);
  const insumosAtivos = useMemo(() => insumos.filter((i) => i.ativo !== false), [insumos]);

  function selectInsumo(itemId: string, insumoId: string) {
    const insumo = insumosAtivos.find((i) => i.id === insumoId);
    if (!insumo) return;
    setItens((prev) => prev.map((i) =>
      i.id === itemId
        ? { ...i, descricao: insumo.nome, unidade: insumo.unidade || 'un' }
        : i
    ));
  }

  const totalMateriais = useMemo(() => itens.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0), [itens]);
  const totalGeral = useMemo(() => totalMateriais + custos.frete + custos.outrasDespesas + custos.impostos - custos.desconto, [totalMateriais, custos]);

  // ── Parcelas helpers ──
  function handleCondicaoChange(valor: string) {
    setCondicaoPagamento(valor);
    if (valor === 'a_prazo') {
      setParcelas([{ numero: 1, data: '', valor: totalGeral }]);
    } else if (valor === 'parcelado') {
      const n = parcelas.length >= 2 ? parcelas.length : 2;
      setParcelas(distribuirParcelas(n, totalGeral));
    } else {
      setParcelas([]);
    }
  }

  function distribuirParcelas(n: number, total: number): ParcelaPagamento[] {
    if (n <= 0) return [];
    const valorBase = Math.floor((total / n) * 100) / 100;
    const resto = Math.round((total - valorBase * n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      data: parcelas[i]?.data ?? '',
      valor: i === 0 ? valorBase + resto : valorBase,
    }));
  }

  function setNumeroParcelas(n: number) {
    if (n < 2) n = 2;
    if (n > 36) n = 36;
    setParcelas(distribuirParcelas(n, totalGeral));
  }

  function updateParcela(idx: number, field: 'data' | 'valor', value: string | number) {
    setParcelas((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  // Keep parcela values in sync when totalGeral changes
  useEffect(() => {
    if (condicaoPagamento === 'a_prazo' && parcelas.length === 1) {
      setParcelas([{ ...parcelas[0], valor: totalGeral }]);
    }
    // Don't auto-redistribute parcelado — user may have manually adjusted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalGeral, condicaoPagamento]);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
    setErro('');
    setSaving(true);
    try {
      const oc: OrdemCompra = {
        id: initial?.id || genId(),
        numero: initial?.numero || proximoNumero,
        dataCriacao: initial?.dataCriacao || new Date().toISOString().slice(0, 10),
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
        formaPagamento,
        parcelas: condicaoPagamento === 'a_vista' ? [] : parcelas,
        prazoEntrega,
        status: initial?.status ?? 'emitida',
        observacoes,
        entradaInsumos,
        aprovada: initial?.aprovada ?? false,
        criadoPor: initial?.criadoPor ?? '',
      };
      await onSubmit(oc);
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string; details?: string };
      const msg = e?.message || (err instanceof Error ? err.message : JSON.stringify(err));
      setErro(msg);
      console.error('Erro ao salvar OC:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <GenericCombobox
            id="oc-fornecedor"
            label="Fornecedor"
            items={fornecedoresAtivos}
            value={fornecedorId}
            onChange={(id) => setFornecedorId(id)}
            placeholder="Buscar fornecedor..."
            getLabel={(f) => f.nome}
            getDetail={(f) => f.cnpj || ''}
          />
          {onCreateFornecedor && !criandoFornecedor && (
            <button
              type="button"
              className="text-xs text-emt-verde hover:underline mt-1"
              onClick={() => { setCriandoFornecedor(true); setNovoFornecedorNome(''); }}
            >
              + Novo fornecedor
            </button>
          )}
          {criandoFornecedor && (
            <div className="mt-2 flex gap-2 items-end">
              <input
                className="flex-1 h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                value={novoFornecedorNome}
                onChange={(e) => setNovoFornecedorNome(e.target.value)}
                placeholder="Nome do fornecedor"
                autoFocus
              />
              <button
                type="button"
                disabled={!novoFornecedorNome.trim() || salvandoFornecedor}
                className="px-3 py-2 bg-emt-verde text-white rounded-lg text-sm font-medium disabled:opacity-50 h-[38px]"
                onClick={async () => {
                  if (!onCreateFornecedor || !novoFornecedorNome.trim()) return;
                  setSalvandoFornecedor(true);
                  try {
                    const id = await onCreateFornecedor(novoFornecedorNome.trim());
                    setFornecedorId(id);
                    setCriandoFornecedor(false);
                    setNovoFornecedorNome('');
                  } finally {
                    setSalvandoFornecedor(false);
                  }
                }}
              >
                {salvandoFornecedor ? '...' : 'Salvar'}
              </button>
              <button
                type="button"
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium h-[38px]"
                onClick={() => { setCriandoFornecedor(false); setNovoFornecedorNome(''); }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <GenericCombobox
          id="oc-obra"
          label="Obra"
          items={obras}
          value={obraId}
          onChange={(id) => { setObraId(id); setEtapaObraId(''); }}
          placeholder="Buscar obra..."
          getLabel={(o) => o.nome}
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
        <EtapaCombobox
          id="oc-etapa"
          etapas={etapasFiltradas}
          value={etapaObraId}
          onChange={(id) => setEtapaObraId(id)}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`oc-insumo-${item.id}`}>Insumo</label>
                  <InsumoCombobox
                    id={`oc-insumo-${item.id}`}
                    insumos={insumosAtivos}
                    value={insumosAtivos.find((ins) => ins.nome === item.descricao)?.id ?? ''}
                    onChange={(insumoId) => selectInsumo(item.id, insumoId)}
                  />
                </div>
                <div className="col-span-2">
                  <Input label="Qtd" id={`oc-qtd-${item.id}`} type="number" min="0.01" step="0.01" value={item.quantidade} onChange={(e) => updateItem(item.id, 'quantidade', parseFloat(e.target.value) || 0)} required />
                </div>
                <div className="col-span-2">
                  {insumosAtivos.find((ins) => ins.nome === item.descricao) ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unid.</label>
                      <div className="w-full h-[38px] flex items-center justify-center border border-gray-200 bg-gray-50 rounded-lg px-2 text-sm text-gray-600">
                        {item.unidade}
                      </div>
                    </div>
                  ) : (
                    <Input label="Unid." id={`oc-un-${item.id}`} value={item.unidade} onChange={(e) => updateItem(item.id, 'unidade', e.target.value)} required />
                  )}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Forma de Pagamento"
          id="oc-forma-pgto"
          options={[
            { value: 'pix', label: 'PIX' },
            { value: 'boleto', label: 'Boleto' },
            { value: 'transferencia', label: 'Transferência' },
            { value: 'dinheiro', label: 'Dinheiro' },
            { value: 'cartao_credito', label: 'Cartão de Crédito' },
            { value: 'cartao_debito', label: 'Cartão de Débito' },
            { value: 'cheque', label: 'Cheque' },
          ]}
          value={formaPagamento}
          onChange={(e) => setFormaPagamento(e.target.value)}
          placeholder="Selecione..."
        />
        <Select
          label="Condição de Pagamento"
          id="oc-cond"
          options={[
            { value: 'a_vista', label: 'À Vista' },
            { value: 'a_prazo', label: 'A Prazo' },
            { value: 'parcelado', label: 'Parcelado' },
          ]}
          value={condicaoPagamento}
          onChange={(e) => handleCondicaoChange(e.target.value)}
          placeholder="Selecione..."
        />
        <Input label="Prazo de Entrega" id="oc-prazo-ent" value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} placeholder="Ex: 10 dias úteis" />
      </div>

      {/* A Prazo — data da parcela única */}
      {condicaoPagamento === 'a_prazo' && parcelas.length === 1 && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-2">Pagamento a prazo</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data do Pagamento"
              id="oc-parcela-data"
              type="date"
              value={parcelas[0].data}
              onChange={(e) => updateParcela(0, 'data', e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <div className="w-full h-[38px] flex items-center border border-gray-200 bg-gray-100 rounded-lg px-3 text-sm font-medium text-gray-700">
                {fmt(totalGeral)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parcelado — múltiplas parcelas */}
      {condicaoPagamento === 'parcelado' && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">Parcelas</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Nº parcelas:</label>
              <input
                type="number"
                min="2"
                max="36"
                className="w-16 h-[32px] border border-gray-300 rounded-lg px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emt-verde"
                value={parcelas.length}
                onChange={(e) => setNumeroParcelas(parseInt(e.target.value) || 2)}
              />
              <Button
                type="button"
                variant="secondary"
                className="text-xs px-2 py-1"
                onClick={() => setParcelas(distribuirParcelas(parcelas.length, totalGeral))}
              >
                Redistribuir
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {parcelas.map((p, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-1 flex items-end pb-2">
                  <span className="text-xs font-medium text-gray-500">{p.numero}ª</span>
                </div>
                <div className="col-span-5">
                  <Input
                    label={idx === 0 ? 'Data' : ''}
                    id={`oc-parc-data-${idx}`}
                    type="date"
                    value={p.data}
                    onChange={(e) => updateParcela(idx, 'data', e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    label={idx === 0 ? 'Valor (R$)' : ''}
                    id={`oc-parc-valor-${idx}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.valor}
                    onChange={(e) => updateParcela(idx, 'valor', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="col-span-2 flex items-end pb-2">
                  <span className="text-xs text-gray-400">{fmt(p.valor)}</span>
                </div>
              </div>
            ))}
          </div>
          {parcelas.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm">
              <span className="text-gray-500">Soma das parcelas:</span>
              <span className={`font-medium ${Math.abs(parcelas.reduce((s, p) => s + p.valor, 0) - totalGeral) > 0.01 ? 'text-red-600' : 'text-green-700'}`}>
                {fmt(parcelas.reduce((s, p) => s + p.valor, 0))}
                {Math.abs(parcelas.reduce((s, p) => s + p.valor, 0) - totalGeral) > 0.01 && (
                  <span className="text-xs ml-1">(diferença: {fmt(parcelas.reduce((s, p) => s + p.valor, 0) - totalGeral)})</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar OC'}</Button>
      </div>
    </form>
  );
}
