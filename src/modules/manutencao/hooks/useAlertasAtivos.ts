import { useQuery } from '@tanstack/react-query';
import { listAlertas, type FiltrosAlerta } from '../utils/manutencaoAlertasApi';
import type { ManutencaoAlerta } from '../types';

export function useAlertasAtivos(extraFiltros?: Omit<FiltrosAlerta, 'abertos'>) {
  return useQuery<ManutencaoAlerta[]>({
    queryKey: ['manutencao', 'alertas-ativos', extraFiltros ?? {}],
    queryFn: () => listAlertas({ ...extraFiltros, abertos: true }),
  });
}

export default useAlertasAtivos;
