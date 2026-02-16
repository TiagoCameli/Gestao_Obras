import { useEffect, useState, type FormEvent } from 'react';
import type { DepositoMaterial, EntradaMaterial, Fornecedor, Insumo, Obra, UnidadeMedida } from '../../types';
import { useAdicionarFornecedor } from '../../hooks/useFornecedores';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface EntradaMaterialFormProps {
  initial?: EntradaMaterial | null;
  onSubmit: (data: EntradaMaterial) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  depositosMaterial: DepositoMaterial[];
  unidades?: UnidadeMedida[];
}

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
}: EntradaMaterialFormProps) {
  const unidades = unidadesProp ?? [];
  const unidadesMap = new Map(unidades.map((u) => [u.sigla, u.nome]));
  const adicionarInsumoMutation = useAdicionarInsumo();
  const adicionarFornecedorMutation = useAdicionarFornecedor();

  const [listaMateriais, setListaMateriais] = useState(() =>
    allInsumos.filter((i) => i.tipo === 'material' && i.ativo !== false)
  );
  useEffect(() => {
    if (allInsumos.length > 0) {
      setListaMateriais(allInsumos.filter((i) => i.tipo === 'material' && i.ativo !== false));
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

  // Filter depositos by obraId from props
  const depositos = obraId
    ? allDepositos.filter((d) => d.obraId === obraId && d.ativo !== false)
    : [];

  useEffect(() => {
    if (!initial) {
      setDepositoMaterialId('');
    }
  }, [obraId, initial]);

  const insumoSelecionado = listaMateriais.find((i) => i.id === insumoId);
  const unidadeLabel = insumoSelecionado
    ? unidadesMap.get(insumoSelecionado.unidade) || insumoSelecionado.unidade
    : '';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      dataHora,
      depositoMaterialId,
      insumoId,
      obraId,
      quantidade: parseFloat(quantidade) || 0,
      valorTotal: parseFloat(valorTotal) || 0,
      fornecedorId,
      notaFiscal,
      observacoes,
    });
  }

  const isValid =
    dataHora &&
    obraId &&
    depositoMaterialId &&
    insumoId &&
    parseFloat(quantidade) > 0 &&
    parseFloat(valorTotal) > 0 &&
    fornecedorId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="entMatDataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <Select
          label="Obra"
          id="entMatObraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <Select
          label="Deposito de Destino"
          id="entMatDepositoId"
          value={depositoMaterialId}
          onChange={(e) => setDepositoMaterialId(e.target.value)}
          options={depositos.map((d) => ({
            value: d.id,
            label: d.nome,
          }))}
          placeholder={
            !obraId
              ? 'Selecione a obra primeiro'
              : depositos.length === 0
                ? 'Nenhum deposito cadastrado'
                : 'Selecione o deposito'
          }
          disabled={!obraId || depositos.length === 0}
          required
        />
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
          step="0.01"
          min="0"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          required
        />
        <Input
          label="Valor Total (R$)"
          id="entMatValor"
          type="number"
          step="0.01"
          min="0"
          value={valorTotal}
          onChange={(e) => setValorTotal(e.target.value)}
          required
        />
        <div>
          <Select
            label="Fornecedor"
            id="entMatFornecedor"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            options={listaFornecedores.map((f) => ({
              value: f.id,
              label: f.nome,
            }))}
            placeholder={
              listaFornecedores.length === 0
                ? 'Nenhum fornecedor cadastrado'
                : 'Selecione o fornecedor'
            }
            required
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
      <div>
        <label
          htmlFor="entMatObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="entMatObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observacao..."
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alteracoes' : 'Registrar Entrada'}
        </Button>
      </div>
    </form>
  );
}
