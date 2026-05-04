import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Retorna o saldo devedor de combustível de uma transportadora — soma dos
 * débitos (debito_abastecimento_transterra + debito_abastecimento_emt)
 * AINDA NÃO ABATIDOS em pagamento (abatido_em_pagamento_id IS NULL).
 *
 * Wrapping da function SQL `saldo_devedor_combustivel(transportadora_id, ate_data)`
 * (criada na Fase 1c, migration 070).
 *
 * Usado pelo PagamentoFreteForm na Fase 4 pra sugerir abatimento automático
 * ao selecionar uma transportadora.
 *
 * @param ateData ISO timestamptz opcional. Default = now() (no servidor).
 */
export function useSaldoDevedorCombustivel(
  transportadoraId: string | null | undefined,
  ateData?: string
) {
  return useQuery({
    queryKey: ['saldo_devedor_combustivel', transportadoraId, ateData ?? null],
    enabled: !!transportadoraId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('saldo_devedor_combustivel', {
        p_transportadora_id: transportadoraId!,
        ...(ateData ? { p_ate_data: ateData } : {}),
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}
