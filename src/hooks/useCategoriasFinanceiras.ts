/**
 * useCategoriasFinanceiras — CRUD do plano de contas (lista plana).
 *
 * Lista plana de categorias de despesa/receita com seed inicial pré-cadastrado
 * (11 categorias padrão criadas via migration). Usuário pode editar nome,
 * desativar ou criar novas categorias.
 *
 * Categorias inativas não aparecem em formulários (combobox de seleção),
 * mas continuam visíveis no CRUD pra reativação e em lançamentos antigos
 * que ainda usam a categoria (não quebra histórico).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToCategoriaFinanceira, categoriaFinanceiraToDb } from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import type { CategoriaFinanceira } from '../types';

export function useCategoriasFinanceiras() {
  return useQuery({
    queryKey: ['financeiro_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_categorias')
        .select('*')
        .is('deletado_em', null)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToCategoriaFinanceira);
    },
  });
}

export function useAdicionarCategoriaFinanceira() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (cat: CategoriaFinanceira) => {
      const row = categoriaFinanceiraToDb({
        ...cat,
        criadoPor: usuario?.nome ?? '',
        criadoEm: new Date().toISOString(),
      });
      const { error } = await supabase.from('financeiro_categorias').insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financeiro_categorias'] }),
  });
}

export function useAtualizarCategoriaFinanceira() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (cat: CategoriaFinanceira) => {
      const row = categoriaFinanceiraToDb({
        ...cat,
        atualizadoPor: usuario?.nome,
        atualizadoEm: new Date().toISOString(),
      });
      const { error } = await supabase
        .from('financeiro_categorias')
        .update(row)
        .eq('id', cat.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financeiro_categorias'] }),
  });
}

export function useExcluirCategoriaFinanceira() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financeiro_categorias')
        .update({
          deletado_em: new Date().toISOString(),
          deletado_por: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financeiro_categorias'] }),
  });
}
