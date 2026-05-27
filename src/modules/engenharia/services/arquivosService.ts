import { fileTypeFromBlob } from 'file-type';
import { supabase } from '@/lib/supabase';
import { buildStoragePath, extractExtension } from './arquivosPath';
import { TAMANHO_MAX_BYTES, MIME_PERMITIDOS, EXTENSOES_BLOQUEADAS } from './arquivosMime';

const BUCKET = 'engenharia-arquivos';
const SIGNED_URL_TTL_SECS = 300;  // 5 min

export type UploadResult =
  | { ok: true; arquivoId: string; storagePath: string }
  | { ok: false; motivo: string };

/**
 * Faz upload de um arquivo para o bucket engenharia-arquivos e registra
 * row em engenharia_arquivos. Validações:
 *   - Tamanho ≤ 50 MB
 *   - Extensão NÃO está na lista de bloqueadas (exe/bat/etc.)
 *   - MIME real (bytes via file-type) está em MIME_PERMITIDOS
 *
 * Em caso de erro APÓS upload (ex.: INSERT no DB falha), tenta
 * remover o objeto do storage como cleanup best-effort.
 */
export async function uploadArquivo(params: {
  pastaId: string;
  file: File;
}): Promise<UploadResult> {
  const { pastaId, file } = params;

  if (file.size > TAMANHO_MAX_BYTES) {
    return {
      ok: false,
      motivo: `Arquivo excede o tamanho máximo de 50 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, motivo: 'Arquivo vazio.' };
  }

  const ext = extractExtension(file.name);
  if (ext && EXTENSOES_BLOQUEADAS.has(ext)) {
    return { ok: false, motivo: `Extensão .${ext} está bloqueada por segurança.` };
  }

  // MIME real via file-type — defesa em profundidade.
  // Nem todo arquivo tem assinatura mágica (ex.: .txt puro retorna null).
  // Para esses, confiamos no MIME header do navegador (file.type).
  const detected = await fileTypeFromBlob(file);
  const mimeReal = detected?.mime ?? file.type;
  if (!mimeReal) {
    return { ok: false, motivo: 'Não foi possível determinar o tipo do arquivo.' };
  }
  if (!MIME_PERMITIDOS.has(mimeReal)) {
    return {
      ok: false,
      motivo: `MIME real "${mimeReal}" não é permitido para upload.`,
    };
  }

  const arquivoId = crypto.randomUUID();
  const storagePath = buildStoragePath({
    pastaId,
    arquivoId,
    nomeOriginal: file.name,
  });

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: mimeReal,
    cacheControl: '3600',
    upsert: false,
  });
  if (upErr) {
    return { ok: false, motivo: `Falha no upload: ${upErr.message}` };
  }

  const { data: row, error: dbErr } = await supabase
    .from('engenharia_arquivos')
    .insert({
      id: arquivoId,
      pasta_id: pastaId,
      nome_original: file.name,
      extensao: ext,
      mime_type: mimeReal,
      tamanho_bytes: file.size,
      storage_path: storagePath,
    })
    .select('id')
    .single();

  if (dbErr || !row) {
    // Cleanup best-effort
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return {
      ok: false,
      motivo: `Upload feito mas falhou ao registrar no banco: ${dbErr?.message ?? 'sem detalhe'}.`,
    };
  }

  return { ok: true, arquivoId: row.id, storagePath };
}

/**
 * Gera URL assinada temporária para download/preview do arquivo.
 * TTL default 5 min — alinhado com padrão do projeto.
 */
export async function getSignedUrl(
  arquivoId: string,
  ttlSecs: number = SIGNED_URL_TTL_SECS,
): Promise<string> {
  const { data: arquivo, error: dbErr } = await supabase
    .from('engenharia_arquivos')
    .select('storage_path')
    .eq('id', arquivoId)
    .single();

  if (dbErr || !arquivo) {
    throw new Error(
      `Arquivo ${arquivoId} não encontrado ou sem permissão: ${dbErr?.message ?? 'sem detalhe'}`,
    );
  }

  const { data: signed, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(arquivo.storage_path, ttlSecs);

  if (urlErr || !signed) {
    throw new Error(`Falha ao gerar signed URL: ${urlErr?.message ?? 'sem detalhe'}`);
  }

  return signed.signedUrl;
}

/**
 * Soft delete: marca deleted_at no DB.
 * NÃO remove do storage — cron job futuro limpa arquivos com deleted_at > 30 dias.
 */
export async function softDeleteArquivo(arquivoId: string): Promise<void> {
  const { error } = await supabase
    .from('engenharia_arquivos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', arquivoId)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Falha ao soft-deletar arquivo: ${error.message}`);
  }
}
