import { Plus, Trash2 } from 'lucide-react';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import type {
  PecaConsumo,
  FluidoConsumo,
  FerramentaRef,
  TorqueSpec,
  SpecTecnica,
  CriterioAceite,
  SinalAlerta,
  ProcedimentoStep,
} from '../../types';

export function ListaPecasEditor({
  value,
  onChange,
}: {
  value: PecaConsumo[];
  onChange: (v: PecaConsumo[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((p, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_80px_1fr_auto] gap-2 items-end">
          <Input
            id={`peca-pn-${i}`}
            label="Part #"
            value={p.partNumber}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, partNumber: e.target.value } : x)))
            }
          />
          <Input
            id={`peca-qty-${i}`}
            label="Qtd"
            type="number"
            value={p.quantity}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))
            }
          />
          <Input
            id={`peca-notes-${i}`}
            label="Notas"
            value={p.notes ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) => (j === i ? { ...x, notes: e.target.value || undefined } : x))
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover peça"
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
        onClick={() => onChange([...value, { partNumber: '', quantity: 1 }])}
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar peça
      </Button>
    </div>
  );
}

export function ListaFluidosEditor({
  value,
  onChange,
}: {
  value: FluidoConsumo[];
  onChange: (v: FluidoConsumo[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((f, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_100px_1fr_auto] gap-2 items-end">
          <Input
            id={`fluido-cons-id-${i}`}
            label="Fluido (id)"
            value={f.fluidoId}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, fluidoId: e.target.value } : x)))
            }
          />
          <Input
            id={`fluido-cons-qty-${i}`}
            label="Litros"
            type="number"
            step="0.1"
            value={f.quantityLiters}
            onChange={(e) =>
              onChange(
                value.map((x, j) => (j === i ? { ...x, quantityLiters: Number(e.target.value) } : x))
              )
            }
          />
          <Input
            id={`fluido-cons-notes-${i}`}
            label="Notas"
            value={f.notes ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) => (j === i ? { ...x, notes: e.target.value || undefined } : x))
              )
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
        onClick={() => onChange([...value, { fluidoId: '', quantityLiters: 0 }])}
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar fluido
      </Button>
    </div>
  );
}

export function ListaFerramentasEditor({
  value,
  onChange,
}: {
  value: FerramentaRef[];
  onChange: (v: FerramentaRef[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((f, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_120px_1fr_auto] gap-2 items-end">
          <Input
            id={`ferr-name-${i}`}
            label="Nome"
            value={f.name}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
            }
          />
          <Input
            id={`ferr-size-${i}`}
            label="Tamanho"
            value={f.size ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) => (j === i ? { ...x, size: e.target.value || undefined } : x))
              )
            }
          />
          <Input
            id={`ferr-cat-${i}`}
            label="Cat # ferramenta"
            value={f.catSpecialToolNumber ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, catSpecialToolNumber: e.target.value || undefined } : x
                )
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover ferramenta"
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
        onClick={() => onChange([...value, { name: '' }])}
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar ferramenta
      </Button>
    </div>
  );
}

export function ListaTorquesEditor({
  value,
  onChange,
}: {
  value: TorqueSpec[];
  onChange: (v: TorqueSpec[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((t, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_100px_100px_auto_auto] gap-2 items-end">
          <Input
            id={`torq-comp-${i}`}
            label="Componente"
            value={t.componentName}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, componentName: e.target.value } : x)))
            }
          />
          <Input
            id={`torq-nm-${i}`}
            label="Nm"
            type="number"
            value={t.torqueNm}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, torqueNm: Number(e.target.value) } : x)))
            }
          />
          <Input
            id={`torq-lb-${i}`}
            label="lb-ft"
            type="number"
            value={t.torqueLbFt ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i
                    ? { ...x, torqueLbFt: e.target.value === '' ? undefined : Number(e.target.value) }
                    : x
                )
              )
            }
          />
          <label className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)] pb-2.5">
            <input
              type="checkbox"
              checked={!!t.threadLockerRequired}
              onChange={(e) =>
                onChange(
                  value.map((x, j) =>
                    j === i ? { ...x, threadLockerRequired: e.target.checked } : x
                  )
                )
              }
            />
            Trava
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover torque"
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
        onClick={() => onChange([...value, { componentName: '', torqueNm: 0 }])}
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar torque
      </Button>
    </div>
  );
}

export function ListaSpecsEditor({
  value,
  onChange,
}: {
  value: SpecTecnica[];
  onChange: (v: SpecTecnica[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((s, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_1fr_80px_auto] gap-2 items-end">
          <Input
            id={`spec-par-${i}`}
            label="Parâmetro"
            value={s.parametro}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, parametro: e.target.value } : x)))
            }
          />
          <Input
            id={`spec-nom-${i}`}
            label="Nominal"
            value={s.valorNominal}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, valorNominal: e.target.value } : x)))
            }
          />
          <Input
            id={`spec-min-${i}`}
            label="Mín."
            value={s.valorMinimo ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, valorMinimo: e.target.value || undefined } : x
                )
              )
            }
          />
          <Input
            id={`spec-max-${i}`}
            label="Máx."
            value={s.valorMaximo ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, valorMaximo: e.target.value || undefined } : x
                )
              )
            }
          />
          <Input
            id={`spec-un-${i}`}
            label="Unid."
            value={s.unidade ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, unidade: e.target.value || undefined } : x
                )
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover spec"
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
        onClick={() => onChange([...value, { parametro: '', valorNominal: '' }])}
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar spec
      </Button>
    </div>
  );
}

