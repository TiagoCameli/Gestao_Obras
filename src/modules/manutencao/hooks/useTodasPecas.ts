import { useQuery } from '@tanstack/react-query';
import { listPecas } from '../utils/manutencaoPecasApi';
import type { Peca } from '../types';

export function useTodasPecas() {
  return useQuery<Peca[]>({
    queryKey: ['manutencao', 'pecas-catalog'],
    queryFn: () => listPecas(),
  });
}

export default useTodasPecas;
