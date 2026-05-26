// Facade que mantém a API antiga (preloadFaceModels, descritorDaImagem,
// precomputeReferences, compararFace, identifyFace), delegando ao worker
// quando disponível e ao legacy quando não. Cacheia descritores em IndexedDB.
//
// Substitui src/modules/apontamento/utils/faceRecognition.ts.

import FaceWorker from './faceRecognition.worker.ts?worker'
import { getDescritor, setDescritor } from './descritorCache'

const THRESHOLD = 0.55

// ──────────────────────────────────────────────────────────
// Detecção de suporte e seleção do backend
// ──────────────────────────────────────────────────────────

// Avaliado lazy a cada chamada — `createImageBitmap` pode ser instalado
// por stubs de teste após o módulo carregar, e em SSR `Worker` simplesmente
// não existe. Custo é desprezível (typeof check).
function supportsWorker(): boolean {
  // TEMP: forçando legacy (main-thread) enquanto investigamos por que a
  // detecção falha silenciosa no worker em prod (face-api retorna null
  // pra ImageBitmap, possivelmente TFJS backend não inicia, possivelmente
  // outro). Legacy usa <Image> + main thread — mesma stack que funcionava
  // antes desta feature.
  return false
  // eslint-disable-next-line no-unreachable
  return typeof Worker !== 'undefined' && typeof createImageBitmap !== 'undefined'
}

type LegacyApi = typeof import('./faceRecognitionLegacy')
let legacyPromise: Promise<LegacyApi> | null = null
async function loadLegacy(): Promise<LegacyApi> {
  if (!legacyPromise) legacyPromise = import('./faceRecognitionLegacy')
  return legacyPromise
}

// ──────────────────────────────────────────────────────────
// Worker singleton + RPC numérico
// ──────────────────────────────────────────────────────────

let worker: Worker | null = null
let nextId = 1
const pending = new Map<
  number,
  { resolve: (v: Float32Array | null) => void; reject: (e: Error) => void }
>()

function getWorker(): Worker {
  if (!worker) {
    worker = new FaceWorker()
    worker.onmessage = (ev: MessageEvent) => {
      const { id, ok, result, error } = ev.data as {
        id: number
        ok: boolean
        result?: Float32Array | null
        error?: string
      }
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (ok) p.resolve(result ?? null)
      else p.reject(new Error(error ?? 'worker error'))
    }
  }
  return worker
}

function callWorker(
  kind: 'load' | 'compute',
  bitmap?: ImageBitmap
): Promise<Float32Array | null> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    const w = getWorker()
    const payload = bitmap ? { bitmap } : undefined
    const transfer: Transferable[] = bitmap ? [bitmap] : []
    w.postMessage({ id, kind, payload }, transfer)
  })
}

// ──────────────────────────────────────────────────────────
// API pública (mesma assinatura do faceRecognition.ts antigo)
// ──────────────────────────────────────────────────────────

export async function preloadFaceModels(): Promise<void> {
  if (!supportsWorker()) {
    const legacy = await loadLegacy()
    return legacy.preloadFaceModels()
  }
  await callWorker('load')
}

async function urlToBitmap(url: string): Promise<ImageBitmap> {
  // dataURL vs http(s) — fetch funciona pra ambos no browser moderno
  const resp = await fetch(url)
  const blob = await resp.blob()
  return createImageBitmap(blob)
}

export async function descritorDaImagem(url: string): Promise<Float32Array | null> {
  if (!supportsWorker()) {
    const legacy = await loadLegacy()
    return legacy.descritorDaImagem(url)
  }
  const bitmap = await urlToBitmap(url)
  return callWorker('compute', bitmap)
}

// Cache de processo (memória) dos descritores já computados nesta sessão.
// IndexedDB é persistente entre sessões; este Map é fast-path pra evitar
// round-trip async no loop de comparação (e funciona quando o IDB stub
// retorna undefined, ex.: ambiente de teste).
const PROCESS_CACHE = new Map<string, Float32Array>()

