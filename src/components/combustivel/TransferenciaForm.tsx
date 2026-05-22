import { useCallback, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Deposito, TransferenciaCombustivel } from '../../types';
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel';
import { useTransferenciasCombustivel } from '../../hooks/useTransferenciasCombustivel';
import { useInsumos } from '../../hooks/useInsumos';
import { calcularPrecoMedioTanque } from '../../utils/precoMedioTanque';
import { calcularEstoqueCombustivelNaData, calcularCombustivelTanqueNaData } from '../../hooks/useEstoque';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';
import AnexosUploader from './AnexosUploader';
import { useAuth } from '../../contexts/AuthContext';
import {
  transferenciaCombustivelSchema,
  type TransferenciaCombustivelFormValues,
} from '../../schemas/combustivel/transferenciaCombustivel.schema';

interface TransferenciaFormProps {
  initial?: TransferenciaCombustivel | null;
  onSubmit: (data: TransferenciaCombustivel) => void;
  onCancel: () => void;
  depositos: Deposito[];
  onImportBatch?: (items: TransferenciaCombustivel[]) => void;
}

function gerarId(prefix = 'tcf'): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const TRANSF_TEMPLATE = [
  ['Data', 'Depósito Origem', 'Depósito Destino', 'Litros', 'Valor', 'Observações'],
  ['2024-01-15 08:00', 'Tanque Diesel 01', 'Tanque Diesel 02', '500', '3250', ''],
];

