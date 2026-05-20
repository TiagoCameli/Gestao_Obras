# Fase A — Foto da Chegada inline no Drawer (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário tire/anexe a foto da chegada de um frete diretamente do drawer de detalhes, sem precisar entrar no modo de edição.

**Architecture:** Substituir o estado vazio do bloco "Foto da Chegada" em `FreteDetalhesDrawer` por um `AnexosUploader` inline (mesmo componente que o `FreteForm` já usa). O `onChangeFotos` chama `useAtualizarFrete` via um helper puro que decide quando auto-preencher `dataChegada`. Sem novos componentes React, sem novas tabelas, sem nova policy de banco.

**Tech Stack:** React 19, TypeScript, `AnexosUploader` (existente), `useAtualizarFrete` (existente), vitest, @playwright/test, Supabase Storage (bucket `abastecimento-fotos`).

**Spec:** [`docs/superpowers/specs/2026-05-20-frete-tab-redesign-design.md`](../specs/2026-05-20-frete-tab-redesign-design.md) seção "Fase A — Arquitetura".

---

## File Structure

- **Create:** `src/utils/freteFotoChegada.ts` — helper puro `calcularUpdateFotoChegada()` que decide se `dataChegada` deve ser auto-preenchida
- **Create:** `src/utils/freteFotoChegada.test.ts` — unit tests vitest do helper
- **Modify:** `src/components/frete/FreteDetalhesDrawer.tsx` linhas ~5-180 (imports, props, bloco "Foto da Chegada")
- **Create:** `tests/frete-foto-chegada.spec.ts` — Playwright E2E (pula se faltarem env vars)

---

## Task 1: Helper puro `calcularUpdateFotoChegada`

**Files:**
- Create: `src/utils/freteFotoChegada.ts`
- Test: `src/utils/freteFotoChegada.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/freteFotoChegada.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcularUpdateFotoChegada } from './freteFotoChegada'

describe('calcularUpdateFotoChegada', () => {
  it('auto-preenche dataChegada quando foto sobe e dataChegada está vazia', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
      dataChegadaAtual: undefined,
      hoje: '2026-05-20',
    })
    expect(out).toEqual({
      fotoChegadaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
      dataChegada: '2026-05-20',
    })
  })

  it('respeita dataChegada existente quando foto sobe', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
      dataChegadaAtual: '2026-05-15',
      hoje: '2026-05-20',
    })
    expect(out).toEqual({
      fotoChegadaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
    })
  })

  it('remove fotoChegadaUrl quando novaUrl é null sem mexer em dataChegada', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: null,
      dataChegadaAtual: '2026-05-15',
      hoje: '2026-05-20',
    })
    expect(out).toEqual({ fotoChegadaUrl: null })
  })

  it('trata string vazia como remoção', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: '',
      dataChegadaAtual: undefined,
      hoje: '2026-05-20',
    })
    expect(out).toEqual({ fotoChegadaUrl: null })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/utils/freteFotoChegada.test.ts`
Expected: **FAIL** — `Cannot find module './freteFotoChegada'`

- [ ] **Step 3: Implement the helper**

Create `src/utils/freteFotoChegada.ts`:

```typescript
/**
 * Helper puro pra calcular o payload de update do frete quando a foto
 * da chegada muda no drawer. Comportamento espelha o do FreteForm:
 *   - Se foto subiu E dataChegada estava vazia → preenche dataChegada = hoje
 *   - Se foto subiu E dataChegada já existe → não mexe em dataChegada
 *   - Se foto removida (null/'') → só zera fotoChegadaUrl, dataChegada intacta
 */
export interface CalcularUpdateInput {
  novaUrl: string | null
  dataChegadaAtual: string | undefined
  /** Data de hoje em formato YYYY-MM-DD (injetada pra testabilidade). */
  hoje: string
}

export interface UpdatePayload {
  fotoChegadaUrl: string | null
  dataChegada?: string
}

export function calcularUpdateFotoChegada({
  novaUrl,
  dataChegadaAtual,
  hoje,
}: CalcularUpdateInput): UpdatePayload {
  const normalizada = novaUrl && novaUrl.length > 0 ? novaUrl : null

  if (normalizada && !dataChegadaAtual) {
    return { fotoChegadaUrl: normalizada, dataChegada: hoje }
  }
  return { fotoChegadaUrl: normalizada }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/utils/freteFotoChegada.test.ts`
