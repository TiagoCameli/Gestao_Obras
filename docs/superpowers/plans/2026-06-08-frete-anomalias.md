# Aba de Anomalias do Frete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma aba "Anomalias" no módulo de Frete que detecta 6 tipos de problema (preço fora do padrão, frete sem pedido, saldo negativo, duplicado, cadastro incompleto, sem chegada), com lista filtrável, drawer de detalhe e "marcar como verificada" persistido no banco.

**Architecture:** Espelha a aba de Anomalias do Combustível (`src/components/combustivel/v2/anomalias/`). Detecção é uma função pura client-side (`detectAnomaliasFrete`). Verificação fica numa tabela nova `anomalias_frete_checks` com RLS na ação já existente `ver_frete` (sem chave de permissão nova, sem backfill). A aba entra em `src/pages/Frete.tsx` reusando a chave `ver_frete` no `permByTab`.

**Tech Stack:** React + TypeScript + Vite, TanStack Query, Supabase (Postgres + RLS), Vitest, Tailwind (variáveis CSS de cor).

**Branch:** `feat/frete-anomalias` (já criado; spec em `docs/superpowers/specs/2026-06-08-frete-anomalias-design.md`).

**Convenção de commit:** terminar a mensagem com a linha `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/frete/anomalias/detect.ts` (criar) | Tipos + `detectAnomaliasFrete(input)`. Toda a lógica F1–F6, pura. |
| `src/components/frete/anomalias/detect.test.ts` (criar) | Testes Vitest dos 6 detectores. |
| `src/hooks/useAnomaliasFreteChecks.ts` (criar) | Query + marcar + desfazer verificação (tabela `anomalias_frete_checks`). |
| `supabase/migrations/20260608120000_anomalias_frete_checks_fix.sql` (criar) | Cria a tabela + RLS em `ver_frete`. |
| `supabase/migrations/20260608120100_anomalias_frete_checks_rollback.sql` (criar) | Rollback (+100 no timestamp). |
| `src/components/frete/anomalias/FretesAfetadosList.tsx` (criar) | Lista compacta de fretes de uma anomalia (usada no drawer). |
| `src/components/frete/anomalias/AnomaliaFreteDrawer.tsx` (criar) | Drawer de detalhe + verificação + ação "editar frete". |
| `src/components/frete/anomalias/AnomaliasFreteTab.tsx` (criar) | A aba: filtros laterais + lista de anomalias + drawer. |
| `src/pages/Frete.tsx` (modificar) | Adiciona a aba "anomalias" (tipo, permByTab, trigger, content, hooks de checks). |

---

## Task 1: Tipos, helpers e detector F1 (preço fora do padrão)

**Files:**
- Create: `src/components/frete/anomalias/detect.ts`
- Test: `src/components/frete/anomalias/detect.test.ts`

Confirme antes os campos dos tipos em `src/types/index.ts`: `Frete` tem `id, data, dataChegada, origem, insumoId, pesoToneladas, valorTotal, valorMaterial, notaFiscal, placaCarreta` (linhas ~457-488). `PedidoMaterial` tem `fornecedorId, itens: ItemPedidoMaterial[], data, deletedAt` e `ItemPedidoMaterial { insumoId, quantidade, valorUnitario }` (linhas ~703-726). `Fornecedor` tem `id, nome`.

