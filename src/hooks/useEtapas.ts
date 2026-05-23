import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToEtapa, etapaToDb } from '../lib/mappers';
import type { EtapaObra } from '../types';

/**
 * Mapeia uma row de `rodotracker_contract_items` (apenas type='etapa') pro
 * shape `EtapaObra` consumido pelo resto do app. Os campos contratuais
 * (contracted_qty, unit_price, unit) viram (quantidade, valorUnitario,
 * unidade). IDs são preservados — são strings curtas no padrão do tracker
 * (ex: "mpe6vtsiu19ih") e NÃO colidem com os UUIDs legados de
 * `etapas_obra` (espaços diferentes), então não há necessidade de prefixar.
 *
 * Atenção: a FK `saidas_combustivel.etapa_id -> etapas_obra.id` ainda
 * existe no DB. Se um insert tentar usar um id que veio do contract_items,
 * vai falhar com FK constraint. Esse bloqueio será tratado em RG.3
 * (migração schema FK ou backfill em etapas_obra). Para RG.2 apenas
 * destravamos a UI/listagem em todos os 9+ consumidores de useEtapas().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contractItemToEtapa(row: any): EtapaObra {
  return {
    id: row.id,
    nome: row.name,
    obraId: row.obra_id,
    unidade: row.unit ?? '',
    quantidade: Number(row.contracted_qty ?? 0),
    valorUnitario: Number(row.unit_price ?? 0),
    // rodotracker_contract_items.user_id é uuid do auth — preserva pra
    // manter a rastreabilidade de criação. Quando ausente, fica vazio.
    criadoPor: row.user_id ?? '',
  };
}

export function useEtapas() {
  return useQuery({
    queryKey: ['etapas'],
    queryFn: async () => {
      // UNION de duas sources:
      //  - `etapas_obra` (legado — 265 registros da BR-364 Lote 09 + obras
      //    antigas; única source que tinha schema próprio).
      //  - `rodotracker_contract_items` WHERE type='etapa' (novo padrão
      //    usado por Cadastros → Etapas; onde Ramal do Gama e obras novas
      //    foram cadastradas).
      // Sem soft-delete em rodotracker_contract_items (schema não tem
      // coluna deleted_at), então não há filtro adicional.
      const [legadoRes, contractItemsRes] = await Promise.all([
        supabase.from('etapas_obra').select('*'),
        supabase.from('rodotracker_contract_items').select('*').eq('type', 'etapa'),
      ]);
      if (legadoRes.error) throw legadoRes.error;
      if (contractItemsRes.error) throw contractItemsRes.error;

      const legadoEtapas = (legadoRes.data ?? []).map(dbToEtapa);
      const contractEtapas = (contractItemsRes.data ?? []).map(contractItemToEtapa);
      return [...legadoEtapas, ...contractEtapas];
    },
  });
}

export function useAdicionarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapa: EtapaObra) => {
      const { error } = await supabase.from('etapas_obra').insert(etapaToDb(etapa));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  });
}

export function useAtualizarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapa: EtapaObra) => {
      const { error } = await supabase.from('etapas_obra').update(etapaToDb(etapa)).eq('id', etapa.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  });
}

export function useExcluirEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('etapas_obra').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etapas'] });
      qc.invalidateQueries({ queryKey: ['abastecimentos'] });
    },
  });
}

export function useSalvarEtapasObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ obraId, etapas }: { obraId: string; etapas: EtapaObra[] }) => {
      // Delete existing etapas for this obra, then insert new ones
      const { error: delError } = await supabase.from('etapas_obra').delete().eq('obra_id', obraId);
      if (delError) throw delError;
      if (etapas.length > 0) {
        const { error: insError } = await supabase.from('etapas_obra').insert(etapas.map(etapaToDb));
        if (insError) throw insError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  });
}
