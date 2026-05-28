import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaCalculoVersao,
  type EngenhariaCalculoVersao,
  type EngenhariaCalculoVersaoRow,
} from '../types/calculo';

export function useCalculoVersoes(calculoId: string) {
  return useQuery({
    queryKey: ['engenharia', 'calculos', 'versoes', calculoId],
    queryFn: async (): Promise<EngenhariaCalculoVersao[]> => {
      const { data, error } = await supabase
        .from('engenharia_calculos_versoes')
        .select('*')
        .eq('calculo_id', calculoId)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaCalculoVersao(r as EngenhariaCalculoVersaoRow));
    },
    enabled: !!calculoId,
  });
}

export function useRestaurarVersaoCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      calculoId: string;
      versaoAlvo: EngenhariaCalculoVersao;
      versaoAtual: number;
      tituloAtual: string;
      alertaAtivoAtual: boolean;
    }) => {
      const { data, error } = await supabase.rpc('engenharia_salvar_calculo_com_versao', {
        p_calculo_id: input.calculoId,
        p_titulo: input.tituloAtual,
        p_documento_json: input.versaoAlvo.documento,
        p_alerta_ativo: input.alertaAtivoAtual,
        p_versao_atual: input.versaoAtual,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) throw new Error(row?.motivo ?? 'sem detalhe');
      return row.nova_versao as number;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['engenharia', 'calculos', 'item', vars.calculoId] });
      qc.invalidateQueries({ queryKey: ['engenharia', 'calculos', 'versoes', vars.calculoId] });
    },
  });
}
