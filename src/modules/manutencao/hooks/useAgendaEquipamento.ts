import { useQuery } from '@tanstack/react-query';
import { listAgendamentos } from '../utils/manutencaoAgendamentosApi';

const KEY = (equipamentoId: string | undefined) =>
  ['manutencao', 'agenda', equipamentoId ?? ''] as const;

/**
 * Lista todos os agendamentos abertos (futuros + atrasados) de um equipamento,
 * ordenados por data prevista.
 */
export function useAgendaEquipamento(equipamentoId: string | undefined) {
  return useQuery({
    queryKey: KEY(equipamentoId),
    queryFn: () =>
      listAgendamentos({
        equipamentoId: equipamentoId!,
        status: ['agendada', 'atrasada'],
      }),
    enabled: !!equipamentoId,
  });
}
