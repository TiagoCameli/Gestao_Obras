import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, ChevronRight, Pencil, Wrench } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/ui/Card';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useEquipamentoComStatus } from '../hooks/useEquipamentoComStatus';
import { useAgendaEquipamento } from '../hooks/useAgendaEquipamento';
import { useEquipamentoModelo } from '../hooks/useEquipamentoModelo';
import { useManutencaoTarefas } from '../hooks/useManutencaoTarefas';
import { useHistoricoManutencao } from '../hooks/useHistoricoManutencao';
import { useAlertasAtivos } from '../hooks/useAlertasAtivos';
import StatusManutencaoBadge, { type StatusManutencao } from '../components/badges/StatusManutencaoBadge';
import AgendaList from '../components/lists/AgendaList';
import HistoricoManutencaoList from '../components/lists/HistoricoManutencaoList';
import AlertaCard from '../components/cards/AlertaCard';
import ProblemasConhecidosDisplay from '../components/displays/ProblemasConhecidosDisplay';
import MotorSpecDisplay from '../components/displays/MotorSpecDisplay';
import CapacidadesDisplay from '../components/displays/CapacidadesDisplay';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import ManutencaoEmptyState from '../components/shared/ManutencaoEmptyState';
import { reconhecerAlerta } from '../utils/manutencaoAlertasApi';
import { gerarAgendaInicial } from '../utils/manutencaoAgendamentosApi';
import { useQueryClient } from '@tanstack/react-query';
import { ACOES_MANUTENCAO } from '../types';

type Aba = 'agenda' | 'historico' | 'specs' | 'alertas';

function statusDe(eq: { horimetroFuncional: boolean; horimetroAtual?: number; manutencoesAtrasadas: number; alertasCriticos: number; proximaManutencao?: { diasRestantes: number } }): StatusManutencao {
  if (!eq.horimetroFuncional && eq.horimetroAtual === undefined) return 'sem_dados';
  if (eq.manutencoesAtrasadas > 0 || eq.alertasCriticos > 0) return 'atrasada';
  const dias = eq.proximaManutencao?.diasRestantes;
  if (dias !== undefined && dias <= 7 && dias >= 0) return 'atencao';
  return 'em_dia';
}

