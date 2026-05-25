/**
 * EquipamentoFormFrota — Onda 5.A: migrado pra react-hook-form + Zod.
 *
 * Particularidades preservadas:
 *  - Patrimônio auto-gerado quando empresa é EMT + tipo selecionado
 *    (side-effect via watch + setValue)
 *  - Inline criação de novo tipo de equipamento (mini-form fora do RHF
 *    + mutation; ao salvar chama setValue('tipo'))
 *  - `dataVenda` preenchido auto-marca ativo=false (setValue)
 *  - SearchableSelect (tipo) integrado via Controller
 *  - `codigoPatrimonio` required-quando-EMT: validado no isValid (não no schema)
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Equipamento, Empresa, TipoMedicao } from '../../types';
import { getCategoriaFrota, registrarCategoriaDinamica } from '../../lib/frotaConstants';
import { useTiposEquipamento, useAdicionarTipoEquipamento } from '../../hooks/useTiposEquipamento';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import SearchableSelect from '../ui/SearchableSelect';
import ImportEquipamentosModal from '../obras/ImportEquipamentosModal';
import AnexosUploader from '../combustivel/AnexosUploader';
import { Camera } from 'lucide-react';
import {
  equipamentoFrotaFormSchema,
  type EquipamentoFrotaFormValues,
} from '../../schemas/frota/equipamento.schema';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function gerarCodigoPatrimonio(tipo: string, existentes: Equipamento[], codigo?: string, idAtual?: string): string {
  if (!tipo) return '';
  const cat = getCategoriaFrota(tipo, codigo);
  const prefixo = cat.codigo;
  const codigosExistentes = new Set(
    existentes
      .filter((e) => e.id !== idAtual)
      .map((e) => e.codigoPatrimonio.toUpperCase())
  );
  let numero = 1;
  while (true) {
    const cod = `${prefixo}-${String(numero).padStart(3, '0')}`;
    if (!codigosExistentes.has(cod.toUpperCase())) return cod;
    numero++;
  }
}

interface EquipamentoFormFrotaProps {
  initial?: Equipamento | null;
  onSubmit: (eq: Equipamento) => void;
  onCancel: () => void;
  empresas: Empresa[];
  equipamentosExistentes: Equipamento[];
  onImportBatch?: (eqs: Equipamento[]) => void;
}

function buildDefaults(initial: Equipamento | null | undefined): EquipamentoFrotaFormValues {
  return {
    nome: initial?.nome || '',
    tipo: initial?.tipo || '',
    empresaId: initial?.empresaId || '',
    codigoPatrimonio: initial?.codigoPatrimonio || '',
    numeroSerie: initial?.numeroSerie || '',
    ano: initial?.ano || '',
    marca: initial?.marca || '',
    modelo: initial?.modelo || '',
    propriedade: initial?.propriedade || 'propria',
    status: initial?.status || 'ativa',
    tipoMedicao: initial?.tipoMedicao || 'horimetro',
    medicaoInicial: initial?.medicaoInicial ?? 0,
    ativo: initial?.ativo !== false,
    dataAquisicao: initial?.dataAquisicao || '',
    dataVenda: initial?.dataVenda || '',
  };
}

export default function EquipamentoFormFrota({ initial, onSubmit, onCancel, empresas, equipamentosExistentes, onImportBatch }: EquipamentoFormFrotaProps) {
  const { data: tiposEquipamento = [] } = useTiposEquipamento();
  const adicionarTipoMut = useAdicionarTipoEquipamento();

  // ── Estado fora do RHF: anexos, modal import, mini-form novo tipo, toast ─
  const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [showNovoTipo, setShowNovoTipo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoCodigo, setNovoTipoCodigo] = useState('');
  const [salvandoTipo, setSalvandoTipo] = useState(false);

  // ── RHF + Zod ────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isValid: rhfIsValid },
  } = useForm<EquipamentoFrotaFormValues>({
    resolver: zodResolver(equipamentoFrotaFormSchema),
    mode: 'onChange',
    defaultValues: buildDefaults(initial),
  });

  useEffect(() => {
    reset(buildDefaults(initial));
  }, [initial, reset]);

  // ── Memos derivados ──────────────────────────────────────────────────────
  const tiposAtivos = useMemo(
    () => tiposEquipamento.filter((t) => t.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [tiposEquipamento]
  );
  const tipoCodigoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tiposEquipamento) map.set(t.nome, t.codigo);
    return map;
  }, [tiposEquipamento]);

  const empresasAtivas = empresas.filter((e) => e.ativo !== false);
  const empresasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of empresas) map.set(e.nome.toLowerCase(), e.id);
    return map;
  }, [empresas]);

  // ── Watch cross-field (codigoPatrimonio auto-gerado p/ EMT) ──────────────
  const empresaIdWatch = watch('empresaId');
  const tipoWatch = watch('tipo');
  const tipoMedicaoWatch = watch('tipoMedicao');
  const dataVendaWatch = watch('dataVenda');
  const ativoWatch = watch('ativo');

  function isEmpresaEmt(id: string) {
    const emp = empresas.find((e) => e.id === id);
    return emp ? emp.nome.toLowerCase().includes('emt') : false;
  }

  // Side-effects pra auto-fill do código de patrimônio quando empresa OU
  // tipo mudam (e a empresa é EMT). Sem isso, replicar o comportamento do
  // form antigo fica desconexo.
  const handleTipoChange = useCallback((id: string) => {
    setValue('tipo', id, { shouldValidate: true });
    if (isEmpresaEmt(empresaIdWatch) && id) {
      setValue(
        'codigoPatrimonio',
        gerarCodigoPatrimonio(id, equipamentosExistentes, tipoCodigoMap.get(id), initial?.id),
        { shouldValidate: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaIdWatch, equipamentosExistentes, initial?.id, tipoCodigoMap, empresas]);

  const handleEmpresaChange = useCallback((id: string) => {
    setValue('empresaId', id, { shouldValidate: true });
    if (isEmpresaEmt(id) && tipoWatch) {
      setValue(
        'codigoPatrimonio',
        gerarCodigoPatrimonio(tipoWatch, equipamentosExistentes, tipoCodigoMap.get(tipoWatch), initial?.id),
        { shouldValidate: true },
      );
    } else if (!isEmpresaEmt(id)) {
      setValue('codigoPatrimonio', '', { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoWatch, equipamentosExistentes, initial?.id, tipoCodigoMap, empresas]);

  // dataVenda preenchido marca ativo=false automaticamente
  useEffect(() => {
    if (dataVendaWatch && ativoWatch) {
      setValue('ativo', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVendaWatch]);

  // ── Submit + tipo novo handler ───────────────────────────────────────────
  const onValidSubmit = useCallback((values: EquipamentoFrotaFormValues) => {
    onSubmit({
      id: initial?.id || gerarId(),
      nome: values.nome,
      tipo: values.tipo,
      empresaId: values.empresaId,
      codigoPatrimonio: values.codigoPatrimonio || '',
      numeroSerie: values.numeroSerie || '',
      ano: values.ano || '',
      marca: values.marca || '',
      modelo: values.modelo || '',
      propriedade: values.propriedade,
      status: values.status,
      tipoMedicao: values.tipoMedicao,
      medicaoInicial: values.medicaoInicial ?? 0,
      // Mantém regra original: dataVenda preenchido força ativo=false;
      // se status='fora_funcionamento' tb força ativo=false.
      ativo: values.dataVenda ? false : values.status !== 'fora_funcionamento',
      dataAquisicao: values.dataAquisicao || '',
      dataVenda: values.dataVenda || '',
      criadoPor: initial?.criadoPor || '',
      fotoUrls,
      arquivoUrls,
    });
  }, [initial, fotoUrls, arquivoUrls, onSubmit]);

  async function handleAdicionarTipo() {
    if (!novoTipoNome.trim() || !novoTipoCodigo.trim()) return;
    setSalvandoTipo(true);
    try {
      const novoTipo = {
        id: gerarId(),
        nome: novoTipoNome.trim(),
        codigo: novoTipoCodigo.trim().toUpperCase(),
        ativo: true,
        criadoPor: '',
      };
      await adicionarTipoMut.mutateAsync(novoTipo);
      registrarCategoriaDinamica(novoTipo.nome, novoTipo.codigo);
      setValue('tipo', novoTipo.nome, { shouldValidate: true });
      setShowNovoTipo(false);
      setNovoTipoNome('');
      setNovoTipoCodigo('');
      if (isEmpresaEmt(empresaIdWatch)) {
        setValue(
          'codigoPatrimonio',
          gerarCodigoPatrimonio(novoTipo.nome, equipamentosExistentes, novoTipo.codigo, initial?.id),
          { shouldValidate: true },
        );
      }
    } finally {
      setSalvandoTipo(false);
    }
  }

  // ── Validação cross-field: codigoPatrimonio required quando EMT ──────────
  const isEmt = isEmpresaEmt(empresaIdWatch);
  const codigoPatrimonioWatch = watch('codigoPatrimonio');
  const codigoPatrimonioOk = !isEmt || !!codigoPatrimonioWatch?.trim();
  const isValid = rhfIsValid && codigoPatrimonioOk;

  return (
    <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            className="text-xs px-3 py-1.5"
            onClick={() => setImportModalOpen(true)}
          >
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome do Equipamento"
          id="frotaEqNome"
          placeholder="Ex: Escavadeira CAT 320"
          required
          error={errors.nome?.message}
          {...register('nome')}
        />
        <div>
          <label htmlFor="frotaEqTipo" className="block text-sm font-medium text-[var(--color-fg)] mb-1">
            Tipo de Equipamento<span className="text-[var(--color-danger)] ml-0.5">*</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <SearchableSelect
                    options={tiposAtivos.map((t) => ({ id: t.nome, label: t.nome }))}
                    value={field.value ?? ''}
                    onChange={(id) => handleTipoChange(id)}
                    placeholder="Selecione o tipo..."
                  />
                )}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNovoTipo(!showNovoTipo)}
              className="h-[42px] px-3 rounded-lg border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] transition-colors text-lg font-bold shrink-0"
              title="Adicionar novo tipo"
            >
              +
            </button>
          </div>
          {errors.tipo && (
            <p className="text-xs text-[var(--color-danger)] mt-1">{errors.tipo.message}</p>
          )}

          {showNovoTipo && (
            <div className="mt-2 p-3 border border-dashed border-[var(--color-border)] rounded-lg bg-[var(--color-surface-2)]/40 space-y-2">
              <p className="text-xs font-medium text-[var(--color-fg-muted)]">Novo Tipo de Equipamento</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nome (ex: Usina de Asfalto)"
                  value={novoTipoNome}
                  onChange={(e) => setNovoTipoNome(e.target.value)}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
                <input
                  type="text"
                  placeholder="Abreviação (ex: UA)"
                  value={novoTipoCodigo}
                  onChange={(e) => setNovoTipoCodigo(e.target.value.toUpperCase())}
                  maxLength={5}
                  className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] uppercase"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowNovoTipo(false); setNovoTipoNome(''); setNovoTipoCodigo(''); }}
                  className="text-xs text-[var(--color-fg-muted)] hover:underline"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAdicionarTipo}
                  disabled={!novoTipoNome.trim() || !novoTipoCodigo.trim() || salvandoTipo}
                  className="text-xs bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] px-3 py-1.5 rounded-md font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {salvandoTipo ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}
        </div>
        <Controller
          control={control}
          name="empresaId"
          render={({ field }) => (
            <Select
              label="Empresa"
              id="frotaEqEmpresa"
              value={field.value}
              onChange={(e) => handleEmpresaChange(e.target.value)}
              options={empresasAtivas.map((e) => ({ value: e.id, label: e.nome }))}
              placeholder="Selecione a empresa..."
              required
              error={errors.empresaId?.message}
            />
          )}
        />
        <Input
          label={isEmt ? 'Código de Patrimônio' : 'Código de Patrimônio (opcional)'}
          id="frotaEqPatrimonio"
          placeholder="Gerado automaticamente ao selecionar o tipo"
          required={isEmt}
          error={errors.codigoPatrimonio?.message}
          {...register('codigoPatrimonio')}
        />
        <Input
          label="Número de Série"
          id="frotaEqSerie"
          placeholder="Ex: CAT320-2024-001"
          error={errors.numeroSerie?.message}
          {...register('numeroSerie')}
        />
        <Input
          label="Marca"
          id="frotaEqMarca"
          placeholder="Ex: Caterpillar"
          error={errors.marca?.message}
          {...register('marca')}
        />
        <Input
          label="Modelo"
          id="frotaEqModelo"
          placeholder="Ex: 320C, PC200, 2423 K/36"
          error={errors.modelo?.message}
          {...register('modelo')}
        />
        <Input
          label="Ano"
          id="frotaEqAno"
          placeholder="Ex: 2024"
          error={errors.ano?.message}
          {...register('ano')}
        />
        <Select
          label="Propriedade"
          id="frotaEqPropriedade"
          options={[
            { value: 'propria', label: 'Própria' },
            { value: 'alugada', label: 'Alugada' },
          ]}
          error={errors.propriedade?.message}
          {...register('propriedade')}
        />
        <Select
          label="Status"
          id="frotaEqStatus"
          options={[
            { value: 'ativa', label: 'Ativa' },
            { value: 'manutencao_preventiva', label: 'Em manutenção preventiva' },
            { value: 'manutencao_corretiva', label: 'Em manutenção corretiva' },
            { value: 'fora_funcionamento', label: 'Fora de funcionamento' },
          ]}
          error={errors.status?.message}
          {...register('status')}
        />
        <Select
          label="Tipo de Medição"
          id="frotaEqTipoMedicao"
          options={[
            { value: 'horimetro', label: 'Horímetro' },
            { value: 'odometro', label: 'Odômetro' },
          ]}
          error={errors.tipoMedicao?.message}
          {...register('tipoMedicao')}
        />
        <Input
          label={tipoMedicaoWatch === 'horimetro' ? 'Horímetro Inicial' : 'Odômetro Inicial (KM)'}
          id="frotaEqMedicao"
          type="number"
          step="0.0001"
          min="0"
          error={errors.medicaoInicial?.message}
          {...register('medicaoInicial', { valueAsNumber: true })}
        />
        <Input
          label="Data de Aquisição"
          id="frotaEqDataAquisicao"
          type="date"
          error={errors.dataAquisicao?.message}
          {...register('dataAquisicao')}
        />
        <Input
          label="Data de Venda"
          id="frotaEqDataVenda"
          type="date"
          error={errors.dataVenda?.message}
          {...register('dataVenda')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ativoWatch
                ? 'bg-[var(--color-success)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-3)]'
            }`}
            onClick={() => setValue('ativo', true)}
          >
            Ativo
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !ativoWatch
                ? 'bg-[var(--color-danger)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-3)]'
            }`}
            onClick={() => setValue('ativo', false)}
          >
            Inativo
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-fg)] mb-2 flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Fotos e anexos do equipamento
        </label>
        <p className="text-xs text-[var(--color-fg-muted)] mb-3">
          Frente, lateral, painel, plaqueta de identificação, chassi. Manuais técnicos como arquivo.
        </p>
        <AnexosUploader
          fotoUrls={fotoUrls}
          arquivoUrls={arquivoUrls}
          onChangeFotos={setFotoUrls}
          onChangeArquivos={setArquivoUrls}
          pastaId={`equipamento/${initial?.id ?? 'novo'}`}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Cadastrar Equipamento'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportEquipamentosModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(novos) => {
            onImportBatch(novos);
            setImportModalOpen(false);
            setToastMsg(`${novos.length} equipamento${novos.length !== 1 ? 's' : ''} importado${novos.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          equipamentosExistentes={equipamentosExistentes}
          empresasMap={empresasMap}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[var(--z-toast)] bg-[var(--color-success)] text-white px-5 py-3 rounded-lg shadow-[var(--shadow-lg)] text-sm font-medium">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
