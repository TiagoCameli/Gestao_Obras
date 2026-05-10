import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToFrete, freteToDb } from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import type { Frete } from '../types';

// FF.4 — soft delete: lista padrão omite registros com deleted_at preenchido.
// Para visualizar os deletados (aba Lixeira) use useFretesDeletados().
export function useFretes() {
  return useQuery({
    queryKey: ['fretes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fretes')
        .select('*')
        .is('deleted_at', null);
      if (error) throw error;
      return (data ?? []).map(dbToFrete);
    },
  });
}

export function useFretesDeletados() {
  return useQuery({
    queryKey: ['fretes_deletados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fretes')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToFrete);
    },
  });
}

export function useAdicionarFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (frete: Frete) => {
      const { error } = await supabase.from('fretes').insert(freteToDb(frete));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fretes'] });
    },
  });
}

export function useAtualizarFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (frete: Frete) => {
      const { error } = await supabase
        .from('fretes')
        .update(freteToDb(frete))
        .eq('id', frete.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fretes'] });
    },
  });
}

// FF.4 — soft delete: UPDATE deleted_at/deleted_by em vez de DELETE.
// Trigger DB grava entry no audit_log com tipo "fretes_delete". Restore via
// useRestaurarFrete().
export function useExcluirFrete() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fretes')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fretes'] });
      qc.invalidateQueries({ queryKey: ['fretes_deletados'] });
    },
  });
}

export function useRestaurarFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fretes')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fretes'] });
      qc.invalidateQueries({ queryKey: ['fretes_deletados'] });
    },
  });
}
