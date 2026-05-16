/**
 * Hooks para a Lixeira do módulo Compras.
 *
 * Soft-delete: ao excluir um registro, é marcado `deletado_em/deletado_por`
 * e um snapshot é gravado em `compras_lixeira` (com retenção 30 dias via DEFAULT).
 *
 * Hooks:
 *  - useComprasLixeira(): lista todos os itens não-restaurados ainda dentro da retenção
 *  - useRestaurarLixeira: restaura um item (limpa deletado_em do registro original
 *      + grava restaurado_em/por na lixeira + auditoria 'restored')
 *  - useExcluirPermanente: hard-delete do registro original + remove da lixeira
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { auditar } from '../utils/comprasAudit';
import type { ComprasLixeiraItem, EntidadeCompra } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToLixeira(row: any): ComprasLixeiraItem {
  return {
    id: row.id,
    entidade: row.entidade,
    entidadeId: row.entidade_id,
    payload: row.payload ?? {},
    deletadoPor: row.deletado_por ?? '',
    deletadoEm: row.deletado_em,
    retencaoAte: row.retencao_ate,
    restauradoEm: row.restaurado_em ?? undefined,
    restauradoPor: row.restaurado_por ?? undefined,
  };
}

const TABELA_POR_ENTIDADE: Record<EntidadeCompra, string> = {
  pedido: 'pedidos_compra',
  cotacao: 'cotacoes',
  oc: 'ordens_compra',
};

/**
 * Lista itens da lixeira que ainda não foram restaurados e estão dentro da retenção.
 */
export function useComprasLixeira() {
  return useQuery<ComprasLixeiraItem[]>({
    queryKey: ['compras_lixeira'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compras_lixeira')
        .select('*')
        .is('restaurado_em', null)
        .order('deletado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToLixeira);
    },
  });
}

interface RestaurarParams {
  item: ComprasLixeiraItem;
  usuarioNome: string;
}

export function useRestaurarLixeira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, usuarioNome }: RestaurarParams) => {
      const tabela = TABELA_POR_ENTIDADE[item.entidade];

      // 1) Limpa deletado_em/por no registro original
      const { error: e1 } = await supabase
        .from(tabela)
        .update({ deletado_em: null, deletado_por: null })
        .eq('id', item.entidadeId);
      if (e1) throw e1;

      // 2) Marca restaurado na lixeira
      const agora = new Date().toISOString();
      const { error: e2 } = await supabase
        .from('compras_lixeira')
        .update({ restaurado_em: agora, restaurado_por: usuarioNome })
        .eq('id', item.id);
      if (e2) throw e2;

      // 3) Auditoria
      await auditar({
        entidade: item.entidade,
        entidadeId: item.entidadeId,
        acao: 'restored',
        usuarioNome,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['compras_lixeira'] });
      const tabela = TABELA_POR_ENTIDADE[vars.item.entidade];
      qc.invalidateQueries({ queryKey: [tabela] });
      // Também invalida as queries usadas pelos hooks individuais
      qc.invalidateQueries({ queryKey: ['pedidos_compra'] });
      qc.invalidateQueries({ queryKey: ['cotacoes'] });
      qc.invalidateQueries({ queryKey: ['ordens_compra'] });
    },
  });
}

interface ExcluirPermParams {
  item: ComprasLixeiraItem;
  usuarioNome: string;
}

export function useExcluirPermanente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, usuarioNome }: ExcluirPermParams) => {
      const tabela = TABELA_POR_ENTIDADE[item.entidade];

      // Auditoria primeiro (depois o registro original some)
      await auditar({
        entidade: item.entidade,
        entidadeId: item.entidadeId,
        acao: 'deleted',
        usuarioNome,
        observacao: 'Excluído permanentemente da lixeira',
      });

      // 1) Hard-delete do registro original (ignora erros se já não existir)
      await supabase.from(tabela).delete().eq('id', item.entidadeId);
      // 2) Hard-delete da lixeira
      const { error } = await supabase.from('compras_lixeira').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras_lixeira'] });
      qc.invalidateQueries({ queryKey: ['pedidos_compra'] });
      qc.invalidateQueries({ queryKey: ['cotacoes'] });
      qc.invalidateQueries({ queryKey: ['ordens_compra'] });
    },
  });
}

/**
 * Limpeza manual de itens expirados (>30 dias). Pode ser chamado via botão
 * "Limpar expirados" no modal de Lixeira ou via cron externo.
 */
export function usePurgarExpirados() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const agora = new Date().toISOString();
      // 1) Lista expirados (não restaurados + retencao_ate < agora)
      const { data: expirados, error: e1 } = await supabase
        .from('compras_lixeira')
        .select('*')
        .is('restaurado_em', null)
        .lt('retencao_ate', agora);
      if (e1) throw e1;
      if (!expirados || expirados.length === 0) return 0;

      // 2) Hard-delete de cada um (registro original + entrada lixeira)
      for (const row of expirados) {
        const tabela = TABELA_POR_ENTIDADE[row.entidade as EntidadeCompra];
        await supabase.from(tabela).delete().eq('id', row.entidade_id);
      }
      const ids = expirados.map((r) => r.id);
      const { error: e2 } = await supabase.from('compras_lixeira').delete().in('id', ids);
      if (e2) throw e2;
      return expirados.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras_lixeira'] });
    },
  });
}
