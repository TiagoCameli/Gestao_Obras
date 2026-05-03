import { useQuery } from '@tanstack/react-query';
import { countEquipamentosPorModelo } from '../utils/equipamentoModelosApi';

export function useContagemEquipamentosPorModelo() {
  return useQuery<Record<string, number>>({
    queryKey: ['manutencao', 'contagem-equipamentos-por-modelo'],
    queryFn: () => countEquipamentosPorModelo(),
  });
}

export default useContagemEquipamentosPorModelo;