Expected: **PASS** — `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/freteFotoChegada.ts src/utils/freteFotoChegada.test.ts
git commit -m "feat(frete): helper calcularUpdateFotoChegada com testes vitest

Pura função que decide quando auto-preencher dataChegada ao subir
foto da chegada. Preparação pra integrar no drawer (Fase A do spec
2026-05-20-frete-tab-redesign-design.md)."
```

---

## Task 2: Drawer renderiza upload inline no estado vazio

**Files:**
- Modify: `src/components/frete/FreteDetalhesDrawer.tsx` (imports + props + bloco "Foto da Chegada")

> **Sem unit test aqui:** o drawer integra Supabase storage + React Query — testes unitários são frágeis. A cobertura virá via E2E Task 3. Validação interativa via `npm run dev` neste task.

- [ ] **Step 1: Adicionar imports e estender props no drawer**

Modify `src/components/frete/FreteDetalhesDrawer.tsx` linhas 1-25:

Substituir o bloco de imports + interface Props por:

```typescript
// FF.6 — Drawer read-only de detalhes do Frete.
// Tabs Detalhes / Histórico, KPIs, slot dedicado "Foto da Chegada",
// resolução de IDs (obra, insumo) e anexos.
// Fase A (2026-05): upload inline da foto chegada sem entrar em Editar.

import { useMemo, useState } from 'react';
import {
  Pencil, Trash2, Truck, MapPin, Calendar, Package, Weight, Route, Wallet,
  FileText, Paperclip, History, User, PackageCheck, ArrowRight, RotateCcw,
} from 'lucide-react';
import type { Frete, Obra, Insumo } from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import HistoricoTimeline from '../combustivel/HistoricoTimeline';
import AnexosUploader from '../combustivel/AnexosUploader';
import { useAtualizarFrete } from '../../hooks/useFretes';
import { useToast } from '../ui/Toast';
import { calcularUpdateFotoChegada } from '../../utils/freteFotoChegada';

interface Props {
  frete: Frete | null;
  open: boolean;
  onClose: () => void;
  obras: Obra[];
  insumos: Insumo[];
  onEdit?: (f: Frete) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}
```

- [ ] **Step 2: Adicionar state + mutation no componente**

Antes de editar, **leia `src/hooks/useFretes.ts`** pra conferir a assinatura de `useAtualizarFrete`. Provavelmente aceita um `Partial<Frete>` ou o `Frete` completo. Se for completo, ajustar `.mutate(...)` pra enviar o objeto inteiro (`{ ...frete, ...payload }`) em vez de só `{ id, ...payload }`.

Modify `src/components/frete/FreteDetalhesDrawer.tsx` logo após linha `const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');` (~linha 67):

```typescript
  const [forcarUpload, setForcarUpload] = useState(false);
  const atualizarMutation = useAtualizarFrete();
  const { showToast } = useToast();

  const handleFotoChange = (novas: string[]) => {
    if (!frete) return;
    const novaUrl = novas[novas.length - 1] ?? null; // último é o mais recente
    const hoje = new Date().toISOString().slice(0, 10);
    const payload = calcularUpdateFotoChegada({
      novaUrl,
      dataChegadaAtual: frete.dataChegada,
      hoje,
    });
    // NOTA: se useAtualizarFrete exige Frete completo (não partial),
    // trocar pra: atualizarMutation.mutate({ ...frete, ...payload }, ...)
    atualizarMutation.mutate(
      { id: frete.id, ...payload },
      {
        onSuccess: () => {
          showToast({ kind: 'success', message: 'Foto da chegada registrada.' });
          setForcarUpload(false);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          showToast({ kind: 'error', message: `Falha ao salvar foto: ${msg}` });
        },
      },
    );
  };
```

