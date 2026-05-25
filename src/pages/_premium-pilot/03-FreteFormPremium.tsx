/**
 * PILOT 03 — Formulário de Frete (Premium)
 * -----------------------------------------
 * Refatora `src/components/frete/FreteForm.tsx` (614 LOC).
 *
 * Melhorias visíveis vs versão atual:
 *  1. React Hook Form + Zod (validação inline real, não só "desabilita botão")
 *  2. Campos agrupados em <fieldset> semânticos com eyebrow labels:
 *     Trecho · Carga · Valores · Documentos · Anexos
 *  3. hairline-divider entre grupos (em vez de só space)
 *  4. Erros inline com aria-invalid + aria-describedby + animação slide-in
 *  5. Footer sticky com primary action (sempre visível, gradiente sutil)
 *  6. Valores calculados como chips (`R$ 12.345,00`) — não input desabilitado feio
 *  7. Inputs com focus ring premium (140ms ease-out)
 *  8. Sem classes hardcoded text-gray-* ou text-emt-verde — tudo token
 *  9. Bloco de fotos com .surface-sunken (deprime sutilmente do form)
 * 10. Bilngualidade visual: validação positiva (check verde aparece em campo OK)
 *
 * Demo: form standalone. Submit faz alert(). Integrar com hooks reais em produção.
 */
import { useForm } from 'react-hook-form';

/** Tipo estrutural permissivo: aceita FieldError nativo OU Merge<FieldError, FieldErrorsImpl>
 *  que RHF retorna pra campos com z.coerce. Componentes só leem `.message`. */
type FormError = { message?: string } | undefined;
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin, Package, DollarSign, FileText, Image, Truck, CheckCircle2, AlertCircle,
} from 'lucide-react';

/* ============================================================================
 * Schema Zod — fonte da verdade
 * ============================================================================ */
const schema = z.object({
  data: z.string().min(1, 'Data de saída obrigatória'),
  dataChegada: z.string().optional(),
  origem: z.string().min(2, 'Mínimo 2 caracteres'),
  destino: z.string().min(2, 'Mínimo 2 caracteres'),
  obraId: z.string().min(1, 'Selecione a obra'),
  transportadora: z.string().min(1, 'Selecione a transportadora'),
  motorista: z.string().min(2, 'Nome do motorista'),
  placaCarreta: z.string().regex(/^[A-Z]{3}-?\d[A-Z\d]\d{2}$/i, 'Placa inválida (ABC-1D34)').optional().or(z.literal('')),
  insumoId: z.string().min(1, 'Selecione o material'),
  pesoToneladas: z.coerce.number().positive('Peso deve ser maior que zero'),
  kmRodados: z.coerce.number().positive('KM deve ser maior que zero'),
  valorTkm: z.coerce.number().positive('R$/TKM deve ser maior que zero'),
  valorUnitarioMaterial: z.coerce.number().nonnegative().optional(),
  notaFiscal: z.string().optional(),
  notaFiscal2: z.string().optional(),
  observacoes: z.string().max(500, 'Máximo 500 caracteres').optional(),
});
// Schemas com z.coerce.* exigem split input/output em RHF — input é o que vem
// dos <input>, output é o que sai validado e tipado pro onSubmit.
type FreteFormInput = z.input<typeof schema>;
type FreteFormOutput = z.output<typeof schema>;

/* ============================================================================
 * Stubs (em produção: ui/Button, ui/PageHeader, shadcn/form, shadcn/select)
 * ============================================================================ */

function Button({
  children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, loading, className = '',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3 text-sm', lg: 'h-10 px-4 text-sm' }[size];
  const variants = {
    primary: 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-xs)]',
    secondary: 'bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
    ghost: 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading} className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
    </button>
  );
}

function PageHeader({
  eyebrow, title, description, actions,
}: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        {eyebrow && <p className="label-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-fg)]">{title}</h1>
        {description && <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

/* ----- Form primitives (em produção: shadcn/form) ----- */

function FormField({
  label, required, error, hint, id, children, valid,
}: {
  label: string;
  required?: boolean;
  error?: FormError;
  hint?: string;
  id: string;
  children: React.ReactNode;
  valid?: boolean; // verde check
}) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-fg)] mb-1.5">
        {label}
        {required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
      </label>
      <div className="relative">
        {children}
        {valid && !error && (
          <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-success)] pointer-events-none" aria-hidden />
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-2xs text-[var(--color-fg-subtle)] mt-1">{hint}</p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-2xs text-[var(--color-danger-fg)] mt-1 animate-in slide-in-from-top-1 duration-[var(--dur-fast)]"
        >
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden />
          {error.message}
        </p>
      )}
    </div>
  );
}

