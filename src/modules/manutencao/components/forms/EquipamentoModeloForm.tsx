import { useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import type {
  EquipamentoModelo,
  CapacidadesSpec,
  MotorSpec,
  FluidoRecomendado,
  FiltroRef,
} from '../../types';

export interface EquipamentoModeloFormProps {
  initial?: Partial<EquipamentoModelo>;
  onSubmit: (data: EquipamentoModelo) => Promise<void>;
  onCancel: () => void;
  modo: 'criar' | 'editar';
  className?: string;
}

const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] open:bg-[var(--color-surface-1)]" open>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] rounded-xl">
        {title}
      </summary>
      <div className="px-4 pb-4 pt-2 flex flex-col gap-3">{children}</div>
    </details>
  );
}

function SmallTextArea({
  id,
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
      />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  step = '1',
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: string;
}) {
  return (
    <Input
      id={id}
      label={label}
      type="number"
      step={step}
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? undefined : Number(v));
      }}
    />
  );
}

export function EquipamentoModeloForm({
  initial,
  onSubmit,
  onCancel,
  modo,
  className = '',
}: EquipamentoModeloFormProps) {
  const [id, setId] = useState(initial?.id ?? '');
  const [fabricante, setFabricante] = useState(initial?.fabricante ?? 'Caterpillar');
  const [modeloNome, setModeloNome] = useState(initial?.modeloNome ?? '');
  const [familia, setFamilia] = useState(initial?.familia ?? '');
  const [tipoEquipamentoCodigo, setTipoEquipamentoCodigo] = useState(
    initial?.tipoEquipamentoCodigo ?? ''
  );
  const [anoInicio, setAnoInicio] = useState<number | undefined>(initial?.anoInicioProducao);
  const [anoFim, setAnoFim] = useState<number | undefined>(initial?.anoFimProducao);
  const [prefixos, setPrefixos] = useState<string[]>(initial?.prefixosSerie ?? []);
  const [novoPrefixo, setNovoPrefixo] = useState('');

  const [motor, setMotor] = useState<MotorSpec>(initial?.motor ?? {});
  const [capacidades, setCapacidades] = useState<CapacidadesSpec>(initial?.capacidades ?? {});
  const [fluidos, setFluidos] = useState<FluidoRecomendado[]>(
    initial?.fluidosRecomendados ?? []
  );
  const [filtros, setFiltros] = useState<FiltroRef[]>(initial?.filtros ?? []);

  const [problemasConhecidos, setProblemasConhecidos] = useState(
    initial?.problemasConhecidos ?? ''
  );
  const [manualUrl, setManualUrl] = useState(initial?.manualUrl ?? '');
  const [manualReferencia, setManualReferencia] = useState(initial?.manualReferencia ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function setMotorField<K extends keyof MotorSpec>(k: K, v: MotorSpec[K]) {
    setMotor((m) => ({ ...m, [k]: v }));
  }

  function setCapField<K extends keyof CapacidadesSpec>(k: K, v: CapacidadesSpec[K]) {
    setCapacidades((c) => ({ ...c, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!id.trim()) return setErro('id obrigatório.');
    if (!KEBAB_RE.test(id)) return setErro('id deve estar em kebab-case (ex: cat-320c).');
    if (!modeloNome.trim()) return setErro('Nome do modelo é obrigatório.');
    if (!familia.trim()) return setErro('Família é obrigatória.');

    const agora = new Date().toISOString();
    const data: EquipamentoModelo = {
      id: id.trim(),
      fabricante: fabricante.trim(),
      modeloNome: modeloNome.trim(),
      familia: familia.trim(),
      tipoEquipamentoCodigo: tipoEquipamentoCodigo.trim() || undefined,
      anoInicioProducao: anoInicio,
      anoFimProducao: anoFim,
      prefixosSerie: prefixos.length ? prefixos : undefined,
      motor,
      capacidades,
      fluidosRecomendados: fluidos,
      filtros,
      problemasConhecidos: problemasConhecidos.trim() || undefined,
      manualUrl: manualUrl.trim() || undefined,
      manualReferencia: manualReferencia.trim() || undefined,
      ativo: initial?.ativo ?? true,
      criadoEm: initial?.criadoEm ?? agora,
      atualizadoEm: agora,
      criadoPor: initial?.criadoPor ?? '',
    };

    setSubmitting(true);
    try {
      await onSubmit(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={'flex flex-col gap-3 ' + className}>
      <Section title="1. Identificação">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            id="modelo-id"
            label="ID (kebab-case)"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="cat-320c"
            required
            disabled={modo === 'editar'}
          />
          <Input
            id="modelo-fabricante"
            label="Fabricante"
            value={fabricante}
            onChange={(e) => setFabricante(e.target.value)}
            required
          />
          <Input
            id="modelo-nome"
            label="Nome do modelo"
            value={modeloNome}
            onChange={(e) => setModeloNome(e.target.value)}
            placeholder="320C"
            required
          />
          <Input
            id="modelo-familia"
            label="Família"
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
            placeholder="Escavadeira Hidráulica"
            required
          />
          <Input
            id="modelo-tipo-codigo"
            label="Código de tipo de equipamento"
            value={tipoEquipamentoCodigo}
            onChange={(e) => setTipoEquipamentoCodigo(e.target.value)}
          />
          <div />
          <NumberField
            id="modelo-ano-inicio"
            label="Ano início produção"
            value={anoInicio}
            onChange={setAnoInicio}
          />
          <NumberField
            id="modelo-ano-fim"
            label="Ano fim produção"
            value={anoFim}
            onChange={setAnoFim}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Prefixos de série
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {prefixos.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-xs border border-[var(--color-border)]"
              >
                {p}
                <button
                  type="button"
                  aria-label={`Remover ${p}`}
                  onClick={() => setPrefixos((arr) => arr.filter((_, j) => j !== i))}
                  className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger-fg)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={novoPrefixo}
              onChange={(e) => setNovoPrefixo(e.target.value.toUpperCase())}
              placeholder="ANB"
              className="flex-1 h-[34px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const v = novoPrefixo.trim();
                if (!v) return;
                setPrefixos((arr) => (arr.includes(v) ? arr : [...arr, v]));
                setNovoPrefixo('');
              }}
            >
              <Plus aria-hidden className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          </div>
        </div>
      </Section>

      <Section title="2. Motor">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            id="motor-cat"
            label="Modelo Cat"
            value={motor.catModel ?? ''}
            onChange={(e) => setMotorField('catModel', e.target.value || undefined)}
          />
          <NumberField
            id="motor-displ"
            label="Cilindrada (L)"
            step="0.1"
            value={motor.displacementL}
            onChange={(v) => setMotorField('displacementL', v)}
          />
          <NumberField
            id="motor-kw"
            label="Potência (kW)"
            value={motor.netPowerKW}
            onChange={(v) => setMotorField('netPowerKW', v)}
          />
          <NumberField
            id="motor-hp"
            label="Potência (HP)"
            value={motor.netPowerHP}
            onChange={(v) => setMotorField('netPowerHP', v)}
          />
          <NumberField
            id="motor-cyl"
            label="Cilindros"
            value={motor.cylinders}
            onChange={(v) => setMotorField('cylinders', v)}
          />
          <Input
            id="motor-cfg"
            label="Configuração"
            value={motor.configuration ?? ''}
            onChange={(e) => setMotorField('configuration', e.target.value || undefined)}
          />
          <Input
            id="motor-inj"
            label="Tipo de injeção"
            value={motor.injectionType ?? ''}
            onChange={(e) => setMotorField('injectionType', e.target.value || undefined)}
          />
        </div>
      </Section>

      <Section title="3. Capacidades de fluido">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <NumberField id="cap-fuel" label="Tanque combustível (L)" value={capacidades.fuelTankL} onChange={(v) => setCapField('fuelTankL', v)} step="0.1" />
          <NumberField id="cap-crank" label="Cárter motor (L)" value={capacidades.engineCrankcaseL} onChange={(v) => setCapField('engineCrankcaseL', v)} step="0.1" />
          <NumberField id="cap-hyd-tot" label="Hidráulico total (L)" value={capacidades.hydraulicSystemTotalL} onChange={(v) => setCapField('hydraulicSystemTotalL', v)} step="0.1" />
          <NumberField id="cap-hyd-tank" label="Tanque hidráulico (L)" value={capacidades.hydraulicTankL} onChange={(v) => setCapField('hydraulicTankL', v)} step="0.1" />
          <NumberField id="cap-swing" label="Swing drive (L)" value={capacidades.swingDriveL} onChange={(v) => setCapField('swingDriveL', v)} step="0.1" />
          <NumberField id="cap-final" label="Comando final (cada, L)" value={capacidades.finalDriveEachL} onChange={(v) => setCapField('finalDriveEachL', v)} step="0.1" />
          <NumberField id="cap-final-cnt" label="Quantidade comandos finais" value={capacidades.finalDriveCount} onChange={(v) => setCapField('finalDriveCount', v)} />
          <NumberField id="cap-trans" label="Transmissão (L)" value={capacidades.transmissionL} onChange={(v) => setCapField('transmissionL', v)} step="0.1" />
          <NumberField id="cap-axle-f" label="Eixo dianteiro (L)" value={capacidades.axleFrontL} onChange={(v) => setCapField('axleFrontL', v)} step="0.1" />
          <NumberField id="cap-axle-r" label="Eixo traseiro (L)" value={capacidades.axleRearL} onChange={(v) => setCapField('axleRearL', v)} step="0.1" />
          <NumberField id="cap-cool" label="Arrefecimento (L)" value={capacidades.coolantSystemL} onChange={(v) => setCapField('coolantSystemL', v)} step="0.1" />
          <NumberField id="cap-diff" label="Diferencial (L)" value={capacidades.differentialL} onChange={(v) => setCapField('differentialL', v)} step="0.1" />
        </div>
      </Section>

      <Section title="4. Fluidos recomendados">
        <FluidosRecomendadosEditor value={fluidos} onChange={setFluidos} />
      </Section>

      <Section title="5. Filtros">
        <FiltrosEditor value={filtros} onChange={setFiltros} />
      </Section>

      <Section title="6. Notas">
        <SmallTextArea
          id="modelo-problemas"
          label="Problemas conhecidos (markdown)"
          value={problemasConhecidos}
          onChange={setProblemasConhecidos}
          rows={6}
        />
        <Input
          id="modelo-manual-url"
          label="URL do manual"
          type="url"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
        />
        <Input
          id="modelo-manual-ref"
          label="Referência do manual"
          value={manualReferencia}
          onChange={(e) => setManualReferencia(e.target.value)}
        />
      </Section>

      {erro && (
        <div role="alert" className="text-xs px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border border-[var(--color-danger)]/30">
          {erro}
        </div>
      )}

      <div className="flex justify-end gap-2 sticky bottom-0 bg-[var(--color-surface-1)] py-3 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Salvando...' : modo === 'criar' ? 'Criar modelo' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}

function FluidosRecomendadosEditor({
  value,
  onChange,
}: {
  value: FluidoRecomendado[];
  onChange: (v: FluidoRecomendado[]) => void;
}) {
  const sistemas: FluidoRecomendado['system'][] = [
    'motor',
    'hidraulico',
    'transmissao',
    'swing_drive',
    'comando_final',
    'eixo_dianteiro',
    'eixo_traseiro',
    'arrefecimento',
    'graxa_geral',
  ];

  return (
    <div className="flex flex-col gap-2">
      {value.map((f, i) => (
        <div
          key={i}
          className="grid sm:grid-cols-[160px_1fr_1fr_auto] gap-2 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Sistema
            </label>
            <select
              value={f.system}
              onChange={(e) =>
                onChange(
                  value.map((x, j) =>
                    j === i ? { ...x, system: e.target.value as FluidoRecomendado['system'] } : x
                  )
                )
              }
              className="w-full h-[42px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
            >
              {sistemas.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Input
            id={`fluido-id-${i}`}
            label="Fluido (id)"
            value={f.fluidoId}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, fluidoId: e.target.value } : x)))}
          />
          <Input
            id={`fluido-notes-${i}`}
            label="Notas"
            value={f.notes ?? ''}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, notes: e.target.value || undefined } : x)))
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover fluido"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 aria-hidden className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onChange([...value, { system: 'motor', fluidoId: '' }])}
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar fluido
      </Button>
    </div>
  );
}

function FiltrosEditor({
  value,
  onChange,
}: {
  value: FiltroRef[];
  onChange: (v: FiltroRef[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((f, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_1fr_80px_auto] gap-2 items-end">
          <Input
            id={`filtro-tipo-${i}`}
            label="Tipo"
            value={f.filterType}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, filterType: e.target.value as FiltroRef['filterType'] } : x
                )
              )
            }
          />
          <Input
            id={`filtro-pn-${i}`}
            label="Part #"
            value={f.partNumber}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, partNumber: e.target.value } : x)))}
          />
          <Input
            id={`filtro-qtd-${i}`}
            label="Qtd"
            type="number"
            value={f.quantity}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover filtro"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 aria-hidden className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          onChange([
            ...value,
            { filterType: 'oleo_motor', partNumber: '', quantity: 1 },
          ])
        }
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar filtro
      </Button>
    </div>
  );
}

export default EquipamentoModeloForm;
