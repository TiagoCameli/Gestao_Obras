/**
 * Hooks e helpers para notificações in-app do módulo Compras.
 *
 * Como o app usa `funcionario.nome` como identificador implícito em vários
 * lugares (criadoPor, solicitante, etc), aqui também adotamos o nome como
 * `destinatarioId`. Quando houver user_id firme em todas as entidades,
 * basta trocar a chave aqui.
 *
 * Hooks:
 *  - useNotificacoesCompras(usuarioNome): lista as 30 mais recentes
 *  - useNotificacoesNaoLidasCount(usuarioNome): contador pra badge
 *  - useMarcarNotificacaoLida: marca uma como lida
 *  - useMarcarTodasLidas: marca todas do usuário como lidas
 *
 * Helper:
 *  - criarNotificacaoCompras(...): chamada de qualquer handler quando
 *    uma ação relevante acontece (pedido aprovado/reprovado, OC aprovada, etc)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ComprasNotificacao } from '../types';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToNotificacao(row: any): ComprasNotificacao {
  return {
    id: row.id,
    destinatarioId: row.destinatario_id,
    tipo: row.tipo,
    titulo: row.titulo,
    mensagem: row.mensagem,
    link: row.link ?? undefined,
    lida: !!row.lida,
    lidaEm: row.lida_em ?? undefined,
    enviadoWhatsapp: !!row.enviado_whatsapp,
    enviadoWhatsappEm: row.enviado_whatsapp_em ?? undefined,
    criadoEm: row.criado_em,
  };
}

export function useNotificacoesCompras(usuarioNome: string) {
  return useQuery<ComprasNotificacao[]>({
    queryKey: ['compras_notificacoes', usuarioNome],
    queryFn: async () => {
      if (!usuarioNome) return [];
      const { data, error } = await supabase
        .from('compras_notificacoes')
        .select('*')
        .eq('destinatario_id', usuarioNome)
        .order('criado_em', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map(dbToNotificacao);
    },
    enabled: !!usuarioNome,
    // Refetch a cada 60s pra capturar notificações novas (ex.: respostas de cotação)
    refetchInterval: 60_000,
    // Mantém atualizado quando usuário volta pra aba
    refetchOnWindowFocus: true,
  });
}

export function useNotificacoesNaoLidasCount(usuarioNome: string): number {
  const { data = [] } = useNotificacoesCompras(usuarioNome);
  return data.filter((n) => !n.lida).length;
}

export function useMarcarNotificacaoLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('compras_notificacoes')
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras_notificacoes'] });
    },
  });
}

export function useMarcarTodasLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (usuarioNome: string) => {
      const { error } = await supabase
        .from('compras_notificacoes')
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq('destinatario_id', usuarioNome)
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras_notificacoes'] });
    },
  });
}

// ─────────────────────────── helper de criação ─────────────────────────────

interface CriarNotificacaoParams {
  destinatarioId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
}

/**
 * Cria uma notificação in-app. Falhas não devem quebrar o fluxo principal —
 * logamos no console e seguimos.
 */
export async function criarNotificacaoCompras(p: CriarNotificacaoParams): Promise<void> {
  if (!p.destinatarioId) return;
  try {
    const { error } = await supabase.from('compras_notificacoes').insert({
      id: genId(),
      destinatario_id: p.destinatarioId,
      tipo: p.tipo,
      titulo: p.titulo,
      mensagem: p.mensagem,
      link: p.link ?? null,
    });
    if (error) {
      console.warn('[compras_notificacoes] falha ao criar:', error.message);
    }
  } catch (e) {
    console.warn('[compras_notificacoes] exceção:', e);
  }
}
