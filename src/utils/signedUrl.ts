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

/**
 * Path no bucket a partir do que está guardado no banco. Tolera as duas formas:
 *  - signed URL completa (formato legado, o que está gravado hoje) -> extrai o path
 *  - path puro ("entrada/abc/123-nota.pdf") -> devolve ele mesmo
 *
 * Guardar signed URL no banco é a origem do InvalidJWT: o JWT expira em 1h e a
 * string fica velha pra sempre. Toda exibição re-assina a partir deste path.
 * Aceitar path puro deixa o caminho aberto pra gravar só o path no futuro sem
 * quebrar nada que já foi salvo.
 */
export function storagePathOf(valor: string): string | null {
  if (!valor) return null
  const doUrl = pathFromSignedUrl(valor)
  if (doUrl) return doUrl
  if (/^(https?:|blob:|data:)/i.test(valor)) return null
  return valor.replace(/^\/+/, '')
}

export function fileNameFromUrl(url: string): string {
  const path = storagePathOf(url)
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
