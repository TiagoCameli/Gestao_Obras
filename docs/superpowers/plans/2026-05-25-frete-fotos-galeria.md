# Galeria de Fotos do Frete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar UX de fotos do Frete — thumbnails rápidas (Supabase transform), lightbox in-app com download, drawer sem delete, edit com 1 área única de fotos.

**Architecture:** Novo componente compartilhado `FotoFreteGaleria` (grid+lightbox+download+delete opcional) + hook `useFreteThumbnails` (cache via React Query). `FreteFotoChegadaBlock` usa o novo componente; `AnexosUploader` ganha um sub-export `UploadFotosButtons` pra desacoplar botões do display. `FreteForm` unifica os dois blocos de fotos em 1 (limite 8, 1ª = principal).

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Query v5, Supabase Storage (com image transform — plano Pro confirmado), Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-24-frete-fotos-galeria-design.md`

---

## File Structure

**Novos:**
- `src/utils/signedUrl.ts` — helpers `pathFromSignedUrl`, `fileNameFromUrl`, `downloadSignedUrl`
- `src/utils/signedUrl.test.ts` — unit tests dos helpers
- `src/hooks/useFreteThumbnails.ts` — hook que mintra URLs com transform
- `src/components/frete/FotoFreteGaleria.tsx` — grid + lightbox + download + delete opcional

**Modificados:**
- `src/components/combustivel/AnexosUploader.tsx` — extrai `UploadFotosButtons` como named export (mantém default export funcional)
- `src/components/frete/FreteFotoChegadaBlock.tsx` — usa `UploadFotosButtons` + `FotoFreteGaleria` no lugar do AnexosUploader inline
- `src/components/frete/FreteDetalhesDrawer.tsx` — remove o bloco genérico de fotos extras (`frete.fotoUrls`) que duplica com FreteFotoChegadaBlock; importa `fileNameFromUrl` do novo util
- `src/components/frete/FreteForm.tsx` — combina 2 blocos de fotos em 1 (chegada + extras), mantém bloco separado pra arquivos

---

## Task 1: Util `signedUrl.ts`

**Files:**
- Create: `src/utils/signedUrl.ts`
- Test: `src/utils/signedUrl.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/utils/signedUrl.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pathFromSignedUrl, fileNameFromUrl, downloadSignedUrl } from './signedUrl'

describe('pathFromSignedUrl', () => {
  it('extrai path de URL assinada padrão Supabase', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/frete-chegada/123/1700000000-foto.jpg?token=xyz'
    expect(pathFromSignedUrl(url)).toBe('frete-chegada/123/1700000000-foto.jpg')
  })

  it('decoda %20 e outros caracteres', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/bucket/pasta/foto%20com%20espa%C3%A7o.jpg?token=xyz'
    expect(pathFromSignedUrl(url)).toBe('pasta/foto com espaço.jpg')
  })

  it('retorna null pra URL não-assinada', () => {
    expect(pathFromSignedUrl('https://example.com/foo.jpg')).toBeNull()
    expect(pathFromSignedUrl('')).toBeNull()
  })
})

describe('fileNameFromUrl', () => {
  it('retorna último segmento sem prefixo timestamp', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/bucket/pasta/1700000000-foto.jpg?token=xyz'
    expect(fileNameFromUrl(url)).toBe('foto.jpg')
  })

  it('mantém URL completa quando não é assinada', () => {
    expect(fileNameFromUrl('https://example.com/foo.jpg')).toBe('https://example.com/foo.jpg')
  })

  it('lida com path sem prefixo timestamp', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/bucket/pasta/foto.jpg?token=xyz'
    expect(fileNameFromUrl(url)).toBe('foto.jpg')
  })
})

