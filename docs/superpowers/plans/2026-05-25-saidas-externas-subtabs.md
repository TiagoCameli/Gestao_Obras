# Saídas: sub-tabs Todas/Internas/Externas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subdividir a aba "Saídas" do módulo Combustível em 3 sub-tabs (Todas / Internas / Externas) com filtro de origem (`dinheiro` / `requisicao` / `tanque_externo`) na sub-tab Externas. Estado persistido na URL via `FilterContext` v2.

**Architecture:** Estender o `CombustivelFilterState` com duas chaves novas (`saidasView`, `origensExterna`) serializadas via `urlState.ts`. Extrair função pura `filterSaidasByView` testável. Render shadcn `Tabs` + segmented control acima da `SaidaCombustivelListV2`, conforme padrão v2 do módulo.

**Tech Stack:** React + TypeScript, vitest pra testes unitários, shadcn (`Tabs`), `react-router-dom` (URL state), Zod (schemas existentes).

**Spec:** `docs/superpowers/specs/2026-05-25-saidas-externas-subtabs-design.md`

---

## File Structure

**Modify:**
- `src/components/combustivel/v2/filters/types.ts` — adicionar `saidasView`, `origensExterna` ao `CombustivelFilterState`.
- `src/components/combustivel/v2/filters/urlState.ts` — `default`/`from`/`to` SearchParams + `hasActiveFilters`.
- `src/components/combustivel/v2/filters/FilterContext.tsx` — novos setters, `ChipKind`, `removeFilter`.
- `src/components/combustivel/v2/filters/FilterChips.tsx` — chips `saidas_view` e `origem_externa`.
- `src/components/frota/combustivel/FrotaCombustivelContainer.tsx` — Tabs shadcn + segmented control + filtragem.

**Create:**
- `src/components/combustivel/v2/filters/urlState.test.ts` — round-trip + parse defensivo das chaves novas.
- `src/components/combustivel/v2/saidas/filterSaidasByView.ts` — função pura de filtragem por view.
- `src/components/combustivel/v2/saidas/filterSaidasByView.test.ts` — matriz de testes.

---

## Task 1: Tipos — estender `CombustivelFilterState`

**Files:**
- Modify: `src/components/combustivel/v2/filters/types.ts`

- [ ] **Step 1: Adicionar tipos `SaidasView` e `OrigemExterna`**

No fim de `types.ts`, antes de `SavedView`:

```ts
/** Sub-divisão da aba Saídas. Aplica somente em subTab='saidas'.
 *  'todas' = sem filtro adicional (default).
 *  'internas' = origem='tanque' && deposito.ehExterno=false.
 *  'externas' = origem='dinheiro' || origem='requisicao' ||
 *               (origem='tanque' && deposito.ehExterno=true). */
export type SaidasView = 'todas' | 'internas' | 'externas';

/** Origem derivada pra subset de saídas externas. */
export type OrigemExterna = 'dinheiro' | 'requisicao' | 'tanque_externo';
```

- [ ] **Step 2: Adicionar campos ao `CombustivelFilterState`**

No interface `CombustivelFilterState`, após `apenasSentinel`:

```ts
  /** Sub-divisão da aba Saídas. Persiste na URL mas só tem efeito quando
   *  subTab='saidas'. Default 'todas' preserva comportamento legado. */
  saidasView: SaidasView;
  /** Subset opcional dentro de saidasView='externas'. Vazio = todas as 3
   *  origens externas. Ignorado quando saidasView !== 'externas'. */
  origensExterna: OrigemExterna[];
```

- [ ] **Step 3: Verificar typecheck**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit 2>&1 | head -40`
Expected: erros referentes a `defaultFilterState`, `fromSearchParams`, `toSearchParams`, `hasActiveFilters` em `urlState.ts` por não preencher as novas chaves. Esperado e será resolvido na Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/components/combustivel/v2/filters/types.ts
git commit -m "feat(combustivel): adiciona SaidasView e OrigemExterna ao filter state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: URL serialization — `urlState.ts` + testes

**Files:**
- Create: `src/components/combustivel/v2/filters/urlState.test.ts`
- Modify: `src/components/combustivel/v2/filters/urlState.ts`

- [ ] **Step 1: Escrever testes que falham**

Criar `src/components/combustivel/v2/filters/urlState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  defaultFilterState,
  fromSearchParams,
  hasActiveFilters,
  toSearchParams,
} from './urlState';

