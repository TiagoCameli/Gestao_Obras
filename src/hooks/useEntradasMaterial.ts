import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEntradaMaterial, entradaMaterialToDb } from '../lib/mappers';
import type { EntradaMaterial } from '../types';

export function useEntradasMaterial() {
  return useQuery({
    queryKey: ['entradas_material'],
    queryFn: async () => {
      // Paginação obrigatória: o PostgREST corta em 1000 linhas por request
      // (default do Supabase). Sem .range(), a listagem de entradas e o
      // contexto de dedup de NF do import (criarEntradasCtx) descartariam
      // silenciosamente as entradas mais antigas assim que a tabela passasse
      // de 1000 linhas. Mesmo padrão de useSaidasCombustivel. Busca em
      // páginas de 1000 até esgotar; tiebreaker por id estabiliza a borda
      // das páginas (data_hora não é única).
      const PAGINA = 1000;
      const todas: unknown[] = [];
      for (let from = 0; ; from += PAGINA) {
        const { data, error } = await supabase
          .from('entradas_material')
          .select('*')
          .order('data_hora', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + PAGINA - 1);
        if (error) throw error;
        const lote = data ?? [];
        todas.push(...lote);
        if (lote.length < PAGINA) break;
      }
      return todas.map(dbToEntradaMaterial);
    },
  });
}

export function useAdicionarEntradaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaMaterial) => {
      const { error } = await supabase.from('entradas_material').insert(entradaMaterialToDb(entrada));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entradas_material'] }),
  });
}

export function useAtualizarEntradaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: EntradaMaterial) => {
      const { error } = await supabase
        .from('entradas_material')
        .update(entradaMaterialToDb(entrada))
        .eq('id', entrada.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entradas_material'] }),
  });
}

export function useExcluirEntradaMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('entradas_material').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entradas_material'] }),
  });
}

/**
 * Insert em lote pro import via Excel. Um único .insert(array) — não N chamadas.
 *
 * A proteção contra NF duplicada (`nfsLancadas`/`vistosNoArquivo` em
 * importEntradasPecas.ts) é só client-side, no parse. Não há constraint no
 * banco: dois imports simultâneos da mesma NF não são bloqueados — decisão
 * deliberada pra permitir complementar manualmente uma NF já lançada.
 */
export function useImportarEntradasMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entradas: EntradaMaterial[]) => {
      if (entradas.length === 0) return;
      const { data, error } = await supabase
        .from('entradas_material')
        .insert(entradas.map(entradaMaterialToDb))
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nenhuma entrada foi importada — possível negação de permissão (RLS).');
      }
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['entradas_material'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_total'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_deposito'] }),
      ]),
  });
}
