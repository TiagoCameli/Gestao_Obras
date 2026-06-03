/**
 * FreteForm — Onda 4.A: migrado pra react-hook-form + Zod.
 *
 * Estado do componente:
 *  - RHF gerencia os campos do schema (src/schemas/frete/frete.schema.ts).
 *  - AnexosUploader (fotos + arquivos) fica em useState fora do RHF (uploads
 *    são assíncronos via Storage; URLs entram no payload no submit).
 *  - Inline "nova localidade" também em useState (mini-form local com mutation
 *    própria; setValue() do RHF atualiza o select origem/destino ao salvar).
 *  - ImportExcelModal preservado tal como antes.
 *
 * Comportamento preservado:
 *  - Auto-fill de dataChegada quando 1ª foto é enviada (se ainda vazio)
 *  - Reset do form quando `initial` muda (modo edit pra novo edit)
 *  - Cálculos derivados (valorTotal = peso × km × tkm; valorMaterial = unit × peso)
 *  - Bloqueio de submit por permissão (canAct) + isValid
 */
import { useCallback, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Frete, Obra, Insumo, Localidade } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import SubmitButton from '../ui/SubmitButton';
import { useAdicionarLocalidade } from '../../hooks/useLocalidades';
import ImportExcelModal, { parseStr, parseNumero, parseData, type ParsedRow } from '../ui/ImportExcelModal';
import AnexosUploader from '../combustivel/AnexosUploader';
import { useAuth } from '../../contexts/AuthContext';
import { freteFormSchema, type FreteFormValues } from '../../schemas/frete/frete.schema';

