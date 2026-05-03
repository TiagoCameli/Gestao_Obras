import { useQuery } from '@tanstack/react-query';
import { getTarefa } from '../utils/manutencaoTarefasApi';
import type { ManutencaoTarefa } from '../types';

export function useManutencaoTarefa(tarefaId: string | undefined) {
  return useQuery<ManutencaoTarefa | null>({
    queryKey: ['manutencao', 'tarefa', tarefaId ?? ''],
    queryFn: () => getTarefa(tarefaId!),
    enabled: !!tarefaId,
  });
}

export default useManutencaoTarefa;
