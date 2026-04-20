import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToHistoricoInspecao, historicoInspecaoToDb } from '../lib/mappers';
import type { HistoricoInspecao } from '../types';

export function useHistoricoInspecao() {
  return useQuery({
    queryKey: ['historico_inspecao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_inspecao')
        .select('*')
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToHistoricoInspecao);
    },
  });
}

export function useAdicionarHistoricoInspecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (registro: HistoricoInspecao) => {
      const payload = historicoInspecaoToDb(registro);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = payload;
      const { error } = await supabase.from('historico_inspecao').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['historico_inspecao'] }),
  });
}

export function useAtualizarHistoricoInspecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (registro: HistoricoInspecao) => {
      const { error } = await supabase
        .from('historico_inspecao')
        .update(historicoInspecaoToDb(registro))
        .eq('id', registro.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['historico_inspecao'] }),
  });
}

export function useExcluirHistoricoInspecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('historico_inspecao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['historico_inspecao'] }),
  });
}
