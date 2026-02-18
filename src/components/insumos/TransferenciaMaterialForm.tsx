import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { DepositoMaterial, Insumo, TransferenciaMaterial, UnidadeMedida } from '../../types';
import { calcularEstoqueMaterial, calcularEstoqueMaterialNaData } from '../../hooks/useEstoque';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';

interface TransferenciaMaterialFormProps {
  onSubmit: (data: TransferenciaMaterial) => void;
  onCancel: () => void;
  depositosMaterial: DepositoMaterial[];
  insumos: Insumo[];
  unidades?: UnidadeMedida[];
  onImportBatch?: (items: TransferenciaMaterial[]) => void;
}

const TRANSF_MAT_TEMPLATE = [
  ['Data', 'Material', 'Dep. Origem', 'Dep. Destino', 'Quantidade', 'Valor', 'Observações'],
  ['2024-01-15 08:00', 'Cimento CP-II', 'Almoxarifado Central', 'Almoxarifado Obra 2', '30', '1050', ''],
];

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function TransferenciaMaterialForm({
  onSubmit,
  onCancel,
  depositosMaterial,
  insumos: allInsumos,
  unidades: unidadesProp,
  onImportBatch,
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const parseRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const data = parseStr(row[0]);
    if (!data) erros.push('Data obrigatoria');
    const materialNome = parseStr(row[1]);
    const material = allInsumos.filter((i) => i.tipo === 'material' && i.ativo !== false).find((i) => i.nome.toLowerCase() === materialNome.toLowerCase());
    if (!material) erros.push(`Material "${materialNome}" não encontrado`);
    const insumoId = material?.id ?? '';
    const origemNome = parseStr(row[2]);
    const origem = depositosMaterial.filter((d) => d.ativo !== false).find((d) => d.nome.toLowerCase() === origemNome.toLowerCase());
    if (!origem) erros.push(`Dep. Origem "${origemNome}" não encontrado`);
    const depositoOrigemId = origem?.id ?? '';
    const destinoNome = parseStr(row[3]);
    const destino = depositosMaterial.filter((d) => d.ativo !== false).find((d) => d.nome.toLowerCase() === destinoNome.toLowerCase());
    if (!destino) erros.push(`Dep. Destino "${destinoNome}" não encontrado`);
    const depositoDestinoId = destino?.id ?? '';
    if (depositoOrigemId && depositoDestinoId && depositoOrigemId === depositoDestinoId) erros.push('Origem e destino devem ser diferentes');
    const qtd = parseNumero(row[4]);
    if (qtd === null || qtd <= 0) erros.push('Quantidade obrigatoria');
    const quantidade = qtd ?? 0;
    const vt = parseNumero(row[5]);
    const valorTotal = vt ?? 0;
    const observacoes = parseStr(row[6]);
    return {
      valido: erros.length === 0,
      erros,
      resumo: `${data} | ${materialNome} | ${origemNome} -> ${destinoNome} | ${quantidade}`,
      dados: { data, insumoId, depositoOrigemId, depositoDestinoId, quantidade, valorTotal, observacoes },
    };
  }, [allInsumos, depositosMaterial]);

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      dataHora: d.data as string,
      depositoOrigemId: d.depositoOrigemId as string,
      depositoDestinoId: d.depositoDestinoId as string,
      insumoId: d.insumoId as string,
      quantidade: d.quantidade as number,
      valorTotal: d.valorTotal as number,
      observacoes: d.observacoes as string,
      criadoPor: '',
    };
  }, []);

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
      criadoPor: '',
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
      {onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
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
            label="Depósito de Origem"
            id="transfMatOrigemId"
            value={depositoOrigemId}
            onChange={(e) => setDepositoOrigemId(e.target.value)}
            options={depositos.map((d) => ({
              value: d.id,
              label: d.nome,
            }))}
            placeholder={
              depositos.length === 0
                ? 'Nenhum depósito ativo'
                : 'Selecione o depósito de origem'
            }
            required
          />
          {depositoOrigemId && insumoId && (
            <p className="text-xs text-gray-500 mt-1">
              Estoque disponível{dataHora ? ' na data' : ''}: {estoqueOrigem} {unidadeLabel}
            </p>
          )}
        </div>

        <Select
          label="Depósito de Destino"
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
                ? 'Nenhum outro depósito disponível'
                : 'Selecione o depósito de destino'
          }
          disabled={!depositoOrigemId}
          required
        />

        <Input
          label={`Quantidade${unidadeLabel ? ` (${unidadeLabel})` : ''}`}
          id="transfMatQtd"
          type="number"
          step="0.0001"
          min="0"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          error={
            semEstoqueOrigem
              ? `Estoque insuficiente (${estoqueOrigem} ${unidadeLabel} disponíveis)`
              : undefined
          }
          required
        />

        <Input
          label="Valor Total (R$)"
          id="transfMatValor"
          type="number"
          step="0.0001"
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
          Observações (opcional)
        </label>
        <textarea
          id="transfMatObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observação sobre a transferência..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          Registrar Transferência
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as TransferenciaMaterial[]);
            setToastMsg(`${items.length} transferência(s) importada(s) com sucesso!`);
            setTimeout(() => setToastMsg(''), 3500);
          }}
          title="Importar Transferências de Material"
          entityLabel="Transferência"
          genderFem
          templateData={TRANSF_MAT_TEMPLATE}
          templateFileName="template_transferencias_material.xlsx"
          sheetName="Transferências"
          templateColWidths={[18, 18, 22, 22, 12, 12, 15]}
          formatHintHeaders={['Data', 'Material', 'Dep. Origem', 'Dep. Destino', 'Qtd', 'Valor', 'Obs']}
          formatHintExample={['2024-01-15 08:00', 'Cimento', 'Almoxarifado 1', 'Almoxarifado 2', '30', '1050', '']}
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
