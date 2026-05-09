// F3.D.1 — Hooks pra "verificar" anomalias do módulo Combustível.
//
// Anomalias são detectadas client-side (puro, stateless) com IDs determinísticos
// (ver detect.ts). Quando o usuário revisa uma anomalia e decide "OK, já foi
// resolvida fora do sistema" ou "falso positivo", marca como verificada via
// useMarcarVerificada. O check fica gravado no Supabase (anomalias_checks)
// com timestamp + autor + motivo opcional, visível pra todos os usuários.
//
// IDs estão entre [D1-{saidaId}, D2-{saidaId}, D3-{saidaId}, D4-{ids-joined},
// D5-{equipId}]. Se a saída-base de uma D1/D2/D3 for deletada ou se o pair
// D4 perder uma metade, a anomalia some do detect output e o check fica órfão
// (mas não atrapalha — só não vai mais aparecer associado a uma anomalia ativa).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AnomaliaCheck {
  id: string; // ex: "D4-mfuelbkf05-mfuelbkf06"
  checkedAt: string; // ISO timestamp
  checkedBy: string | null;
  motivo: string | null;
}

interface AnomaliaCheckRow {
  id: string;
  checked_at: string;
  checked_by: string | null;
  motivo: string | null;
}

function dbToCheck(r: AnomaliaCheckRow): AnomaliaCheck {
  return {
    id: r.id,
    checkedAt: r.checked_at,
    checkedBy: r.checked_by,
    motivo: r.motivo,
  };
}

/** Lista todas as anomalias verificadas — tipicamente um conjunto pequeno
 *  (alguns dezenas/centenas). Caller usa Map.has(id) pra checar O(1). */
export function useAnomaliasChecks() {
  return useQuery({
    queryKey: ['anomalias_checks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomalias_checks')
        .select('*')
        .order('checked_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as AnomaliaCheckRow[];
      const map = new Map<string, AnomaliaCheck>();
      for (const r of rows) map.set(r.id, dbToCheck(r));
      return map;
    },
  });
}

interface MarcarPayload {
  anomaliaId: string;
  checkedBy: string | null;
  motivo?: string | null;
}

/** Marca anomalia como verificada (idempotente — upsert). Útil pra "já vi,
 *  não precisa fazer nada" tipo falso positivo ou já resolvido externamente. */
export function useMarcarAnomaliaVerificada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ anomaliaId, checkedBy, motivo }: MarcarPayload) => {
      const { error } = await supabase
        .from('anomalias_checks')
        .upsert(
          {
            id: anomaliaId,
            checked_at: new Date().toISOString(),
            checked_by: checkedBy,
            motivo: motivo ?? null,
          },
          { onConflict: 'id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anomalias_checks'] });
    },
  });
}

/** Desfaz a verificação — anomalia volta a aparecer ativa na lista. */
export function useDesfazerVerificacaoAnomalia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anomaliaId: string) => {
      const { error } = await supabase
        .from('anomalias_checks')
        .delete()
        .eq('id', anomaliaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anomalias_checks'] });
    },
  });
}
