import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToTransportadoraSaldo } from '../lib/mappers';
import type { TransportadoraSaldo } from '../types';

/**
 * Saldo agregado de UMA transportadora via view transportadora_saldos.
 * Read-only — saldo derivado dos movimentos.
 *
 * ATENÇÃO: até a Fase 4 substituir o cálculo inline do FreteDashboard,
 * esta view é a fonte canônica de saldo (validada na Fase 2 ≤ R$ 0,01
 * vs lógica legada).
 */
export function useTransportadoraSaldo(transportadoraId: string | null | undefined) {
  return useQuery({
    queryKey: ['transportadora_saldos', transportadoraId],
    enabled: !!transportadoraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transportadora_saldos')
        .select('*')
        .eq('transportadora_id', transportadoraId!)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToTransportadoraSaldo(data) : null;
    },
  });
}

/**
 * Lista TODOS os saldos (todas as transportadoras com eh_transportadora=true).
 * Usado em dashboards e na tela "Conta corrente das transportadoras" da Fase 4.
 */
export function useTodosSaldosTransportadora() {
  return useQuery({
    queryKey: ['transportadora_saldos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transportadora_saldos')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToTransportadoraSaldo) as TransportadoraSaldo[];
    },
  });
}