describe('urlState — saidasView + origensExterna', () => {
  it('default state tem saidasView=todas e origensExterna=[]', () => {
    const s = defaultFilterState();
    expect(s.saidasView).toBe('todas');
    expect(s.origensExterna).toEqual([]);
  });

  it('parse de ?sview=externas&sextorigens=dinheiro,requisicao', () => {
    const p = new URLSearchParams('sview=externas&sextorigens=dinheiro,requisicao');
    const s = fromSearchParams(p);
    expect(s.saidasView).toBe('externas');
    expect(s.origensExterna).toEqual(['dinheiro', 'requisicao']);
  });

  it('parse de valor inválido em sview cai no default todas', () => {
    const p = new URLSearchParams('sview=xyz');
    const s = fromSearchParams(p);
    expect(s.saidasView).toBe('todas');
  });

  it('parse de origens externas filtra valores inválidos', () => {
    const p = new URLSearchParams('sview=externas&sextorigens=dinheiro,foo,tanque_externo');
    const s = fromSearchParams(p);
    expect(s.origensExterna).toEqual(['dinheiro', 'tanque_externo']);
  });

  it('serializa state com saidasView=externas e origensExterna=[dinheiro]', () => {
    const s = { ...defaultFilterState(), saidasView: 'externas' as const, origensExterna: ['dinheiro' as const] };
    const p = toSearchParams(s);
    expect(p.get('sview')).toBe('externas');
    expect(p.get('sextorigens')).toBe('dinheiro');
  });

  it('NÃO serializa saidasView=todas (default)', () => {
    const s = defaultFilterState();
    const p = toSearchParams(s);
    expect(p.get('sview')).toBeNull();
    expect(p.get('sextorigens')).toBeNull();
  });

  it('round-trip preserva saidasView e origensExterna', () => {
    const original = {
      ...defaultFilterState(),
      saidasView: 'externas' as const,
      origensExterna: ['dinheiro' as const, 'tanque_externo' as const],
    };
    const serialized = toSearchParams(original);
    const parsed = fromSearchParams(serialized);
    expect(parsed.saidasView).toBe('externas');
    expect(parsed.origensExterna).toEqual(['dinheiro', 'tanque_externo']);
  });

  it('hasActiveFilters true quando saidasView !== todas mesmo sem outros filtros', () => {
    const s = { ...defaultFilterState(), saidasView: 'externas' as const };
    expect(hasActiveFilters(s)).toBe(true);
  });

  it('hasActiveFilters true quando origensExterna tem itens', () => {
    const s = { ...defaultFilterState(), origensExterna: ['dinheiro' as const] };
    expect(hasActiveFilters(s)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/components/combustivel/v2/filters/urlState.test.ts 2>&1 | tail -20`
Expected: FAIL — `saidasView`/`origensExterna` undefined, ou propriedades ausentes em `defaultFilterState`.

- [ ] **Step 3: Atualizar `urlState.ts`**

Adicionar imports no topo (substituir a linha de import existente):

```ts
import type { CombustivelFilterState, ConsumidorMode, OrigemExterna, PeriodoPreset, SaidasView } from './types';
```

Adicionar constantes após `PRESETS`:

```ts
const SAIDAS_VIEWS: SaidasView[] = ['todas', 'internas', 'externas'];
const ORIGENS_EXTERNA: OrigemExterna[] = ['dinheiro', 'requisicao', 'tanque_externo'];

function parseOrigensExterna(s: string | null): OrigemExterna[] {
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is OrigemExterna => ORIGENS_EXTERNA.includes(x as OrigemExterna));
}
```

Em `defaultFilterState`, antes do `};` final, adicionar:

```ts
    saidasView: 'todas',
    origensExterna: [],
```

Em `fromSearchParams`, antes do `};` final, adicionar:

```ts
    saidasView: SAIDAS_VIEWS.includes(params.get('sview') as SaidasView)
      ? (params.get('sview') as SaidasView)
      : 'todas',
    origensExterna: parseOrigensExterna(params.get('sextorigens')),
```

Em `toSearchParams`, antes do `return p;`, adicionar:

```ts
  if (s.saidasView !== 'todas') p.set('sview', s.saidasView);
  if (s.origensExterna.length) p.set('sextorigens', listToParam(s.origensExterna));
```

Em `hasActiveFilters`, adicionar ao OR final (antes do `);`):

```ts
    || s.saidasView !== 'todas'
    || s.origensExterna.length > 0
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/components/combustivel/v2/filters/urlState.test.ts 2>&1 | tail -15`
Expected: 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/combustivel/v2/filters/urlState.ts src/components/combustivel/v2/filters/urlState.test.ts
git commit -m "feat(combustivel): serializa saidasView e origensExterna na URL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: FilterContext — setters + ChipKind + removeFilter

**Files:**
- Modify: `src/components/combustivel/v2/filters/FilterContext.tsx`

- [ ] **Step 1: Atualizar imports de types**

Substituir a linha de import de tipos no topo:

```ts
import type { CombustivelFilterState, ConsumidorMode, CrossHighlight, OrigemExterna, PeriodoPreset, SaidasView } from './types';
```

- [ ] **Step 2: Estender `ChipKind`**

No `export type ChipKind` (linha ~66), adicionar antes do `;` final:

```ts
  | 'saidas_view'
  | 'origem_externa'
```

- [ ] **Step 3: Adicionar tipos no `FilterContextValue`**

Após `setApenasSentinel`, adicionar:

```ts
  setSaidasView: (v: SaidasView) => void;
  toggleOrigemExterna: (o: OrigemExterna) => void;
  setOrigensExterna: (arr: OrigemExterna[]) => void;
```

- [ ] **Step 4: Implementar setters no provider**

Após a linha do `setApenasSentinel` (procurar `const setApenasSentinel = useCallback(...)`), adicionar:

```ts
  const setSaidasView = useCallback((v: SaidasView) => apply({ ...state, saidasView: v }), [state, apply]);
  const toggleOrigemExterna = useCallback(
    (o: OrigemExterna) => {
      const arr = state.origensExterna.includes(o)
        ? state.origensExterna.filter((x) => x !== o)
        : [...state.origensExterna, o];
      apply({ ...state, origensExterna: arr });
    },
    [state, apply],
  );
  const setOrigensExterna = useCallback((arr: OrigemExterna[]) => apply({ ...state, origensExterna: arr }), [state, apply]);
```

- [ ] **Step 5: Adicionar cases no `removeFilter`**

Dentro do `switch (kind)` em `removeFilter`, antes do `}` que fecha o switch, adicionar:

```ts
        case 'saidas_view':
          apply({ ...state, saidasView: 'todas' });
          break;
        case 'origem_externa':
          apply({ ...state, origensExterna: state.origensExterna.filter((x) => x !== value) });
          break;
