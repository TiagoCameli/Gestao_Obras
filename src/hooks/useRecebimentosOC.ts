/**
 * useRecebimentosOC — Hooks de leitura e mutação de recebimentos de OC.
 *
 * Recebimento de OC é o ato de registrar a chegada física do material/
 * peça/combustível de uma Ordem de Compra. Uma OC pode ser recebida em
 * VÁRIAS remessas (parcial) — cada remessa é um RecebimentoOC com seus
 * itens, datas e nota fiscal próprios.
 *
 * Fluxo de uma confirmação:
 *   1) cria RecebimentoOC (header + itens em JSONB)
 *   2) PARA CADA ITEM (que tem depósito/tanque resolvido):
 *        - se combustível → cria EntradaCombustivel
 *        - se material/peça → cria EntradaMaterial
 *   3) amarra IDs das entradas no item do recebimento (campo entrada*Id)
 *   4) atualiza status da OC pra 'recebida' SE quantidade total recebida
 *      == soma total dos itens da OC; senão mantém 'aprovada' (parcial)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToRecebimentoOC, recebimentoOCToDb } from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import type { RecebimentoOC } from '../types';

/** Lista TODOS os recebimentos (filtra deletados). */
export function useRecebimentosOC() {
  return useQuery({
    queryKey: ['recebimentos_oc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recebimentos_oc')
        .select('*')
        .is('deletado_em', null)
        .order('recebido_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToRecebimentoOC);
    },
  });
}

/** Lista recebimentos de uma OC específica (ordenado por número de remessa). */
export function useRecebimentosDaOC(ordemCompraId?: string) {
  return useQuery({
    queryKey: ['recebimentos_oc', 'oc', ordemCompraId],
    enabled: Boolean(ordemCompraId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recebimentos_oc')
        .select('*')
        .eq('ordem_compra_id', ordemCompraId)
        .is('deletado_em', null)
        .order('numero_remessa', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToRecebimentoOC);
    },
  });
}

/**
 * Cria um novo recebimento de OC. Não gera EntradaMaterial / EntradaCombustivel
 * automaticamente — quem chama deve compor essa lógica usando o hook
 * `useConfirmarRecebimentoOC` (em useConfirmarRecebimentoOC.ts), que
 * orquestra tudo numa transação lógica.
 */
export function useAdicionarRecebimentoOC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: RecebimentoOC) => {
      const { error } = await supabase
        .from('recebimentos_oc')
        .insert(recebimentoOCToDb(rec));
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['recebimentos_oc'] });
      qc.invalidateQueries({ queryKey: ['recebimentos_oc', 'oc', vars.ordemCompraId] });
      qc.invalidateQueries({ queryKey: ['ordens_compra'] });
    },
  });
}

/** Atualiza um recebimento (ex: amarrar entradaMaterialId após persistir entrada). */
export function useAtualizarRecebimentoOC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: RecebimentoOC) => {
      const { error } = await supabase
        .from('recebimentos_oc')
        .update(recebimentoOCToDb(rec))
        .eq('id', rec.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['recebimentos_oc'] });
      qc.invalidateQueries({ queryKey: ['recebimentos_oc', 'oc', vars.ordemCompraId] });
    },
  });
}

/** Soft-delete: marca deletado_em/deletado_por. Reverte entradas? NÃO — quem
 *  apaga recebimento deve manualmente excluir as EntradaMaterial/Combustivel
 *  associadas (rastreabilidade fica via entradaMaterialId/entradaCombustivelId). */
export function useExcluirRecebimentoOC() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recebimentos_oc')
        .update({
          deletado_em: new Date().toISOString(),
          deletado_por: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recebimentos_oc'] });
    },
  });
}
