import { useState, type FormEvent, type ReactNode } from 'react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Button from '../../../../components/ui/Button';
import {
  CATEGORIA_LABELS,
  PRIORIDADE_LABELS,
  EXECUTOR_LABELS,
  type ManutencaoTarefa,
  type ManutencaoCategoria,
  type ManutencaoPrioridade,
  type ExecutorPapel,
  type PecaConsumo,
  type FluidoConsumo,
  type FerramentaRef,
  type TorqueSpec,
  type SpecTecnica,
  type CriterioAceite,
  type SinalAlerta,
  type ProcedimentoStep,
} from '../../types';
import {
  ListaPecasEditor,
  ListaFluidosEditor,
  ListaFerramentasEditor,
  ListaTorquesEditor,
  ListaSpecsEditor,
  ListaCriteriosEditor,
  ListaSinaisEditor,
  ListaProcedimentoEditor,
  ListaStringsEditor,
} from './ManutencaoTarefaForm__partes';

export interface ManutencaoTarefaFormProps {
  modeloId: string;
  initial?: Partial<ManutencaoTarefa>;
  onSubmit: (data: ManutencaoTarefa) => Promise<void>;
  onCancel: () => void;
  modo: 'criar' | 'editar';
  className?: string;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]"
      open
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] rounded-xl">
        {title}
      </summary>
      <div className="px-4 pb-4 pt-2 flex flex-col gap-3">{children}</div>
    </details>
  );
}

const CATEGORIA_OPTS = (Object.keys(CATEGORIA_LABELS) as ManutencaoCategoria[]).map((k) => ({
  value: k,
  label: CATEGORIA_LABELS[k],
}));
const PRIORIDADE_OPTS = (Object.keys(PRIORIDADE_LABELS) as ManutencaoPrioridade[]).map((k) => ({
  value: k,
  label: PRIORIDADE_LABELS[k],
}));
const EXECUTOR_OPTS = (Object.keys(EXECUTOR_LABELS) as ExecutorPapel[]).map((k) => ({
  value: k,
  label: EXECUTOR_LABELS[k],
}));