describe('downloadSignedUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
    } as unknown as Response)))
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('faz fetch, cria blob URL e aciona click no anchor', async () => {
    const clickSpy = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      ;(node as HTMLAnchorElement).click = clickSpy
      return node
    })
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

    await downloadSignedUrl('https://x.com/foto.jpg', 'minha.jpg')

    expect(fetch).toHaveBeenCalledWith('https://x.com/foto.jpg')
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
  })

  it('fallback abre nova aba quando fetch falha', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('net'))))
    const openSpy = vi.fn()
    vi.stubGlobal('window', { open: openSpy } as unknown as Window)

    await downloadSignedUrl('https://x.com/foto.jpg', 'minha.jpg')

    expect(openSpy).toHaveBeenCalledWith('https://x.com/foto.jpg', '_blank', 'noopener,noreferrer')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/utils/signedUrl.test.ts`
Expected: FAIL com "Cannot find module './signedUrl'"

- [ ] **Step 3: Implement util**

```ts
// src/utils/signedUrl.ts
/**
 * Helpers pra lidar com URLs assinadas do Supabase Storage.
 * Centraliza lógica que estava duplicada em AnexosUploader e FreteDetalhesDrawer.
 */

const SIGNED_URL_PATH_RE = /\/object\/sign\/[^/]+\/([^?]+)/
const TIMESTAMP_PREFIX_RE = /^\d+-/

export function pathFromSignedUrl(url: string): string | null {
  if (!url) return null
  const m = url.match(SIGNED_URL_PATH_RE)
  return m ? decodeURIComponent(m[1]) : null
}

export function fileNameFromUrl(url: string): string {
  const path = pathFromSignedUrl(url)
  if (!path) return url
  const last = path.split('/').pop() || path
  return last.replace(TIMESTAMP_PREFIX_RE, '')
}

export async function downloadSignedUrl(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objUrl)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/utils/signedUrl.test.ts`
Expected: PASS (3 describe blocks, 7-8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/signedUrl.ts src/utils/signedUrl.test.ts
git commit -m "feat(utils): add signedUrl helpers (pathFromSignedUrl, fileNameFromUrl, downloadSignedUrl)"
```

---

## Task 2: Hook `useFreteThumbnails.ts`

**Files:**
- Create: `src/hooks/useFreteThumbnails.ts`

Sem teste unitário — depende fortemente de Supabase Storage mock e o valor de testar é baixo (a lógica é trivial; o que importa é o comportamento real de transform). Validação manual no Task 7.

- [ ] **Step 1: Implementar hook**

```ts
// src/hooks/useFreteThumbnails.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { pathFromSignedUrl } from '../utils/signedUrl'

const BUCKET = 'abastecimento-fotos'
const THUMB_TTL_SECS = 60 * 60
const THUMB_SIZE = 400
const THUMB_QUALITY = 75

async function mintThumbnail(url: string): Promise<string> {
  const path = pathFromSignedUrl(url)
  if (!path) return url
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, THUMB_TTL_SECS, {
      transform: { width: THUMB_SIZE, height: THUMB_SIZE, resize: 'cover', quality: THUMB_QUALITY },
    })
  if (error || !data?.signedUrl) return url
  return data.signedUrl
}

/**
 * Mintra URLs assinadas com transform (400x400, q75) pras fotos do frete.
 * Cache 30min (URLs assinadas duram 1h, então re-mint antes de expirar).
 * Fallback pra URL original se transform falhar (graciosa degradação).
 */
export function useFreteThumbnails(urls: string[]) {
  return useQuery({
    queryKey: ['frete-thumbnails', ...urls],
    queryFn: () => Promise.all(urls.map(mintThumbnail)),
    staleTime: 1000 * 60 * 30,
    enabled: urls.length > 0,
  })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `useFreteThumbnails.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFreteThumbnails.ts
git commit -m "feat(frete): add useFreteThumbnails hook (Supabase image transform)"
```

---

## Task 3: Componente `FotoFreteGaleria.tsx`

**Files:**
- Create: `src/components/frete/FotoFreteGaleria.tsx`

Componente UI puro — testes manuais. Estrutura segue padrão do `FotosEquipamentoGaleria.tsx`.

- [ ] **Step 1: Implementar componente**

```tsx
// src/components/frete/FotoFreteGaleria.tsx
// Galeria de fotos do frete: grid com thumbnail + lightbox in-app + download por foto.
// Delete opcional (só edit mode). Suporta navegação por teclado (Esc, ←, →).

