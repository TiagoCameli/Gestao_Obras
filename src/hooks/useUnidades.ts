import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToUnidadeMedida, unidadeMedidaToDb } from '../lib/mappers';
import type { UnidadeMedida } from '../types';

export function useUnidades() {
  return useQuery({
    queryKey: ['unidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades_medida').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToUnidadeMedida);
    },
  });
}

export function useAdicionarUnidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unidade: UnidadeMedida) => {
      const { error } = await supabase.from('unidades_medida').insert(unidadeMedidaToDb(unidade));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unidades'] }),
  });
}

export function useAtualizarUnidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unidade: UnidadeMedida) => {
      const { error } = await supabase.from('unidades_medida').update(unidadeMedidaToDb(unidade)).eq('id', unidade.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unidades'] }),
  });
}

export function useExcluirUnidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('unidades_medida').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unidades'] }),
  });
}
