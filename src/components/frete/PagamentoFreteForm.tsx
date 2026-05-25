/**
 * PagamentoFreteForm — Onda 4.B: migrado pra react-hook-form + Zod.
 *
 * Complexidade adicional vs FreteForm:
 *  - Toggle "dividir entre meses": muda o form pra um array de parcelas
 *    em vez de mes+valor único. Parcelas gerenciadas em useState fora do
 *    RHF (não vale a pena useFieldArray pra esse caso simples).
 *  - PagoPorCombobox: combobox custom com busca. Controller do RHF
 *    sincroniza o valor.
 *  - Método 'combustivel' habilita campo extra quantidadeCombustivel
 *    (refine no schema garante > 0 nesse caso).
 *  - Schema deixa mesReferencia/valor opcionais; submit handler usa
 *    parcelas em vez deles quando dividir=true.
 */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { PagamentoFrete, MetodoPagamentoFrete, Funcionario, Fornecedor } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import SmartSelect from '../ui/SmartSelect';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, parseData, type ParsedRow } from '../ui/ImportExcelModal';
import AnexosUploader from '../combustivel/AnexosUploader';
import { useAuth } from '../../contexts/AuthContext';
import {
  pagamentoFreteFormSchema,
  type PagamentoFreteFormValues,
} from '../../schemas/frete/pagamentoFrete.schema';

function PagoPorCombobox({ id, opcoes, value, onChange }: {
  id: string;
  opcoes: { nome: string; tipo: string }[];
  value: string;
  onChange: (nome: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtrados = opcoes.filter((o) =>
    o.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        type="text"
        className="w-full h-[38px] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        placeholder="Buscar por nome..."
        value={aberto ? busca : value}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); setBusca(''); }}
        autoComplete="off"
      />
      {aberto && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-md)]">
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--color-fg-subtle)]">Nenhum resultado</li>
          ) : (
            filtrados.map((o, i) => (
              <li
                key={`${o.nome}-${i}`}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-accent-soft)] ${o.nome === value ? 'bg-[var(--color-accent-soft)] font-medium' : ''}`}
                onMouseDown={() => { onChange(o.nome); setAberto(false); setBusca(''); }}
              >
                {o.nome} <span className="text-[var(--color-fg-subtle)] text-xs">({o.tipo})</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function gerarMeses(): { value: string; label: string }[] {
  const hoje = new Date();
  const meses: { value: string; label: string }[] = [];
  const nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  for (let offset = -24; offset <= 6; offset++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${nomesMes[d.getMonth()]} ${d.getFullYear()}`;
    meses.push({ value: valor, label });
  }
  return meses;
}

interface PagamentoFreteFormProps {
  initial?: PagamentoFrete | null;
  onSubmit: (data: PagamentoFrete) => void;
  onSubmitBatch?: (data: PagamentoFrete[]) => void;
  onCancel: () => void;
  transportadoras: string[];
  funcionarios: Funcionario[];
  fornecedores: Fornecedor[];
  nomeUsuario?: string;
  onImportBatch?: (items: PagamentoFrete[]) => void;
}

const METODOS: { value: MetodoPagamentoFrete; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'combustivel', label: 'Combustível' },
];

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const PAGFRETE_TEMPLATE = [
  ['Data', 'Transportadora', 'Mês Referência', 'Valor', 'Método', 'Responsavel', 'NF', 'Pago Por', 'Observações'],
  ['2024-01-15', 'Transportes ABC', '2024-01', '5000', 'pix', 'Carlos Silva', 'NF-001', 'Maria Santos', ''],
];

const METODOS_VALIDOS = ['pix', 'boleto', 'cheque', 'dinheiro', 'transferencia', 'combustivel'];

