// Galeria de fotos do frete: grid com thumbnail + lightbox in-app + download por foto.
// Delete opcional (só edit mode). Suporta navegação por teclado (Esc, ←, →).

import { useEffect, useState } from 'react'
import { Trash2, Download, X, ChevronLeft, ChevronRight, ImageOff, Loader2 } from 'lucide-react'
import { useFreteThumbnails } from '../../hooks/useFreteThumbnails'
import { downloadSignedUrl, fileNameFromUrl } from '../../utils/signedUrl'

interface Props {
  fotoUrls: string[]
  canDelete: boolean
  canDownload: boolean
  onDelete?: (index: number) => void
  /** Variante de tamanho do grid. Default 'normal'. */
  size?: 'normal' | 'compact'
}

export default function FotoFreteGaleria({
  fotoUrls,
  canDelete,
  canDownload,
  onDelete,
  size = 'normal',
}: Props) {
  const [indiceAmpliada, setIndiceAmpliada] = useState<number | null>(null)
  const [fullLoaded, setFullLoaded] = useState(false)
  const { data: fotoUrlsFrescas } = useFreteThumbnails(fotoUrls)

  const urlFresca = (i: number, kind: 'thumb' | 'full'): string =>
    fotoUrlsFrescas?.[i]?.[kind] ?? fotoUrls[i]

  // Reset loading state whenever the ampliada index changes.
  useEffect(() => {
    setFullLoaded(false)
  }, [indiceAmpliada])

  // Pré-carrega TODAS as fotos em full-res assim que o hook resolve as URLs.
  // Assim qualquer click no lightbox (1ª foto ou qualquer próxima) é instantâneo
  // — browser já tem o blob em cache.
  useEffect(() => {
    if (!fotoUrlsFrescas) return
    fotoUrlsFrescas.forEach(({ full }) => {
      const img = new Image()
      img.src = full
    })
  }, [fotoUrlsFrescas])

  useEffect(() => {
    if (indiceAmpliada === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIndiceAmpliada(null)
      else if (e.key === 'ArrowLeft') setIndiceAmpliada((i) => ((i ?? 0) - 1 + fotoUrls.length) % fotoUrls.length)
      else if (e.key === 'ArrowRight') setIndiceAmpliada((i) => ((i ?? 0) + 1) % fotoUrls.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [indiceAmpliada, fotoUrls.length])

  if (fotoUrls.length === 0) {
    return (
      <div className="aspect-video rounded-lg border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center px-4">
        <ImageOff className="w-8 h-8 text-[var(--color-fg-muted)] mb-2" />
        <p className="text-sm text-[var(--color-fg-muted)]">Sem fotos registradas.</p>
      </div>
    )
  }

  const gridClass = size === 'compact'
    ? 'grid grid-cols-4 sm:grid-cols-6 gap-1.5'
    : 'grid grid-cols-3 sm:grid-cols-4 gap-2'

  return (
    <>
      <div className={gridClass}>
        {fotoUrls.map((url, i) => {
          return (
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
                      downloadSignedUrl(urlFresca(i, 'full'), fileNameFromUrl(url))
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
          )
        })}
      </div>

      {indiceAmpliada !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIndiceAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${indiceAmpliada + 1} ampliada`}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIndiceAmpliada(null) }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X aria-hidden className="w-5 h-5" />
          </button>

          {canDownload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                downloadSignedUrl(urlFresca(indiceAmpliada, 'full'), fileNameFromUrl(fotoUrls[indiceAmpliada]))
              }}
              className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 text-sm font-medium"
            >
              <Download aria-hidden className="w-4 h-4" />
              Baixar
            </button>
          )}

          {fotoUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndiceAmpliada(((indiceAmpliada ?? 0) - 1 + fotoUrls.length) % fotoUrls.length)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
                aria-label="Foto anterior"
              >
                <ChevronLeft aria-hidden className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndiceAmpliada(((indiceAmpliada ?? 0) + 1) % fotoUrls.length)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
                aria-label="Próxima foto"
              >
                <ChevronRight aria-hidden className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {!fullLoaded && (
              <Loader2 aria-hidden className="absolute w-10 h-10 text-white/80 animate-spin pointer-events-none" />
            )}
            <img
              key={indiceAmpliada}
              src={urlFresca(indiceAmpliada, 'full')}
              alt={`Foto ${indiceAmpliada + 1} ampliada`}
              onLoad={() => setFullLoaded(true)}
              onError={() => setFullLoaded(true)}
              className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain rounded-lg shadow-2xl transition-opacity duration-150"
              style={{ opacity: fullLoaded ? 1 : 0 }}
            />
          </div>

          {fotoUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 text-white text-xs">
              {indiceAmpliada + 1} de {fotoUrls.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}