- [ ] **Step 3: Substituir o bloco "Foto da Chegada" (linhas ~152-181)**

Modify `src/components/frete/FreteDetalhesDrawer.tsx`. Substituir o bloco `<div className="rounded-xl border-2 ..."` (linhas 152-181 do arquivo atual) por:

```tsx
          {/* FF.6 + Fase A — Bloco destacado: Foto da Chegada da Carga.
              Estado vazio mostra AnexosUploader inline (quando canEdit).
              Estado com foto mostra thumb + botão Substituir. */}
          <div className="rounded-xl border-2 border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <PackageCheck className="w-5 h-5 text-[var(--color-accent)]" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">Foto da Chegada da Carga</h3>
                <p className="text-xs text-[var(--color-fg-muted)]">
                  {frete.fotoChegadaUrl && !forcarUpload
                    ? `Registrada${frete.dataChegada ? ` em ${fmtData(frete.dataChegada)}` : ''}.`
                    : 'Pendente — carga ainda não foi confirmada na chegada.'}
                </p>
              </div>
              {frete.fotoChegadaUrl && !forcarUpload && canEdit && (
                <button
                  type="button"
                  onClick={() => setForcarUpload(true)}
                  disabled={atualizarMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
                  title="Substituir foto"
                >
                  <RotateCcw className="w-3 h-3" />
                  Substituir
                </button>
              )}
            </div>

            {frete.fotoChegadaUrl && !forcarUpload ? (
              <a
                href={frete.fotoChegadaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-video rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
              >
                <img src={frete.fotoChegadaUrl} alt="Foto da chegada da carga" className="w-full h-full object-cover" loading="lazy" />
              </a>
            ) : canEdit ? (
              <AnexosUploader
                fotoUrls={[]}
                arquivoUrls={[]}
                onChangeFotos={handleFotoChange}
                onChangeArquivos={() => {}}
                pastaId={`frete-chegada/${frete.id}`}
                hideArquivos
              />
            ) : (
              <div className="aspect-video rounded-lg border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center px-4">
                <Truck className="w-8 h-8 text-[var(--color-fg-muted)] mb-2" />
                <p className="text-sm text-[var(--color-fg-muted)]">Sem foto de chegada registrada.</p>
                <p className="text-xs text-[var(--color-fg-muted)] mt-1">Você não tem permissão para anexar foto.</p>
              </div>
            )}
          </div>
```

- [ ] **Step 4: Verify TypeScript + build**

Run: `npx tsc -b 2>&1 | tail -10`
Expected: no output (sem erros). Se houver erros: corrigir antes de seguir.

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built in <Xs>` sem erros.

- [ ] **Step 5: Smoke test manual no dev server**

Run: `npm run dev`
- Abrir `http://localhost:5173/`, logar
- Navegar pra `/frete?tab=fretes`
- Clicar em um frete que **não tem foto chegada** → drawer abre → ver `AnexosUploader` no bloco "Foto da Chegada" ao invés do texto "Sem foto..."
- Subir uma foto (qualquer JPEG/PNG < 10 MB)
- Drawer deve atualizar mostrando thumbnail + `dataChegada` preenchida (campo abaixo)
- Toast verde "Foto da chegada registrada."
- Clicar em "Substituir" → uploader volta a aparecer
- Subir outra foto → substitui

Se algo falhar: investigar console, corrigir, repetir.

- [ ] **Step 6: Commit**

```bash
git add src/components/frete/FreteDetalhesDrawer.tsx
git commit -m "feat(frete): upload de foto chegada inline no drawer (Fase A)

Substitui o estado vazio do bloco 'Foto da Chegada' por um
AnexosUploader inline. Botão 'Substituir' aparece quando foto já
existe. Auto-preenche dataChegada (mesmo comportamento do FreteForm).

Não toca FreteForm.tsx — fluxo de edição completa segue inalterado.

Closes Fase A do spec 2026-05-20-frete-tab-redesign-design.md."
```

---

## Task 3: Playwright E2E spec

