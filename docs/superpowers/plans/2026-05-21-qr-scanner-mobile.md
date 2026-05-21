# Scanner QR Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o operador escaneie QR codes (incluindo os 57 já impressos com URL localhost) dentro do app `/m`, extrair só o ID do equipamento e navegar in-app.

**Architecture:** Botão "📷 Escanear QR" em `/m` abre rota nova `/m/scan` com câmera fullscreen (html5-qrcode lib lazy-loaded). Função pura `extractEquipamentoId` extrai o ID via regex de qualquer URL/string e navega via React Router. Treinamento de operadores necessário (cartaz + reunião).

**Tech Stack:** React 19, TypeScript, `html5-qrcode ^2.3.x` (lazy import), `react-router-dom` v7, vitest.

**Spec:** [`docs/superpowers/specs/2026-05-21-qr-scanner-mobile-design.md`](../specs/2026-05-21-qr-scanner-mobile-design.md)

---

## File Structure

**Novos:**
- `src/utils/parseFreteQrUrl.ts` (~25 LOC) — função pura `extractEquipamentoId(text): string | null`
- `src/utils/parseFreteQrUrl.test.ts` — 6 testes vitest cobrindo todos os casos do spec
- `src/pages/mobile/MScanPage.tsx` (~150 LOC) — página fullscreen com câmera + decoder

**Modificados:**
- `src/pages/mobile/MEquipamentosPage.tsx` — botão "📷 Escanear QR" no topo
- `src/App.tsx` — rota `/m/scan` lazy
- `package.json` — `html5-qrcode` dependência

---

## Task 1: Instalar `html5-qrcode`

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: npm install**

Run from `/Users/tiagocameli/projects/Gestao_Obras`:
```bash
npm install html5-qrcode
```

Expected: dependência adicionada, sem erros. Versão ~2.3.8 (latest 2026-05).

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built` sem erros novos. (Warning de chunk size é pré-existente.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instalar html5-qrcode pra scanner mobile

Setup pra implementação do QR scanner in-app (spec
docs/superpowers/specs/2026-05-21-qr-scanner-mobile-design.md)."
```

---

## Task 2: Helper puro `extractEquipamentoId` + testes TDD

**Files:**
- Create: `src/utils/parseFreteQrUrl.ts`
- Test: `src/utils/parseFreteQrUrl.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/parseFreteQrUrl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { extractEquipamentoId } from './parseFreteQrUrl'

describe('extractEquipamentoId', () => {
  it('extrai ID de URL com host localhost (etiquetas físicas existentes)', () => {
    expect(extractEquipamentoId('http://localhost:5175/m/eq/eh-001')).toBe('eh-001')
    expect(extractEquipamentoId('http://localhost:5175/m/eq/moul02cymgzg1')).toBe('moul02cymgzg1')
  })

  it('extrai ID de URL com host de produção', () => {
    expect(extractEquipamentoId('https://emtconstrutora.com/m/eq/eh-001')).toBe('eh-001')
  })

  it('extrai ID de path relativo', () => {
    expect(extractEquipamentoId('/m/eq/eh-001')).toBe('eh-001')
  })

  it('extrai ID quando o texto é apenas o ID puro (fallback)', () => {
    expect(extractEquipamentoId('eh-001')).toBe('eh-001')
    expect(extractEquipamentoId('moul02cymgzg1')).toBe('moul02cymgzg1')
  })

  it('extrai ID de URL com query string', () => {
    expect(extractEquipamentoId('https://emtconstrutora.com/m/eq/eh-001?ref=qr')).toBe('eh-001')
  })

  it('rejeita strings que não casam (vCard, URL externa, lixo, ID curto)', () => {
    expect(extractEquipamentoId('BEGIN:VCARD\nN:Tiago\nEND:VCARD')).toBe(null)
    expect(extractEquipamentoId('https://google.com')).toBe(null)
    expect(extractEquipamentoId('00020126...pix...')).toBe(null)
    expect(extractEquipamentoId('/m/eq/ab')).toBe(null) // ID < 4 chars
    expect(extractEquipamentoId('')).toBe(null)
    expect(extractEquipamentoId('x'.repeat(600))).toBe(null) // sanity cap
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/utils/parseFreteQrUrl.test.ts`
Expected: FAIL — `Cannot find module './parseFreteQrUrl'`.

- [ ] **Step 3: Implement helper**

Create `src/utils/parseFreteQrUrl.ts`:

