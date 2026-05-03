import { useQuery } from '@tanstack/react-query';
import {
  listEquipamentoModelos,
  type FiltrosEquipamentoModelos,
} from '../utils/equipamentoModelosApi';

const KEY = (filtros?: FiltrosEquipamentoModelos) =>
  ['manutencao', 'modelos', filtros ?? null] as const;

export function useEquipamentoModelos(filtros?: FiltrosEquipamentoModelos) {
  return useQuery({
    queryKey: KEY(filtros),
    queryFn: () => listEquipamentoModelos(filtros),
  });
}
