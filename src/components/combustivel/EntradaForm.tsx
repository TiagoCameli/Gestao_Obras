import { useEffect, useState, type FormEvent } from 'react';
import type { Deposito, EntradaCombustivel, Obra } from '../../types';
import { useInsumos, useAdicionarInsumo } from '../../hooks/useInsumos';
import { useFornecedores, useAdicionarFornecedor } from '../../hooks/useFornecedores';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface EntradaFormProps {
  initial?: EntradaCombustivel | null;
  onSubmit: (data: EntradaCombustivel) => void;
  onCancel: () => void;
  obras: Obra[];
  depositos: Deposito[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function EntradaForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  depositos: allDepositos,
}: EntradaFormProps) {
  const { data: insumosData } = useInsumos();
  const adicionarInsumoMutation = useAdicionarInsumo();
  const { data: fornecedoresData } = useFornecedores();
  const adicionarFornecedorMutation = useAdicionarFornecedor();

  const allInsumos = insumosData ?? [];
  const allFornecedores = fornecedoresData ?? [];

  const [listaFornecedores, setListaFornecedores] = useState(() =>
    allFornecedores.filter((f) => f.ativo !== false)
  );
  // Keep listaFornecedores in sync when data loads
  useEffect(() => {
    if (allFornecedores.length > 0) {
      setListaFornecedores(allFornecedores.filter((f) => f.ativo !== false));
    }
  }, [allFornecedores]);

  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');

  const [listaCombustiveis, setListaCombustiveis] = useState(() =>
    allInsumos.filter((i) => i.tipo === 'combustivel' && i.ativo !== false)
  );
  // Keep listaCombustiveis in sync when data loads
  useEffect(() => {
    if (allInsumos.length > 0) {
      setListaCombustiveis(allInsumos.filter((i) => i.tipo === 'combustivel' && i.ativo !== false));
    }
  }, [allInsumos]);

  const [novoCombustivelAberto, setNovoCombustivelAberto] = useState(false);
  const [novoCombustivelNome, setNovoCombustivelNome] = useState('');

  const [dataHora, setDataHora] = useState(initial?.dataHora || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [depositoId, setDepositoId] = useState(initial?.depositoId || '');
  const [tipoCombustivel, setTipoCombustivel] = useState(initial?.tipoCombustivel || '');
  const [quantidadeLitros, setQuantidadeLitros] = useState(
    initial?.quantidadeLitros?.toString() || ''
  );
  const [valorTotal, setValorTotal] = useState(
    initial?.valorTotal?.toString() || ''
  );
  const [fornecedor, setFornecedor] = useState(initial?.fornecedor || '');
  const [notaFiscal, setNotaFiscal] = useState(initial?.notaFiscal || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  // Filter depositos by obraId from props
  const depositos = obraId ? allDepositos.filter((d) => d.obraId === obraId && d.ativo !== false) : [];

  useEffect(() => {
    if (!initial) {
      setDepositoId('');
      setTipoCombustivel('');
    }
  }, [obraId, initial]);

  useEffect(() => {
    if (!initial) {
      setTipoCombustivel('');
    }
  }, [depositoId, initial]);

  const depositoSelecionado = depositos.find((d) => d.id === depositoId);
  const qtdLitros = parseFloat(quantidadeLitros) || 0;
  const espacoDisponivel = depositoSelecionado
    ? depositoSelecionado.capacidadeLitros - depositoSelecionado.nivelAtualLitros
    : 0;
  const excedeLimite = depositoSelecionado && qtdLitros > espacoDisponivel;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      dataHora,
      depositoId,
      tipoCombustivel,
      obraId,
      quantidadeLitros: qtdLitros,
      valorTotal: parseFloat(valorTotal),
      fornecedor,
      notaFiscal,
      observacoes,
    });
  }

  const isValid =
    dataHora && obraId && depositoId && tipoCombustivel && quantidadeLitros && valorTotal && fornecedor && !excedeLimite;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="entradaDataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <Select
          label="Obra"
          id="entradaObraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <div>
          <Select
            label="Tanque de Destino"
            id="entradaDepositoId"
            value={depositoId}
            onChange={(e) => setDepositoId(e.target.value)}
            options={depositos.map((d) => ({
              value: d.id,
              label: `${d.nome} (${d.nivelAtualLitros.toFixed(0)}/${d.capacidadeLitros.toFixed(0)} L)`,
            }))}
            placeholder={
              !obraId
                ? 'Selecione a obra primeiro'
                : depositos.length === 0
                  ? 'Nenhum tanque cadastrado'
                  : 'Selecione o tanque'
            }
            disabled={!obraId || depositos.length === 0}
            required
          />
          {depositoSelecionado && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    (depositoSelecionado.nivelAtualLitros / depositoSelecionado.capacidadeLitros) * 100 > 50
                      ? 'bg-green-500'
                      : (depositoSelecionado.nivelAtualLitros / depositoSelecionado.capacidadeLitros) * 100 > 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min((depositoSelecionado.nivelAtualLitros / depositoSelecionado.capacidadeLitros) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">
                Espaco livre: {espacoDisponivel.toFixed(0)} L
              </span>
            </div>
          )}
        </div>
        <div>
          <Select
            label="Tipo de Combustivel"
            id="entradaTipoCombustivel"
            value={tipoCombustivel}
            onChange={(e) => setTipoCombustivel(e.target.value)}
            options={listaCombustiveis.map((i) => ({
              value: i.id,
              label: i.nome,
            }))}
            placeholder={
              listaCombustiveis.length === 0
                ? 'Nenhum combustivel cadastrado'
                : 'Selecione o tipo'
            }
            disabled={listaCombustiveis.length === 0}
            required
          />
          {!novoCombustivelAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => setNovoCombustivelAberto(true)}
            >
              + Novo Tipo de Combustivel
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome do combustivel"
                value={novoCombustivelNome}
                onChange={(e) => setNovoCombustivelNome(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                className="text-xs px-3 py-1.5"
                disabled={!novoCombustivelNome.trim()}
                onClick={() => {
                  const novo = {
                    id: gerarId(),
                    nome: novoCombustivelNome.trim(),
                    tipo: 'combustivel' as const,
                    unidade: 'litro',
                    descricao: '',
                    ativo: true,
                  };
                  adicionarInsumoMutation.mutate(novo);
                  setListaCombustiveis((prev) => [...prev, novo]);
                  setTipoCombustivel(novo.id);
                  setNovoCombustivelNome('');
                  setNovoCombustivelAberto(false);
                }}
              >
                Salvar
              </Button>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setNovoCombustivelAberto(false);
                  setNovoCombustivelNome('');
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <Input
          label="Quantidade (litros)"
          id="entradaQtd"
          type="number"
          step="0.1"
          min="0"
          value={quantidadeLitros}
          onChange={(e) => setQuantidadeLitros(e.target.value)}
          error={excedeLimite ? `Excede capacidade do tanque (${espacoDisponivel.toFixed(0)} L livres)` : undefined}
          required
        />
        <Input
          label="Valor Total (R$)"
          id="entradaValor"
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
            id="entradaFornecedor"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            options={listaFornecedores.map((f) => ({ value: f.id, label: f.nome }))}
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
              className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => setNovoFornecedorAberto(true)}
            >
              + Novo Fornecedor
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  setFornecedor(novo.id);
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
          id="entradaNF"
          type="text"
          value={notaFiscal}
          onChange={(e) => setNotaFiscal(e.target.value)}
          placeholder="Ex: NF-e 12345"
        />
      </div>
      <div>
        <label
          htmlFor="entradaObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="entradaObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