```typescript
/**
 * Extrai o ID do equipamento de uma string lida de QR code.
 *
 * Aceita 5 formatos comuns (URL completa com qualquer host, path relativo,
 * ID puro). Rejeita lixo (vCard, URL aleatória, string vazia, ID < 4 chars,
 * input > 500 chars).
 *
 * Spec: docs/superpowers/specs/2026-05-21-qr-scanner-mobile-design.md
 */

const PATH_REGEX = /\/m\/eq\/([a-z0-9-]{4,32})(?:[/?#]|$)/i
const ID_ONLY_REGEX = /^[a-z0-9-]{4,32}$/i

export function extractEquipamentoId(text: string): string | null {
  if (!text || text.length > 500) return null
  const trimmed = text.trim()
  const match = trimmed.match(PATH_REGEX)
  if (match) return match[1]
  if (ID_ONLY_REGEX.test(trimmed)) return trimmed
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/utils/parseFreteQrUrl.test.ts`
Expected: `Tests  6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseFreteQrUrl.ts src/utils/parseFreteQrUrl.test.ts
git commit -m "feat(qr): helper puro extractEquipamentoId com testes

Função pura que extrai ID do equipamento de uma string lida de QR
code. Aceita 5 formatos (URL com qualquer host, path relativo, ID
puro). 6 testes vitest cobrindo casos do spec.

Preparação pra MScanPage (Task 3)."
```

---

## Task 3: `MScanPage` — página de scanner

**Files:**
- Create: `src/pages/mobile/MScanPage.tsx`

> **Sem unit test:** página integra câmera real + library externa — testes unitários frágeis. Cobertura virá via manual em iPhone + Android (Task 5).

- [ ] **Step 1: Criar arquivo**

Create `src/pages/mobile/MScanPage.tsx`:

```tsx
// Scanner de QR mobile in-app.
// Resolve as 57 etiquetas físicas com URL localhost (bug pre-fix 10253b3) —
// scanner extrai o ID do equipamento via regex e navega in-app, ignorando o
// host do QR. Operador deve abrir o app primeiro (não câmera nativa).
//
// Spec: docs/superpowers/specs/2026-05-21-qr-scanner-mobile-design.md

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Html5Qrcode, type CameraDevice } from 'html5-qrcode'
import { ArrowLeft, Flashlight, FlashlightOff, RefreshCw, Camera } from 'lucide-react'
import { extractEquipamentoId } from '../../utils/parseFreteQrUrl'
import { useToast } from '../../components/ui/Toast'

const READER_ELEMENT_ID = 'qr-scanner-reader'

type ScanStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'error'

export default function MScanPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
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

      // Default: traseira (procura por label contendo "back" ou "rear"; fallback pra primeira)
      const targetId =
        deviceId ??
        (devices.find((d) => /back|rear|environment/i.test(d.label))?.id || devices[0].id)
      const targetIdx = devices.findIndex((d) => d.id === targetId)
      if (targetIdx >= 0) setCameraIdx(targetIdx)

      // Inicia decoder
      const scanner = new Html5Qrcode(READER_ELEMENT_ID, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        targetId,
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
        <Link to="/m" className="inline-flex items-center gap-2 text-sm" aria-label="Voltar">
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
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc -b 2>&1 | tail -10`
Expected: zero errors.

> Se reclamar de `applyVideoConstraints` ou `getRunningTrackSettings`, verificar versão de html5-qrcode no `package.json` (deve ser ^2.3.x).

- [ ] **Step 3: Verificar build**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/mobile/MScanPage.tsx
git commit -m "feat(qr): MScanPage com câmera + html5-qrcode

Página fullscreen /m/scan com decoder de QR. Estados:
starting/ready/denied/error. Controles: lanterna (se suportado),
trocar câmera (se houver mais de uma). Ao detectar QR válido,
vibra 100ms e navega pra /m/eq/<id> via React Router.

Spec: docs/superpowers/specs/2026-05-21-qr-scanner-mobile-design.md"
```

---

## Task 4: Botão em `MEquipamentosPage` + rota lazy em `App.tsx`

**Files:**
- Modify: `src/pages/mobile/MEquipamentosPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Adicionar import e botão em `MEquipamentosPage`**

Modify `src/pages/mobile/MEquipamentosPage.tsx`.

Atualizar imports (linha ~4-6):
```tsx
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ClipboardCheck, ChevronRight, Wrench, QrCode } from 'lucide-react';
```

Adicionar botão imediatamente após o `<div>` do título (depois do `</div>` da linha ~37, antes do `<div className="relative">` do search):

```tsx
      <Link
        to="/m/scan"
        className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] font-semibold text-base shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
      >
        <QrCode className="w-5 h-5" />
        Escanear QR do equipamento
      </Link>
```

- [ ] **Step 2: Adicionar rota lazy em `App.tsx`**

Modify `src/App.tsx`.

No topo, adicionar `lazy` ao import de React:
```tsx
import { lazy, Suspense } from 'react';
```
(Adicionar `lazy, Suspense` aos imports existentes do react. Se já tiver outros, juntar na mesma linha.)

Logo após os imports das outras páginas mobile (~linha 30), adicionar:

```tsx
const MScanPage = lazy(() => import('./pages/mobile/MScanPage'));
```

E no bloco das rotas mobile (~linha 150), DEPOIS de `<Route path="/m" .../>` e ANTES de `<Route path="/m/eq/:equipamentoId" .../>`, adicionar:

