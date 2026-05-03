import { useQuery } from '@tanstack/react-query';
import { getEquipamentoModelo } from '../utils/equipamentoModelosApi';

const KEY = (id: string | undefined) => ['manutencao', 'modelo', id ?? ''] as const;

export function useEquipamentoModelo(id: string | undefined) {
  return useQuery({
    queryKey: KEY(id),
    queryFn: () => getEquipamentoModelo(id!),
    enabled: !!id,
  });
}
