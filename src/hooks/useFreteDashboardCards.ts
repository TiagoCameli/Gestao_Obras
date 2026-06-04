// src/hooks/useFreteDashboardCards.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const QUERY_KEY = ['frete-dashboard-cards'] as const;
const TABELA = 'frete_dashboard_cards_config';
const ID_GLOBAL = 'global';

/** Lê o array ordenado de fornecedor_ids que devem virar card de saldo. */
export function useFreteDashboardCards() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from(TABELA)
        .select('fornecedor_ids')
        .eq('id', ID_GLOBAL)
        .maybeSingle();
      if (error) throw error;
      return (data?.fornecedor_ids ?? []) as string[];
    },
  });
}

/** Salva o array de fornecedor_ids na config global (uma linha só). */
export function useSalvarFreteDashboardCards() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (fornecedorIds: string[]) => {
      // `.select()` + checagem de 0 linhas: se o RLS bloquear, o Supabase
      // devolve sucesso com 0 linhas. Tratamos como falha explícita.
      const { data, error } = await supabase
        .from(TABELA)
        .update({
          fornecedor_ids: fornecedorIds,
          updated_at: new Date().toISOString(),
          updated_por: usuario?.funcionarioId ?? '',
        })
        .eq('id', ID_GLOBAL)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'Não foi possível salvar os cards: você não tem permissão (nenhuma linha foi alterada).',
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
