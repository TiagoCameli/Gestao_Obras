import { useEffect, useState, type FormEvent } from 'react';
import type { DepositoMaterial, Insumo, TransferenciaMaterial, UnidadeMedida } from '../../types';
import { calcularEstoqueMaterial, calcularEstoqueMaterialNaData } from '../../hooks/useEstoque';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface TransferenciaMaterialFormProps {
  onSubmit: (data: TransferenciaMaterial) => void;
  onCancel: () => void;
  depositosMaterial: DepositoMaterial[];
  insumos: Insumo[];
  unidades?: UnidadeMedida[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function TransferenciaMaterialForm({
  onSubmit,
  onCancel,
  depositosMaterial,
  insumos: allInsumos,
  unidades: unidadesProp,
}: TransferenciaMaterialFormProps) {
  const depositos = depositosMaterial.filter((d) => d.ativo !== false);
  const insumosMaterial = allInsumos.filter(
    (i) => i.tipo === 'material' && i.ativo !== false
  );
  const unidades = unidadesProp ?? [];
  const unidadesMap = new Map(unidades.map((u) => [u.sigla, u.nome]));

  const [dataHora, setDataHora] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [depositoOrigemId, setDepositoOrigemId] = useState('');
  const [depositoDestinoId, setDepositoDestinoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const insumoSelecionado = insumosMaterial.find((i) => i.id === insumoId);
  const unidadeLabel = insumoSelecionado
    ? unidadesMap.get(insumoSelecionado.unidade) || insumoSelecionado.unidade
    : '';

  const qtd = parseFloat(quantidade) || 0;

  // Estoque async
  const [estoqueOrigem, setEstoqueOrigem] = useState(0);
  useEffect(() => {
    if (!depositoOrigemId || !insumoId) {
      setEstoqueOrigem(0);
      return;
    }
    if (dataHora) {
      calcularEstoqueMaterialNaData(depositoOrigemId, insumoId, dataHora)
        .then(setEstoqueOrigem);
    } else {
      calcularEstoqueMaterial(depositoOrigemId, insumoId)
        .then(setEstoqueOrigem);
    }
  }, [depositoOrigemId, insumoId, dataHora]);

  const semEstoqueOrigem = depositoOrigemId && insumoId && qtd > estoqueOrigem;
  const mesmoDeposito =
    depositoOrigemId &&
    depositoDestinoId &&
    depositoOrigemId === depositoDestinoId;

  const depositosDestino = depositos.filter((d) => d.id !== depositoOrigemId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: gerarId(),
      dataHora,
      depositoOrigemId,
      depositoDestinoId,
      insumoId,
      quantidade: qtd,
      valorTotal: parseFloat(valorTotal) || 0,
      observacoes,
    });
  }

  const isValid =
    dataHora &&
    insumoId &&
    depositoOrigemId &&
    depositoDestinoId &&
    qtd > 0 &&
    !semEstoqueOrigem &&
    !mesmoDeposito;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="transfMatDataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <Select
          label="Material"
          id="transfMatInsumoId"
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

        <div>
          <Select
            label="Deposito de Origem"
            id="transfMatOrigemId"
            value={depositoOrigemId}
            onChange={(e) => setDepositoOrigemId(e.target.value)}
            options={depositos.map((d) => ({
              value: d.id,
              label: d.nome,
            }))}
            placeholder={
              depositos.length === 0
                ? 'Nenhum deposito ativo'
                : 'Selecione o deposito de origem'
            }
            required
          />
          {depositoOrigemId && insumoId && (
            <p className="text-xs text-gray-500 mt-1">
              Estoque disponivel{dataHora ? ' na data' : ''}: {estoqueOrigem} {unidadeLabel}
            </p>
          )}
        </div>

        <Select
          label="Deposito de Destino"
          id="transfMatDestinoId"
          value={depositoDestinoId}
          onChange={(e) => setDepositoDestinoId(e.target.value)}
          options={depositosDestino.map((d) => ({
            value: d.id,
            label: d.nome,
          }))}
          placeholder={
            !depositoOrigemId
              ? 'Selecione a origem primeiro'
              : depositosDestino.length === 0
                ? 'Nenhum outro deposito disponivel'
                : 'Selecione o deposito de destino'
          }
          disabled={!depositoOrigemId}
          required
        />

        <Input
          label={`Quantidade${unidadeLabel ? ` (${unidadeLabel})` : ''}`}
          id="transfMatQtd"
          type="number"
          step="0.01"
          min="0"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          error={
            semEstoqueOrigem
              ? `Estoque insuficiente (${estoqueOrigem} ${unidadeLabel} disponiveis)`
              : undefined
          }
          required
        />

        <Input
          label="Valor Total (R$)"
          id="transfMatValor"
          type="number"
          step="0.01"
          min="0"
          value={valorTotal}
          onChange={(e) => setValorTotal(e.target.value)}
        />
      </div>

      <div>
        <label
          htmlFor="transfMatObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="transfMatObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observacao sobre a transferencia..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          Registrar Transferencia
        </Button>
      </div>
    </form>
  );
}
