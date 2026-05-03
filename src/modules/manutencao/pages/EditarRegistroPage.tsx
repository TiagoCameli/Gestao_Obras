import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { useEquipamentoComStatus } from '../hooks/useEquipamentoComStatus';
import { useManutencaoTarefa } from '../hooks/useManutencaoTarefa';
import { useTodasPecas } from '../hooks/useTodasPecas';
import { useTodosFluidos } from '../hooks/useTodosFluidos';
import { useMecanicosDisponiveis } from '../hooks/useMecanicosDisponiveis';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import { ExecutarManutencaoForm } from './ExecutarManutencaoPage';
import { getRegistro, deleteRegistro } from '../utils/manutencaoRegistrosApi';
import { ACOES_MANUTENCAO, type ManutencaoRegistro } from '../types';

export default function EditarRegistroPage() {
  const { registroId = '' } = useParams<{ registroId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { temAcao } = useAuth();
  const podeEditar = temAcao(ACOES_MANUTENCAO.editar);

  const registro = useQuery<ManutencaoRegistro | null>({
    queryKey: ['manutencao', 'registro', registroId],
    queryFn: () => getRegistro(registroId),
    enabled: !!registroId,
  });

  const eq = useEquipamentoComStatus(registro.data?.equipamentoId);
  const tarefa = useManutencaoTarefa(registro.data?.tarefaId);
  const pecasCat = useTodasPecas();
  const fluidosCat = useTodosFluidos();
  const mecanicos = useMecanicosDisponiveis();

  const [excluirOpen, setExcluirOpen] = useState(false);
  const excluir = useMutation({
    mutationFn: () => deleteRegistro(registroId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      const equipId = registro.data?.equipamentoId;
      navigate(equipId ? `/manutencao/frota/${equipId}` : '/manutencao/frota');
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'Erro ao deletar'),
  });

  if (!podeEditar) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para editar registros de manutenção.
      </Card>
    );
  }

  if (registro.isLoading || eq.isLoading || tarefa.isLoading) {
    return <ManutencaoLoadingState />;
  }
  if (registro.error) {
    return <ManutencaoErrorState erro={registro.error} onRetry={() => registro.refetch()} />;
  }
  if (!registro.data) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Registro "{registroId}" não encontrado.
      </Card>
    );
  }
  if (!eq.data || !tarefa.data) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Equipamento ou tarefa associados ao registro não foram encontrados.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ExecutarManutencaoForm
        mode="editar"
        equipamentoId={registro.data.equipamentoId}
        tarefaId={registro.data.tarefaId}
        agendamentoId={registro.data.agendamentoId ?? undefined}
        eq={eq.data}
        tarefa={tarefa.data}
        pecasCatalog={pecasCat.data ?? []}
        fluidosCatalog={fluidosCat.data ?? []}
        mecanicos={mecanicos.data ?? []}
        initialRegistro={registro.data}
      />

      <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => setExcluirOpen(true)}
          disabled={excluir.isPending}
        >
          {excluir.isPending ? 'Deletando...' : 'Deletar registro'}
        </Button>
      </div>

      <ConfirmDialog
        open={excluirOpen}
        onClose={() => setExcluirOpen(false)}
        onConfirm={() => excluir.mutate()}
        title="Deletar registro de manutenção"
        message="Tem certeza que deseja deletar este registro? As fotos serão removidas permanentemente do bucket. Esta ação NÃO reverte agendamentos futuros que foram gerados a partir deste registro."
        requirePassword={false}
      />
    </div>
  );
}

export { EditarRegistroPage };