import { useEffect, useState } from 'react'
import { Trash2, Download, X, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import { useFreteThumbnails } from '../../hooks/useFreteThumbnails'
import { downloadSignedUrl, fileNameFromUrl } from '../../utils/signedUrl'

interface Props {
  fotoUrls: string[]
  canDelete: boolean
  canDownload: boolean
  onDelete?: (index: number) => void
  /** Marca a 1ª foto como "Principal". Default true. */
  showPrincipalBadge?: boolean
  /** Variante de tamanho do grid. Default 'normal'. */
  size?: 'normal' | 'compact'
}

export default function FotoFreteGaleria({
  fotoUrls,
  canDelete,
  canDownload,
  onDelete,
  showPrincipalBadge = true,
  size = 'normal',
}: Props) {
  const [indiceAmpliada, setIndiceAmpliada] = useState<number | null>(null)
  const { data: thumbs } = useFreteThumbnails(fotoUrls)

  useEffect(() => {
    if (indiceAmpliada === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIndiceAmpliada(null)
      else if (e.key === 'ArrowLeft') setIndiceAmpliada((i) => ((i ?? 0) - 1 + fotoUrls.length) % fotoUrls.length)
      else if (e.key === 'ArrowRight') setIndiceAmpliada((i) => ((i ?? 0) + 1) % fotoUrls.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [indiceAmpliada, fotoUrls.length])

  if (fotoUrls.length === 0) {
    return (
      <div className="aspect-video rounded-lg border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center px-4">
        <ImageOff className="w-8 h-8 text-[var(--color-fg-muted)] mb-2" />
        <p className="text-sm text-[var(--color-fg-muted)]">Sem fotos registradas.</p>
      </div>
    )
  }

  const gridClass = size === 'compact'
    ? 'grid grid-cols-4 sm:grid-cols-6 gap-1.5'
    : 'grid grid-cols-3 sm:grid-cols-4 gap-2'

  return (
    <>
      <div className={gridClass}>
        {fotoUrls.map((url, i) => {
          const thumb = thumbs?.[i] ?? url
          return (
            <div
              key={`${url}-${i}`}
              className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] group"
            >
              <button
                type="button"
                onClick={() => setIndiceAmpliada(i)}
                className="block w-full h-full"
                aria-label={`Foto ${i + 1} de ${fotoUrls.length} (ampliar)`}
              >
                <img
                  src={thumb}
                  alt={`Foto ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </button>

              {i === 0 && showPrincipalBadge && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wide bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] rounded-full font-bold pointer-events-none">
                  Principal
                </span>
              )}

              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canDownload && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadSignedUrl(url, fileNameFromUrl(url))
                    }}
                    aria-label={`Baixar foto ${i + 1}`}
                    className="w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center"
                  >
                    <Download aria-hidden className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDelete && onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(i)
                    }}
                    aria-label={`Remover foto ${i + 1}`}
                    className="w-7 h-7 rounded-full bg-black/60 text-white hover:bg-[var(--color-danger)] flex items-center justify-center"
                  >
                    <Trash2 aria-hidden className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {indiceAmpliada !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIndiceAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${indiceAmpliada + 1} ampliada`}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIndiceAmpliada(null) }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X aria-hidden className="w-5 h-5" />
          </button>

          {canDownload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const url = fotoUrls[indiceAmpliada]
                downloadSignedUrl(url, fileNameFromUrl(url))
              }}
              className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 text-sm font-medium"
            >
              <Download aria-hidden className="w-4 h-4" />
              Baixar
            </button>
          )}

          {fotoUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndiceAmpliada(((indiceAmpliada ?? 0) - 1 + fotoUrls.length) % fotoUrls.length)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
                aria-label="Foto anterior"
              >
                <ChevronLeft aria-hidden className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndiceAmpliada(((indiceAmpliada ?? 0) + 1) % fotoUrls.length)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
                aria-label="Próxima foto"
              >
                <ChevronRight aria-hidden className="w-5 h-5" />
              </button>
            </>
          )}

          <img
            src={fotoUrls[indiceAmpliada]}
            alt={`Foto ${indiceAmpliada + 1} ampliada`}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {fotoUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 text-white text-xs">
              {indiceAmpliada + 1} de {fotoUrls.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `FotoFreteGaleria.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/frete/FotoFreteGaleria.tsx
git commit -m "feat(frete): add FotoFreteGaleria with thumbnails, in-app lightbox, download"
```

---

## Task 4: Extrair `UploadFotosButtons` em `AnexosUploader.tsx`

Objetivo: expor um sub-componente que renderiza só os botões "Tirar foto" / "Da galeria" + handler de upload, sem o grid de display. O componente default `AnexosUploader` continua igual pra quem usa hoje.

**Files:**
- Modify: `src/components/combustivel/AnexosUploader.tsx`

- [ ] **Step 1: Mover handler de upload pra hook reutilizável**

No topo do arquivo, depois dos helpers, antes do `interface Props`, adicione:

```tsx
// ────────────────────────────────────────────────────────────────────
// Hook reutilizável: upload de fotos pra Supabase (com stamp opcional)
// ────────────────────────────────────────────────────────────────────

interface UseUploadFotosOpts {
  fotoUrls: string[]
  onChange: (urls: string[]) => void
  pastaId: string
}

export function useUploadFotos({ fotoUrls, onChange, pastaId }: UseUploadFotosOpts) {
  const [erros, setErros] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [stamping, setStamping] = useState(false)

  useEffect(() => {
    if (erros.length === 0) return
    const t = setTimeout(() => setErros([]), 6000)
    return () => clearTimeout(t)
  }, [erros])

  async function handleFotos(files: FileList | File[], fromCamera: boolean) {
    const arr = Array.from(files)
    const novosErros: string[] = []
    const validos: File[] = []
    const espacoLivre = QTD_MAX_FOTOS - fotoUrls.length
    if (arr.length > espacoLivre) {
      novosErros.push(`Limite de ${QTD_MAX_FOTOS} fotos. Tentou adicionar ${arr.length}, restam ${espacoLivre}.`)
    }
    for (const f of arr.slice(0, espacoLivre)) {
      if (!MIME_FOTOS.includes(f.type)) {
        novosErros.push(`${f.name}: tipo "${f.type || 'desconhecido'}" não é foto válida (use JPEG/PNG/WebP)`)
        continue
      }
      if (f.size > TAMANHO_MAX_BYTES) {
        novosErros.push(`${f.name}: ${formatarBytes(f.size)} excede limite 10 MB`)
        continue
      }
      validos.push(f)
    }
    setErros(novosErros)
    if (validos.length === 0) return

    let toUpload: File[] = validos
    if (fromCamera) {
      setStamping(true)
      try {
        const geo = await getGeoOrNull()
        const now = new Date()
        toUpload = await Promise.all(validos.map((f) => stampImage(f, geo, now)))
      } finally {
        setStamping(false)
      }
    }

    setUploading(true)
    try {
      const novasUrls: string[] = []
      for (const file of toUpload) {
        const ts = Date.now()
        const path = `${pastaId}/${ts}-${sanitizeNome(file.name)}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
        if (upErr) {
          setErros((p) => [...p, `Falha no upload de ${file.name}: ${upErr.message}`])
          continue
        }
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECS)
        if (signErr) {
          setErros((p) => [...p, `Falha ao assinar URL: ${signErr.message}`])
          continue
        }
        novasUrls.push(signed.signedUrl)
      }
      if (novasUrls.length > 0) onChange([...fotoUrls, ...novasUrls])
    } finally {
      setUploading(false)
    }
  }

  return { handleFotos, erros, uploading, stamping }
}
```

- [ ] **Step 2: Adicionar `UploadFotosButtons` exportado**

Depois do hook `useUploadFotos`, adicione:

```tsx
interface UploadFotosButtonsProps {
  fotoUrls: string[]
  onChange: (urls: string[]) => void
  pastaId: string
  className?: string
}

/**
 * Sub-componente que renderiza só os botões "Tirar foto" + "Da galeria"
 * (sem o grid de display). Usado quando o display é responsabilidade de outro componente
 * (ex: FotoFreteGaleria com lightbox próprio).
 */
export function UploadFotosButtons({ fotoUrls, onChange, pastaId, className = '' }: UploadFotosButtonsProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const { handleFotos, erros, uploading, stamping } = useUploadFotos({ fotoUrls, onChange, pastaId })
  const isBusy = uploading || stamping
  const cheio = fotoUrls.length >= QTD_MAX_FOTOS

  return (
    <div className={'flex flex-col gap-2 ' + className}>
      {erros.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30">
          {erros.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-danger-fg)]">
              <AlertCircle aria-hidden className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFotos(e.target.files, true); e.target.value = '' }}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept={MIME_FOTOS.join(',')}
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFotos(e.target.files, false); e.target.value = '' }}
        />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={isBusy || cheio}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {(uploading || stamping) ? <Loader2 aria-hidden className="w-4 h-4 animate-spin" /> : <Camera aria-hidden className="w-4 h-4" />}
          {stamping ? 'Marcando local...' : uploading ? 'Enviando...' : 'Tirar foto'}
        </button>
        <button
          type="button"
          onClick={() => galeriaRef.current?.click()}
          disabled={isBusy || cheio}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ImagePlus aria-hidden className="w-4 h-4" />
          Da galeria
        </button>
        <span className="text-xs text-[var(--color-fg-muted)] tabular-nums ml-1">
          {fotoUrls.length}/{QTD_MAX_FOTOS}
        </span>
      </div>
      <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-fg-muted)] leading-tight">
        <MapPin aria-hidden className="w-3 h-3 shrink-0 mt-0.5" />
        <span>"Tirar foto" carimba data/hora e GPS no rodapé. Galeria preserva o original.</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Refatorar o componente default `AnexosUploader` pra usar o hook**