```

- [ ] **Step 6: Adicionar ao `useMemo` value**

No objeto retornado pelo `useMemo` (próximo a `setApenasSentinel,`), incluir:

```ts
      setSaidasView,
      toggleOrigemExterna,
      setOrigensExterna,
```

E no array de dependências do `useMemo`, adicionar na lista:

```ts
      setSaidasView, toggleOrigemExterna, setOrigensExterna,
```

- [ ] **Step 7: Verificar typecheck**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit 2>&1 | grep -E "FilterContext|filters/" | head -20`
Expected: sem erros nos arquivos do FilterContext/filters.

- [ ] **Step 8: Commit**

```bash
git add src/components/combustivel/v2/filters/FilterContext.tsx
git commit -m "feat(combustivel): adiciona setters de saidasView/origensExterna no FilterContext

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Função pura `filterSaidasByView` + testes

**Files:**
- Create: `src/components/combustivel/v2/saidas/filterSaidasByView.ts`
- Create: `src/components/combustivel/v2/saidas/filterSaidasByView.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Criar `src/components/combustivel/v2/saidas/filterSaidasByView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { SaidaCombustivel } from '../../../../types';
import { filterSaidasByView } from './filterSaidasByView';

function makeSaida(overrides: Partial<SaidaCombustivel>): SaidaCombustivel {
  return {
    id: 'sd-' + Math.random().toString(36).slice(2, 8),
    data: '2026-05-20T10:00',
    origem: 'tanque',
    tipoConsumidor: 'equipamento_proprio',
    tanqueId: 'tk-int-1',
    equipamentoId: 'eq-1',
    transportadoraId: '',
    placa: '',
    obraId: 'obra-1',
    etapaId: '',
    tipoCombustivel: 'ins-diesel',
    litros: 100,
    taxaLitro: 0,
    precoUnitarioManual: 0,
    precoCombustivel: 0,
    precoCombustivelAreacre: 0,
    motorista: '',
    medicaoLeitura: '',
    observacoes: '',
    pago: false,
    pagoEm: '',
    criadoEm: '',
    ...overrides,
  } as SaidaCombustivel;
}

const tanquesExternosSet = new Set(['tk-ext-1']);
const sTanqueInt = makeSaida({ origem: 'tanque', tanqueId: 'tk-int-1' });
const sTanqueExt = makeSaida({ origem: 'tanque', tanqueId: 'tk-ext-1' });
const sDinheiro = makeSaida({ origem: 'dinheiro', tanqueId: '' });
const sRequisicao = makeSaida({ origem: 'requisicao', tanqueId: '' });
const todas = [sTanqueInt, sTanqueExt, sDinheiro, sRequisicao];

describe('filterSaidasByView', () => {
  it('view=todas retorna tudo', () => {
    const out = filterSaidasByView(todas, 'todas', [], tanquesExternosSet);
    expect(out).toEqual(todas);
  });

  it('view=internas só tanque interno', () => {
    const out = filterSaidasByView(todas, 'internas', [], tanquesExternosSet);
    expect(out).toEqual([sTanqueInt]);
  });

  it('view=externas (sem origensExterna) inclui dinheiro+requisicao+tanque externo', () => {
    const out = filterSaidasByView(todas, 'externas', [], tanquesExternosSet);
    expect(out).toEqual([sTanqueExt, sDinheiro, sRequisicao]);
  });

  it('view=externas + origensExterna=[dinheiro] só dinheiro', () => {
    const out = filterSaidasByView(todas, 'externas', ['dinheiro'], tanquesExternosSet);
    expect(out).toEqual([sDinheiro]);
  });

  it('view=externas + origensExterna=[dinheiro,tanque_externo]', () => {
    const out = filterSaidasByView(todas, 'externas', ['dinheiro', 'tanque_externo'], tanquesExternosSet);
    expect(out).toEqual([sTanqueExt, sDinheiro]);
  });

  it('view=externas + origensExterna=[requisicao]', () => {
    const out = filterSaidasByView(todas, 'externas', ['requisicao'], tanquesExternosSet);
    expect(out).toEqual([sRequisicao]);
  });

  it('view=internas ignora saida origem=tanque sem tanqueId', () => {
    const saidaSemTanque = makeSaida({ origem: 'tanque', tanqueId: '' });
    const out = filterSaidasByView([saidaSemTanque], 'internas', [], tanquesExternosSet);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar (arquivo não existe)**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/components/combustivel/v2/saidas/filterSaidasByView.test.ts 2>&1 | tail -10`
