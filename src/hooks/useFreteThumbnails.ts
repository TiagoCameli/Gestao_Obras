import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { pathFromSignedUrl } from '../utils/signedUrl'

const BUCKET = 'abastecimento-fotos'
const URL_TTL_SECS = 60 * 60
const THUMB_SIZE = 400
const THUMB_QUALITY = 75

interface FotoUrls {
  thumb: string
  full: string
}

async function mintFotoUrls(url: string): Promise<FotoUrls> {
  const path = pathFromSignedUrl(url)
  if (!path) return { thumb: url, full: url }

  const [thumbRes, fullRes] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECS, {
      transform: { width: THUMB_SIZE, height: THUMB_SIZE, resize: 'cover', quality: THUMB_QUALITY },
    }),
    supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECS),
  ])

  return {
    thumb: thumbRes.data?.signedUrl ?? url,
    full: fullRes.data?.signedUrl ?? url,
  }
}

/**
 * Mintra URLs assinadas frescas pras fotos do frete:
 *  - thumb: com transform 400x400 q75 pro grid
 *  - full: sem transform (original) pro lightbox
 *
 * As URLs originais no banco têm TTL de 1h e expiram; sem re-mint, o lightbox
 * carregava um src 404. Cache 30min via React Query.
 * Fallback pra URL original se mint falhar (graciosa degradação).
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
