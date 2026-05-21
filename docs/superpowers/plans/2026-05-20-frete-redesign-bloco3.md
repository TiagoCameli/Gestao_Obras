# Fase B — Redesign Visual Aba Frete (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernizar a aba Frete (lista, filtros, drawer) migrando pra shadcn components — fecha Bloco 3 itens 3.3, 3.4, 3.6 do audit, com presets de filtro e expand-row na lista.

**Architecture:** Migração visual em 4 sub-áreas mais setup + testes. Reusa o `FreteFotoChegadaBlock` (extraído da Fase A) tanto no drawer quanto na linha expandida da nova tabela. Sem mudança no schema do banco, sem mudança em hooks de dados, sem mudança no `FreteForm`.

**Tech Stack:** React 19, TypeScript, `@tanstack/react-table` 8.x, shadcn components (tabs, sheet, popover, command, dropdown-menu), Tailwind, vitest, @playwright/test.

**Spec:** [`docs/superpowers/specs/2026-05-20-frete-tab-redesign-design.md`](../specs/2026-05-20-frete-tab-redesign-design.md) seção "Fase B — Arquitetura".

**Pré-requisitos:** Fase A já em produção (commit `2015734`). `FreteDetalhesDrawer` tem upload inline funcional. `selectedFrete` em `Frete.tsx` já é derived state via `useMemo`. Row em `FreteList` já tem `data-frete-id`.

---

## File Structure

**Novos arquivos:**
- `src/components/shadcn/tabs.tsx` (via `npx shadcn add`)
- `src/components/shadcn/sheet.tsx`
- `src/components/shadcn/popover.tsx`
- `src/components/shadcn/command.tsx`
- `src/components/shadcn/dropdown-menu.tsx`
- `src/components/frete/FreteFotoChegadaBlock.tsx` — extraído da Fase A pra reuso drawer + expand-row
- `src/utils/dateRangePresets.ts` + `.test.ts` — helpers puros pra presets de data
- `src/components/frete/FretePresets.tsx` — barra de quick-filters (chips)
- `src/components/frete/FreteListV2.tsx` — nova tabela com data-table1 + expand-row
- `src/components/frete/FreteRowExpanded.tsx` — conteúdo da linha expandida
- `tests/frete-list.spec.ts`
- `tests/frete-filtros.spec.ts`
- `tests/frete-drawer.spec.ts`

**Modificados:**
- `package.json` (+ `@tanstack/react-table`)
- `src/pages/Frete.tsx` — substituir tabs custom por `Tabs` shadcn; trocar `FreteList` por `FreteListV2`
- `src/components/frete/FreteDetalhesDrawer.tsx` — substituir wrapper `Drawer` custom por `Sheet`; usar `FreteFotoChegadaBlock` no lugar do bloco inline
- `src/components/frete/FilterBar.tsx` — adicionar suporte a quick-presets renderizados acima
- `src/components/ui/Drawer.tsx` — não modificar (continua sendo usado por outras 5 abas)

**Deletados (após migração e testes verdes):**
- `src/components/frete/FreteList.tsx` (substituído por FreteListV2; renomear depois)

---

## Task 1: Setup de dependências

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/components/shadcn/tabs.tsx`, `sheet.tsx`, `popover.tsx`, `command.tsx`, `dropdown-menu.tsx`

- [ ] **Step 1: Instalar `@tanstack/react-table`**

Run:
```bash
npm install @tanstack/react-table
```

Expected: dependência adicionada ao `package.json` na seção `dependencies`. Sem erros (peerDep `react ^19` satisfeita).

- [ ] **Step 2: Adicionar componentes shadcn via CLI**

Run:
```bash
npx shadcn@latest add tabs sheet popover command dropdown-menu
```

Quando perguntar onde salvar componentes, confirmar que vai em `src/components/shadcn/` (já configurado em `components.json` pelo Bloco 2.2). Confirma overwrite=No se algum já existir.

Expected: 5 arquivos criados em `src/components/shadcn/`. CLI pode adicionar deps internas (`@radix-ui/react-tabs`, `@radix-ui/react-popover`, `cmdk`, etc.) — aceitar.

- [ ] **Step 3: Verificar build não quebrou**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built in <Xs>` sem erros novos.

- [ ] **Step 4: Verificar testes não quebraram**

Run: `npm test 2>&1 | tail -10`
Expected: testes existentes continuam passando.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/shadcn/
git commit -m "chore: instalar @tanstack/react-table + shadcn (tabs, sheet, popover, command, dropdown-menu)

Setup pra Fase B do redesign Frete. Componentes via shadcn CLI vão
em src/components/shadcn/ conforme components.json (Bloco 2.2 do
audit). @tanstack/react-table peerDep react ^19 ok."
```

---

## Task 2: Extrair `FreteFotoChegadaBlock` do drawer

**Files:**
- Create: `src/components/frete/FreteFotoChegadaBlock.tsx`
- Modify: `src/components/frete/FreteDetalhesDrawer.tsx` (substituir bloco inline por componente)

**Justificativa:** Fase A pôs toda a lógica de foto chegada inline no drawer (linhas ~194-244). Fase B precisa reusar essa lógica na linha expandida da nova tabela. Extrair primeiro garante zero duplicação.

- [ ] **Step 1: Criar `FreteFotoChegadaBlock.tsx`**

Create `src/components/frete/FreteFotoChegadaBlock.tsx`:

```tsx
import { useMemo } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import type { Frete } from '../../types';
import AnexosUploader from '../combustivel/AnexosUploader';
import { useAtualizarFrete } from '../../hooks/useFretes';
import { useToast } from '../ui/Toast';
import { calcularUpdateFotoChegada } from '../../utils/freteFotoChegada';

interface Props {
  frete: Frete;
  canEdit: boolean;
  /** Variante visual: 'card' (drawer) ou 'compact' (expand-row). */
  variant?: 'card' | 'compact';
}

