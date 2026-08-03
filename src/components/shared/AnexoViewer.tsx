// Visualizador único de anexos do app: uma lightbox só, usada por toda tela que
// mostra foto ou arquivo (combustível, frete, frota, manutenção, mobile).
//
// Por que existir: cada tela tinha seu próprio jeito de abrir anexo (a maioria
// jogava a signed URL crua numa aba nova, que já vinha expirada -> InvalidJWT).
// Aqui a URL sempre chega fresca de quem chama, e o comportamento é o mesmo em
// todo lugar.
//
// - imagem: zoom (roda do mouse, pinça, duplo clique, botões) + arrastar pra
//   deslocar, com a imagem travada dentro da moldura
// - PDF: renderizado in-app em canvas (PdfPreview), com paginação
// - planilha/doc: sem preview possível no browser, mostra card com Baixar
// - navegação entre anexos: setas, swipe no celular, Esc fecha

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X, ChevronLeft, ChevronRight, Download, ExternalLink,
  ZoomIn, ZoomOut, Maximize2, FileSpreadsheet, FileText, File as FileIcon,
} from 'lucide-react'
import { downloadSignedUrl } from '../../utils/signedUrl'
import { labelKind, temPreviewInApp, type AnexoKind } from '../../utils/anexos'
import PdfPreview from './PdfPreview'

export interface AnexoItem {
  /** URL assinada FRESCA usada na exibição (preview, no caso de foto). */
  src: string
  /** URL assinada FRESCA do original, pro download. Default: src. */
  originalSrc?: string
  nome: string
  kind: AnexoKind
}

interface Props {
  itens: AnexoItem[]
  indice: number
  onIndice: (i: number) => void
  onClose: () => void
  canDownload?: boolean
}

const ESCALA_MIN = 1
const ESCALA_MAX = 6
const ESCALA_DUPLO_CLIQUE = 2.5

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function IconePorKind({ kind }: { kind: AnexoKind }) {
  if (kind === 'planilha') return <FileSpreadsheet aria-hidden className="w-10 h-10" />
  if (kind === 'texto') return <FileText aria-hidden className="w-10 h-10" />
  return <FileIcon aria-hidden className="w-10 h-10" />
}

