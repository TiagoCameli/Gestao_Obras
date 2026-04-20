import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTipoEquipamento, tipoEquipamentoToDb } from '../lib/mappers';
import type { TipoEquipamentoEntity } from '../types';

export function useTiposEquipamento() {
  return useQuery({
    queryKey: ['tipos_equipamento'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_equipamento').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToTipoEquipamento);
    },
  });
}

export function useAdicionarTipoEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipo: TipoEquipamentoEntity) => {
      const { error } = await supabase.from('tipos_equipamento').insert(tipoEquipamentoToDb(tipo));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos_equipamento'] }),
  });
}