- [ ] **Step 1: Write the failing test** (`src/components/frete/anomalias/detect.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { detectAnomaliasFrete, type DetectFreteInput } from './detect';
import type { Frete, PedidoMaterial, Fornecedor } from '../../../types';

// ---- builders mínimos ----
function frete(over: Partial<Frete>): Frete {
  return {
    id: 'f1', data: '2026-01-10', dataChegada: '2026-01-11', obraId: 'o1',
    origem: 'Britam', destino: 'Obra', transportadora: 'Areacre', insumoId: 'brita4',
    pesoToneladas: 30, kmRodados: 0, valorTkm: 0, valorTotal: 1000, notaFiscal: 'NF1',
    notaFiscal2: '', placaCarreta: 'ABC1D23', motorista: 'Zé', valorMaterial: 30 * 121.98,
    observacoes: '', criadoPor: '', ...over,
  } as Frete;
}
function pedido(over: Partial<PedidoMaterial>): PedidoMaterial {
  return {
    id: 'p1', data: '2026-01-01', fornecedorId: 'fBritam',
    itens: [{ insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 }],
    observacoes: '', criadoPor: '', ...over,
  } as PedidoMaterial;
}
const fornecedores: Fornecedor[] = [{ id: 'fBritam', nome: 'Britam' } as Fornecedor];
const base = (over: Partial<DetectFreteInput>): DetectFreteInput => ({
  fretesNoPeriodo: [], fretesTodos: [], pedidos: [], fornecedores,
  insumoNome: new Map([['brita4', 'Brita 4'], ['bgs', 'BGS']]),
  fornecedorNome: new Map([['fBritam', 'Britam']]),
  hoje: '2026-06-08', ...over,
});

describe('F1 — preço de material fora do padrão', () => {
  it('dispara quando o R$/t do frete não bate com nenhum preço de pedido', () => {
    const f = frete({ id: 'fx', insumoId: 'bgs', valorMaterial: 60 * 112.35, pesoToneladas: 60 });
    const p = pedido({ itens: [{ insumoId: 'bgs', quantidade: 1000, valorUnitario: 106.73 }] });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [p] }));
    const f1 = res.filter((a) => a.detector === 'F1');
    expect(f1).toHaveLength(1);
    expect(f1[0].affectedFreteIds).toEqual(['fx']);
    expect(f1[0].severity).toBe('warning');
  });

  it('NÃO dispara quando o preço bate com algum pedido (ex: pico de dezembro 128,40)', () => {
    const f = frete({ id: 'fdez', valorMaterial: 30 * 128.40, pesoToneladas: 30 });
    const p = pedido({ itens: [
      { insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 },
      { insumoId: 'brita4', quantidade: 400, valorUnitario: 128.40 },
    ] });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [p] }));
    expect(res.filter((a) => a.detector === 'F1')).toHaveLength(0);
  });

  it('respeita a tolerância de R$0,10/t', () => {
    const f = frete({ valorMaterial: 30 * 122.05, pesoToneladas: 30 }); // 122,05 vs 121,98 = 0,07
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F1')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts`
Expected: FAIL — `detect.ts` não existe / `detectAnomaliasFrete is not a function`.

- [ ] **Step 3: Write `detect.ts` com tipos, helpers e F1**

```ts
import type { Frete, PedidoMaterial, Fornecedor } from '../../../types';

export type Severidade = 'info' | 'warning' | 'critical';
export type FreteDetectorId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';

export interface AnomaliaFrete {
  id: string;
  severity: Severidade;
  detector: FreteDetectorId;
  title: string;
  description: string;
  affectedFreteIds: string[];
  affectedFornecedorId?: string;
  affectedInsumoId?: string;
  data: string;
  acaoSugerida?: string;
}

export interface DetectFreteInput {
  fretesNoPeriodo: Frete[];   // F1, F2, F4, F5, F6
  fretesTodos: Frete[];       // F3 (saldo cumulativo, ignora filtro de período)
  pedidos: PedidoMaterial[];  // todos (referência de preço e quantidade)
  fornecedores: Fornecedor[];
  insumoNome: Map<string, string>;
  fornecedorNome: Map<string, string>;
  hoje: string;               // 'YYYY-MM-DD'
}

const PRECO_TOL = 0.10; // R$/t — tolerância de match de preço (F1)
const F6_DIAS = 7;      // dias sem chegada (F6)
const SEVERITY_ORDER: Record<Severidade, number> = { critical: 0, warning: 1, info: 2 };

export const SEVERITY_LABEL: Record<Severidade, string> = {
  critical: 'Crítica', warning: 'Atenção', info: 'Informação',
};
export const FRETE_DETECTOR_LABEL: Record<FreteDetectorId, string> = {
  F1: 'Preço de material fora do padrão',
  F2: 'Frete de material sem pedido',
  F3: 'Saldo negativo na pedreira',
  F4: 'Frete duplicado',
  F5: 'Cadastro incompleto',
  F6: 'Frete sem chegada',
};

// match flexível origem -> fornecedorId (igual FreteDashboard.findFornecedorByOrigem, linhas 663-671)
function makeFindFornecedor(fornecedores: Fornecedor[]) {
  const list = fornecedores.map((f) => ({ id: f.id, nomeLower: f.nome.toLowerCase().trim() }));
  return (origem: string | undefined | null): string | undefined => {
    const o = (origem ?? '').toLowerCase().trim();
    if (!o) return undefined;
    const exact = list.find((f) => f.nomeLower === o);
    if (exact) return exact.id;
    const partial = list.find((f) => f.nomeLower.includes(o) || o.includes(f.nomeLower));
    return partial?.id;
  };
}

// `${fornecedorId}|${insumoId}` -> { precos: number[] distintos, qtd: soma }
function buildPedidoInfo(pedidos: PedidoMaterial[]) {
  const map = new Map<string, { precos: number[]; qtd: number }>();
  for (const p of pedidos) {
    if (!p.fornecedorId || p.deletedAt) continue;
    for (const it of p.itens ?? []) {
      const key = `${p.fornecedorId}|${it.insumoId}`;
      const cur = map.get(key) ?? { precos: [], qtd: 0 };
      if (!cur.precos.some((pr) => Math.abs(pr - it.valorUnitario) < 0.005)) cur.precos.push(it.valorUnitario);
      cur.qtd += it.quantidade;
      map.set(key, cur);
    }
  }
  return map;
}

function diasEntre(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00`).getTime();
  const b = new Date(`${bIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

type Ctx = {
  input: DetectFreteInput;
  findForn: (o?: string | null) => string | undefined;
  pedidoInfo: Map<string, { precos: number[]; qtd: number }>;
};

function detectF1(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn, pedidoInfo } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of input.fretesNoPeriodo) {
    if (!f.insumoId || !(f.pesoToneladas > 0) || !(f.valorMaterial > 0)) continue;
    const fornId = findForn(f.origem);
    if (!fornId) continue; // origem sem fornecedor -> F5
    const info = pedidoInfo.get(`${fornId}|${f.insumoId}`);
    if (!info || info.precos.length === 0) continue; // sem pedido -> F2
    const unit = f.valorMaterial / f.pesoToneladas;
    if (info.precos.some((pr) => Math.abs(pr - unit) <= PRECO_TOL)) continue;
    const matNome = input.insumoNome.get(f.insumoId) ?? f.insumoId;
    const fornNome = input.fornecedorNome.get(fornId) ?? (f.origem || fornId);
    out.push({
      id: `F1-${f.id}`,
      severity: 'warning',
      detector: 'F1',
      title: `Preço de ${matNome} fora do padrão (${fornNome})`,
      description: `Nota ${f.notaFiscal || 's/ NF'}: R$ ${unit.toFixed(2)}/t. Pedidos de ${matNome} nessa pedreira: ${info.precos.map((p) => `R$ ${p.toFixed(2)}`).join(', ')}.`,
      affectedFreteIds: [f.id],
      affectedFornecedorId: fornId,
      affectedInsumoId: f.insumoId,
      data: f.data,
      acaoSugerida: 'Conferir o valor de material na nota fiscal; se estiver errado, editar o frete.',
    });
  }
  return out;
}

export function detectAnomaliasFrete(input: DetectFreteInput): AnomaliaFrete[] {
  const ctx: Ctx = {
    input,
    findForn: makeFindFornecedor(input.fornecedores),
    pedidoInfo: buildPedidoInfo(input.pedidos),
  };
  const all: AnomaliaFrete[] = [
    ...detectF1(ctx),
  ];
  all.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    return b.data.localeCompare(a.data);
  });
  return all;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts`
Expected: PASS (3 testes do bloco F1).

- [ ] **Step 5: Commit**

```bash
git add src/components/frete/anomalias/detect.ts src/components/frete/anomalias/detect.test.ts
git commit -m "feat(frete): detect.ts + detector F1 (preço de material fora do padrão)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Detector F2 (frete de material sem pedido)

**Files:**
- Modify: `src/components/frete/anomalias/detect.ts`
- Test: `src/components/frete/anomalias/detect.test.ts`

- [ ] **Step 1: Write the failing test** (adicionar bloco ao `detect.test.ts`)

```ts
describe('F2 — frete de material sem pedido', () => {
  it('dispara quando o material+fornecedor não tem pedido', () => {
    const f = frete({ id: 'fnp', insumoId: 'bgs', origem: 'Britam' });
    const p = pedido({ itens: [{ insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 }] }); // só brita4
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [p] }));
    const f2 = res.filter((a) => a.detector === 'F2');
    expect(f2).toHaveLength(1);
    expect(f2[0].affectedFreteIds).toEqual(['fnp']);
    // F1 não dispara pro mesmo frete (sem pedido)
    expect(res.filter((a) => a.detector === 'F1' && a.affectedFreteIds.includes('fnp'))).toHaveLength(0);
  });

  it('NÃO dispara quando há pedido do material+fornecedor', () => {
    const f = frete({ id: 'fok', insumoId: 'brita4' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F2')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts -t "F2"`
Expected: FAIL — F2 não detectado (length 0).

- [ ] **Step 3: Add `detectF2` and include it** (em `detect.ts`, antes de `detectAnomaliasFrete`)

```ts
function detectF2(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn, pedidoInfo } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of input.fretesNoPeriodo) {
    if (!f.insumoId) continue;
    const fornId = findForn(f.origem);
    if (!fornId) continue; // origem sem fornecedor -> F5
    const info = pedidoInfo.get(`${fornId}|${f.insumoId}`);
    if (info && info.precos.length > 0) continue; // tem pedido -> ok (ou F1)
    const matNome = input.insumoNome.get(f.insumoId) ?? f.insumoId;
    const fornNome = input.fornecedorNome.get(fornId) ?? (f.origem || fornId);
    out.push({
      id: `F2-${f.id}`,
      severity: 'warning',
      detector: 'F2',
      title: `${matNome} transportado sem pedido (${fornNome})`,
      description: `Nota ${f.notaFiscal || 's/ NF'}: não há pedido de ${matNome} cadastrado para ${fornNome}.`,
      affectedFreteIds: [f.id],
      affectedFornecedorId: fornId,
      affectedInsumoId: f.insumoId,
      data: f.data,
      acaoSugerida: 'Cadastrar o pedido de material correspondente, ou conferir a origem do frete.',
    });
  }
  return out;
}
```

E no array de `detectAnomaliasFrete`:

```ts
  const all: AnomaliaFrete[] = [
    ...detectF1(ctx),
    ...detectF2(ctx),
  ];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts`
Expected: PASS (F1 + F2).

- [ ] **Step 5: Commit**

```bash
git add src/components/frete/anomalias/detect.ts src/components/frete/anomalias/detect.test.ts
git commit -m "feat(frete): detector F2 (material transportado sem pedido)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Detector F3 (saldo negativo na pedreira)

**Files:**
- Modify: `src/components/frete/anomalias/detect.ts`
- Test: `src/components/frete/anomalias/detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('F3 — saldo negativo na pedreira', () => {
  it('dispara quando transportado (t) > pedido (t) por material+fornecedor', () => {
    const fretes = [
      frete({ id: 'a', insumoId: 'brita4', pesoToneladas: 700 }),
      frete({ id: 'b', insumoId: 'brita4', pesoToneladas: 500 }),
    ];
    const p = pedido({ itens: [{ insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 }] }); // 1000 < 1200
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [p] }));
    const f3 = res.filter((a) => a.detector === 'F3');
    expect(f3).toHaveLength(1);
    expect(f3[0].affectedInsumoId).toBe('brita4');
    expect(f3[0].affectedFornecedorId).toBe('fBritam');
  });

  it('NÃO dispara quando transportado <= pedido', () => {
    const fretes = [frete({ id: 'a', insumoId: 'brita4', pesoToneladas: 800 })];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F3')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts -t "F3"`
Expected: FAIL.

- [ ] **Step 3: Add `detectF3` and include it** (usa `fretesTodos`, saldo é cumulativo)

```ts
function detectF3(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn, pedidoInfo } = ctx;
  // soma transportada por fornecedorId|insumoId (todos os fretes, saldo cumulativo)
  const transp = new Map<string, number>();
  for (const f of input.fretesTodos) {
    if (!f.insumoId || !(f.pesoToneladas > 0)) continue;
    const fornId = findForn(f.origem);
    if (!fornId) continue;
    const key = `${fornId}|${f.insumoId}`;
    transp.set(key, (transp.get(key) ?? 0) + f.pesoToneladas);
  }
  const out: AnomaliaFrete[] = [];
  for (const [key, qtdTransp] of transp) {
    const info = pedidoInfo.get(key);
    const qtdPed = info?.qtd ?? 0;
    const saldo = qtdPed - qtdTransp;
    if (saldo >= -0.1) continue; // só negativo relevante
    const [fornId, insumoId] = key.split('|');
    const matNome = input.insumoNome.get(insumoId) ?? insumoId;
    const fornNome = input.fornecedorNome.get(fornId) ?? fornId;
    out.push({
      id: `F3-${key}`,
      severity: 'warning',
      detector: 'F3',
      title: `Saldo negativo de ${matNome} (${fornNome})`,
      description: `Transportado ${qtdTransp.toLocaleString('pt-BR')} t, mas só ${qtdPed.toLocaleString('pt-BR')} t foram pedidas. Saldo ${saldo.toLocaleString('pt-BR')} t.`,
      affectedFreteIds: [],
      affectedFornecedorId: fornId,
      affectedInsumoId: insumoId,
      data: input.hoje,
      acaoSugerida: 'Cadastrar pedido complementar do material, ou conferir fretes lançados a mais.',
    });
  }
  return out;
}
```

No array: `...detectF3(ctx),`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/frete/anomalias/detect.ts src/components/frete/anomalias/detect.test.ts
git commit -m "feat(frete): detector F3 (saldo negativo na pedreira)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Detector F4 (frete duplicado)

**Files:**
- Modify: `src/components/frete/anomalias/detect.ts`
- Test: `src/components/frete/anomalias/detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('F4 — frete duplicado', () => {
  it('dispara quando a mesma nota fiscal aparece em 2+ fretes', () => {
    const fretes = [frete({ id: 'a', notaFiscal: '999' }), frete({ id: 'b', notaFiscal: '999' })];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    const f4 = res.filter((a) => a.detector === 'F4');
    expect(f4).toHaveLength(1);
    expect(f4[0].severity).toBe('critical');
    expect(new Set(f4[0].affectedFreteIds)).toEqual(new Set(['a', 'b']));
  });

  it('dispara por placa+peso+material+data repetidos (mesmo sem nota igual)', () => {
    const fretes = [
      frete({ id: 'a', notaFiscal: 'N1', placaCarreta: 'XYZ9Z99', pesoToneladas: 31, data: '2026-02-02' }),
      frete({ id: 'b', notaFiscal: 'N2', placaCarreta: 'XYZ9Z99', pesoToneladas: 31, data: '2026-02-02' }),
    ];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F4').length).toBeGreaterThanOrEqual(1);
  });

  it('NÃO dispara com notas e cargas distintas', () => {
    const fretes = [frete({ id: 'a', notaFiscal: 'N1' }), frete({ id: 'b', notaFiscal: 'N2', placaCarreta: 'OUT0R00', pesoToneladas: 25 })];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F4')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts -t "F4"`
Expected: FAIL.

- [ ] **Step 3: Add `detectF4` and include it**

```ts
function detectF4(ctx: Ctx): AnomaliaFrete[] {
  const { input } = ctx;
  const out: AnomaliaFrete[] = [];
  const usados = new Set<string>(); // freteIds já reportados, evita dupla contagem

  // (a) mesma nota fiscal em 2+ fretes
  const porNota = new Map<string, Frete[]>();
  for (const f of input.fretesNoPeriodo) {
    const nf = (f.notaFiscal ?? '').trim();
    if (!nf) continue;
    (porNota.get(nf) ?? porNota.set(nf, []).get(nf)!).push(f);
  }
  for (const [nf, grupo] of porNota) {
    if (grupo.length < 2) continue;
    grupo.forEach((g) => usados.add(g.id));
    out.push({
      id: `F4-nf-${nf}`,
      severity: 'critical',
      detector: 'F4',
      title: `Nota fiscal ${nf} repetida em ${grupo.length} fretes`,
      description: `A mesma nota fiscal aparece em ${grupo.length} lançamentos de frete. Possível duplicidade.`,
      affectedFreteIds: grupo.map((g) => g.id),
      data: grupo.map((g) => g.data).sort().at(-1) ?? input.hoje,
      acaoSugerida: 'Conferir e excluir o lançamento duplicado.',
    });
  }

  // (b) mesma placa+peso+material+data
  const porCarga = new Map<string, Frete[]>();
  for (const f of input.fretesNoPeriodo) {
    if (usados.has(f.id)) continue;
    const placa = (f.placaCarreta ?? '').trim();
    if (!placa || !(f.pesoToneladas > 0)) continue;
    const key = `${placa}|${f.pesoToneladas}|${f.insumoId}|${f.data}`;
    (porCarga.get(key) ?? porCarga.set(key, []).get(key)!).push(f);
  }
  for (const [key, grupo] of porCarga) {
    if (grupo.length < 2) continue;
    out.push({
      id: `F4-carga-${key}`,
      severity: 'critical',
      detector: 'F4',
      title: `Carga repetida: ${grupo[0].placaCarreta} em ${grupo[0].data}`,
      description: `${grupo.length} fretes com mesma placa, peso (${grupo[0].pesoToneladas} t), material e data. Possível duplicidade.`,
      affectedFreteIds: grupo.map((g) => g.id),
      data: grupo[0].data,
      acaoSugerida: 'Conferir e excluir o lançamento duplicado.',
    });
  }
  return out;
}
```

No array: `...detectF4(ctx),`. Atualizar o import de tipo se necessário (`Frete` já importado).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/frete/anomalias/detect.ts src/components/frete/anomalias/detect.test.ts
git commit -m "feat(frete): detector F4 (frete duplicado por nota ou carga)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Detector F5 (cadastro incompleto)

**Files:**
- Modify: `src/components/frete/anomalias/detect.ts`
- Test: `src/components/frete/anomalias/detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('F5 — cadastro incompleto', () => {
  it('warning quando falta peso ou valor de material', () => {
    const f = frete({ id: 'sp', pesoToneladas: 0, valorMaterial: 0 });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    const f5 = res.filter((a) => a.detector === 'F5');
    expect(f5).toHaveLength(1);
    expect(f5[0].severity).toBe('warning');
  });

  it('info quando só falta nota fiscal ou placa', () => {
    const f = frete({ id: 'snf', notaFiscal: '', placaCarreta: '' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    const f5 = res.filter((a) => a.detector === 'F5');
    expect(f5).toHaveLength(1);
    expect(f5[0].severity).toBe('info');
  });

  it('dispara quando a origem não casa com nenhum fornecedor', () => {
    const f = frete({ id: 'sof', origem: 'Pedreira Inexistente' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F5' && a.affectedFreteIds.includes('sof'))).toHaveLength(1);
  });

  it('NÃO dispara para frete completo', () => {
    const f = frete({ id: 'ok' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F5')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts -t "F5"`
Expected: FAIL.

- [ ] **Step 3: Add `detectF5` and include it**

```ts
function detectF5(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of input.fretesNoPeriodo) {
    const motivos: string[] = [];
    let grave = false;
    if (!(f.pesoToneladas > 0)) { motivos.push('sem peso'); grave = true; }
    if (!(f.valorMaterial > 0)) { motivos.push('sem valor de material'); grave = true; }
    if (!(f.notaFiscal ?? '').trim()) motivos.push('sem nota fiscal');
    if (!(f.placaCarreta ?? '').trim()) motivos.push('sem placa');
    if (!findForn(f.origem)) motivos.push('origem não casa com nenhum fornecedor');
    if (motivos.length === 0) continue;
    out.push({
      id: `F5-${f.id}`,
      severity: grave ? 'warning' : 'info',
      detector: 'F5',
      title: `Frete com cadastro incompleto${f.notaFiscal ? ` (NF ${f.notaFiscal})` : ''}`,
      description: `Problemas: ${motivos.join(', ')}.`,
      affectedFreteIds: [f.id],
      affectedInsumoId: f.insumoId || undefined,
      data: f.data,
      acaoSugerida: 'Completar o cadastro do frete.',
    });
  }
  return out;
}
```

No array: `...detectF5(ctx),`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/frete/anomalias/detect.ts src/components/frete/anomalias/detect.test.ts
git commit -m "feat(frete): detector F5 (cadastro incompleto)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Detector F6 (frete sem chegada >7 dias)

**Files:**
- Modify: `src/components/frete/anomalias/detect.ts`
- Test: `src/components/frete/anomalias/detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('F6 — frete sem chegada', () => {
  it('dispara quando data_chegada vazia há mais de 7 dias', () => {
    const f = frete({ id: 'nc', dataChegada: '', data: '2026-06-01' }); // hoje base = 2026-06-08 (7d) -> >7 precisa 8
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})], hoje: '2026-06-10' }));
    const f6 = res.filter((a) => a.detector === 'F6');
    expect(f6).toHaveLength(1);
    expect(f6[0].severity).toBe('info');
  });

  it('NÃO dispara dentro de 7 dias', () => {
    const f = frete({ id: 'nc2', dataChegada: '', data: '2026-06-05' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})], hoje: '2026-06-08' }));
    expect(res.filter((a) => a.detector === 'F6')).toHaveLength(0);
  });

  it('NÃO dispara quando já tem data de chegada', () => {
    const f = frete({ id: 'nc3', dataChegada: '2026-06-02', data: '2026-06-01' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})], hoje: '2026-06-30' }));
    expect(res.filter((a) => a.detector === 'F6')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts -t "F6"`
Expected: FAIL.

- [ ] **Step 3: Add `detectF6` and include it**

```ts
function detectF6(ctx: Ctx): AnomaliaFrete[] {
  const { input } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of input.fretesNoPeriodo) {
    if ((f.dataChegada ?? '').trim()) continue;
    if (!f.data) continue;
    if (diasEntre(f.data, input.hoje) <= F6_DIAS) continue;
    out.push({
      id: `F6-${f.id}`,
      severity: 'info',
      detector: 'F6',
      title: `Frete sem chegada há mais de ${F6_DIAS} dias${f.notaFiscal ? ` (NF ${f.notaFiscal})` : ''}`,
      description: `Saída em ${f.data}, sem data de chegada registrada.`,
      affectedFreteIds: [f.id],
      data: f.data,
      acaoSugerida: 'Registrar a data de chegada da carga.',
    });
  }
  return out;
}
```

No array: `...detectF6(ctx),`.

- [ ] **Step 4: Run full test file**

Run: `npx vitest run src/components/frete/anomalias/detect.test.ts`
Expected: PASS (todos os blocos F1–F6).

- [ ] **Step 5: Typecheck + Commit**

Run: `npx tsc --noEmit` → Expected: sem erros.

```bash
git add src/components/frete/anomalias/detect.ts src/components/frete/anomalias/detect.test.ts
git commit -m "feat(frete): detector F6 (frete sem chegada >7 dias) — detecção completa

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Migration da tabela `anomalias_frete_checks`

**Files:**
- Create: `supabase/migrations/20260608120000_anomalias_frete_checks_fix.sql`
- Create: `supabase/migrations/20260608120100_anomalias_frete_checks_rollback.sql`

A tabela `anomalias_checks` (combustível) ainda não existe no repo; criamos a do frete do zero, gated em `ver_frete` (sem chave nova).

- [ ] **Step 1: Write the migration** (`..._fix.sql`)

```sql
-- Aba de Anomalias do Frete — tabela de verificação ("marcar como verificada").
-- id = id determinístico da anomalia (ex: "F1-<freteId>", "F4-nf-<nf>").
-- RLS gated na ação JÁ EXISTENTE 'ver_frete' (sem chave de ação nova, sem backfill).

CREATE TABLE IF NOT EXISTS public.anomalias_frete_checks (
  id          text primary key,
  checked_at  timestamptz not null default now(),
  checked_by  text,
  motivo      text,
  created_at  timestamptz not null default now()
);

ALTER TABLE public.anomalias_frete_checks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anomalias_frete_checks TO authenticated;

CREATE POLICY "anomalias_frete_checks_select"
  ON public.anomalias_frete_checks FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frete'));

CREATE POLICY "anomalias_frete_checks_insert"
  ON public.anomalias_frete_checks FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('ver_frete'));

CREATE POLICY "anomalias_frete_checks_update"
  ON public.anomalias_frete_checks FOR UPDATE TO authenticated
  USING (private.current_has_action('ver_frete'))
  WITH CHECK (private.current_has_action('ver_frete'));

CREATE POLICY "anomalias_frete_checks_delete"
  ON public.anomalias_frete_checks FOR DELETE TO authenticated
  USING (private.current_has_action('ver_frete'));
```

- [ ] **Step 2: Write the rollback** (`..._rollback.sql`)

```sql
DROP TABLE IF EXISTS public.anomalias_frete_checks;
```

- [ ] **Step 3: Apply via MCP Supabase** (projeto ref `gunyitwrbxbmnezokgjq`)

Aplicar o conteúdo do `_fix.sql` via `mcp__plugin_supabase_supabase__apply_migration` (name: `anomalias_frete_checks`). Confirmar com o Tiago antes (é escrita de schema em produção).

- [ ] **Step 4: Verify**

Rodar via MCP `execute_sql`: `select * from public.anomalias_frete_checks limit 1;`
Expected: 0 linhas, sem erro (tabela existe).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260608120000_anomalias_frete_checks_fix.sql supabase/migrations/20260608120100_anomalias_frete_checks_rollback.sql
git commit -m "feat(frete): migration tabela anomalias_frete_checks (RLS em ver_frete)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Hook `useAnomaliasFreteChecks`

**Files:**
- Create: `src/hooks/useAnomaliasFreteChecks.ts`

É uma cópia de `src/hooks/useAnomaliasChecks.ts` trocando a tabela e os nomes. Código completo:

- [ ] **Step 1: Write the hook**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AnomaliaFreteCheck {
  id: string;
  checkedAt: string;
  checkedBy: string | null;
  motivo: string | null;
}

interface AnomaliaFreteCheckRow {
  id: string;
  checked_at: string;
  checked_by: string | null;
  motivo: string | null;
}

function dbToCheck(r: AnomaliaFreteCheckRow): AnomaliaFreteCheck {
  return { id: r.id, checkedAt: r.checked_at, checkedBy: r.checked_by, motivo: r.motivo };
}

export function useAnomaliasFreteChecks() {
  return useQuery({
    queryKey: ['anomalias_frete_checks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomalias_frete_checks')
        .select('*')
        .order('checked_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as AnomaliaFreteCheckRow[];
      const map = new Map<string, AnomaliaFreteCheck>();
      for (const r of rows) map.set(r.id, dbToCheck(r));
      return map;
    },
  });
}

interface MarcarPayload {
  anomaliaId: string;
  checkedBy: string | null;
  motivo?: string | null;
}

export function useMarcarAnomaliaFreteVerificada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ anomaliaId, checkedBy, motivo }: MarcarPayload) => {
      const { error } = await supabase
        .from('anomalias_frete_checks')
        .upsert(
          { id: anomaliaId, checked_at: new Date().toISOString(), checked_by: checkedBy, motivo: motivo ?? null },
          { onConflict: 'id' },
        );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['anomalias_frete_checks'] }); },
  });
}

export function useDesfazerVerificacaoAnomaliaFrete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anomaliaId: string) => {
      const { error } = await supabase.from('anomalias_frete_checks').delete().eq('id', anomaliaId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['anomalias_frete_checks'] }); },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAnomaliasFreteChecks.ts
git commit -m "feat(frete): hook useAnomaliasFreteChecks (query + marcar + desfazer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Componente `FretesAfetadosList`

**Files:**
- Create: `src/components/frete/anomalias/FretesAfetadosList.tsx`

Lista compacta dos fretes de uma anomalia. Espelha `src/components/combustivel/v2/anomalias/SaidasAfetadasList.tsx` adaptado a `Frete`.

- [ ] **Step 1: Write the component**

```tsx
import type { Frete } from '../../../types';
import { Pencil } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface Props {
  fretes: Frete[];
  insumoNome: Map<string, string>;
  onEditFrete?: (f: Frete) => void;
}

export default function FretesAfetadosList({ fretes, insumoNome, onEditFrete }: Props) {
  if (fretes.length === 0) {
    return <p className="text-sm text-[var(--color-fg-muted)] italic">Anomalia agregada (sem frete único).</p>;
  }
  return (
    <ul className="space-y-2">
      {fretes.map((f) => {
        const unit = f.pesoToneladas > 0 ? f.valorMaterial / f.pesoToneladas : 0;
        return (
          <li key={f.id} className="rounded-lg border border-[var(--color-border)] p-2.5 text-sm flex items-start justify-between gap-2">
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{f.data} · {f.origem || '—'} → {f.destino || '—'}</span>
              <span className="text-xs text-[var(--color-fg-muted)]">
                {insumoNome.get(f.insumoId) || f.insumoId} · {f.pesoToneladas.toLocaleString('pt-BR')} t · {f.placaCarreta || 's/ placa'} · NF {f.notaFiscal || '—'}
              </span>
              <span className="text-xs text-[var(--color-fg-muted)]">
                Material {formatCurrency(f.valorMaterial)} ({unit > 0 ? `${formatCurrency(unit)}/t` : '—'})
              </span>
            </div>
            {onEditFrete && (
              <button
                type="button"
                onClick={() => onEditFrete(f)}
                className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
                title="Editar frete"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/frete/anomalias/FretesAfetadosList.tsx
git commit -m "feat(frete): FretesAfetadosList (lista compacta de fretes da anomalia)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Componente `AnomaliaFreteDrawer`

**Files:**
- Create: `src/components/frete/anomalias/AnomaliaFreteDrawer.tsx`

Drawer de detalhe. Espelha `src/components/combustivel/v2/anomalias/AnomaliaDrawer.tsx` (linhas 40-62 props, 64-88 SEVERITY_STYLES, 226-317 JSX), adaptado.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Undo2 } from 'lucide-react';
import Drawer from '../../ui/Drawer';
import Button from '../../ui/Button';
import FretesAfetadosList from './FretesAfetadosList';
import { type AnomaliaFrete, type Severidade, SEVERITY_LABEL, FRETE_DETECTOR_LABEL } from './detect';
import type { Frete } from '../../../types';
import type { AnomaliaFreteCheck } from '../../../hooks/useAnomaliasFreteChecks';

const SEVERITY_STYLES: Record<Severidade, { icon: typeof AlertCircle; badgeBg: string; badgeFg: string; iconColor: string }> = {
  critical: { icon: AlertCircle, badgeBg: 'bg-[var(--color-danger-soft)]', badgeFg: 'text-[var(--color-danger-fg)]', iconColor: 'text-[var(--color-danger)]' },
  warning: { icon: AlertTriangle, badgeBg: 'bg-[var(--color-warning-soft)]', badgeFg: 'text-[var(--color-warning-fg)]', iconColor: 'text-[var(--color-warning)]' },
  info: { icon: Info, badgeBg: 'bg-[var(--color-info-soft)]', badgeFg: 'text-[var(--color-info-fg)]', iconColor: 'text-[var(--color-info)]' },
};

interface Props {
  anomalia: AnomaliaFrete | null;
  open: boolean;
  onClose: () => void;
  fretesTodos: Frete[];
  insumoNome: Map<string, string>;
  onEditFrete: (f: Frete) => void;
  verificada?: AnomaliaFreteCheck | null;
  onMarcarVerificada?: (anomaliaId: string) => void;
  onDesfazerVerificacao?: (anomaliaId: string) => void;
}

export default function AnomaliaFreteDrawer({
  anomalia, open, onClose, fretesTodos, insumoNome, onEditFrete,
  verificada, onMarcarVerificada, onDesfazerVerificacao,
}: Props) {
  const fretesAfetados = useMemo(() => {
    if (!anomalia) return [];
    const ids = new Set(anomalia.affectedFreteIds);
    return fretesTodos.filter((f) => ids.has(f.id));
  }, [anomalia, fretesTodos]);

  if (!anomalia) return null;
  const styles = SEVERITY_STYLES[anomalia.severity];
  const Icon = styles.icon;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={anomalia.title}
      subtitle={`${FRETE_DETECTOR_LABEL[anomalia.detector]} · ${anomalia.data}`}
      width="lg"
    >
      <div className="space-y-4">
        <div className={`rounded-lg p-3 flex items-start gap-3 ${styles.badgeBg}`}>
          <Icon className={`w-5 h-5 ${styles.iconColor}`} />
          <div className="flex-1">
            <div className={`text-[11px] font-semibold uppercase ${styles.badgeFg}`}>{SEVERITY_LABEL[anomalia.severity]}</div>
            <p className="text-sm">{anomalia.description}</p>
            {anomalia.acaoSugerida && <p className="text-[12px] italic mt-1 text-[var(--color-fg-muted)]">↳ {anomalia.acaoSugerida}</p>}
          </div>
        </div>

        {verificada ? (
          <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] p-3 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase">Verificada</div>
              <p className="text-sm">{verificada.checkedBy ? `por ${verificada.checkedBy} · ` : ''}{verificada.checkedAt.slice(0, 16).replace('T', ' ')}</p>
              {verificada.motivo && <p className="text-[11px] italic">"{verificada.motivo}"</p>}
            </div>
            {onDesfazerVerificacao && (
              <Button type="button" variant="secondary" onClick={() => onDesfazerVerificacao(anomalia.id)}>
                <Undo2 className="w-3.5 h-3.5" /> Desfazer
              </Button>
            )}
          </div>
        ) : onMarcarVerificada ? (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => onMarcarVerificada(anomalia.id)}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como verificada
            </Button>
          </div>
        ) : null}

        <div>
          <div className="text-[11px] font-semibold uppercase text-[var(--color-fg-muted)] mb-2">Fretes afetados ({fretesAfetados.length})</div>
          <FretesAfetadosList fretes={fretesAfetados} insumoNome={insumoNome} onEditFrete={onEditFrete} />
        </div>
      </div>
    </Drawer>
  );
}
```

Nota: confirmar que `src/components/ui/Button.tsx` existe e aceita `variant="secondary"` (usado pelo AnomaliaDrawer do combustível). Se o import/variant divergir, alinhar com o que o `AnomaliaDrawer.tsx` do combustível usa.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/frete/anomalias/AnomaliaFreteDrawer.tsx
git commit -m "feat(frete): AnomaliaFreteDrawer (detalhe + verificação)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Componente `AnomaliasFreteTab`

**Files:**
- Create: `src/components/frete/anomalias/AnomaliasFreteTab.tsx`

A aba. Espelha `src/components/combustivel/v2/anomalias/AnomaliasTab.tsx` (props 27-52, SEVERITY_STYLES 54-82, JSX 240-391), adaptado a frete e aos 6 detectores.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldCheck, Search } from 'lucide-react';
import Card from '../../ui/Card';
import AnomaliaFreteDrawer from './AnomaliaFreteDrawer';
import {
  detectAnomaliasFrete, type AnomaliaFrete, type Severidade, type FreteDetectorId,
  SEVERITY_LABEL, FRETE_DETECTOR_LABEL,
} from './detect';
import type { Frete, PedidoMaterial, Fornecedor } from '../../../types';
import type { AnomaliaFreteCheck } from '../../../hooks/useAnomaliasFreteChecks';

const SEVERITY_STYLES: Record<Severidade, { icon: typeof AlertCircle; badgeBg: string; badgeFg: string; border: string; iconColor: string }> = {
  critical: { icon: AlertCircle, badgeBg: 'bg-[var(--color-danger-soft)]', badgeFg: 'text-[var(--color-danger-fg)]', border: 'border-[var(--color-danger)]/30', iconColor: 'text-[var(--color-danger)]' },
  warning: { icon: AlertTriangle, badgeBg: 'bg-[var(--color-warning-soft)]', badgeFg: 'text-[var(--color-warning-fg)]', border: 'border-[var(--color-warning)]/30', iconColor: 'text-[var(--color-warning)]' },
  info: { icon: Info, badgeBg: 'bg-[var(--color-info-soft)]', badgeFg: 'text-[var(--color-info-fg)]', border: 'border-[var(--color-info)]/30', iconColor: 'text-[var(--color-info)]' },
};

interface Props {
  fretesNoPeriodo: Frete[];
  fretesTodos: Frete[];
  pedidos: PedidoMaterial[];
  fornecedores: Fornecedor[];
  insumoNome: Map<string, string>;
  fornecedorNome: Map<string, string>;
  hoje: string;
  onEditFrete: (f: Frete) => void;
  anomaliasChecks: Map<string, AnomaliaFreteCheck>;
  onMarcarVerificada: (anomaliaId: string) => void;
  onDesfazerVerificacao: (anomaliaId: string) => void;
}

const ALL_SEV: Severidade[] = ['critical', 'warning', 'info'];
const ALL_DET: FreteDetectorId[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

export default function AnomaliasFreteTab(props: Props) {
  const { fretesNoPeriodo, fretesTodos, pedidos, fornecedores, insumoNome, fornecedorNome, hoje,
    onEditFrete, anomaliasChecks, onMarcarVerificada, onDesfazerVerificacao } = props;

  const anomalias = useMemo(
    () => detectAnomaliasFrete({ fretesNoPeriodo, fretesTodos, pedidos, fornecedores, insumoNome, fornecedorNome, hoje }),
    [fretesNoPeriodo, fretesTodos, pedidos, fornecedores, insumoNome, fornecedorNome, hoje],
  );

  const [sevFiltro, setSevFiltro] = useState<Severidade[]>([]);
  const [detFiltro, setDetFiltro] = useState<FreteDetectorId[]>([]);
  const [busca, setBusca] = useState('');
  const [mostrarVerificadas, setMostrarVerificadas] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visiveis = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return anomalias.filter((a) => {
      const verificada = anomaliasChecks.has(a.id);
      if (verificada && !mostrarVerificadas) return false;
      if (sevFiltro.length && !sevFiltro.includes(a.severity)) return false;
      if (detFiltro.length && !detFiltro.includes(a.detector)) return false;
      if (q && !`${a.title} ${a.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [anomalias, anomaliasChecks, mostrarVerificadas, sevFiltro, detFiltro, busca]);

  const naoVerificadas = anomalias.filter((a) => !anomaliasChecks.has(a.id));
  const verificadasCount = anomalias.length - naoVerificadas.length;
  const selected = anomalias.find((a) => a.id === selectedId) ?? null;

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  if (anomalias.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-[var(--color-success)]">
          <ShieldCheck className="w-5 h-5" />
          <p className="text-sm font-medium">Sem anomalias detectadas no período.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--color-fg-muted)]">
        {naoVerificadas.length} anomalia(s) em aberto{verificadasCount > 0 ? ` · ${verificadasCount} verificada(s)` : ''}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <aside className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase text-[var(--color-fg-muted)] mb-1.5">Severidade</div>
            <div className="flex flex-col gap-1">
              {ALL_SEV.map((s) => {
                const n = naoVerificadas.filter((a) => a.severity === s).length;
                const on = sevFiltro.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggle(sevFiltro, s, setSevFiltro)}
                    className={`text-left text-sm px-2 py-1 rounded flex justify-between ${on ? 'bg-[var(--color-surface-2)] font-semibold' : 'hover:bg-[var(--color-surface-1)]'}`}>
                    <span>{SEVERITY_LABEL[s]}</span><span className="text-[var(--color-fg-muted)]">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-[var(--color-fg-muted)] mb-1.5">Tipo</div>
            <div className="flex flex-col gap-1">
              {ALL_DET.map((d) => {
                const n = naoVerificadas.filter((a) => a.detector === d).length;
                const on = detFiltro.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggle(detFiltro, d, setDetFiltro)}
                    className={`text-left text-xs px-2 py-1 rounded flex justify-between gap-2 ${on ? 'bg-[var(--color-surface-2)] font-semibold' : 'hover:bg-[var(--color-surface-1)]'}`}>
                    <span>{d} · {FRETE_DETECTOR_LABEL[d]}</span><span className="text-[var(--color-fg-muted)]">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {verificadasCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={mostrarVerificadas} onChange={(e) => setMostrarVerificadas(e.target.checked)} />
              Mostrar verificadas ({verificadasCount})
            </label>
          )}
          {(sevFiltro.length || detFiltro.length || busca) ? (
            <button type="button" className="text-xs text-[var(--color-accent)]" onClick={() => { setSevFiltro([]); setDetFiltro([]); setBusca(''); }}>
              Limpar filtros
            </button>
          ) : null}
        </aside>

        <section className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[var(--color-fg-muted)]" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar anomalia..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface-1)]" />
          </div>
          {visiveis.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)] italic py-4">Nenhuma anomalia bate com os filtros atuais.</p>
          ) : visiveis.map((a) => {
            const st = SEVERITY_STYLES[a.severity];
            const I = st.icon;
            return (
              <button key={a.id} type="button" onClick={() => setSelectedId(a.id)}
                className={`w-full text-left rounded-lg border ${st.border} p-3 hover:bg-[var(--color-surface-1)] transition-colors`}>
                <div className="flex items-center gap-2 mb-1">
                  <I className={`w-4 h-4 ${st.iconColor}`} />
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${st.badgeBg} ${st.badgeFg}`}>{SEVERITY_LABEL[a.severity]}</span>
                  <span className="text-[10px] text-[var(--color-fg-muted)]">{a.detector} · {a.data}</span>
                  {anomaliasChecks.has(a.id) && <span className="text-[10px] text-[var(--color-success)]">✓ verificada</span>}
                </div>
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs text-[var(--color-fg-muted)]">{a.description}</div>
              </button>
            );
          })}
        </section>
      </div>

      <AnomaliaFreteDrawer
        anomalia={selected}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        fretesTodos={fretesTodos}
        insumoNome={insumoNome}
        onEditFrete={onEditFrete}
        verificada={selected ? anomaliasChecks.get(selected.id) ?? null : null}
        onMarcarVerificada={onMarcarVerificada}
        onDesfazerVerificacao={onDesfazerVerificacao}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. (Se `--color-surface-2` não existir como variável, trocar por `--color-surface-1`; conferir variáveis em `src/index.css`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/frete/anomalias/AnomaliasFreteTab.tsx
git commit -m "feat(frete): AnomaliasFreteTab (lista + filtros + drawer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Integrar a aba em `Frete.tsx`

**Files:**
- Modify: `src/pages/Frete.tsx`

Adicionar a aba "anomalias" seguindo o padrão das abas existentes (tipo `Tab`, `validTabs`, `permByTab`, trigger, content). Reusa a chave `ver_frete` (sem chave nova). A detecção de anomalias usa todos os fretes para F3 e os fretes filtrados pelo período/obra do topo para o resto.

- [ ] **Step 1: Importar dependências** (topo do arquivo, junto aos outros imports)

```tsx
import AnomaliasFreteTab from '../components/frete/anomalias/AnomaliasFreteTab';
import { useAnomaliasFreteChecks, useMarcarAnomaliaFreteVerificada, useDesfazerVerificacaoAnomaliaFrete } from '../hooks/useAnomaliasFreteChecks';
import { AlertTriangle } from 'lucide-react';
```

(Se `AlertTriangle` já estiver importado de `lucide-react`, não duplicar — adicionar ao import existente.)

- [ ] **Step 2: Adicionar a aba ao tipo e às listas de permissão** (linhas ~47 e ~64-72)

Trocar o tipo `Tab`:
```tsx
type Tab = 'dashboard' | 'fretes' | 'pagamentos' | 'conta_corrente' | 'pedidos' | 'anomalias' | 'lixeira';
```

Em `validTabs` e `permByTab` incluir `anomalias` reusando `ver_frete`:
```tsx
const validTabs: Tab[] = ['dashboard', 'fretes', 'pagamentos', 'conta_corrente', 'pedidos', 'anomalias', 'lixeira'];
const permByTab: Record<Tab, string> = {
  dashboard: 'aba_frete_dashboard',
  fretes: 'aba_frete_fretes',
  pagamentos: 'aba_frete_pagamentos',
  conta_corrente: 'aba_frete_conta_corrente',
  pedidos: 'aba_frete_pedidos',
  anomalias: 'ver_frete',
  lixeira: 'aba_frete_lixeira',
};
```

- [ ] **Step 3: Adicionar hooks de checks + dados derivados** (junto aos outros hooks, após `usePedidosMaterial`, ~linha 90)

```tsx
const { data: anomaliasFreteChecks = new Map() } = useAnomaliasFreteChecks();
const marcarAnomaliaFrete = useMarcarAnomaliaFreteVerificada();
const desfazerAnomaliaFrete = useDesfazerVerificacaoAnomaliaFrete();
const insumoNomeMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
const fornecedorNomeMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
const hojeIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
```

(Confirmar que `useMemo` está importado de `react` no arquivo; provavelmente sim.)

Para o `checkedBy`: usar o nome do usuário logado do AuthContext já disponível na página (procurar como outras telas pegam, ex: `const { funcionario } = useAuth()` ou similar). Definir:
```tsx
const checkedByNome = /* nome do usuário logado, padrão do projeto (ex: funcionario?.nome ?? null) */ null;
```
(Se a página não tiver acesso simples ao nome, passar `null` no v1 — a coluna aceita null.)

- [ ] **Step 4: Adicionar o `TabsTrigger`** (dentro da `TabsList`, após o trigger de `pedidos`)

```tsx
{allowedTabs.includes('anomalias') && (
  <TabsTrigger value="anomalias" className="gap-1.5">
    <AlertTriangle className="w-3.5 h-3.5" />
    Anomalias
  </TabsTrigger>
)}
```

- [ ] **Step 5: Adicionar o `TabsContent`** (após o `<TabsContent value="pedidos">...</TabsContent>`)

```tsx
<TabsContent value="anomalias">
  <AnomaliasFreteTab
    fretesNoPeriodo={fretes}
    fretesTodos={fretes}
    pedidos={pedidosMaterial}
    fornecedores={fornecedores}
    insumoNome={insumoNomeMap}
    fornecedorNome={fornecedorNomeMap}
    hoje={hojeIso}
    onEditFrete={(f) => { setEditando(f); setModalOpen(true); }}
    anomaliasChecks={anomaliasFreteChecks}
    onMarcarVerificada={(id) => marcarAnomaliaFrete.mutate({ anomaliaId: id, checkedBy: checkedByNome })}
    onDesfazerVerificacao={(id) => desfazerAnomaliaFrete.mutate(id)}
  />
</TabsContent>
```

Nota: `setEditando`/`setModalOpen` são os setters do modal de edição de frete já existentes na página — confirmar os nomes reais (procurar onde o `FreteForm`/modal de frete é aberto a partir do `FreteListV2.onEdit`) e usar os mesmos. `fretesNoPeriodo` e `fretesTodos` recebem `fretes` (o filtro de período/obra do topo da página, se houver um estado de filtro aplicado a `fretes` antes de renderizar, usar a versão filtrada para `fretesNoPeriodo`).

- [ ] **Step 6: Typecheck + build + testes**

Run: `npx tsc --noEmit` → Expected: sem erros.
Run: `npx vitest run src/components/frete` → Expected: PASS (inclui detect.test.ts).
Run: `npm run build` → Expected: `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Frete.tsx
git commit -m "feat(frete): aba Anomalias na página de frete (reusa ver_frete)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Verificação manual no app

**Files:** nenhum (validação).

- [ ] **Step 1: Subir local**

Run: `npm run dev` e abrir `/frete?tab=anomalias`.

- [ ] **Step 2: Conferir**

- A aba "Anomalias" aparece. A lista mostra anomalias reais (ex: F1 das notas BGS 108,63/112,35 se ainda estiverem no banco; F3 saldo negativo se houver).
- Filtros de severidade e tipo funcionam; busca funciona.
- Abrir uma anomalia → drawer com detalhe + lista de fretes + botão "Marcar como verificada".
- Marcar verificada → some da lista (com toggle "mostrar verificadas" OFF); reaparece com toggle ON e botão "Desfazer".
- "Editar frete" no drawer abre o modal de edição de frete.

- [ ] **Step 3: Relatar resultado ao Tiago** e decidir deploy (push da branch / merge na main) — deploy só com ok dele.

---

## Notas de execução

- **Deploy/push:** o Tiago aprova o deploy explicitamente (dizendo "deploy"). A migration (Task 7) é escrita de schema em produção — aplicar via MCP só com confirmação dele.
- **Variáveis CSS:** os componentes usam `--color-danger/warning/info/success` + `-soft`/`-fg`, `--color-surface-1/2`, `--color-border`, `--color-accent`, `--color-fg-muted`. Conferir em `src/index.css` que existem (o combustível usa as mesmas). Ajustar nomes se divergir.
- **`Button` variant:** confirmar a API real de `src/components/ui/Button.tsx` (o AnomaliaDrawer do combustível é a referência de uso).