Substitua o corpo da função `AnexosUploader` (a parte que vai do `const [erros, setErros] = useState<string[]>([])` até o `async function handleFotos(...)`) por:

```tsx
  const [erros, setErros] = useState<string[]>([])
  const [uploading, setUploading] = useState<'fotos' | 'arquivos' | null>(null)
  const [stamping, setStamping] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (erros.length === 0) return
    const t = setTimeout(() => setErros([]), 6000)
    return () => clearTimeout(t)
  }, [erros])
```

Mantenha as funções `handleFotos`, `handleArquivos`, `removerFoto`, `removerArquivo` como estão (não muda nada na API pública do default export).

> **Importante:** o `useUploadFotos` é uma duplicação intencional pra desacoplar. Não tente reusar a lógica do default `AnexosUploader` dentro do hook — vai ficar circular. O default mantém sua própria cópia da lógica de upload.

- [ ] **Step 4: Verificar que compila e testes existentes passam**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: sem erros TypeScript; todos os testes que já passavam continuam passando.

- [ ] **Step 5: Verificação manual rápida — combustível ainda funciona**

Run: `npm run dev`
Abrir `/combustivel`, criar uma entrada, anexar foto via "Tirar foto" e "Da galeria", confirmar que upload acontece e foto aparece no grid com botão de delete. (Se já tem dados, basta editar uma saída existente.)