Expected: FAIL — `Failed to load url ./filterSaidasByView`.

- [ ] **Step 3: Implementar `filterSaidasByView.ts`**

Criar `src/components/combustivel/v2/saidas/filterSaidasByView.ts`:

```ts
import type { SaidaCombustivel } from '../../../../types';
import type { OrigemExterna, SaidasView } from '../filters/types';

function ehTanqueExterno(s: SaidaCombustivel, tanquesExternosSet: Set<string>): boolean {
  return s.origem === 'tanque' && !!s.tanqueId && tanquesExternosSet.has(s.tanqueId);
}

function origemExternaDe(s: SaidaCombustivel, tanquesExternosSet: Set<string>): OrigemExterna | null {
  if (s.origem === 'dinheiro') return 'dinheiro';
  if (s.origem === 'requisicao') return 'requisicao';
  if (ehTanqueExterno(s, tanquesExternosSet)) return 'tanque_externo';
  return null;
}

export function filterSaidasByView(
  saidas: SaidaCombustivel[],
  view: SaidasView,
  origensExterna: OrigemExterna[],
  tanquesExternosSet: Set<string>,
): SaidaCombustivel[] {
  if (view === 'todas') return saidas;
  if (view === 'internas') {
    return saidas.filter(
      (s) => s.origem === 'tanque' && !!s.tanqueId && !tanquesExternosSet.has(s.tanqueId),
    );
  }
  // view === 'externas'
  return saidas.filter((s) => {
    const o = origemExternaDe(s, tanquesExternosSet);
    if (!o) return false;
    if (origensExterna.length === 0) return true;
    return origensExterna.includes(o);
  });
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/components/combustivel/v2/saidas/filterSaidasByView.test.ts 2>&1 | tail -15`
Expected: 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/combustivel/v2/saidas/filterSaidasByView.ts src/components/combustivel/v2/saidas/filterSaidasByView.test.ts
git commit -m "feat(combustivel): função pura filterSaidasByView com testes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: UI — sub-tabs Tabs shadcn + segmented control + filtragem

