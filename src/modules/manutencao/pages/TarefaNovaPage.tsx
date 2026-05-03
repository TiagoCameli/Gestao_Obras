import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import Card from '../../../components/ui/Card';
import { useAuth } from '../../../contexts/AuthContext';
import ManutencaoTarefaForm from '../components/forms/ManutencaoTarefaForm';
import { createTarefa } from '../utils/manutencaoTarefasApi';
import { ACOES_MANUTENCAO } from '../types';
import type { ManutencaoTarefa } from '../types';

export default function TarefaNovaPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { temAcao, usuario } = useAuth();
  const podeGerenciar = temAcao(ACOES_MANUTENCAO.gerenciar);

  if (!podeGerenciar) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para criar tarefas.
      </Card>
    );
  }

  async function handleSubmit(data: ManutencaoTarefa) {
    const comAutor = { ...data, criadoPor: usuario?.funcionarioId ?? data.criadoPor };
    await createTarefa(comAutor);
    await qc.invalidateQueries({ queryKey: ['manutencao'] });
    navigate(`/manutencao/modelos/${id}/tarefas/${data.id}`);
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1 flex-wrap">
        <Link to="/manutencao/modelos" className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Modelos
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <Link to={`/manutencao/modelos/${id}`} className="hover:text-[var(--color-fg)]">
          {id}
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">Nova tarefa</span>
      </nav>

      <h2 className="text-lg font-semibold text-[var(--color-fg)]">Nova tarefa</h2>

      <ManutencaoTarefaForm
        modeloId={id}
        modo="criar"
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

export { TarefaNovaPage };
