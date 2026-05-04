import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dbToDeposito, depositoToDb } from '../lib/mappers';
import type { Deposito } from '../types';

/**
 * Lista depósitos. Por default oculta depósitos externos (eh_externo=true) —
 * tanques controlados por terceiros (Transterra/Areacre etc) que não devem
 * aparecer em forms operacionais (entrada/saída pra equipamento próprio/
 * transferência), porque triggers no DB bloqueiam essas operações neles.
 *
 * Pra ver TODOS os depósitos (telas de gestão de tanques, dashboards
 * financeiros, form de carreta), passe `{ incluirExternos: true }` ou use
 * o wrapper `useTodosDepositos`.
 *
 * Cache: queryKey é fixa em ['depositos'] — fetch único, filtro no `select`
 * por consumer. Variantes (default vs incluirExternos) compartilham cache.
 */
export function useDepositos(options?: { incluirExternos?: boolean }) {
  const incluirExternos = options?.incluirExternos ?? false;
  const select = useCallback(
    (data: Deposito[]) => (incluirExternos ? data : data.filter((d) => !d.ehExterno)),
    [incluirExternos]
  );
  return useQuery({
    queryKey: ['depositos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('depositos').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToDeposito);
    },
    select,
  });
}

/** Açúcar pra `useDepositos({ incluirExternos: true })`. Útil em configs
 *  que recebem o hook como referência sem aceitar args (ex: tanques.config). */
export function useTodosDepositos() {
  return useDepositos({ incluirExternos: true });
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

