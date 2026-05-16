/**
 * Helpers de auditoria do módulo Compras.
 *
 * Cada ação relevante (criar, editar, aprovar, etc.) registra um INSERT em
 * `compras_auditoria` com o diff antes/depois. Falhas de auditoria não devem
 * quebrar o fluxo principal — logamos no console e seguimos.
 */

import { supabase } from '../lib/supabase';
import type {
  AcaoAuditoriaCompras,
  EntidadeCompra,
  ComprasAuditoria,
} from '../types';

interface AuditarParams {
  entidade: EntidadeCompra;
  entidadeId: string;
  acao: AcaoAuditoriaCompras;
  usuarioId?: string;
  usuarioNome: string;
  diffAntes?: Record<string, unknown>;
  diffDepois?: Record<string, unknown>;
  observacao?: string;
}

export async function auditar(params: AuditarParams): Promise<void> {
  const payload = {
    entidade: params.entidade,
    entidade_id: params.entidadeId,
    acao: params.acao,
    usuario_id: params.usuarioId ?? null,
    usuario_nome: params.usuarioNome || 'desconhecido',
    diff_antes: params.diffAntes ?? null,
    diff_depois: params.diffDepois ?? null,
    observacao: params.observacao ?? null,
  };
  try {
    const { error } = await supabase.from('compras_auditoria').insert(payload);
    if (error) {
      console.warn('[compras_auditoria] falha ao registrar:', error.message, payload);
    }
  } catch (e) {
    console.warn('[compras_auditoria] exceção:', e);
  }
}

/**
 * Calcula um diff raso entre dois objetos. Retorna `{ antes, depois }` apenas
 * com os campos que mudaram. Útil pra registros menores que cabem em jsonb.
 */
export function diffRaso<T extends Record<string, unknown>>(
  antes: T,
  depois: T
): { antes: Partial<T>; depois: Partial<T> } | null {
  const a: Partial<T> = {};
  const d: Partial<T> = {};
  let mudou = false;
  const keys = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  for (const k of keys) {
    const va = antes[k as keyof T];
    const vd = depois[k as keyof T];
    if (JSON.stringify(va) !== JSON.stringify(vd)) {
      a[k as keyof T] = va;
      d[k as keyof T] = vd;
      mudou = true;
    }
  }
  return mudou ? { antes: a, depois: d } : null;
}

/**
 * Carrega o histórico de auditoria de um documento específico, em ordem
 * cronológica decrescente (mais recente primeiro).
 */
export async function carregarHistoricoCompras(
  entidade: EntidadeCompra,
  entidadeId: string
): Promise<ComprasAuditoria[]> {
  const { data, error } = await supabase
    .from('compras_auditoria')
    .select('*')
    .eq('entidade', entidade)
    .eq('entidade_id', entidadeId)
    .order('criado_em', { ascending: false });
  if (error) {
    console.warn('[compras_auditoria] erro ao carregar histórico:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    entidade: r.entidade,
    entidadeId: r.entidade_id,
    acao: r.acao,
    usuarioId: r.usuario_id ?? undefined,
    usuarioNome: r.usuario_nome,
    diffAntes: r.diff_antes ?? undefined,
    diffDepois: r.diff_depois ?? undefined,
    observacao: r.observacao ?? undefined,
    criadoEm: r.criado_em,
  }));
}