**Files:**
- Create: `tests/frete-foto-chegada.spec.ts`

- [ ] **Step 1: Criar o spec E2E**

Create `tests/frete-foto-chegada.spec.ts`:

```typescript
/**
 * E2E — Foto da chegada inline no drawer (Fase A do redesign Frete).
 *
 * Valida que:
 *  - Drawer abre ao clicar num frete
 *  - Bloco "Foto da Chegada" mostra uploader quando não há foto
 *  - Upload via input file mock atualiza o drawer (thumb + dataChegada)
 *  - Botão "Substituir" volta a mostrar o uploader
 *
 * Precondições:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD — conta com 'editar_frete'
 *   E2E_FRETE_SEM_FOTO_ID — id de um frete sem fotoChegadaUrl
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { hasCredentials, login } from './_fixtures'

const freteId = process.env.E2E_FRETE_SEM_FOTO_ID

test.describe('Foto da chegada inline no drawer', () => {
  test.skip(
    !hasCredentials() || !freteId,
    'E2E_TEST_EMAIL/PASSWORD e E2E_FRETE_SEM_FOTO_ID precisam estar setados'
  )

  test('upload de foto chegada via drawer sem entrar em Editar', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')

    // Espera a lista renderizar
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 })

    // Clica no row do frete de teste (procura por data-frete-id se houver
    // ou pelo conteúdo da NF). Como a tabela atual ainda usa .map, vamos
    // pela 1a row visível.
    await page.locator('tbody tr').first().click()

    // Drawer abre — bloco "Foto da Chegada" aparece
    const drawer = page.getByRole('dialog').or(page.locator('[role="dialog"]'))
    await expect(drawer).toBeVisible()
    await expect(page.getByText(/Foto da Chegada da Carga/i)).toBeVisible()

    // Estado vazio: deve mostrar o uploader (procura pelo botão "Tirar foto"
    // ou similar do AnexosUploader)
    await expect(page.getByText(/Tirar foto|Galeria|Pendente/i).first()).toBeVisible()

    // Upload via input file (mock — sem GPS real)
    const fixturePath = path.resolve(__dirname, 'fixtures/foto-chegada.jpg')
    const fileInput = drawer.locator('input[type="file"]').first()
    await fileInput.setInputFiles(fixturePath)

    // Espera toast de sucesso
    await expect(page.getByText(/Foto da chegada registrada/i)).toBeVisible({ timeout: 15_000 })

    // Drawer agora mostra thumbnail (img dentro do bloco) + botão Substituir
    await expect(drawer.locator('img[alt*="chegada"]')).toBeVisible()
    await expect(drawer.getByRole('button', { name: /Substituir/i })).toBeVisible()
  })

  test('clicar Substituir volta pro uploader', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.locator('tbody tr').first().click()

    const drawer = page.getByRole('dialog').or(page.locator('[role="dialog"]'))
    const substituir = drawer.getByRole('button', { name: /Substituir/i })

    // Se o frete de teste já tem foto, Substituir deve existir
    if (await substituir.isVisible()) {
      await substituir.click()
      // Após clicar, uploader deve estar visível novamente
      await expect(drawer.locator('input[type="file"]').first()).toBeVisible()
    } else {
      test.skip(true, 'Frete de teste não tem foto chegada — pular este sub-teste')
    }
  })
})
```

- [ ] **Step 2: Criar fixture de foto pra teste**

Gerar um JPEG 1x1 mínimo válido a partir de base64 (portátil, sem heredoc complexo):

```bash
mkdir -p tests/fixtures
echo "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEwwUHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAAA//9k=" | base64 -d > tests/fixtures/foto-chegada.jpg
ls -la tests/fixtures/foto-chegada.jpg
file tests/fixtures/foto-chegada.jpg
```

Expected:
- arquivo criado com ~300 bytes
- `file` reporta `JPEG image data, JFIF standard 1.01, ...`

- [ ] **Step 3: Verify TypeScript do spec compila**

Run: `npx tsc --noEmit tests/frete-foto-chegada.spec.ts 2>&1 | tail -5`
Expected: sem erros.

