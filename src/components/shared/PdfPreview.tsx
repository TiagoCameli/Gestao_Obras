// Renderiza PDF em <canvas> via pdf.js. Canvas em vez de <iframe> porque o
// Safari do iPhone/iPad não rola PDF dentro de iframe (mostra só a 1a página) —
// e a maior parte dos anexos é conferida em campo, no celular.
//
// pdf.js entra por import dinâmico: sai do bundle principal e só baixa quando
// alguém abre um PDF de verdade. Worker vem do próprio pacote (Vite empacota),
// sem depender de CDN.

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  /** URL assinada FRESCA do PDF. */
  url: string
  /** Escala aplicada em cima do fit-to-width. */
  escala: number
}

interface PdfDoc {
  numPages: number
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number }
    render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void }
  }>
  destroy: () => Promise<void>
}

async function carregarPdf(url: string): Promise<PdfDoc> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.arrayBuffer()
  return pdfjs.getDocument({ data }).promise as unknown as PdfDoc
}

/** Um PdfPreview por URL: quem chama passa `key={url}`, então o estado nasce
 *  limpo em cada anexo e não precisa de reset dentro de efeito. */
export default function PdfPreview({ url, escala }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [pagina, setPagina] = useState(1)
  const [erro, setErro] = useState<string | null>(null)
  // "Renderizando" é derivado: o que já está pintado no canvas vs. o que se quer.
  const [pintado, setPintado] = useState<{ pagina: number; escala: number } | null>(null)
  const renderizando = !erro && (pintado?.pagina !== pagina || pintado?.escala !== escala)

  useEffect(() => {
    let vivo = true
    let atual: PdfDoc | null = null
    carregarPdf(url)
      .then((d) => {
        atual = d
        if (vivo) setDoc(d)
        else d.destroy()
      })
      .catch((e) => {
        console.warn('[PdfPreview] falha ao carregar PDF:', e)
        if (vivo) setErro('Não deu pra pré-visualizar este PDF aqui.')
      })
    return () => {
      vivo = false
      atual?.destroy()
    }
  }, [url])

  useEffect(() => {
    if (!doc) return
    let cancelado = false
    let tarefa: { promise: Promise<void>; cancel: () => void } | null = null

    ;(async () => {
      try {
        const page = await doc.getPage(pagina)
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (cancelado || !canvas || !ctx) return

        // Fit-to-width da coluna disponível, com teto pra não estourar memória
        // em telas grandes, e o zoom do usuário multiplicando por cima.
        const larguraBase = page.getViewport({ scale: 1 }).width
        const larguraDisponivel = Math.min(containerRef.current?.clientWidth ?? 900, 1100)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const fit = larguraDisponivel / larguraBase
        const viewport = page.getViewport({ scale: fit * escala * dpr })

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`

        tarefa = page.render({ canvasContext: ctx, viewport })
        await tarefa.promise
        if (!cancelado) setPintado({ pagina, escala })
      } catch (e) {
        if (!cancelado) {
          console.warn('[PdfPreview] falha ao renderizar página:', e)
          setErro('Não deu pra pré-visualizar este PDF aqui.')
        }
      }
    })()

    return () => {
      cancelado = true
      tarefa?.cancel()
    }
  }, [doc, pagina, escala])

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-white/80 px-6">
        <AlertTriangle aria-hidden className="w-8 h-8 text-[var(--color-warning)]" />
        <p className="text-sm">{erro}</p>
        <p className="text-xs text-white/60">Use "Baixar" ou "Abrir em nova aba".</p>
      </div>
    )
  }

  const totalPaginas = doc?.numPages ?? 0

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center gap-3">
      <div className="relative">
        {renderizando && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 aria-hidden className="w-8 h-8 text-white/80 animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="rounded-lg bg-white shadow-2xl max-w-full"
          style={{ opacity: renderizando ? 0.35 : 1, transition: 'opacity 120ms' }}
        />
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 text-white text-xs">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
            className="w-7 h-7 rounded-full hover:bg-white/15 disabled:opacity-40 flex items-center justify-center"
            aria-label="Página anterior"
          >
            <ChevronLeft aria-hidden className="w-4 h-4" />
          </button>
          <span className="tabular-nums min-w-[5rem] text-center">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
            className="w-7 h-7 rounded-full hover:bg-white/15 disabled:opacity-40 flex items-center justify-center"
            aria-label="Próxima página"
          >
            <ChevronRight aria-hidden className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
