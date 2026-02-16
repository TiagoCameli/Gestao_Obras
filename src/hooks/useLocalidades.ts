import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToLocalidade, localidadeToDb } from '../lib/mappers';
import type { Localidade } from '../types';

export function useLocalidades() {
  return useQuery({
    queryKey: ['localidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('localidades').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToLocalidade);
    },
  });
}

export function useAdicionarLocalidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (localidade: Localidade) => {
      const { error } = await supabase.from('localidades').insert(localidadeToDb(localidade));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['localidades'] }),
  });
}
