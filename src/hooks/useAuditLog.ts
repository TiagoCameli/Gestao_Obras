import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToAuditLog, auditLogToDb } from '../lib/mappers';
import type { AuditLogEntry } from '../types';

export function useAuditLog() {
  return useQuery({
    queryKey: ['audit_log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_log').select('*').order('data_hora', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToAuditLog);
    },
  });
}

export function useAdicionarAuditLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<AuditLogEntry, 'id' | 'dataHora'>) => {
      const { error } = await supabase.from('audit_log').insert(auditLogToDb(entry));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit_log'] }),
  });
}

// Non-hook version for use in AuthContext (outside React Query)
export async function adicionarAuditLogAsync(entry: Omit<AuditLogEntry, 'id' | 'dataHora'>) {
  await supabase.from('audit_log').insert(auditLogToDb(entry));
}

// ────────────────────────────────────────────────────────────────────
// F8.3 — Audit log filtrado por alvo (saída/entrada/transferência/tanque).
// Usado pra renderizar timeline no drawer detalhes.
// ────────────────────────────────────────────────────────────────────

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'hard_delete';

export interface AuditEntry {
  id: string;
  /** Tipo bruto, ex: "saidas_combustivel_update". */
  tipo: string;
  /** Tabela alvo extraída do tipo. */
  table: string;
  /** Ação extraída do tipo. */
  action: AuditAction;
  funcionarioId: string;
  alvoId: string;
  /** Diff JSON parseado.
   *  UPDATE: { campo: { old, new } }.
   *  CREATE/DELETE: snapshot completo da row. */
  diff: Record<string, unknown>;
  /** Texto bruto pro fallback se parse falhar. */
  detalhesRaw: string;
  dataHora: string;
}

/** Parse "saidas_combustivel_update" → { table: "saidas_combustivel", action: "update" }.
 *  hard_delete tem underscore — checada primeiro pra precedência sobre _delete. */
function parseTipo(tipo: string): { table: string; action: AuditAction } {
  const knownActions: AuditAction[] = ['hard_delete', 'create', 'update', 'delete', 'restore'];
  for (const a of knownActions) {
    if (tipo.endsWith('_' + a)) {
      return { table: tipo.slice(0, -a.length - 1), action: a };
    }
  }
  return { table: tipo, action: 'update' };
}

function safeParseJson(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function useAuditLogPorAlvo(alvoId: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['audit_log', 'alvo', alvoId],
    enabled: !!alvoId && (options?.enabled ?? true),
    queryFn: async () => {
      if (!alvoId) return [] as AuditEntry[];
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, tipo, funcionario_id, alvo_id, detalhes, data_hora')
        .eq('alvo_id', alvoId)
        .order('data_hora', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row): AuditEntry => {
        const { table, action } = parseTipo(row.tipo);
        return {
          id: row.id,
          tipo: row.tipo,
          table,
          action,
          funcionarioId: row.funcionario_id,
          alvoId: row.alvo_id,
          diff: safeParseJson(row.detalhes),
          detalhesRaw: row.detalhes ?? '',
          dataHora: row.data_hora,
        };
      });
    },
  });
}
