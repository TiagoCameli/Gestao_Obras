# Apontamento por Serviço em lote — % por horas de cada funcionário · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No lançamento em lote da aba Apontamento por Serviço, aplicar a porcentagem de cada serviço sobre as horas reais de cada funcionário, de modo que o dia de cada um feche 100%.

**Architecture:** Abordagem cirúrgica — só o modo lote muda. Lógica de rateio % → horas vai para um módulo puro (sem supabase) testável por unidade. A camada de dados ganha uma função `replaceApontamentosDoDiaPorPct`. O modal passa a tratar a unidade como % quando há mais de um funcionário e mostra prévia por pessoa. Modo individual, banco e folha intocados.

**Tech Stack:** React + TypeScript (Vite), Supabase JS, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-apontamento-servico-lote-percentual-design.md`

---

## File Structure

- **Create** `src/modules/apontamento/utils/apontamentoServicoPct.ts` — funções puras: `arred2`, `ratearHorasPorPct`, `montarRowsApontamentoPorPct`, tipo `LinhaServicoPct`. Sem import de supabase (pra ser testável sem env).
- **Create** `src/modules/apontamento/utils/apontamentoServicoPct.test.ts` — testes unitários das funções puras.
- **Modify** `src/modules/apontamento/utils/apontamentoServicoApi.ts` — adicionar `replaceApontamentosDoDiaPorPct` (wrapper async que usa o módulo puro). Re-exportar `LinhaServicoPct`.
- **Modify** `src/modules/apontamento/components/LancamentoServicoModal.tsx` — modo lote em %, validação, save por pct, prévia por pessoa.
- **No change** `src/modules/apontamento/components/ApontamentoServicoTab.tsx` — já faz multi-select e já passa `funcionarioIds` + `horasPorFunc` ao modal. Apenas conferir.

---

## Task 1: Rateio puro `ratearHorasPorPct`

**Files:**
- Create: `src/modules/apontamento/utils/apontamentoServicoPct.ts`
- Test: `src/modules/apontamento/utils/apontamentoServicoPct.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/apontamento/utils/apontamentoServicoPct.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ratearHorasPorPct } from './apontamentoServicoPct'

