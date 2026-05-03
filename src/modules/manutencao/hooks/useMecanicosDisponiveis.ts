import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export interface MecanicoDisponivel {
  id: string;
  nome: string;
  funcao: string;
}

const FUNCOES = ['MECÂNICO', 'AUXILIAR DE MECÂNICO'] as const;

/**
 * Lista mecânicos disponíveis (status='ativo') a partir de
 * `apont_funcionarios`, filtrando pela função operacional.
 */
export function useMecanicosDisponiveis() {
  return useQuery<MecanicoDisponivel[]>({
    queryKey: ['manutencao', 'mecanicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apont_funcionarios')
        .select('id, nome, funcao')
        .in('funcao', FUNCOES as unknown as string[])
        .eq('status', 'ativo')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MecanicoDisponivel[];
    },
  });
}

export default useMecanicosDisponiveis;
