// F11 — Hook pra registrar esvaziamento de tanque (descarte explícito).
// Usado quando o usuário precisa trocar o combustível dum tanque: insere
// uma linha que o trigger no DB transforma em saída de estoque (nível
// recalcula pra 0) + libera o combustivel_atual_id pra próxima entrada.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EsvaziamentoTanque } from '../types';
import { useAuth } from '../contexts/AuthContext';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToEsvaziamento(row: any): EsvaziamentoTanque {
  return {
    id: row.id,
    depositoId: row.deposito_id,
    dataHora: row.data_hora,
    litrosDescartados: Number(row.litros_descartados),
    motivo: row.motivo ?? '',
    criadoPor: row.criado_por ?? '',
  };
}

export function useEsvaziamentosTanque(depositoId?: string | null) {
  return useQuery({
    queryKey: ['esvaziamentos_tanque', depositoId ?? '__all'],
    queryFn: async () => {
      let q = supabase
        .from('esvaziamentos_tanque')
        .select('*')
        .order('data_hora', { ascending: false });
      if (depositoId) q = q.eq('deposito_id', depositoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(dbToEsvaziamento);
    },
  });
}

export interface NovoEsvaziamentoInput {
  depositoId: string;
  litrosDescartados: number;
  motivo: string;
}

export function useEsvaziarTanque() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (input: NovoEsvaziamentoInput) => {
      const { error } = await supabase.from('esvaziamentos_tanque').insert({
        id: gerarId(),
        deposito_id: input.depositoId,
        data_hora: new Date().toISOString(),
        litros_descartados: input.litrosDescartados,
        motivo: input.motivo,
        criado_por: usuario?.email ?? '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Trigger no DB já recalculou nível + combustivel_atual_id — invalida
      // depositos pra refletir e a lista de esvaziamentos pra histórico.
      qc.invalidateQueries({ queryKey: ['depositos'] });
      qc.invalidateQueries({ queryKey: ['esvaziamentos_tanque'] });
    },
  });
}
