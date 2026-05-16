/**
 * Hooks para os tokens públicos do portal do fornecedor.
 *
 * - useCotacaoLinksPublicos(cotacaoId): lista os links de uma cotação
 * - useCriarCotacaoLinkPublico: cria um novo link com token único + expiração
 * - useCotacaoLinkPorToken(token): leitura usada no portal público
 * - useCotacaoRespostas(cotacaoId): respostas recebidas
 * - useEnviarRespostaCotacao: usado pelo portal pra gravar resposta
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { gerarTokenCotacao } from '../utils/comprasToken';
import type {
  CanalEnvioCotacao, CotacaoLinkPublico, CotacaoRespostaFornecedor, CotacaoRespostaItem,
} from '../types';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToLink(row: any): CotacaoLinkPublico {
  return {
    id: row.id,
    cotacaoId: row.cotacao_id,
    fornecedorId: row.fornecedor_id,
    token: row.token,
    canalEnvio: row.canal_envio ?? undefined,
    expiresAt: row.expires_at,
    respondido: !!row.respondido,
    respondidoEm: row.respondido_em ?? undefined,
    criadoPor: row.criado_por ?? '',
    criadoEm: row.criado_em,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToResposta(row: any): CotacaoRespostaFornecedor {
  return {
    id: row.id,
    linkPublicoId: row.link_publico_id,
    cotacaoId: row.cotacao_id,
    fornecedorId: row.fornecedor_id,
    itensResposta: Array.isArray(row.itens_resposta) ? row.itens_resposta : [],
    condicaoPagamento: row.condicao_pagamento ?? '',
    prazoEntrega: row.prazo_entrega ?? '',
    observacoes: row.observacoes ?? '',
    assinaturaBase64: row.assinatura_base64 ?? undefined,
    respondidoEm: row.respondido_em,
    ipOrigem: row.ip_origem ?? undefined,
  };
}

export function useCotacaoLinksPublicos(cotacaoId: string) {
  return useQuery<CotacaoLinkPublico[]>({
    queryKey: ['cotacao_links_publicos', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return [];
      const { data, error } = await supabase
        .from('cotacao_links_publicos')
        .select('*')
        .eq('cotacao_id', cotacaoId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToLink);
    },
    enabled: !!cotacaoId,
  });
}

interface CriarLinkParams {
  cotacaoId: string;
  fornecedorId: string;
  canalEnvio?: CanalEnvioCotacao;
  /** dias de validade — default 7 */
  expiraEmDias?: number;
  criadoPor: string;
}

export function useCriarCotacaoLinkPublico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: CriarLinkParams) => {
      const id = genId();
      const token = gerarTokenCotacao(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (params.expiraEmDias ?? 7));
      const { data, error } = await supabase
        .from('cotacao_links_publicos')
        .insert({
          id,
          cotacao_id: params.cotacaoId,
          fornecedor_id: params.fornecedorId,
          token,
          canal_envio: params.canalEnvio ?? null,
          expires_at: expiresAt.toISOString(),
          criado_por: params.criadoPor || '',
        })
        .select()
        .single();
      if (error) throw error;
      return dbToLink(data);
    },
    onSuccess: (link) => {
      qc.invalidateQueries({ queryKey: ['cotacao_links_publicos', link.cotacaoId] });
    },
  });
}

/**
 * Leitura pública do link a partir do token (usado no portal).
 */
export function useCotacaoLinkPorToken(token: string) {
  return useQuery<CotacaoLinkPublico | null>({
    queryKey: ['cotacao_link_token', token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from('cotacao_links_publicos')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToLink(data) : null;
    },
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useCotacaoRespostas(cotacaoId: string) {
  return useQuery<CotacaoRespostaFornecedor[]>({
    queryKey: ['cotacao_respostas', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return [];
      const { data, error } = await supabase
        .from('cotacao_respostas_fornecedor')
        .select('*')
        .eq('cotacao_id', cotacaoId)
        .order('respondido_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToResposta);
    },
    enabled: !!cotacaoId,
  });
}

interface EnviarRespostaParams {
  link: CotacaoLinkPublico;
  itensResposta: CotacaoRespostaItem[];
  condicaoPagamento: string;
  prazoEntrega: string;
  observacoes: string;
  assinaturaBase64?: string;
}

/**
 * Usado pelo PORTAL público (sem login) — grava resposta e marca link como respondido.
 * Por simplicidade não tentamos descobrir IP do client (RLS aberta cobre o INSERT).
 */
export function useEnviarRespostaCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: EnviarRespostaParams) => {
      // 1) Insere resposta
      const id = genId();
      const { error: e1 } = await supabase.from('cotacao_respostas_fornecedor').insert({
        id,
        link_publico_id: p.link.id,
        cotacao_id: p.link.cotacaoId,
        fornecedor_id: p.link.fornecedorId,
        itens_resposta: p.itensResposta,
        condicao_pagamento: p.condicaoPagamento,
        prazo_entrega: p.prazoEntrega,
        observacoes: p.observacoes,
        assinatura_base64: p.assinaturaBase64 ?? null,
      });
      if (e1) throw e1;

      // 2) Marca link como respondido
      const { error: e2 } = await supabase
        .from('cotacao_links_publicos')
        .update({ respondido: true, respondido_em: new Date().toISOString() })
        .eq('id', p.link.id);
      if (e2) throw e2;

      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacao_respostas'] });
      qc.invalidateQueries({ queryKey: ['cotacao_links_publicos'] });
      qc.invalidateQueries({ queryKey: ['cotacao_link_token'] });
    },
  });
}