- [ ] **Step 6: Commit**

```bash
git add src/components/combustivel/AnexosUploader.tsx
git commit -m "refactor(uploader): extract UploadFotosButtons + useUploadFotos hook"
```

---

## Task 5: Atualizar `FreteFotoChegadaBlock.tsx`

**Files:**
- Modify: `src/components/frete/FreteFotoChegadaBlock.tsx`

- [ ] **Step 1: Reescrever componente usando o novo gallery + upload buttons**

Substitua o arquivo inteiro por:

```tsx
import { useMemo } from 'react'
import { PackageCheck } from 'lucide-react'
import type { Frete } from '../../types'
import { UploadFotosButtons } from '../combustivel/AnexosUploader'
import FotoFreteGaleria from './FotoFreteGaleria'
import { useAtualizarFrete } from '../../hooks/useFretes'
import { useToast } from '../ui/Toast'
import { calcularUpdateFotoChegada } from '../../utils/freteFotoChegada'

interface Props {
  frete: Frete
  canEdit: boolean
  /** Variante visual: 'card' (drawer) ou 'compact' (expand-row). */
  variant?: 'card' | 'compact'
}

function fmtData(iso: string): string {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}

/**
 * Bloco de exibição + upload das fotos de chegada do frete no drawer/row-expanded.
 * Display sempre usa FotoFreteGaleria (lightbox + download, sem delete).
 * Upload disponível quando canEdit=true.
 * Delete só no modo edição do FreteForm.
 */
export default function FreteFotoChegadaBlock({ frete, canEdit, variant = 'card' }: Props) {
  const atualizarMutation = useAtualizarFrete()
  const { showToast } = useToast()

  const fotosAtuais = useMemo<string[]>(() => {
    const all: string[] = []
    if (frete.fotoChegadaUrl) all.push(frete.fotoChegadaUrl)
    if (frete.fotoUrls) all.push(...frete.fotoUrls)
    return all
  }, [frete])

  const handleFotoChange = (novas: string[]) => {
    const novaUrl = novas[0] ?? null
    const extras = novas.slice(1)
    const hoje = new Date().toISOString().slice(0, 10)
    const payload = calcularUpdateFotoChegada({
      novaUrl,
      dataChegadaAtual: frete.dataChegada,
      hoje,
    })
    atualizarMutation.mutate(
      { ...frete, ...payload, fotoUrls: extras },
      {
        onSuccess: () => showToast({ kind: 'success', message: 'Fotos atualizadas.' }),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          showToast({ kind: 'error', message: `Falha ao salvar fotos: ${msg}` })
        },
      },
    )
  }

  const isCompact = variant === 'compact'
  const containerClass = isCompact
    ? 'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3'
    : 'rounded-xl border-2 border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4'

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 mb-3">
        <PackageCheck className={isCompact ? 'w-4 h-4 text-[var(--color-accent)]' : 'w-5 h-5 text-[var(--color-accent)]'} />
        <div className="flex-1">
          <h3 className={isCompact ? 'text-xs font-semibold text-[var(--color-fg)]' : 'text-sm font-semibold text-[var(--color-fg)]'}>
            Fotos da Chegada da Carga
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {fotosAtuais.length === 0
              ? 'Pendente — carga ainda não foi confirmada na chegada.'
              : `${fotosAtuais.length} foto(s)${frete.dataChegada ? ` · registrada em ${fmtData(frete.dataChegada)}` : ''}. A 1ª é a principal.`}
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="mb-3">
          <UploadFotosButtons
            fotoUrls={fotosAtuais}
            onChange={handleFotoChange}
            pastaId={`frete-chegada/${frete.id}`}
          />
        </div>
      )}

      <FotoFreteGaleria
        fotoUrls={fotosAtuais}
        canDelete={false}
        canDownload
        size={isCompact ? 'compact' : 'normal'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add src/components/frete/FreteFotoChegadaBlock.tsx
git commit -m "feat(frete): drawer uses FotoFreteGaleria + UploadFotosButtons (no delete, with download)"
```

