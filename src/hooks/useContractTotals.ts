import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Soma do contrato (qty × valor unitário) por obra, lendo direto da
 * tabela `rodotracker_contract_items`. Apenas linhas tipo "item" entram
 * na conta — etapas e subetapas são agrupadores.
 *
 * O resultado é um Map<obraId, totalEmReais> usado para preencher a
 * coluna "Orçamento contratado" do cadastros de obras.
 */
export function useTotalContratadoPorObra() {
  return useQuery({
    queryKey: ['rodotracker_contract_items', '__totals_por_obra'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rodotracker_contract_items')
        .select('obra_id, contracted_qty, unit_price, type');
      if (error) throw error;
      const totals = new Map<string, number>();
      for (const row of data ?? []) {
        const r = row as {
          obra_id: string;
          contracted_qty: number | null;
          unit_price: number | null;
          type: string | null;
        };
        const t = r.type ?? 'item';
        if (t !== 'item') continue;
        const v = (Number(r.contracted_qty) || 0) * (Number(r.unit_price) || 0);
        totals.set(r.obra_id, (totals.get(r.obra_id) ?? 0) + v);
      }
      return totals;
    },
    staleTime: 30_000,
  });
}
