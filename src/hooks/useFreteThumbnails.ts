import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { pathFromSignedUrl } from '../utils/signedUrl'

const BUCKET = 'abastecimento-fotos'
const THUMB_TTL_SECS = 60 * 60
const THUMB_SIZE = 400
const THUMB_QUALITY = 75

async function mintThumbnail(url: string): Promise<string> {
  const path = pathFromSignedUrl(url)
  if (!path) return url
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, THUMB_TTL_SECS, {
      transform: { width: THUMB_SIZE, height: THUMB_SIZE, resize: 'cover', quality: THUMB_QUALITY },
    })
  if (error || !data?.signedUrl) return url
  return data.signedUrl
}

/**
 * Mintra URLs assinadas com transform (400x400, q75) pras fotos do frete.
 * Cache 30min (URLs assinadas duram 1h, então re-mint antes de expirar).
 * Fallback pra URL original se transform falhar (graciosa degradação).
 */
export function useFreteThumbnails(urls: string[]) {
  return useQuery({
    queryKey: ['frete-thumbnails', ...urls],
    queryFn: () => Promise.all(urls.map(mintThumbnail)),
    staleTime: 1000 * 60 * 30,
    enabled: urls.length > 0,
  })
}
