import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Pencil, Printer } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useTodasPecas } from '../hooks/useTodasPecas';
import { useTodosFluidos } from '../hooks/useTodosFluidos';
import CategoriaBadge from '../components/badges/CategoriaBadge';
import PrioridadeBadge from '../components/badges/PrioridadeBadge';
import PecasFluidosList from '../components/displays/PecasFluidosList';
import MarkdownDisplay from '../components/displays/MarkdownDisplay';
import SpecsTecnicasTable from '../components/displays/SpecsTecnicasTable';
import TorquesTable from '../components/displays/TorquesTable';
import ProcedimentoStepDisplay from '../components/displays/ProcedimentoStepDisplay';
import CriteriosAceiteList from '../components/displays/CriteriosAceiteList';
import SinaisAlertaList from '../components/displays/SinaisAlertaList';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import { getTarefa } from '../utils/manutencaoTarefasApi';
import { ACOES_MANUTENCAO, EXECUTOR_LABELS, type ManutencaoTarefa } from '../types';

function intervaloLabel(t: ManutencaoTarefa): string | null {
  if (t.intervaloHoras && t.intervaloDias) return `${t.intervaloHoras}h ou ${t.intervaloDias}d`;
  if (t.intervaloHoras) return `${t.intervaloHoras}h`;
  if (t.intervaloDias) return `${t.intervaloDias}d`;
  return null;
}

export default function TarefaDetalhesPage() {
  const { id = '', tarefaId = '' } = useParams<{ id: string; tarefaId: string }>();
  const { temAcao } = useAuth();
  const podeGerenciar = temAcao(ACOES_MANUTENCAO.gerenciar);

  const { data: tarefa, isLoading, error } = useQuery<ManutencaoTarefa | null>({
    queryKey: ['manutencao', 'tarefa', tarefaId],
    queryFn: () => getTarefa(tarefaId),
    enabled: !!tarefaId,
  });

  const pecas = useTodasPecas();
  const fluidos = useTodosFluidos();

  if (isLoading) return <ManutencaoLoadingState />;
  if (error) return <ManutencaoErrorState erro={error} />;
  if (!tarefa) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Tarefa "{tarefaId}" não encontrada.
      </Card>
    );
  }

  const intervalo = intervaloLabel(tarefa);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1 flex-wrap">
        <Link to="/manutencao/modelos" className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Modelos
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <Link to={`/manutencao/modelos/${id}`} className="hover:text-[var(--color-fg)]">{id}</Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">{tarefa.titulo}</span>
      </nav>

      <Card className="!p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--color-fg)]">{tarefa.titulo}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <CategoriaBadge categoria={tarefa.categoria} />
              <PrioridadeBadge prioridade={tarefa.prioridade} />
              {intervalo && (
                <span className="text-xs text-[var(--color-fg-subtle)]">a cada {intervalo}</span>
              )}
              <span className="text-xs text-[var(--color-fg-subtle)]">
                · {EXECUTOR_LABELS[tarefa.executorPapel]}
              </span>
              {tarefa.duracaoEstimadaMin !== undefined && (
                <span className="text-xs text-[var(--color-fg-subtle)]">
                  · {tarefa.duracaoEstimadaMin} min
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {podeGerenciar && (
              <Link
                to="editar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-sm"
              >
                <Pencil aria-hidden className="w-4 h-4" />
                Editar
              </Link>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled
              title="Em breve"
            >
              <Printer aria-hidden className="w-4 h-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </Card>

      <Section title="Descrição técnica">
        {tarefa.descricaoTecnica ? (
          <MarkdownDisplay markdown={tarefa.descricaoTecnica} />
        ) : (
          <p className="text-sm italic text-[var(--color-fg-subtle)]">Sem descrição.</p>
        )}
      </Section>

      {(tarefa.sistemasAfetados?.length ?? 0) > 0 && (
        <Section title="Sistemas afetados">
          <ul className="flex flex-wrap gap-1.5">
            {tarefa.sistemasAfetados!.map((s, i) => (
              <li
                key={i}
                className="px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-xs border border-[var(--color-border)]"
              >
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recursos">
        <PecasFluidosList
          pecas={tarefa.pecasNecessarias}
          fluidos={tarefa.fluidosNecessarios}
          pecasCatalog={pecas.data ?? []}
          fluidosCatalog={fluidos.data ?? []}
          mostrarCustoEstimado
        />
        {(tarefa.ferramentasNecessarias?.length ?? 0) > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-[var(--color-fg-muted)]">
              Ferramentas
            </h4>
            <ul className="flex flex-col gap-1 text-sm">
              {tarefa.ferramentasNecessarias.map((f, i) => (
                <li key={i} className="text-[var(--color-fg)]">
                  {f.name}
                  {f.size && <span className="text-[var(--color-fg-muted)]"> · {f.size}</span>}
                  {f.catSpecialToolNumber && (
                    <span className="text-[var(--color-fg-subtle)] font-mono"> · {f.catSpecialToolNumber}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Specs técnicas">
        <SpecsTecnicasTable specs={tarefa.specsTecnicas} />
      </Section>

      <Section title="Torques">
        <TorquesTable torques={tarefa.torques} />
      </Section>

      <Section title="Procedimento">
        <ProcedimentoStepDisplay steps={tarefa.procedimento} />
      </Section>

      <Section title="Critérios de aceite">
        <CriteriosAceiteList criterios={tarefa.criteriosAceite} />
      </Section>

      <Section title="Sinais de alerta">
        <SinaisAlertaList sinais={tarefa.sinaisAlerta} />
      </Section>

      {(tarefa.notasSeguranca || (tarefa.epi?.length ?? 0) > 0) && (
        <Section title="Segurança">
          {tarefa.notasSeguranca && (
            <div className="mb-2">
              <MarkdownDisplay markdown={tarefa.notasSeguranca} />
            </div>
          )}
          {(tarefa.epi?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-[var(--color-fg-muted)] mb-1">EPI</h4>
              <ul className="flex flex-wrap gap-1.5">
                {tarefa.epi!.map((e, i) => (
                  <li
                    key={i}
                    className="px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-xs border border-[var(--color-border)]"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {tarefa.notasTecnicas && (
        <Section title="Notas técnicas">
          <MarkdownDisplay markdown={tarefa.notasTecnicas} />
        </Section>
      )}

      {tarefa.manualReferencia && (
        <Section title="Manual">
          <p className="text-sm text-[var(--color-fg-muted)]">{tarefa.manualReferencia}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
      <h3 className="px-4 py-3 text-sm font-semibold text-[var(--color-fg)] border-b border-[var(--color-border)]">
        {title}
      </h3>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export { TarefaDetalhesPage };