export default function EquipamentoDetalhesPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { temAcao, usuario } = useAuth();
  const qc = useQueryClient();

  const eq = useEquipamentoComStatus(id);
  const agenda = useAgendaEquipamento(id);
  const historico = useHistoricoManutencao(id);
  const alertas = useAlertasAtivos({ equipamentoId: id });
  const modelo = useEquipamentoModelo(eq.data?.modeloId);
  const tarefas = useManutencaoTarefas(eq.data?.modeloId);

  const [aba, setAba] = useState<Aba>('agenda');
  const [registrarOpen, setRegistrarOpen] = useState(false);

  const podeEditar = temAcao(ACOES_MANUTENCAO.editar);
  const podeExecutar = temAcao(ACOES_MANUTENCAO.executar);

  const tarefasPorAgendamento = useMemo(() => {
    if (!agenda.data || !tarefas.data) return [];
    return agenda.data.map((a) => ({
      agendamento: a,
      tarefa: tarefas.data!.find((t) => t.id === a.tarefaId),
    }));
  }, [agenda.data, tarefas.data]);

  if (eq.isLoading) return <ManutencaoLoadingState mensagem="Carregando equipamento..." />;
  if (eq.error) return <ManutencaoErrorState erro={eq.error} onRetry={() => eq.refetch()} />;
  if (!eq.data) {
    return (
      <ManutencaoEmptyState
        titulo="Equipamento não encontrado"
        mensagem={`Não há equipamento com id "${id}".`}
        acao={{ label: 'Voltar para frota', onClick: () => navigate('/manutencao/frota') }}
      />
    );
  }

  async function handleGerarCronograma() {
    if (!usuario || !eq.data?.modeloId) return;
    const dataRef = eq.data.proximaManutencao
      ? new Date().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const dataLabel = new Date(dataRef + 'T00:00:00').toLocaleDateString('pt-BR');
    const ok = confirm(
      `Gerar cronograma de manutenção a partir de ${dataLabel}? Tarefas que já têm agendamento aberto serão preservadas.`
    );
    if (!ok) return;
    try {
      const novos = await gerarAgendaInicial(id, dataRef, usuario.funcionarioId);
      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      alert(`${novos.length} manutenção(ões) agendada(s).`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao gerar cronograma');
    }
  }

  async function handleReconhecer(alertaId: string) {
    if (!usuario) return;
    try {
      await reconhecerAlerta(alertaId, usuario.funcionarioId);
      await qc.invalidateQueries({ queryKey: ['manutencao', 'alertas-ativos'] });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao reconhecer alerta');
    }
  }

  const status = statusDe(eq.data);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1">
        <Link to="/manutencao/frota" className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Frota
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">{eq.data.patrimony}</span>
      </nav>

      <Card className="!p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xl font-bold text-[var(--color-fg)]">{eq.data.patrimony}</div>
            <div className="text-sm text-[var(--color-fg-muted)]">
              {eq.data.modeloNome ?? eq.data.nome}
            </div>
            {eq.data.horimetroFuncional && eq.data.horimetroAtual !== undefined && (
              <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                Horímetro: {eq.data.horimetroAtual.toLocaleString('pt-BR')} h
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusManutencaoBadge status={status} />
            {podeEditar && (
              <Link
                to="editar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-sm"
              >
                <Pencil aria-hidden className="w-4 h-4" />
                Editar
              </Link>
            )}
            {podeEditar && eq.data.modeloId && (agenda.data?.length ?? 0) === 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleGerarCronograma}
                title="Gera os agendamentos a partir das tarefas do modelo associado, baseado na data de aquisição."
              >
                <CalendarPlus aria-hidden className="w-4 h-4" />
                Gerar cronograma
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              disabled={!podeExecutar || tarefasPorAgendamento.length === 0}
              title={
                !podeExecutar
                  ? 'Sem permissão para executar'
                  : tarefasPorAgendamento.length === 0
                    ? 'Sem tarefas pendentes'
                    : 'Selecione uma tarefa pendente para registrar'
              }
              onClick={() => setRegistrarOpen(true)}
            >
              <Wrench aria-hidden className="w-4 h-4" />
              Registrar manutenção
            </Button>
          </div>
        </div>

        {eq.data.proximaManutencao && (
          <div
            className="mt-4 rounded-xl border px-4 py-3"
            style={{
              backgroundColor:
                eq.data.proximaManutencao.diasRestantes < 0
                  ? 'var(--color-danger-soft)'
                  : eq.data.proximaManutencao.diasRestantes <= 7
                    ? 'var(--color-warning-soft)'
                    : 'var(--color-surface-2)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">
              Próxima manutenção
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--color-fg)]">
              {eq.data.proximaManutencao.tarefaTitulo}
            </div>
            <div className="text-xs text-[var(--color-fg-muted)]">
              {eq.data.proximaManutencao.dataPrevista}
              {eq.data.proximaManutencao.diasRestantes < 0
                ? ` · atrasada ${Math.abs(eq.data.proximaManutencao.diasRestantes)} dia(s)`
                : ` · em ${eq.data.proximaManutencao.diasRestantes} dia(s)`}
            </div>
          </div>
        )}
      </Card>

      <nav aria-label="Abas do equipamento" className="flex border-b border-[var(--color-border)] overflow-x-auto">
        {([
          ['agenda', 'Agenda'],
          ['historico', 'Histórico'],
          ['specs', 'Especificações'],
          ['alertas', `Alertas (${alertas.data?.length ?? 0})`],
        ] as Array<[Aba, string]>).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            aria-current={aba === k ? 'page' : undefined}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
              (aba === k
                ? 'text-[var(--color-fg)] border-[var(--color-accent)]'
                : 'text-[var(--color-fg-muted)] border-transparent hover:text-[var(--color-fg)]')
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {aba === 'agenda' && (
        <>
          {agenda.isLoading && <ManutencaoLoadingState />}
          {agenda.error && <ManutencaoErrorState erro={agenda.error} onRetry={() => agenda.refetch()} />}
          {!agenda.isLoading && !agenda.error && (
            <AgendaList agendamentos={agenda.data ?? []} tarefas={tarefas.data ?? []} />
          )}
        </>
      )}

      {aba === 'historico' && (
        <>
          {historico.isLoading && <ManutencaoLoadingState />}
          {historico.error && (
            <ManutencaoErrorState erro={historico.error} onRetry={() => historico.refetch()} />
          )}
          {!historico.isLoading && !historico.error && (
            <HistoricoManutencaoList
              registros={historico.data ?? []}
              tarefas={tarefas.data ?? []}
            />
          )}
        </>
      )}

      {aba === 'specs' && (
        <Card className="!p-5">
          {!eq.data.modeloId && (
            <ManutencaoEmptyState
              titulo="Sem modelo associado"
              mensagem="Associe um modelo ao equipamento para ver as especificações."
              acao={{ label: 'Editar equipamento', onClick: () => navigate('editar') }}
            />
          )}
          {modelo.isLoading && <ManutencaoLoadingState />}
          {modelo.data && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">Modelo</h3>
                <p className="text-sm text-[var(--color-fg-muted)]">
                  {modelo.data.fabricante} {modelo.data.modeloNome} — {modelo.data.familia}{' '}
                  <Link
                    to={`/manutencao/modelos/${modelo.data.id}`}
                    className="text-[var(--color-accent-fg)] hover:underline ml-1"
                  >
                    Ver detalhes
                  </Link>
                </p>
              </div>
              {modelo.data.motor && Object.keys(modelo.data.motor).length > 0 && (
                <details open className="rounded-lg border border-[var(--color-border)]">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Motor</summary>
                  <div className="px-3 pb-3">
                    <MotorSpecDisplay motor={modelo.data.motor} />
                  </div>
                </details>
              )}
              {modelo.data.capacidades && Object.keys(modelo.data.capacidades).length > 0 && (
                <details open className="rounded-lg border border-[var(--color-border)]">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                    Capacidades
                  </summary>
                  <div className="px-3 pb-3">
                    <CapacidadesDisplay capacidades={modelo.data.capacidades} />
                  </div>
                </details>
              )}
              {modelo.data.problemasConhecidos && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Problemas conhecidos</h4>
                  <ProblemasConhecidosDisplay markdown={modelo.data.problemasConhecidos} />
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {aba === 'alertas' && (
        <>
          {alertas.isLoading && <ManutencaoLoadingState />}
          {alertas.error && <ManutencaoErrorState erro={alertas.error} onRetry={() => alertas.refetch()} />}
          {!alertas.isLoading && !alertas.error && (alertas.data?.length ?? 0) === 0 && (
            <ManutencaoEmptyState
              titulo="Sem alertas ativos"
              mensagem="Nenhum alerta pendente para este equipamento."
            />
          )}
          <div className="grid gap-2">
            {(alertas.data ?? []).map((a) => (
              <AlertaCard key={a.id} alerta={a} onReconhecer={handleReconhecer} />
            ))}
          </div>
        </>
      )}

      <Modal
        open={registrarOpen}
        onClose={() => setRegistrarOpen(false)}
        title="Registrar manutenção"
      >
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Selecione a tarefa pendente para iniciar o registro.
          </p>
          <div className="grid gap-2">
            {tarefasPorAgendamento.map(({ agendamento, tarefa }) => (
              <button
                key={agendamento.id}
                type="button"
                onClick={() => {
                  setRegistrarOpen(false);
                  navigate(
                    `/manutencao/frota/${id}/registrar/${agendamento.tarefaId}?agendamento=${agendamento.id}`
                  );
                }}
                className="text-left px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              >
                <div className="text-sm font-medium text-[var(--color-fg)]">
                  {tarefa?.titulo ?? agendamento.tarefaId}
                </div>
                <div className="text-xs text-[var(--color-fg-muted)]">
                  {agendamento.dataPrevista}
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setRegistrarOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export { EquipamentoDetalhesPage };
