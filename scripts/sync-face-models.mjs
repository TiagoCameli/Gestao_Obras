#!/usr/bin/env node
// Copia os modelos de @vladmandic/face-api pra public/face-models/.
// Roda no postinstall (dev local) E no build (Vercel — não confia que
// postinstall vai rodar sempre). Sem isso o worker não tem como carregar
// os modelos e a captura facial trava com "distância 1.00".
//
// Os filenames refletem a distribuição REAL do @vladmandic/face-api:
// `<name>-weights_manifest.json` + `<name>.bin` — NÃO `*-shard1` (que é
// do fork antigo justadudewhohacks/face-api.js, com filenames diferentes).

import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'node_modules/@vladmandic/face-api/model')
const DST = join(ROOT, 'public/face-models')

const REQUIRED = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
]

if (!existsSync(SRC)) {
  console.warn(`[sync-face-models] skip: ${SRC} não existe (rode npm install antes)`)
  process.exit(0)
}

mkdirSync(DST, { recursive: true })

for (const f of REQUIRED) {
  const src = join(SRC, f)
  if (!existsSync(src)) {
    console.error(`[sync-face-models] ERRO: arquivo obrigatório faltando: ${src}`)
    process.exit(1)
  }
  cpSync(src, join(DST, f))
}

console.log(`[sync-face-models] OK — ${REQUIRED.length} modelos copiados pra ${DST}`)
