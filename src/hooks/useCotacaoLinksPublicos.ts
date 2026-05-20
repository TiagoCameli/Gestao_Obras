/**
 * Hooks para os tokens públicos do portal do fornecedor.
 *
 * - useCotacaoLinksPublicos(cotacaoId): lista os links de uma cotação
 * - useCriarCotacaoLinkPublico: cria um novo link com token único + expiração
 * - useCotacaoPublica(token): leitura do portal (via RPC get_cotacao_publica)
 * - useCotacaoRespostas(cotacaoId): respostas recebidas
 * - useEnviarRespostaCotacao: usado pelo portal pra gravar resposta (via RPC responder_cotacao)
 *
 * O portal público usa RPCs SECURITY DEFINER em vez de acesso direto às
 * tabelas — auditoria Bloco 1.4. Token é validado server-side.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { gerarTokenCotacao } from '../utils/comprasToken';
import type {
  CanalEnvioCotacao, Cotacao, CotacaoLinkPublico, CotacaoRespostaFornecedor, CotacaoRespostaItem,
  ItemPedidoCompra,
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
 * Resultado do portal público — vem do RPC get_cotacao_publica.
 * Quando ok=false, `reason` indica o motivo (not_found, expired, respondido, etc.)
 * e os campos data são null.
 */
export type PortalReason = 'invalid_token' | 'not_found' | 'expired' | 'respondido' | 'cotacao_missing';

export interface PortalCotacaoResult {
  ok: boolean;
  reason: PortalReason | null;
  link: CotacaoLinkPublico | null;
  cotacao: Pick<Cotacao, 'id' | 'numero' | 'descricao' | 'descricaoLivre' | 'itensPedido'> | null;
  fornecedor: { id: string; nome: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePortalLink(raw: any): CotacaoLinkPublico {
  return {
    id: raw.id,
    cotacaoId: raw.cotacaoId,
    fornecedorId: raw.fornecedorId,
    token: '',
    expiresAt: raw.expiresAt,
    respondido: !!raw.respondido,
    respondidoEm: raw.respondidoEm ?? undefined,
    criadoPor: '',
    criadoEm: '',
  };
}

/**
 * Leitura pública do portal — chama RPC `get_cotacao_publica` que valida
 * token + retorna link + cotação + fornecedor numa transação só.
 */
export function useCotacaoPublica(token: string) {
  return useQuery<PortalCotacaoResult>({
    queryKey: ['cotacao_publica', token],
    queryFn: async () => {
      if (!token) {
        return { ok: false, reason: 'invalid_token', link: null, cotacao: null, fornecedor: null };
      }
      const { data, error } = await supabase.rpc('get_cotacao_publica', { p_token: token });
      if (error) throw error;
      if (!data || !data.ok) {
        return {
          ok: false,
          reason: (data?.reason ?? 'not_found') as PortalReason,
          link: data?.link ? parsePortalLink(data.link) : null,
          cotacao: null,
          fornecedor: null,
        };
      }
      return {
        ok: true,
        reason: null,
        link: parsePortalLink(data.link),
        cotacao: {
          id: data.cotacao.id,
          numero: data.cotacao.numero,
          descricao: data.cotacao.descricao ?? '',
          descricaoLivre: data.cotacao.descricaoLivre ?? undefined,
          itensPedido: (data.cotacao.itensPedido ?? []) as ItemPedidoCompra[],
        },
        fornecedor: data.fornecedor ?? null,
      };
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
  token: string;
  itensResposta: CotacaoRespostaItem[];
  condicaoPagamento: string;
  prazoEntrega: string;
  observacoes: string;
  assinaturaBase64?: string;
}

/**
 * Usado pelo PORTAL público (sem login) — chama RPC responder_cotacao que valida
 * token + insere resposta + marca link como respondido atomicamente. Token é
 * re-derivado server-side; client não pode forjar link_id ou cotacao_id.
 */
export function useEnviarRespostaCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: EnviarRespostaParams) => {
      const { data, error } = await supabase.rpc('responder_cotacao', {
        p_token: p.token,
        p_payload: {
          itensResposta: p.itensResposta,
          condicaoPagamento: p.condicaoPagamento,
          prazoEntrega: p.prazoEntrega,
          observacoes: p.observacoes,
          assinaturaBase64: p.assinaturaBase64 ?? null,
        },
      });
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(`Falha ao enviar resposta (${data?.reason ?? 'erro_desconhecido'})`);
      }
      return data.resposta_id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacao_respostas'] });
      qc.invalidateQueries({ queryKey: ['cotacao_links_publicos'] });
      qc.invalidateQueries({ queryKey: ['cotacao_publica'] });
    },
  });
}
