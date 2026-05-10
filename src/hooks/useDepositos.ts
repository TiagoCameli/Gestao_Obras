import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dbToDeposito, depositoToDb } from '../lib/mappers';
import type { Deposito } from '../types';
import { useAuth } from '../contexts/AuthContext';

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
      // F8.4 — soft delete: filtra deleted_at IS NULL.
      const { data, error } = await supabase
        .from('depositos')
        .select('*')
        .is('deleted_at', null);
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
  const { usuario } = useAuth();
  return useMutation({
    // F8.4 — soft delete: marca deleted_at + deleted_by em vez de DELETE.
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('depositos')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depositos'] });
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
    },
  });
}

