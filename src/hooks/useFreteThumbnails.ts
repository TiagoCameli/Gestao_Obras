import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { pathFromSignedUrl } from '../utils/signedUrl'

const BUCKET = 'abastecimento-fotos'
const URL_TTL_SECS = 60 * 60

const THUMB_SIZE = 400
const THUMB_QUALITY = 75

const PREVIEW_SIZE = 1400
const PREVIEW_QUALITY = 85

interface FotoUrls {
  /** 400x400 q75 (~30KB) — grid de thumbnails. */
  thumb: string
  /** 1400x1400 q85 (~150KB) — lightbox. Não é o full-res original. */
  preview: string
}

async function mintFotoUrls(url: string): Promise<FotoUrls> {
  const path = pathFromSignedUrl(url)
  if (!path) return { thumb: url, preview: url }

  const [thumbRes, previewRes] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECS, {
      transform: { width: THUMB_SIZE, height: THUMB_SIZE, resize: 'cover', quality: THUMB_QUALITY },
    }),
    supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECS, {
      transform: { width: PREVIEW_SIZE, height: PREVIEW_SIZE, resize: 'contain', quality: PREVIEW_QUALITY },
    }),
  ])

  return {
    thumb: thumbRes.data?.signedUrl ?? url,
    preview: previewRes.data?.signedUrl ?? url,
  }
}

/**
 * Mintra URLs assinadas frescas (com transform) pras fotos do frete:
 *  - thumb: 400x400 q75 pro grid
 *  - preview: 1400x1400 q85 pro lightbox
 *
 * As duas versões são otimizadas — preview tem ~150KB vs ~2MB do original,
 * permitindo pré-carregar 8 fotos sem saturar a rede.
 *
 * Pra download do original full-res, use `mintFreshOriginalUrl()` on-demand
 * (definida em utils/signedUrl.ts).
 *
 * Cache 30min via React Query (URLs duram 1h, re-mint antes de expirar).
 */
export function useFreteThumbnails(urls: string[]) {
  return useQuery({
    queryKey: ['frete-foto-urls', urls],
    queryFn: () => Promise.all(urls.map(mintFotoUrls)),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    enabled: urls.length > 0,
  })
}
