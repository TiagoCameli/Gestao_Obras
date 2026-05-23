// Scanner de QR mobile in-app.
// Resolve as 57 etiquetas físicas com URL localhost (bug pre-fix 10253b3) —
// scanner extrai o ID do equipamento via regex e navega in-app, ignorando o
// host do QR. Operador deve abrir o app primeiro (não câmera nativa).
//
// Spec: docs/superpowers/specs/2026-05-21-qr-scanner-mobile-design.md

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Html5Qrcode, type CameraDevice } from 'html5-qrcode'
import { ArrowLeft, Flashlight, FlashlightOff, RefreshCw, Camera } from 'lucide-react'
import { extractEquipamentoId } from '../../utils/parseFreteQrUrl'
import { useToast } from '../../components/ui/Toast'

const READER_ELEMENT_ID = 'qr-scanner-reader'

type ScanStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'error'

export default function MScanPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  // Botão Voltar volta direto pra origem (passada pelo MobileScanShortcut via ?from=),
  // pulando a intermediária /m. Se não houver origem (acesso direto a /m/scan), cai em /m.
  const [searchParams] = useSearchParams()
  const fromParam = searchParams.get('from')
  const voltarTo = fromParam ?? '/m'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [cameraIdx, setCameraIdx] = useState(0)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return
    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop()
      }
      scannerRef.current.clear()
    } catch {
      // Stop pode falhar se já parou — ignora
    }
    scannerRef.current = null
  }, [])

  const handleDecoded = useCallback(
    (decodedText: string) => {
      const id = extractEquipamentoId(decodedText)
      if (!id) {
        showToast({ kind: 'error', message: 'QR não reconhecido. Aponte pra etiqueta de um equipamento.' })
        return
      }
      // Vibração curta de feedback (Android; iOS ignora)
      if ('vibrate' in navigator) navigator.vibrate(100)
      stopScanner().then(() => navigate(`/m/eq/${id}`))
    },
    [navigate, showToast, stopScanner],
  )

  const startScanner = useCallback(async (deviceId?: string) => {
    setStatus('starting')
    setErrorMsg('')
    try {
      // Lista câmeras (pede permissão na primeira vez)
      const devices = await Html5Qrcode.getCameras()
      if (devices.length === 0) {
        setStatus('error')
        setErrorMsg('Nenhuma câmera encontrada neste dispositivo.')
        return
      }
      setCameras(devices)

      // Quando deviceId é passado (botão "Trocar câmera"): usa esse id.
      // Quando é o boot inicial (deviceId undefined): pede traseira via
      // facingMode (mais robusto que parsear label, que pode vir em pt-BR
      // — "Câmera traseira" — ou vazio antes da permissão em iOS Safari).
      // html5-qrcode aceita apenas string simples ou { exact }, não { ideal }.
      const cameraSelector: string | MediaTrackConstraints = deviceId
        ?? { facingMode: 'environment' }

      // Atualiza UI: tenta achar índice da traseira por label PT/EN; se
      // não acha, fica em 0 (não bloqueia, só pra exibição).
      if (deviceId) {
        const idx = devices.findIndex((d) => d.id === deviceId)
        if (idx >= 0) setCameraIdx(idx)
      } else {
        const backIdx = devices.findIndex((d) =>
          /back|rear|environment|traseira|trás/i.test(d.label),
        )
        setCameraIdx(backIdx >= 0 ? backIdx : 0)
      }

      // Inicia decoder
      const scanner = new Html5Qrcode(READER_ELEMENT_ID, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        cameraSelector,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleDecoded(decodedText),
        () => {
          // Frame sem QR — callback de erro normal, não logar
        },
      )

      // Check torch support
      try {
        const trackSettings = scanner.getRunningTrackSettings() as unknown as { torch?: boolean }
        setTorchSupported(typeof trackSettings.torch !== 'undefined')
      } catch {
        setTorchSupported(false)
      }

      setStatus('ready')
    } catch (err) {
      console.error('Falha ao iniciar scanner:', err)
      const msg = err instanceof Error ? err.message : String(err)
      if (/permission|denied|notallowed/i.test(msg)) {
        setStatus('denied')
        setErrorMsg('Permissão de câmera negada. Vá nas configurações do navegador para liberar.')
      } else {
        setStatus('error')
        setErrorMsg(`Não foi possível abrir a câmera: ${msg}`)
      }
    }
  }, [handleDecoded])

  // Inicia ao montar; para ao desmontar
  useEffect(() => {
    startScanner()
    return () => {
      void stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTrocarCamera = useCallback(async () => {
    if (cameras.length < 2) return
    await stopScanner()
    const nextIdx = (cameraIdx + 1) % cameras.length
    setCameraIdx(nextIdx)
    setTorchOn(false)
    await startScanner(cameras[nextIdx].id)
  }, [cameras, cameraIdx, startScanner, stopScanner])

  const handleToggleTorch = useCallback(async () => {
    if (!scannerRef.current || !torchSupported) return
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      })
      setTorchOn((v) => !v)
    } catch (err) {
      console.warn('Falha ao alterar lanterna:', err)
    }
  }, [torchOn, torchSupported])

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
        <Link to={voltarTo} className="inline-flex items-center gap-2 text-sm" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </Link>
        <span className="text-xs uppercase tracking-wider opacity-70">EMT Construtora</span>
      </div>

      {/* Camera area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div id={READER_ELEMENT_ID} className="w-full h-full" />

        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
            <Camera className="w-12 h-12 mb-3 animate-pulse" />
            <p className="text-sm">Preparando câmera…</p>
          </div>
        )}

        {(status === 'denied' || status === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white text-center px-6 gap-3">
            <Camera className="w-12 h-12 text-red-400" />
            <h2 className="text-base font-semibold">
              {status === 'denied' ? 'Permissão de câmera negada' : 'Erro ao abrir câmera'}
            </h2>
            <p className="text-sm opacity-80 max-w-xs">{errorMsg}</p>
            <button
              type="button"
              onClick={() => startScanner()}
              className="mt-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-sm font-medium"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Footer with hint + controls */}
      <div className="px-4 py-3 bg-black/80 text-white">
        <p className="text-center text-sm mb-2">Aponte pro QR do equipamento</p>
        <div className="flex justify-center gap-3">
          {torchSupported && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
              aria-pressed={torchOn}
            >
              {torchOn ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
              Lanterna
            </button>
          )}
          {cameras.length > 1 && (
            <button
              type="button"
              onClick={handleTrocarCamera}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Trocar câmera
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
