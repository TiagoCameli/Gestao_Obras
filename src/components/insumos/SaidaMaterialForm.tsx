import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AlocacaoEtapa, DepositoMaterial, EtapaObra, Insumo, Obra, SaidaMaterial, UnidadeMedida } from '../../types';
import { useEntradasMaterial } from '../../hooks/useEntradasMaterial';
import { calcularEstoqueMaterial, calcularEstoqueMaterialNaData } from '../../hooks/useEstoque';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';

interface SaidaMaterialFormProps {
  initial?: SaidaMaterial | null;
  onSubmit: (data: SaidaMaterial) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  etapas: EtapaObra[];
  depositosMaterial: DepositoMaterial[];
  unidades: UnidadeMedida[];
  onImportBatch?: (items: SaidaMaterial[]) => void;
}

const SAIDA_MAT_TEMPLATE = [
  ['Data', 'Obra', 'Depósito', 'Material', 'Quantidade', 'Valor', 'Observações'],
  ['2024-01-15 08:00', 'Obra ABC', 'Almoxarifado Central', 'Cimento CP-II', '50', '1750', ''],
];

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
  onImportBatch,
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

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
    if (vt === null || vt <= 0) erros.push('Valor obrigatorio');
    const valorTotal = vt ?? 0;
    const observacoes = parseStr(row[6]);
    return {
      valido: erros.length === 0,
      erros,
      resumo: `${data} | ${obraNome} | ${depositoNome} | ${materialNome} | ${quantidade}`,
      dados: { data, obraId, depositoMaterialId, insumoId, quantidade, valorTotal, observacoes },
    };
  }, [obras, allDepositos, allInsumos]);

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
      alocacoes: [],
      observacoes: d.observacoes as string,
      criadoPor: '',
    };
  }, []);

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
      setValorTotal((qtd * precoMedio).toFixed(4));
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
      criadoPor: initial?.criadoPor || '',
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
            label="Depósito de Origem"
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
                  ? 'Nenhum depósito cadastrado'
                  : 'Selecione o depósito'
            }
            disabled={!obraId || depositos.length === 0}
            required
          />
          {depositoMaterialId && insumoId && (
            <p className="text-xs text-gray-500 mt-1">
              Estoque disponível{dataHora ? ' na data' : ''}: {estoqueDisponivel} {unidadeLabel}
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
          step="0.0001"
          min="0"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          error={
            semEstoque
              ? `Estoque insuficiente (${estoqueDisponivel} ${unidadeLabel} disponíveis)`
              : undefined
          }
          required
        />
        <div>
          <Input
            label="Valor Total (R$)"
            id="saiMatValor"
            type="number"
            step="0.0001"
            min="0"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            required
          />
          {precoMedio > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preço médio do estoque: R$ {precoMedio.toFixed(4)}/{unidadeLabel || 'un'}
            </p>
          )}
        </div>
      </div>

      {/* Secao Alocacao por Etapa */}
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
                  step="0.0001"
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
          Observações (opcional)
        </label>
        <textarea
          id="saiMatObs"
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
          {initial ? 'Salvar Alterações' : 'Registrar Saída'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as SaidaMaterial[]);
            setToastMsg(`${items.length} saída(s) importada(s) com sucesso!`);
            setTimeout(() => setToastMsg(''), 3500);
          }}
          title="Importar Saídas de Material"
          entityLabel="Saída"
          genderFem
          templateData={SAIDA_MAT_TEMPLATE}
          templateFileName="template_saidas_material.xlsx"
          sheetName="Saídas"
          templateColWidths={[18, 15, 22, 18, 12, 12, 15]}
          formatHintHeaders={['Data', 'Obra', 'Depósito', 'Material', 'Qtd', 'Valor', 'Obs']}
          formatHintExample={['2024-01-15 08:00', 'Obra ABC', 'Almoxarifado', 'Cimento', '50', '1750', '']}
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