---

## Task 6: Limpar bloco duplicado em `FreteDetalhesDrawer.tsx`

O drawer hoje tem um bloco extra que lista `frete.fotoUrls` separadamente (linhas ~313-333), duplicando o que `FreteFotoChegadaBlock` já mostra (combinado). Remover.

**Files:**
- Modify: `src/components/frete/FreteDetalhesDrawer.tsx`

- [ ] **Step 1: Remover bloco duplicado de fotos**

No arquivo, localize e **remova** o seguinte trecho (deve estar logo depois do bloco `{frete.observacoes && (...)}` e antes do bloco `{frete.arquivoUrls && ...}`):

```tsx
          {frete.fotoUrls && frete.fotoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Fotos ({frete.fotoUrls.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {frete.fotoUrls.map((url, i) => (
                  <a
                    key={url + i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
                  >
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 2: Substituir helper local `fileNameFromUrl` por import do util**

Localize, no topo do arquivo, a função:

```tsx
function fileNameFromUrl(url: string): string {
  const m = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
  if (!m) return url;
  const path = decodeURIComponent(m[1]);
  const last = path.split('/').pop() || path;
  return last.replace(/^\d+-/, '');
}
```

**Remova** essa função. No bloco de imports do topo do arquivo, adicione:

```tsx
import { fileNameFromUrl } from '../../utils/signedUrl'
```

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/components/frete/FreteDetalhesDrawer.tsx
git commit -m "refactor(frete): drawer drops duplicate photo block (already in FreteFotoChegadaBlock)"
```

