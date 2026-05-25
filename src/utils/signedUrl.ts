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
