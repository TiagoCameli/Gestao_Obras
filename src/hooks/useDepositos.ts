import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToDeposito, depositoToDb } from '../lib/mappers';
import type { Deposito } from '../types';

export function useDepositos() {
  return useQuery({
    queryKey: ['depositos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('depositos').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToDeposito);
    },
  });
}

export function useAdicionarDeposito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deposito: Deposito) => {
      const { error } = await supabase.from('depositos').insert(depositoToDb(deposito));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depositos'] }),
  });
}

export function useAtualizarDeposito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deposito: Deposito) => {
      const { error } = await supabase.from('depositos').update(depositoToDb(deposito)).eq('id', deposito.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depositos'] }),
  });
}

export function useExcluirDeposito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('depositos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depositos'] });
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
    },
  });
}

export function useSalvarDepositosObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ obraId, depositos }: { obraId: string; depositos: Deposito[] }) => {
      const { error: delError } = await supabase.from('depositos').delete().eq('obra_id', obraId);
      if (delError) throw delError;
      if (depositos.length > 0) {
        const { error: insError } = await supabase.from('depositos').insert(depositos.map(depositoToDb));
        if (insError) throw insError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depositos'] }),
  });
}
