// Grid de fotos: thumbnail + abre no AnexoViewer (zoom, pan, swipe) + download.
// Re-assina URLs frescas a partir do path (corrige InvalidJWT de signed URLs
// expiradas). Delete opcional (só edit mode).
//
// Usada por combustível, frete, frota e manutenção (mesmo bucket).

import { useEffect, useState } from 'react'
import { Trash2, Download, ImageOff } from 'lucide-react'
import { useFotoThumbnails } from '../../hooks/useFotoThumbnails'
import { downloadSignedUrl, fileNameFromUrl } from '../../utils/signedUrl'
import { kindOfAnexo } from '../../utils/anexos'
import AnexoViewer, { type AnexoItem } from './AnexoViewer'

interface Props {
  fotoUrls: string[]
  canDelete: boolean
  canDownload: boolean
  onDelete?: (index: number) => void
  /** Variante de tamanho do grid. Default 'normal'. */
  size?: 'normal' | 'compact'
  /** Texto do placeholder quando não há foto. */
  emptyLabel?: string
}

export default function FotoGaleria({
  fotoUrls,
  canDelete,
  canDownload,
  onDelete,
  size = 'normal',
  emptyLabel = 'Sem fotos registradas.',
}: Props) {
  const [indiceAmpliada, setIndiceAmpliada] = useState<number | null>(null)
  const { data: fotoUrlsFrescas } = useFotoThumbnails(fotoUrls)

  const urlFresca = (i: number, kind: 'thumb' | 'preview' | 'original'): string =>
    fotoUrlsFrescas?.[i]?.[kind] ?? fotoUrls[i]

  // Pré-carrega TODAS as previews (1400x1400 q85, ~150KB cada) assim que o hook
  // resolve as URLs. Total ~1.2MB pra 8 fotos — browser cacheia em paralelo,
  // navegação no viewer vira instantânea (lê do cache).
  useEffect(() => {
    if (!fotoUrlsFrescas) return
    fotoUrlsFrescas.forEach(({ preview }) => {
      const img = new Image()
      img.src = preview
    })
  }, [fotoUrlsFrescas])

  if (fotoUrls.length === 0) {
    return (
      <div className="aspect-video rounded-lg border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center px-4">
        <ImageOff className="w-8 h-8 text-[var(--color-fg-muted)] mb-2" />
        <p className="text-sm text-[var(--color-fg-muted)]">{emptyLabel}</p>
      </div>
    )
  }

  const gridClass = size === 'compact'
    ? 'grid grid-cols-4 sm:grid-cols-6 gap-1.5'
    : 'grid grid-cols-3 sm:grid-cols-4 gap-2'

  const itens: AnexoItem[] = fotoUrls.map((url, i) => ({
    src: urlFresca(i, 'preview'),
    originalSrc: urlFresca(i, 'original'),
    nome: fileNameFromUrl(url),
    kind: kindOfAnexo(url),
  }))

  return (
    <>
      <div className={gridClass}>
        {fotoUrls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] group"
          >
            <button
              type="button"
              onClick={() => setIndiceAmpliada(i)}
              className="block w-full h-full"
              aria-label={`Foto ${i + 1} de ${fotoUrls.length} (ampliar)`}
            >
              <img
                src={urlFresca(i, 'thumb')}
                alt={`Foto ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </button>

            <div className="absolute top-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {canDownload && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadSignedUrl(urlFresca(i, 'original'), fileNameFromUrl(url))
                  }}
                  aria-label={`Baixar foto ${i + 1}`}
                  className="w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center"
                >
                  <Download aria-hidden className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(i)
                  }}
                  aria-label={`Remover foto ${i + 1}`}
                  className="w-7 h-7 rounded-full bg-black/60 text-white hover:bg-[var(--color-danger)] flex items-center justify-center"
                >
                  <Trash2 aria-hidden className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {indiceAmpliada !== null && (
        <AnexoViewer
          itens={itens}
          indice={indiceAmpliada}
          onIndice={setIndiceAmpliada}
          onClose={() => setIndiceAmpliada(null)}
          canDownload={canDownload}
        />
      )}
    </>
  )
}
