/**
 * Helpers pra lidar com URLs assinadas do Supabase Storage.
 * Centraliza lógica que estava duplicada em AnexosUploader e FreteDetalhesDrawer.
 */

const SIGNED_URL_PATH_RE = /\/object\/sign\/[^/]+\/([^?]+)/
const TIMESTAMP_PREFIX_RE = /^\d+-/

export function pathFromSignedUrl(url: string): string | null {
  if (!url) return null
  const m = url.match(SIGNED_URL_PATH_RE)
  return m ? decodeURIComponent(m[1]) : null
}

export function fileNameFromUrl(url: string): string {
  const path = pathFromSignedUrl(url)
  if (!path) return url
  const last = path.split('/').pop() || path
  return last.replace(TIMESTAMP_PREFIX_RE, '')
}

/**
 * Caminhos dos derivados gerados no upload (ver fotoStorage.ts). Guardados como
 * irmãos do original no mesmo bucket: `<path>.thumb.jpg` e `<path>.preview.jpg`.
 * O grid e o lightbox leem esses arquivos prontos, em vez de pedir transform ao
 * Supabase (cota de Image Transformations: só 100/mês no plano Pro).
 */
export const thumbStoragePath = (path: string): string => `${path}.thumb.jpg`
export const previewStoragePath = (path: string): string => `${path}.preview.jpg`

export async function downloadSignedUrl(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = objUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      URL.revokeObjectURL(objUrl)
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
