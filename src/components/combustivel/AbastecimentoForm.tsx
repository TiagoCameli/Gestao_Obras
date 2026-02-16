import { useEffect, useState, type FormEvent } from 'react';
import type { Abastecimento, AlocacaoEtapa, Deposito, EtapaObra, Obra } from '../../types';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useInsumos } from '../../hooks/useInsumos';
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel';
import { calcularEstoqueCombustivelNaData } from '../../hooks/useEstoque';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface AbastecimentoFormProps {
  initial?: Abastecimento | null;
  onSubmit: (data: Abastecimento) => void;
  onCancel: () => void;
  obras: Obra[];
  etapas: EtapaObra[];
  depositos: Deposito[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getInitialAlocacoes(initial?: Abastecimento | null): AlocacaoEtapa[] {
  if (initial?.alocacoes && initial.alocacoes.length > 0) {
    return initial.alocacoes;
  }
  if (initial?.etapaId) {
    return [{ etapaId: initial.etapaId, percentual: 100 }];
  }
  return [{ etapaId: '', percentual: 100 }];
}

export default function AbastecimentoForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  etapas: allEtapas,
  depositos: allDepositos,
}: AbastecimentoFormProps) {
  const { data: equipamentosData } = useEquipamentos();
  const equipamentosAtivos = (equipamentosData ?? []).filter((e) => e.ativo !== false);
  const { data: insumosData } = useInsumos();
  const insumosCombustivel = (insumosData ?? []).filter((i) => i.tipo === 'combustivel' && i.ativo !== false);
  const { data: entradasData } = useEntradasCombustivel();
  const allEntradas = entradasData ?? [];

  const [dataHora, setDataHora] = useState(initial?.dataHora || '');
  const [tipoCombustivel, setTipoCombustivel] = useState(
    initial?.tipoCombustivel || ''
  );
  const [quantidadeLitros, setQuantidadeLitros] = useState(
    initial?.quantidadeLitros?.toString() || ''
  );
  const [valorTotal, setValorTotal] = useState(
    initial?.valorTotal?.toString() || ''
  );
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [alocacoes, setAlocacoes] = useState<AlocacaoEtapa[]>(
    getInitialAlocacoes(initial)
  );
  const [depositoId, setDepositoId] = useState(initial?.depositoId || '');
  const [veiculo, setVeiculo] = useState(initial?.veiculo || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  // Filter etapas and depositos by obraId from props
  const etapas = obraId ? allEtapas.filter((e) => e.obraId === obraId) : [];
  const depositos = obraId
    ? allDepositos.filter(
        (d) => d.obraId === obraId && d.ativo !== false
      )
    : [];

  useEffect(() => {
    if (!initial) {
      setAlocacoes([{ etapaId: '', percentual: 100 }]);
      setDepositoId('');
    }
  }, [obraId, initial]);

  useEffect(() => {
    if (!initial) {
      setDepositoId('');
    }
  }, [tipoCombustivel, initial]);

  const depositoSelecionado = depositos.find((d) => d.id === depositoId);
  const qtdLitros = parseFloat(quantidadeLitros) || 0;

  // Estoque na data/hora selecionada (async)
  const [estoqueNaData, setEstoqueNaData] = useState(0);
  useEffect(() => {
    if (!depositoId || !dataHora) {
      setEstoqueNaData(0);
      return;
    }
    calcularEstoqueCombustivelNaData(depositoId, dataHora, initial?.id)
      .then(setEstoqueNaData);
  }, [depositoId, dataHora, initial?.id]);

  const estoqueDisponivel = dataHora
    ? estoqueNaData
    : depositoSelecionado
      ? depositoSelecionado.nivelAtualLitros + (initial ? initial.quantidadeLitros : 0)
      : 0;
  const semEstoque = depositoId && qtdLitros > estoqueDisponivel;

  // Preco medio do tanque selecionado
  const entradasTanque = depositoId
    ? allEntradas.filter((e) => e.depositoId === depositoId)
    : [];
  const totalLitrosEntradas = entradasTanque.reduce((s, e) => s + e.quantidadeLitros, 0);
  const totalValorEntradas = entradasTanque.reduce((s, e) => s + e.valorTotal, 0);
  const precoMedio = totalLitrosEntradas > 0 ? totalValorEntradas / totalLitrosEntradas : 0;

  // Auto-calcular valor total quando quantidade ou tanque mudam
  useEffect(() => {
    if (!initial && precoMedio > 0 && qtdLitros > 0) {
      setValorTotal((qtdLitros * precoMedio).toFixed(2));
    }
  }, [quantidadeLitros, depositoId, precoMedio, initial, qtdLitros]);

  // Alocacoes
  const totalPercentual = alocacoes.reduce((sum, a) => sum + a.percentual, 0);
  const alocacoesValidas =
    alocacoes.length > 0 &&
    alocacoes.every((a) => a.etapaId && a.percentual > 0) &&
    Math.abs(totalPercentual - 100) < 0.01;

  const etapasUsadas = new Set(alocacoes.map((a) => a.etapaId));

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
      tipoCombustivel,
      quantidadeLitros: qtdLitros,
      valorTotal: parseFloat(valorTotal),
      obraId,
      etapaId: alocacoes[0]?.etapaId || '',
      alocacoes,
      depositoId,
      veiculo,
      observacoes,
    });
  }

  const isValid =
    dataHora &&
    quantidadeLitros &&
    valorTotal &&
    obraId &&
    depositoId &&
    veiculo &&
    !semEstoque &&
    alocacoesValidas;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="dataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <Select
          label="Tipo de Combustivel"
          id="tipoCombustivel"
          value={tipoCombustivel}
          onChange={(e) => setTipoCombustivel(e.target.value)}
          options={insumosCombustivel.map((i) => ({ value: i.id, label: i.nome }))}
          placeholder={insumosCombustivel.length === 0 ? 'Nenhum insumo cadastrado' : 'Selecione o tipo'}
          required
        />
        <Select
          label="Obra"
          id="obraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <div>
          <Select
            label="Tanque de Origem"
            id="depositoId"
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
                  ? 'Nenhum tanque para este combustivel'
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
                    (estoqueDisponivel / depositoSelecionado.capacidadeLitros) * 100 > 50
                      ? 'bg-green-500'
                      : (estoqueDisponivel / depositoSelecionado.capacidadeLitros) * 100 > 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(Math.max((estoqueDisponivel / depositoSelecionado.capacidadeLitros) * 100, 0), 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {estoqueDisponivel.toFixed(0)} L disponiveis{dataHora ? ' na data' : ''}
              </span>
            </div>
          )}
        </div>
        <Input
          label="Quantidade (litros)"
          id="quantidadeLitros"
          type="number"
          step="0.1"
          min="0"
          value={quantidadeLitros}
          onChange={(e) => setQuantidadeLitros(e.target.value)}
          error={semEstoque ? `Estoque insuficiente (${estoqueDisponivel.toFixed(0)} L disponiveis${dataHora ? ' na data' : ''})` : undefined}
          required
        />
        <div>
          <Input
            label="Valor Total (R$)"
            id="valorTotal"
            type="number"
            step="0.01"
            min="0"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            required
          />
          {precoMedio > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preco medio do tanque: R$ {precoMedio.toFixed(4)}/L
            </p>
          )}
        </div>
        <Select
          label="Veiculo / Equipamento"
          id="veiculo"
          value={veiculo}
          onChange={(e) => setVeiculo(e.target.value)}
          options={equipamentosAtivos.map((eq) => ({
            value: eq.id,
            label: `${eq.nome}${eq.marca ? ` - ${eq.marca}` : ''}`,
          }))}
          placeholder={
            equipamentosAtivos.length === 0
              ? 'Nenhum equipamento ativo'
              : 'Selecione o equipamento'
          }
          required
        />
      </div>

      {/* Alocacao por Etapa */}
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
                  <option value="">
                    {!obraId ? 'Selecione a obra primeiro' : 'Selecione a etapa'}
                  </option>
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
              <span className="text-xs text-gray-400 w-16 text-right">
                {qtdLitros > 0
                  ? `${((qtdLitros * aloc.percentual) / 100).toFixed(1)} L`
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
          disabled={!obraId || alocacoes.length >= etapas.length}
        >
          + Adicionar Etapa
        </button>
      </div>

      <div>
        <label
          htmlFor="observacoes"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="observacoes"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observacao sobre o abastecimento..."
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
