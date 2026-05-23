import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEtapa, etapaToDb } from '../lib/mappers';
import type { EtapaObra } from '../types';

export function useEtapas() {
  return useQuery({
    queryKey: ['etapas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('etapas_obra').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToEtapa);
    },
  });
}

export function useAdicionarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapa: EtapaObra) => {
      const { error } = await supabase.from('etapas_obra').insert(etapaToDb(etapa));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  });
}

export function useAtualizarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapa: EtapaObra) => {
      const { error } = await supabase.from('etapas_obra').update(etapaToDb(etapa)).eq('id', etapa.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  });
}

export function useExcluirEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('etapas_obra').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etapas'] });
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
    },
  });
}

export function useSalvarEtapasObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ obraId, etapas }: { obraId: string; etapas: EtapaObra[] }) => {
      // Delete existing etapas for this obra, then insert new ones
      const { error: delError } = await supabase.from('etapas_obra').delete().eq('obra_id', obraId);
      if (delError) throw delError;
      if (etapas.length > 0) {
        const { error: insError } = await supabase.from('etapas_obra').insert(etapas.map(etapaToDb));
        if (insError) throw insError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  });
}
