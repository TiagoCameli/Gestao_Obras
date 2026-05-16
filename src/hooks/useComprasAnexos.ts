/**
 * Hook: gerencia anexos (fotos/PDFs) do módulo Compras.
 * - upload: envia para Supabase Storage no bucket 'compras-anexos'
 *           e registra metadata em compras_anexos
 * - lista: pega anexos por entidade + entidade_id
 * - exclui: remove storage + tabela
 * - signedUrl: gera URL temporária pra download/preview
 *
 * Estrutura no bucket: {entidade}/{entidade_id}/{filename}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ComprasAnexo, EntidadeCompra } from '../types';

const BUCKET = 'compras-anexos';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function sanitizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 150);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToAnexo(row: any): ComprasAnexo {
  return {
    id: row.id,
    entidade: row.entidade,
    entidadeId: row.entidade_id,
    nomeArquivo: row.nome_arquivo,
    tipoMime: row.tipo_mime,
    tamanhoBytes: Number(row.tamanho_bytes ?? 0),
    storagePath: row.storage_path,
    enviadoPor: row.enviado_por ?? '',
    enviadoEm: row.enviado_em,
  };
}

/**
 * Lista anexos de uma entidade específica (pedido/cotação/oc).
 * Retorna [] se entidadeId estiver vazio (modo "novo").
 */
export function useAnexosCompras(entidade: EntidadeCompra, entidadeId: string) {
  return useQuery<ComprasAnexo[]>({
    queryKey: ['compras_anexos', entidade, entidadeId],
    queryFn: async () => {
      if (!entidadeId) return [];
      const { data, error } = await supabase
        .from('compras_anexos')
        .select('*')
        .eq('entidade', entidade)
        .eq('entidade_id', entidadeId)
        .order('enviado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToAnexo);
    },
    enabled: !!entidadeId,
  });
}

interface UploadParams {
  entidade: EntidadeCompra;
  entidadeId: string;
  file: File;
  enviadoPor: string;
}

export function useUploadAnexoCompras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entidade, entidadeId, file, enviadoPor }: UploadParams) => {
      if (!entidadeId) throw new Error('entidadeId é obrigatório para upload de anexo');
      const id = genId();
      const safeName = sanitizarNome(file.name || 'arquivo');
      const path = `${entidade}/${entidadeId}/${id}_${safeName}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { error: insErr, data: row } = await supabase
        .from('compras_anexos')
        .insert({
          id,
          entidade,
          entidade_id: entidadeId,
          nome_arquivo: file.name || safeName,
          tipo_mime: file.type || 'application/octet-stream',
          tamanho_bytes: file.size,
          storage_path: path,
          enviado_por: enviadoPor || '',
        })
        .select()
        .single();
      if (insErr) {
        // rollback do storage se falhar o INSERT
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        throw insErr;
      }
      return dbToAnexo(row);
    },
    onSuccess: (anexo) => {
      qc.invalidateQueries({ queryKey: ['compras_anexos', anexo.entidade, anexo.entidadeId] });
    },
  });
}

export function useExcluirAnexoCompras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anexo: ComprasAnexo) => {
      // Apaga storage + linha
      await supabase.storage.from(BUCKET).remove([anexo.storagePath]).catch(() => {});
      const { error } = await supabase.from('compras_anexos').delete().eq('id', anexo.id);
      if (error) throw error;
      return anexo;
    },
    onSuccess: (anexo) => {
      qc.invalidateQueries({ queryKey: ['compras_anexos', anexo.entidade, anexo.entidadeId] });
    },
  });
}

/**
 * Gera URL temporária (signed) para preview/download de um anexo.
 * Validade: 1 hora.
 */
export async function obterUrlAnexo(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error) {
    console.warn('[compras_anexos] signed url:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
