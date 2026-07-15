// Lista de anexos-documento (PDF/xlsx/docx) com nome legível e link que abre em
// nova aba. Re-assina URLs frescas a partir do path (corrige InvalidJWT de
// signed URLs expiradas) — mesma correção que FotoGaleria faz pras fotos.
// Enquanto re-assina, mostra o item com spinner e SEM href, pra nunca navegar
// pra URL crua (expirada). Usada pelos drawers de detalhe de entrada e saída.

import { FileText, Loader2 } from 'lucide-react'
import { useArquivoUrls } from '../../hooks/useArquivoUrls'
import { fileNameFromUrl } from '../../utils/signedUrl'

interface Props {
  arquivoUrls: string[]
}

export default function ArquivosLista({ arquivoUrls }: Props) {
  const { data: urlsFrescas } = useArquivoUrls(arquivoUrls)

  if (arquivoUrls.length === 0) return null

  return (
    <ul className="space-y-1.5">
      {arquivoUrls.map((url, i) => {
        const fresca = urlsFrescas?.[i]
        return (
          <li
            key={url + i}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <FileText aria-hidden className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
            {fresca ? (
              <a
                href={fresca}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] truncate"
                title={fileNameFromUrl(url)}
              >
                {fileNameFromUrl(url)}
              </a>
            ) : (
              <span
                className="flex-1 min-w-0 flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] truncate"
                title={fileNameFromUrl(url)}
              >
                <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin shrink-0" />
                {fileNameFromUrl(url)}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