> O spec por padrão vai pular (skipped) na sua máquina porque `E2E_FRETE_SEM_FOTO_ID` provavelmente não está setado. Isso é OK — ele rodará só quando você configurar as env vars.

- [ ] **Step 4: Commit**

```bash
git add tests/frete-foto-chegada.spec.ts tests/fixtures/foto-chegada.jpg
git commit -m "test(e2e): Playwright spec pra foto chegada inline (Fase A)

Spec pula automaticamente quando E2E_FRETE_SEM_FOTO_ID não está
setada. Valida fluxo: drawer abre → uploader visível → upload →
thumbnail + dataChegada preenchida → Substituir volta pro uploader.

Fixture foto-chegada.jpg (JPEG 1x1 px) em tests/fixtures/."
```

---

## Task 4: Verificação final + security review + deploy + push

**Files:** nenhum (operacional)

- [ ] **Step 1: Build + tests passam**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built in <Xs>`

Run: `npm test 2>&1 | tail -10`
Expected: `Tests <N> passed (<N>)` (deve incluir os 4 novos testes de `freteFotoChegada`)

- [ ] **Step 2: Rodar /security-review**

No Claude Code:

```
/security-review
```

Expected: `NO_FINDINGS` (a mudança usa componentes existentes — AnexosUploader já tem MIME/size validation do Bloco 1.5; useAtualizarFrete já usa context authenticated; sem nova policy de banco).

Se houver findings: ler o report, corrigir, repetir. Não prosseguir até `NO_FINDINGS` ou findings explicitamente aceitos.

- [ ] **Step 3: Preview deploy na Vercel**

Run: `npx --yes vercel deploy 2>&1 | tail -8`
Expected: linha `Preview: https://gestao-obras-<hash>.vercel.app`

- [ ] **Step 4: Validação manual no preview**

Abrir a URL do preview, logar, repetir o smoke test do Task 2 Step 5. Tudo funcionando? Seguir. Algo quebrou? Corrigir, rebuild, novo preview.

- [ ] **Step 5: Promover pra produção**

Pedir confirmação ao usuário antes de promover (RLE alteração visível em prod). Quando confirmado:

Run: `npx --yes vercel --prod 2>&1 | tail -5`
Expected: `Production: https://...` + `Aliased: https://emtconstrutora.com`

- [ ] **Step 6: Push pro GitHub**

Run: `git push origin main 2>&1 | tail -3`
Expected: `<oldhash>..<newhash> main -> main`

- [ ] **Step 7: Atualizar audit.md (opcional)**

Se quiser fechar o item no audit.md, adicionar uma linha de status na seção 6 Bloco 3 mencionando que parte do 3.4 ficou parcialmente atendida (drawer ainda é custom, mas a feature pedida foi entregue). Pode ser feito num commit separado de docs.

---

## Critérios de aceitação

- ✅ `npm test` passa com 4+ novos testes verdes
- ✅ `npm run build` passa sem erros
- ✅ Manual: drawer mostra uploader quando frete sem foto + botão Substituir quando frete com foto
- ✅ Manual: upload preenche `dataChegada` automaticamente quando estava vazio
- ✅ Manual: toast de sucesso/erro aparece
- ✅ `/security-review` retorna `NO_FINDINGS`
- ✅ Deploy preview e prod sem regressão (visual nem funcional)

## O que NÃO está neste plano (fica pra Fase B)

- ❌ Migrar tabs custom da página Frete pra `Tabs` shadcn (Bloco 3.3)
- ❌ Reescrever `FreteList` com `data-table1` + expand-row (Bloco 3.6)
- ❌ `FilterBar` v2 com presets + componentes shadcn
- ❌ Migrar drawer pra `Sheet` shadcn (Bloco 3.4)
- ❌ Extrair `FreteFotoChegadaButton` como componente reusável
- ❌ Especificar mocks pro Supabase Storage no E2E (hoje teste roda contra DB real)

Cada um desses tem espaço no plano da Fase B.
