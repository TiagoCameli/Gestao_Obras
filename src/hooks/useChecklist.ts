import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToChecklistEquipamento, checklistEquipamentoToDb } from '../lib/mappers';
import type { ChecklistEquipamento } from '../types';

export function useChecklists() {
  return useQuery({
    queryKey: ['checklists_equipamento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklists_equipamento')
        .select('*')
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToChecklistEquipamento);
    },
  });
}

export function useAdicionarChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checklist: ChecklistEquipamento) => {
      const payload = checklistEquipamentoToDb(checklist);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = payload;
      const { error } = await supabase.from('checklists_equipamento').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists_equipamento'] }),
  });
}

export function useAtualizarChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checklist: ChecklistEquipamento) => {
      const { error } = await supabase
        .from('checklists_equipamento')
        .update(checklistEquipamentoToDb(checklist))
        .eq('id', checklist.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists_equipamento'] }),
  });
}

export function useExcluirChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklists_equipamento').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists_equipamento'] }),
  });
}