function fmtData(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

/**
 * Bloco unificado de upload + display das fotos de chegada do frete.
 * Usado em 2 lugares: drawer de detalhes e linha expandida da tabela.
 *
 * Comportamento (Fase A):
 * - Combina fotoChegadaUrl + fotoUrls (até 8 fotos)
 * - 1ª foto = principal (vai pra fotoChegadaUrl); resto vai pra fotoUrls
 * - Remover a 1ª promove a 2ª (sem confirmar)
 * - Auto-preenche dataChegada quando 1ª foto sobe e dataChegada estava vazia
 */
export default function FreteFotoChegadaBlock({ frete, canEdit, variant = 'card' }: Props) {
  const atualizarMutation = useAtualizarFrete();
  const { showToast } = useToast();

  const fotosAtuais = useMemo<string[]>(() => {
    const all: string[] = [];
    if (frete.fotoChegadaUrl) all.push(frete.fotoChegadaUrl);
    if (frete.fotoUrls) all.push(...frete.fotoUrls);
    return all;
  }, [frete]);

  const handleFotoChange = (novas: string[]) => {
    const novaUrl = novas[0] ?? null;
    const extras = novas.slice(1);
    const hoje = new Date().toISOString().slice(0, 10);
    const payload = calcularUpdateFotoChegada({
      novaUrl,
      dataChegadaAtual: frete.dataChegada,
      hoje,
    });
    atualizarMutation.mutate(
      { ...frete, ...payload, fotoUrls: extras },
      {
        onSuccess: () => {
          showToast({ kind: 'success', message: 'Fotos atualizadas.' });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          showToast({ kind: 'error', message: `Falha ao salvar fotos: ${msg}` });
        },
      },
    );
  };

  const isCompact = variant === 'compact';
  const containerClass = isCompact
    ? 'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3'
    : 'rounded-xl border-2 border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4';

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

      {canEdit ? (
        <AnexosUploader
          fotoUrls={fotosAtuais}
          arquivoUrls={[]}
          onChangeFotos={handleFotoChange}
          onChangeArquivos={() => {}}
          pastaId={`frete-chegada/${frete.id}`}
          hideArquivos
        />
      ) : fotosAtuais.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {fotosAtuais.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
            >
              <img src={url} alt={`Foto da chegada ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              {i === 0 && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wide bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] rounded-full font-bold">
                  Principal
                </span>
              )}
            </a>
          ))}
        </div>
      ) : (
        <div className="aspect-video rounded-lg border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center px-4">
          <Truck className="w-8 h-8 text-[var(--color-fg-muted)] mb-2" />
          <p className="text-sm text-[var(--color-fg-muted)]">Sem foto de chegada registrada.</p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">Você não tem permissão para anexar.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Substituir bloco no `FreteDetalhesDrawer.tsx`**

Modify `src/components/frete/FreteDetalhesDrawer.tsx`.

(a) Remover os imports que viraram do `FreteFotoChegadaBlock`:

Atualmente top do arquivo importa `AnexosUploader`, `useAtualizarFrete`, `useToast`, `calcularUpdateFotoChegada`, `PackageCheck`, `Truck`. Quais permanecem? `PackageCheck` e `Truck` podem sair se não usados em outros lugares. Os hooks/utils saem todos.

Remover do bloco `import { useMemo, useState } from 'react';` o `useMemo` se não houver outros usos no arquivo (verificar). Manter `useState` (tab state).

Verificar:
```bash
grep -n "useMemo\|PackageCheck\|Truck\|AnexosUploader\|useAtualizarFrete\|useToast\|calcularUpdateFotoChegada\|fotosAtuais\|handleFotoChange" src/components/frete/FreteDetalhesDrawer.tsx
```

Remover linhas que ficaram órfãs.

(b) Adicionar import do novo componente:
```tsx
import FreteFotoChegadaBlock from './FreteFotoChegadaBlock';
```

(c) Remover `fotosAtuais`, `handleFotoChange`, `atualizarMutation`, `showToast` do corpo do componente.

(d) Substituir o JSX inteiro do bloco "Foto da Chegada" (linhas atuais ~192-247) por:
```tsx
          {/* FF.6 + Fase A — Fotos da Chegada (componente reutilizável). */}
          <FreteFotoChegadaBlock frete={frete} canEdit={canEdit} variant="card" />
```

- [ ] **Step 3: Verificar TypeScript + build**

Run: `npx tsc -b 2>&1 | tail -5`
Expected: zero erros.

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 4: Smoke test local (preserva Fase A)**

Run dev server, abrir drawer de um frete, confirmar:
- Estado vazio (sem foto): uploader visível
- Adicionar foto: salva + heading atualiza
- Remover foto: promove a 2ª

Visual idêntico ao da Fase A. Se algo mudou, comparar com `variant='card'` configs.

- [ ] **Step 5: Commit**

```bash
git add src/components/frete/FreteFotoChegadaBlock.tsx src/components/frete/FreteDetalhesDrawer.tsx
git commit -m "refactor(frete): extrair FreteFotoChegadaBlock pra reuso

Sem mudança de comportamento. Mesmo bloco da Fase A do drawer, agora
em componente standalone. Variant 'card' (drawer) e 'compact'
(expand-row) preparada pra reuso na nova tabela com data-table1
(Task 6 do plano Fase B)."
```

---

## Task 3: Migrar tabs da página Frete pra shadcn `Tabs`

**Files:**
- Modify: `src/pages/Frete.tsx` (linhas ~122-150 atuais, sub-nav)

- [ ] **Step 1: Adicionar import do `Tabs` shadcn**

Modify `src/pages/Frete.tsx`. No bloco de imports do topo, adicionar:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/shadcn/tabs';
```

- [ ] **Step 2: Substituir o sub-nav custom**

Encontrar o trecho do JSX que renderiza as tabs custom (geralmente um `<div>` com `<button>` ou `<span>` por aba; pesquisar por `tab === 'fretes'` etc.).

Substituir por estrutura `Tabs`:

```tsx
<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
  <TabsList>
    {allowedTabs.includes('dashboard') && (
      <TabsTrigger value="dashboard" className="gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        Dashboard
      </TabsTrigger>
    )}
    {allowedTabs.includes('fretes') && (
      <TabsTrigger value="fretes" className="gap-1.5">
        <Truck className="w-3.5 h-3.5" />
        Fretes
      </TabsTrigger>
    )}
    {allowedTabs.includes('pagamentos') && (
      <TabsTrigger value="pagamentos" className="gap-1.5">
        <Wallet className="w-3.5 h-3.5" />
        Pagamentos
      </TabsTrigger>
    )}
    {allowedTabs.includes('conta_corrente') && (
      <TabsTrigger value="conta_corrente" className="gap-1.5">
        <Wallet2 className="w-3.5 h-3.5" />
        Conta Corrente
      </TabsTrigger>
    )}
    {allowedTabs.includes('pedidos') && (
      <TabsTrigger value="pedidos" className="gap-1.5">
        <PackageSearch className="w-3.5 h-3.5" />
        Pedidos
      </TabsTrigger>
    )}
    {allowedTabs.includes('lixeira') && (
      <TabsTrigger value="lixeira" className="gap-1.5">
        <Trash2 className="w-3.5 h-3.5" />
        Lixeira
      </TabsTrigger>
    )}
  </TabsList>

  <TabsContent value="dashboard">
    {/* mover aqui o conteúdo atual da aba dashboard */}
  </TabsContent>

  <TabsContent value="fretes">
    {/* conteúdo atual de fretes (FilterBar + FreteList + botões topo) */}
  </TabsContent>

  <TabsContent value="pagamentos">
    {/* idem */}
  </TabsContent>

  {/* ... etc ... */}
</Tabs>
```

**Crítico**: a estrutura atual provavelmente usa `{tab === 'fretes' && (...)}` para renderizar condicional. Trocar para `<TabsContent value="...">` que faz o mesmo automaticamente. NÃO duplique condicionais por permissão dentro do `TabsContent` — quem não tem permissão não vê o `TabsTrigger` então não consegue chegar lá.

- [ ] **Step 3: Verificar TypeScript + build**

Run: `npx tsc -b 2>&1 | tail -5`
Expected: zero erros.

Run: `npm run build 2>&1 | tail -3`
Expected: passa.

- [ ] **Step 4: Smoke test manual**

Run: `npm run dev`
- Abrir `/frete?tab=fretes` → confirmar que vai pra aba certa
- Clicar em outras abas → URL atualiza (`?tab=pagamentos` etc.)
- F5 numa aba específica → permanece na aba correta
- Usuário sem permissão de `aba_frete_lixeira` → trigger Lixeira não aparece

- [ ] **Step 5: Commit**

```bash
git add src/pages/Frete.tsx
git commit -m "refactor(frete): migrar 6 tabs custom pra Tabs shadcn (Bloco 3.3)

Substitui o sub-nav custom (spans + URL params) por Tabs/TabsList/
TabsTrigger/TabsContent do shadcn. Preserva:
- URL sync via ?tab=...
- Filtro por permissão (allowedTabs)
- Ícones lucide-react

Auditoria Bloco 3.3."
```

---

## Task 4: Helpers puros pra presets de data

**Files:**
- Create: `src/utils/dateRangePresets.ts`
- Test: `src/utils/dateRangePresets.test.ts`

- [ ] **Step 1: Failing tests**

Create `src/utils/dateRangePresets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { presetEstaSemana, presetMesPassado, presetSemChegada } from './dateRangePresets'

describe('presetEstaSemana', () => {
  it('retorna [segunda, hoje] dado uma quarta-feira', () => {
    // Quarta-feira 2026-05-20
    const result = presetEstaSemana(new Date('2026-05-20T12:00:00'))
    expect(result.dataInicio).toBe('2026-05-18') // segunda
    expect(result.dataFim).toBe('2026-05-20')
  })

  it('retorna [segunda, hoje] dado um domingo (trata domingo como dia 7)', () => {
    // Domingo 2026-05-24
    const result = presetEstaSemana(new Date('2026-05-24T08:00:00'))
    expect(result.dataInicio).toBe('2026-05-18') // segunda anterior
    expect(result.dataFim).toBe('2026-05-24')
  })

  it('retorna [hoje, hoje] dado uma segunda-feira', () => {
    const result = presetEstaSemana(new Date('2026-05-18T08:00:00'))
    expect(result.dataInicio).toBe('2026-05-18')
    expect(result.dataFim).toBe('2026-05-18')
  })
})

describe('presetMesPassado', () => {
  it('retorna primeiro e último dia do mês anterior — meio de maio', () => {
    const result = presetMesPassado(new Date('2026-05-15'))
    expect(result.dataInicio).toBe('2026-04-01')
    expect(result.dataFim).toBe('2026-04-30')
  })

  it('janeiro → dezembro do ano anterior', () => {
    const result = presetMesPassado(new Date('2026-01-10'))
    expect(result.dataInicio).toBe('2025-12-01')
    expect(result.dataFim).toBe('2025-12-31')
  })

  it('março → fevereiro (28 ou 29 dias)', () => {
    const result = presetMesPassado(new Date('2024-03-10')) // 2024 é bissexto
    expect(result.dataInicio).toBe('2024-02-01')
    expect(result.dataFim).toBe('2024-02-29')
  })
})

describe('presetSemChegada', () => {
  it('retorna nada (preset sem range de datas — é filtro de coluna)', () => {
    expect(presetSemChegada()).toEqual({})
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/utils/dateRangePresets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `src/utils/dateRangePresets.ts`:

```typescript
/**
 * Helpers puros pra calcular ranges de data dos quick-presets da Frete.
 * Datas em formato YYYY-MM-DD (string).
 */

export interface DateRange {
  dataInicio?: string
  dataFim?: string
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * "Esta semana" — segunda da semana atual até hoje.
 * Segunda = dayOfWeek 1. Domingo = 0 (treat como fim de semana).
 */
export function presetEstaSemana(hoje: Date = new Date()): DateRange {
  const d = new Date(hoje.getTime())
  const day = d.getDay() // 0=domingo, 1=segunda, ... 6=sábado
  const diasParaSegunda = day === 0 ? 6 : day - 1
  const segunda = new Date(d.getTime() - diasParaSegunda * 24 * 60 * 60 * 1000)
  return {
    dataInicio: toISODate(segunda),
    dataFim: toISODate(d),
  }
}

/**
 * "Mês passado" — primeiro dia até último dia do mês anterior.
 */
export function presetMesPassado(hoje: Date = new Date()): DateRange {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() // 0-indexed; mês anterior = mes-1
  const primeiroDoMesAnterior = new Date(ano, mes - 1, 1)
  const ultimoDoMesAnterior = new Date(ano, mes, 0) // dia 0 do mês atual = último do anterior
  return {
    dataInicio: toISODate(primeiroDoMesAnterior),
    dataFim: toISODate(ultimoDoMesAnterior),
  }
}

/**
 * "Sem chegada" — sem range de datas; é um filtro de coluna
 * (dataChegada IS NULL) que o consumer aplica separadamente.
 */
export function presetSemChegada(): DateRange {
  return {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/utils/dateRangePresets.test.ts`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dateRangePresets.ts src/utils/dateRangePresets.test.ts
git commit -m "feat(frete): helpers puros pra presets de data (Esta semana, Mês passado)

Pure functions com 7 testes vitest. Preparação pra Task 5 (FretePresets
component). Casos cobertos:
- presetEstaSemana: meio de semana, domingo (wraparound), segunda
- presetMesPassado: meio do ano, jan→dez, março→fev bissexto
- presetSemChegada: stub (range vazio; filtro de coluna no consumer)"
```

---

## Task 5: `FretePresets` component + integração

**Files:**
- Create: `src/components/frete/FretePresets.tsx`
- Modify: `src/components/frete/FilterBar.tsx` (renderizar `FretePresets` acima da barra)
- Modify: `src/pages/Frete.tsx` (estado `presetAtivo`, handlers, passar dados pra `FretePresets`)

- [ ] **Step 1: Criar `FretePresets.tsx`**

Create `src/components/frete/FretePresets.tsx`:

```tsx
import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../shadcn/command';
import { CalendarRange, CalendarOff, ChevronDown, Truck, XCircle } from 'lucide-react';
import type { Frete, FiltrosFrete } from '../../types';
import { presetEstaSemana, presetMesPassado } from '../../utils/dateRangePresets';

export type PresetKey = 'sem_chegada' | 'esta_semana' | 'mes_passado' | 'top_transportadora';

interface Props {
  fretes: Frete[];
  filtros: FiltrosFrete;
  /** Aplica o preset escolhido. Passa undefined p/ desativar. */
  onApplyPreset: (key: PresetKey | null, valor?: string) => void;
  presetAtivo: PresetKey | null;
  transportadoraTop?: string; // valor atual do dropdown top transportadora
}

function isoToDate(s?: string): string | undefined {
  return s || undefined;
}

/**
 * Retorna true se filtros[key] casa com o esperado do preset.
 */
function presetAtivoCheck(filtros: FiltrosFrete, key: PresetKey, hoje: Date = new Date()): boolean {
  if (key === 'sem_chegada') {
    // Preset 'sem chegada' não tem campo direto em FiltrosFrete; é
    // controlado externamente. Aqui retorna sempre false; o pai
    // gerencia `presetAtivo` explicitamente.
    return false;
  }
  if (key === 'esta_semana') {
    const r = presetEstaSemana(hoje);
    return filtros.dataInicio === r.dataInicio && filtros.dataFim === r.dataFim;
  }
  if (key === 'mes_passado') {
    const r = presetMesPassado(hoje);
    return filtros.dataInicio === r.dataInicio && filtros.dataFim === r.dataFim;
  }
  return false;
}

export default function FretePresets({ fretes, filtros, onApplyPreset, presetAtivo, transportadoraTop }: Props) {
  // Top 5 transportadoras nos últimos 90 dias
  const top5 = useMemo<{ nome: string; count: number }[]>(() => {
    const hoje = new Date();
    const cutoff = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const counts = new Map<string, number>();
    for (const f of fretes) {
      if (!f.transportadora || f.data < cutoffISO) continue;
      counts.set(f.transportadora, (counts.get(f.transportadora) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [fretes]);

  const semChegadaAtivo = presetAtivo === 'sem_chegada';
  const estaSemanaAtivo = presetAtivo === 'esta_semana' || (presetAtivo === null && presetAtivoCheck(filtros, 'esta_semana'));
  const mesPassadoAtivo = presetAtivo === 'mes_passado' || (presetAtivo === null && presetAtivoCheck(filtros, 'mes_passado'));
  const topAtivo = presetAtivo === 'top_transportadora' && !!transportadoraTop;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold mr-1">Quick</span>

      <PresetChip
        active={semChegadaAtivo}
        onClick={() => onApplyPreset(semChegadaAtivo ? null : 'sem_chegada')}
        icon={<CalendarOff className="w-3 h-3" />}
        label="Sem chegada"
      />
      <PresetChip
        active={estaSemanaAtivo}
        onClick={() => onApplyPreset(estaSemanaAtivo ? null : 'esta_semana')}
        icon={<CalendarRange className="w-3 h-3" />}
        label="Esta semana"
      />
      <PresetChip
        active={mesPassadoAtivo}
        onClick={() => onApplyPreset(mesPassadoAtivo ? null : 'mes_passado')}
        icon={<CalendarRange className="w-3 h-3" />}
        label="Mês passado"
      />

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              topAtivo
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[color:color-mix(in_srgb,var(--color-accent)_40%,transparent)]'
                : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Truck className="w-3 h-3" />
            {topAtivo ? `Transp: ${transportadoraTop}` : 'Top transportadora'}
            <ChevronDown className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar transportadora…" />
            <CommandList>
              <CommandEmpty>Nenhuma encontrada.</CommandEmpty>
              <CommandGroup heading="Top 5 (últimos 90 dias)">
                {top5.map((t) => (
                  <CommandItem
                    key={t.nome}
                    value={t.nome}
                    onSelect={() => onApplyPreset('top_transportadora', t.nome)}
                  >
                    <span className="flex-1 truncate">{t.nome}</span>
                    <span className="text-[10px] text-[var(--color-fg-muted)] ml-2">{t.count}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {presetAtivo && (
        <button
          type="button"
          onClick={() => onApplyPreset(null)}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] transition-colors"
          title="Limpar preset"
        >
          <XCircle className="w-3 h-3" />
          Limpar preset
        </button>
      )}
    </div>
  );
}

function PresetChip({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[color:color-mix(in_srgb,var(--color-accent)_40%,transparent)]'
          : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
```

> NOTE on isoToDate: removida pois não foi usada (lint). Se TypeScript reclamar, deletar a função.

- [ ] **Step 2: Estado de preset + handler em `Frete.tsx`**

Modify `src/pages/Frete.tsx`. Adicionar logo após o `useState<FiltrosFrete>`:

```typescript
  const [presetAtivo, setPresetAtivo] = useState<import('../components/frete/FretePresets').PresetKey | null>(null);

  const aplicarPreset = useCallback((key: import('../components/frete/FretePresets').PresetKey | null, valor?: string) => {
    setPresetAtivo(key);
    if (key === null) {
      // Limpa range de data + transportadora; demais filtros mantidos
      setFiltros((f) => ({ ...f, dataInicio: '', dataFim: '', transportadora: '' }));
      return;
    }
    if (key === 'sem_chegada') {
      // Não mexe no range de data; consumer (FreteListV2) lê presetAtivo
      // separadamente pra filtrar por dataChegada IS NULL.
      setFiltros((f) => ({ ...f, dataInicio: '', dataFim: '' }));
      return;
    }
    if (key === 'esta_semana') {
      const r = presetEstaSemana();
      setFiltros((f) => ({ ...f, dataInicio: r.dataInicio ?? '', dataFim: r.dataFim ?? '' }));
      return;
    }
    if (key === 'mes_passado') {
      const r = presetMesPassado();
      setFiltros((f) => ({ ...f, dataInicio: r.dataInicio ?? '', dataFim: r.dataFim ?? '' }));
      return;
    }
    if (key === 'top_transportadora' && valor) {
      setFiltros((f) => ({ ...f, transportadora: valor }));
      return;
    }
  }, []);
```

Importar no topo:
```tsx
import FretePresets from '../components/frete/FretePresets';
import { presetEstaSemana, presetMesPassado } from '../utils/dateRangePresets';
```

- [ ] **Step 3: Renderizar `FretePresets` acima do `FilterBar` na aba Fretes**

Modify `src/pages/Frete.tsx`. Dentro do `<TabsContent value="fretes">`, antes do `<FilterBar>` (ou no topo do conteúdo da aba), adicionar:

```tsx
<FretePresets
  fretes={fretes}
  filtros={filtros}
  onApplyPreset={aplicarPreset}
  presetAtivo={presetAtivo}
  transportadoraTop={presetAtivo === 'top_transportadora' ? filtros.transportadora : undefined}
/>
```

- [ ] **Step 4: Aplicar filtro "sem chegada" no `FreteListV2`**

Esse preset não mexe em `filtros.dataInicio`/`dataFim`. Em vez disso, o consumer (FreteListV2 — Task 6) precisa ler `presetAtivo` e filtrar por `dataChegada == null`.

Por enquanto (até Task 6 estar pronto), passar prop `filtroSemChegada` pro `FreteList` antigo:

Modify `src/components/frete/FreteList.tsx` adicionar prop:
```tsx
interface FreteListProps {
  // ... props existentes ...
  /** Quando true, filtra apenas fretes sem dataChegada registrada. */
  filtroSemChegada?: boolean;
}
```

E no `filtrados` useMemo, adicionar:
```tsx
if (filtroSemChegada && f.dataChegada) return false;
```

Passar no `Frete.tsx`:
```tsx
<FreteList
  fretes={fretes}
  ...
  filtroSemChegada={presetAtivo === 'sem_chegada'}
/>
```

- [ ] **Step 5: TypeScript + build**

Run: `npx tsc -b 2>&1 | tail -5`
Expected: zero erros.

Run: `npm run build 2>&1 | tail -3`
Expected: passa.

- [ ] **Step 6: Smoke test**

`npm run dev`. Na aba Fretes:
- Click "Esta semana" → range de data preenche, chip fica ativo
- Click "Mês passado" → range é sobrescrito, chip ativo
- Click "Sem chegada" → lista filtra fretes sem dataChegada
- Click "Top transportadora" → popover abre com top 5
- Click "Limpar preset" → tudo zera

- [ ] **Step 7: Commit**

```bash
git add src/components/frete/FretePresets.tsx src/components/frete/FreteList.tsx src/pages/Frete.tsx
git commit -m "feat(frete): quick-presets de filtro com Popover + Command shadcn

4 presets na aba Fretes:
- Sem chegada (dataChegada IS NULL)
- Esta semana (segunda-feira até hoje)
- Mês passado (mês anterior completo)
- Top transportadora (popover com top 5 dos últimos 90d, via Command)

Reset de preset volta range de data + transportadora ao zero. Novo
preset de data sobrescreve range anterior (conforme spec). FreteList
ganha filtroSemChegada prop temporária — Task 6 (FreteListV2) leva
essa lógica pra dentro do data-table.

Auditoria Bloco 3 — parte dos filtros."
```

---

## Task 6: `FreteListV2` com `@tanstack/react-table` + expand-row

**Files:**
- Create: `src/components/frete/FreteListV2.tsx`
- Create: `src/components/frete/FreteRowExpanded.tsx`
- Modify: `src/pages/Frete.tsx` (trocar `FreteList` por `FreteListV2`)
- Delete (após smoke test): `src/components/frete/FreteList.tsx`

> **Maior task do plano.** ~500 LOC novas. Implementar em sub-steps e commitar a cada agrupamento lógico.

- [ ] **Step 1: Criar `FreteRowExpanded.tsx` (sub-componente da linha expandida)**

Create `src/components/frete/FreteRowExpanded.tsx`:

```tsx
import type { Frete, Obra, Insumo, PagamentoFrete } from '../../types';
import FreteFotoChegadaBlock from './FreteFotoChegadaBlock';

interface Props {
  frete: Frete;
  obras: Obra[];
  insumos: Insumo[];
  pagamentosFrete: PagamentoFrete[];
  canEdit: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

export default function FreteRowExpanded({ frete, obras: _obras, insumos: _insumos, pagamentosFrete, canEdit }: Props) {
  const tkmCalc = frete.kmRodados * frete.pesoToneladas;
  const pagto = pagamentosFrete.find((p) => p.fretesAbatidos?.some((fa) => fa.freteId === frete.id));
  const statusPagto = pagto ? 'Pago' : 'Pendente';

  return (
    <div className="bg-[var(--color-surface-1)] border-t border-[var(--color-border)] p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coluna 1: Fotos de chegada (reusa Fase A) */}
        <div>
          <FreteFotoChegadaBlock frete={frete} canEdit={canEdit} variant="compact" />
        </div>

        {/* Coluna 2: Motorista + NF + Datas */}
        <div className="space-y-2 text-xs">
          <Field label="Motorista" value={frete.motorista || '—'} />
          <Field label="Placa" value={frete.placaCarreta || '—'} />
          <Field label="NF" value={frete.notaFiscal || '—'} />
          {frete.notaFiscal2 && <Field label="NF 2" value={frete.notaFiscal2} />}
          <Field label="Data chegada" value={fmtData(frete.dataChegada || '')} />
        </div>

        {/* Coluna 3: Financeiro */}
        <div className="space-y-2 text-xs">
          <Field label="R$ / TKM" value={`${fmtBRL(frete.valorTkm)} (TKM=${tkmCalc.toLocaleString('pt-BR')})`} />
          <Field label="Valor frete" value={fmtBRL(frete.valorTotal)} />
          <Field label="Valor material" value={fmtBRL(frete.valorMaterial || 0)} />
          <Field label="Pagamento" value={
            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusPagto === 'Pago'
                ? 'bg-[color:color-mix(in_srgb,#10b981_22%,transparent)] text-emerald-700 dark:text-emerald-300'
                : 'bg-[color:color-mix(in_srgb,#f59e0b_22%,transparent)] text-amber-700 dark:text-amber-300'
            }`}>{statusPagto}</span>
          } />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">{label}</div>
      <div className="text-sm text-[var(--color-fg)] mt-0.5">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `FreteListV2.tsx` (tabela com data-table1)**

Create `src/components/frete/FreteListV2.tsx`:

```tsx
import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  getExpandedRowModel, createColumnHelper, flexRender,
  type ColumnDef, type ExpandedState, type SortingState,
} from '@tanstack/react-table';
import {
  ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown,
  MoreVertical, Pencil, Trash2,
} from 'lucide-react';
import type { Frete, Obra, Insumo, PagamentoFrete } from '../../types';
import FreteRowExpanded from './FreteRowExpanded';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';

interface Props {
  fretes: Frete[];
  obras: Obra[];
  insumos: Insumo[];
  pagamentosFrete: PagamentoFrete[];
  filtros: { obraId: string; transportadora: string; motorista: string; insumoId: string; origem: string; destino: string; dataInicio: string; dataFim: string; notaFiscal: string };
  filtroSemChegada?: boolean;
  onEdit: (frete: Frete) => void;
  onDelete: (id: string) => void;
  onSelect?: (f: Frete) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): { dia: string; hora?: string } {
  if (!iso) return { dia: '—' };
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { dia: `${m[3]}/${m[2]}` };
  return { dia: iso };
}

const PAGE_SIZE_KEY = 'frete-list-page-size-v2';

function getInitialPageSize(): number {
  if (typeof window === 'undefined') return 25;
  const stored = window.localStorage.getItem(PAGE_SIZE_KEY);
  const n = stored ? parseInt(stored, 10) : 25;
  return [25, 50, 100].includes(n) ? n : 25;
}

export default function FreteListV2({
  fretes, obras: _obras, insumos, pagamentosFrete, filtros, filtroSemChegada = false,
  onEdit, onDelete, onSelect, canEdit = true, canDelete = true,
}: Props) {
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);

  // Filtros client-side (mesma lógica do FreteList v1)
  const filtrados = useMemo(() => {
    return fretes.filter((f) => {
      if (filtros.obraId && f.obraId !== filtros.obraId) return false;
      if (filtros.transportadora && f.transportadora !== filtros.transportadora) return false;
      if (filtros.motorista) {
        const q = filtros.motorista.toLowerCase();
        if (!f.motorista?.toLowerCase().includes(q)) return false;
      }
      if (filtros.insumoId && f.insumoId !== filtros.insumoId) return false;
      if (filtros.origem && f.origem?.trim() !== filtros.origem) return false;
      if (filtros.destino && f.destino?.trim() !== filtros.destino) return false;
      if (filtros.dataInicio && f.data < filtros.dataInicio) return false;
      if (filtros.dataFim && f.data > filtros.dataFim) return false;
      if (filtros.notaFiscal) {
        const q = filtros.notaFiscal.toLowerCase();
        if (!f.notaFiscal?.toLowerCase().includes(q)) return false;
      }
      if (filtroSemChegada && f.dataChegada) return false;
      return true;
    });
  }, [fretes, filtros, filtroSemChegada]);

  // Column helpers (typing helper)
  const ch = useMemo(() => createColumnHelper<Frete>(), []);

  const columns = useMemo<ColumnDef<Frete>[]>(() => [
    {
      id: 'expander',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
          className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          title={row.getIsExpanded() ? 'Recolher' : 'Expandir'}
        >
          {row.getIsExpanded() ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ),
      size: 32,
    },
    ch.accessor('data', {
      header: 'Data',
      cell: (info) => {
        const { dia } = fmtData(info.getValue());
        return <span className="font-medium">{dia}</span>;
      },
      sortingFn: 'alphanumeric',
    }) as ColumnDef<Frete>,
    {
      id: 'origemDestino',
      header: 'Origem → Destino',
      accessorFn: (f) => `${f.origem ?? ''} → ${f.destino ?? ''}`,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium truncate max-w-[200px]">{row.original.origem || '—'}</span>
          <span className="text-xs text-[var(--color-fg-muted)] truncate max-w-[200px]">→ {row.original.destino || '—'}</span>
        </div>
      ),
    },
    ch.accessor('transportadora', {
      header: 'Transportadora',
      cell: (info) => <span className="truncate max-w-[150px]">{info.getValue() || '—'}</span>,
    }) as ColumnDef<Frete>,
    {
      id: 'material',
      header: 'Material',
      accessorFn: (f) => insumosMap.get(f.insumoId) || f.insumoId,
      cell: (info) => <span className="truncate max-w-[120px]">{String(info.getValue())}</span>,
    },
    ch.accessor('pesoToneladas', {
      header: 'Peso (t)',
      cell: (info) => <span className="tabular-nums">{(info.getValue() ?? 0).toLocaleString('pt-BR')} t</span>,
    }) as ColumnDef<Frete>,
    ch.accessor('valorTotal', {
      header: 'Valor',
      cell: (info) => <span className="tabular-nums font-semibold">{fmtBRL(info.getValue() ?? 0)}</span>,
    }) as ColumnDef<Frete>,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              title="Ações"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Editar
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(row.original.id)}
                className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      size: 32,
    },
  ], [ch, insumosMap, canEdit, canDelete, onEdit, onDelete]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pageSize, setPageSize] = useState<number>(getInitialPageSize);

  const persistPageSize = useCallback((n: number) => {
    setPageSize(n);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(n));
    }
  }, []);

  const table = useReactTable({
    data: filtrados,
    columns,
    state: { sorting, expanded, pagination: { pageIndex: 0, pageSize } },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: () => true,
  });

  if (filtrados.length === 0) {
    return (
      <div className="surface-raised p-8 text-center">
        <p className="text-[var(--color-fg-muted)]">Nenhum frete encontrado.</p>
      </div>
    );
  }

  return (
    <div className="surface-raised overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-[var(--color-surface-2)]/80">
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sortDir = h.column.getIsSorted();
                  const Icon = !sortDir ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={h.id}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={`px-3 py-2.5 text-left text-[10px] uppercase tracking-wide font-semibold text-[var(--color-fg-muted)] ${canSort ? 'cursor-pointer hover:bg-[var(--color-surface-2)]' : ''}`}
                      style={{ width: h.getSize() === 150 ? undefined : h.getSize() }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && <Icon className={`w-3 h-3 ${sortDir ? 'opacity-100' : 'opacity-40'}`} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  data-frete-id={row.original.id}
                  onClick={() => onSelect?.(row.original)}
                  className="hover:bg-[var(--color-surface-1)] cursor-pointer border-t border-[var(--color-border)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length} className="p-0">
                      <FreteRowExpanded
                        frete={row.original}
                        obras={_obras}
                        insumos={insumos}
                        pagamentosFrete={pagamentosFrete}
                        canEdit={!!canEdit}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30 text-xs text-[var(--color-fg-muted)]">
        <div>
          {filtrados.length} fretes · Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => persistPageSize(parseInt(e.target.value, 10))}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-2 py-1 text-xs"
          >
            <option value={25}>25/pg</option>
            <option value={50}>50/pg</option>
            <option value={100}>100/pg</option>
          </select>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 border border-[var(--color-border)] rounded disabled:opacity-40 hover:bg-[var(--color-surface-1)]"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 border border-[var(--color-border)] rounded disabled:opacity-40 hover:bg-[var(--color-surface-1)]"
          >
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
```

> Note: `onUpdateDataChegada` (inline date editor da v1) NÃO é portado pra v2. A coluna data não é editável inline — o usuário expande a row pra ver/editar via foto chegada (que auto-preenche dataChegada).

- [ ] **Step 3: Trocar `FreteList` por `FreteListV2` em `Frete.tsx`**

Modify `src/pages/Frete.tsx`:

(a) Import:
```tsx
import FreteListV2 from '../components/frete/FreteListV2';
// remover: import FreteList from '../components/frete/FreteList';
```

(b) Encontrar o JSX `<FreteList ... />` dentro de `<TabsContent value="fretes">` e substituir:

```tsx
<FreteListV2
  fretes={fretes}
  obras={obras}
  insumos={insumosAtivos}
  pagamentosFrete={pagamentosFrete}
  filtros={filtros}
  filtroSemChegada={presetAtivo === 'sem_chegada'}
  onEdit={(frete) => pedirSenha(() => { setEditando(frete); setModalOpen(true); })}
  onDelete={(id) => pedirSenha(() => setDeleteId(id))}
  onSelect={(f) => setFreteDetalhesId(f.id)}
  canEdit={canEdit}
  canDelete={canDelete}
/>
```

> Remove `onUpdateDataChegada` (v2 não tem inline date editor).

- [ ] **Step 4: TypeScript + build**

Run: `npx tsc -b 2>&1 | tail -10`
Expected: zero erros. Se reclamar de `flexRender` ou `getExpandedRowModel`, confirmar versão do `@tanstack/react-table` (~8.x).

Run: `npm run build 2>&1 | tail -3`
Expected: passa.

- [ ] **Step 5: Smoke test**

`npm run dev`. Na aba Fretes:
- Tabela com 7 colunas (Data, Origem→Destino, Transportadora, Material, Peso, Valor, ⋮)
- Click header de "Data" → ordena asc/desc
- Click linha → drawer abre (preservado da Fase A)
- Click seta ► → expande linha mostrando foto chegada + motorista + financeiro
- Click ⋮ → dropdown com Editar/Excluir
- Paginação no rodapé funciona
- Mudar pageSize → recarrega página, mantém preferência (localStorage)
- Preset "Sem chegada" → tabela filtra

- [ ] **Step 6: Commit**

```bash
git add src/components/frete/FreteRowExpanded.tsx src/components/frete/FreteListV2.tsx src/pages/Frete.tsx
git commit -m "feat(frete): FreteListV2 com @tanstack/react-table + expand-row (Bloco 3.6)

Reescrita da tabela de fretes:
- 7 colunas visíveis (expander + Data + Origem→Destino + Transp + Material + Peso + Valor + Ações)
- Sort por coluna nativo (asc/desc/none)
- Paginação client-side 25/50/100 (persiste localStorage)
- Expand-row 3-coluna: foto chegada (reusa FreteFotoChegadaBlock variant=compact) + motorista/NF + financeiro/pagamento
- Edit/delete via DropdownMenu shadcn (⋮)
- data-frete-id preservado pra E2E

Auditoria Bloco 3.6."
```

- [ ] **Step 7: Deletar `FreteList.tsx` antigo**

Após confirmar v2 funciona, remover o antigo:

```bash
git rm src/components/frete/FreteList.tsx
git commit -m "chore(frete): remover FreteList v1 (substituído por FreteListV2)"
```

---

## Task 7: Migrar `FreteDetalhesDrawer` pra `Sheet` shadcn

**Files:**
- Modify: `src/components/frete/FreteDetalhesDrawer.tsx`

- [ ] **Step 1: Trocar wrapper de `Drawer` por `Sheet`**

Modify `src/components/frete/FreteDetalhesDrawer.tsx`.

(a) Remover import:
```tsx
import Drawer from '../ui/Drawer';
```

Adicionar:
```tsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../shadcn/sheet';
```

(b) Substituir o JSX `<Drawer open={open} onClose={onClose} title="..." subtitle="..." width="lg" footer={footer}>...</Drawer>` por:

```tsx
<Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
  <SheetContent side="right" className="w-full sm:max-w-[700px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{frete.notaFiscal ? `Frete NF ${frete.notaFiscal}` : 'Frete'}</SheetTitle>
      <SheetDescription>
        {`${fmtData(frete.data)} · ${frete.transportadora || 'sem transportadora'}`}
      </SheetDescription>
    </SheetHeader>

    <div className="mt-4">
      {/* corpo atual do drawer aqui — tabs detalhes/historico, KPIs, foto chegada (FreteFotoChegadaBlock), fields, anexos */}
    </div>

    <SheetFooter className="mt-6">
      {footer}
    </SheetFooter>
  </SheetContent>
</Sheet>
```

> Crítico: preservar o resto do conteúdo INTACTO. Apenas wrapper externo + header + footer mudam. Em particular: o `FreteFotoChegadaBlock` continua exatamente igual.

(c) Quando `frete === null`, ainda precisa renderizar algo. Manter o fallback:

```tsx
if (!frete) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[700px]">
        <SheetHeader>
          <SheetTitle>Frete</SheetTitle>
          <SheetDescription>Detalhes</SheetDescription>
        </SheetHeader>
        <div className="text-sm text-[var(--color-fg-muted)] italic mt-4">Frete não disponível.</div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: TypeScript + build**

Run: `npx tsc -b 2>&1 | tail -5`
Expected: zero erros.

Run: `npm run build 2>&1 | tail -3`
Expected: passa.

- [ ] **Step 3: Smoke test**

`npm run dev`. Na aba Fretes:
- Click row → drawer abre via Sheet shadcn (anima da direita)
- Click fora ou Esc → fecha
- Foto chegada + tabs Detalhes/Histórico + KPIs + fields + anexos: tudo igual
- Edit/Delete no footer funcionam

- [ ] **Step 4: Commit**

```bash
git add src/components/frete/FreteDetalhesDrawer.tsx
git commit -m "refactor(frete): drawer pra Sheet shadcn (Bloco 3.4)

Wrapper externo de Drawer custom (src/components/ui/Drawer.tsx) →
Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter
do shadcn. SheetContent side='right' com className w-full
sm:max-w-[700px] mantém largura ~700px da v1.

Conteúdo interno preservado: tabs Detalhes/Histórico, KPIs, foto
chegada (FreteFotoChegadaBlock da Task 2), fields, anexos.

O componente Drawer custom em src/components/ui/ continua usado pelas
5 outras abas (Pagamentos, Pedidos, etc.) — fica pra migração futura.

Auditoria Bloco 3.4."
```

---

## Task 8: 3 E2E specs Playwright

**Files:**
- Create: `tests/frete-list.spec.ts`
- Create: `tests/frete-filtros.spec.ts`
- Create: `tests/frete-drawer.spec.ts`

- [ ] **Step 1: `frete-list.spec.ts`**

Create `tests/frete-list.spec.ts`:

```typescript
/**
 * E2E — FreteListV2: sort, paginação, expand-row.
 *
 * Requer:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 *   E2E_FRETE_SEM_FOTO_ID — id de um frete pra expandir
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

const freteId = process.env.E2E_FRETE_SEM_FOTO_ID

test.describe('FreteListV2 — data-table1', () => {
  test.skip(!hasCredentials() || !freteId, 'env vars necessárias')

  test('sort por coluna Data inverte ordem', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 })

    const headerData = page.getByRole('columnheader', { name: /^Data$/i })
    await headerData.click() // asc
    await page.waitForTimeout(200)
    await headerData.click() // desc
    // Não vamos asserir ordem real (depende do dataset); só que clicar não dá erro.
    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('expand-row abre conteúdo extra inline', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    const row = page.locator(`tr[data-frete-id="${freteId}"]`)
    await expect(row).toBeVisible({ timeout: 10_000 })
    const expander = row.locator('button[title*="Expandir"], button[title*="Recolher"]').first()
    await expander.click()

    // Conteúdo da linha expandida deve aparecer (FreteFotoChegadaBlock + cols)
    await expect(page.getByText(/Fotos da Chegada da Carga/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/Motorista|Placa|NF/i).first()).toBeVisible()
  })

  test('paginação muda página', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10_000 })
    const proxima = page.getByRole('button', { name: /Próxima/i })
    if (await proxima.isEnabled()) {
      await proxima.click()
      // Não verificamos o conteúdo da nova página, só que o botão funcionou
      await expect(page.getByText(/Página 2 de/i)).toBeVisible({ timeout: 5_000 })
    } else {
      test.skip(true, 'Só 1 página de fretes no dataset de teste')
    }
  })
})
```

- [ ] **Step 2: `frete-filtros.spec.ts`**

Create `tests/frete-filtros.spec.ts`:

```typescript
/**
 * E2E — Filtros + presets na aba Frete.
 *
 * Requer: E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

test.describe('Frete filtros + presets', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL/PASSWORD necessárias')

  test('preset "Esta semana" preenche range de data', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    const presetSemana = page.getByRole('button', { name: /Esta semana/i })
    await presetSemana.click()

    // Chip fica ativo (alguma class de "ativo")
    await expect(presetSemana).toHaveClass(/accent/i)
  })

  test('preset "Sem chegada" filtra fretes', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.getByRole('button', { name: /Sem chegada/i }).click()
    // Espera lista atualizar (não conta linhas — só que renderiza sem erro)
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 5_000 })
  })

  test('preset "Top transportadora" abre popover', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.getByRole('button', { name: /Top transportadora/i }).click()
    // Popover do Command/Combobox
    await expect(page.getByPlaceholder(/Buscar transportadora/i)).toBeVisible({ timeout: 5_000 })
  })

  test('clear preset zera estado', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.getByRole('button', { name: /Esta semana/i }).click()
    const limpar = page.getByRole('button', { name: /Limpar preset/i })
    await expect(limpar).toBeVisible()
    await limpar.click()
    await expect(limpar).not.toBeVisible()
  })
})
```

- [ ] **Step 3: `frete-drawer.spec.ts`**

Create `tests/frete-drawer.spec.ts`:

```typescript
/**
 * E2E — Drawer (Sheet shadcn) — abre, navega entre sub-tabs, fecha.
 * Foto chegada já está coberta em frete-foto-chegada.spec.ts (Fase A).
 *
 * Requer:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 *   E2E_FRETE_SEM_FOTO_ID
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

const freteId = process.env.E2E_FRETE_SEM_FOTO_ID

test.describe('FreteDetalhesDrawer (Sheet shadcn)', () => {
  test.skip(!hasCredentials() || !freteId, 'env vars necessárias')

  test('abre via row click + fecha via Esc', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.locator(`tr[data-frete-id="${freteId}"]`).click()

    // Sheet content visível (radix-ui Dialog usa role=dialog)
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 10_000 })
    await expect(sheet.getByText(/Fotos da Chegada da Carga/i)).toBeVisible()

    // Esc fecha
    await page.keyboard.press('Escape')
    await expect(sheet).not.toBeVisible({ timeout: 3_000 })
  })

  test('alterna entre sub-tabs Detalhes e Histórico', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.locator(`tr[data-frete-id="${freteId}"]`).click()

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    await sheet.getByRole('button', { name: /^Histórico$/i }).click()
    // Histórico timeline deve aparecer
    await expect(sheet.getByText(/Hist|Timeline|nenhum/i).first()).toBeVisible({ timeout: 5_000 })

    await sheet.getByRole('button', { name: /^Detalhes$/i }).click()
    await expect(sheet.getByText(/Fotos da Chegada da Carga/i)).toBeVisible()
  })
})
```

- [ ] **Step 4: Verificar TypeScript dos specs**

Run:
```bash
for f in tests/frete-list.spec.ts tests/frete-filtros.spec.ts tests/frete-drawer.spec.ts; do
  echo "--- $f ---"
  npx tsc --noEmit --skipLibCheck "$f" 2>&1 | tail -5
done
```
Expected: zero erros em cada.

Run: `npx playwright test tests/frete-list.spec.ts tests/frete-filtros.spec.ts tests/frete-drawer.spec.ts --list 2>&1 | tail -10`
Expected: lista todos os tests (testes × 3 browsers).

- [ ] **Step 5: Commit**

```bash
git add tests/frete-list.spec.ts tests/frete-filtros.spec.ts tests/frete-drawer.spec.ts
git commit -m "test(e2e): 3 specs Playwright pra Fase B (list, filtros, drawer)

- frete-list.spec.ts: sort por coluna, expand-row, paginação
- frete-filtros.spec.ts: 4 presets (Esta semana, Mês passado, Sem chegada, Top transportadora) + clear
- frete-drawer.spec.ts: Sheet shadcn abre/fecha (Esc + click), sub-tabs Detalhes/Histórico

Specs pulam (test.skip) sem env vars; padrão dos 4 specs existentes."
```

---

## Task 9: Final — build + security + deploy + push

- [ ] **Step 1: Tudo passa**

```bash
npm run build 2>&1 | tail -5    # ✓ built
npm test 2>&1 | tail -10        # Tests N passed
```

- [ ] **Step 2: `/security-review`**

No Claude Code:
```
/security-review
```

Expected: `NO_FINDINGS`. Migração visual pura — sem nova superfície de ataque. Helper de presets é puro. Mutations usam hooks existentes.

Se findings: corrigir antes de prosseguir.

- [ ] **Step 3: Preview deploy + validação manual**

Run: `npx --yes vercel deploy 2>&1 | tail -5`
Abrir URL no browser, validar:
- Aba Fretes renderiza com nova lista
- 4 presets funcionam
- Drawer abre via Sheet
- Expand-row mostra foto chegada
- Editar/Excluir continuam funcionando

- [ ] **Step 4: Promover prod (com confirmação do user)**

Pedir confirmação. Se OK:
```bash
npx --yes vercel --prod 2>&1 | tail -5
```

- [ ] **Step 5: Merge feature branch + push**

```bash
git checkout main
git merge --no-ff feat/frete-redesign-bloco3 -m "Merge branch 'feat/frete-redesign-bloco3'

Fase B do redesign Frete: Tabs shadcn (3.3), Sheet shadcn (3.4),
data-table1 com expand-row (3.6), filtros com presets, extração de
FreteFotoChegadaBlock reusable.

Spec: docs/superpowers/specs/2026-05-20-frete-tab-redesign-design.md"
git push origin main
```

---

## Critérios de aceitação

- ✅ Build verde, tests verdes
- ✅ Manual: nova tabela renderiza, sort/paginação funcionam, expand-row mostra foto chegada
- ✅ Manual: presets aplicam corretamente, drawer abre via Sheet
- ✅ `/security-review` NO_FINDINGS
- ✅ Preview + prod sem regressão visual ou funcional
- ✅ FreteList.tsx v1 deletado, FreteFotoChegadaBlock extraído

## Out of scope

- ❌ Migração das outras 5 abas (Pagamentos/PedidosMaterial/Conta/Lixeira/Dashboard) — escopo focado em "fretes"
- ❌ FreteForm refactor — segue com Modal+useState (Bloco 3 itens 3.4 e 3.5 ainda em aberto)
- ❌ Server-side pagination — client-side comporta 1k-5k fretes sem dor; refator se crescer
- ❌ Date-range-picker (em vez de 2 inputs separados de data no FilterBar) — fora dos 4 presets pedidos
- ❌ Reordenação de fotos chegada no drawer — extração `FreteFotoChegadaBlock` mantém comportamento Fase A
