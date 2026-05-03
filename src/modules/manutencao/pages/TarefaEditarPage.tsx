import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import Card from '../../../components/ui/Card';
import { useAuth } from '../../../contexts/AuthContext';
import ManutencaoTarefaForm from '../components/forms/ManutencaoTarefaForm';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import { getTarefa, updateTarefa } from '../utils/manutencaoTarefasApi';
import { ACOES_MANUTENCAO } from '../types';
import type { ManutencaoTarefa } from '../types';

export default function TarefaEditarPage() {
  const { id = '', tarefaId = '' } = useParams<{ id: string; tarefaId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { temAcao } = useAuth();
  const podeGerenciar = temAcao(ACOES_MANUTENCAO.gerenciar);

  const { data: tarefa, isLoading, error } = useQuery<ManutencaoTarefa | null>({
    queryKey: ['manutencao', 'tarefa', tarefaId],
    queryFn: () => getTarefa(tarefaId),
    enabled: !!tarefaId,
  });

  if (!podeGerenciar) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para editar tarefas.
      </Card>
    );
  }
  if (isLoading) return <ManutencaoLoadingState />;
  if (error) return <ManutencaoErrorState erro={error} />;
  if (!tarefa) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Tarefa "{tarefaId}" não encontrada.
      </Card>
    );
  }

  async function handleSubmit(data: ManutencaoTarefa) {
    await updateTarefa(tarefaId, data);
    await qc.invalidateQueries({ queryKey: ['manutencao'] });
    navigate(`/manutencao/modelos/${id}/tarefas/${tarefaId}`);
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1 flex-wrap">
        <Link to="/manutencao/modelos" className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Modelos
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <Link to={`/manutencao/modelos/${id}`} className="hover:text-[var(--color-fg)]">{id}</Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <Link to={`/manutencao/modelos/${id}/tarefas/${tarefaId}`} className="hover:text-[var(--color-fg)]">
          {tarefa.titulo}
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">Editar</span>
      </nav>

      <h2 className="text-lg font-semibold text-[var(--color-fg)]">Editar tarefa</h2>

      <ManutencaoTarefaForm
        modeloId={id}
        modo="editar"
        initial={tarefa}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

export { TarefaEditarPage };
