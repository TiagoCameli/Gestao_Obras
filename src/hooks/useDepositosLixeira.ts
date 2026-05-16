/**
 * Hooks da lixeira de Depósitos.
 *
 * - useDepositosLixeira(): lista itens não restaurados dentro da retenção
 * - useRestaurarDepositoLixeira: limpa deletado_em + marca restaurado
 * - useExcluirPermanenteDeposito: hard delete (registro original + lixeira)
 * - usePurgarLixeiraDepositos: chama a função SQL de purga
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type EntidadeDeposito = 'deposito' | 'entrada' | 'saida' | 'transferencia';

export interface DepositoLixeiraItem {
  id: string;
  entidade: EntidadeDeposito;
  entidadeId: string;
  payload: Record<string, unknown>;
  deletadoPor: string;
  deletadoEm: string;
  retencaoAte: string;
  restauradoEm?: string;
  restauradoPor?: string;
}

const TABELA_POR_ENTIDADE: Record<EntidadeDeposito, string> = {
  deposito: 'depositos_material',
  entrada: 'entradas_material',
  saida: 'saidas_material',
  transferencia: 'transferencias_material',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToLixeira(row: any): DepositoLixeiraItem {
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

export function useDepositosLixeira() {
  return useQuery<DepositoLixeiraItem[]>({
    queryKey: ['depositos_lixeira'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('depositos_lixeira')
        .select('*')
        .is('restaurado_em', null)
        .order('deletado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToLixeira);
    },
  });
}

interface RestaurarParams {
  item: DepositoLixeiraItem;
  usuarioNome: string;
}

export function useRestaurarDepositoLixeira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, usuarioNome }: RestaurarParams) => {
      const tabela = TABELA_POR_ENTIDADE[item.entidade];
      const { error: e1 } = await supabase
        .from(tabela)
        .update({ deletado_em: null, deletado_por: null })
        .eq('id', item.entidadeId);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('depositos_lixeira')
        .update({ restaurado_em: new Date().toISOString(), restaurado_por: usuarioNome })
        .eq('id', item.id);
      if (e2) throw e2;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['depositos_lixeira'] });
      qc.invalidateQueries({ queryKey: ['depositos_material_v2'] });
      qc.invalidateQueries({ queryKey: [TABELA_POR_ENTIDADE[vars.item.entidade]] });
      qc.invalidateQueries({ queryKey: ['saldos_deposito'] });
      qc.invalidateQueries({ queryKey: ['resumo_saldos_todos'] });
    },
  });
}

interface ExcluirParams {
  item: DepositoLixeiraItem;
  usuarioNome: string;
}

export function useExcluirPermanenteDeposito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item }: ExcluirParams) => {
      const tabela = TABELA_POR_ENTIDADE[item.entidade];
      await supabase.from(tabela).delete().eq('id', item.entidadeId);
      const { error } = await supabase.from('depositos_lixeira').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depositos_lixeira'] });
      qc.invalidateQueries({ queryKey: ['depositos_material_v2'] });
    },
  });
}

export function usePurgarLixeiraDepositos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('depositos_purgar_lixeira_expirada');
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depositos_lixeira'] });
    },
  });
}
