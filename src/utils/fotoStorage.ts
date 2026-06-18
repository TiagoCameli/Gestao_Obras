// Upload de foto + derivados (thumb/preview) gerados no navegador.
//
// Motivo: o Supabase cobra Image Transformations por imagem de origem
// transformada por mês (só 100 incluídas no plano Pro). Pedir resize na hora
// de exibir (useFotoThumbnails) estourava a cota com o volume de fotos da obra.
// Aqui geramos thumb e preview no momento do upload e guardamos como irmãos do
// original; o grid e o lightbox leem os arquivos prontos, com transform ZERO.

import { supabase } from '../lib/supabase'
import { thumbStoragePath, previewStoragePath } from './signedUrl'

// Mantém em sincronia com os tamanhos consumidos por useFotoThumbnails.
const THUMB_SIZE = 400
const THUMB_QUALITY = 0.75
const PREVIEW_SIZE = 1400
const PREVIEW_QUALITY = 0.85

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

/** Redimensiona pra JPEG. 'cover' recorta no centro num quadrado `target`;
 *  'contain' encaixa dentro de `target`×`target` preservando proporção (sem
 *  ampliar imagens menores). Retorna null se o canvas falhar. */
async function resizeToJpeg(
  file: File,
  target: number,
  mode: 'cover' | 'contain',
  quality: number,
): Promise<Blob | null> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return null

  if (mode === 'cover') {
    canvas.width = target
    canvas.height = target
    const scale = Math.max(target / w, target / h)
    const sw = w * scale
    const sh = h * scale
    ctx.drawImage(img, (target - sw) / 2, (target - sh) / 2, sw, sh)
  } else {
    const scale = Math.min(1, target / Math.max(w, h))
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

export interface UploadFotoResult {
  /** Signed URL do ORIGINAL (mesmo contrato dos uploads antigos). */
  signedUrl: string | null
  error: string | null
}

/**
 * Sobe o original + thumb (400, cover) + preview (1400, contain) como irmãos no
 * mesmo bucket. Derivados são best-effort: se a geração falhar (canvas, HEIC,
 * rede), o original sobe igual e o read side cai de volta pra ele via onError.
 * HEIC pula derivados porque não decodifica em <img> fora do Safari.
 */
export async function uploadFotoComDerivados(
  bucket: string,
  path: string,
  file: File,
  ttlSecs: number,
): Promise<UploadFotoResult> {
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return { signedUrl: null, error: upErr.message }

  if (file.type !== 'image/heic') {
    try {
      const [thumb, preview] = await Promise.all([
        resizeToJpeg(file, THUMB_SIZE, 'cover', THUMB_QUALITY),
        resizeToJpeg(file, PREVIEW_SIZE, 'contain', PREVIEW_QUALITY),
      ])
      await Promise.all([
        thumb &&
          supabase.storage
            .from(bucket)
            .upload(thumbStoragePath(path), thumb, { contentType: 'image/jpeg', upsert: true }),
        preview &&
          supabase.storage
            .from(bucket)
            .upload(previewStoragePath(path), preview, { contentType: 'image/jpeg', upsert: true }),
      ])
    } catch (e) {
      console.warn('[fotoStorage] derivados falharam, mantendo só o original:', e)
    }
  }

  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSecs)
  return { signedUrl: data?.signedUrl ?? null, error: signErr?.message ?? null }
}
