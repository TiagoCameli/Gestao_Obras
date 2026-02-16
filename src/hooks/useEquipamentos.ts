import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEquipamento, equipamentoToDb } from '../lib/mappers';
import type { Equipamento } from '../types';

export function useEquipamentos() {
  return useQuery({
    queryKey: ['equipamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipamentos').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToEquipamento);
    },
  });
}

export function useAdicionarEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (equipamento: Equipamento) => {
      const { error } = await supabase.from('equipamentos').insert(equipamentoToDb(equipamento));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipamentos'] }),
  });
}

export function useAtualizarEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (equipamento: Equipamento) => {
      const { error } = await supabase.from('equipamentos').update(equipamentoToDb(equipamento)).eq('id', equipamento.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipamentos'] }),
  });
}

export function useExcluirEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipamentos'] }),
  });
}
