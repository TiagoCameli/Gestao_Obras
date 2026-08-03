/**
 * Classificação de anexos por extensão. Define o que o AnexoViewer sabe
 * pré-visualizar in-app (imagem e PDF) e o que só dá pra baixar.
 *
 * Recebe nome de arquivo OU signed URL do Storage (ignora query string).
 */

export type AnexoKind = 'imagem' | 'pdf' | 'planilha' | 'texto' | 'outro'

const EXT_IMAGEM = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif', 'avif'])
const EXT_PLANILHA = new Set(['xlsx', 'xls', 'csv'])
const EXT_TEXTO = new Set(['doc', 'docx', 'txt', 'rtf'])

/** Extensão em minúsculo, sem ponto. String vazia quando não dá pra inferir. */
export function extOf(nomeOuUrl: string): string {
  const semQuery = nomeOuUrl.split('?')[0]
  const ultimo = semQuery.split('/').pop() ?? ''
  const m = ultimo.match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : ''
}

export function kindOfAnexo(nomeOuUrl: string): AnexoKind {
  const ext = extOf(nomeOuUrl)
  if (EXT_IMAGEM.has(ext)) return 'imagem'
  if (ext === 'pdf') return 'pdf'
  if (EXT_PLANILHA.has(ext)) return 'planilha'
  if (EXT_TEXTO.has(ext)) return 'texto'
  return 'outro'
}

/** HEIC/HEIF não renderizam em Chrome/Firefox — cai no card de download. */
export function temPreviewInApp(kind: AnexoKind, nomeOuUrl: string): boolean {
  if (kind === 'pdf') return true
  if (kind !== 'imagem') return false
  const ext = extOf(nomeOuUrl)
  return ext !== 'heic' && ext !== 'heif'
}

const LABEL: Record<AnexoKind, string> = {
  imagem: 'Imagem',
  pdf: 'PDF',
  planilha: 'Planilha',
  texto: 'Documento',
  outro: 'Arquivo',
}

export function labelKind(kind: AnexoKind): string {
  return LABEL[kind]
}
