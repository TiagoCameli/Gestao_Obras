import { useQuery } from '@tanstack/react-query';
import { listTarefasPorModelo } from '../utils/manutencaoTarefasApi';

const KEY = (modeloId: string | undefined) =>
  ['manutencao', 'tarefas', modeloId ?? ''] as const;

export function useManutencaoTarefas(modeloId: string | undefined) {
  return useQuery({
    queryKey: KEY(modeloId),
    queryFn: () => listTarefasPorModelo(modeloId!),
    enabled: !!modeloId,
  });
}
