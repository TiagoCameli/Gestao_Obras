import { useEffect, useState, type FormEvent } from 'react';
import type { AlocacaoEtapa, DepositoMaterial, EtapaObra, Insumo, Obra, SaidaMaterial, UnidadeMedida } from '../../types';
import { useEntradasMaterial } from '../../hooks/useEntradasMaterial';
import { calcularEstoqueMaterial, calcularEstoqueMaterialNaData } from '../../hooks/useEstoque';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface SaidaMaterialFormProps {
  initial?: SaidaMaterial | null;
  onSubmit: (data: SaidaMaterial) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  etapas: EtapaObra[];
  depositosMaterial: DepositoMaterial[];
  unidades: UnidadeMedida[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function SaidaMaterialForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  insumos: allInsumos,
  etapas: allEtapas,
  depositosMaterial: allDepositos,
  unidades,
}: SaidaMaterialFormProps) {
  const insumosMaterial = allInsumos.filter(
    (i) => i.tipo === 'material' && i.ativo !== false
  );
  const unidadesMap = new Map(unidades.map((u) => [u.sigla, u.nome]));

  const { data: entradasMaterialData } = useEntradasMaterial();
  const allEntradasMaterial = entradasMaterialData ?? [];

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
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [alocacoes, setAlocacoes] = useState<AlocacaoEtapa[]>(
    initial?.alocacoes || [{ etapaId: '', percentual: 100 }]
  );

  // Filter by obraId from props
  const depositos = obraId
    ? allDepositos.filter((d) => d.obraId === obraId && d.ativo !== false)
    : [];
  const etapas = obraId ? allEtapas.filter((e) => e.obraId === obraId) : [];

  useEffect(() => {
    if (!initial) {
      setDepositoMaterialId('');
      setAlocacoes([{ etapaId: '', percentual: 100 }]);
    }
  }, [obraId, initial]);

  const insumoSelecionado = insumosMaterial.find((i) => i.id === insumoId);
  const unidadeLabel = insumoSelecionado
    ? unidadesMap.get(insumoSelecionado.unidade) || insumoSelecionado.unidade
    : '';

  const qtd = parseFloat(quantidade) || 0;

  // Calcula estoque disponivel na data/hora selecionada (async)
  const [estoqueNaData, setEstoqueNaData] = useState(0);
  useEffect(() => {
    if (!depositoMaterialId || !insumoId || !dataHora) {
      setEstoqueNaData(0);
      return;
    }
    calcularEstoqueMaterialNaData(
      depositoMaterialId,
      insumoId,
      dataHora,
      initial?.id
    ).then(setEstoqueNaData);
  }, [depositoMaterialId, insumoId, dataHora, initial?.id]);

  // Estoque atual (para exibicao quando nao ha data selecionada)
  const [estoqueAtual, setEstoqueAtual] = useState(0);
  useEffect(() => {
    if (!depositoMaterialId || !insumoId) {
      setEstoqueAtual(0);
      return;
    }
    calcularEstoqueMaterial(depositoMaterialId, insumoId).then((val) => {
      setEstoqueAtual(val + (initial ? initial.quantidade : 0));
    });
  }, [depositoMaterialId, insumoId, initial]);

  const estoqueDisponivel = dataHora ? estoqueNaData : estoqueAtual;
  const semEstoque = depositoMaterialId && insumoId && qtd > estoqueDisponivel;

  // Preco medio do material no deposito (total valor entradas / total quantidade entradas)
  const entradasDoMaterial = depositoMaterialId && insumoId
    ? allEntradasMaterial.filter(
        (e) => e.depositoMaterialId === depositoMaterialId && e.insumoId === insumoId
      )
    : [];
  const totalQtdEntradas = entradasDoMaterial.reduce((s, e) => s + e.quantidade, 0);
  const totalValorEntradas = entradasDoMaterial.reduce((s, e) => s + e.valorTotal, 0);
  const precoMedio = totalQtdEntradas > 0 ? totalValorEntradas / totalQtdEntradas : 0;

  // Auto-calcular valor total
  useEffect(() => {
    if (!initial && precoMedio > 0 && qtd > 0) {
      setValorTotal((qtd * precoMedio).toFixed(2));
    }
  }, [quantidade, depositoMaterialId, insumoId, precoMedio, initial, qtd]);

  // Alocacoes
  const totalPercentual = alocacoes.reduce((sum, a) => sum + a.percentual, 0);
  const alocacoesValidas =
    alocacoes.length > 0 &&
    alocacoes.every((a) => a.etapaId && a.percentual > 0) &&
    Math.abs(totalPercentual - 100) < 0.01;

  function addAlocacao() {
    setAlocacoes((prev) => [...prev, { etapaId: '', percentual: 0 }]);
  }

  function removeAlocacao(index: number) {
    setAlocacoes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAlocacao(
    index: number,
    field: keyof AlocacaoEtapa,
    value: string | number
  ) {
    setAlocacoes((prev) =>
      prev.map((a, i) =>
        i === index
          ? {
              ...a,
              [field]: field === 'percentual' ? parseFloat(value as string) || 0 : value,
            }
          : a
      )
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      dataHora,
      depositoMaterialId,
      insumoId,
      obraId,
      quantidade: qtd,
      valorTotal: parseFloat(valorTotal) || 0,
      alocacoes,
      observacoes,
    });
  }

  const isValid =
    dataHora &&
    obraId &&
    depositoMaterialId &&
    insumoId &&
    qtd > 0 &&
    parseFloat(valorTotal) > 0 &&
    !semEstoque &&
    alocacoesValidas;

  // Etapas ja usadas nas alocacoes (para prevenir duplicatas)
  const etapasUsadas = new Set(alocacoes.map((a) => a.etapaId));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="saiMatDataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <Select
          label="Obra"
          id="saiMatObraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <div>
          <Select
            label="Deposito de Origem"
            id="saiMatDepositoId"
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
          {depositoMaterialId && insumoId && (
            <p className="text-xs text-gray-500 mt-1">
              Estoque disponivel{dataHora ? ' na data' : ''}: {estoqueDisponivel} {unidadeLabel}
            </p>
          )}
        </div>
        <Select
          label="Material"
          id="saiMatInsumoId"
          value={insumoId}
          onChange={(e) => setInsumoId(e.target.value)}
          options={insumosMaterial.map((i) => ({
            value: i.id,
            label: i.nome,
          }))}
          placeholder={
            insumosMaterial.length === 0
              ? 'Nenhum material cadastrado'
              : 'Selecione o material'
          }
          required
        />
        <Input
          label={`Quantidade${unidadeLabel ? ` (${unidadeLabel})` : ''}`}
          id="saiMatQtd"
          type="number"
          step="0.01"
          min="0"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          error={
            semEstoque
              ? `Estoque insuficiente (${estoqueDisponivel} ${unidadeLabel} disponiveis)`
              : undefined
          }
          required
        />
        <div>
          <Input
            label="Valor Total (R$)"
            id="saiMatValor"
            type="number"
            step="0.01"
            min="0"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            required
          />
          {precoMedio > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preco medio do estoque: R$ {precoMedio.toFixed(4)}/{unidadeLabel || 'un'}
            </p>
          )}
        </div>
      </div>

      {/* Secao Alocacao por Etapa */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">
            Alocacao por Etapa
          </h4>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              Math.abs(totalPercentual - 100) < 0.01
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            Total: {totalPercentual.toFixed(0)}%
          </span>
        </div>
        <div className="space-y-2">
          {alocacoes.map((aloc, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex-1">
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
                  value={aloc.etapaId}
                  onChange={(e) =>
                    updateAlocacao(index, 'etapaId', e.target.value)
                  }
                >
                  <option value="">Selecione a etapa</option>
                  {etapas.map((et) => (
                    <option
                      key={et.id}
                      value={et.id}
                      disabled={
                        etapasUsadas.has(et.id) && aloc.etapaId !== et.id
                      }
                    >
                      {et.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  placeholder="%"
                  min="0"
                  max="100"
                  step="0.01"
                  value={aloc.percentual || ''}
                  onChange={(e) =>
                    updateAlocacao(index, 'percentual', e.target.value)
                  }
                />
              </div>
              <span className="text-xs text-gray-400 w-20 text-right">
                {qtd > 0
                  ? `${((qtd * aloc.percentual) / 100).toFixed(2)} ${unidadeLabel}`
                  : '-'}
              </span>
              {alocacoes.length > 1 && (
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                  onClick={() => removeAlocacao(index)}
                >
                  X
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
          onClick={addAlocacao}
          disabled={alocacoes.length >= etapas.length}
        >
          + Adicionar Etapa
        </button>
      </div>

      <div>
        <label
          htmlFor="saiMatObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="saiMatObs"
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
          {initial ? 'Salvar Alteracoes' : 'Registrar Saida'}
        </Button>
      </div>
    </form>
  );
}
