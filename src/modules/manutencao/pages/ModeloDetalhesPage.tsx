import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Pencil, Copy, Trash2, Plus } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { useEquipamentoModelo } from '../hooks/useEquipamentoModelo';
import { useManutencaoTarefas } from '../hooks/useManutencaoTarefas';
import { useTodasPecas } from '../hooks/useTodasPecas';
import { useTodosFluidos } from '../hooks/useTodosFluidos';
import { useContagemEquipamentosPorModelo } from '../hooks/useContagemEquipamentosPorModelo';
import TarefaCard from '../components/cards/TarefaCard';
import PecasFluidosList from '../components/displays/PecasFluidosList';
import ProblemasConhecidosDisplay from '../components/displays/ProblemasConhecidosDisplay';
import MotorSpecDisplay from '../components/displays/MotorSpecDisplay';
import CapacidadesDisplay from '../components/displays/CapacidadesDisplay';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import ManutencaoEmptyState from '../components/shared/ManutencaoEmptyState';
import {
  cloneEquipamentoModelo,
  deleteEquipamentoModelo,
} from '../utils/equipamentoModelosApi';
import { ACOES_MANUTENCAO } from '../types';

export default function ModeloDetalhesPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { temAcao, usuario } = useAuth();
  const podeGerenciar = temAcao(ACOES_MANUTENCAO.gerenciar);

  const modelo = useEquipamentoModelo(id);
  const tarefas = useManutencaoTarefas(id);
  const pecas = useTodasPecas();
  const fluidos = useTodosFluidos();
  const contagem = useContagemEquipamentosPorModelo();
  const qtdEquipamentos = contagem.data?.[id] ?? 0;

  const [cloneOpen, setCloneOpen] = useState(false);
  const [novoId, setNovoId] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [cloning, setCloning] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);

  if (modelo.isLoading) return <ManutencaoLoadingState />;
  if (modelo.error) return <ManutencaoErrorState erro={modelo.error} onRetry={() => modelo.refetch()} />;
  if (!modelo.data) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Modelo "{id}" não encontrado.
      </Card>
    );
  }

  const m = modelo.data;
  const fluidosRefs = m.fluidosRecomendados ?? [];
  const filtrosRefs = (m.filtros ?? []).map((f) => ({
    partNumber: f.partNumber,
    quantity: f.quantity,
    notes: f.notes,
  }));

  async function handleClone(e: FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    if (!novoId.trim() || !novoNome.trim()) return;
    setCloning(true);
    try {
      const novo = await cloneEquipamentoModelo(
        id,
        novoId.trim(),
        novoNome.trim(),
        usuario.funcionarioId
      );
      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      setCloneOpen(false);
      navigate(`/manutencao/modelos/${novo.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao clonar.');
    } finally {
      setCloning(false);
    }
  }

  async function handleExcluir() {
    try {
      await deleteEquipamentoModelo(id);
      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      navigate('/manutencao/modelos');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1">
        <Link to="/manutencao/modelos" className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Modelos
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">{m.modeloNome}</span>
      </nav>

      <Card className="!p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--color-fg-subtle)]">
              {m.fabricante}
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-fg)]">{m.modeloNome}</h2>
            <div className="text-sm text-[var(--color-fg-muted)] mt-0.5">{m.familia}</div>
            <div
              className={
                'text-xs mt-1 ' +
                (qtdEquipamentos === 0
                  ? 'italic text-[var(--color-fg-subtle)]'
                  : 'text-[var(--color-fg-muted)]')
              }
            >
              {qtdEquipamentos === 0
                ? 'Nenhum equipamento usa este modelo'
                : `${qtdEquipamentos} equipamento${qtdEquipamentos === 1 ? '' : 's'} na frota`}
            </div>
          </div>
          {podeGerenciar && (
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`tarefas/novo`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-sm font-medium hover:bg-[var(--color-accent-hover)]"
              >
                <Plus aria-hidden className="w-4 h-4" />
                Nova tarefa
              </Link>
              <Link
                to={`editar`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-sm"
              >
                <Pencil aria-hidden className="w-4 h-4" />
                Editar
              </Link>
              <Button size="sm" variant="secondary" onClick={() => setCloneOpen(true)}>
                <Copy aria-hidden className="w-4 h-4" />
                Clonar
              </Button>
              <Button size="sm" variant="danger" onClick={() => setExcluirOpen(true)}>
                <Trash2 aria-hidden className="w-4 h-4" />
                Excluir
              </Button>
            </div>
          )}
        </div>
      </Card>

      <details open className="rounded-xl border border-[var(--color-border)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Identificação</summary>
        <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-[var(--color-fg-muted)]">ID: </span>{m.id}</div>
          <div><span className="text-[var(--color-fg-muted)]">Fabricante: </span>{m.fabricante}</div>
          <div><span className="text-[var(--color-fg-muted)]">Anos: </span>{m.anoInicioProducao ?? '?'} – {m.anoFimProducao ?? '?'}</div>
          <div><span className="text-[var(--color-fg-muted)]">Prefixos: </span>{(m.prefixosSerie ?? []).join(', ') || '—'}</div>
        </div>
      </details>

      <details open className="rounded-xl border border-[var(--color-border)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Motor + capacidades</summary>
        <div className="px-4 pb-4 grid sm:grid-cols-2 gap-6">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
              Motor
            </h4>
            <MotorSpecDisplay motor={m.motor ?? {}} />
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
              Capacidades
            </h4>
            <CapacidadesDisplay capacidades={m.capacidades ?? {}} />
          </section>
        </div>
      </details>

      <details open className="rounded-xl border border-[var(--color-border)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Fluidos & filtros recomendados</summary>
        <div className="px-4 pb-4">
          <PecasFluidosList
            pecas={filtrosRefs}
            fluidos={fluidosRefs}
            pecasCatalog={pecas.data ?? []}
            fluidosCatalog={fluidos.data ?? []}
            mode="modelo"
          />
        </div>
      </details>

      {m.problemasConhecidos && (
        <details open className="rounded-xl border border-[var(--color-border)]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Problemas conhecidos</summary>
          <div className="px-4 pb-4">
            <ProblemasConhecidosDisplay markdown={m.problemasConhecidos} />
          </div>
        </details>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">
            Tarefas ({tarefas.data?.length ?? 0})
          </h3>
        </div>
        {tarefas.isLoading && <ManutencaoLoadingState />}
        {(tarefas.data?.length ?? 0) === 0 && !tarefas.isLoading && (
          <ManutencaoEmptyState
            titulo="Sem tarefas cadastradas"
            mensagem="Adicione tarefas para gerar a agenda de manutenção."
          />
        )}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(tarefas.data ?? []).map((t) => (
            <TarefaCard
              key={t.id}
              tarefa={t}
              onClick={() => navigate(`tarefas/${t.id}`)}
            />
          ))}
        </div>
      </section>

      <Modal open={cloneOpen} onClose={() => setCloneOpen(false)} title="Clonar modelo">
        <form onSubmit={handleClone} className="p-4 sm:p-5 flex flex-col gap-3">
          <Input
            id="clone-id"
            label="Novo ID (kebab-case)"
            value={novoId}
            onChange={(e) => setNovoId(e.target.value)}
            placeholder={`${m.id}-variante`}
            required
          />
          <Input
            id="clone-nome"
            label="Novo nome"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder={`${m.modeloNome} (variante)`}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCloneOpen(false)} disabled={cloning}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={cloning}>
              {cloning ? 'Clonando...' : 'Clonar'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={excluirOpen}
        onClose={() => setExcluirOpen(false)}
        onConfirm={handleExcluir}
        title="Excluir modelo"
        message={
          qtdEquipamentos > 0
            ? `Atenção: ${qtdEquipamentos} equipamento${
                qtdEquipamentos === 1 ? '' : 's'
              } da frota usa${qtdEquipamentos === 1 ? '' : 'm'} este modelo. Ao excluir, ${
                qtdEquipamentos === 1 ? 'esse equipamento ficará' : 'esses equipamentos ficarão'
              } com modelo_id NULL (foreign key ON DELETE SET NULL) e perderão a agenda automática até serem reassociados a outro modelo. Deseja continuar?`
            : `Tem certeza que deseja excluir o modelo "${m.modeloNome}"? Ele será marcado como inativo (registros históricos serão preservados).`
        }
        requirePassword={false}
      />
    </div>
  );
}

export { ModeloDetalhesPage };