export function ManutencaoTarefaForm({
  modeloId,
  initial,
  onSubmit,
  onCancel,
  modo,
  className = '',
}: ManutencaoTarefaFormProps) {
  const [id, setId] = useState(initial?.id ?? '');
  const [titulo, setTitulo] = useState(initial?.titulo ?? '');
  const [categoria, setCategoria] = useState<ManutencaoCategoria>(
    initial?.categoria ?? 'h_250'
  );
  const [prioridade, setPrioridade] = useState<ManutencaoPrioridade>(
    initial?.prioridade ?? 'media'
  );
  const [executor, setExecutor] = useState<ExecutorPapel>(
    initial?.executorPapel ?? 'mecanico_propio'
  );
  const [duracao, setDuracao] = useState<number | undefined>(initial?.duracaoEstimadaMin);
  const [intervaloHoras, setIntervaloHoras] = useState<number | undefined>(initial?.intervaloHoras);
  const [intervaloDias, setIntervaloDias] = useState<number | undefined>(initial?.intervaloDias);

  const [descricaoTecnica, setDescricaoTecnica] = useState(initial?.descricaoTecnica ?? '');
  const [sistemasAfetados, setSistemasAfetados] = useState<string[]>(
    initial?.sistemasAfetados ?? []
  );

  const [pecas, setPecas] = useState<PecaConsumo[]>(initial?.pecasNecessarias ?? []);
  const [fluidos, setFluidos] = useState<FluidoConsumo[]>(initial?.fluidosNecessarios ?? []);
  const [ferramentas, setFerramentas] = useState<FerramentaRef[]>(
    initial?.ferramentasNecessarias ?? []
  );

  const [specs, setSpecs] = useState<SpecTecnica[]>(initial?.specsTecnicas ?? []);
  const [torques, setTorques] = useState<TorqueSpec[]>(initial?.torques ?? []);
  const [procedimento, setProcedimento] = useState<ProcedimentoStep[]>(
    initial?.procedimento ?? []
  );
  const [criterios, setCriterios] = useState<CriterioAceite[]>(initial?.criteriosAceite ?? []);
  const [sinais, setSinais] = useState<SinalAlerta[]>(initial?.sinaisAlerta ?? []);

  const [notasSeguranca, setNotasSeguranca] = useState(initial?.notasSeguranca ?? '');
  const [epi, setEpi] = useState<string[]>(initial?.epi ?? []);
  const [notasTecnicas, setNotasTecnicas] = useState(initial?.notasTecnicas ?? '');
  const [manualReferencia, setManualReferencia] = useState(initial?.manualReferencia ?? '');
  const [preRequisitos, setPreRequisitos] = useState<string[]>(initial?.preRequisitos ?? []);

  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!id.trim()) return setErro('id obrigatório.');
    if (!titulo.trim()) return setErro('Título obrigatório.');

    const agora = new Date().toISOString();
    const data: ManutencaoTarefa = {
      id: id.trim(),
      modeloId,
      titulo: titulo.trim(),
      categoria,
      intervaloHoras,
      intervaloDias,
      prioridade,
      executorPapel: executor,
      duracaoEstimadaMin: duracao,
      pecasNecessarias: pecas,
      fluidosNecessarios: fluidos,
      ferramentasNecessarias: ferramentas,
      descricaoTecnica: descricaoTecnica.trim(),
      sistemasAfetados,
      procedimento,
      torques,
      specsTecnicas: specs,
      criteriosAceite: criterios,
      sinaisAlerta: sinais,
      notasSeguranca: notasSeguranca.trim() || undefined,
      epi: epi.length ? epi : undefined,
      notasTecnicas: notasTecnicas.trim() || undefined,
      manualReferencia: manualReferencia.trim() || undefined,
      preRequisitos: preRequisitos.length ? preRequisitos : undefined,
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
            id="tarefa-id"
            label="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            disabled={modo === 'editar'}
          />
          <Input
            id="tarefa-titulo"
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
          <Select
            id="tarefa-categoria"
            label="Categoria"
            options={CATEGORIA_OPTS}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as ManutencaoCategoria)}
          />
          <Select
            id="tarefa-prioridade"
            label="Prioridade"
            options={PRIORIDADE_OPTS}
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as ManutencaoPrioridade)}
          />
          <Select
            id="tarefa-executor"
            label="Executor"
            options={EXECUTOR_OPTS}
            value={executor}
            onChange={(e) => setExecutor(e.target.value as ExecutorPapel)}
          />
          <Input
            id="tarefa-duracao"
            label="Duração estimada (min)"
            type="number"
            value={duracao ?? ''}
            onChange={(e) =>
              setDuracao(e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
          <Input
            id="tarefa-int-h"
            label="Intervalo (horas)"
            type="number"
            value={intervaloHoras ?? ''}
            onChange={(e) =>
              setIntervaloHoras(e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
          <Input
            id="tarefa-int-d"
            label="Intervalo (dias)"
            type="number"
            value={intervaloDias ?? ''}
            onChange={(e) =>
              setIntervaloDias(e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </div>
      </Section>

      <Section title="2. Descrição técnica">
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Descrição técnica (markdown)
          </label>
          <textarea
            value={descricaoTecnica}
            onChange={(e) => setDescricaoTecnica(e.target.value)}
            rows={6}
            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>
      </Section>

      <Section title="3. Sistemas afetados">
        <ListaStringsEditor
          value={sistemasAfetados}
          onChange={setSistemasAfetados}
          label="Sistemas afetados"
          placeholder="Pressione Enter para adicionar"
        />
      </Section>

      <Section title="4. Recursos">
        <h5 className="text-xs font-semibold uppercase text-[var(--color-fg-muted)]">Peças</h5>
        <ListaPecasEditor value={pecas} onChange={setPecas} />
        <h5 className="text-xs font-semibold uppercase text-[var(--color-fg-muted)] mt-2">
          Fluidos
        </h5>
        <ListaFluidosEditor value={fluidos} onChange={setFluidos} />
        <h5 className="text-xs font-semibold uppercase text-[var(--color-fg-muted)] mt-2">
          Ferramentas
        </h5>
        <ListaFerramentasEditor value={ferramentas} onChange={setFerramentas} />
      </Section>

      <Section title="5. Specs técnicas">
        <ListaSpecsEditor value={specs} onChange={setSpecs} />
      </Section>

      <Section title="6. Torques">
        <ListaTorquesEditor value={torques} onChange={setTorques} />
      </Section>

      <Section title="7. Procedimento">
        <ListaProcedimentoEditor value={procedimento} onChange={setProcedimento} />
      </Section>

      <Section title="8. Critérios de aceite">
        <ListaCriteriosEditor value={criterios} onChange={setCriterios} />
      </Section>

      <Section title="9. Sinais de alerta">
        <ListaSinaisEditor value={sinais} onChange={setSinais} />
      </Section>

      <Section title="10. Segurança">
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
            Notas de segurança
          </label>
          <textarea
            value={notasSeguranca}
            onChange={(e) => setNotasSeguranca(e.target.value)}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <ListaStringsEditor
          value={epi}
          onChange={setEpi}
          label="EPI"
          placeholder="Capacete, óculos... (Enter)"
        />
      </Section>

      <Section title="11. Notas técnicas">
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
            Notas técnicas
          </label>
          <textarea
            value={notasTecnicas}
            onChange={(e) => setNotasTecnicas(e.target.value)}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <Input
          id="tarefa-manual"
          label="Referência do manual"
          value={manualReferencia}
          onChange={(e) => setManualReferencia(e.target.value)}
        />
        <ListaStringsEditor
          value={preRequisitos}
          onChange={setPreRequisitos}
          label="Pré-requisitos"
          placeholder="(Enter para adicionar)"
        />
      </Section>

      {erro && (
        <div
          role="alert"
          className="text-xs px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border border-[var(--color-danger)]/30"
        >
          {erro}
        </div>
      )}

      <div className="flex justify-end gap-2 sticky bottom-0 bg-[var(--color-surface-1)] py-3 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Salvando...' : modo === 'criar' ? 'Criar tarefa' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}

export default ManutencaoTarefaForm;
