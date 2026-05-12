import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToDocumentoEquipamento, documentoEquipamentoToDb } from '../lib/mappers';
import type {
  DocumentoEquipamento,
  DocumentoVencendo,
  TipoDocumentoEquipamento,
  NivelVencimentoDocumento,
} from '../types';

/**
 * Documentos de um equipamento específico.
 * Não filtra por tipo — devolve todos (CRLV, IPVA, seguro, manual, etc.).
 */
export function useDocumentosEquipamento(equipamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ['documentos_equipamento', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_equipamento')
        .select('*')
        .eq('equipamento_id', equipamentoId!)
        .is('deleted_at', null)
        .order('vencimento', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(dbToDocumentoEquipamento);
    },
  });
}

/**
 * Documentos vencendo nos próximos 60 dias (todos os equipamentos).
 * Usado pra alertas no dashboard.
 */
export function useDocumentosVencendo() {
  return useQuery<DocumentoVencendo[]>({
    queryKey: ['documentos_vencendo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_documentos_vencendo')
        .select('*')
        .order('dias_para_vencer', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        equipamentoId: row.equipamento_id,
        equipamentoNome: row.equipamento_nome ?? '',
        codigoPatrimonio: row.codigo_patrimonio ?? '',
        tipo: (row.tipo ?? 'outro') as TipoDocumentoEquipamento,
        numero: row.numero ?? '',
        vencimento: row.vencimento ?? '',
        diasParaVencer: Number(row.dias_para_vencer ?? 0),
        nivel: (row.nivel ?? 'atencao') as NivelVencimentoDocumento,
      }));
    },
  });
}

export function useAdicionarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DocumentoEquipamento) => {
      const { error } = await supabase
        .from('documentos_equipamento')
        .insert(documentoEquipamentoToDb(doc));
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['documentos_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['documentos_vencendo'] });
    },
  });
}

export function useAtualizarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DocumentoEquipamento) => {
      const { error } = await supabase
        .from('documentos_equipamento')
        .update(documentoEquipamentoToDb(doc))
        .eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['documentos_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['documentos_vencendo'] });
    },
  });
}

export function useExcluirDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; equipamentoId: string; deletedBy: string }) => {
      const { error } = await supabase
        .from('documentos_equipamento')
        .update({ deleted_at: new Date().toISOString(), deleted_by: params.deletedBy })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['documentos_equipamento', variables.equipamentoId] });
      qc.invalidateQueries({ queryKey: ['documentos_vencendo'] });
    },
  });
}