---

## Task 7: Unificar fotos no `FreteForm.tsx`

**Files:**
- Modify: `src/components/frete/FreteForm.tsx`

- [ ] **Step 1: Substituir state combinado pra fotos**

Localize as duas declarações de state:

```tsx
  const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);
  const [fotoChegadaUrls, setFotoChegadaUrls] = useState<string[]>(
    initial?.fotoChegadaUrl ? [initial.fotoChegadaUrl] : []
  );
```

Substitua por:

```tsx
  // Fotos do frete unificadas: 1ª é a principal (vai pra fotoChegadaUrl no submit),
  // resto vai pra fotoUrls. Limite 8 (vem do AnexosUploader).
  const [fotosFrete, setFotosFrete] = useState<string[]>(() => {
    const all: string[] = []
    if (initial?.fotoChegadaUrl) all.push(initial.fotoChegadaUrl)
    if (initial?.fotoUrls) all.push(...initial.fotoUrls)
    return all
  });
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);
```

- [ ] **Step 2: Substituir handler `handleFotoChegadaChange`**

Localize a função `handleFotoChegadaChange` (em torno da linha 76):

```tsx
  function handleFotoChegadaChange(novas: string[]) {
    if (fotoChegadaUrls.length === 0 && novas.length > 0 && !dataChegada) {
      // ... auto-fill dataChegada
    }
    setFotoChegadaUrls(novas);
  }
```

Substitua por:

```tsx
  function handleFotosFreteChange(novas: string[]) {
    // Auto-fill dataChegada na 1ª foto se ainda vazio
    if (fotosFrete.length === 0 && novas.length > 0 && !dataChegada) {
      setDataChegada(new Date().toISOString().slice(0, 10));
    }
    setFotosFrete(novas);
  }
```

- [ ] **Step 3: Atualizar payload do submit**

Localize o objeto do payload do submit (em torno da linha 260-265):

```tsx
      fotoUrls,
      arquivoUrls,
      fotoChegadaUrl: fotoChegadaUrls[0] ?? null,
```

Substitua por:

```tsx
      fotoChegadaUrl: fotosFrete[0] ?? null,
      fotoUrls: fotosFrete.slice(1),
      arquivoUrls,
```

- [ ] **Step 4: Substituir o bloco JSX dos uploaders**

Localize o trecho que vai de `{/* FF.3 — Foto da Chegada (slot dedicado destacado)... */}` (linha ~560) até depois do segundo `<AnexosUploader ... pastaId={`frete/${initial?.id ?? 'novo'}`} />` (linha ~589).

Substitua todo esse trecho por:

```tsx
      {/* Bloco único de fotos: 1ª = foto principal de chegada; demais vão pra fotoUrls.
          Limite 8 (controlado pelo AnexosUploader). */}
      <div className="rounded-lg border-2 border-dashed border-emt-verde/40 bg-emt-verde/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emt-verde/20 text-emt-verde text-xs font-bold">📦</span>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Fotos da Chegada da Carga</h3>
            <p className="text-xs text-gray-500">Até 8 fotos. A 1ª é a principal (registra GPS + horário da chegada).</p>
          </div>
        </div>
        <AnexosUploader
          fotoUrls={fotosFrete}
          arquivoUrls={[]}
          onChangeFotos={handleFotosFreteChange}
          onChangeArquivos={() => {}}
          pastaId={`frete-chegada/${initial?.id ?? 'novo'}`}
          hideArquivos
        />
      </div>

      {/* Arquivos do frete (NF, comprovantes, planilhas) — separado das fotos. */}
      <AnexosUploader
        fotoUrls={[]}
        arquivoUrls={arquivoUrls}
        onChangeFotos={() => {}}
        onChangeArquivos={setArquivoUrls}
        pastaId={`frete/${initial?.id ?? 'novo'}`}
        hideFotos
      />
```

