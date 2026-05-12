import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  dbToOrdemServico, ordemServicoToDb,
  dbToOSPeca, osPecaToDb,
  dbToOSMaoObra, osMaoObraToDb,
  dbToOSTransicao,
} from '../lib/mappers';
import type {
  OrdemServico, OSPeca, OSMaoObra, OSTransicao, StatusOS,
} from '../types';

// ── Listas ──────────────────────────────────────────────────────────

interface FiltrosOS {
  equipamentoId?: string;
  status?: StatusOS | StatusOS[] | 'todas';
  tipo?: string;
  prioridade?: string;
  abertas?: boolean;
}

/**
 * Lista de OS com filtros opcionais (server-side).
 * Padrão: retorna as 200 mais recentes não deletadas.
 */
export function useOrdensServico(filtros: FiltrosOS = {}) {
  return useQuery({
    queryKey: ['ordens_servico', JSON.stringify(filtros)],
    queryFn: async () => {
      let q = supabase
        .from('ordens_servico')
        .select('*')
        .is('deleted_at', null)
        .order('data_abertura', { ascending: false })
        .limit(200);

      if (filtros.equipamentoId) q = q.eq('equipamento_id', filtros.equipamentoId);
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo);
      if (filtros.prioridade) q = q.eq('prioridade', filtros.prioridade);
      if (filtros.abertas) {
        q = q.not('status', 'in', '("concluida","cancelada")');
      } else if (filtros.status && filtros.status !== 'todas') {
        if (Array.isArray(filtros.status)) {
          q = q.in('status', filtros.status);
        } else {
          q = q.eq('status', filtros.status);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(dbToOrdemServico);
    },
  });
}

/**
 * Detalhe de uma OS específica.
 */
export function useOrdemServico(osId: string | null | undefined) {
  return useQuery<OrdemServico | null>({
    queryKey: ['ordem_servico', osId ?? ''],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .eq('id', osId!)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToOrdemServico(data) : null;
    },
  });
}

export function usePecasOS(osId: string | null | undefined) {
  return useQuery<OSPeca[]>({
    queryKey: ['os_pecas', osId ?? ''],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_pecas')
        .select('*')
        .eq('os_id', osId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(dbToOSPeca);
    },
  });
}

export function useMaoObraOS(osId: string | null | undefined) {
  return useQuery<OSMaoObra[]>({
    queryKey: ['os_mao_obra', osId ?? ''],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_mao_obra')
        .select('*')
        .eq('os_id', osId!)
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToOSMaoObra);
    },
  });
}

export function useTransicoesOS(osId: string | null | undefined) {
  return useQuery<OSTransicao[]>({
    queryKey: ['os_transicoes', osId ?? ''],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_transicoes')
        .select('*')
        .eq('os_id', osId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(dbToOSTransicao);
    },
  });
}

// ── Mutations ───────────────────────────────────────────────────────

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface CriarOSParams {
  os: Omit<OrdemServico, 'numero' | 'custoTotal' | 'dataAbertura'>;
}

/**
 * Cria uma nova OS. O número é gerado no DB via gerar_numero_os() — front
 * passa string vazia e o trigger/default não cuida, então fazemos via RPC.
 *
 * Implementação: chama supabase.rpc('gerar_numero_os') primeiro, depois insert.
 * (Alternativa seria um BEFORE INSERT trigger, mas RPC é mais explícito.)
 */
export function useCriarOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: CriarOSParams) => {
      // 1. Gera número
      const { data: numero, error: numError } = await supabase.rpc('gerar_numero_os');
      if (numError) throw numError;

      // 2. Insert da OS
      const id = params.os.id || gerarId();
      const osCompleta: OrdemServico = {
        ...params.os,
        id,
        numero: numero as string,
        custoTotal: 0,
        dataAbertura: new Date().toISOString(),
      };
      const payload = { ...ordemServicoToDb(osCompleta), numero, id };
      const { error } = await supabase.from('ordens_servico').insert(payload);
      if (error) throw error;
      return osCompleta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
    },
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
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
      qc.invalidateQueries({ queryKey: ['ordem_servico', variables.id] });
      qc.invalidateQueries({ queryKey: ['os_transicoes', variables.id] });
    },
  });
}

/**
 * Muda apenas o status da OS. Trigger no DB grava transição.
 * Quando vai pra concluida, popular dataConclusao automaticamente
 * caso ainda não tenha.
 */
export function useMudarStatusOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      osId: string;
      novoStatus: StatusOS;
      usuarioNome: string;
      paradaFim?: string;
    }) => {
      const updates: Record<string, unknown> = {
        status: params.novoStatus,
        updated_by: params.usuarioNome,
      };
      if (params.novoStatus === 'em_execucao') {
        updates.data_inicio_execucao = new Date().toISOString();
      }
      if (params.novoStatus === 'concluida') {
        updates.data_conclusao = new Date().toISOString();
        if (params.paradaFim) updates.parada_fim = params.paradaFim;
      }
      const { error } = await supabase
        .from('ordens_servico')
        .update(updates)
        .eq('id', params.osId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
      qc.invalidateQueries({ queryKey: ['ordem_servico', variables.osId] });
      qc.invalidateQueries({ queryKey: ['os_transicoes', variables.osId] });
    },
  });
}

export function useExcluirOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; deletedBy: string }) => {
      const { error } = await supabase
        .from('ordens_servico')
        .update({ deleted_at: new Date().toISOString(), deleted_by: params.deletedBy })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
    },
  });
}

// ── Peças e mão de obra ─────────────────────────────────────────────

export function useAdicionarPecaOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (peca: OSPeca) => {
      const { error } = await supabase.from('os_pecas').insert(osPecaToDb(peca));
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['os_pecas', variables.osId] });
    },
  });
}

export function useExcluirPecaOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { pecaId: string; osId: string }) => {
      const { error } = await supabase.from('os_pecas').delete().eq('id', params.pecaId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['os_pecas', variables.osId] });
    },
  });
}

export function useAdicionarMaoObraOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mo: OSMaoObra) => {
      const { error } = await supabase.from('os_mao_obra').insert(osMaoObraToDb(mo));
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['os_mao_obra', variables.osId] });
    },
  });
}

export function useExcluirMaoObraOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { moId: string; osId: string }) => {
      const { error } = await supabase.from('os_mao_obra').delete().eq('id', params.moId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['os_mao_obra', variables.osId] });
    },
  });
}
