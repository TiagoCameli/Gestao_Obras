import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaNotaVersao,
  type EngenhariaNotaVersao,
  type EngenhariaNotaVersaoRow,
} from '../types/nota';

export function useNotaVersoes(notaId: string) {
  return useQuery({
    queryKey: ['engenharia', 'notas', 'versoes', notaId],
    queryFn: async (): Promise<EngenhariaNotaVersao[]> => {
      const { data, error } = await supabase
        .from('engenharia_notas_versoes')
        .select('*')
        .eq('nota_id', notaId)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaNotaVersao(r as EngenhariaNotaVersaoRow));
    },
    enabled: !!notaId,
  });
}

/**
 * Restaurar versão antiga = chamar engenharia_salvar_nota_com_versao com o
 * conteúdo da versão escolhida. Mantém histórico (gera nova versão N+1).
 */
export function useRestaurarVersao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      notaId: string;
      versaoAlvo: EngenhariaNotaVersao;
      versaoAtual: number;
      tituloAtual: string;
    }) => {
      const { data, error } = await supabase.rpc('engenharia_salvar_nota_com_versao', {
        p_nota_id: input.notaId,
        p_titulo: input.tituloAtual,
        p_conteudo_json: input.versaoAlvo.conteudoJson,
        p_versao_atual: input.versaoAtual,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) throw new Error(row?.motivo ?? 'sem detalhe');
      return row.nova_versao as number;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['engenharia', 'notas', 'item', vars.notaId] });
      qc.invalidateQueries({ queryKey: ['engenharia', 'notas', 'versoes', vars.notaId] });
    },
  });
}
