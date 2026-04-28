import * as faceapi from "@vladmandic/face-api";

/**
 * Reconhecimento facial via @vladmandic/face-api.
 *
 * Os modelos são baixados sob demanda do CDN jsDelivr (~5 MB no total)
 * e ficam cacheados pelo browser. Mantemos isso fora do bundle pra
 * não inflar o build do app.
 */
const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

let modelsReady: Promise<void> | null = null;

function loadModels(): Promise<void> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
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

/** Extrai o vetor descritor (128D) do primeiro rosto detectado. */
export async function descritorDaImagem(
  url: string
): Promise<Float32Array | null> {
  await loadModels();
  const img = await imageFromUrl(url);
  const det = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det?.descriptor ?? null;
}

/**
 * Compara um rosto de teste contra N referências e devolve o melhor
 * match. Distância Euclidiana < 0.6 é considerado match (padrão da lib).
 */
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
  await loadModels();
  const teste = await descritorDaImagem(testeDataUrlOuUrl);
  if (!teste) return { match: false, distancia: 1, threshold: THRESHOLD };

  let melhor = Infinity;
  for (const ref of referenciasUrls) {
    try {
      const d = await descritorDaImagem(ref);
      if (!d) continue;
      const dist = faceapi.euclideanDistance(teste, d);
      if (dist < melhor) melhor = dist;
    } catch {
      // ignora referência ilegível
    }
  }
  return { match: melhor < THRESHOLD, distancia: melhor, threshold: THRESHOLD };
}