/**
 * Pré-computa descritores das URLs de referência. Usa cache IndexedDB —
 * URLs já vistas pulam direto.
 */
export async function precomputeReferences(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  if (!supportsWorker()) {
    const legacy = await loadLegacy()
    return legacy.precomputeReferences(urls)
  }
  await Promise.all(
    urls.map(async (url) => {
      const cacheKey = cacheKeyOf(url)
      if (PROCESS_CACHE.has(cacheKey)) return
      const cached = await getDescritor(cacheKey)
      if (cached) {
        PROCESS_CACHE.set(cacheKey, cached)
        return
      }
      try {
        const bitmap = await urlToBitmap(url)
        const d = await callWorker('compute', bitmap)
        if (d) {
          PROCESS_CACHE.set(cacheKey, d)
          await setDescritor(cacheKey, d)
        }
      } catch {
        /* silencioso — compararFace re-tenta on-the-fly */
      }
    })
  )
}

async function getDescriptorWithCache(url: string): Promise<Float32Array | undefined> {
  const key = cacheKeyOf(url)
  const hit = PROCESS_CACHE.get(key)
  if (hit) return hit
  const persisted = await getDescritor(key)
  if (persisted) PROCESS_CACHE.set(key, persisted)
  return persisted
}

/** Extrai o path estável do signed URL pra usar como cache key. */
function cacheKeyOf(url: string): string {
  try {
    const u = new URL(url)
    // Supabase signed URL: /storage/v1/object/sign/{bucket}/{path}?token=...
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:sign|authenticated|public)\/[^/]+\/(.+)/)
    if (m) return m[1]
  } catch { /* não é URL válida — usa como está (dataURL etc.) */ }
  return url
}

function euclidean(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    s += d * d
  }
  return Math.sqrt(s)
}

export interface MatchResult {
  match: boolean
  distancia: number
  threshold: number
}

export async function compararFace(
  testeUrl: string,
  referenciasUrls: string[]
): Promise<MatchResult> {
  if (!supportsWorker()) {
    const legacy = await loadLegacy()
    return legacy.compararFace(testeUrl, referenciasUrls)
  }
  const [teste] = await Promise.all([
    descritorDaImagem(testeUrl),
    precomputeReferences(referenciasUrls),
  ])
  if (!teste) return { match: false, distancia: 1, threshold: THRESHOLD }

  let melhor = Infinity
  for (const ref of referenciasUrls) {
    const d = await getDescriptorWithCache(ref)
    if (!d) continue
    const dist = euclidean(teste, d)
    if (dist < melhor) melhor = dist
  }
  return { match: melhor < THRESHOLD, distancia: melhor, threshold: THRESHOLD }
}

export interface CandidatoFace {
  id: string
  urls: string[]
}

export interface IdentifyResult {
  match: boolean
  candidatoId: string | null
  distancia: number
  threshold: number
}

export async function identifyFace(
  testeUrl: string,
  candidatos: CandidatoFace[]
): Promise<IdentifyResult> {
  if (!supportsWorker()) {
    const legacy = await loadLegacy()
    return legacy.identifyFace(testeUrl, candidatos)
  }
  const todasUrls = candidatos.flatMap((c) => c.urls)
  const [teste] = await Promise.all([
    descritorDaImagem(testeUrl),
    precomputeReferences(todasUrls),
  ])
  if (!teste) return { match: false, candidatoId: null, distancia: 1, threshold: THRESHOLD }

  let melhorId: string | null = null
  let melhorDist = Infinity
  for (const c of candidatos) {
    let menor = Infinity
    for (const url of c.urls) {
      const d = await getDescriptorWithCache(url)
      if (!d) continue
      const dist = euclidean(teste, d)
      if (dist < menor) menor = dist
    }
    if (menor < melhorDist) {
      melhorDist = menor
      melhorId = c.id
    }
  }
  return { match: melhorDist < THRESHOLD, candidatoId: melhorId, distancia: melhorDist, threshold: THRESHOLD }
}
