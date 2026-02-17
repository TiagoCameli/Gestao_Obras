import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Deposito, TransferenciaCombustivel } from '../../types';
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel';
import { calcularEstoqueCombustivelNaData } from '../../hooks/useEstoque';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';

interface TransferenciaFormProps {
  onSubmit: (data: TransferenciaCombustivel) => void;
  onCancel: () => void;
  depositos: Deposito[];
  onImportBatch?: (items: TransferenciaCombustivel[]) => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TRANSF_TEMPLATE = [
  ['Data', 'Deposito Origem', 'Deposito Destino', 'Litros', 'Valor', 'Observacoes'],
  ['2024-01-15 08:00', 'Tanque Diesel 01', 'Tanque Diesel 02', '500', '3250', ''],
];

export default function TransferenciaForm({
  onSubmit,
  onCancel,
  depositos: allDepositos,
  onImportBatch,
}: TransferenciaFormProps) {
  const depositos = allDepositos.filter((d) => d.ativo !== false);
  const { data: entradasData } = useEntradasCombustivel();
  const allEntradas = entradasData ?? [];

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [dataHora, setDataHora] = useState('');
  const [depositoOrigemId, setDepositoOrigemId] = useState('');
  const [depositoDestinoId, setDepositoDestinoId] = useState('');
  const [quantidadeLitros, setQuantidadeLitros] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const depositoOrigem = depositos.find((d) => d.id === depositoOrigemId);
  const depositoDestino = depositos.find((d) => d.id === depositoDestinoId);
  const qtdLitros = parseFloat(quantidadeLitros) || 0;

  // Estoque na data/hora selecionada (async)
  const [estoqueOrigemNaData, setEstoqueOrigemNaData] = useState(0);
  const [estoqueDestinoNaData, setEstoqueDestinoNaData] = useState(0);

  useEffect(() => {
    if (!depositoOrigemId || !dataHora) {
      setEstoqueOrigemNaData(depositoOrigem ? depositoOrigem.nivelAtualLitros : 0);
      return;
    }
    calcularEstoqueCombustivelNaData(depositoOrigemId, dataHora)
      .then(setEstoqueOrigemNaData);
  }, [depositoOrigemId, dataHora, depositoOrigem?.nivelAtualLitros]);

  useEffect(() => {
    if (!depositoDestinoId || !dataHora) {
      setEstoqueDestinoNaData(depositoDestino ? depositoDestino.nivelAtualLitros : 0);
      return;
    }
    calcularEstoqueCombustivelNaData(depositoDestinoId, dataHora)
      .then(setEstoqueDestinoNaData);
  }, [depositoDestinoId, dataHora, depositoDestino?.nivelAtualLitros]);

  const semEstoqueOrigem = depositoOrigemId && qtdLitros > estoqueOrigemNaData;
  const espacoDestinoNaData = depositoDestino
    ? depositoDestino.capacidadeLitros - estoqueDestinoNaData
    : 0;
  const semEspacoDestino = depositoDestino && qtdLitros > espacoDestinoNaData;
  const mesmoTanque = depositoOrigemId && depositoOrigemId === depositoDestinoId;

  // Preco medio do tanque de origem
  const entradasOrigem = depositoOrigemId
    ? allEntradas.filter((e) => e.depositoId === depositoOrigemId)
    : [];
  const totalLitrosEntradas = entradasOrigem.reduce((s, e) => s + e.quantidadeLitros, 0);
  const totalValorEntradas = entradasOrigem.reduce((s, e) => s + e.valorTotal, 0);
  const precoMedio = totalLitrosEntradas > 0 ? totalValorEntradas / totalLitrosEntradas : 0;

  // Auto-calcular valor total
  useEffect(() => {
    if (precoMedio > 0 && qtdLitros > 0) {
      setValorTotal((qtdLitros * precoMedio).toFixed(4));
    }
  }, [quantidadeLitros, depositoOrigemId, precoMedio, qtdLitros]);

  // Filtrar destinos: excluir o tanque de origem
  const depositosDestino = depositos.filter((d) => d.id !== depositoOrigemId);

  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const data = parseStr(row[0]);
      const origemNome = parseStr(row[1]);
      const destinoNome = parseStr(row[2]);
      const litros = parseNumero(row[3]);
      const valor = parseNumero(row[4]);
      const obs = parseStr(row[5]);

      if (!data) erros.push('Falta data');

      let foundOrigemId = '';
      if (!origemNome) {
        erros.push('Falta deposito origem');
      } else {
        const found = depositos.find((d) => d.nome.toLowerCase() === origemNome.toLowerCase());
        if (found) foundOrigemId = found.id;
        else erros.push(`Deposito origem "${origemNome}" nao encontrado`);
      }

      let foundDestinoId = '';
      if (!destinoNome) {
        erros.push('Falta deposito destino');
      } else {
        const found = depositos.find((d) => d.nome.toLowerCase() === destinoNome.toLowerCase());
        if (found) foundDestinoId = found.id;
        else erros.push(`Deposito destino "${destinoNome}" nao encontrado`);
      }

      if (foundOrigemId && foundDestinoId && foundOrigemId === foundDestinoId) {
        erros.push('Origem e destino devem ser diferentes');
      }

      if (litros === null) erros.push('Falta litros');

      const resumo = `${data || '?'} | ${origemNome || '?'} -> ${destinoNome || '?'} | ${litros ?? '?'} L`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, depositoOrigemId: foundOrigemId, depositoDestinoId: foundDestinoId, quantidadeLitros: litros ?? 0, valorTotal: valor ?? 0, observacoes: obs },
      };
    },
    [depositos]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      dataHora: d.data,
      depositoOrigemId: d.depositoOrigemId,
      depositoDestinoId: d.depositoDestinoId,
      quantidadeLitros: d.quantidadeLitros,
      valorTotal: d.valorTotal,
      observacoes: d.observacoes,
      criadoPor: '',
    };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as TransferenciaCombustivel[]);
        setToastMsg(`${items.length} transferencia${items.length !== 1 ? 's' : ''} importada${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: gerarId(),
      dataHora,
      depositoOrigemId,
      depositoDestinoId,
      quantidadeLitros: qtdLitros,
      valorTotal: parseFloat(valorTotal) || 0,
      observacoes,
      criadoPor: '',
    });
  }

  const espacoDestino = espacoDestinoNaData;

  const isValid =
    dataHora &&
    depositoOrigemId &&
    depositoDestinoId &&
    qtdLitros > 0 &&
    !semEstoqueOrigem &&
    !semEspacoDestino &&
    !mesmoTanque;

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
          id="dataHoraTransf"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <div />

        <div>
          <Select
            label="Tanque de Origem"
            id="depositoOrigemId"
            value={depositoOrigemId}
            onChange={(e) => setDepositoOrigemId(e.target.value)}
            options={depositos.map((d) => ({
              value: d.id,
              label: `${d.nome} (${d.nivelAtualLitros.toFixed(0)}/${d.capacidadeLitros.toFixed(0)} L)`,
            }))}
            placeholder={
              depositos.length === 0
                ? 'Nenhum tanque ativo'
                : 'Selecione o tanque de origem'
            }
            required
          />
          {depositoOrigem && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    (estoqueOrigemNaData / depositoOrigem.capacidadeLitros) * 100 > 50
                      ? 'bg-green-500'
                      : (estoqueOrigemNaData / depositoOrigem.capacidadeLitros) * 100 > 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(Math.max((estoqueOrigemNaData / depositoOrigem.capacidadeLitros) * 100, 0), 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {estoqueOrigemNaData.toFixed(0)} L disponiveis{dataHora ? ' na data' : ''}
              </span>
            </div>
          )}
        </div>

        <div>
          <Select
            label="Tanque de Destino"
            id="depositoDestinoId"
            value={depositoDestinoId}
            onChange={(e) => setDepositoDestinoId(e.target.value)}
            options={depositosDestino.map((d) => ({
              value: d.id,
              label: `${d.nome} (${d.nivelAtualLitros.toFixed(0)}/${d.capacidadeLitros.toFixed(0)} L)`,
            }))}
            placeholder={
              !depositoOrigemId
                ? 'Selecione a origem primeiro'
                : depositosDestino.length === 0
                  ? 'Nenhum outro tanque disponivel'
                  : 'Selecione o tanque de destino'
            }
            disabled={!depositoOrigemId}
            required
          />
          {depositoDestino && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-emt-verde"
                  style={{
                    width: `${Math.min(Math.max((estoqueDestinoNaData / depositoDestino.capacidadeLitros) * 100, 0), 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {espacoDestino.toFixed(0)} L de espaco{dataHora ? ' na data' : ''}
              </span>
            </div>
          )}
        </div>

        <Input
          label="Quantidade (litros)"
          id="quantidadeLitrosTransf"
          type="number"
          step="0.0001"
          min="0"
          value={quantidadeLitros}
          onChange={(e) => setQuantidadeLitros(e.target.value)}
          error={
            semEstoqueOrigem
              ? `Estoque insuficiente (${estoqueOrigemNaData.toFixed(0)} L disponiveis${dataHora ? ' na data' : ''})`
              : semEspacoDestino
                ? `Espaco insuficiente no destino (${espacoDestino.toFixed(0)} L de espaco${dataHora ? ' na data' : ''})`
                : undefined
          }
          required
        />

        <div>
          <Input
            label="Valor Total (R$)"
            id="valorTotalTransf"
            type="number"
            step="0.0001"
            min="0"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
          />
          {precoMedio > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preco medio do tanque origem: R$ {precoMedio.toFixed(4)}/L
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="observacoesTransf"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="observacoesTransf"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
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

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Transferencias de Combustivel do Excel"
        entityLabel="Transferencia"
        genderFem={true}
        templateData={TRANSF_TEMPLATE}
        templateFileName="template_transferencias_combustivel.xlsx"
        sheetName="Transferencias"
        templateColWidths={[18, 20, 20, 10, 12, 15]}
        formatHintHeaders={['Data', 'Dep. Origem', 'Dep. Destino', 'Litros', 'Valor', 'Obs']}
        formatHintExample={['2024-01-15 08:00', 'Tanque 01', 'Tanque 02', '500', '3250', '']}
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
