import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToRegistroHorasDiarista, registroHorasDiaristaToDb } from '../lib/mappers';
import type { RegistroHorasDiarista } from '../types';

export function useRegistrosHorasDiaristas() {
  return useQuery({
    queryKey: ['registros_horas_diaristas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registros_horas_diaristas')
        .select('*')
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToRegistroHorasDiarista);
    },
  });
}

export function useAdicionarRegistroHorasDiarista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reg: RegistroHorasDiarista) => {
      const { error } = await supabase.from('registros_horas_diaristas').insert(registroHorasDiaristaToDb(reg));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros_horas_diaristas'] }),
  });
}

export function useAtualizarRegistroHorasDiarista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reg: RegistroHorasDiarista) => {
      const { error } = await supabase.from('registros_horas_diaristas').update(registroHorasDiaristaToDb(reg)).eq('id', reg.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros_horas_diaristas'] }),
  });
}

export function useExcluirRegistroHorasDiarista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('registros_horas_diaristas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registros_horas_diaristas'] }),
  });
}
