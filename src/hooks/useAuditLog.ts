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