interface FreteFormProps {
  initial?: Frete | null;
  onSubmit: (data: Frete) => void | Promise<void>;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  localidades: Localidade[];
  transportadoras: string[];
  onImportBatch?: (items: Frete[]) => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const FRETE_TEMPLATE = [
  ['Data Saída', 'Data Chegada', 'Origem', 'Destino', 'Transportadora', 'Motorista', 'Material', 'Peso (t)', 'KM', 'R$/TKM', 'Obra', 'NF', 'Placa Carreta', 'Observações'],
  ['2024-01-15', '2024-01-16', 'Sao Paulo', 'Campinas', 'Transportes ABC', 'Joao Silva', 'Brita', '25', '100', '0.15', 'Obra XYZ', 'NF-001', 'ABC-1234', ''],
];

/** Default values derivados do `initial` (modo edit) ou vazios (criação). */
function buildDefaults(initial: Frete | null | undefined): FreteFormValues {
  return {
    data: initial?.data || '',
    dataChegada: initial?.dataChegada || '',
    obraId: initial?.obraId || '',
    origem: initial?.origem || '',
    destino: initial?.destino || '',
    transportadora: initial?.transportadora || '',
    motorista: initial?.motorista || '',
    insumoId: initial?.insumoId || '',
    pesoToneladas: initial?.pesoToneladas ?? (undefined as unknown as number),
    kmRodados: initial?.kmRodados ?? (undefined as unknown as number),
    valorTkm: initial?.valorTkm ?? (undefined as unknown as number),
    valorUnitarioMaterial:
      initial?.valorMaterial && initial?.pesoToneladas
        ? initial.valorMaterial / initial.pesoToneladas
        : undefined,
    notaFiscal: initial?.notaFiscal || '',
    notaFiscal2: initial?.notaFiscal2 || '',
    placaCarreta: initial?.placaCarreta || '',
    observacoes: initial?.observacoes || '',
  };
}

export default function FreteForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  insumos,
  localidades,
  transportadoras,
  onImportBatch,
}: FreteFormProps) {
  // ── Anexos (fora do RHF; uploads são assíncronos) ────────────────────────
  const [fotosFrete, setFotosFrete] = useState<string[]>(() => {
    const all: string[] = [];
    if (initial?.fotoChegadaUrl) all.push(initial.fotoChegadaUrl);
    if (initial?.fotoUrls) all.push(...initial.fotoUrls);
    return all;
  });
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);

  // ── Inline "nova localidade" (mini-forms fora do RHF) ────────────────────
  const [listaLocalidades, setListaLocalidades] = useState<Localidade[]>(localidades);
  const [novaOrigemAberta, setNovaOrigemAberta] = useState(false);
  const [novaOrigemNome, setNovaOrigemNome] = useState('');
  const [novaDestinoAberta, setNovaDestinoAberta] = useState(false);
  const [novaDestinoNome, setNovaDestinoNome] = useState('');
  const adicionarLocalidadeMutation = useAdicionarLocalidade();

  // ── Import Excel ─────────────────────────────────────────────────────────
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // ── react-hook-form + Zod ────────────────────────────────────────────────
  const {
    register,
    control,
    handleSubmit: rhfHandleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<FreteFormValues>({
    resolver: zodResolver(freteFormSchema),
    mode: 'onChange',
    defaultValues: buildDefaults(initial),
  });

  // Reset quando initial muda (e.g. trocar de "novo" pra "editar")
  useEffect(() => {
    reset(buildDefaults(initial));
  }, [initial, reset]);

  // Sync de localidades quando a prop muda (mutation invalidation no caller)
  useEffect(() => {
    setListaLocalidades(localidades);
  }, [localidades]);

  const localidadesAtivas = listaLocalidades.filter((l) => l.ativo !== false);

  // ── Auto-fill dataChegada na 1ª foto ─────────────────────────────────────
  function handleFotosFreteChange(novas: string[]) {
    if (fotosFrete.length === 0 && novas.length > 0 && !watch('dataChegada')) {
      setValue('dataChegada', new Date().toISOString().slice(0, 10), { shouldValidate: true });
    }
    setFotosFrete(novas);
  }

  // ── Cálculos derivados ───────────────────────────────────────────────────
  const pesoWatch = watch('pesoToneladas');
  const kmWatch = watch('kmRodados');
  const tkmWatch = watch('valorTkm');
  const valorUnitMatWatch = watch('valorUnitarioMaterial');
  const peso = Number.isFinite(pesoWatch) ? (pesoWatch as number) : 0;
  const km = Number.isFinite(kmWatch) ? (kmWatch as number) : 0;
  const tkm = Number.isFinite(tkmWatch) ? (tkmWatch as number) : 0;
  const valorUnitMat = Number.isFinite(valorUnitMatWatch) ? (valorUnitMatWatch as number) : 0;
  const valorTotal = peso * km * tkm;
  const valorMaterial = peso * valorUnitMat;

  // ── Submit ───────────────────────────────────────────────────────────────
  const { temAcao } = useAuth();
  const canAct = initial ? temAcao('editar_frete') : temAcao('criar_frete');

  const onValidSubmit = useCallback(async (values: FreteFormValues) => {
    if (!canAct) return;
    const payload: Frete = {
      id: initial?.id || gerarId(),
      data: values.data,
      dataChegada: values.dataChegada || '',
      obraId: values.obraId,
      origem: values.origem,
      destino: values.destino,
      transportadora: values.transportadora,
      insumoId: values.insumoId,
      pesoToneladas: values.pesoToneladas,
      kmRodados: values.kmRodados,
      valorTkm: values.valorTkm,
      valorTotal: values.pesoToneladas * values.kmRodados * values.valorTkm,
      valorMaterial: (values.valorUnitarioMaterial ?? 0) * values.pesoToneladas,
      notaFiscal: values.notaFiscal || '',
      notaFiscal2: values.notaFiscal2 || '',
      placaCarreta: values.placaCarreta || '',
      motorista: values.motorista,
      observacoes: values.observacoes || '',
      criadoPor: initial?.criadoPor || '',
      fotoChegadaUrl: fotosFrete[0] ?? null,
      fotoUrls: fotosFrete.slice(1),
      arquivoUrls,
    };
    await onSubmit(payload);
  }, [canAct, initial, fotosFrete, arquivoUrls, onSubmit]);

  // ── Import Excel parser/mapper (preservados como antes) ──────────────────
  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const data = parseData(row[0]);
      const dataChegada = parseData(row[1]);
      const origem = parseStr(row[2]);
      const destino = parseStr(row[3]);
      const transportadora = parseStr(row[4]);
      const motorista = parseStr(row[5]);
      const materialNome = parseStr(row[6]);
      const peso = parseNumero(row[7]);
      const km = parseNumero(row[8]);
      const tkm = parseNumero(row[9]);
      const obraNome = parseStr(row[10]);
      const notaFiscal = parseStr(row[11]);
      const placaCarreta = parseStr(row[12]);
      const observacoes = parseStr(row[13]);

      if (!data) erros.push('Falta data');
      if (!origem) erros.push('Falta origem');
      if (!destino) erros.push('Falta destino');
      if (!transportadora) erros.push('Falta transportadora');
      if (!motorista) erros.push('Falta motorista');

      let insumoId = '';
      if (!materialNome) {
        erros.push('Falta material');
      } else {
        const found = insumos.find((i) => i.nome.toLowerCase() === materialNome.toLowerCase());
        if (found) {
          insumoId = found.id;
        } else {
          erros.push(`Material "${materialNome}" nao encontrado`);
        }
      }

      if (peso === null) erros.push('Falta peso');
      if (km === null) erros.push('Falta KM');
      if (tkm === null) erros.push('Falta R$/TKM');

      let obraId = '';
      if (obraNome) {
        const found = obras.find((o) => o.nome.toLowerCase() === obraNome.toLowerCase());
        if (found) obraId = found.id;
      }

      const resumo = `${data || '?'} | ${origem || '?'} -> ${destino || '?'} | ${transportadora || '?'} | ${motorista || '?'} | ${materialNome || '?'}`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, dataChegada, origem, destino, transportadora, motorista, insumoId, peso: peso ?? 0, km: km ?? 0, tkm: tkm ?? 0, obraId, notaFiscal, placaCarreta, observacoes },
      };
    },
    [insumos, obras],
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    const peso = d.peso as number;
    const km = d.km as number;
    const tkm = d.tkm as number;
    return {
      id: gerarId(),
      data: d.data,
      dataChegada: d.dataChegada || '',
      obraId: d.obraId,
      origem: d.origem,
      destino: d.destino,
      transportadora: d.transportadora,
      insumoId: d.insumoId,
      pesoToneladas: peso,
      kmRodados: km,
      valorTkm: tkm,
      valorTotal: peso * km * tkm,
      valorMaterial: 0,
      notaFiscal: d.notaFiscal,
      notaFiscal2: '',
      placaCarreta: d.placaCarreta,
      motorista: d.motorista,
      observacoes: d.observacoes,
      criadoPor: '',
    };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as Frete[]);
        setToastMsg(`${items.length} frete${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch],
  );

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
          label="Data de Saída"
          id="freteData"
          type="date"
          required
          error={errors.data?.message}
          {...register('data')}
        />
        <Controller
          name="obraId"
          control={control}
          render={({ field }) => (
            <Select
              label="Obra (opcional)"
              id="freteObraId"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              options={obras.map((o) => ({ value: o.id, label: o.nome }))}
              placeholder="Selecione a obra"
              error={errors.obraId?.message}
            />
          )}
        />

        {/* Origem */}
        <div>
          <Controller
            name="origem"
            control={control}
            render={({ field }) => (
              <Select
                label="Origem"
                id="freteOrigem"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                options={localidadesAtivas.map((l) => ({ value: l.nome, label: l.nome }))}
                placeholder="Selecione a origem"
                required
                error={errors.origem?.message}
              />
            )}
          />
          {!novaOrigemAberta ? (
            <button
              type="button"
              className="mt-1 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium"
              onClick={() => setNovaOrigemAberta(true)}
            >
              + Nova Localidade
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  placeholder="Nome da localidade"
                  value={novaOrigemNome}
                  onChange={(e) => setNovaOrigemNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novaOrigemNome.trim()}
                  onClick={() => {
                    const nova: Localidade = {
                      id: gerarId(),
                      nome: novaOrigemNome.trim(),
                      endereco: '',
                      ativo: true,
                      criadoPor: '',
                    };
                    adicionarLocalidadeMutation.mutate(nova);
                    setListaLocalidades((prev) => [...prev, nova]);
                    setValue('origem', nova.nome, { shouldValidate: true });
                    setNovaOrigemNome('');
                    setNovaOrigemAberta(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  onClick={() => {
                    setNovaOrigemAberta(false);
                    setNovaOrigemNome('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Destino */}
        <div>
          <Controller
            name="destino"
            control={control}
            render={({ field }) => (
              <Select
                label="Destino"
                id="freteDestino"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                options={localidadesAtivas.map((l) => ({ value: l.nome, label: l.nome }))}
                placeholder="Selecione o destino"
                required
                error={errors.destino?.message}
              />
            )}
          />
          {!novaDestinoAberta ? (
            <button
              type="button"
              className="mt-1 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium"
              onClick={() => setNovaDestinoAberta(true)}
            >
              + Nova Localidade
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  placeholder="Nome da localidade"
                  value={novaDestinoNome}
                  onChange={(e) => setNovaDestinoNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novaDestinoNome.trim()}
                  onClick={() => {
                    const nova: Localidade = {
                      id: gerarId(),
                      nome: novaDestinoNome.trim(),
                      endereco: '',
                      ativo: true,
                      criadoPor: '',
                    };
                    adicionarLocalidadeMutation.mutate(nova);
                    setListaLocalidades((prev) => [...prev, nova]);
                    setValue('destino', nova.nome, { shouldValidate: true });
                    setNovaDestinoNome('');
                    setNovaDestinoAberta(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  onClick={() => {
                    setNovaDestinoAberta(false);
                    setNovaDestinoNome('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <Controller
          name="transportadora"
          control={control}
          render={({ field }) => (
            <Select
              label="Transportadora"
              id="freteTransportadora"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              options={transportadoras.map((t) => ({ value: t, label: t }))}
              placeholder="Selecione a transportadora"
              required
              error={errors.transportadora?.message}
            />
          )}
        />
        <Input
          label="Motorista"
          id="freteMotorista"
          type="text"
          placeholder="Nome do motorista"
          required
          error={errors.motorista?.message}
          {...register('motorista')}
        />
        <Controller
          name="insumoId"
          control={control}
          render={({ field }) => (
            <Select
              label="Material Transportado"
              id="freteInsumoId"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              options={insumos.map((i) => ({ value: i.id, label: i.nome }))}
              placeholder="Selecione o material"
              required
              error={errors.insumoId?.message}
            />
          )}
        />
        <Input
          label="Peso (toneladas)"
          id="fretePeso"
          type="number"
          step="0.0001"
          min="0"
          required
          error={errors.pesoToneladas?.message}
          {...register('pesoToneladas', { valueAsNumber: true })}
        />
        <Input
          label="KM Rodados"
          id="freteKm"
          type="number"
          step="0.0001"
          min="0"
          required
          error={errors.kmRodados?.message}
          {...register('kmRodados', { valueAsNumber: true })}
        />
        <Input
          label="Valor por T×KM (R$)"
          id="freteValorTkm"
          type="number"
          step="0.0001"
          min="0"
          required
          error={errors.valorTkm?.message}
          {...register('valorTkm', { valueAsNumber: true })}
        />
        <div>
          <label className="block text-sm font-medium text-[var(--color-fg)] mb-1">
            Valor Total (R$)
          </label>
          <div className="w-full border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-accent)] tabular-nums font-mono">
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">KM × Peso × R$/TKM</p>
        </div>
        <Input
          label="Valor Unitário do Material (R$)"
          id="freteValorUnitMaterial"
          type="number"
          step="0.0001"
          min="0"
          placeholder="Ex: 45.0000"
          error={errors.valorUnitarioMaterial?.message}
          {...register('valorUnitarioMaterial', { valueAsNumber: true })}
        />
        <div>
          <label className="block text-sm font-medium text-[var(--color-fg)] mb-1">
            Preço do Material (R$)
          </label>
          <div className="w-full border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-accent)] tabular-nums font-mono">
            {valorMaterial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">Valor Unitário × Peso</p>
        </div>
        <Input
          label="Nota Fiscal (opcional)"
          id="freteNF"
          type="text"
          placeholder="Ex: NF-e 12345"
          error={errors.notaFiscal?.message}
          {...register('notaFiscal')}
        />
        <Input
          label="Nota Fiscal 2 (opcional)"
          id="freteNF2"
          type="text"
          placeholder="Ex: NF-e 67890"
          error={errors.notaFiscal2?.message}
          {...register('notaFiscal2')}
        />
        <Input
          label="Placa da Carreta (opcional)"
          id="fretePlacaCarreta"
          type="text"
          placeholder="Ex: ABC-1D34"
          className="uppercase font-mono"
          error={errors.placaCarreta?.message}
          {...register('placaCarreta')}
        />
      </div>
      <div>
        <label
          htmlFor="freteObs"
          className="block text-sm font-medium text-[var(--color-fg)] mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="freteObs"
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          rows={3}
          placeholder="Alguma observação..."
          {...register('observacoes')}
        />
        {errors.observacoes && (
          <p className="text-xs text-[var(--color-danger)] mt-1">{errors.observacoes.message}</p>
        )}
      </div>
      {/* Bloco único de fotos: 1ª = foto principal de chegada; demais vão pra fotoUrls.
          Limite 8 (controlado pelo AnexosUploader). */}
      <div className="rounded-lg border-2 border-dashed border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent-fg)] text-xs font-bold">📦</span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Fotos da Chegada da Carga</h3>
            <p className="text-xs text-[var(--color-fg-muted)]">Até 8 fotos. GPS + horário gravados ao usar "Tirar foto".</p>
          </div>
        </div>
        <AnexosUploader
          fotoUrls={fotosFrete}
          arquivoUrls={[]}
          onChangeFotos={handleFotosFreteChange}
          onChangeArquivos={() => {}}
          pastaId={`frete-chegada/${initial?.id ?? 'novo'}`}
          hideArquivos
        />
      </div>

      {/* Arquivos do frete (NF, comprovantes, planilhas) — separado das fotos. */}
      <AnexosUploader
        fotoUrls={[]}
        arquivoUrls={arquivoUrls}
        onChangeFotos={() => {}}
        onChangeArquivos={setArquivoUrls}
        pastaId={`frete/${initial?.id ?? 'novo'}`}
        hideFotos
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton loading={isSubmitting} disabled={!isValid || !canAct}>
          {initial ? 'Salvar Alterações' : 'Registrar Frete'}
        </SubmitButton>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Fretes do Excel"
        entityLabel="Frete"
        genderFem={false}
        templateData={FRETE_TEMPLATE}
        templateFileName="template_fretes.xlsx"
        sheetName="Fretes"
        templateColWidths={[12, 12, 15, 15, 20, 18, 15, 10, 8, 10, 15, 10, 12, 15]}
        formatHintHeaders={['Saída', 'Chegada', 'Origem', 'Destino', 'Transp.', 'Motorista', 'Material', 'Peso(t)', 'KM', 'R$/TKM', 'Obra', 'NF', 'Placa', 'Obs']}
        formatHintExample={['2024-01-15', '2024-01-16', 'S.Paulo', 'Campinas', 'ABC', 'Joao', 'Brita', '25', '100', '0.15', 'Obra X', '', 'ABC-1234', '']}
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