**Files:**
- Modify: `src/components/frota/combustivel/FrotaCombustivelContainer.tsx`

- [ ] **Step 1: Adicionar imports**

No topo do arquivo, junto aos outros imports v2 (após `import ModeSwitch from '../../combustivel/v2/ModeSwitch';`):

```ts
import { Tabs, TabsList, TabsTrigger } from '../../shadcn/tabs';
import { filterSaidasByView } from '../../combustivel/v2/saidas/filterSaidasByView';
import type { OrigemExterna, SaidasView } from '../../combustivel/v2/filters/types';
```

- [ ] **Step 2: Pegar novos setters do hook**

Na desestruturação `const { state: filterState, setApenasSentinel } = useCombustivelFilter();`, expandir pra:

```ts
const { state: filterState, setApenasSentinel, setSaidasView, toggleOrigemExterna } = useCombustivelFilter();
```

- [ ] **Step 3: Computar `tanquesExternosSet` memoizado**

Logo após `const tanquesMap = useMemo(...)` (perto da linha 378), adicionar:

```ts
  const tanquesExternosSet = useMemo(
    () => new Set(depositosTodos.filter((d) => d.ehExterno).map((d) => d.id)),
    [depositosTodos],
  );
```

- [ ] **Step 4: Reestruturar a memo `saidasFiltradas`**

Substituir o bloco `const saidasFiltradas = useMemo(...)` por DOIS memos. O primeiro mantém a lógica atual de filtros globais (mesmo corpo, só renomear); o segundo aplica `filterSaidasByView`:

```ts
  const saidasFiltradasGlobais = useMemo(() => {
    return todasSaidas.filter((s) => {
      if (s.tipoConsumidor !== tipoConsumidorAlvo) return false;
      if (!dentroPeriodo(s.data)) return false;
      if (filterState.obraIds.length > 0 && !(s.obraId && filterState.obraIds.includes(s.obraId))) return false;
      if (filterState.tipoCombustiveis.length > 0 && !filterState.tipoCombustiveis.includes(s.tipoCombustivel)) return false;
      if (filterState.tanqueIds.length > 0 && !(s.tanqueId && filterState.tanqueIds.includes(s.tanqueId))) return false;
      if (filterState.apenasSentinel) {
        if (s.equipamentoId !== 'desconhecido') return false;
      } else if (filterState.equipamentoIds.length > 0) {
        if (!s.equipamentoId || !filterState.equipamentoIds.includes(s.equipamentoId)) return false;
      }
      if (filterState.transportadoraIds.length > 0) {
        if (!s.transportadoraId || !filterState.transportadoraIds.includes(s.transportadoraId)) return false;
      }
      if (filterState.placas.length > 0) {
        const placa = (s.placa || '').trim();
        if (!placa || !filterState.placas.includes(placa)) return false;
      }
      if (filterState.operadores.length > 0) {
        const op = (s.motorista || '').trim();
        if (!op || !filterState.operadores.includes(op)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasSaidas, tipoConsumidorAlvo, periodoFromTs, periodoToTs, filterState.obraIds, filterState.tipoCombustiveis, filterState.tanqueIds, filterState.equipamentoIds, filterState.transportadoraIds, filterState.placas, filterState.operadores, filterState.apenasSentinel]);

  const saidasFiltradas = useMemo(
    () =>
      filterSaidasByView(
        saidasFiltradasGlobais,
        filterState.saidasView,
        filterState.origensExterna,
        tanquesExternosSet,
      ),
    [saidasFiltradasGlobais, filterState.saidasView, filterState.origensExterna, tanquesExternosSet],
  );

  const saidasCountByView = useMemo(() => {
    let internas = 0;
    let externas = 0;
    for (const s of saidasFiltradasGlobais) {
      if (s.origem === 'tanque' && !!s.tanqueId && !tanquesExternosSet.has(s.tanqueId)) {
        internas++;
      } else if (
        s.origem === 'dinheiro' ||
        s.origem === 'requisicao' ||
        (s.origem === 'tanque' && !!s.tanqueId && tanquesExternosSet.has(s.tanqueId))
      ) {
        externas++;
      }
    }
    return { todas: saidasFiltradasGlobais.length, internas, externas };
  }, [saidasFiltradasGlobais, tanquesExternosSet]);
```