```tsx
              <Route
                path="/m/scan"
                element={
                  <Suspense fallback={<div className="p-8 text-center text-[var(--color-fg-muted)]">Carregando scanner…</div>}>
                    <MScanPage />
                  </Suspense>
                }
              />
```

- [ ] **Step 3: Verify TypeScript + build**

Run: `npx tsc -b 2>&1 | tail -5`
Expected: zero errors.

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built`. Note que vai aparecer um chunk novo `MScanPage-*.js` separado por causa do lazy import.

- [ ] **Step 4: Commit**

```bash
git add src/pages/mobile/MEquipamentosPage.tsx src/App.tsx
git commit -m "feat(qr): botão Escanear QR em /m + rota /m/scan lazy

Botão verde grande no topo da home mobile (acima da busca). Rota
/m/scan é lazy-loaded via React.lazy + Suspense pra não inflar o
bundle inicial — html5-qrcode (50KB) só carrega quando o operador
toca em Escanear."
```

---

## Task 5: Build + security review + deploy + push

**Files:** none (operacional)

- [ ] **Step 1: Build + todos os testes passam**

```bash
npm run build 2>&1 | tail -5    # ✓ built
npm test 2>&1 | tail -10        # Tests N passed (deve incluir os 6 novos de parseFreteQrUrl)
```

- [ ] **Step 2: Rodar `/security-review`**

No Claude Code:
```
/security-review
```

Expected: `NO_FINDINGS`. Justificativa:
- Câmera é client-side, dado não sai do dispositivo
- `extractEquipamentoId` valida via regex estrita + cap 500 chars
- Navegação é interna (React Router), nunca `window.location.href = ...` com input não-confiável
- Nenhuma mudança em policy/RPC/storage

Se houver findings: corrigir antes de seguir.

- [ ] **Step 3: Preview deploy**

```bash
npx --yes vercel deploy 2>&1 | tail -5
```
Expected: URL `Preview: https://gestao-obras-xxx.vercel.app`.

- [ ] **Step 4: Validação manual em dispositivos reais**

Pedir ao usuário pra testar. Roteiro:

**iPhone (Safari, iOS 15+):**
1. Abrir URL do preview
2. Logar normalmente
3. Navegar pra `/m`
4. Tocar em "📷 Escanear QR do equipamento"
5. Browser pede permissão de câmera → permitir
6. Câmera deve abrir mostrando preview ao vivo
7. Apontar pra UMA das 57 etiquetas físicas
8. Esperado: ~1s depois, vibração (iOS pode não vibrar, ok) + navegação pra `/m/eq/<id>`
9. Testar QR inválido (foto de outro QR aleatório) → toast vermelho, scanner continua
10. Testar botão "Trocar câmera" — deve alternar pra frontal e voltar

**Android (Chrome):**
- Mesmo roteiro
- Adicional: testar botão "Lanterna" (deve ligar/desligar o flash)

- [ ] **Step 5: Promover prod (com confirmação do usuário)**

Pedir confirmação. Se aprovado:
```bash
npx --yes vercel --prod 2>&1 | tail -5
```

- [ ] **Step 6: Push pro GitHub**

```bash
git push origin main 2>&1 | tail -3
```

> Note: estamos commitando direto em `main` (branch atual) porque é uma feature pequena e isolada. Se quiser feature branch, fazer antes do Task 1.

---

## Critérios de aceitação

- ✅ `npm test` passa com 6+ novos testes de `extractEquipamentoId`
- ✅ `npm run build` passa
- ✅ Manual iPhone Safari: scanner abre, lê QR localhost antigo, navega pra equipamento
- ✅ Manual Android Chrome: idem + lanterna funciona
- ✅ QR inválido (vCard, URL aleatória) → toast vermelho, scanner continua sem navegar
- ✅ Permissão negada → mensagem clara + botão "Tentar novamente"
- ✅ `/security-review` retorna `NO_FINDINGS`
- ✅ Deploy preview e prod sem regressão em outras rotas

## Pós-implementação (fora deste plano)

- **Treinamento dos operadores:** cartaz visual no canteiro de obra + reunião de 15min com cada equipe
  - "Abra o app EMT no celular"
  - "Toque em 📷 Escanear QR (botão verde no topo)"
  - "Aponte pra etiqueta"
- **Long-term:** considerar substituir etiquetas físicas eventualmente (escopo separado), mas com o scanner in-app não é urgente

## Out of scope (não vou fazer)

- ❌ Decoder própria sem html5-qrcode
- ❌ Auto-correção de URLs além do regex `/m/eq/<id>`
- ❌ Scan de QR pra outros recursos (fornecedor, obra, frete)
- ❌ Histórico de QR scaneados
- ❌ Substituir etiquetas físicas
- ❌ E2E Playwright pro scanner (câmera headless é inviável)
