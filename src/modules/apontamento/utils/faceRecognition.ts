import * as faceapi from "@vladmandic/face-api";

/**
 * Reconhecimento facial via @vladmandic/face-api (main thread).
 *
 * Implementação simples e direta — sem Web Worker, sem cache IndexedDB,
 * sem multi-frame. A tentativa anterior com worker quebrou iOS Safari
 * (loop de reload na rota /apontamento?tab=ponto). Versão atual é a que
 * comprovadamente roda em campo.
 *
 * Modelos servidos pelo próprio Vercel (/face-models/), commitados no repo
 * em public/face-models/. Sem dependência de CDN externo.
 * Tiny detector (~190KB) ao invés de SSD MobileNet (~5MB) porque é 3-5x
 * mais rápido e suficiente pra uma única face de batida de ponto.
 *
 * Descritores das fotos de referência são memorizados em memória por URL
 * (REF_CACHE) — comparações subsequentes só processam o frame do teste.
 */
const MODEL_URL = "/face-models";

const TINY_OPTS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,      // 320 é um bom equilíbrio (default é 416)
  scoreThreshold: 0.5,
});

let modelsReady: Promise<void> | null = null;

export function preloadFaceModels(): Promise<void> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    })();
  }
  return modelsReady;
}

async function imageFromUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Falha ao carregar imagem"));
  });
  return img;
}

async function detectDescriptor(img: HTMLImageElement): Promise<Float32Array | null> {
  const det = await faceapi
    .detectSingleFace(img, TINY_OPTS)
    .withFaceLandmarks(true) // tiny landmarks
    .withFaceDescriptor();
  return det?.descriptor ?? null;
}

/** Extrai o vetor descritor (128D) do primeiro rosto detectado. */
export async function descritorDaImagem(
  url: string
): Promise<Float32Array | null> {
  await preloadFaceModels();
  const img = await imageFromUrl(url);
  return detectDescriptor(img);
}

// Cache de descritores das fotos de referência (chave = URL).
const REF_CACHE = new Map<string, Float32Array | null>();

/**
 * Pré-computa (em paralelo) os descritores das fotos de referência.
 * Pode ser chamado quando o modal de captura abre, para que ao apertar
 * "Capturar" só sobre processar o frame do teste — economia de 60-80%
 * do tempo na primeira batida e ~100% nas subsequentes (cache).
 */
export async function precomputeReferences(urls: string[]): Promise<void> {
  await preloadFaceModels();
  const todo = urls.filter((u) => !REF_CACHE.has(u));
  if (todo.length === 0) return;
  await Promise.all(
    todo.map(async (url) => {
      try {
        const img = await imageFromUrl(url);
        REF_CACHE.set(url, await detectDescriptor(img));
      } catch {
        REF_CACHE.set(url, null);
      }
    })
  );
}

export interface MatchResult {
  match: boolean;
  distancia: number;
  threshold: number;
}

const THRESHOLD = 0.55;

export async function compararFace(
  testeDataUrlOuUrl: string,
  referenciasUrls: string[]
): Promise<MatchResult> {
  await preloadFaceModels();
  const [teste] = await Promise.all([
    descritorDaImagem(testeDataUrlOuUrl),
    precomputeReferences(referenciasUrls),
  ]);
  if (!teste) return { match: false, distancia: 1, threshold: THRESHOLD };

  let melhor = Infinity;
  for (const ref of referenciasUrls) {
    const d = REF_CACHE.get(ref);
    if (!d) continue;
    const dist = faceapi.euclideanDistance(teste, d);
    if (dist < melhor) melhor = dist;
  }
  return { match: melhor < THRESHOLD, distancia: melhor, threshold: THRESHOLD };
}

export interface CandidatoFace {
  id: string;
  urls: string[];
}

export interface IdentifyResult {
  match: boolean;
  candidatoId: string | null;
  distancia: number;
  threshold: number;
}

/**
 * Identifica o melhor candidato entre vários funcionários, comparando o
 * frame do teste contra as fotos de referência de cada um. Retorna o ID
 * do candidato com menor distância média mínima abaixo do threshold.
 */
export async function identifyFace(
  testeDataUrlOuUrl: string,
  candidatos: CandidatoFace[]
): Promise<IdentifyResult> {
  await preloadFaceModels();
  const todasUrls = candidatos.flatMap((c) => c.urls);
  const [teste] = await Promise.all([
    descritorDaImagem(testeDataUrlOuUrl),
    precomputeReferences(todasUrls),
  ]);
  if (!teste) {
    return { match: false, candidatoId: null, distancia: 1, threshold: THRESHOLD };
  }

  let melhorId: string | null = null;
  let melhorDist = Infinity;
  for (const c of candidatos) {
    let menor = Infinity;
    for (const url of c.urls) {
      const d = REF_CACHE.get(url);
      if (!d) continue;
      const dist = faceapi.euclideanDistance(teste, d);
      if (dist < menor) menor = dist;
    }
    if (menor < melhorDist) {
      melhorDist = menor;
      melhorId = c.id;
    }
  }
  return {
    match: melhorDist < THRESHOLD,
    candidatoId: melhorId,
    distancia: melhorDist,
    threshold: THRESHOLD,
  };
}