- [ ] **Step 5: Renderizar sub-tabs + segmented control acima da lista**

Localizar o bloco `{!isLoadingCore && subTab === 'saidas' && (` (linha ~804). Substituir o JSX dentro do fragment `<>...</>` pra incluir as sub-tabs ANTES do banner sentinel:

```tsx
      {!isLoadingCore && subTab === 'saidas' && (
        <>
          <div className="mb-3 flex flex-col gap-2">
            <Tabs
              value={filterState.saidasView}
              onValueChange={(v) => setSaidasView(v as SaidasView)}
            >
              <TabsList variant="line">
                <TabsTrigger value="todas">
                  Todas <span className="ml-1 tabular-nums text-[var(--color-fg-subtle)]">({saidasCountByView.todas})</span>
                </TabsTrigger>
                <TabsTrigger value="internas">
                  Internas <span className="ml-1 tabular-nums text-[var(--color-fg-subtle)]">({saidasCountByView.internas})</span>
                </TabsTrigger>
                <TabsTrigger value="externas">
                  Externas <span className="ml-1 tabular-nums text-[var(--color-fg-subtle)]">({saidasCountByView.externas})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {filterState.saidasView === 'externas' && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[var(--color-fg-subtle)] mr-1">Origem:</span>
                {(['dinheiro', 'requisicao', 'tanque_externo'] as OrigemExterna[]).map((o) => {
                  const active = filterState.origensExterna.includes(o);
                  const label =
                    o === 'dinheiro' ? 'Dinheiro' : o === 'requisicao' ? 'Requisição' : 'Tanque Externo';
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => toggleOrigemExterna(o)}
                      className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                        active
                          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[var(--color-accent)]/30'
                          : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
                      }`}
                      aria-pressed={active}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* F2.B.2: toolbar inline pra atribuição retroativa em batch.
              Aparece só quando o usuário está olhando o subset sentinel
              (apenasSentinel=true) e em mode=proprios. */}
          {filterState.apenasSentinel && filterState.mode === 'proprios' && saidasFiltradas.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold tabular-nums">{saidasFiltradas.length}</span>{' '}
                saída{saidasFiltradas.length !== 1 ? 's' : ''} sem equipamento no escopo atual.
                Atribuir em lote economiza edição linha-a-linha.
              </div>
              <Button
                type="button"
                onClick={() => setModalAtribuirOpen(true)}
                className="text-sm inline-flex items-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4" />
                Atribuir todas em lote ({saidasFiltradas.length})
              </Button>
            </div>
          )}
          <SaidaCombustivelListV2
            saidas={saidasFiltradas}
            obras={obras}
            depositos={depositosTodos}
            equipamentos={todosEquipamentos}
            transportadoras={transportadoras}
            combustiveis={combustiveis}
            onEdit={handleEditSaida}
            onDelete={(id) => pedirSenha(() => handleDeleteSaida(id), {
              confirmMessage: 'Confirma exclusão desta saída? Ação não pode ser desfeita.',
              successMessage: 'Saída excluída.',
              errorMessage: 'Falha ao excluir saída. Verifique sua conexão e tente novamente.',
            })}
            onSelect={setSaidaDetalhes}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}
```

- [ ] **Step 6: Verificar typecheck**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit 2>&1 | grep -E "FrotaCombustivel|saidas/" | head -20`
Expected: sem erros.

- [ ] **Step 7: Rodar testes completos do módulo**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/components/combustivel/ src/components/combustivel/v2/saidas/ src/components/combustivel/v2/filters/ 2>&1 | tail -10`
Expected: todos passando.

- [ ] **Step 8: Commit**

```bash
git add src/components/frota/combustivel/FrotaCombustivelContainer.tsx
git commit -m "feat(combustivel): sub-tabs Todas/Internas/Externas na aba Saídas

