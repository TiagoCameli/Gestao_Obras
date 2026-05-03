import { useQuery } from '@tanstack/react-query';
import { listFluidos } from '../utils/manutencaoFluidosApi';
import type { Fluido } from '../types';

export function useTodosFluidos() {
  return useQuery<Fluido[]>({
    queryKey: ['manutencao', 'fluidos-catalog'],
    queryFn: () => listFluidos(),
  });
}

export default useTodosFluidos;