- [ ] **Step 5: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros (especialmente nenhuma referência sobrando a `fotoChegadaUrls`, `setFotoChegadaUrls`, `setFotoUrls`, `handleFotoChegadaChange`, ou `fotoUrls` como state local)

Se aparecerem erros, busque cada nome antigo no arquivo e remova/renomeie:

```bash
grep -n "fotoChegadaUrls\|setFotoChegadaUrls\|handleFotoChegadaChange\|setFotoUrls" src/components/frete/FreteForm.tsx
```

Cada hit precisa ser eliminado (ou — no caso de `fotoUrls` puro — verificar se é o campo do payload, que deve continuar).

- [ ] **Step 6: Testes existentes do helper passam**

Run: `npm test -- src/utils/freteFotoChegada.test.ts`
Expected: PASS (testes não foram afetados)

- [ ] **Step 7: Commit**

```bash
git add src/components/frete/FreteForm.tsx
git commit -m "feat(frete): unify photo upload in edit (single block, 8-photo limit, first = principal)"
```

---

## Task 8: Verificação manual end-to-end

**Files:** nenhum

- [ ] **Step 1: Iniciar dev server**

Run: `npm run dev`
Abrir o app no browser.

- [ ] **Step 2: Verificar drawer — foto existente**

- Abrir um frete que já tem fotos
- Confirmar que as thumbs carregam **rápido** (network tab: tamanhos ~30KB, não MB)
- Clicar numa foto → lightbox abre **dentro do app** (não nova aba)
- Lightbox: teclas Esc/←/→ funcionam, click fora fecha, contador "X de Y" aparece
- Hover na thumb → botão **Download** aparece; clicar baixa o arquivo com nome correto (`foto.jpg`, sem prefixo timestamp)
- Lightbox também tem botão "Baixar" no canto superior esquerdo
- **Não há** botão de delete em nenhuma thumb nem no lightbox

- [ ] **Step 3: Verificar drawer — upload**

- Clicar em "Tirar foto" ou "Da galeria" no drawer
- Subir uma foto
- Confirmar que aparece no grid e que o `dataChegada` foi auto-preenchido (se estava vazio)
- Toast "Fotos atualizadas." aparece

- [ ] **Step 4: Verificar modo edição**

- Clicar em "Editar" no drawer
- Confirmar que existe **apenas uma** área de fotos: "Fotos da Chegada da Carga"
- Existem todas as fotos (a principal + as extras combinadas em 1 lista)
- Existe a área **separada** "Arquivos" abaixo (só PDF/Excel/Word, sem aba de fotos)
- Adicionar uma 9ª foto → bloqueada (botões disabled com "8/8")
- Remover a 1ª foto → 2ª vira automaticamente principal (no próximo open do drawer mostra ela com badge "Principal")
- Salvar → toast sucesso, drawer mostra as mesmas fotos

- [ ] **Step 5: Verificar combustível ainda funciona (regressão)**

- Ir em Combustível → Saídas → editar uma saída
- Verificar que `AnexosUploader` original ainda funciona: botões Tirar foto / Da galeria + grid com **delete**
- Subir e deletar uma foto pra confirmar

- [ ] **Step 6: Rodar lint + testes + build**

Run: `npm run lint && npm test -- --run && npm run build`
Expected: tudo passa sem warnings novos

- [ ] **Step 7: Commit final (se algum ajuste de lint surgir)**

Caso o build aponte algum problema, corrigir e commitar:

```bash
git add -A
git commit -m "chore(frete): fix lint/build after photo gallery refactor"
```

Caso tudo passe limpo no Step 6, nenhum commit extra é necessário.

---

## Resumo de commits esperados

1. `feat(utils): add signedUrl helpers ...`
2. `feat(frete): add useFreteThumbnails hook ...`
3. `feat(frete): add FotoFreteGaleria with thumbnails, in-app lightbox, download`
4. `refactor(uploader): extract UploadFotosButtons + useUploadFotos hook`
5. `feat(frete): drawer uses FotoFreteGaleria + UploadFotosButtons ...`
6. `refactor(frete): drawer drops duplicate photo block ...`
7. `feat(frete): unify photo upload in edit ...`
8. (Opcional) `chore(frete): fix lint/build ...`