function buildDefaults(initial: PagamentoFrete | null | undefined, nomeUsuario?: string): PagamentoFreteFormValues {
  return {
    data: initial?.data || '',
    transportadora: initial?.transportadora || '',
    mesReferencia: initial?.mesReferencia || '',
    valor: initial?.valor ?? undefined,
    metodo: initial?.metodo || 'pix',
    quantidadeCombustivel: initial?.quantidadeCombustivel ?? undefined,
    responsavel: initial?.responsavel || nomeUsuario || '',
    notaFiscal: initial?.notaFiscal || '',
    pagoPor: initial?.pagoPor || '',
    observacoes: initial?.observacoes || '',
  };
}

export default function PagamentoFreteForm({
  initial,
  onSubmit,
  onSubmitBatch,
  onCancel,
  transportadoras,
  funcionarios,
  fornecedores,
  nomeUsuario,
  onImportBatch,
}: PagamentoFreteFormProps) {
  const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);

  const [dividir, setDividir] = useState(false);
  const [parcelas, setParcelas] = useState<{ mesReferencia: string; valor: string }[]>([
    { mesReferencia: '', valor: '' },
    { mesReferencia: '', valor: '' },
  ]);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    reset,
    control,
    formState: { errors, isValid: rhfIsValid },
  } = useForm<PagamentoFreteFormValues>({
    resolver: zodResolver(pagamentoFreteFormSchema),
    mode: 'onChange',
    defaultValues: buildDefaults(initial, nomeUsuario),
  });

  useEffect(() => {
    reset(buildDefaults(initial, nomeUsuario));
  }, [initial, nomeUsuario, reset]);

  const metodoWatch = watch('metodo');

  const { temAcao } = useAuth();
  const canPagar = initial
    ? temAcao('editar_pagamento_frete')
    : temAcao('criar_pagamento_frete');

  const onValidSubmit = useCallback((values: PagamentoFreteFormValues) => {
    if (!canPagar) return;
    if (dividir && !initial && onSubmitBatch) {
      const items: PagamentoFrete[] = parcelas.map((p) => ({
        id: gerarId(),
        data: values.data,
        transportadora: values.transportadora,
        mesReferencia: p.mesReferencia,
        valor: parseFloat(p.valor) || 0,
        metodo: values.metodo,
        quantidadeCombustivel: values.metodo === 'combustivel' ? (values.quantidadeCombustivel ?? 0) : 0,
        responsavel: values.responsavel,
        notaFiscal: values.notaFiscal || '',
        pagoPor: values.pagoPor,
        observacoes: values.observacoes || '',
        criadoPor: '',
        fotoUrls,
        arquivoUrls,
      }));
      onSubmitBatch(items);
    } else {
      onSubmit({
        id: initial?.id || gerarId(),
        data: values.data,
        transportadora: values.transportadora,
        mesReferencia: values.mesReferencia || '',
        valor: values.valor ?? 0,
        metodo: values.metodo,
        quantidadeCombustivel: values.metodo === 'combustivel' ? (values.quantidadeCombustivel ?? 0) : 0,
        responsavel: values.responsavel,
        notaFiscal: values.notaFiscal || '',
        pagoPor: values.pagoPor,
        observacoes: values.observacoes || '',
        criadoPor: initial?.criadoPor || '',
        fotoUrls,
        arquivoUrls,
      });
    }
  }, [canPagar, dividir, initial, parcelas, fotoUrls, arquivoUrls, onSubmit, onSubmitBatch]);

  // ── Import Excel parser/mapper ───────────────────────────────────────────
  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const data = parseData(row[0]);
      const transportadora = parseStr(row[1]);
      const mesReferencia = parseStr(row[2]);
      const valor = parseNumero(row[3]);
      const metodoRaw = parseStr(row[4]).toLowerCase() || 'pix';
      const responsavel = parseStr(row[5]);
      const notaFiscal = parseStr(row[6]);
      const pagoPor = parseStr(row[7]);
      const observacoes = parseStr(row[8]);

      if (!data) erros.push('Falta data');
      if (!transportadora) erros.push('Falta transportadora');
      if (!mesReferencia) erros.push('Falta mes referencia');
      if (valor === null) erros.push('Falta valor');
      if (!METODOS_VALIDOS.includes(metodoRaw)) erros.push(`Metodo "${metodoRaw}" invalido`);
      if (!responsavel) erros.push('Falta responsavel');

      const resumo = `${data || '?'} | ${transportadora || '?'} | ${mesReferencia || '?'} | R$ ${valor ?? '?'}`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, transportadora, mesReferencia, valor: valor ?? 0, metodo: metodoRaw, responsavel, notaFiscal, pagoPor, observacoes },
      };
    },
    [],
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      data: d.data,
      transportadora: d.transportadora,
      mesReferencia: d.mesReferencia,
      valor: d.valor,
      metodo: d.metodo,
      quantidadeCombustivel: 0,
      responsavel: d.responsavel,
      notaFiscal: d.notaFiscal,
      pagoPor: d.pagoPor,
      observacoes: d.observacoes,
      criadoPor: '',
    };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as PagamentoFrete[]);
        setToastMsg(`${items.length} pagamento${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch],
  );

  const funcionariosAtivos = funcionarios.filter((f) => f.status === 'ativo');
  const mesesOptions = useMemo(() => gerarMeses(), []);
  const pagoPorOpcoes = useMemo(() => {
    const lista: { nome: string; tipo: string }[] = [
      { nome: 'EMT Construtora', tipo: 'Empresa' },
    ];
    for (const f of fornecedores.filter((f) => f.ativo)) {
      lista.push({ nome: f.nome, tipo: 'Fornecedor' });
    }
    for (const f of funcionariosAtivos) {
      lista.push({ nome: f.nome, tipo: 'Funcionário' });
    }
    return lista;
  }, [fornecedores, funcionariosAtivos]);

  const parcelasValidas = dividir && !initial
    ? parcelas.length >= 2 && parcelas.every((p) => p.mesReferencia && p.valor && parseFloat(p.valor) > 0)
    : true;

  const isValid = canPagar && rhfIsValid && parcelasValidas;

  return (
    <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data do Pagamento"
          id="pagFreteData"
          type="date"
          required
          error={errors.data?.message}
          {...register('data')}
        />
        <Select
          label="Transportadora"
          id="pagFreteTransportadora"
          options={transportadoras.map((t) => ({ value: t, label: t }))}
          placeholder="Selecione a transportadora"
          required
          error={errors.transportadora?.message}
          {...register('transportadora')}
        />
        {!(dividir && !initial) && (
          <>
            <Select
              label="Mês Referência"
              id="pagFreteMesRef"
              options={mesesOptions}
              placeholder="Selecione o mês"
              required
              error={errors.mesReferencia?.message}
              {...register('mesReferencia')}
            />
            <Input
              label="Valor (R$)"
              id="pagFreteValor"
              type="number"
              step="0.0001"
              min="0"
              required
              error={errors.valor?.message}
              {...register('valor', { valueAsNumber: true })}
            />
          </>
        )}
        <Select
          label="Método de Pagamento"
          id="pagFreteMetodo"
          options={METODOS}
          required
          error={errors.metodo?.message}
          {...register('metodo')}
        />
        {metodoWatch === 'combustivel' && (
          <Input
            label="Quantidade Combustível (litros)"
            id="pagFreteQtdCombustivel"
            type="number"
            step="0.0001"
            min="0"
            required
            error={errors.quantidadeCombustivel?.message}
            {...register('quantidadeCombustivel', { valueAsNumber: true })}
          />
        )}
        <Input
          label="Responsável"
          id="pagFreteResponsavel"
          required
          readOnly
          error={errors.responsavel?.message}
          {...register('responsavel')}
        />
        <Input
          label="Nota Fiscal (opcional)"
          id="pagFreteNF"
          type="text"
          placeholder="Ex: NF-e 12345"
          error={errors.notaFiscal?.message}
          {...register('notaFiscal')}
        />
        <div>
          <label htmlFor="pagFretePagoPor" className="block text-sm font-medium text-[var(--color-fg)] mb-1">Pago Por</label>
          <Controller
            control={control}
            name="pagoPor"
            render={({ field }) => (
              <PagoPorCombobox
                id="pagFretePagoPor"
                opcoes={pagoPorOpcoes}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            )}
          />
          {errors.pagoPor && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.pagoPor.message}</p>
          )}
        </div>
      </div>

      {/* Toggle dividir entre meses — só para novo pagamento */}
      {!initial && onSubmitBatch && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dividir}
              onChange={(e) => setDividir(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus:ring-[var(--color-ring)]"
            />
            <span className="text-sm font-medium text-[var(--color-fg)]">Dividir entre meses</span>
          </label>

          {dividir && (
            <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3 bg-[var(--color-surface-2)]/40">
              <p className="text-xs text-[var(--color-fg-muted)]">Adicione o mês e valor de cada parcela:</p>
              {parcelas.map((parcela, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    {idx === 0 && (
                      <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">Mês Referência</label>
                    )}
                    <SmartSelect
                      className="w-full h-[38px] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] bg-[var(--color-surface-1)] flex items-center"
                      value={parcela.mesReferencia}
                      onChange={(e) => {
                        const novas = [...parcelas];
                        novas[idx] = { ...novas[idx], mesReferencia: e.target.value };
                        setParcelas(novas);
                      }}
                      required
                    >
                      <option value="">Selecione o mês</option>
                      {mesesOptions.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </SmartSelect>
                  </div>
                  <div className="w-36">
                    {idx === 0 && (
                      <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">Valor (R$)</label>
                    )}
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="w-full h-[38px] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                      placeholder="0,00"
                      value={parcela.valor}
                      onChange={(e) => {
                        const novas = [...parcelas];
                        novas[idx] = { ...novas[idx], valor: e.target.value };
                        setParcelas(novas);
                      }}
                      required
                    />
                  </div>
                  {parcelas.length > 2 && (
                    <button
                      type="button"
                      className="h-[38px] px-2 text-[var(--color-danger)] hover:opacity-80 text-lg font-bold"
                      title="Remover parcela"
                      onClick={() => setParcelas(parcelas.filter((_, i) => i !== idx))}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium"
                  onClick={() => setParcelas([...parcelas, { mesReferencia: '', valor: '' }])}
                >
                  + Adicionar mês
                </button>
                <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
                  Total: {parcelas.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="pagFreteObs" className="block text-sm font-medium text-[var(--color-fg)] mb-1">
          Observações (opcional)
        </label>
        <textarea
          id="pagFreteObs"
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          rows={3}
          placeholder="Alguma observação..."
          {...register('observacoes')}
        />
        {errors.observacoes && (
          <p className="text-xs text-[var(--color-danger)] mt-1">{errors.observacoes.message}</p>
        )}
      </div>

      {/* FF.3 — Anexos universais (comprovantes de pagamento). */}
      <AnexosUploader
        fotoUrls={fotoUrls}
        arquivoUrls={arquivoUrls}
        onChangeFotos={setFotoUrls}
        onChangeArquivos={setArquivoUrls}
        pastaId={`pagamento-frete/${initial?.id ?? 'novo'}`}
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Registrar Pagamento'}
        </Button>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Pagamentos de Frete do Excel"
        entityLabel="Pagamento"
        genderFem={false}
        templateData={PAGFRETE_TEMPLATE}
        templateFileName="template_pagamentos_frete.xlsx"
        sheetName="Pagamentos"
        templateColWidths={[12, 20, 14, 12, 14, 20, 10, 18, 15]}
        formatHintHeaders={['Data', 'Transportadora', 'Mês Ref', 'Valor', 'Método', 'Responsavel', 'NF', 'Pago Por', 'Obs']}
        formatHintExample={['2024-01-15', 'ABC', '2024-01', '5000', 'pix', 'Carlos', '', 'Maria', '']}
        parseRow={parseRow}
        toEntity={toEntity}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[var(--z-toast)] bg-[var(--color-success)] text-white px-5 py-3 rounded-lg shadow-[var(--shadow-lg)] text-sm font-medium animate-[fadeIn_0.2s_ease-out]">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
