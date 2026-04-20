import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Abastecimento, AlocacaoEtapa, Deposito, EtapaObra, Obra, OrigemCombustivel } from '../../types';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useInsumos } from '../../hooks/useInsumos';
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel';
import { useFornecedores } from '../../hooks/useFornecedores';
import { calcularEstoqueCombustivelNaData } from '../../hooks/useEstoque';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import SearchableSelect from '../apontamentos/SearchableSelect';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';

interface AbastecimentoFormProps {
  initial?: Abastecimento | null;
  onSubmit: (data: Abastecimento) => void;
  onCancel: () => void;
  obras: Obra[];
  etapas: EtapaObra[];
  depositos: Deposito[];
  onImportBatch?: (items: Abastecimento[]) => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ABAST_TEMPLATE = [
  ['Data', 'Hora', 'Combustível', 'Obra', 'Etapa', 'Depósito', 'Litros', 'Veículo', 'Observações', 'Origem', 'Fornecedor'],
  ['2024-01-15', '08:00', 'Diesel S10', 'Obra ABC', 'Terraplanagem', 'Tanque Diesel 01', '200', 'Escavadeira CAT', '', 'tanque', ''],
  ['2024-01-16', '10:00', 'Diesel S10', 'Obra ABC', 'Terraplanagem', '', '150', 'Escavadeira CAT', '', 'dinheiro', 'Posto Shell'],
  ['2024-01-17', '14:00', 'Diesel S10', 'Obra ABC', 'Terraplanagem', '', '300', 'Escavadeira CAT', '', 'requisicao', 'Distribuidora XYZ'],
];

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
  onImportBatch,
}: AbastecimentoFormProps) {
  const { data: equipamentosData } = useEquipamentos();
  const equipamentosAtivos = (equipamentosData ?? []).filter((e) => e.ativo !== false);
  const { data: insumosData } = useInsumos();
  const insumosCombustivel = (insumosData ?? []).filter((i) => i.tipo === 'combustivel' && i.ativo !== false);
  const { data: entradasData } = useEntradasCombustivel();
  const allEntradas = entradasData ?? [];
  const { data: fornecedoresData } = useFornecedores();
  const fornecedorOptions = (fornecedoresData ?? [])
    .filter((f) => f.ativo !== false)
    .map((f) => ({ id: f.nome, label: f.nome }));

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Separar data e hora do valor combinado
  const initialDate = initial?.dataHora ? initial.dataHora.slice(0, 10) : '';
  const initialTime = initial?.dataHora && initial.dataHora.length > 10 ? initial.dataHora.slice(11, 16) : '';
  const [data, setData] = useState(initialDate);
  const [hora, setHora] = useState(initialTime);
  const dataHora = data ? (hora ? `${data}T${hora}` : `${data}T00:00`) : '';
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
  const [origemCombustivel, setOrigemCombustivel] = useState<OrigemCombustivel>(initial?.origemCombustivel || 'tanque');
  const [fornecedor, setFornecedor] = useState(initial?.fornecedor || '');
  const isTanque = origemCombustivel === 'tanque';

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
  const semEstoque = isTanque && depositoId && qtdLitros > estoqueDisponivel;

  // Preco medio do tanque selecionado
  const entradasTanque = depositoId
    ? allEntradas.filter((e) => e.depositoId === depositoId)
    : [];
  const totalLitrosEntradas = entradasTanque.reduce((s, e) => s + e.quantidadeLitros, 0);
  const totalValorEntradas = entradasTanque.reduce((s, e) => s + e.valorTotal, 0);
  const precoMedio = totalLitrosEntradas > 0 ? totalValorEntradas / totalLitrosEntradas : 0;

  // Auto-calcular valor total quando quantidade ou tanque mudam (apenas para tanque)
  useEffect(() => {
    if (isTanque && precoMedio > 0 && qtdLitros > 0) {
      setValorTotal((qtdLitros * precoMedio).toFixed(4));
    }
  }, [quantidadeLitros, depositoId, precoMedio, qtdLitros, isTanque]);

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

  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const dataVal = parseStr(row[0]);
      const horaVal = parseStr(row[1]);
      const combustivelNome = parseStr(row[2]);
      const obraNome = parseStr(row[3]);
      const etapaNome = parseStr(row[4]);
      const depositoNome = parseStr(row[5]);
      const litros = parseNumero(row[6]);
      const veiculoNome = parseStr(row[7]);
      const obs = parseStr(row[8]);
      const origemRaw = (parseStr(row[9]) || 'tanque').toLowerCase().trim();
      const fornecedorNome = parseStr(row[10]);

      const origensValidas = ['tanque', 'dinheiro', 'requisicao'];
      const origem = origensValidas.includes(origemRaw) ? origemRaw : 'tanque';
      if (!origensValidas.includes(origemRaw) && parseStr(row[9])) {
        erros.push(`Origem "${parseStr(row[9])}" inválida (usar: tanque, dinheiro, requisicao)`);
      }
      const isTanqueRow = origem === 'tanque';

      if (!dataVal) erros.push('Falta data');
      const dataHoraStr = dataVal ? (horaVal ? `${dataVal}T${horaVal}` : `${dataVal}T00:00`) : '';

      let combustivelId = '';
      if (!combustivelNome) {
        erros.push('Falta combustível');
      } else {
        const found = insumosCombustivel.find((i) => i.nome.toLowerCase() === combustivelNome.toLowerCase());
        if (found) combustivelId = found.id;
        else erros.push(`Combustível "${combustivelNome}" não encontrado`);
      }

      let foundObraId = '';
      if (!obraNome) {
        erros.push('Falta obra');
      } else {
        const found = obras.find((o) => o.nome.toLowerCase() === obraNome.toLowerCase());
        if (found) foundObraId = found.id;
        else erros.push(`Obra "${obraNome}" não encontrada`);
      }

      let foundEtapaId = '';
      if (etapaNome && foundObraId) {
        const etapasObra = allEtapas.filter((e) => e.obraId === foundObraId);
        const found = etapasObra.find((e) => e.nome.toLowerCase() === etapaNome.toLowerCase());
        if (found) foundEtapaId = found.id;
        else erros.push(`Etapa "${etapaNome}" não encontrada na obra`);
      }

      let foundDepositoId = '';
      if (isTanqueRow) {
        if (!depositoNome) {
          erros.push('Falta depósito (obrigatório para origem tanque)');
        } else {
          const depositosObra = foundObraId
            ? allDepositos.filter((d) => d.obraId === foundObraId && d.ativo !== false)
            : allDepositos.filter((d) => d.ativo !== false);
          const found = depositosObra.find((d) => d.nome.toLowerCase() === depositoNome.toLowerCase());
          if (found) foundDepositoId = found.id;
          else erros.push(`Depósito "${depositoNome}" não encontrado`);
        }
      }

      if (!isTanqueRow && !fornecedorNome) {
        erros.push('Falta fornecedor (obrigatório para dinheiro/requisicao)');
      }

      if (litros === null) erros.push('Falta litros');
      if (!veiculoNome) erros.push('Falta veículo');

      const resumo = `${dataVal || '?'} ${horaVal || ''} | ${origem} | ${combustivelNome || '?'} | ${obraNome || '?'} | ${veiculoNome || '?'} | ${litros ?? '?'} L${!isTanqueRow ? ` | ${fornecedorNome || '?'}` : ''}`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { dataHora: dataHoraStr, tipoCombustivel: combustivelId, obraId: foundObraId, etapaId: foundEtapaId, depositoId: foundDepositoId, quantidadeLitros: litros ?? 0, veiculo: veiculoNome, observacoes: obs, origemCombustivel: origem, fornecedor: fornecedorNome },
      };
    },
    [insumosCombustivel, obras, allDepositos, allEtapas]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    const etapaId = d.etapaId as string;
    const depId = d.depositoId as string;
    const qtd = d.quantidadeLitros as number;
    const origem = (d.origemCombustivel as string) || 'tanque';
    const isTanqueRow = origem === 'tanque';

    // Calcular valor automaticamente pelo preço médio do tanque (só para tanque)
    let valorCalc = 0;
    if (isTanqueRow && depId) {
      const entradasDep = allEntradas.filter((e) => e.depositoId === depId);
      const totalLitros = entradasDep.reduce((s, e) => s + e.quantidadeLitros, 0);
      const totalValor = entradasDep.reduce((s, e) => s + e.valorTotal, 0);
      const pm = totalLitros > 0 ? totalValor / totalLitros : 0;
      valorCalc = qtd * pm;
    }

    return {
      id: gerarId(),
      dataHora: d.dataHora,
      tipoCombustivel: d.tipoCombustivel,
      quantidadeLitros: qtd,
      valorTotal: parseFloat(valorCalc.toFixed(4)),
      obraId: d.obraId,
      etapaId,
      alocacoes: etapaId ? [{ etapaId, percentual: 100 }] : [],
      depositoId: isTanqueRow ? depId : '',
      veiculo: d.veiculo,
      observacoes: d.observacoes,
      criadoPor: '',
      origemCombustivel: origem,
      fornecedor: (d.fornecedor as string) || '',
      pago: false,
      dataPagamento: '',
      pagoPor: '',
    };
  }, [allEntradas]);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as Abastecimento[]);
        setToastMsg(`${items.length} abastecimento${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch]
  );

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
      depositoId: isTanque ? depositoId : '',
      veiculo,
      observacoes,
      criadoPor: initial?.criadoPor || '',
      origemCombustivel,
      fornecedor: isTanque ? '' : fornecedor,
      pago: initial?.pago ?? false,
      dataPagamento: initial?.dataPagamento ?? '',
      pagoPor: initial?.pagoPor ?? '',
    });
  }

  const isValid =
    data &&
    quantidadeLitros &&
    valorTotal &&
    obraId &&
    veiculo &&
    !semEstoque &&
    alocacoesValidas &&
    (isTanque ? !!depositoId : !!fornecedor);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      {/* Origem do combustível */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Origem do Combustível<span className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="flex gap-3">
          {([['tanque', 'Tanque'], ['dinheiro', 'Dinheiro'], ['requisicao', 'Requisição']] as const).map(([val, label]) => (
            <label key={val} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              origemCombustivel === val
                ? 'border-emt-verde bg-emt-verde-claro text-emt-verde-escuro font-medium'
                : 'border-gray-300 hover:border-gray-400 text-gray-600'
            }`}>
              <input
                type="radio"
                name="origemCombustivel"
                value={val}
                checked={origemCombustivel === val}
                onChange={() => setOrigemCombustivel(val)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data"
          id="dataAbastecimento"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <Input
          label="Hora (opcional)"
          id="horaAbastecimento"
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
        />
        <Select
          label="Tipo de Combustível"
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
        {isTanque ? (
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
                    ? 'Nenhum tanque para este combustível'
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
                  {estoqueDisponivel.toFixed(0)} L disponíveis{dataHora ? ' na data' : ''}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Fornecedor <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={fornecedorOptions}
              value={fornecedor}
              onChange={setFornecedor}
              placeholder="Selecione o fornecedor..."
            />
          </div>
        )}
        <Input
          label="Quantidade (litros)"
          id="quantidadeLitros"
          type="number"
          step="0.0001"
          min="0"
          value={quantidadeLitros}
          onChange={(e) => setQuantidadeLitros(e.target.value)}
          error={semEstoque ? `Estoque insuficiente (${estoqueDisponivel.toFixed(0)} L disponíveis${dataHora ? ' na data' : ''})` : undefined}
          required
        />
        <div>
          <Input
            label={isTanque && precoMedio > 0 ? 'Valor Total (R$) — calculado' : 'Valor Total (R$)'}
            id="valorTotal"
            type="number"
            step="0.0001"
            min="0"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            readOnly={isTanque && precoMedio > 0}
            required
          />
          {isTanque && precoMedio > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preço médio do tanque: R$ {precoMedio.toFixed(4)}/L
            </p>
          )}
        </div>
        <div>
          <label htmlFor="veiculo" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Veículo / Equipamento<span className="text-red-500 ml-0.5">*</span>
          </label>
          <SearchableSelect
            options={equipamentosAtivos.map((eq) => ({
              id: eq.id,
              label: `${eq.nome}${eq.marca ? ` - ${eq.marca}` : ''}`,
            }))}
            value={veiculo}
            onChange={setVeiculo}
            placeholder={
              equipamentosAtivos.length === 0
                ? 'Nenhum equipamento ativo'
                : 'Buscar equipamento...'
            }
          />
        </div>
      </div>

      {/* Alocacao por Etapa */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">
            Alocação por Etapa
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
                  step="0.0001"
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
          Observações (opcional)
        </label>
        <textarea
          id="observacoes"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observação sobre o abastecimento..."
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Registrar Saída'}
        </Button>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Abastecimentos do Excel"
        entityLabel="Abastecimento"
        genderFem={false}
        templateData={ABAST_TEMPLATE}
        templateFileName="template_abastecimentos.xlsx"
        sheetName="Abastecimentos"
        templateColWidths={[14, 8, 15, 15, 18, 20, 10, 20, 15]}
        formatHintHeaders={['Data', 'Hora', 'Combustível', 'Obra', 'Etapa', 'Depósito', 'Litros', 'Veículo', 'Obs']}
        formatHintExample={['2024-01-15', '08:00', 'Diesel S10', 'Obra ABC', 'Terraplanagem', 'Tanque 01', '200', 'CAT 320', '']}
        parseRow={parseRow}
        toEntity={toEntity}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[60] bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out]">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