function Input({
  id, error, valid, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: FormError; valid?: boolean }) {
  return (
    <input
      id={id}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className={
        'w-full h-9 px-3 text-sm rounded-md bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
        'border transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] ' +
        'placeholder:text-[var(--color-fg-subtle)] ' +
        'focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:shadow-[0_0_0_3px_var(--color-ring)] ' +
        (error
          ? 'border-[var(--color-danger)] focus-visible:border-[var(--color-danger)] focus-visible:shadow-[0_0_0_3px_rgba(217,45,32,0.25)]'
          : valid
            ? 'border-[var(--color-success)] pr-9'
            : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]')
      }
      {...rest}
    />
  );
}

function Select({
  id, error, options, placeholder, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: FormError; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select
      id={id}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className={
        'w-full h-9 px-3 text-sm rounded-md bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
        'border transition-all duration-[var(--dur-fast)] ' +
        'focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:shadow-[0_0_0_3px_var(--color-ring)] ' +
        (error
          ? 'border-[var(--color-danger)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]')
      }
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Textarea({
  id, error, ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: FormError }) {
  return (
    <textarea
      id={id}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className={
        'w-full px-3 py-2 text-sm rounded-md bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
        'border resize-y transition-all duration-[var(--dur-fast)] ' +
        'placeholder:text-[var(--color-fg-subtle)] ' +
        'focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:shadow-[0_0_0_3px_var(--color-ring)] ' +
        (error
          ? 'border-[var(--color-danger)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]')
      }
      {...rest}
    />
  );
}

function FieldsetLegend({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <legend className="flex items-center gap-1.5 mb-4">
      <Icon className="w-3.5 h-3.5 text-[var(--color-fg-muted)]" aria-hidden />
      <span className="label-eyebrow">{children}</span>
    </legend>
  );
}

/* ============================================================================
 * Mock data
 * ============================================================================ */
const MOCK_OBRAS = [
  { value: 'obra-1', label: 'BR-364 Lote 9' },
  { value: 'obra-2', label: 'BR-319 Lote 3' },
];
const MOCK_TRANSPORTADORAS = [
  { value: 'Triunfo Transp.', label: 'Triunfo Transp.' },
  { value: 'Areacre', label: 'Areacre' },
  { value: 'Andrade Frota', label: 'Andrade Frota' },
  { value: 'EMT Frota', label: 'EMT Frota' },
];
const MOCK_INSUMOS = [
  { value: '1', label: 'Brita 1' },
  { value: '2', label: 'Pó de pedra' },
  { value: '3', label: 'CBUQ' },
  { value: '4', label: 'Areia média' },
  { value: '5', label: 'Cimento CP-II' },
];

/* ============================================================================
 * Página
 * ============================================================================ */
export default function FreteFormPremium() {
  const form = useForm<FreteFormInput, unknown, FreteFormOutput>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      data: new Date().toISOString().slice(0, 10),
      origem: '',
      destino: '',
      obraId: '',
      transportadora: '',
      motorista: '',
      placaCarreta: '',
      insumoId: '',
      observacoes: '',
    },
  });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting, isValid, touchedFields } } = form;

  // Cálculos derivados (mostrados como chips, não inputs).
  // watch() retorna o INPUT type (unknown pra campos coerce), coerço com Number().
  const peso = Number(watch('pesoToneladas')) || 0;
  const km = Number(watch('kmRodados')) || 0;
  const tkm = Number(watch('valorTkm')) || 0;
  const valorUnitMat = Number(watch('valorUnitarioMaterial')) || 0;
  const valorFrete = peso * km * tkm;
  const valorMaterial = peso * valorUnitMat;

  const onSubmit = (data: FreteFormOutput) => {
    console.log('Frete submetido:', data);
    alert('Frete registrado! Veja o console pra payload.');
  };

  return (
    <div className="pb-32"> {/* pad pro footer sticky não cobrir conteúdo */}
      <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-3xl mx-auto">

        <PageHeader
          eyebrow="Operação · Frete"
          title="Novo frete"
          description="Registre uma viagem da operação. Campos obrigatórios marcados com asterisco."
        />

        <form id="frete-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* ---------- Grupo 1: Trecho ---------- */}
          <fieldset className="space-y-4">
            <FieldsetLegend icon={MapPin}>Trecho</FieldsetLegend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              <FormField label="Data de saída" required id="data" error={errors.data}>
                <Input id="data" type="date" {...register('data')} error={errors.data} />
              </FormField>

              <FormField label="Data de chegada" id="dataChegada" hint="Opcional — pode preencher depois">
                <Input id="dataChegada" type="date" {...register('dataChegada')} />
              </FormField>

              <FormField label="Origem" required id="origem" error={errors.origem} valid={touchedFields.origem && !errors.origem}>
                <Input id="origem" type="text" placeholder="Ex: Pedreira Iaras" {...register('origem')} error={errors.origem} valid={touchedFields.origem && !errors.origem} />
              </FormField>

              <FormField label="Destino" required id="destino" error={errors.destino} valid={touchedFields.destino && !errors.destino}>
                <Input id="destino" type="text" placeholder="Ex: KM 88 BR-364" {...register('destino')} error={errors.destino} valid={touchedFields.destino && !errors.destino} />
              </FormField>

              <FormField label="Obra" required id="obraId" error={errors.obraId}>
                <Select id="obraId" {...register('obraId')} options={MOCK_OBRAS} placeholder="Selecione…" error={errors.obraId} />
              </FormField>
            </div>
          </fieldset>

          <div className="hairline-divider" />

          {/* ---------- Grupo 2: Transporte ---------- */}
          <fieldset className="space-y-4">
            <FieldsetLegend icon={Truck}>Transporte</FieldsetLegend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              <FormField label="Transportadora" required id="transportadora" error={errors.transportadora}>
                <Select id="transportadora" {...register('transportadora')} options={MOCK_TRANSPORTADORAS} placeholder="Selecione…" error={errors.transportadora} />
              </FormField>

              <FormField label="Motorista" required id="motorista" error={errors.motorista} valid={touchedFields.motorista && !errors.motorista}>
                <Input id="motorista" type="text" placeholder="Nome do motorista" {...register('motorista')} error={errors.motorista} valid={touchedFields.motorista && !errors.motorista} />
              </FormField>

              <FormField label="Placa da carreta" id="placaCarreta" error={errors.placaCarreta} hint="Formato Mercosul ou antigo (ABC-1234)">
                <Input id="placaCarreta" type="text" placeholder="ABC-1D34" className="font-mono uppercase" {...register('placaCarreta')} error={errors.placaCarreta} />
              </FormField>
            </div>
          </fieldset>

          <div className="hairline-divider" />

          {/* ---------- Grupo 3: Carga ---------- */}
          <fieldset className="space-y-4">
            <FieldsetLegend icon={Package}>Carga</FieldsetLegend>

            <FormField label="Material transportado" required id="insumoId" error={errors.insumoId}>
              <Select id="insumoId" {...register('insumoId')} options={MOCK_INSUMOS} placeholder="Selecione o material…" error={errors.insumoId} />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-4">
              <FormField label="Peso (t)" required id="pesoToneladas" error={errors.pesoToneladas}>
                <Input id="pesoToneladas" type="number" step="0.0001" min="0" placeholder="0,00" className="tabular-nums" {...register('pesoToneladas')} error={errors.pesoToneladas} />
              </FormField>

              <FormField label="KM rodados" required id="kmRodados" error={errors.kmRodados}>
                <Input id="kmRodados" type="number" step="0.0001" min="0" placeholder="0,00" className="tabular-nums" {...register('kmRodados')} error={errors.kmRodados} />
              </FormField>

              <FormField label="R$/TKM" required id="valorTkm" error={errors.valorTkm}>
                <Input id="valorTkm" type="number" step="0.0001" min="0" placeholder="0,00" className="tabular-nums" {...register('valorTkm')} error={errors.valorTkm} />
              </FormField>
            </div>
          </fieldset>

          <div className="hairline-divider" />

          {/* ---------- Grupo 4: Valores (com cálculos vivos) ---------- */}
          <fieldset className="space-y-4">
            <FieldsetLegend icon={DollarSign}>Valores</FieldsetLegend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              <FormField label="Valor unitário do material (R$)" id="valorUnitarioMaterial" hint="Opcional — pra calcular custo de material">
                <Input id="valorUnitarioMaterial" type="number" step="0.0001" min="0" placeholder="Ex: 45,00" className="tabular-nums" {...register('valorUnitarioMaterial')} />
              </FormField>
            </div>

            {/* Computed chips em vez de inputs desabilitados */}
            <div className="surface-sunken p-4 rounded-md flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="label-eyebrow mb-1">Valor calculado do frete</p>
                <p className="text-2xl font-semibold tabular-nums font-mono text-[var(--color-fg)] tracking-snug">
                  R$ {valorFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-2xs text-[var(--color-fg-subtle)] mt-0.5">Peso × KM × R$/TKM</p>
              </div>
              <div>
                <p className="label-eyebrow mb-1">Custo do material</p>
                <p className="text-2xl font-semibold tabular-nums font-mono text-[var(--color-fg)] tracking-snug">
                  R$ {valorMaterial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-2xs text-[var(--color-fg-subtle)] mt-0.5">Valor unitário × Peso</p>
              </div>
            </div>
          </fieldset>

          <div className="hairline-divider" />

          {/* ---------- Grupo 5: Documentos ---------- */}
          <fieldset className="space-y-4">
            <FieldsetLegend icon={FileText}>Documentos</FieldsetLegend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              <FormField label="Nota Fiscal" id="notaFiscal" hint="Ex: NF-e 12345">
                <Input id="notaFiscal" type="text" placeholder="NF-…" className="font-mono" {...register('notaFiscal')} />
              </FormField>

              <FormField label="Nota Fiscal 2" id="notaFiscal2" hint="Quando há duas NFs">
                <Input id="notaFiscal2" type="text" placeholder="NF-…" className="font-mono" {...register('notaFiscal2')} />
              </FormField>
            </div>

            <FormField label="Observações" id="observacoes" error={errors.observacoes} hint="Máx 500 caracteres">
              <Textarea id="observacoes" rows={3} placeholder="Alguma observação…" {...register('observacoes')} error={errors.observacoes} />
            </FormField>
          </fieldset>

          <div className="hairline-divider" />

          {/* ---------- Grupo 6: Anexos ---------- */}
          <fieldset>
            <FieldsetLegend icon={Image}>Anexos</FieldsetLegend>

            <div className="surface-sunken p-6 rounded-lg text-center">
              <Image className="w-8 h-8 text-[var(--color-fg-subtle)] mx-auto mb-2" aria-hidden />
              <p className="text-sm font-medium text-[var(--color-fg)]">Fotos da chegada da carga</p>
              <p className="text-xs text-[var(--color-fg-muted)] mt-0.5 mb-3">
                Até 8 fotos. A 1ª é a principal — registra GPS e horário da chegada.
              </p>
              <Button variant="secondary" size="sm">
                <Image className="w-4 h-4" /> Adicionar fotos
              </Button>
            </div>
          </fieldset>

          {/* ---------- Estado do form (debug visual em demo) ---------- */}
          <div className="rounded-md border border-[var(--color-info)]/30 bg-[var(--color-info-soft)] p-3 text-xs text-[var(--color-info-fg)]">
            <strong>Estado do form (demo):</strong>
            {' '}isValid={String(isValid)} ·
            erros: {Object.keys(errors).length}
            {Object.keys(errors).length > 0 && (
              <span> ({Object.keys(errors).join(', ')})</span>
            )}
          </div>
        </form>
      </div>

      {/* ---------- Footer sticky com primary action ---------- */}
      <div className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] border-t border-[var(--color-border)] bg-[var(--color-surface-1)]/95 backdrop-blur-sm shadow-[var(--shadow-lg)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between">
          <p className="text-xs text-[var(--color-fg-muted)]">
            {Object.keys(errors).length > 0
              ? <span className="text-[var(--color-danger-fg)]">⚠ Corrija os erros antes de salvar</span>
              : isValid
                ? <span className="text-[var(--color-success-fg)]">✓ Pronto pra salvar</span>
                : 'Preencha os campos obrigatórios pra continuar'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button">Cancelar</Button>
            <Button variant="secondary" type="button">Salvar rascunho</Button>
            <Button variant="primary" type="submit" loading={isSubmitting} onClick={() => {
              const formEl = document.getElementById('frete-form') as HTMLFormElement | null;
              formEl?.requestSubmit();
            }}>
              Registrar frete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
