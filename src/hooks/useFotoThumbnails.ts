import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { storagePathOf, thumbStoragePath, previewStoragePath } from '../utils/signedUrl'

const BUCKET = 'abastecimento-fotos'
const URL_TTL_SECS = 60 * 60

interface FotoUrls {
  /** 400x400 q75 (~30KB) — grid de thumbnails. */
  thumb: string
  /** 1400px q85 (~150KB) — lightbox. Não é o full-res original. */
  preview: string
  /** Full-res original — download e fallback. */
  original: string
}

async function mintFotoUrls(url: string): Promise<FotoUrls> {
  const path = storagePathOf(url)
  if (!path) return { thumb: url, preview: url, original: url }

  // Assina o original + os derivados (gerados no upload por fotoStorage.ts).
  // SEM transform: zero consumo da cota de Image Transformations do Supabase.
  const [origRes, thumbRes, previewRes] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECS),
    supabase.storage.from(BUCKET).createSignedUrl(thumbStoragePath(path), URL_TTL_SECS),
    supabase.storage.from(BUCKET).createSignedUrl(previewStoragePath(path), URL_TTL_SECS),
  ])

  // Fotos antigas (subidas antes desta mudança) não têm derivados: o sign
  // falha e caímos no original full-res. Funciona, só pesa mais na rede.
  const original = origRes.data?.signedUrl ?? url
  return {
    thumb: thumbRes.data?.signedUrl ?? original,
    preview: previewRes.data?.signedUrl ?? original,
    original,
  }
}

/**
 * Mintra URLs assinadas FRESCAS a partir do path guardado no banco. As URLs
 * salvas em fotoUrls expiram em 1h (JWT `exp`); reaproveitá-las direto no <img>
 * quebra com InvalidJWT. Aqui extraímos o path e re-assinamos na hora, lendo os
 * derivados gerados no upload (fotoStorage.ts):
 *  - thumb: 400x400 q75 pro grid
 *  - preview: 1400px q85 pro lightbox
 *  - original: full-res, usado no download
 *
 * preview tem ~150KB vs ~2MB do original, permitindo pré-carregar 8 fotos sem
 * saturar a rede. Assinar o original não baixa nada — só gera a URL.
 *
 * Cache 30min via React Query (URLs duram 1h, re-mint antes de expirar).
 *
 * Genérico — usado por frete, combustível, frota e manutenção (mesmo bucket).
 */
export function useFotoThumbnails(urls: string[]) {
  return useQuery({
    queryKey: ['foto-urls', urls],
    queryFn: () => Promise.all(urls.map(mintFotoUrls)),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    enabled: urls.length > 0,
  })
}
