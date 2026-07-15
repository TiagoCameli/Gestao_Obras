import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { pathFromSignedUrl } from '../utils/signedUrl'

const BUCKET = 'abastecimento-fotos'
const URL_TTL_SECS = 60 * 60

async function mintArquivoUrl(url: string): Promise<string> {
  const path = pathFromSignedUrl(url)
  if (!path) return url
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECS)
  return data?.signedUrl ?? url
}

/**
 * Re-assina URLs FRESCAS pros anexos-documento (PDF/xlsx/docx) a partir do path
 * guardado no banco. As URLs salvas em arquivoUrls expiram em 1h (JWT `exp`);
 * reaproveitá-las direto no <a href> quebra com InvalidJWT ("exp claim
 * timestamp check failed"). Aqui extraímos o path e re-assinamos na hora.
 *
 * Mesma correção que useFotoThumbnails/FotoGaleria já aplicam às fotos — os
 * arquivos ficaram de fora do fix 8b9dfb0 e continuavam linkando a URL crua.
 *
 * Cache 30min via React Query (URLs duram 1h, re-mint antes de expirar).
 * Genérico — usado por entrada e saída de combustível (bucket abastecimento-fotos).
 */
export function useArquivoUrls(urls: string[]) {
  return useQuery({
    queryKey: ['arquivo-urls', urls],
    queryFn: () => Promise.all(urls.map(mintArquivoUrl)),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    enabled: urls.length > 0,
  })
}
