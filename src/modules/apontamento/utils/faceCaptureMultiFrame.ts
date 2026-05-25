// Lógica de captura multi-frame: tira N frames consecutivos e escolhe o
// que dá melhor match (menor distância). Parte pura (melhorDe3) testada
// em isolamento; capturar3 é assíncrono e testado por integração manual.

export interface MelhorMatch {
  indice: number
  distancia: number
}

export function melhorDe3(distancias: number[]): MelhorMatch {
  let indice = -1
  let distancia = Infinity
  for (let i = 0; i < distancias.length; i++) {
    const d = distancias[i]
    if (!Number.isFinite(d)) continue
    if (d < distancia) {
      distancia = d
      indice = i
    }
  }
  return { indice, distancia }
}

export interface Frame {
  dataUrl: string
  distancia: number
}

/**
 * Captura 3 frames do <video> com 250ms entre cada, calcula a distância
 * de cada um contra a função `computeDistance` (assíncrona, normalmente
 * delega ao worker), e retorna o melhor (menor distância).
 *
 * Retorna também os 3 frames pra debug — o caller decide qual gravar.
 */
export async function capturar3(
  videoEl: HTMLVideoElement,
  computeDistance: (dataUrl: string) => Promise<number>,
  opts: { overlay?: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => void } = {}
): Promise<{ frames: Frame[]; melhor: MelhorMatch }> {
  const canvas = document.createElement('canvas')
  canvas.width = videoEl.videoWidth || 640
  canvas.height = videoEl.videoHeight || 480
  const ctx = canvas.getContext('2d')!

  const tirar = (): string => {
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
    if (opts.overlay) opts.overlay(ctx, canvas)
    return canvas.toDataURL('image/jpeg', 0.85)
  }
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  const frames: Frame[] = []
  const promises: Promise<void>[] = []

  for (let i = 0; i < 3; i++) {
    if (i > 0) await wait(250)
    const dataUrl = tirar()
    const idx = frames.length
    frames.push({ dataUrl, distancia: Infinity })
    promises.push(
      computeDistance(dataUrl)
        .then((d) => { frames[idx].distancia = d })
        .catch(() => { /* deixa Infinity */ })
    )
  }

  await Promise.all(promises)
  const melhor = melhorDe3(frames.map((f) => f.distancia))
  return { frames, melhor }
}
