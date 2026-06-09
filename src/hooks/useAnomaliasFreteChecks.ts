import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AnomaliaFreteCheck {
  id: string;
  checkedAt: string;
  checkedBy: string | null;
  motivo: string | null;
}

interface AnomaliaFreteCheckRow {
  id: string;
  checked_at: string;
  checked_by: string | null;
  motivo: string | null;
}

function dbToCheck(r: AnomaliaFreteCheckRow): AnomaliaFreteCheck {
  return { id: r.id, checkedAt: r.checked_at, checkedBy: r.checked_by, motivo: r.motivo };
}

export function useAnomaliasFreteChecks() {
  return useQuery({
    queryKey: ['anomalias_frete_checks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomalias_frete_checks')
        .select('*')
        .order('checked_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as AnomaliaFreteCheckRow[];
      const map = new Map<string, AnomaliaFreteCheck>();
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

export function useMarcarAnomaliaFreteVerificada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ anomaliaId, checkedBy, motivo }: MarcarPayload) => {
      const { error } = await supabase
        .from('anomalias_frete_checks')
        .upsert(
          { id: anomaliaId, checked_at: new Date().toISOString(), checked_by: checkedBy, motivo: motivo ?? null },
          { onConflict: 'id' },
        );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['anomalias_frete_checks'] }); },
  });
}

export function useDesfazerVerificacaoAnomaliaFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anomaliaId: string) => {
      const { error } = await supabase.from('anomalias_frete_checks').delete().eq('id', anomaliaId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['anomalias_frete_checks'] }); },
  });
}