describe('ratearHorasPorPct', () => {
  it('60/40 sobre 8h fecha exatamente 8h', () => {
    const r = ratearHorasPorPct([60, 40], 8)
    expect(r).toEqual([4.8, 3.2])
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(8, 5)
  })

  it('60/40 sobre 6h fecha exatamente 6h', () => {
    const r = ratearHorasPorPct([60, 40], 6)
    expect(r).toEqual([3.6, 2.4])
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(6, 5)
  })

  it('drift de arredondamento: 3 fatias sobre 7h fecha 7h', () => {
    const r = ratearHorasPorPct([33.34, 33.33, 33.33], 7)
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(7, 5)
  })

  it('linha única 100% recebe todas as horas', () => {
    expect(ratearHorasPorPct([100], 8)).toEqual([8])
  })

  it('linhas com pct 0 recebem 0', () => {
    const r = ratearHorasPorPct([60, 40, 0], 8)
    expect(r[2]).toBe(0)
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(8, 5)
  })

  it('total de horas 0 retorna zeros', () => {
    expect(ratearHorasPorPct([60, 40], 0)).toEqual([0, 0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/apontamento/utils/apontamentoServicoPct.test.ts`
Expected: FAIL — `Failed to resolve import './apontamentoServicoPct'` (arquivo não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/apontamento/utils/apontamentoServicoPct.ts`:

```ts
import type { TipoApontamento } from './apontamentoServicoApi'

/** Arredonda pra 2 casas decimais. */
export function arred2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Dado um vetor de porcentagens (0..100) e um total de horas, devolve as horas
 * de cada posição (round2). A ÚLTIMA posição com pct > 0 absorve o drift de
 * arredondamento, garantindo que a soma seja exatamente round2(totalHoras).
 * Posições com pct <= 0 recebem 0.
 */
export function ratearHorasPorPct(pcts: number[], totalHoras: number): number[] {
  const total = arred2(Math.max(0, totalHoras))
  const horas = pcts.map((p) => (p > 0 ? arred2((p / 100) * total) : 0))
  if (total <= 0) return horas
  let ultimaAtiva = -1
  for (let i = 0; i < pcts.length; i++) if (pcts[i] > 0) ultimaAtiva = i
  if (ultimaAtiva >= 0) {
    const soma = horas.reduce((s, h) => s + h, 0)
    horas[ultimaAtiva] = arred2(horas[ultimaAtiva] + (total - soma))
  }
  return horas
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/apontamento/utils/apontamentoServicoPct.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/modules/apontamento/utils/apontamentoServicoPct.ts src/modules/apontamento/utils/apontamentoServicoPct.test.ts
git commit -m "feat(apont-servico): rateio puro de horas por porcentagem"
```

---

## Task 2: Montagem das rows `montarRowsApontamentoPorPct`

**Files:**
- Modify: `src/modules/apontamento/utils/apontamentoServicoPct.ts`
- Test: `src/modules/apontamento/utils/apontamentoServicoPct.test.ts`

- [ ] **Step 1: Write the failing test**

Adicione ao final de `src/modules/apontamento/utils/apontamentoServicoPct.test.ts`:

```ts
import { montarRowsApontamentoPorPct } from './apontamentoServicoPct'

describe('montarRowsApontamentoPorPct', () => {
  const linhas = [
    { servicoId: 'A', pct: 60, tipo: 'produtivo' as const, motivoImprodutivo: null, observacao: null },
    { servicoId: 'B', pct: 40, tipo: 'produtivo' as const, motivoImprodutivo: null, observacao: null },
  ]

  it('aplica a % nas horas reais de cada funcionário', () => {
    const rows = montarRowsApontamentoPorPct({
      funcionarioIds: ['f1', 'f2'],
      data: '2026-06-05',
      linhas,
      horasPorFunc: { f1: 8, f2: 6 },
      registradoPorId: 'u1',
    })
    expect(rows).toHaveLength(4)
    const f1 = rows.filter((r) => r.funcionario_id === 'f1')
    expect(f1.map((r) => r.horas)).toEqual([4.8, 3.2])
    const f2 = rows.filter((r) => r.funcionario_id === 'f2')
    expect(f2.map((r) => r.horas)).toEqual([3.6, 2.4])
    expect(rows[0]).toMatchObject({
      funcionario_id: 'f1', data: '2026-06-05', servico_id: 'A',
      tipo: 'produtivo', registrado_por_id: 'u1', motivo_improdutivo: null,
    })
  })

  it('pula funcionário sem horas de ponto', () => {
    const rows = montarRowsApontamentoPorPct({
      funcionarioIds: ['f1', 'fZero'],
      data: '2026-06-05',
      linhas,
      horasPorFunc: { f1: 8, fZero: 0 },
      registradoPorId: null,
    })
    expect(rows.every((r) => r.funcionario_id === 'f1')).toBe(true)
  })

  it('linha improdutiva: servico_id null e motivo preenchido', () => {
    const rows = montarRowsApontamentoPorPct({
      funcionarioIds: ['f1'],
      data: '2026-06-05',
      linhas: [{ servicoId: null, pct: 100, tipo: 'improdutivo', motivoImprodutivo: 'Chuva', observacao: null }],
      horasPorFunc: { f1: 8 },
      registradoPorId: 'u1',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ servico_id: null, tipo: 'improdutivo', motivo_improdutivo: 'Chuva', horas: 8 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/apontamento/utils/apontamentoServicoPct.test.ts`
Expected: FAIL — `montarRowsApontamentoPorPct is not a function` / import não resolve.

- [ ] **Step 3: Write minimal implementation**

Adicione ao final de `src/modules/apontamento/utils/apontamentoServicoPct.ts`:

```ts
/** Uma linha de serviço definida por porcentagem do dia (0..100). */
export interface LinhaServicoPct {
  servicoId: string | null
  pct: number
  tipo: TipoApontamento
  motivoImprodutivo?: string | null
  observacao?: string | null
}

/**
 * Monta as rows de apont_apontamentos_servico para um lançamento em lote por %.
 * Para cada funcionário, rateia as horas dele (horasPorFunc) entre as linhas
 * conforme a pct de cada uma. Pula funcionário sem horas e linhas que ficaram 0h.
 * Função pura — não toca no banco.
 */
export function montarRowsApontamentoPorPct(input: {
  funcionarioIds: string[]
  data: string
  linhas: LinhaServicoPct[]
  horasPorFunc: Record<string, number>
  registradoPorId: string | null
}): Record<string, unknown>[] {
  const pcts = input.linhas.map((l) => l.pct)
  const rows: Record<string, unknown>[] = []
  for (const fid of input.funcionarioIds) {
    const hf = input.horasPorFunc[fid] ?? 0
    if (hf <= 0) continue
    const horas = ratearHorasPorPct(pcts, hf)
    input.linhas.forEach((l, i) => {
      if (horas[i] <= 0) return
      rows.push({
        funcionario_id: fid,
        data: input.data,
        servico_id: l.tipo === 'improdutivo' ? null : l.servicoId,
        estaca_inicial: null,
        estaca_final: null,
        lado: null,
        horas: horas[i],
        tipo: l.tipo,
        motivo_improdutivo: l.tipo === 'improdutivo' ? l.motivoImprodutivo ?? null : null,
        observacao: l.observacao ?? null,
        registrado_por_id: input.registradoPorId,
      })
    })
  }
  return rows
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/apontamento/utils/apontamentoServicoPct.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/modules/apontamento/utils/apontamentoServicoPct.ts src/modules/apontamento/utils/apontamentoServicoPct.test.ts
git commit -m "feat(apont-servico): montar rows de apontamento por porcentagem"
```

---

## Task 3: Camada de dados `replaceApontamentosDoDiaPorPct`

**Files:**
- Modify: `src/modules/apontamento/utils/apontamentoServicoApi.ts`

- [ ] **Step 1: Adicionar import do módulo puro**

No topo de `src/modules/apontamento/utils/apontamentoServicoApi.ts`, logo após `import { supabase } from "../../../lib/supabase";`:

```ts
import {
  montarRowsApontamentoPorPct,
  type LinhaServicoPct,
} from "./apontamentoServicoPct";

export type { LinhaServicoPct } from "./apontamentoServicoPct";
```

- [ ] **Step 2: Adicionar a função wrapper**

Logo após a função `replaceApontamentosDoDia` existente (ela termina no `}` antes de `export async function excluirLancamentoDoDia`), adicione:

```ts
/**
 * Versão em lote por porcentagem: cada funcionário recebe a % de cada linha
 * aplicada sobre as horas reais DELE (horasPorFunc). Cada dia fecha 100%.
 * Substitui os apontamentos do dia (apaga e reinsere), igual replaceApontamentosDoDia.
 */
export async function replaceApontamentosDoDiaPorPct(input: {
  funcionarioIds: string[];
  data: string;
  linhas: LinhaServicoPct[];
  horasPorFunc: Record<string, number>;
}): Promise<void> {
  if (input.funcionarioIds.length === 0) return;

  const { error: delErr } = await supabase
    .from("apont_apontamentos_servico")
    .delete()
    .in("funcionario_id", input.funcionarioIds)
    .eq("data", input.data);
  throwIfError(delErr, "replacePct:delete");

  if (input.linhas.length === 0) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const rows = montarRowsApontamentoPorPct({
    funcionarioIds: input.funcionarioIds,
    data: input.data,
    linhas: input.linhas,
    horasPorFunc: input.horasPorFunc,
    registradoPorId: userId,
  });
  if (rows.length === 0) return;

  const { error: insErr } = await supabase
    .from("apont_apontamentos_servico")
    .insert(rows);
  throwIfError(insErr, "replacePct:insert");
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: sem erros (a função usa tipos já existentes; `throwIfError` já está no arquivo).

- [ ] **Step 4: Rodar os testes (garantir que nada quebrou)**

Run: `npm test`
Expected: PASS (incluindo os testes puros das Tasks 1-2; o módulo puro não importa supabase).

- [ ] **Step 5: Commit**

```bash
git add src/modules/apontamento/utils/apontamentoServicoApi.ts
git commit -m "feat(apont-servico): replaceApontamentosDoDiaPorPct na camada de dados"
```

---

## Task 4: Modal — lógica do modo lote (%, validação, save)

**Files:**
- Modify: `src/modules/apontamento/components/LancamentoServicoModal.tsx`

- [ ] **Step 1: Atualizar imports**

Substitua o bloco de import vindo de `../utils/apontamentoServicoApi` (linhas ~8-13):

De:
```ts
import {
  replaceApontamentosDoDia,
  type ApontamentoServico,
  type Servico,
  type TipoApontamento,
} from "../utils/apontamentoServicoApi";
```

Para:
```ts
import {
  replaceApontamentosDoDia,
  replaceApontamentosDoDiaPorPct,
  type ApontamentoServico,
  type Servico,
  type TipoApontamento,
} from "../utils/apontamentoServicoApi";
```

(O import de `ratearHorasPorPct` entra na Task 5, quando a prévia passa a usá-lo — evita erro de import não usado no typecheck intermediário.)

- [ ] **Step 2: Introduzir `bulk` e `base`**

Logo após o `useMemo` de `baseHoras` (que termina em `}, [funcionarioIds, horasPorFunc]);`), adicione:

```ts
  const bulk = funcionarioIds.length > 1;
  // Em lote, a unidade é %: cada funcionário recebe a % das próprias horas.
  // base=100 faz a lógica de redistribuição (compensarAposEdicao/distribuir)
  // somar 100%. No modo individual, base = horas da pessoa (comportamento atual).
  const base = bulk ? 100 : baseHoras;
```

- [ ] **Step 3: Trocar `baseHoras` por `base` na lógica de estado**

No corpo do componente, troque `baseHoras` por `base` APENAS nestes pontos de cálculo/handler (NÃO troque no `useMemo` que define `baseHoras`, nem nos textos que mostram horas):

1. No `useEffect` de inicialização:
   - `const pct = baseHoras > 0 ? (a.horas / baseHoras) * 100 : 0;` → use `base`.
   - `if (carregadas.length === 1 && baseHoras > 0) {` → use `base`.
   - `setLinhas([aplicarHoras(carregadas[0], baseHoras, baseHoras)]);` → use `base`.
   - `setLinhas(baseHoras > 0 ? [aplicarHoras(l, baseHoras, baseHoras)] : [l]);` → use `base`.
   - Array de dependências: troque `[open, iniciais, baseHoras]` por `[open, iniciais, base]`.
2. `setHorasDaLinha`: `compensarAposEdicao(prev, uid, h, baseHoras)` → `base`.
3. `setPctDaLinha`: `if (!Number.isFinite(p) || baseHoras <= 0)` → `base`; `const h = (p / 100) * baseHoras;` → `base`; `compensarAposEdicao(prev, uid, h, baseHoras)` → `base`.
4. `adicionarLinha`: `distribuirEntreTodas([...prev, novaLinha()], baseHoras)` → `base`.
5. `removerLinha`: `distribuirEntreTodas(restantes, baseHoras)` → `base`.
6. `totalPct`: `const totalPct = baseHoras > 0 ? (totalHoras / baseHoras) * 100 : 0;` → `base`.

- [ ] **Step 4: Validação por modo**

Substitua a função `validar()` inteira por:

```ts
  function validar(): string | null {
    const ativas = linhas.filter((l) => Number.isFinite(l.horasNum) && l.horasNum > 0);
    if (ativas.length === 0) return "Adicione pelo menos uma linha com horas > 0.";
    for (const l of ativas) {
      if (l.tipo === "produtivo" && !l.servicoId)
        return "Selecione um serviço em todas as linhas produtivas.";
      if (l.tipo === "improdutivo" && !l.motivo)
        return "Informe o motivo nas linhas improdutivas.";
    }
    const ids = ativas.filter((l) => l.servicoId).map((l) => l.servicoId);
    if (new Set(ids).size !== ids.length)
      return "Há serviços repetidos. Use uma linha por serviço.";

    if (bulk) {
      // base=100 → totalHoras é a soma das porcentagens.
      if (Math.abs(totalHoras - 100) > 0.1)
        return `As porcentagens devem somar 100%. Soma atual: ${totalHoras.toFixed(1)}%.`;
      return null;
    }

    for (const fid of funcionarioIds) {
      const ponto = horasPorFunc[fid] ?? 0;
      if (ponto <= 0) continue; // sem ponto registrado, pula a checagem
      if (totalHoras > ponto + 0.01) {
        return `${funcNome[fid] ?? fid}: total ${totalHoras.toFixed(
          2,
        )}h excede as ${ponto.toFixed(2)}h registradas no ponto.`;
      }
      if (totalHoras < ponto - 0.01) {
        return `${funcNome[fid] ?? fid}: total ${totalHoras.toFixed(
          2,
        )}h é menor que as ${ponto.toFixed(
          2,
        )}h registradas no ponto. A soma deve fechar.`;
      }
    }
    return null;
  }
```

- [ ] **Step 5: Save por modo**

No `onSubmit` do form, substitua o bloco `try { await replaceApontamentosDoDia({...}); onSaved(); }` pelo seguinte (mantém o `catch`/`finally` existentes):

```ts
          setSaving(true);
          try {
            const ativas = linhas.filter((l) => l.horasNum > 0);
            if (bulk) {
              await replaceApontamentosDoDiaPorPct({
                funcionarioIds,
                data,
                horasPorFunc,
                linhas: ativas.map((l) => ({
                  servicoId: l.tipo === "produtivo" ? l.servicoId : null,
                  pct: l.horasNum, // base=100 → horasNum guarda a %
                  tipo: l.tipo,
                  motivoImprodutivo: l.motivo || null,
                  observacao: l.observacao || null,
                })),
              });
            } else {
              await replaceApontamentosDoDia({
                funcionarioIds,
                data,
                linhas: ativas.map((l) => ({
                  servicoId: l.tipo === "produtivo" ? l.servicoId : null,
                  horas: l.horasNum,
                  tipo: l.tipo,
                  motivoImprodutivo: l.motivo || null,
                  observacao: l.observacao || null,
                })),
              });
            }
            onSaved();
          } catch (err2) {
            setErro(
              "Falha: " + (err2 instanceof Error ? err2.message : String(err2))
            );
          } finally {
            setSaving(false);
          }
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/modules/apontamento/components/LancamentoServicoModal.tsx
git commit -m "feat(apont-servico): modo lote do modal trabalha em % por pessoa"
```

---

## Task 5: Modal — UI do modo lote (campos %, prévia, textos)

**Files:**
- Modify: `src/modules/apontamento/components/LancamentoServicoModal.tsx`

- [ ] **Step 1: Adicionar o import de `ratearHorasPorPct`**

No topo do arquivo, logo após o import vindo de `../utils/apontamentoServicoApi`, adicione:

```ts
import { ratearHorasPorPct } from "../utils/apontamentoServicoPct";
```

- [ ] **Step 2: Calcular a prévia por funcionário**

Logo após a linha `const totalPct = base > 0 ? (totalHoras / base) * 100 : 0;`, adicione:

```ts
  const previewLote = useMemo(() => {
    if (!bulk) return [] as { fid: string; hf: number; itens: { label: string; horas: number }[] }[];
    const servLabel = (servicoId: string | null) => {
      if (!servicoId) return "—";
      const s = servicos.find((x) => x.id === servicoId);
      return s ? (s.codigo ?? s.nome) : "—";
    };
    const ativas = linhas.filter((l) => l.horasNum > 0);
    const pcts = ativas.map((l) => l.horasNum); // base=100 → horasNum é a %
    return funcionarioIds.map((fid) => {
      const hf = horasPorFunc[fid] ?? 0;
      const horas = ratearHorasPorPct(pcts, hf);
      return {
        fid,
        hf,
        itens: ativas.map((l, i) => ({
          label: l.tipo === "produtivo" ? servLabel(l.servicoId) : l.motivo || "Improdutivo",
          horas: horas[i],
        })),
      };
    });
  }, [bulk, linhas, funcionarioIds, horasPorFunc, servicos]);
```

- [ ] **Step 3: Trocar o cabeçalho do lote**

Substitua o bloco que começa com `{funcionarioIds.length > 1 && (` (o card "Aplicado a / Base de horas (menor entre os selecionados)") por:

```tsx
        {bulk && (
          <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-fg-muted)]">
            Aplicado a:{" "}
            <span className="text-[var(--color-fg)]">
              {funcionarioIds.map((id) => funcNome[id] ?? id).join(", ")}
            </span>
            <div className="mt-1 text-[var(--color-fg-subtle)]">
              A porcentagem é aplicada sobre as horas de ponto de cada
              funcionário — o dia de cada um fecha 100%.
            </div>
          </div>
        )}
```

- [ ] **Step 4: Campos por linha — % no lote, Horas+% no individual**

Substitua o bloco dos inputs de horas/porcentagem (o `<div className="grid grid-cols-2 gap-3">` que contém os dois `<Input label="Horas">` e `<Input label="% do dia">`) por:

```tsx
              {bulk ? (
                <Input
                  label="% do dia"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={l.pctStr}
                  onChange={(e) => setPctDaLinha(l.uid, e.target.value)}
                  placeholder="Ex: 60"
                  disabled={linhas.length === 1}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Horas"
                    type="number"
                    step="any"
                    min="0"
                    max={base > 0 ? base : undefined}
                    value={l.horasStr}
                    onChange={(e) => setHorasDaLinha(l.uid, e.target.value)}
                    placeholder="Ex: 4.0"
                    disabled={linhas.length === 1 && base > 0}
                  />
                  <Input
                    label="% do dia"
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={l.pctStr}
                    onChange={(e) => setPctDaLinha(l.uid, e.target.value)}
                    placeholder={base > 0 ? "Ex: 50" : "—"}
                    disabled={base <= 0 || (linhas.length === 1 && base > 0)}
                  />
                </div>
              )}
```

- [ ] **Step 5: Ajustar as notas abaixo dos inputs**

Substitua os dois parágrafos de nota (o `{linhas.length === 1 && baseHoras > 0 && (` e o `{linhas.length > 1 && baseHoras > 0 && (`) por:

```tsx
              {linhas.length === 1 && base > 0 && (
                <p className="text-[11px] text-[var(--color-fg-subtle)] -mt-1">
                  Linha única: recebe automaticamente 100%
                  {bulk ? " das horas de cada um" : " das horas do ponto"}.
                  Adicione outro serviço pra dividir.
                </p>
              )}
              {linhas.length > 1 && base > 0 && (
                <p className="text-[11px] text-[var(--color-fg-subtle)] -mt-1">
                  {bulk
                    ? "Editar uma linha redistribui as porcentagens nas outras — a soma sempre fecha 100%."
                    : `Editar uma linha redistribui as horas restantes nas outras proporcionalmente — a soma sempre fecha em ${baseHoras.toFixed(
                        2,
                      )}h.`}
                </p>
              )}
```

- [ ] **Step 6: Bloco de prévia (só no lote)**

Logo ANTES do botão `+ Adicionar outro serviço` (o `<button type="button" onClick={adicionarLinha} ...>`), adicione:

```tsx
        {bulk && previewLote.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 space-y-1.5">
            <p className="text-xs font-semibold text-[var(--color-fg-muted)]">
              Prévia por funcionário
            </p>
            {previewLote.map((p) => (
              <div key={p.fid} className="text-xs leading-relaxed">
                <span className="text-[var(--color-fg)]">
                  {funcNome[p.fid] ?? p.fid}
                </span>
                <span className="text-[var(--color-fg-subtle)] font-mono">
                  {" "}
                  — {p.hf.toFixed(2)}h
                </span>
                {p.itens.length > 0 && (
                  <span className="text-[var(--color-fg-muted)]">
                    {" → "}
                    {p.itens
                      .map((it) => `${it.label} ${it.horas.toFixed(2)}h`)
                      .join(" · ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 7: Total por modo**

Substitua o conteúdo do `<span className="font-mono">` dentro do rodapé "Total" por:

```tsx
          <span className="font-mono">
            {bulk ? (
              <>
                {totalHoras.toFixed(1)}%
                <span className="text-[var(--color-fg-subtle)] ml-2">/ 100%</span>
              </>
            ) : (
              <>
                {totalHoras.toFixed(2)}h
                {base > 0 && (
                  <span className="text-[var(--color-fg-subtle)] ml-2">
                    ({totalPct.toFixed(1)}%)
                  </span>
                )}
                {base > 0 && (
                  <span className="text-[var(--color-fg-subtle)] ml-2">
                    / {baseHoras.toFixed(2)}h
                  </span>
                )}
              </>
            )}
          </span>
```

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: sem erros de tipo; lint sem novos erros no arquivo do modal.

- [ ] **Step 9: Commit**

```bash
git add src/modules/apontamento/components/LancamentoServicoModal.tsx
git commit -m "feat(apont-servico): UI do lote em % com previa por funcionario"
```

---

## Task 6: Verificação ponta a ponta

**Files:**
- Conferir (sem alterar): `src/modules/apontamento/components/ApontamentoServicoTab.tsx`

- [ ] **Step 1: Confirmar que a aba já passa o necessário**

Abra `src/modules/apontamento/components/ApontamentoServicoTab.tsx` e confirme que o `<LancamentoModal ... />` recebe `funcionarioIds={modal.funcionarioIds}` e `horasPorFunc={horasPorFunc}`, e que o botão "Lançar serviço para N selecionados" chama `abrirLancamento([...selecionados])`. Nenhuma alteração necessária aqui.

- [ ] **Step 2: Suíte de testes completa**

Run: `npm test`
Expected: PASS, incluindo `apontamentoServicoPct.test.ts`.

- [ ] **Step 3: Build de produção (typecheck real do projeto)**

Run: `npm run build`
Expected: build conclui sem erros de TypeScript.

- [ ] **Step 4: Teste manual no app**

Run: `npm run dev` e no navegador:
1. Aba Apontamento por Serviço → escolha uma obra/equipe e uma data com pelo menos 2 funcionários com **horas de ponto diferentes** (ex.: um 8h, outro 6h).
2. Marque os 2 → clique "Lançar serviço para 2 selecionados".
3. Adicione 2 serviços, ponha 60% e 40%.
   - Confirme que o rodapé mostra `100,0% / 100%`.
   - Confirme a **Prévia por funcionário**: o de 8h → 4,80h/3,20h; o de 6h → 3,60h/2,40h.
4. Salve. Na tabela do dia, os 2 devem ficar com status **✅ completo** (Apropriado = Ponto), sem pendência.
5. Abra um funcionário sozinho ("Editar") e confirme que o modo individual continua igual (campos Horas + %).

Expected: cada funcionário fecha 100% das próprias horas; modo individual inalterado.

- [ ] **Step 5: Commit final (se houver ajuste de verificação) e encerramento**

Se nada mudou no Step 1, não há commit aqui. Caso algum ajuste tenha sido necessário, commit com mensagem descritiva.

---

## Notas

- `arred2` existe hoje dentro do modal (`LancamentoServicoModal.tsx`) e também no novo módulo puro. É um one-liner; mantemos as duas cópias pra não refatorar os helpers já validados do modal. Não unificar agora (YAGNI / baixo risco).
- Sem migração de banco: a tabela `apont_apontamentos_servico` continua guardando horas absolutas; a % é só a forma de entrada no lote.
- A função `replaceApontamentosDoDia` (modo individual) não é tocada.