export default function TransferenciaForm({
  initial,
  onSubmit,
  onCancel,
  depositos: allDepositos,
  onImportBatch,
}: TransferenciaFormProps) {
  const depositos = allDepositos.filter((d) => d.ativo !== false);
  const { data: entradasData } = useEntradasCombustivel();
  const allEntradas = entradasData ?? [];
  const { data: transferenciasCombData } = useTransferenciasCombustivel();
  const allTransferencias = transferenciasCombData ?? [];
  // F11 — Resolve id → nome do combustível pro banner de conflito de mistura.
  const { data: insumosData } = useInsumos();
  const allInsumos = insumosData ?? [];

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // F9 — Anexos (não validados pelo schema, ficam em useState)
  const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);
  // pastaId estável pra agrupar uploads no Storage.
  const [pastaId] = useState(() => initial?.id || gerarId());

  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ── react-hook-form + Zod ─────────────────────────────────────────────────
  const {
    control,
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    setValue,
    formState: { errors, isValid: rhfIsValid },
  } = useForm<TransferenciaCombustivelFormValues>({
    resolver: zodResolver(transferenciaCombustivelSchema),
    mode: 'onChange',
    defaultValues: {
      dataHora: initial?.dataHora ?? new Date().toISOString().slice(0, 16),
      depositoOrigemId: initial?.depositoOrigemId ?? '',
      depositoDestinoId: initial?.depositoDestinoId ?? '',
      quantidadeLitros: initial?.quantidadeLitros ?? 0,
      valorTotal: initial?.valorTotal ?? 0,
      observacoes: initial?.observacoes ?? '',
    },
  });

  const dataHora = watch('dataHora');
  const depositoOrigemId = watch('depositoOrigemId');
  const depositoDestinoId = watch('depositoDestinoId');
  const quantidadeLitros = watch('quantidadeLitros');

  const depositoOrigem = depositos.find((d) => d.id === depositoOrigemId);
  const depositoDestino = depositos.find((d) => d.id === depositoDestinoId);
  const qtdLitros = quantidadeLitros || 0;

  // Estoque na data/hora selecionada (async)
  const [estoqueOrigemNaData, setEstoqueOrigemNaData] = useState(0);
  const [estoqueDestinoNaData, setEstoqueDestinoNaData] = useState(0);

  useEffect(() => {
    if (!depositoOrigemId || !dataHora) {
      setEstoqueOrigemNaData(depositoOrigem ? depositoOrigem.nivelAtualLitros : 0);
      return;
    }
    // Fallback pro nível atual em caso de falha da RPC — evita bloquear
    // o form quando a função do banco está quebrada (vide migration
    // 20260512230000_fix_calcular_estoque_combustivel_na_data).
    calcularEstoqueCombustivelNaData(depositoOrigemId, dataHora)
      .then(setEstoqueOrigemNaData)
      .catch((err) => {
        console.error('[TransferenciaForm] estoque origem na data falhou', err);
        setEstoqueOrigemNaData(depositoOrigem ? depositoOrigem.nivelAtualLitros : 0);
      });
  }, [depositoOrigemId, dataHora, depositoOrigem?.nivelAtualLitros, depositoOrigem]);

  useEffect(() => {
    if (!depositoDestinoId || !dataHora) {
      setEstoqueDestinoNaData(depositoDestino ? depositoDestino.nivelAtualLitros : 0);
      return;
    }
    calcularEstoqueCombustivelNaData(depositoDestinoId, dataHora)
      .then(setEstoqueDestinoNaData)
      .catch((err) => {
        console.error('[TransferenciaForm] estoque destino na data falhou', err);
        setEstoqueDestinoNaData(depositoDestino ? depositoDestino.nivelAtualLitros : 0);
      });
  }, [depositoDestinoId, dataHora, depositoDestino?.nivelAtualLitros, depositoDestino]);

  // HF.7 — Combustível que vai ser transferido (point-in-time do tanque
  // origem na data selecionada). Usa fallback pro combustivelAtualId quando
  // a RPC falha ou faltam dados. NULL → "indisponível" no rótulo.
  const [combustivelOrigemId, setCombustivelOrigemId] = useState<string | null>(null);
  useEffect(() => {
    if (!depositoOrigemId || !dataHora) {
      setCombustivelOrigemId(depositoOrigem?.combustivelAtualId ?? null);
      return;
    }
    calcularCombustivelTanqueNaData(depositoOrigemId, dataHora)
      .then(setCombustivelOrigemId)
      .catch((err) => {
        console.error('[TransferenciaForm] combustível na data falhou', err);
        setCombustivelOrigemId(depositoOrigem?.combustivelAtualId ?? null);
      });
  }, [depositoOrigemId, dataHora, depositoOrigem?.combustivelAtualId]);
  const combustivelOrigemNome = combustivelOrigemId
    ? (allInsumos.find((i) => i.id === combustivelOrigemId)?.nome ?? null)
    : null;

  const semEstoqueOrigem = depositoOrigemId && qtdLitros > estoqueOrigemNaData;
  const espacoDestinoNaData = depositoDestino
    ? depositoDestino.capacidadeLitros - estoqueDestinoNaData
    : 0;
  const semEspacoDestino = depositoDestino && qtdLitros > espacoDestinoNaData;

  // F11 — Pre-check de mistura no destino. O trigger no DB é a fonte da
  // verdade, mas mostrar inline evita submit+erro feio. Bloqueia se destino
  // tem combustível ≠ do origem. Destino vazio (nivel <= 0) ou externo passa —
  // espelha o trigger fn_validate_transferencia_combustivel.
  const conflitoCombustivelDestino = (() => {
    if (!depositoOrigem || !depositoDestino) return null;
    if (depositoDestino.ehExterno) return null;
    if (depositoDestino.nivelAtualLitros <= 0) return null;
    if (!depositoDestino.combustivelAtualId) return null;
    if (!depositoOrigem.combustivelAtualId) return null;
    if (depositoDestino.combustivelAtualId === depositoOrigem.combustivelAtualId) return null;
    return {
      origem: depositoOrigem.combustivelAtualId,
      destino: depositoDestino.combustivelAtualId,
    };
  })();

  // Preço médio do tanque de origem — usa helper compartilhado que inclui
  // entradas + transferências recebidas (fix Bug C2: inline anterior ignorava
  // transferências recebidas — tanque abastecido só por transferência
  // retornava 0 e auto-calculava valor total incorreto).
  const precoMedio = depositoOrigemId
    ? calcularPrecoMedioTanque(depositoOrigemId, allEntradas, allTransferencias)
    : 0;

  // Auto-fill valorTotal via watch + setValue.
  // Só se NÃO for edit existente (pra não sobrescrever salvo).
  useEffect(() => {
    if (!initial?.id && qtdLitros > 0 && precoMedio > 0) {
      setValue('valorTotal', parseFloat((qtdLitros * precoMedio).toFixed(4)), { shouldValidate: true });
    }
  }, [qtdLitros, precoMedio, initial?.id, setValue]);

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
        erros.push('Falta depósito origem');
      } else {
        const found = depositos.find((d) => d.nome.toLowerCase() === origemNome.toLowerCase());
        if (found) foundOrigemId = found.id;
        else erros.push(`Depósito origem "${origemNome}" não encontrado`);
      }

      let foundDestinoId = '';
      if (!destinoNome) {
        erros.push('Falta depósito destino');
      } else {
        const found = depositos.find((d) => d.nome.toLowerCase() === destinoNome.toLowerCase());
        if (found) foundDestinoId = found.id;
        else erros.push(`Depósito destino "${destinoNome}" não encontrado`);
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
        setToastMsg(`${items.length} transferência${items.length !== 1 ? 's' : ''} importada${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch]
  );

  const { temAcao, usuario } = useAuth();
  const canAct = temAcao('criar_transferencia_combustivel');

  const onSubmitForm = async (data: TransferenciaCombustivelFormValues) => {
    if (!canAct) return;
    setSubmitting(true);
    setErro(null);
    try {
      await onSubmit({
        id: initial?.id ?? pastaId,
        dataHora: data.dataHora,
        depositoOrigemId: data.depositoOrigemId,
        depositoDestinoId: data.depositoDestinoId,
        quantidadeLitros: data.quantidadeLitros,
        valorTotal: data.valorTotal,
        observacoes: data.observacoes,
        criadoPor: usuario?.nome ?? '',
        fotoUrls,
        arquivoUrls,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar transferência');
    } finally {
      setSubmitting(false);
    }
  };

  const espacoDestino = espacoDestinoNaData;

  // Bloquear submit em condições operacionais extras (além do Zod)
  const isValid =
    rhfIsValid &&
    !semEstoqueOrigem &&
    !semEspacoDestino &&
    !conflitoCombustivelDestino;

  return (
    <form onSubmit={rhfHandleSubmit(onSubmitForm)} className="space-y-4">
      {onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="dataHoraTransf" className="block text-sm font-medium text-gray-700 mb-1">
            Data e Hora
          </label>
          <input
            id="dataHoraTransf"
            type="datetime-local"
            {...register('dataHora')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
          {errors.dataHora && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.dataHora.message}</p>
          )}
        </div>
        <div />

        <div>
          <Controller
            name="depositoOrigemId"
            control={control}
            render={({ field }) => (
              <Select
                label="Tanque de Origem"
                id="depositoOrigemId"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
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
            )}
          />
          {errors.depositoOrigemId && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.depositoOrigemId.message}</p>
          )}
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
                {estoqueOrigemNaData.toFixed(0)} L disponíveis{dataHora ? ' na data' : ''}
              </span>
            </div>
          )}
          {depositoOrigem && (
            <div className="mt-1.5 text-xs text-gray-700">
              Combustível:{' '}
              {combustivelOrigemNome ? (
                <strong>{combustivelOrigemNome}</strong>
              ) : (
                <span className="text-gray-400 italic">indisponível (tanque sem fonte rastreável)</span>
              )}
            </div>
          )}
        </div>

        <div>
          <Controller
            name="depositoDestinoId"
            control={control}
            render={({ field }) => (
              <Select
                label="Tanque de Destino"
                id="depositoDestinoId"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                options={depositosDestino.map((d) => ({
                  value: d.id,
                  label: `${d.nome} (${d.nivelAtualLitros.toFixed(0)}/${d.capacidadeLitros.toFixed(0)} L)`,
                }))}
                placeholder={
                  !depositoOrigemId
                    ? 'Selecione a origem primeiro'
                    : depositosDestino.length === 0
                      ? 'Nenhum outro tanque disponível'
                      : 'Selecione o tanque de destino'
                }
                disabled={!depositoOrigemId}
                required
              />
            )}
          />
          {errors.depositoDestinoId && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.depositoDestinoId.message}</p>
          )}
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
                {espacoDestino.toFixed(0)} L de espaço{dataHora ? ' na data' : ''}
              </span>
            </div>
          )}
          {conflitoCombustivelDestino && (
            <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
              Combustíveis incompatíveis. Origem tem{' '}
              <strong>
                {allInsumos.find((c) => c.id === conflitoCombustivelDestino.origem)?.nome ??
                  conflitoCombustivelDestino.origem}
              </strong>{' '}
              e destino tem{' '}
              <strong>
                {allInsumos.find((c) => c.id === conflitoCombustivelDestino.destino)?.nome ??
                  conflitoCombustivelDestino.destino}
              </strong>
              . Esvazie o destino antes ou escolha outro tanque.
            </div>
          )}
        </div>

        <div>
          <label htmlFor="quantidadeLitrosTransf" className="block text-sm font-medium text-gray-700 mb-1">
            Quantidade (litros)
          </label>
          <input
            id="quantidadeLitrosTransf"
            type="number"
            step="0.0001"
            min="0"
            {...register('quantidadeLitros', { valueAsNumber: true })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
          {errors.quantidadeLitros && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.quantidadeLitros.message}</p>
          )}
          {semEstoqueOrigem && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">
              Estoque insuficiente ({estoqueOrigemNaData.toFixed(0)} L disponíveis{dataHora ? ' na data' : ''})
            </p>
          )}
          {semEspacoDestino && !semEstoqueOrigem && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">
              Espaço insuficiente no destino ({espacoDestino.toFixed(0)} L de espaço{dataHora ? ' na data' : ''})
            </p>
          )}
        </div>

        <div>
          <label htmlFor="valorTotalTransf" className="block text-sm font-medium text-gray-700 mb-1">
            Valor Total (R$)
          </label>
          <input
            id="valorTotalTransf"
            type="number"
            step="0.0001"
            min="0"
            {...register('valorTotal', { valueAsNumber: true })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
          {errors.valorTotal && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.valorTotal.message}</p>
          )}
          {precoMedio > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preço médio do tanque origem: R$ {precoMedio.toFixed(4)}/L
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="observacoesTransf"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="observacoesTransf"
          {...register('observacoes')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          placeholder="Alguma observação sobre a transferência..."
        />
      </div>

      {/* F9 — Anexos: foto do nível antes/depois, comprovante de transferência */}
      <AnexosUploader
        fotoUrls={fotoUrls}
        arquivoUrls={arquivoUrls}
        onChangeFotos={setFotoUrls}
        onChangeArquivos={setArquivoUrls}
        pastaId={`transferencia/${pastaId}`}
      />

      {erro && (
        <p className="text-sm text-[var(--color-danger)]">{erro}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid || submitting || !canAct}>
          {submitting ? 'Salvando…' : 'Registrar Transferência'}
        </Button>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Transferências de Combustível do Excel"
        entityLabel="Transferência"
        genderFem={true}
        templateData={TRANSF_TEMPLATE}
        templateFileName="template_transferencias_combustivel.xlsx"
        sheetName="Transferências"
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
