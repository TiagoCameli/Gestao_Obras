import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { DepositoMaterial, EntradaMaterial, Fornecedor, Insumo, Obra, UnidadeMedida } from '../../types';
import { useAdicionarFornecedor } from '../../hooks/useFornecedores';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import Input from '../ui/Input';
import Select from '../ui/Select';
import FilterCombobox from '../ui/FilterCombobox';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';

interface EntradaMaterialFormProps {
  initial?: EntradaMaterial | null;
  onSubmit: (data: EntradaMaterial) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  depositosMaterial: DepositoMaterial[];
  unidades?: UnidadeMedida[];
  onImportBatch?: (items: EntradaMaterial[]) => void;
}

interface ItemLinha {
  id: string;
  insumoId: string;
  quantidade: string;
  precoUnitario: string;
  valorTotal: string;
}

const ENTRADA_MAT_TEMPLATE = [
  ['Data', 'Obra', 'Depósito', 'Material', 'Quantidade', 'Valor Total', 'Fornecedor', 'NF', 'Observações'],
  ['2024-01-15 08:00', 'Obra ABC', 'Almoxarifado Central', 'Cimento CP-II', '100', '3500', 'Distribuidora XYZ', 'NF-001', ''],
];

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function EntradaMaterialForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  insumos: allInsumos,
  fornecedores: allFornecedores,
  depositosMaterial: allDepositos,
  unidades: unidadesProp,
  onImportBatch,
}: EntradaMaterialFormProps) {
  const unidades = unidadesProp ?? [];
  const unidadesMap = new Map(unidades.map((u) => [u.sigla, u.nome]));
  const adicionarInsumoMutation = useAdicionarInsumo();
  const adicionarFornecedorMutation = useAdicionarFornecedor();

  const [listaMateriais, setListaMateriais] = useState(() =>
    allInsumos.filter((i) => i.ativo !== false)
  );
  useEffect(() => {
    if (allInsumos.length > 0) {
      setListaMateriais(allInsumos.filter((i) => i.ativo !== false));
    }
  }, [allInsumos]);

  const [novoMaterialAberto, setNovoMaterialAberto] = useState(false);
  const [novoMaterialNome, setNovoMaterialNome] = useState('');
  const [novoMaterialUnidade, setNovoMaterialUnidade] = useState('');

  const [listaFornecedores, setListaFornecedores] = useState(() =>
    allFornecedores.filter((f) => f.ativo !== false)
  );
  useEffect(() => {
    if (allFornecedores.length > 0) {
      setListaFornecedores(allFornecedores.filter((f) => f.ativo !== false));
    }
  }, [allFornecedores]);

  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');

  const [dataHora, setDataHora] = useState(initial?.dataHora || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [depositoMaterialId, setDepositoMaterialId] = useState(
    initial?.depositoMaterialId || ''
  );
  // Single-item states (edit mode only)
  const [insumoId, setInsumoId] = useState(initial?.insumoId || '');
  const [quantidade, setQuantidade] = useState(
    initial?.quantidade?.toString() || ''
  );
  const [valorTotal, setValorTotal] = useState(
    initial?.valorTotal?.toString() || ''
  );
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId || '');
  const [notaFiscal, setNotaFiscal] = useState(initial?.notaFiscal || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Multi-item state (creation mode only)
  const [itens, setItens] = useState<ItemLinha[]>([
    { id: gerarId(), insumoId: '', quantidade: '', precoUnitario: '', valorTotal: '' },
  ]);

  function calcularValorTotal(qtd: string, preco: string): string {
    const q = parseFloat(qtd) || 0;
    const p = parseFloat(preco) || 0;
    if (q > 0 && p > 0) return (q * p).toFixed(2);
    return '';
  }

  function updateItem(itemId: string, field: keyof ItemLinha, value: string) {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantidade' || field === 'precoUnitario') {
          updated.valorTotal = calcularValorTotal(
            field === 'quantidade' ? value : it.quantidade,
            field === 'precoUnitario' ? value : it.precoUnitario
          );
        }
        return updated;
      })
    );
  }
  function addItem() {
    setItens((prev) => [
      ...prev,
      { id: gerarId(), insumoId: '', quantidade: '', precoUnitario: '', valorTotal: '' },
    ]);
  }
  function removeItem(itemId: string) {
    setItens((prev) => prev.filter((it) => it.id !== itemId));
  }

  const parseRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const data = parseStr(row[0]);
    if (!data) erros.push('Data obrigatoria');
    const obraNome = parseStr(row[1]);
    const obra = obras.find((o) => o.nome.toLowerCase() === obraNome.toLowerCase());
    if (!obra) erros.push(`Obra "${obraNome}" não encontrada`);
    const obraId = obra?.id ?? '';
    const depositoNome = parseStr(row[2]);
    const deposito = allDepositos.filter((d) => d.ativo !== false).find((d) => d.nome.toLowerCase() === depositoNome.toLowerCase() && (!obra || d.obraId === obra.id));
    if (!deposito) erros.push(`Depósito "${depositoNome}" não encontrado`);
    const depositoMaterialId = deposito?.id ?? '';
    const materialNome = parseStr(row[3]);
    const material = allInsumos.filter((i) => i.tipo === 'material' && i.ativo !== false).find((i) => i.nome.toLowerCase() === materialNome.toLowerCase());
    if (!material) erros.push(`Material "${materialNome}" não encontrado`);
    const insumoId = material?.id ?? '';
    const qtd = parseNumero(row[4]);
    if (qtd === null || qtd <= 0) erros.push('Quantidade obrigatoria');
    const quantidade = qtd ?? 0;
    const vt = parseNumero(row[5]);
    if (vt === null || vt <= 0) erros.push('Valor Total obrigatorio');
    const valorTotal = vt ?? 0;
    const fornecedorNome = parseStr(row[6]);
    const fornecedor = allFornecedores.filter((f) => f.ativo !== false).find((f) => f.nome.toLowerCase() === fornecedorNome.toLowerCase());
    if (!fornecedor) erros.push(`Fornecedor "${fornecedorNome}" não encontrado`);
    const fornecedorId = fornecedor?.id ?? '';
    const notaFiscal = parseStr(row[7]);
    const observacoes = parseStr(row[8]);
    return {
      valido: erros.length === 0,
      erros,
      resumo: `${data} | ${obraNome} | ${depositoNome} | ${materialNome} | ${quantidade}`,
      dados: { data, obraId, depositoMaterialId, insumoId, quantidade, valorTotal, fornecedorId, notaFiscal, observacoes },
    };
  }, [obras, allDepositos, allInsumos, allFornecedores]);

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      dataHora: d.data as string,
      depositoMaterialId: d.depositoMaterialId as string,
      insumoId: d.insumoId as string,
      obraId: d.obraId as string,
      quantidade: d.quantidade as number,
      valorTotal: d.valorTotal as number,
      fornecedorId: d.fornecedorId as string,
      notaFiscal: d.notaFiscal as string,
      observacoes: d.observacoes as string,
      criadoPor: '',
    };
  }, []);

  // Filter depositos: by obraId in edit mode, show all active in creation mode
  const depositos = initial
    ? obraId
      ? allDepositos.filter((d) => d.obraId === obraId && d.ativo !== false)
      : []
    : allDepositos.filter((d) => d.ativo !== false);

  useEffect(() => {
    if (!initial) {
      setDepositoMaterialId('');
    }
  }, [obraId, initial]);

  const insumoSelecionado = listaMateriais.find((i) => i.id === insumoId);
  const unidadeLabel = insumoSelecionado
    ? unidadesMap.get(insumoSelecionado.unidade) || insumoSelecionado.unidade
    : '';

  function getUnidadeLabel(matId: string): string {
    const mat = listaMateriais.find((i) => i.id === matId);
    if (!mat) return '';
    return unidadesMap.get(mat.unidade) || mat.unidade;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (initial) {
      // Edit mode: single item
      onSubmit({
        id: initial.id,
        dataHora,
        depositoMaterialId,
        insumoId,
        obraId,
        quantidade: parseFloat(quantidade) || 0,
        valorTotal: parseFloat(valorTotal) || 0,
        fornecedorId,
        notaFiscal,
        observacoes,
        criadoPor: initial.criadoPor || '',
      });
    } else {
      // Creation mode: multi-item — derive obraId from selected depósito
      const depositoSel = allDepositos.find((d) => d.id === depositoMaterialId);
      const obraIdDerivado = depositoSel?.obraId ?? '';
      const entries: EntradaMaterial[] = itens.map((it) => ({
        id: gerarId(),
        dataHora,
        depositoMaterialId,
        insumoId: it.insumoId,
        obraId: obraIdDerivado,
        quantidade: parseFloat(it.quantidade) || 0,
        valorTotal: parseFloat(it.valorTotal) || 0,
        fornecedorId,
        notaFiscal,
        observacoes,
        criadoPor: '',
      }));
      if (onImportBatch) {
        onImportBatch(entries);
      } else {
        entries.forEach((entry) => onSubmit(entry));
      }
    }
  }

  const headerValid = initial
    ? dataHora && obraId && depositoMaterialId && fornecedorId
    : dataHora && depositoMaterialId && fornecedorId;

  const isValid = initial
    ? headerValid &&
      insumoId &&
      parseFloat(quantidade) > 0 &&
      parseFloat(valorTotal) > 0
    : headerValid &&
      itens.length > 0 &&
      itens.every(
        (it) =>
          it.insumoId &&
          parseFloat(it.quantidade) > 0 &&
          parseFloat(it.precoUnitario) > 0
      );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {onImportBatch && !initial && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="entMatDataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        {initial && (
          <Select
            label="Obra"
            id="entMatObraId"
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            options={obras.map((o) => ({ value: o.id, label: o.nome }))}
            placeholder="Selecione a obra"
            required
          />
        )}
        <Select
          label="Depósito de Destino"
          id="entMatDepositoId"
          value={depositoMaterialId}
          onChange={(e) => setDepositoMaterialId(e.target.value)}
          options={depositos.map((d) => ({
            value: d.id,
            label: d.nome,
          }))}
          placeholder={
            initial && !obraId
              ? 'Selecione a obra primeiro'
              : depositos.length === 0
                ? 'Nenhum depósito cadastrado'
                : 'Selecione o depósito'
          }
          disabled={initial ? (!obraId || depositos.length === 0) : depositos.length === 0}
          required
        />
        {/* Edit mode: single-item Material / Qtd / Valor inline */}
        {initial && (
          <>
            <div>
              <Select
                label="Material"
                id="entMatInsumoId"
                value={insumoId}
                onChange={(e) => setInsumoId(e.target.value)}
                options={listaMateriais.map((i) => ({
                  value: i.id,
                  label: i.nome,
                }))}
                placeholder={
                  listaMateriais.length === 0
                    ? 'Nenhum material cadastrado'
                    : 'Selecione o material'
                }
                required
              />
              {!novoMaterialAberto ? (
                <button
                  type="button"
                  className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
                  onClick={() => setNovoMaterialAberto(true)}
                >
                  + Novo Material
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                      placeholder="Nome do material"
                      value={novoMaterialNome}
                      onChange={(e) => setNovoMaterialNome(e.target.value)}
                      autoFocus
                    />
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
                      value={novoMaterialUnidade}
                      onChange={(e) => setNovoMaterialUnidade(e.target.value)}
                    >
                      <option value="">Unidade</option>
                      {unidades
                        .filter((u) => u.ativo !== false)
                        .map((u) => (
                          <option key={u.id} value={u.sigla}>
                            {u.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="text-xs px-3 py-1.5"
                      disabled={!novoMaterialNome.trim() || !novoMaterialUnidade}
                      onClick={() => {
                        const novo = {
                          id: gerarId(),
                          nome: novoMaterialNome.trim(),
                          tipo: 'material' as const,
                          unidade: novoMaterialUnidade,
                          descricao: '',
                          ativo: true,
                          criadoPor: '',
                        };
                        adicionarInsumoMutation.mutate(novo);
                        setListaMateriais((prev) => [...prev, novo]);
                        setInsumoId(novo.id);
                        setNovoMaterialNome('');
                        setNovoMaterialUnidade('');
                        setNovoMaterialAberto(false);
                      }}
                    >
                      Salvar
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setNovoMaterialAberto(false);
                        setNovoMaterialNome('');
                        setNovoMaterialUnidade('');
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Input
              label={`Quantidade${unidadeLabel ? ` (${unidadeLabel})` : ''}`}
              id="entMatQtd"
              type="number"
              step="0.0001"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
            <Input
              label="Valor Total (R$)"
              id="entMatValor"
              type="number"
              step="0.0001"
              min="0"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              required
            />
          </>
        )}
        <div>
          <label htmlFor="entMatFornecedor" className="block text-sm font-medium text-gray-700 mb-1">
            Fornecedor<span className="text-red-500 ml-0.5">*</span>
          </label>
          <FilterCombobox
            value={fornecedorId}
            onChange={(val) => setFornecedorId(val)}
            options={listaFornecedores.map((f) => ({
              value: f.id,
              label: f.nome,
            }))}
            placeholder={
              listaFornecedores.length === 0
                ? 'Nenhum fornecedor cadastrado'
                : 'Buscar fornecedor...'
            }
          />
          {!novoFornecedorAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovoFornecedorAberto(true)}
            >
              + Novo Fornecedor
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                placeholder="Nome do fornecedor"
                value={novoFornecedorNome}
                onChange={(e) => setNovoFornecedorNome(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                className="text-xs px-3 py-1.5"
                disabled={!novoFornecedorNome.trim()}
                onClick={() => {
                  const novo = {
                    id: gerarId(),
                    nome: novoFornecedorNome.trim(),
                    cnpj: '',
                    telefone: '',
                    email: '',
                    observacoes: '',
                    ativo: true,
                    criadoPor: '',
                  };
                  adicionarFornecedorMutation.mutate(novo);
                  setListaFornecedores((prev) => [...prev, novo]);
                  setFornecedorId(novo.id);
                  setNovoFornecedorNome('');
                  setNovoFornecedorAberto(false);
                }}
              >
                Salvar
              </Button>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setNovoFornecedorAberto(false);
                  setNovoFornecedorNome('');
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <Input
          label="Nota Fiscal (opcional)"
          id="entMatNF"
          type="text"
          value={notaFiscal}
          onChange={(e) => setNotaFiscal(e.target.value)}
          placeholder="Ex: NF-e 12345"
        />
      </div>

      {/* Creation mode: multi-item section */}
      {!initial && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Itens</label>
          {itens.map((item, idx) => {
            const unitLabel = getUnidadeLabel(item.insumoId);
            return (
              <div key={item.id} className="flex items-end gap-2">
                <div className="flex-[2]">
                  {idx === 0 && (
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material<span className="text-red-500 ml-0.5">*</span>
                    </label>
                  )}
                  {idx > 0 && <div className="mb-1 text-sm">&nbsp;</div>}
                  <FilterCombobox
                    value={item.insumoId}
                    onChange={(val) => updateItem(item.id, 'insumoId', val)}
                    options={listaMateriais.map((i) => ({
                      value: i.id,
                      label: i.nome,
                    }))}
                    placeholder="Buscar material..."
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label={idx === 0 ? `Qtd${unitLabel ? ` (${unitLabel})` : ''}` : unitLabel ? `(${unitLabel})` : '\u00A0'}
                    id={`entMatQtd_${item.id}`}
                    type="number"
                    step="0.0001"
                    min="0"
                    value={item.quantidade}
                    onChange={(e) => updateItem(item.id, 'quantidade', e.target.value)}
                    placeholder="Qtd"
                    required
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label={idx === 0 ? 'Preço Unit. (R$)' : '\u00A0'}
                    id={`entMatPreco_${item.id}`}
                    type="number"
                    step="0.0001"
                    min="0"
                    value={item.precoUnitario}
                    onChange={(e) => updateItem(item.id, 'precoUnitario', e.target.value)}
                    placeholder="Preço"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className={`block text-sm font-medium text-gray-700 mb-1 ${idx > 0 ? 'invisible' : ''}`}>
                    Total (R$)
                  </label>
                  <div className="h-[38px] flex items-center px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                    {item.valorTotal ? parseFloat(item.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </div>
                </div>
                {itens.length > 1 && (
                  <button
                    type="button"
                    className="mb-1 text-red-400 hover:text-red-600 text-lg font-bold px-1"
                    title="Remover item"
                    onClick={() => removeItem(item.id)}
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="text-sm text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={addItem}
            >
              + Adicionar Material
            </button>
            {!novoMaterialAberto ? (
              <button
                type="button"
                className="text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
                onClick={() => setNovoMaterialAberto(true)}
              >
                + Novo Material
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  placeholder="Nome do material"
                  value={novoMaterialNome}
                  onChange={(e) => setNovoMaterialNome(e.target.value)}
                  autoFocus
                />
                <select
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
                  value={novoMaterialUnidade}
                  onChange={(e) => setNovoMaterialUnidade(e.target.value)}
                >
                  <option value="">Unidade</option>
                  {unidades
                    .filter((u) => u.ativo !== false)
                    .map((u) => (
                      <option key={u.id} value={u.sigla}>
                        {u.nome}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novoMaterialNome.trim() || !novoMaterialUnidade}
                  onClick={() => {
                    const novo = {
                      id: gerarId(),
                      nome: novoMaterialNome.trim(),
                      tipo: 'material' as const,
                      unidade: novoMaterialUnidade,
                      descricao: '',
                      ativo: true,
                      criadoPor: '',
                    };
                    adicionarInsumoMutation.mutate(novo);
                    setListaMateriais((prev) => [...prev, novo]);
                    setNovoMaterialNome('');
                    setNovoMaterialUnidade('');
                    setNovoMaterialAberto(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setNovoMaterialAberto(false);
                    setNovoMaterialNome('');
                    setNovoMaterialUnidade('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          {itens.length > 0 && (
            <div className="flex justify-end pt-1 text-sm font-medium text-gray-700">
              Valor Total da Entrada:&nbsp;
              <span className="text-emt-verde-escuro">
                R$&nbsp;{itens
                  .reduce((acc, it) => acc + (parseFloat(it.valorTotal) || 0), 0)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="entMatObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="entMatObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observação..."
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Registrar Entrada'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as EntradaMaterial[]);
            setToastMsg(`${items.length} entrada(s) importada(s) com sucesso!`);
            setTimeout(() => setToastMsg(''), 3500);
          }}
          title="Importar Entradas de Material"
          entityLabel="Entrada"
          genderFem
          templateData={ENTRADA_MAT_TEMPLATE}
          templateFileName="template_entradas_material.xlsx"
          sheetName="Entradas"
          templateColWidths={[18, 15, 22, 18, 12, 12, 20, 10, 15]}
          formatHintHeaders={['Data', 'Obra', 'Depósito', 'Material', 'Qtd', 'Valor', 'Fornecedor', 'NF', 'Obs']}
          formatHintExample={['2024-01-15 08:00', 'Obra ABC', 'Almoxarifado', 'Cimento', '100', '3500', 'Dist. XYZ', '', '']}
          parseRow={parseRow}
          toEntity={toEntity}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