export function ListaCriteriosEditor({
  value,
  onChange,
}: {
  value: CriterioAceite[];
  onChange: (v: CriterioAceite[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((c, i) => (
        <div key={i} className="grid sm:grid-cols-[60px_1fr_1fr_1fr_auto] gap-2 items-end">
          <Input
            id={`crit-ord-${i}`}
            label="#"
            type="number"
            value={c.ordem}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, ordem: Number(e.target.value) } : x)))
            }
          />
          <Input
            id={`crit-desc-${i}`}
            label="Descrição"
            value={c.descricao}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))
            }
          />
          <Input
            id={`crit-verif-${i}`}
            label="Como verificar"
            value={c.comoVerificar ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, comoVerificar: e.target.value || undefined } : x
                )
              )
            }
          />
          <Input
            id={`crit-acao-${i}`}
            label="Se reprovar"
            value={c.acaoSeReprovar ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, acaoSeReprovar: e.target.value || undefined } : x
                )
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover critério"
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
        onClick={() => onChange([...value, { ordem: value.length + 1, descricao: '' }])}
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar critério
      </Button>
    </div>
  );
}

export function ListaSinaisEditor({
  value,
  onChange,
}: {
  value: SinalAlerta[];
  onChange: (v: SinalAlerta[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((s, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_120px_auto] gap-2 items-end">
          <Input
            id={`sinal-${i}`}
            label="Sinal"
            value={s.sinal}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, sinal: e.target.value } : x)))
            }
          />
          <Input
            id={`sinal-sig-${i}`}
            label="Significado"
            value={s.significado}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, significado: e.target.value } : x)))
            }
          />
          <Input
            id={`sinal-acao-${i}`}
            label="Ação"
            value={s.acao}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, acao: e.target.value } : x)))
            }
          />
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Severidade
            </label>
            <select
              value={s.severidade}
              onChange={(e) =>
                onChange(
                  value.map((x, j) =>
                    j === i ? { ...x, severidade: e.target.value as SinalAlerta['severidade'] } : x
                  )
                )
              }
              className="w-full h-[42px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
            >
              <option value="info">Info</option>
              <option value="atencao">Atenção</option>
              <option value="critico">Crítico</option>
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover sinal"
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
          onChange([...value, { sinal: '', significado: '', acao: '', severidade: 'atencao' }])
        }
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar sinal
      </Button>
    </div>
  );
}

export function ListaProcedimentoEditor({
  value,
  onChange,
}: {
  value: ProcedimentoStep[];
  onChange: (v: ProcedimentoStep[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {value.map((s, i) => (
        <div
          key={i}
          className="grid sm:grid-cols-[60px_1fr_1fr_120px_auto] gap-2 items-start p-3 rounded-lg bg-[var(--color-surface-2)]"
        >
          <Input
            id={`proc-ord-${i}`}
            label="#"
            type="number"
            value={s.order}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, order: Number(e.target.value) } : x)))
            }
          />
          <Input
            id={`proc-titulo-${i}`}
            label="Título"
            value={s.title}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
            }
          />
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Descrição
            </label>
            <textarea
              value={s.description}
              onChange={(e) =>
                onChange(
                  value.map((x, j) => (j === i ? { ...x, description: e.target.value } : x))
                )
              }
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <Input
            id={`proc-min-${i}`}
            label="Min. estimados"
            type="number"
            value={s.estimatedMinutes ?? ''}
            onChange={(e) =>
              onChange(
                value.map((x, j) =>
                  j === i
                    ? {
                        ...x,
                        estimatedMinutes:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      }
                    : x
                )
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Remover passo"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 aria-hidden className="w-3.5 h-3.5" />
          </Button>
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Notas de aviso (warningNotes)
            </label>
            <textarea
              value={s.warningNotes ?? ''}
              onChange={(e) =>
                onChange(
                  value.map((x, j) =>
                    j === i ? { ...x, warningNotes: e.target.value || undefined } : x
                  )
                )
              }
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          onChange([
            ...value,
            { order: value.length + 1, title: '', description: '' },
          ])
        }
      >
        <Plus aria-hidden className="w-3.5 h-3.5" />
        Adicionar passo
      </Button>
    </div>
  );
}

export function ListaStringsEditor({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  label: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-xs border border-[var(--color-border)]"
          >
            {v}
            <button
              type="button"
              aria-label={`Remover ${v}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger-fg)]"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          placeholder={placeholder}
          className="flex-1 h-[34px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const v = (e.target as HTMLInputElement).value.trim();
              if (v && !value.includes(v)) onChange([...value, v]);
              (e.target as HTMLInputElement).value = '';
            }
          }}
        />
      </div>
    </div>
  );
}
