import { useQuery } from '@tanstack/react-query';
import { listRegistros } from '../utils/manutencaoRegistrosApi';
import type { ManutencaoRegistro } from '../types';

export function useHistoricoManutencao(equipamentoId: string | undefined) {
  return useQuery<ManutencaoRegistro[]>({
    queryKey: ['manutencao', 'historico', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      if (!equipamentoId) return [];
      return listRegistros({ equipamentoId });
    },
  });
}

export default useHistoricoManutencao;
