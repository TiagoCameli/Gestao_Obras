import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock do import com `?worker` — Vitest não resolve isso nativamente.
vi.mock('./faceRecognition.worker.ts?worker', () => {
  return {
    default: class FakeWorker {
      onmessage: ((ev: { data: unknown }) => void) | null = null
      postMessage(msg: { id: number; kind: string }) {
        // Responde async com sucesso, descriptor fake
        setTimeout(() => {
          this.onmessage?.({
            data: {
              id: msg.id,
              ok: true,
              result: msg.kind === 'compute' ? new Float32Array(128).fill(0.42) : undefined,
            },
          })
        }, 0)
      }
      terminate() {}
    },
  }
})

// Mock do face-api pra evitar carregar @tensorflow/tfjs-node em vitest/jsdom.
// Vite ?worker plugin pode resolver o worker file mesmo com mock acima,
// pois o sufixo `?worker` é stripped antes da resolução.
vi.mock('@vladmandic/face-api', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: vi.fn(async () => undefined) },
    faceLandmark68TinyNet: { loadFromUri: vi.fn(async () => undefined) },
    faceRecognitionNet: { loadFromUri: vi.fn(async () => undefined) },
  },
  TinyFaceDetectorOptions: class {},
  detectSingleFace: vi.fn(),
  euclideanDistance: vi.fn(),
}))

// Mock do cache pra não exigir IndexedDB
vi.mock('./descritorCache', () => ({
  getDescritor: vi.fn(async () => undefined),
  setDescritor: vi.fn(async () => undefined),
  clearCache: vi.fn(async () => undefined),
}))

import { compararFace, descritorDaImagem } from './faceWorkerClient'

beforeEach(() => {
  // jsdom: precisamos de Worker e createImageBitmap stubs pra supportsWorker() = true
  ;(globalThis as unknown as { Worker: typeof Worker }).Worker = class {
    onmessage: ((ev: { data: unknown }) => void) | null = null
    postMessage() {}
    terminate() {}
  } as unknown as typeof Worker
  globalThis.createImageBitmap = vi.fn(async () => ({ close: vi.fn() } as unknown as ImageBitmap))
  // Image stub
  ;(globalThis as unknown as { Image: typeof Image }).Image = class {
    crossOrigin = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_: string) { setTimeout(() => this.onload?.(), 0) }
  } as unknown as typeof Image
  // fetch stub pra urlToBitmap
  globalThis.fetch = vi.fn(async () => ({
    blob: async () => new Blob([new Uint8Array([0])], { type: 'image/jpeg' }),
  } as unknown as Response))
})

describe('faceWorkerClient', () => {
  it('descritorDaImagem retorna Float32Array do worker', async () => {
    const d = await descritorDaImagem('https://x/foo.jpg')
    expect(d).toBeInstanceOf(Float32Array)
    expect(d!.length).toBe(128)
    expect(d![0]).toBeCloseTo(0.42)
  })

  it('compararFace retorna match=true quando descritores idênticos', async () => {
    const res = await compararFace('https://x/teste.jpg', ['https://x/ref.jpg'])
    expect(res.threshold).toBe(0.55)
    // Mock retorna sempre o mesmo Float32Array(128).fill(0.42) → distância 0
    expect(res.distancia).toBeCloseTo(0)
    expect(res.match).toBe(true)
  })
})