export default function AnexoViewer({ itens, indice, onIndice, onClose, canDownload = true }: Props) {
  const item = itens[indice]
  const palcoRef = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  // Spinner da imagem derivado do src já carregado — evita reset em efeito.
  const [srcCarregado, setSrcCarregado] = useState<string | null>(null)

  const arrastando = useRef(false)
  const ultimoPonto = useRef({ x: 0, y: 0 })
  const pinca = useRef<{ dist: number; escala: number } | null>(null)
  const inicioSwipe = useRef<{ x: number; y: number } | null>(null)

  const total = itens.length
  const temPreview = item ? temPreviewInApp(item.kind, item.nome) : false

  const resetZoom = useCallback(() => {
    setEscala(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const irPara = useCallback(
    (i: number) => {
      resetZoom()
      onIndice(((i % total) + total) % total)
    },
    [onIndice, resetZoom, total],
  )

  // Limita o deslocamento pra imagem nunca sair da moldura.
  const limitarOffset = useCallback((x: number, y: number, s: number) => {
    const el = palcoRef.current
    const maxX = el ? ((s - 1) * el.clientWidth) / 2 : 0
    const maxY = el ? ((s - 1) * el.clientHeight) / 2 : 0
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) }
  }, [])

  /** Zoom mantendo fixo o ponto (px, py) medido do centro do palco. */
  const zoomEmPonto = useCallback(
    (novaEscala: number, px: number, py: number) => {
      setEscala((sAtual) => {
        const s = clamp(novaEscala, ESCALA_MIN, ESCALA_MAX)
        const k = s / sAtual
        setOffset((o) => {
          if (s === ESCALA_MIN) return { x: 0, y: 0 }
          return limitarOffset(px * (1 - k) + k * o.x, py * (1 - k) + k * o.y, s)
        })
        return s
      })
    },
    [limitarOffset],
  )

  const zoomBotao = (fator: number) => zoomEmPonto(escala * fator, 0, 0)

  // Teclado + trava do scroll de fundo.
  //
  // Escuta em fase de CAPTURA e corta a propagação das teclas que o viewer usa:
  // ele costuma abrir dentro de um Sheet/Drawer, e sem isso o Esc fecharia o
  // drawer junto (o Radix escuta no document, que só recebe depois do window).
  useEffect(() => {
    const TECLAS = ['Escape', 'ArrowLeft', 'ArrowRight', '+', '=', '-', '_', '0']
    function onKey(e: KeyboardEvent) {
      if (!TECLAS.includes(e.key)) return
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && total > 1) irPara(indice - 1)
      else if (e.key === 'ArrowRight' && total > 1) irPara(indice + 1)
      else if (e.key === '+' || e.key === '=') zoomBotao(1.4)
      else if (e.key === '-' || e.key === '_') zoomBotao(1 / 1.4)
      else if (e.key === '0') resetZoom()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true })
      document.body.style.overflow = overflowAnterior
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zoomBotao muda em toda renderização; as deps reais são as listadas.
  }, [indice, total, irPara, onClose, resetZoom, escala])

  // Wheel precisa de listener não-passivo pra poder preventDefault (o React
  // registra wheel como passivo e a página rolaria atrás da lightbox).
  useEffect(() => {
    const el = palcoRef.current
    if (!el || item?.kind !== 'imagem') return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const r = el!.getBoundingClientRect()
      const px = e.clientX - (r.left + r.width / 2)
      const py = e.clientY - (r.top + r.height / 2)
      zoomEmPonto(escala * (e.deltaY < 0 ? 1.15 : 1 / 1.15), px, py)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [escala, zoomEmPonto, item?.kind])

  if (!item) return null

  const urlOriginal = item.originalSrc ?? item.src

  function baixar() {
    downloadSignedUrl(urlOriginal, item.nome)
  }

  // ── Gestos de toque: pinça pra zoom, swipe pra trocar de anexo ──
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      pinca.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), escala }
      inicioSwipe.current = null
    } else if (e.touches.length === 1) {
      inicioSwipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinca.current) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const r = palcoRef.current?.getBoundingClientRect()
      const cx = (a.clientX + b.clientX) / 2 - ((r?.left ?? 0) + (r?.width ?? 0) / 2)
      const cy = (a.clientY + b.clientY) / 2 - ((r?.top ?? 0) + (r?.height ?? 0) / 2)
      zoomEmPonto((pinca.current.escala * dist) / pinca.current.dist, cx, cy)
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    pinca.current = null
    const inicio = inicioSwipe.current
    inicioSwipe.current = null
    if (!inicio || escala > 1 || total <= 1) return
    const t = e.changedTouches[0]
    if (!t) return
    const dx = t.clientX - inicio.x
    const dy = t.clientY - inicio.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) irPara(indice + (dx < 0 ? 1 : -1))
  }

  // ── Arrastar com mouse (só faz sentido com zoom aplicado) ──
  function onPointerDown(e: React.PointerEvent) {
    if (escala <= 1 || e.pointerType === 'touch') return
    arrastando.current = true
    ultimoPonto.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!arrastando.current) return
    const dx = e.clientX - ultimoPonto.current.x
    const dy = e.clientY - ultimoPonto.current.y
    ultimoPonto.current = { x: e.clientX, y: e.clientY }
    setOffset((o) => limitarOffset(o.x + dx, o.y + dy, escala))
  }

  function onPointerUp() {
    arrastando.current = false
  }

  const podeZoom = item.kind === 'imagem' || item.kind === 'pdf'

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Anexo: ${item.nome}`}
    >
      {/* Barra de ações */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-14 text-white bg-black/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" title={item.nome}>{item.nome}</p>
          <p className="text-[11px] text-white/60">
            {labelKind(item.kind)}
            {total > 1 && ` · ${indice + 1} de ${total}`}
          </p>
        </div>

        {podeZoom && temPreview && (
          <div className="hidden sm:flex items-center gap-1 mr-1">
            <button
              type="button" onClick={() => zoomBotao(1 / 1.4)} disabled={escala <= ESCALA_MIN}
              className="w-9 h-9 rounded-full hover:bg-white/15 disabled:opacity-40 flex items-center justify-center"
              aria-label="Diminuir zoom"
            >
              <ZoomOut aria-hidden className="w-4 h-4" />
            </button>
            <span className="text-xs tabular-nums w-11 text-center text-white/70">
              {Math.round(escala * 100)}%
            </span>
            <button
              type="button" onClick={() => zoomBotao(1.4)} disabled={escala >= ESCALA_MAX}
              className="w-9 h-9 rounded-full hover:bg-white/15 disabled:opacity-40 flex items-center justify-center"
              aria-label="Aumentar zoom"
            >
              <ZoomIn aria-hidden className="w-4 h-4" />
            </button>
            <button
              type="button" onClick={resetZoom} disabled={escala === ESCALA_MIN}
              className="w-9 h-9 rounded-full hover:bg-white/15 disabled:opacity-40 flex items-center justify-center"
              aria-label="Ajustar à tela"
            >
              <Maximize2 aria-hidden className="w-4 h-4" />
            </button>
          </div>
        )}

        {canDownload && (
          <button
            type="button" onClick={baixar}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium"
          >
            <Download aria-hidden className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar</span>
          </button>
        )}
        <a
          href={urlOriginal} target="_blank" rel="noopener noreferrer"
          className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center"
          aria-label="Abrir em nova aba"
        >
          <ExternalLink aria-hidden className="w-4 h-4" />
        </a>
        <button
          type="button" onClick={onClose}
          className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center"
          aria-label="Fechar"
        >
          <X aria-hidden className="w-5 h-5" />
        </button>
      </div>

      {/* Palco */}
      <div
        ref={palcoRef}
        className={`relative flex-1 min-h-0 flex items-center justify-center ${
          item.kind === 'pdf' ? 'overflow-auto py-4' : 'overflow-hidden'
        }`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: item.kind === 'imagem' && escala > 1 ? 'grab' : 'default', touchAction: 'none' }}
      >
        {item.kind === 'imagem' && temPreview && (
          <>
            {srcCarregado !== item.src && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              </div>
            )}
            <img
              key={item.src}
              src={item.src}
              alt={item.nome}
              onLoad={() => setSrcCarregado(item.src)}
              onError={() => setSrcCarregado(item.src)}
              onDoubleClick={() =>
                escala > 1 ? resetZoom() : zoomEmPonto(ESCALA_DUPLO_CLIQUE, 0, 0)
              }
              draggable={false}
              className="max-h-full max-w-full object-contain select-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${escala})`,
                transition: arrastando.current || pinca.current ? 'none' : 'transform 120ms ease-out',
                opacity: srcCarregado === item.src ? 1 : 0,
              }}
            />
          </>
        )}

        {item.kind === 'pdf' && <PdfPreview key={urlOriginal} url={urlOriginal} escala={escala} />}

        {!temPreview && (
          <div className="flex flex-col items-center gap-3 text-center text-white/80 px-6">
            <IconePorKind kind={item.kind} />
            <p className="text-sm font-medium text-white">{item.nome}</p>
            <p className="text-xs text-white/60">
              {labelKind(item.kind)} não abre direto no navegador.
            </p>
            {canDownload && (
              <button
                type="button" onClick={baixar}
                className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-white text-black text-sm font-semibold"
              >
                <Download aria-hidden className="w-4 h-4" />
                Baixar arquivo
              </button>
            )}
          </div>
        )}

        {total > 1 && (
          <>
            <button
              type="button" onClick={() => irPara(indice - 1)}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/80 flex items-center justify-center"
              aria-label="Anexo anterior"
            >
              <ChevronLeft aria-hidden className="w-5 h-5" />
            </button>
            <button
              type="button" onClick={() => irPara(indice + 1)}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/80 flex items-center justify-center"
              aria-label="Próximo anexo"
            >
              <ChevronRight aria-hidden className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