Bloco 3.3 aplicado: usa Tabs shadcn em vez de componente custom.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Chips em `FilterChips.tsx`

**Files:**
- Modify: `src/components/combustivel/v2/filters/FilterChips.tsx`

- [ ] **Step 1: Adicionar chips após o bloco `apenasSentinel`**

Localizar o bloco:

```ts
  if (state.apenasSentinel) {
    chips.push({ kind: 'sentinel', value: '', label: 'Apenas sem equipamento' });
  }
```

Adicionar logo abaixo:

```ts
  if (state.saidasView !== 'todas') {
    const labelView = state.saidasView === 'internas' ? 'Internas' : 'Externas';
    chips.push({ kind: 'saidas_view', value: '', label: `Saídas: ${labelView}` });
  }
  for (const o of state.origensExterna) {
    const labelOrigem = o === 'dinheiro' ? 'Dinheiro' : o === 'requisicao' ? 'Requisição' : 'Tanque Externo';
    chips.push({ kind: 'origem_externa', value: o, label: `Origem: ${labelOrigem}` });
  }
```

- [ ] **Step 2: Verificar typecheck**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit 2>&1 | grep "FilterChips" | head -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/combustivel/v2/filters/FilterChips.tsx
git commit -m "feat(combustivel): chips para saidasView e origensExterna

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Verificação final + smoke test manual

**Files:** N/A (verificação)

- [ ] **Step 1: Rodar typecheck completo**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit 2>&1 | tail -15`
Expected: sem erros novos relacionados ao módulo combustivel.

- [ ] **Step 2: Rodar suite de testes completa do módulo**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/components/combustivel/ src/schemas/combustivel/ 2>&1 | tail -10`
Expected: todos passando.

- [ ] **Step 3: Rodar lint**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx eslint src/components/combustivel/v2/filters/ src/components/combustivel/v2/saidas/ src/components/frota/combustivel/FrotaCombustivelContainer.tsx 2>&1 | tail -10`
Expected: sem erros novos. Warnings pre-existentes OK.

- [ ] **Step 4: Iniciar dev server e smoke test no browser**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npm run dev` (background).

Abrir `http://localhost:5173/combustivel` em browser. Cobrir manualmente:

1. Click na aba "Saídas" — sub-tabs "Todas / Internas / Externas" aparecem com counts.
2. Click "Internas" — tabela atualiza, count bate; URL ganha `?sview=internas`.
3. Click "Externas" — tabela atualiza, segmented control "Dinheiro / Requisição / Tanque Externo" aparece.
4. Click "Dinheiro" no segmented — tabela filtra; URL ganha `?sview=externas&sextorigens=dinheiro`; chip "Origem: Dinheiro" aparece no FilterChips.
5. Click "Requisição" no segmented — adiciona; URL `?sview=externas&sextorigens=dinheiro,requisicao`.
6. Copiar URL, abrir em nova aba — state preservado.
7. Click ✕ no chip "Origem: Dinheiro" — remove só essa origem; mantém "Requisição".
8. Click ✕ no chip "Saídas: Externas" — volta pra "Todas", segmented control some, URL limpa.
9. Click "Limpar tudo" em FilterChips — reseta tudo incluindo `saidasView` e `origensExterna`.
10. Trocar `mode` (próprios ↔ carretas) — `saidasView`/`origensExterna` preservados.

- [ ] **Step 5: Reportar se algum smoke test falhou**

Se algum passo falhar, criar issue/task de fix antes de fechar.

- [ ] **Step 6: Sem commit final adicional** — todos os commits já foram feitos nas tasks anteriores.

---

## Notes

- **Bloco 3.3:** sub-tabs usam `Tabs` shadcn (`src/components/shadcn/tabs.tsx`), conforme alerta do feedback `gestao-obras-bloco3-remind`.
- **Não aplicar versão Trechos** — esse feedback é só para `src/modules/rodotracker/`, não combustivel.
- **TDD:** Tasks 2 e 4 seguem write-test-first → falha → implementa → passa.
- **Commits frequentes:** cada task termina com commit isolado.
- **Sem cleanup adicional** — escopo focado, nenhum refactor lateral planejado.
