import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  dbToOrdemServico,
  ordemServicoToDb,
  dbToItemOS,
  itemOSToDb,
  dbToPlanoManutencao,
  planoManutencaoToDb,
  dbToHistoricoMedicao,
  historicoMedicaoToDb,
} from '../lib/mappers';
import type { OrdemServico, ItemOS, PlanoManutencao, HistoricoMedicao } from '../types';

// ── Ordens de Serviço ──

export function useOrdensServico() {
  return useQuery({
    queryKey: ['ordens_servico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToOrdemServico);
    },
  });
}

export function useAdicionarOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (os: OrdemServico) => {
      const payload = ordemServicoToDb(os);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = payload;
      const { error } = await supabase.from('ordens_servico').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordens_servico'] }),
  });
}

export function useAtualizarOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (os: OrdemServico) => {
      const { error } = await supabase
        .from('ordens_servico')
        .update(ordemServicoToDb(os))
        .eq('id', os.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordens_servico'] }),
  });
}

export function useExcluirOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ordens_servico').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordens_servico'] }),
  });
}

// ── Itens da OS ──

export function useItensOS(osId: string) {
  return useQuery({
    queryKey: ['itens_os', osId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('itens_os')
        .select('*')
        .eq('ordem_servico_id', osId);
      if (error) throw error;
      return (data ?? []).map(dbToItemOS);
    },
    enabled: !!osId,
  });
}

export function useSalvarItensOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ osId, itens }: { osId: string; itens: ItemOS[] }) => {
      // Delete existing items
      const { error: delError } = await supabase
        .from('itens_os')
        .delete()
        .eq('ordem_servico_id', osId);
      if (delError) throw delError;

      // Insert new items
      if (itens.length > 0) {
        const rows = itens.map((item) => {
          const payload = itemOSToDb({ ...item, ordemServicoId: osId });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...rest } = payload;
          return rest;
        });
        const { error: insError } = await supabase.from('itens_os').insert(rows);
        if (insError) throw insError;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['itens_os', variables.osId] });
    },
  });
}

// ── Planos de Manutenção ──

export function usePlanosManutencao() {
  return useQuery({
    queryKey: ['planos_manutencao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('planos_manutencao').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToPlanoManutencao);
    },
  });
}

export function useAdicionarPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plano: PlanoManutencao) => {
      const payload = planoManutencaoToDb(plano);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = payload;
      const { error } = await supabase.from('planos_manutencao').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planos_manutencao'] }),
  });
}

export function useAtualizarPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plano: PlanoManutencao) => {
      const { error } = await supabase
        .from('planos_manutencao')
        .update(planoManutencaoToDb(plano))
        .eq('id', plano.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planos_manutencao'] }),
  });
}

export function useExcluirPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planos_manutencao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planos_manutencao'] }),
  });
}

// ── Histórico de Medições ──

export function useHistoricoMedicoes() {
  return useQuery({
    queryKey: ['historico_medicoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_medicoes')
        .select('*')
        .order('data_registro', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToHistoricoMedicao);
    },
  });
}

export function useAdicionarMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (medicao: HistoricoMedicao) => {
      const payload = historicoMedicaoToDb(medicao);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = payload;
      const { error } = await supabase.from('historico_medicoes').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['historico_medicoes'] }),
  });
}
