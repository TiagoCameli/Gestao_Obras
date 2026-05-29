import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaPranchaVersao,
  type EngenhariaPranchaVersao,
  type EngenhariaPranchaVersaoRow,
} from '../types/prancha';

export function usePranchaVersoes(pranchaId: string) {
  return useQuery({
    queryKey: ['engenharia', 'pranchas', 'versoes', pranchaId],
    queryFn: async (): Promise<EngenhariaPranchaVersao[]> => {
      const { data, error } = await supabase
        .from('engenharia_pranchas_versoes')
        .select('*')
        .eq('prancha_id', pranchaId)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaPranchaVersao(r as EngenhariaPranchaVersaoRow));
    },
    enabled: !!pranchaId,
  });
}
