/// <reference lib="webworker" />
// Web Worker que carrega face-api e calcula descritores fora do main thread.
// Comunica via postMessage: { id, kind: 'load' | 'compute', payload? }.

import * as faceapi from '@vladmandic/face-api'

const MODEL_URL = '/face-models'

const TINY_OPTS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
})

let modelsReady: Promise<void> | null = null

function loadModels(): Promise<void> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
    })()
  }
  return modelsReady
}

async function computeDescriptor(
  bitmap: ImageBitmap
): Promise<Float32Array | null> {
  await loadModels()
  const det = await faceapi
    .detectSingleFace(bitmap as unknown as HTMLImageElement, TINY_OPTS)
    .withFaceLandmarks(true)
    .withFaceDescriptor()
  return det?.descriptor ?? null
}

interface MsgIn {
  id: number
  kind: 'load' | 'compute'
  payload?: { bitmap?: ImageBitmap }
}

interface MsgOut {
  id: number
  ok: boolean
  result?: Float32Array | null
  error?: string
}

self.addEventListener('message', async (ev: MessageEvent<MsgIn>) => {
  const { id, kind, payload } = ev.data
  try {
    if (kind === 'load') {
      await loadModels()
      const out: MsgOut = { id, ok: true }
      ;(self as unknown as Worker).postMessage(out)
      return
    }
    if (kind === 'compute' && payload?.bitmap) {
      const d = await computeDescriptor(payload.bitmap)
      const out: MsgOut = { id, ok: true, result: d }
      ;(self as unknown as Worker).postMessage(out)
      payload.bitmap.close()
      return
    }
    throw new Error(`mensagem desconhecida: kind=${kind}`)
  } catch (e) {
    const out: MsgOut = {
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
    ;(self as unknown as Worker).postMessage(out)
  }
})

// Pre-warm: começa a carregar modelos assim que o worker instancia,
// sem esperar a primeira mensagem.
loadModels().catch(() => { /* silencioso — load() retentado por demanda */ })

export {}
