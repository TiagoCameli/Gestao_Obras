// Lista de anexos-documento (PDF/xlsx/docx/csv). Clicar abre no AnexoViewer:
// PDF renderiza in-app (com zoom e paginação), planilha/doc caem no card de
// download. Re-assina URLs frescas a partir do path (corrige InvalidJWT de
// signed URLs expiradas).
//
// Enquanto re-assina, o item aparece com spinner e sem ação, pra nunca navegar
// pra URL crua (expirada). Delete opcional (só edit mode).

import { useState } from 'react'
import { FileText, FileSpreadsheet, File as FileIcon, Loader2, Download, Trash2 } from 'lucide-react'
import { useArquivoUrls } from '../../hooks/useArquivoUrls'
import { downloadSignedUrl, fileNameFromUrl } from '../../utils/signedUrl'
import { kindOfAnexo, type AnexoKind } from '../../utils/anexos'
import AnexoViewer, { type AnexoItem } from './AnexoViewer'

interface Props {
  arquivoUrls: string[]
  canDownload?: boolean
  canDelete?: boolean
  onDelete?: (index: number) => void
}

function Icone({ kind }: { kind: AnexoKind }) {
  const cls = 'w-4 h-4 text-[var(--color-fg-muted)] shrink-0'
  if (kind === 'planilha') return <FileSpreadsheet aria-hidden className={cls} />
  if (kind === 'pdf' || kind === 'texto') return <FileText aria-hidden className={cls} />
  return <FileIcon aria-hidden className={cls} />
}

export default function ArquivosLista({
  arquivoUrls,
  canDownload = true,
  canDelete = false,
  onDelete,
}: Props) {
  const { data: urlsFrescas } = useArquivoUrls(arquivoUrls)
  const [indiceAberto, setIndiceAberto] = useState<number | null>(null)

  if (arquivoUrls.length === 0) return null

  const itens: AnexoItem[] = arquivoUrls.map((url, i) => ({
    src: urlsFrescas?.[i] ?? url,
    nome: fileNameFromUrl(url),
    kind: kindOfAnexo(url),
  }))

  return (
    <>
      <ul className="space-y-1.5">
        {arquivoUrls.map((url, i) => {
          const fresca = urlsFrescas?.[i]
          const nome = fileNameFromUrl(url)
          return (
            <li
              key={url + i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors group"
            >
              <Icone kind={kindOfAnexo(url)} />
              {fresca ? (
                <button
                  type="button"
                  onClick={() => setIndiceAberto(i)}
                  className="flex-1 min-w-0 text-left text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] truncate"
                  title={nome}
                >
                  {nome}
                </button>
              ) : (
                <span
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] truncate"
                  title={nome}
                >
                  <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin shrink-0" />
                  {nome}
                </span>
              )}

              {canDownload && fresca && (
                <button
                  type="button"
                  onClick={() => downloadSignedUrl(fresca, nome)}
                  aria-label={`Baixar ${nome}`}
                  className="w-7 h-7 rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center shrink-0"
                >
                  <Download aria-hidden className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(i)}
                  aria-label={`Remover ${nome}`}
                  className="w-7 h-7 rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center shrink-0"
                >
                  <Trash2 aria-hidden className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {indiceAberto !== null && (
        <AnexoViewer
          itens={itens}
          indice={indiceAberto}
          onIndice={setIndiceAberto}
          onClose={() => setIndiceAberto(null)}
          canDownload={canDownload}
        />
      )}
    </>
  )
}
