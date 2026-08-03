// Botão "Abrir anexos": abre TODOS os anexos de um registro (fotos + arquivos)
// no AnexoViewer, navegando entre eles com as setas. Pensado pros cards de
// lista, onde não cabe um grid — antes o atalho linkava a signed URL crua do
// primeiro arquivo, que expira em 1h (InvalidJWT).

import { useState } from 'react'
import { Paperclip, Loader2 } from 'lucide-react'
import { useFotoThumbnails } from '../../hooks/useFotoThumbnails'
import { useArquivoUrls } from '../../hooks/useArquivoUrls'
import { fileNameFromUrl } from '../../utils/signedUrl'
import { kindOfAnexo } from '../../utils/anexos'
import AnexoViewer, { type AnexoItem } from './AnexoViewer'

interface Props {
  fotoUrls: string[]
  arquivoUrls: string[]
  className?: string
  /** Texto do aria-label/title. */
  label?: string
}

export default function AnexosAbrirButton({
  fotoUrls,
  arquivoUrls,
  className = '',
  label = 'Abrir anexos',
}: Props) {
  const [aberto, setAberto] = useState<number | null>(null)
  const { data: fotosFrescas } = useFotoThumbnails(fotoUrls)
  const { data: arquivosFrescos } = useArquivoUrls(arquivoUrls)

  const total = fotoUrls.length + arquivoUrls.length
  if (total === 0) return null

  const pronto =
    (fotoUrls.length === 0 || !!fotosFrescas) && (arquivoUrls.length === 0 || !!arquivosFrescos)

  const itens: AnexoItem[] = [
    ...fotoUrls.map((url, i) => ({
      src: fotosFrescas?.[i]?.preview ?? url,
      originalSrc: fotosFrescas?.[i]?.original ?? url,
      nome: fileNameFromUrl(url),
      kind: kindOfAnexo(url),
    })),
    ...arquivoUrls.map((url, i) => ({
      src: arquivosFrescos?.[i] ?? url,
      nome: fileNameFromUrl(url),
      kind: kindOfAnexo(url),
    })),
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(0)}
        disabled={!pronto}
        aria-label={`${label} (${total})`}
        title={pronto ? label : 'Preparando anexos...'}
        className={
          'w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors ' +
          className
        }
      >
        {pronto ? (
          <Paperclip aria-hidden className="w-3.5 h-3.5" />
        ) : (
          <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
        )}
      </button>

      {aberto !== null && (
        <AnexoViewer
          itens={itens}
          indice={aberto}
          onIndice={setAberto}
          onClose={() => setAberto(null)}
        />
      )}
    </>
  )
}
