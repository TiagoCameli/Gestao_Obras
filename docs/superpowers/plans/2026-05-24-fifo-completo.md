# FIFO Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o FIFO de combustível pra capturar **TODAS** as fontes físicas de consumo (carretas, transferências OUT, esvaziamentos) — não só saídas equipamento_proprio. Backfill recomputado, saldos FIFO == saldo físico em todos os tanques.

**Architecture:** Tabela polimórfica `consumos_lote` (renomeada de `saidas_lotes`) com `consumo_tipo` enum cobrindo as 4 fontes. Helper TS recebe `consumosAnteriores` em vez de só `saidasAnteriores`. 2 RPCs novas (transferência + esvaziamento), update da RPC de saída. Card FIFO sempre visível em desktop. Backfill atomic.

**Tech Stack:** PostgreSQL (Supabase MCP), React 19 + TypeScript, vitest.

**Spec fonte:** `docs/superpowers/specs/2026-05-24-fifo-completo-design.md`

**Branch:** `fix/combustivel-fifo-completo` (baseada em main).

---

## File Structure

**Migrations SQL:**
- `supabase/migrations/20260524100000_rename_consumos_lote.sql` — rename `saidas_lotes` → `consumos_lote` + add `consumo_tipo` + view backward-compat
- `supabase/migrations/20260524100100_esvaziamentos_valor_perda.sql` — adiciona `valor_perda` em `esvaziamentos_tanque`
- `supabase/migrations/20260524100200_update_registrar_saida_fifo.sql` — RPC de saída usa `consumos_lote`
- `supabase/migrations/20260524100300_rpc_registrar_transferencia_fifo.sql` — RPC nova
- `supabase/migrations/20260524100400_rpc_registrar_esvaziamento_fifo.sql` — RPC nova
- `supabase/migrations/20260524100500_backfill_fifo_completo.sql` — TRUNCATE + replay
- `supabase/migrations/20260524100600_reconciliacao_validation.sql` — view + assert

**TS modificados:**
- `src/utils/fifoCombustivel.ts` — signature muda (consumosAnteriores)
- `src/utils/fifoCombustivel.test.ts` — atualizar 8 testes + adicionar 4
- `src/hooks/useSaidasCombustivel.ts` — RPC saída chama nova versão
- `src/hooks/useTransferenciasCombustivel.ts` — adicionar `useRegistrarTransferenciaFIFO`
- `src/hooks/useEsvaziamentos.ts` — adicionar `useRegistrarEsvaziamentoFIFO` (criar se não existir)

**TS novos:**
- `src/components/combustivel/v2/shared/FIFOCard.tsx` — componente compartilhado (saída + transferência + esvaziamento)
- `src/components/combustivel/v2/shared/FIFOCard.test.tsx` — testes

**TS modificados (forms):**
- `src/components/combustivel/SaidaCombustivelForm.tsx` — substituir `<details>` por `<FIFOCard>`
- `src/components/combustivel/TransferenciaForm.tsx` — adicionar `<FIFOCard>` + valor read-only + nova RPC
- `src/components/combustivel/EsvaziamentoForm.tsx` — criar OU atualizar (depende de discovery)
- `src/pages/mobile/MSaidaCombustivelPage.tsx` — indicador "FIFO" pequeno (sem card)

---

## Task FC.0: Branch setup

- [ ] **Step 1: Branch**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
git checkout main && git pull origin main
git checkout -b fix/combustivel-fifo-completo
git branch --show-current
```

Expected: `fix/combustivel-fifo-completo`

---

## Task FC.1: Schema — rename `saidas_lotes` → `consumos_lote` polimórfico

**Files:**
- Create: `supabase/migrations/20260524100000_rename_consumos_lote.sql`

### Step 1: Discovery — confirmar schema atual

Via MCP `mcp__plugin_supabase_supabase__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='saidas_lotes'
ORDER BY ordinal_position;

SELECT policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='saidas_lotes';

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='saidas_lotes';

SELECT COUNT(*) FROM public.saidas_lotes;
```

Esperado: 7 colunas (id, saida_id, fonte_tipo, fonte_id, litros, preco_lote, created_at), 4 policies, 2 indexes (saida_id, fonte), ~781 rows.

### Step 2: Criar migration

Write `supabase/migrations/20260524100000_rename_consumos_lote.sql`:

```sql
-- =============================================================================
-- FC.1 — Rename saidas_lotes → consumos_lote (polymorphic).
-- =============================================================================
-- Adiciona consumo_tipo enum + renomeia saida_id → consumo_id.
-- Drop FK rígida pra saidas_combustivel (consumo_id passa a referenciar
-- 1 de 3 tabelas dependendo de consumo_tipo).
-- Cria VIEW saidas_lotes pra backward compat de consumers existentes.
--
-- Spec: docs/superpowers/specs/2026-05-24-fifo-completo-design.md

-- 1. Drop FK rígida (consumo_id agora é polimórfico)
ALTER TABLE public.saidas_lotes DROP CONSTRAINT IF EXISTS fk_saidas_lotes_saida;

-- 2. Rename tabela
ALTER TABLE public.saidas_lotes RENAME TO consumos_lote;

-- 3. Rename coluna saida_id → consumo_id
ALTER TABLE public.consumos_lote RENAME COLUMN saida_id TO consumo_id;

-- 4. Add consumo_tipo (com default 'saida' pra backfill dos 781 rows existentes)
ALTER TABLE public.consumos_lote
  ADD COLUMN consumo_tipo text NOT NULL DEFAULT 'saida'
  CHECK (consumo_tipo IN ('saida', 'transferencia_out', 'esvaziamento'));

-- 5. Drop default (forçar callers a preencher explicitamente)
ALTER TABLE public.consumos_lote ALTER COLUMN consumo_tipo DROP DEFAULT;

-- 6. Recriar indexes (renomeando os antigos)
DROP INDEX IF EXISTS idx_saidas_lotes_saida_id;
DROP INDEX IF EXISTS idx_saidas_lotes_fonte;
CREATE INDEX idx_consumos_lote_consumo ON public.consumos_lote(consumo_tipo, consumo_id);
CREATE INDEX idx_consumos_lote_fonte ON public.consumos_lote(fonte_tipo, fonte_id);

-- 7. Renomear policies (mantém comportamento)
ALTER POLICY saidas_lotes_select ON public.consumos_lote RENAME TO consumos_lote_select;
ALTER POLICY saidas_lotes_insert ON public.consumos_lote RENAME TO consumos_lote_insert;
ALTER POLICY saidas_lotes_admin_update ON public.consumos_lote RENAME TO consumos_lote_admin_update;
ALTER POLICY saidas_lotes_admin_delete ON public.consumos_lote RENAME TO consumos_lote_admin_delete;

-- 8. VIEW de compat backward — pros consumers que ainda usam saidas_lotes
CREATE VIEW public.saidas_lotes WITH (security_invoker = true) AS
  SELECT id, consumo_id AS saida_id, fonte_tipo, fonte_id, litros, preco_lote, created_at
  FROM public.consumos_lote
  WHERE consumo_tipo = 'saida';

COMMENT ON VIEW public.saidas_lotes IS
  'Compat backward: filtra consumos_lote por consumo_tipo=saida. Novos códigos devem usar consumos_lote diretamente.';
```

> **Nota security_invoker=true:** Postgres 15+. View herda RLS do user invocador, não bypass.

### Step 3: Apply via MCP

Use `mcp__plugin_supabase_supabase__apply_migration` com name `rename_consumos_lote`.

### Step 4: Verify

```sql
-- Tabela renomeada existe
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('saidas_lotes', 'consumos_lote');
-- Expected: 2 rows (consumos_lote = table, saidas_lotes = view)

-- consumo_tipo populado nos 781 rows existentes
SELECT consumo_tipo, COUNT(*) FROM public.consumos_lote GROUP BY consumo_tipo;
-- Expected: saida=781

-- View funciona
SELECT COUNT(*) FROM public.saidas_lotes;
-- Expected: 781

-- Indexes ok
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='consumos_lote';
-- Expected: 2 + PK
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260524100000_rename_consumos_lote.sql
git commit -m "fix(combustivel): rename saidas_lotes → consumos_lote (polymorphic)

Pré-req do FIFO completo: tabela polimórfica que cobre 3 tipos de
consumo (saida, transferencia_out, esvaziamento). Antes só capturava
saída.

Existing 781 rows ficam com consumo_tipo='saida' (backfill via DEFAULT
dropado depois). Drop FK rígida (consumo_id agora referencia 1 de 3
tabelas). View saidas_lotes pra backward compat de consumers existentes.

Spec: docs/superpowers/specs/2026-05-24-fifo-completo-design.md"
```

---

## Task FC.2: Schema — adicionar `valor_perda` em `esvaziamentos_tanque`

**Files:**
- Create: `supabase/migrations/20260524100100_esvaziamentos_valor_perda.sql`

### Step 1: Verificar schema atual

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='esvaziamentos_tanque'
ORDER BY ordinal_position;
```
Esperado: id, deposito_id, litros_descartados, motivo, criado_por, created_at, data_hora.

### Step 2: Criar migration

Write `supabase/migrations/20260524100100_esvaziamentos_valor_perda.sql`:

```sql
-- =============================================================================
-- FC.2 — Adicionar valor_perda em esvaziamentos_tanque
-- =============================================================================
-- Esvaziamento = perda física. valor_perda = SUM(litros × preco_lote FIFO
-- dos lotes consumidos). Computado server-side pela RPC nova
-- registrar_esvaziamento_fifo.
--
-- Default 0 pra rows existentes (serão repopuladas pelo backfill).

ALTER TABLE public.esvaziamentos_tanque
  ADD COLUMN IF NOT EXISTS valor_perda numeric NOT NULL DEFAULT 0 CHECK (valor_perda >= 0);

COMMENT ON COLUMN public.esvaziamentos_tanque.valor_perda IS
  'Perda monetária = SUM(litros_consumidos × preco_lote) dos lotes FIFO afetados.';
```

### Step 3: Apply

`apply_migration` com name `esvaziamentos_valor_perda`.

### Step 4: Verify

```sql
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='esvaziamentos_tanque' AND column_name='valor_perda';
-- Expected: 1 row, numeric, default 0
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260524100100_esvaziamentos_valor_perda.sql
git commit -m "fix(combustivel): adiciona valor_perda em esvaziamentos_tanque

Perda monetária computada server-side pela RPC nova (FC.4). Default 0
pra rows existentes (repopuladas pelo backfill FC.6)."
```

---

## Task FC.3: Helper TS atualizado + tests (TDD)

**Files:**
- Modify: `src/utils/fifoCombustivel.ts`
- Modify: `src/utils/fifoCombustivel.test.ts`

### Step 1: Failing tests primeiro

Substituir conteúdo de `src/utils/fifoCombustivel.test.ts` por:

```typescript
import { describe, it, expect } from 'vitest'
import { calcularPrecoFIFO, type ConsumoAnterior } from './fifoCombustivel'
import type { EntradaCombustivel, TransferenciaCombustivel } from '../types'

const ent = (id: string, depositoId: string, dataHora: string, litros: number, valor: number): EntradaCombustivel => ({
  id, dataHora, depositoId,
  tipoCombustivel: 'd',
  quantidadeLitros: litros,
  valorTotal: valor,
  fornecedor: 'f', notaFiscal: '', observacoes: '', criadoPor: '',
}) as EntradaCombustivel

const trans = (id: string, destinoId: string, dataHora: string, litros: number, valor: number): TransferenciaCombustivel => ({
  id, dataHora,
  depositoOrigemId: 'outro',
  depositoDestinoId: destinoId,
  quantidadeLitros: litros,
  valorTotal: valor,
  observacoes: '', criadoPor: '',
}) as TransferenciaCombustivel

const consumo = (tipo: 'saida' | 'transferencia_out' | 'esvaziamento', tanqueId: string, data: string, litros: number): ConsumoAnterior => ({
  tipo, tanqueId, data, litros,
})

describe('calcularPrecoFIFO', () => {
  it('1 lote único — porção tem saldoAntesDoConsumo correto', () => {
    const entradas = [ent('e1', 't1', '2026-01-01T08:00:00', 10000, 55000)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-02T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.precoMedio).toBe(5.5)
    expect(r.detalhamento).toEqual([
      {
        fonteTipo: 'entrada',
        fonteId: 'e1',
        fonteDataHora: '2026-01-01T08:00:00',
        saldoAntesDoConsumo: 10000,
        litros: 100,
        preco: 5.5,
      },
    ])
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('2 lotes — exemplo 70/30 reflete saldoAntesDoConsumo correto', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00', 10000, 55000),
      ent('B', 't1', '2026-01-10T08:00:00', 2000, 12000),
    ]
    const consumosAnteriores = [consumo('saida', 't1', '2026-01-05T08:00:00', 9930)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.precoMedio).toBeCloseTo(5.65, 4)
    expect(r.detalhamento).toEqual([
      {
        fonteTipo: 'entrada',
        fonteId: 'A',
        fonteDataHora: '2026-01-01T08:00:00',
        saldoAntesDoConsumo: 70,  // 10000 - 9930 (consumo anterior)
        litros: 70,
        preco: 5.5,
      },
      {
        fonteTipo: 'entrada',
        fonteId: 'B',
        fonteDataHora: '2026-01-10T08:00:00',
        saldoAntesDoConsumo: 2000,  // ainda intocado
        litros: 30,
        preco: 6.0,
      },
    ])
  })

  it('consumo anterior tipo transferencia_out reduz saldo', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5500)]
    const consumosAnteriores = [consumo('transferencia_out', 't1', '2026-01-05T08:00:00', 800)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(200)
    expect(r.precoMedio).toBe(5.5)
  })

  it('consumo anterior tipo esvaziamento reduz saldo', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 6000)]
    const consumosAnteriores = [consumo('esvaziamento', 't1', '2026-01-05T08:00:00', 500)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 200,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(500)
    expect(r.detalhamento[0].litros).toBe(200)
    expect(r.precoMedio).toBe(6.0)
  })

  it('ordem cronológica mistura saídas + transf_out + esvaziamentos', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5000)]
    const consumosAnteriores = [
      consumo('saida', 't1', '2026-01-05T08:00:00', 200),
      consumo('transferencia_out', 't1', '2026-01-03T08:00:00', 100),
      consumo('esvaziamento', 't1', '2026-01-07T08:00:00', 50),
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    // Total consumido antes = 200+100+50 = 350. Saldo = 1000-350 = 650.
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(650)
    expect(r.detalhamento[0].litros).toBe(100)
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('saída sem lote anterior — litrosSemSuprimento total', () => {
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-01T08:00:00', litros: 100,
      entradas: [], transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.precoMedio).toBe(0)
    expect(r.detalhamento).toEqual([])
    expect(r.litrosSemSuprimento).toBe(100)
  })

  it('saída parcialmente suprida', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 50, 275)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-02T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.detalhamento[0].litros).toBe(50)
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(50)
    expect(r.litrosSemSuprimento).toBe(50)
  })

  it('ignora entradas futuras (após data da operação)', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00', 100, 550),
      ent('B', 't1', '2026-02-01T08:00:00', 100, 800),
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 50,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.detalhamento).toEqual([
      {
        fonteTipo: 'entrada',
        fonteId: 'A',
        fonteDataHora: '2026-01-01T08:00:00',
        saldoAntesDoConsumo: 100,
        litros: 50,
        preco: 5.5,
      },
    ])
  })

  it('transferências IN tratadas como lote', () => {
    const transferenciasIn = [trans('T1', 't1', '2026-01-01T08:00:00', 200, 1200)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 100,
      entradas: [], transferenciasIn, consumosAnteriores: [],
    })
    expect(r.detalhamento[0].fonteTipo).toBe('transferencia')
    expect(r.detalhamento[0].fonteId).toBe('T1')
    expect(r.precoMedio).toBe(6.0)
  })

  it('ordena lotes por data ASC, independente da ordem input', () => {
    const entradas = [
      ent('B', 't1', '2026-01-10T08:00:00', 2000, 12000),
      ent('A', 't1', '2026-01-01T08:00:00', 100, 550),
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 150,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.detalhamento[0].fonteId).toBe('A')
    expect(r.detalhamento[1].fonteId).toBe('B')
  })

  it('consumos de OUTROS tanques são ignorados', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5000)]
    const consumosAnteriores = [consumo('saida', 't2', '2026-01-05T08:00:00', 500)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(1000)
  })

  it('consumos futuros (data > esta operação) são ignorados', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5000)]
    const consumosAnteriores = [consumo('saida', 't1', '2026-02-01T08:00:00', 500)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(1000)
  })
})
```

### Step 2: Run failing tests

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm test src/utils/fifoCombustivel.test.ts -- --run 2>&1 | tail -20
```
Expected: FAIL (signature mudou; tipos não existem).

### Step 3: Reescrever helper

Substituir conteúdo de `src/utils/fifoCombustivel.ts`:

```typescript
import type { EntradaCombustivel, TransferenciaCombustivel } from '../types'

export type FonteTipo = 'entrada' | 'transferencia'
export type ConsumoTipo = 'saida' | 'transferencia_out' | 'esvaziamento'

export interface ConsumoAnterior {
  tipo: ConsumoTipo
  data: string          // wall-clock ISO
  litros: number
  tanqueId: string
}

export interface PorcaoConsumida {
  fonteTipo: FonteTipo
  fonteId: string
  fonteDataHora: string         // pra UI mostrar "Lote de DD/MM HH:MM"
  saldoAntesDoConsumo: number   // pra UI mostrar saldo do lote ANTES desta operação
  litros: number
  preco: number
}

export interface FIFOInput {
  tanqueId: string
  dataHora: string
  litros: number
  entradas: EntradaCombustivel[]
  transferenciasIn: TransferenciaCombustivel[]
  consumosAnteriores: ConsumoAnterior[]
}

export interface FIFOResult {
  precoMedio: number
  detalhamento: PorcaoConsumida[]
  litrosSemSuprimento: number
}

interface LoteSaldo {
  fonteTipo: FonteTipo
  fonteId: string
  dataHora: string
  litrosOriginal: number
  precoUnitario: number
  saldoRestante: number
}

/**
 * Calcula preço FIFO real consumindo lotes em ordem cronológica.
 *
 * Algoritmo:
 * 1. Lista todos os lotes do tanque (entradas + transferenciasIn) ATÉ a data desta operação
 * 2. Ordena lotes por data ASC (FIFO)
 * 3. Replay dos consumos anteriores (saidas + transf_out + esvaziamentos) em ordem cronológica
 *    para reduzir o saldo dos lotes
 * 4. Captura saldoAntesDoConsumo no momento de consumir cada lote por esta operação
 * 5. Consome esta operação dos lotes restantes em ordem
 * 6. Retorna {precoMedio (média ponderada), detalhamento, litrosSemSuprimento}
 */
export function calcularPrecoFIFO(input: FIFOInput): FIFOResult {
  const { tanqueId, dataHora, litros, entradas, transferenciasIn, consumosAnteriores } = input

  // 1. Monta lista de lotes ATÉ a data da operação (wall-clock string comparison)
  const saldos: LoteSaldo[] = []
  for (const e of entradas) {
    if (e.depositoId === tanqueId && e.dataHora <= dataHora) {
      saldos.push({
        fonteTipo: 'entrada',
        fonteId: e.id,
        dataHora: e.dataHora,
        litrosOriginal: e.quantidadeLitros,
        precoUnitario: e.quantidadeLitros > 0 ? e.valorTotal / e.quantidadeLitros : 0,
        saldoRestante: e.quantidadeLitros,
      })
    }
  }
  for (const t of transferenciasIn) {
    if (t.depositoDestinoId === tanqueId && t.dataHora <= dataHora) {
      saldos.push({
        fonteTipo: 'transferencia',
        fonteId: t.id,
        dataHora: t.dataHora,
        litrosOriginal: t.quantidadeLitros,
        precoUnitario: t.quantidadeLitros > 0 ? t.valorTotal / t.quantidadeLitros : 0,
        saldoRestante: t.quantidadeLitros,
      })
    }
  }

  // 2. Ordena lotes por dataHora ASC, desempata por fonteId
  saldos.sort((a, b) => {
    const cmp = a.dataHora.localeCompare(b.dataHora)
    return cmp !== 0 ? cmp : a.fonteId.localeCompare(b.fonteId)
  })

  // 3. Replay consumos anteriores (qualquer tipo) em ordem cronológica
  const consumosOrdenados = consumosAnteriores
    .filter((c) => c.tanqueId === tanqueId && c.data < dataHora)
    .sort((a, b) => a.data.localeCompare(b.data))

  for (const c of consumosOrdenados) {
    let restante = c.litros
    for (const lote of saldos) {
      if (restante <= 0) break
      if (lote.saldoRestante <= 0) continue
      const consome = Math.min(restante, lote.saldoRestante)
      lote.saldoRestante -= consome
      restante -= consome
    }
  }

  // 4-5. Consome esta operação, capturando saldoAntesDoConsumo
  let faltando = litros
  const detalhamento: PorcaoConsumida[] = []
  for (const lote of saldos) {
    if (faltando <= 0) break
    if (lote.saldoRestante <= 0) continue
    const saldoAntes = lote.saldoRestante
    const consome = Math.min(faltando, saldoAntes)
    detalhamento.push({
      fonteTipo: lote.fonteTipo,
      fonteId: lote.fonteId,
      fonteDataHora: lote.dataHora,
      saldoAntesDoConsumo: saldoAntes,
      litros: consome,
      preco: lote.precoUnitario,
    })
    lote.saldoRestante -= consome
    faltando -= consome
  }

  // 6. Média ponderada das porções consumidas
  const litrosSupridos = detalhamento.reduce((s, p) => s + p.litros, 0)
  const valorSuprido = detalhamento.reduce((s, p) => s + p.litros * p.preco, 0)
  const precoMedio = litrosSupridos > 0 ? valorSuprido / litrosSupridos : 0

  return {
    precoMedio,
    detalhamento,
    litrosSemSuprimento: faltando,
  }
}
```

### Step 4: Run tests PASS

```bash
npm test src/utils/fifoCombustivel.test.ts -- --run 2>&1 | tail -20
```
Expected: 12 passing.

### Step 5: Build + suite

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
```

> **CUIDADO:** O `useSaidasCombustivel.ts` (consumer atual do helper) provavelmente vai quebrar TS porque a signature mudou. Esse caso é OK porque FC.4 vai reescrever o consumer. Se houver erros TS aqui, deixar — serão fixed em FC.4.

- [ ] **Step 6: Commit (apenas helper + tests)**

```bash
git add src/utils/fifoCombustivel.ts src/utils/fifoCombustivel.test.ts
git commit -m "feat(combustivel): calcularPrecoFIFO aceita consumosAnteriores polimórficos

Helper TS estendido pra capturar TODAS as fontes de consumo de lote:
- ConsumoAnterior.tipo agora é 'saida' | 'transferencia_out' | 'esvaziamento'
- PorcaoConsumida ganha fonteDataHora (pra UI 'Lote de DD/MM HH:MM') e
  saldoAntesDoConsumo (pra UI 'saldo: X L')
- Algoritmo replay consumosAnteriores em ordem cronológica unificada

12 testes vitest cobrindo: 4 cenários originais ajustados + 4 novos
(transf_out, esvaziamento, mistura cronológica, outros tanques).

Esperado: consumers (useSaidasCombustivel.ts) vão dar TS errors até FC.4
ajustar a chamada."
```

---

## Task FC.4: RPC saída usa `consumos_lote` + hook atualizado

**Files:**
- Create: `supabase/migrations/20260524100200_update_registrar_saida_fifo.sql`
- Modify: `src/hooks/useSaidasCombustivel.ts`

### Step 1: Criar migration

Write `supabase/migrations/20260524100200_update_registrar_saida_fifo.sql`:

```sql
-- =============================================================================
-- FC.4 — Update RPC registrar_saida_combustivel_fifo pra usar consumos_lote
-- =============================================================================
-- Insert em consumos_lote (em vez de saidas_lotes direto) com consumo_tipo='saida'.
-- Comportamento idêntico pra equipamento_proprio.
-- Pra carreta (tipo_consumidor='carreta_transportadora'), preserva preco_unitario
-- do payload (preço externo de negociação).

CREATE OR REPLACE FUNCTION public.registrar_saida_combustivel_fifo(
  p_saida jsonb,
  p_lotes jsonb,
  p_litros_sem_suprimento numeric DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_saida_id text;
  v_lote jsonb;
BEGIN
  -- Permission check (defesa em profundidade)
  IF NOT (private.current_has_action('criar_saida_combustivel')
       OR private.current_has_action('criar_abastecimento_carreta')) THEN
    RAISE EXCEPTION 'Permissão negada para registrar saída de combustível';
  END IF;

  -- 1. Insert da saída (preco_unitario do payload — pode ser FIFO ou externo)
  INSERT INTO public.saidas_combustivel (
    id, data, origem, tipo_consumidor, tanque_id, equipamento_id, transportadora_id,
    placa, obra_id, etapa_id, alocacoes, tipo_combustivel, litros,
    preco_medio_tanque_snapshot, taxa_litro, preco_unitario, valor_total,
    preco_combustivel, preco_combustivel_areacre, foto_urls, arquivo_urls,
    observacoes, pago, pago_em, movimento_id, motorista,
    medicao_no_abastecimento, tipo_medicao_snapshot, created_by, updated_by
  ) VALUES (
    p_saida->>'id',
    (p_saida->>'data')::timestamp,
    p_saida->>'origem',
    p_saida->>'tipo_consumidor',
    NULLIF(p_saida->>'tanque_id', ''),
    NULLIF(p_saida->>'equipamento_id', ''),
    NULLIF(p_saida->>'transportadora_id', ''),
    NULLIF(p_saida->>'placa', ''),
    NULLIF(p_saida->>'obra_id', ''),
    NULLIF(p_saida->>'etapa_id', ''),
    p_saida->'alocacoes',
    p_saida->>'tipo_combustivel',
    (p_saida->>'litros')::numeric,
    NULLIF(p_saida->>'preco_medio_tanque_snapshot', '')::numeric,
    COALESCE((p_saida->>'taxa_litro')::numeric, 0),
    (p_saida->>'preco_unitario')::numeric,
    (p_saida->>'valor_total')::numeric,
    NULLIF(p_saida->>'preco_combustivel', '')::numeric,
    NULLIF(p_saida->>'preco_combustivel_areacre', '')::numeric,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_saida->'foto_urls')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_saida->'arquivo_urls')), '{}'),
    p_saida->>'observacoes',
    COALESCE((p_saida->>'pago')::boolean, false),
    NULLIF(p_saida->>'pago_em', '')::timestamptz,
    NULLIF(p_saida->>'movimento_id', ''),
    COALESCE(p_saida->>'motorista', ''),
    NULLIF(p_saida->>'medicao_no_abastecimento', '')::numeric,
    NULLIF(p_saida->>'tipo_medicao_snapshot', ''),
    NULLIF(p_saida->>'created_by', ''),
    NULLIF(p_saida->>'updated_by', '')
  )
  RETURNING id INTO v_saida_id;

  -- 2. Insert dos lotes consumidos (consumo_tipo='saida')
  FOR v_lote IN SELECT * FROM jsonb_array_elements(p_lotes)
  LOOP
    INSERT INTO public.consumos_lote (consumo_tipo, consumo_id, fonte_tipo, fonte_id, litros, preco_lote)
    VALUES (
      'saida',
      v_saida_id,
      v_lote->>'fonte_tipo',
      v_lote->>'fonte_id',
      (v_lote->>'litros')::numeric,
      (v_lote->>'preco_lote')::numeric
    );
  END LOOP;

  -- 3. Audit row se sem suprimento
  IF p_litros_sem_suprimento > 0 THEN
    INSERT INTO public.saidas_sem_suprimento (
      saida_id, tanque_id, data_saida, litros_solicitados,
      litros_supridos, litros_sem_suprimento
    ) VALUES (
      v_saida_id,
      NULLIF(p_saida->>'tanque_id', ''),
      (p_saida->>'data')::timestamp,
      (p_saida->>'litros')::numeric,
      (p_saida->>'litros')::numeric - p_litros_sem_suprimento,
      p_litros_sem_suprimento
    );
  END IF;

  RETURN v_saida_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) TO authenticated;
```

### Step 2: Apply

`apply_migration` com name `update_registrar_saida_fifo`.

### Step 3: Update hook `useSaidasCombustivel.ts`

Find o `useRegistrarSaidaFIFO` (criado em FI.4). Não precisa mudar — ele chama a RPC pelo nome (rota igual). MAS o consumer (SaidaCombustivelForm) chama `calcularPrecoFIFO` com signature antiga (`saidasAnteriores`). Vai precisar atualizar pra:
- Renomear pra `consumosAnteriores`
- Passar consumos de todos os tanques (saídas + transferências out + esvaziamentos) com `tipo`

Pra preservar o build até FC.7 (form), criar um helper adapter em `useSaidasCombustivel.ts`:

```typescript
import { calcularPrecoFIFO, type ConsumoAnterior } from '../utils/fifoCombustivel'
import { useTransferenciasCombustivel } from './useTransferenciasCombustivel'
import { useEsvaziamentos } from './useEsvaziamentos'  // criar em FC.5 se não existir
// (e mantém o import existente de useSaidasCombustivel)

/**
 * Hook que retorna todos os consumosAnteriores no formato do helper.
 * Use em conjunto com calcularPrecoFIFO.
 */
export function useConsumosAnteriores(): ConsumoAnterior[] {
  const { data: saidas = [] } = useSaidasCombustivel()
  const { data: transferencias = [] } = useTransferenciasCombustivel()
  // const { data: esvaziamentos = [] } = useEsvaziamentos()  // descomenta após FC.5

  return [
    ...saidas
      .filter((s) => s.tanqueId)
      .map((s) => ({
        tipo: 'saida' as const,
        data: s.data,
        litros: s.litros,
        tanqueId: s.tanqueId!,
      })),
    ...transferencias
      .filter((t) => t.depositoOrigemId)
      .map((t) => ({
        tipo: 'transferencia_out' as const,
        data: t.dataHora,
        litros: t.quantidadeLitros,
        tanqueId: t.depositoOrigemId,
      })),
    // ...esvaziamentos.map(...) — adicionado em FC.5
  ]
}
```

> **Cuidado:** Se `useEsvaziamentos` não existir ainda, deixar comentado nesta task. FC.5 cria. Aqui só prep.

### Step 4: Build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -10
```
Expected: ainda pode haver erros TS no SaidaCombustivelForm (vai ser fixed em FC.7). Tests passam.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260524100200_update_registrar_saida_fifo.sql \
        src/hooks/useSaidasCombustivel.ts
git commit -m "feat(combustivel): RPC saída usa consumos_lote + hook useConsumosAnteriores

RPC registrar_saida_combustivel_fifo agora insere em consumos_lote (em
vez de saidas_lotes direto) com consumo_tipo='saida'. Comportamento
externo idêntico pra caller.

Hook useConsumosAnteriores agrega consumos de TODAS as fontes
(saidas + transf_out — esvaziamentos pendente FC.5) pra alimentar
calcularPrecoFIFO."
```

---

## Task FC.5: Hook `useEsvaziamentos` + adicionar na agregação

**Files:**
- Create or Modify: `src/hooks/useEsvaziamentos.ts`
- Modify: `src/hooks/useSaidasCombustivel.ts`

### Step 1: Discovery — useEsvaziamentos existe?

```bash
ls src/hooks/useEsvaziamentos.ts 2>/dev/null && echo "EXISTE" || echo "CRIAR"
```

Se EXISTE, ler e usar como referência. Se CRIAR, seguir pattern dos outros hooks.

### Step 2: Criar/atualizar hook

Se criar, conteúdo mínimo de `src/hooks/useEsvaziamentos.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Esvaziamento {
  id: string
  depositoId: string
  litrosDescartados: number
  motivo: string | null
  criadoPor: string | null
  createdAt: string
  dataHora: string
  valorPerda: number
}

function dbToEsvaziamento(row: any): Esvaziamento {
  return {
    id: row.id,
    depositoId: row.deposito_id,
    litrosDescartados: Number(row.litros_descartados),
    motivo: row.motivo,
    criadoPor: row.criado_por,
    createdAt: row.created_at,
    dataHora: row.data_hora,
    valorPerda: Number(row.valor_perda ?? 0),
  }
}

export function useEsvaziamentos() {
  return useQuery<Esvaziamento[]>({
    queryKey: ['esvaziamentos_tanque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('esvaziamentos_tanque')
        .select('*')
        .order('data_hora', { ascending: false })
      if (error) throw error
      return (data ?? []).map(dbToEsvaziamento)
    },
  })
}
```

### Step 3: Atualizar `useConsumosAnteriores` em `useSaidasCombustivel.ts`

Descomentar a parte de esvaziamentos:

```typescript
import { useEsvaziamentos } from './useEsvaziamentos'

export function useConsumosAnteriores(): ConsumoAnterior[] {
  const { data: saidas = [] } = useSaidasCombustivel()
  const { data: transferencias = [] } = useTransferenciasCombustivel()
  const { data: esvaziamentos = [] } = useEsvaziamentos()

  return [
    ...saidas
      .filter((s) => s.tanqueId)
      .map((s) => ({
        tipo: 'saida' as const,
        data: s.data,
        litros: s.litros,
        tanqueId: s.tanqueId!,
      })),
    ...transferencias
      .filter((t) => t.depositoOrigemId)
      .map((t) => ({
        tipo: 'transferencia_out' as const,
        data: t.dataHora,
        litros: t.quantidadeLitros,
        tanqueId: t.depositoOrigemId,
      })),
    ...esvaziamentos.map((e) => ({
      tipo: 'esvaziamento' as const,
      data: e.dataHora,
      litros: e.litrosDescartados,
      tanqueId: e.depositoId,
    })),
  ]
}
```

### Step 4: Build

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEsvaziamentos.ts src/hooks/useSaidasCombustivel.ts
git commit -m "feat(combustivel): hook useEsvaziamentos + agregação completa

useConsumosAnteriores agora inclui esvaziamentos como tipo de consumo.
useEsvaziamentos criado seguindo pattern de useSaidasCombustivel."
```

---

## Task FC.6: RPC `registrar_transferencia_fifo`

**Files:**
- Create: `supabase/migrations/20260524100300_rpc_registrar_transferencia_fifo.sql`
- Modify: `src/hooks/useTransferenciasCombustivel.ts`

### Step 1: Discovery — schema atual de transferencias_combustivel

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='transferencias_combustivel'
ORDER BY ordinal_position;

-- E policies pra saber permissão usada:
SELECT policyname, cmd, qual FROM pg_policies
WHERE schemaname='public' AND tablename='transferencias_combustivel';
```

### Step 2: Criar migration

Write `supabase/migrations/20260524100300_rpc_registrar_transferencia_fifo.sql`:

```sql
-- =============================================================================
-- FC.6 — RPC registrar_transferencia_fifo (atomic)
-- =============================================================================
-- Insert atomico de transferencia + N consumos_lote (consumo_tipo='transferencia_out').
-- valor_total é COMPUTADO server-side: SUM(litros × preco_lote) dos lotes.
-- Cliente NÃO precisa enviar valor_total.

CREATE OR REPLACE FUNCTION public.registrar_transferencia_fifo(
  p_transferencia jsonb,
  p_lotes jsonb,
  p_litros_sem_suprimento numeric DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transf_id text;
  v_lote jsonb;
  v_valor_total numeric := 0;
BEGIN
  -- Permission
  IF NOT private.current_has_action('criar_transferencia_combustivel') THEN
    RAISE EXCEPTION 'Permissão negada para registrar transferência de combustível';
  END IF;

  -- 1. Computar valor_total a partir dos lotes (FIFO)
  SELECT COALESCE(SUM((l->>'litros')::numeric * (l->>'preco_lote')::numeric), 0)
  INTO v_valor_total
  FROM jsonb_array_elements(p_lotes) AS l;

  -- 2. Insert transferencia
  INSERT INTO public.transferencias_combustivel (
    id, data_hora, deposito_origem_id, deposito_destino_id,
    tipo_combustivel, quantidade_litros, valor_total,
    observacoes, criado_por
  ) VALUES (
    p_transferencia->>'id',
    (p_transferencia->>'data_hora')::timestamp,
    p_transferencia->>'deposito_origem_id',
    p_transferencia->>'deposito_destino_id',
    p_transferencia->>'tipo_combustivel',
    (p_transferencia->>'quantidade_litros')::numeric,
    v_valor_total,  -- COMPUTED, não user-entered
    p_transferencia->>'observacoes',
    NULLIF(p_transferencia->>'criado_por', '')
  )
  RETURNING id INTO v_transf_id;

  -- 3. Insert dos lotes consumidos (consumo_tipo='transferencia_out')
  FOR v_lote IN SELECT * FROM jsonb_array_elements(p_lotes)
  LOOP
    INSERT INTO public.consumos_lote (consumo_tipo, consumo_id, fonte_tipo, fonte_id, litros, preco_lote)
    VALUES (
      'transferencia_out',
      v_transf_id,
      v_lote->>'fonte_tipo',
      v_lote->>'fonte_id',
      (v_lote->>'litros')::numeric,
      (v_lote->>'preco_lote')::numeric
    );
  END LOOP;

  -- 4. Sem suprimento → audit_log (não há tabela específica)
  IF p_litros_sem_suprimento > 0 THEN
    INSERT INTO public.audit_log (tipo, alvo_id, detalhes)
    VALUES (
      'transferencia_sem_suprimento',
      v_transf_id,
      jsonb_build_object(
        'tanque_origem', p_transferencia->>'deposito_origem_id',
        'litros_solicitados', (p_transferencia->>'quantidade_litros')::numeric,
        'litros_sem_suprimento', p_litros_sem_suprimento
      )::text
    );
  END IF;

  RETURN v_transf_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_transferencia_fifo(jsonb, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_transferencia_fifo(jsonb, jsonb, numeric) TO authenticated;
```

> **Cuidado audit_log:** Verificar schema real de `audit_log` no Step 1 (Discovery). Colunas podem ser diferentes — ajustar conforme.

### Step 3: Apply

`apply_migration` com name `rpc_registrar_transferencia_fifo`.

### Step 4: Adicionar hook `useRegistrarTransferenciaFIFO`

Adicionar em `src/hooks/useTransferenciasCombustivel.ts`:

```typescript
import { transferenciaCombustivelToDb } from '../lib/mappers'

export function useRegistrarTransferenciaFIFO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      transferencia: TransferenciaCombustivel
      lotes: { fonteTipo: 'entrada' | 'transferencia'; fonteId: string; litros: number; precoLote: number }[]
      litrosSemSuprimento: number
    }) => {
      const { data, error } = await supabase.rpc('registrar_transferencia_fifo', {
        p_transferencia: transferenciaCombustivelToDb(params.transferencia),
        p_lotes: params.lotes.map((l) => ({
          fonte_tipo: l.fonteTipo,
          fonte_id: l.fonteId,
          litros: l.litros,
          preco_lote: l.precoLote,
        })),
        p_litros_sem_suprimento: params.litrosSemSuprimento,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] })
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] })
      qc.invalidateQueries({ queryKey: ['saidas_combustivel'] })
      qc.invalidateQueries({ queryKey: ['consumos_lote'] })
    },
  })
}
```

### Step 5: Build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260524100300_rpc_registrar_transferencia_fifo.sql \
        src/hooks/useTransferenciasCombustivel.ts
git commit -m "feat(combustivel): RPC registrar_transferencia_fifo + hook

Insert atomico transferencia + N consumos_lote (consumo_tipo=
'transferencia_out'). valor_total COMPUTADO server-side via SUM
(litros × preco_lote) — não vem mais do user.

useRegistrarTransferenciaFIFO segue pattern de useRegistrarSaidaFIFO.
Invalida 4 query keys.

Sem suprimento → audit_log (tabela transferencias_sem_suprimento out
of scope, ficaria polymorphic)."
```

---

## Task FC.7: RPC `registrar_esvaziamento_fifo`

**Files:**
- Create: `supabase/migrations/20260524100400_rpc_registrar_esvaziamento_fifo.sql`
- Modify: `src/hooks/useEsvaziamentos.ts`

### Step 1: Criar migration

Write `supabase/migrations/20260524100400_rpc_registrar_esvaziamento_fifo.sql`:

```sql
-- =============================================================================
-- FC.7 — RPC registrar_esvaziamento_fifo (atomic)
-- =============================================================================
-- Insert atomico esvaziamento + N consumos_lote (consumo_tipo='esvaziamento').
-- valor_perda COMPUTADO server-side: SUM(litros × preco_lote) dos lotes.

CREATE OR REPLACE FUNCTION public.registrar_esvaziamento_fifo(
  p_esvaziamento jsonb,
  p_lotes jsonb,
  p_litros_sem_suprimento numeric DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_esv_id text;
  v_lote jsonb;
  v_valor_perda numeric := 0;
BEGIN
  -- Permission
  IF NOT private.current_has_action('gerenciar_combustivel') THEN
    RAISE EXCEPTION 'Permissão negada para registrar esvaziamento de tanque';
  END IF;

  -- 1. Computar valor_perda (FIFO)
  SELECT COALESCE(SUM((l->>'litros')::numeric * (l->>'preco_lote')::numeric), 0)
  INTO v_valor_perda
  FROM jsonb_array_elements(p_lotes) AS l;

  -- 2. Insert esvaziamento
  INSERT INTO public.esvaziamentos_tanque (
    id, deposito_id, litros_descartados, motivo,
    criado_por, data_hora, valor_perda
  ) VALUES (
    p_esvaziamento->>'id',
    p_esvaziamento->>'deposito_id',
    (p_esvaziamento->>'litros_descartados')::numeric,
    p_esvaziamento->>'motivo',
    NULLIF(p_esvaziamento->>'criado_por', ''),
    (p_esvaziamento->>'data_hora')::timestamp,
    v_valor_perda
  )
  RETURNING id INTO v_esv_id;

  -- 3. Insert dos lotes consumidos
  FOR v_lote IN SELECT * FROM jsonb_array_elements(p_lotes)
  LOOP
    INSERT INTO public.consumos_lote (consumo_tipo, consumo_id, fonte_tipo, fonte_id, litros, preco_lote)
    VALUES (
      'esvaziamento',
      v_esv_id,
      v_lote->>'fonte_tipo',
      v_lote->>'fonte_id',
      (v_lote->>'litros')::numeric,
      (v_lote->>'preco_lote')::numeric
    );
  END LOOP;

  -- 4. Sem suprimento → audit
  IF p_litros_sem_suprimento > 0 THEN
    INSERT INTO public.audit_log (tipo, alvo_id, detalhes)
    VALUES (
      'esvaziamento_sem_suprimento',
      v_esv_id,
      jsonb_build_object(
        'tanque', p_esvaziamento->>'deposito_id',
        'litros_descartados', (p_esvaziamento->>'litros_descartados')::numeric,
        'litros_sem_suprimento', p_litros_sem_suprimento
      )::text
    );
  END IF;

  RETURN v_esv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_esvaziamento_fifo(jsonb, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_esvaziamento_fifo(jsonb, jsonb, numeric) TO authenticated;
```

> **Cuidado action name:** `gerenciar_combustivel` é placeholder. Confirmar action real usada em esvaziamentos no Step 1 (consultar policies de `esvaziamentos_tanque`).

### Step 2: Apply

`apply_migration` com name `rpc_registrar_esvaziamento_fifo`.

### Step 3: Adicionar hook

Adicionar em `src/hooks/useEsvaziamentos.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRegistrarEsvaziamentoFIFO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      esvaziamento: { id: string; depositoId: string; litrosDescartados: number; motivo: string | null; criadoPor: string | null; dataHora: string }
      lotes: { fonteTipo: 'entrada' | 'transferencia'; fonteId: string; litros: number; precoLote: number }[]
      litrosSemSuprimento: number
    }) => {
      const { data, error } = await supabase.rpc('registrar_esvaziamento_fifo', {
        p_esvaziamento: {
          id: params.esvaziamento.id,
          deposito_id: params.esvaziamento.depositoId,
          litros_descartados: params.esvaziamento.litrosDescartados,
          motivo: params.esvaziamento.motivo,
          criado_por: params.esvaziamento.criadoPor,
          data_hora: params.esvaziamento.dataHora,
        },
        p_lotes: params.lotes.map((l) => ({
          fonte_tipo: l.fonteTipo,
          fonte_id: l.fonteId,
          litros: l.litros,
          preco_lote: l.precoLote,
        })),
        p_litros_sem_suprimento: params.litrosSemSuprimento,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['esvaziamentos_tanque'] })
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] })
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] })
      qc.invalidateQueries({ queryKey: ['consumos_lote'] })
    },
  })
}
```

### Step 4: Build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260524100400_rpc_registrar_esvaziamento_fifo.sql \
        src/hooks/useEsvaziamentos.ts
git commit -m "feat(combustivel): RPC registrar_esvaziamento_fifo + hook

Insert atomico esvaziamento + N consumos_lote (consumo_tipo='esvaziamento').
valor_perda COMPUTADO server-side via SUM(litros × preco_lote)."
```

---

## Task FC.8: Componente `<FIFOCard>` compartilhado (TDD)

**Files:**
- Create: `src/components/combustivel/v2/shared/FIFOCard.tsx`
- Create: `src/components/combustivel/v2/shared/FIFOCard.test.tsx`

### Step 1: Failing tests

Create `src/components/combustivel/v2/shared/FIFOCard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FIFOCard } from './FIFOCard'
import type { PorcaoConsumida } from '../../../../utils/fifoCombustivel'

describe('FIFOCard', () => {
  it('renderiza placeholder quando sem detalhamento', () => {
    render(<FIFOCard detalhamento={[]} litrosSemSuprimento={0} />)
    expect(screen.getByText(/sem cálculo/i)).toBeInTheDocument()
  })

  it('renderiza 1 lote com formato correto', () => {
    const det: PorcaoConsumida[] = [{
      fonteTipo: 'entrada',
      fonteId: 'A',
      fonteDataHora: '2026-05-21T15:00:00',
      saldoAntesDoConsumo: 3832,
      litros: 100,
      preco: 6.2332,
    }]
    render(<FIFOCard detalhamento={det} litrosSemSuprimento={0} />)
    expect(screen.getByText(/21\/05\/26 15:00/)).toBeInTheDocument()
    expect(screen.getByText(/saldo 3\.832/)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 6,2332/)).toBeInTheDocument()
    expect(screen.getByText(/100,00/)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 623,32/)).toBeInTheDocument()
  })

  it('renderiza 2 lotes + total + fórmula', () => {
    const det: PorcaoConsumida[] = [
      { fonteTipo: 'entrada', fonteId: 'A', fonteDataHora: '2026-04-27T09:41:00', saldoAntesDoConsumo: 3832, litros: 3832, preco: 6.2332 },
      { fonteTipo: 'entrada', fonteId: 'B', fonteDataHora: '2026-05-01T13:27:00', saldoAntesDoConsumo: 5000, litros: 68, preco: 6.7261 },
    ]
    render(<FIFOCard detalhamento={det} litrosSemSuprimento={0} />)
    // 2 lotes
    expect(screen.getByText(/27\/04\/26 09:41/)).toBeInTheDocument()
    expect(screen.getByText(/01\/05\/26 13:27/)).toBeInTheDocument()
    // Total
    expect(screen.getByText(/3\.900,00 L/)).toBeInTheDocument()
    // Fórmula
    expect(screen.getByText(/Preço médio/)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 6,2421/)).toBeInTheDocument()
  })

  it('mostra warning quando há litros sem suprimento', () => {
    const det: PorcaoConsumida[] = [{ fonteTipo: 'entrada', fonteId: 'A', fonteDataHora: '2026-05-21T15:00:00', saldoAntesDoConsumo: 50, litros: 50, preco: 6 }]
    render(<FIFOCard detalhamento={det} litrosSemSuprimento={50} />)
    expect(screen.getByText(/sem suprimento/i)).toBeInTheDocument()
    expect(screen.getByText(/50,00/)).toBeInTheDocument()
  })
})
```

### Step 2: Run failing tests

```bash
npm test src/components/combustivel/v2/shared/FIFOCard.test.tsx -- --run 2>&1 | tail -20
```
Expected: FAIL (módulo não existe).

### Step 3: Implement component

Create `src/components/combustivel/v2/shared/FIFOCard.tsx`:

```tsx
import type { PorcaoConsumida } from '../../../../utils/fifoCombustivel'
import { fmtDataHora } from './formatters'

interface FIFOCardProps {
  detalhamento: PorcaoConsumida[]
  litrosSemSuprimento: number
}

function fmtNum(n: number, casas = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

function fmtBRL(n: number, casas = 2): string {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function FIFOCard({ detalhamento, litrosSemSuprimento }: FIFOCardProps) {
  if (detalhamento.length === 0 && litrosSemSuprimento === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] p-3 text-sm text-[var(--color-fg-muted)]">
        Sem cálculo FIFO (escolha tanque e litros).
      </div>
    )
  }

  const totalLitros = detalhamento.reduce((s, p) => s + p.litros, 0)
  const totalValor = detalhamento.reduce((s, p) => s + p.litros * p.preco, 0)
  const precoMedio = totalLitros > 0 ? totalValor / totalLitros : 0

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-2 text-sm">
      <div className="font-semibold text-[var(--color-fg)]">Consumo FIFO</div>
      <ul className="space-y-1">
        {detalhamento.map((p, i) => (
          <li key={i} className="tabular-nums">
            <div className="text-[var(--color-fg-muted)]">
              Lote {fmtDataHora(p.fonteDataHora)} · saldo {fmtNum(p.saldoAntesDoConsumo)} L × {fmtBRL(p.preco, 4)}
            </div>
            <div className="ml-2">
              {fmtNum(p.litros)} L = {fmtBRL(p.litros * p.preco)}
            </div>
          </li>
        ))}
      </ul>
      {detalhamento.length > 1 && (
        <>
          <div className="border-t border-[var(--color-border)] pt-2 tabular-nums">
            <div className="flex justify-between">
              <span>Total</span>
              <span>{fmtNum(totalLitros)} L</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span></span>
              <span>{fmtBRL(totalValor)}</span>
            </div>
          </div>
        </>
      )}
      <div className="text-[var(--color-fg-muted)] tabular-nums">
        Preço médio: {fmtBRL(totalValor)} / {fmtNum(totalLitros)} L = {fmtBRL(precoMedio, 4)}/L
      </div>
      {litrosSemSuprimento > 0 && (
        <div className="text-[var(--color-warning-fg)] mt-1">
          Atenção: {fmtNum(litrosSemSuprimento)} L sem suprimento na linha do tempo.
        </div>
      )}
    </div>
  )
}
```

### Step 4: Run tests PASS

```bash
npm test src/components/combustivel/v2/shared/FIFOCard.test.tsx -- --run 2>&1 | tail -20
```
Expected: 4 passed.

### Step 5: Build + suite

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/components/combustivel/v2/shared/FIFOCard.tsx \
        src/components/combustivel/v2/shared/FIFOCard.test.tsx
git commit -m "feat(combustivel): componente FIFOCard compartilhado + 4 testes

Componente reusável pra saída + transferência + esvaziamento. Sempre
visível (não <details>) mostrando: por lote (data + saldo antes + preço
× litros = subtotal), total (>1 lote), fórmula explícita do preço médio.

Warning amarelo quando litrosSemSuprimento > 0."
```

---

## Task FC.9: `SaidaCombustivelForm` desktop usa `<FIFOCard>`

**Files:**
- Modify: `src/components/combustivel/SaidaCombustivelForm.tsx`

### Step 1: Discovery — onde está o `<details>` atual

```bash
grep -n "details\|fifoResult\|Detalhamento FIFO" src/components/combustivel/SaidaCombustivelForm.tsx | head
```

### Step 2: Substituir `<details>` pelo `<FIFOCard>`

Atualizar imports:

```tsx
import { FIFOCard } from '../combustivel/v2/shared/FIFOCard'  // ajuste path conforme localização
import { useConsumosAnteriores } from '../../hooks/useSaidasCombustivel'
```

Substituir o hook que carrega `saidasExistentes`:

```tsx
// Antes:
const { data: saidasExistentes = [] } = useSaidasCombustivel()

// Depois:
const consumosAnteriores = useConsumosAnteriores()
```

Atualizar o useMemo do `fifoResult`:

```tsx
const fifoResult = useMemo(() => {
  if (origem !== 'tanque' || !tanqueId) {
    return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
  }
  const dataValue = formValues?.data || new Date().toISOString().slice(0, 19)
  const litrosValue = Number(formValues?.litros ?? 0)
  if (!litrosValue) return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
  return calcularPrecoFIFO({
    tanqueId,
    dataHora: dataValue,
    litros: litrosValue,
    entradas: entradasCombustivel,
    transferenciasIn: transferencias,
    consumosAnteriores: consumosAnteriores.filter((c) =>
      // Edit mode: ignora a saída sendo editada
      !(initial?.id && c.tipo === 'saida' && c.data === initial.data && c.litros === initial.litros && c.tanqueId === tanqueId)
    ),
  })
}, [origem, tanqueId, formValues?.data, formValues?.litros, entradasCombustivel, transferencias, consumosAnteriores, initial?.id, initial?.data, initial?.litros])
```

Substituir o `<details>` no JSX por:

```tsx
{!usaSnapshotSalvo && origem === 'tanque' && (
  <div className="mt-2">
    <FIFOCard
      detalhamento={fifoResult.detalhamento}
      litrosSemSuprimento={fifoResult.litrosSemSuprimento}
    />
  </div>
)}
```

> Remover o `<details>` antigo + a div warning amarela (FIFOCard já tem ambos).

### Step 3: Build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

Expected: tudo verde.

### Step 4: Smoke manual

```bash
npm run dev
```

Abrir Nova Saída → escolher Meloza Colorado → 3900L → verificar card mostra:
- 2 linhas de lote
- Total
- Fórmula preço médio

Encerrar dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/combustivel/SaidaCombustivelForm.tsx
git commit -m "feat(combustivel): SaidaForm desktop usa <FIFOCard> sempre visível

Substitui <details> escondido por card sempre visível. Usa
useConsumosAnteriores agregando saídas + transf_out + esvaziamentos
para FIFO mais preciso (era só saídas).

Edit mode preserva snapshot HF.11."
```

---

## Task FC.10: `TransferenciaForm` usa FIFO + valor_total read-only + nova RPC

**Files:**
- Modify: `src/components/combustivel/TransferenciaForm.tsx`

### Step 1: Discovery — forma atual do form

```bash
grep -n "valor_total\|valorTotal\|onSubmit\|useAdicionarTransferencia" src/components/combustivel/TransferenciaForm.tsx | head -20
```

Identifique:
- Como o form trata `valor_total` hoje (input editável?)
- Qual mutation usa pra salvar

### Step 2: Atualizar form

Imports:

```tsx
import { FIFOCard } from './v2/shared/FIFOCard'
import { calcularPrecoFIFO } from '../../utils/fifoCombustivel'
import { useConsumosAnteriores } from '../../hooks/useSaidasCombustivel'
import { useRegistrarTransferenciaFIFO } from '../../hooks/useTransferenciasCombustivel'
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel'
import { useTransferenciasCombustivel } from '../../hooks/useTransferenciasCombustivel'
```

Adicionar hooks:

```tsx
const consumosAnteriores = useConsumosAnteriores()
const { data: entradasCombustivel = [] } = useEntradasCombustivel()
const { data: transferencias = [] } = useTransferenciasCombustivel()
const registrarMut = useRegistrarTransferenciaFIFO()
```

Adicionar `fifoResult`:

```tsx
const fifoResult = useMemo(() => {
  if (!depositoOrigemId) {
    return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
  }
  const litrosValue = Number(formValues?.quantidadeLitros ?? 0)
  if (!litrosValue) return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
  return calcularPrecoFIFO({
    tanqueId: depositoOrigemId,
    dataHora: formValues.dataHora,
    litros: litrosValue,
    entradas: entradasCombustivel,
    transferenciasIn: transferencias,
    consumosAnteriores,
  })
}, [depositoOrigemId, formValues?.dataHora, formValues?.quantidadeLitros, entradasCombustivel, transferencias, consumosAnteriores])
```

Tornar `valor_total` read-only no JSX:

```tsx
{/* Antes: <Input value={formValues.valorTotal} onChange={...} /> */}
{/* Depois: campo read-only mostrando o computed FIFO */}
<div className="text-sm">
  <label className="text-[var(--color-fg-muted)]">Valor total (calculado FIFO)</label>
  <div className="font-semibold tabular-nums">
    R$ {(fifoResult.precoMedio * Number(formValues?.quantidadeLitros ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
  </div>
</div>

<FIFOCard detalhamento={fifoResult.detalhamento} litrosSemSuprimento={fifoResult.litrosSemSuprimento} />
```

Submit usa nova RPC:

```tsx
const onSubmit = async (data: TransferenciaFormValues) => {
  const payload: TransferenciaCombustivel = {
    id: data.id ?? `tc-${Date.now().toString(36)}`,
    dataHora: data.dataHora.length === 16 ? `${data.dataHora}:00` : data.dataHora,
    depositoOrigemId: data.depositoOrigemId,
    depositoDestinoId: data.depositoDestinoId,
    tipoCombustivel: data.tipoCombustivel,
    quantidadeLitros: Number(data.quantidadeLitros),
    valorTotal: 0,  // ignored — RPC computes
    observacoes: data.observacoes,
    criadoPor: userId ?? '',
  }
  await registrarMut.mutateAsync({
    transferencia: payload,
    lotes: fifoResult.detalhamento.map((p) => ({
      fonteTipo: p.fonteTipo,
      fonteId: p.fonteId,
      litros: p.litros,
      precoLote: p.preco,
    })),
    litrosSemSuprimento: fifoResult.litrosSemSuprimento,
  })
  showToast({ kind: 'success', message: 'Transferência registrada' })
  onClose()
}
```

### Step 3: Build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

### Step 4: Smoke manual

```bash
npm run dev
```

Nova Transferência → origem Meloza Colorado → 100L → verificar card FIFO + valor_total read-only.

- [ ] **Step 5: Commit**

```bash
git add src/components/combustivel/TransferenciaForm.tsx
git commit -m "feat(combustivel): TransferenciaForm usa FIFO + valor_total read-only

valor_total agora é COMPUTADO server-side (RPC registrar_transferencia_fifo).
Form mostra preview FIFO via <FIFOCard> + valor total calculado read-only.

Removido input editável de valor_total."
```

---

## Task FC.11: `EsvaziamentoForm` — discovery + atualizar/criar

**Files:**
- Modify or Create: `src/components/combustivel/EsvaziamentoForm.tsx`

### Step 1: Discovery

```bash
find src -name "Esvaziamento*.tsx" 2>/dev/null
grep -rn "esvaziamento\|EsvaziamentoForm" src/ 2>/dev/null | head -10
```

Reporte: existe form de esvaziamento? Onde é renderizado?

### Step 2A: Se EXISTE — atualizar pra FIFO

Atualizar pattern igual `TransferenciaForm` (FC.10):
- Adicionar `<FIFOCard>` preview
- Mostrar valor_perda computed read-only
- Submit chama `useRegistrarEsvaziamentoFIFO`

### Step 2B: Se NÃO EXISTE — criar mínimo

`src/components/combustivel/EsvaziamentoForm.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { FIFOCard } from './v2/shared/FIFOCard'
import { calcularPrecoFIFO } from '../../utils/fifoCombustivel'
import { useConsumosAnteriores } from '../../hooks/useSaidasCombustivel'
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel'
import { useTransferenciasCombustivel } from '../../hooks/useTransferenciasCombustivel'
import { useDepositos } from '../../hooks/useDepositos'
import { useRegistrarEsvaziamentoFIFO } from '../../hooks/useEsvaziamentos'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../ui/Toast'
import { nowAsLocalInput } from './v2/shared/formatters'
import Button from '../ui/Button'
import SmartSelect from '../ui/SmartSelect'

interface Props { onClose: () => void }

export default function EsvaziamentoForm({ onClose }: Props) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { data: depositos = [] } = useDepositos()
  const { data: entradasCombustivel = [] } = useEntradasCombustivel()
  const { data: transferencias = [] } = useTransferenciasCombustivel()
  const consumosAnteriores = useConsumosAnteriores()
  const registrarMut = useRegistrarEsvaziamentoFIFO()

  const [depositoId, setDepositoId] = useState('')
  const [litros, setLitros] = useState('')
  const [motivo, setMotivo] = useState('')
  const [dataHora, setDataHora] = useState(nowAsLocalInput())

  const litrosNum = Number(litros.replace(',', '.')) || 0

  const fifoResult = useMemo(() => {
    if (!depositoId || !litrosNum) return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
    return calcularPrecoFIFO({
      tanqueId: depositoId,
      dataHora,
      litros: litrosNum,
      entradas: entradasCombustivel,
      transferenciasIn: transferencias,
      consumosAnteriores,
    })
  }, [depositoId, litrosNum, dataHora, entradasCombustivel, transferencias, consumosAnteriores])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!depositoId || litrosNum <= 0) return
    const id = `ez-${Date.now().toString(36)}`
    const dataFinal = dataHora.length === 16 ? `${dataHora}:00` : dataHora
    await registrarMut.mutateAsync({
      esvaziamento: {
        id,
        depositoId,
        litrosDescartados: litrosNum,
        motivo: motivo || null,
        criadoPor: user?.id ?? null,
        dataHora: dataFinal,
      },
      lotes: fifoResult.detalhamento.map((p) => ({
        fonteTipo: p.fonteTipo,
        fonteId: p.fonteId,
        litros: p.litros,
        precoLote: p.preco,
      })),
      litrosSemSuprimento: fifoResult.litrosSemSuprimento,
    })
    showToast({ kind: 'success', message: 'Esvaziamento registrado' })
    onClose()
  }

  const valorPerda = fifoResult.detalhamento.reduce((s, p) => s + p.litros * p.preco, 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <SmartSelect
        label="Tanque"
        value={depositoId}
        onChange={setDepositoId}
        options={depositos.map((d) => ({ value: d.id, label: d.nome }))}
      />
      <div>
        <label className="text-sm">Litros descartados</label>
        <input type="number" step="0.01" value={litros} onChange={(e) => setLitros(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="text-sm">Data e hora</label>
        <input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="text-sm">Motivo</label>
        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full" />
      </div>

      <FIFOCard detalhamento={fifoResult.detalhamento} litrosSemSuprimento={fifoResult.litrosSemSuprimento} />

      <div className="text-sm">
        <label className="text-[var(--color-fg-muted)]">Valor da perda (calculado FIFO)</label>
        <div className="font-semibold tabular-nums">
          R$ {valorPerda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={!depositoId || litrosNum <= 0}>Registrar</Button>
      </div>
    </form>
  )
}
```

> **Cuidado paths:** ajuste paths de imports conforme a estrutura real do projeto (Toast, Button, etc).
>
> Se o form não estava sendo renderizado em nenhuma aba ainda, deixar criado mas NÃO adicionar ao nav — usuário decide depois. Documenta no commit.

### Step 3: Build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/combustivel/EsvaziamentoForm.tsx
git commit -m "feat(combustivel): EsvaziamentoForm com FIFO + valor_perda computado

Form mostra preview FIFO via <FIFOCard> + valor da perda calculado
read-only. Submit chama registrar_esvaziamento_fifo (atomic).

Nota: form criado/atualizado conforme discovery. Wiring no nav fica
fora do escopo desta task."
```

---

## Task FC.12: Mobile `MSaidaCombustivelPage` — indicador FIFO compacto

**Files:**
- Modify: `src/pages/mobile/MSaidaCombustivelPage.tsx`

### Step 1: Atualizar pra usar consumosAnteriores polimórfico

Substituir `saidasExistentes.filter(...)` por `useConsumosAnteriores`:

```tsx
import { useConsumosAnteriores } from '../../hooks/useSaidasCombustivel'

const consumosAnteriores = useConsumosAnteriores()

const fifoPreview = useMemo(() => {
  if (!tanqueId || litrosNum <= 0) return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
  return calcularPrecoFIFO({
    tanqueId,
    dataHora: nowAsLocalInput(),
    litros: litrosNum,
    entradas: entradasCombustivel,
    transferenciasIn: transferencias,
    consumosAnteriores,
  })
}, [tanqueId, litrosNum, entradasCombustivel, transferencias, consumosAnteriores])
```

UI: pequeno indicador "FIFO" sob o preço (sem card cheio, mobile não tem espaço):

```tsx
{fifoPreview.precoMedio > 0 && (
  <div className="text-xs text-[var(--color-fg-muted)] mt-1">
    Preço calculado FIFO ({fifoPreview.detalhamento.length} lote{fifoPreview.detalhamento.length !== 1 ? 's' : ''})
  </div>
)}

{fifoPreview.litrosSemSuprimento > 0 && (
  <div className="text-xs text-[var(--color-warning-fg)] mt-1 p-2 rounded bg-amber-50">
    Atenção: {fifoPreview.litrosSemSuprimento.toFixed(2)} L sem suprimento registrado.
  </div>
)}
```

### Step 2: Build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/mobile/MSaidaCombustivelPage.tsx
git commit -m "feat(combustivel-mobile): usa useConsumosAnteriores + indicador FIFO

Mobile passa a usar agregação polimórfica de consumos (saidas +
transf_out + esvaziamentos). UI compacta: indicador 'FIFO (N lotes)'
abaixo do preço. Card cheio fica só no desktop."
```

---

## Task FC.13: Migration backfill completo

**Files:**
- Create: `supabase/migrations/20260524100500_backfill_fifo_completo.sql`

### Step 1: Discovery — confirmar audit_log schema

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='audit_log' ORDER BY ordinal_position;
```

Confirmar colunas usadas (tipo, alvo_id, detalhes, data_hora).

### Step 2: Criar migration

Write `supabase/migrations/20260524100500_backfill_fifo_completo.sql`:

```sql
-- =============================================================================
-- FC.13 — Backfill FIFO COMPLETO retroativo
-- =============================================================================
-- Replay cronológico por tanque com TODAS as 4 fontes de consumo:
-- saidas (qualquer tipo), transferencias_out, esvaziamentos.
--
-- TRUNCATE consumos_lote + saidas_sem_suprimento. Re-popula.
--
-- Side effects:
-- - saidas equipamento_proprio: UPDATE preco_unitario/valor_total/snapshot via FIFO
-- - saidas carreta: PRESERVA preço externo (não sobrescreve)
-- - transferencias: UPDATE valor_total via FIFO + audit_log diff
-- - esvaziamentos: UPDATE valor_perda via FIFO
--
-- Triggers desabilitados via session_replication_role.

DO $$
DECLARE
  v_tanque record;
  v_op record;
  v_lote_idx int;
  v_litros_restantes numeric;
  v_litros_consome numeric;
  v_total_valor numeric;
  v_total_litros numeric;
  v_n_saidas int := 0;
  v_n_transferencias int := 0;
  v_n_esvaziamentos int := 0;
  v_n_porcoes int := 0;
  v_n_sem_suprimento int := 0;
  v_old_valor_total numeric;
BEGIN
  TRUNCATE public.consumos_lote;
  TRUNCATE public.saidas_sem_suprimento;

  SET LOCAL session_replication_role = 'replica';

  FOR v_tanque IN SELECT DISTINCT id FROM public.depositos WHERE deleted_at IS NULL
  LOOP
    -- Temp table de saldos do tanque (entradas + transf_in unificadas, ordenadas)
    CREATE TEMP TABLE IF NOT EXISTS _backfill_lotes (
      seq int GENERATED ALWAYS AS IDENTITY,
      fonte_tipo text,
      fonte_id text,
      data_origem timestamp,
      preco numeric,
      saldo numeric
    ) ON COMMIT DROP;
    TRUNCATE _backfill_lotes;

    INSERT INTO _backfill_lotes (fonte_tipo, fonte_id, data_origem, preco, saldo)
    SELECT 'entrada', e.id, e.data_hora,
      CASE WHEN e.quantidade_litros > 0 THEN e.valor_total / e.quantidade_litros ELSE 0 END,
      e.quantidade_litros
    FROM public.entradas_combustivel e
    WHERE e.deposito_id = v_tanque.id AND e.deleted_at IS NULL
    UNION ALL
    SELECT 'transferencia', t.id, t.data_hora,
      CASE WHEN t.quantidade_litros > 0 THEN t.valor_total / t.quantidade_litros ELSE 0 END,
      t.quantidade_litros
    FROM public.transferencias_combustivel t
    WHERE t.deposito_destino_id = v_tanque.id AND t.deleted_at IS NULL
    ORDER BY data_origem ASC;

    -- Processa cada operação de consumo em ordem cronológica unificada
    FOR v_op IN
      SELECT 'saida' AS tipo, id, data AS data_op, litros, tipo_consumidor
      FROM public.saidas_combustivel
      WHERE tanque_id = v_tanque.id AND deleted_at IS NULL

      UNION ALL

      SELECT 'transferencia_out', id, data_hora, quantidade_litros, NULL::text
      FROM public.transferencias_combustivel
      WHERE deposito_origem_id = v_tanque.id AND deleted_at IS NULL

      UNION ALL

      SELECT 'esvaziamento', id, data_hora, litros_descartados, NULL::text
      FROM public.esvaziamentos_tanque
      WHERE deposito_id = v_tanque.id

      ORDER BY data_op ASC, tipo
    LOOP
      v_litros_restantes := v_op.litros;
      v_total_valor := 0;
      v_total_litros := 0;

      -- Consome dos lotes elegíveis (data_origem <= data_op, saldo > 0) em ordem
      FOR v_lote_idx IN
        SELECT seq FROM _backfill_lotes
        WHERE data_origem <= v_op.data_op AND saldo > 0
        ORDER BY data_origem ASC, seq ASC
      LOOP
        IF v_litros_restantes <= 0 THEN EXIT; END IF;

        SELECT LEAST(v_litros_restantes, saldo) INTO v_litros_consome
        FROM _backfill_lotes WHERE seq = v_lote_idx;

        INSERT INTO public.consumos_lote (consumo_tipo, consumo_id, fonte_tipo, fonte_id, litros, preco_lote)
        SELECT v_op.tipo, v_op.id, fonte_tipo, fonte_id, v_litros_consome, preco
        FROM _backfill_lotes WHERE seq = v_lote_idx;

        v_total_valor := v_total_valor + v_litros_consome * (SELECT preco FROM _backfill_lotes WHERE seq = v_lote_idx);
        v_total_litros := v_total_litros + v_litros_consome;

        UPDATE _backfill_lotes SET saldo = saldo - v_litros_consome WHERE seq = v_lote_idx;
        v_litros_restantes := v_litros_restantes - v_litros_consome;
        v_n_porcoes := v_n_porcoes + 1;
      END LOOP;

      -- Side effects por tipo
      IF v_op.tipo = 'saida' THEN
        v_n_saidas := v_n_saidas + 1;
        -- Equipamento_proprio: UPDATE preço FIFO. Carreta: preserva (preço externo).
        IF v_op.tipo_consumidor = 'equipamento_proprio' AND v_total_litros > 0 THEN
          UPDATE public.saidas_combustivel
          SET preco_unitario = v_total_valor / v_total_litros,
              preco_medio_tanque_snapshot = v_total_valor / v_total_litros,
              valor_total = (v_total_valor / v_total_litros) * v_op.litros,
              updated_at = now(),
              updated_by = COALESCE(updated_by, 'sistema') || ' [backfill FIFO completo]'
          WHERE id = v_op.id;
        END IF;

      ELSIF v_op.tipo = 'transferencia_out' THEN
        v_n_transferencias := v_n_transferencias + 1;
        -- UPDATE valor_total + audit_log diff
        SELECT valor_total INTO v_old_valor_total FROM public.transferencias_combustivel WHERE id = v_op.id;
        UPDATE public.transferencias_combustivel
        SET valor_total = v_total_valor
        WHERE id = v_op.id;
        IF ABS(COALESCE(v_old_valor_total, 0) - v_total_valor) > 0.01 THEN
          INSERT INTO public.audit_log (tipo, alvo_id, detalhes)
          VALUES (
            'transferencia_valor_recomputado_fifo',
            v_op.id,
            jsonb_build_object('antes', v_old_valor_total, 'depois', v_total_valor)::text
          );
        END IF;

      ELSIF v_op.tipo = 'esvaziamento' THEN
        v_n_esvaziamentos := v_n_esvaziamentos + 1;
        UPDATE public.esvaziamentos_tanque
        SET valor_perda = v_total_valor
        WHERE id = v_op.id;
      END IF;

      -- Sem suprimento
      IF v_litros_restantes > 0 THEN
        v_n_sem_suprimento := v_n_sem_suprimento + 1;
        IF v_op.tipo = 'saida' THEN
          INSERT INTO public.saidas_sem_suprimento (
            saida_id, tanque_id, data_saida, litros_solicitados,
            litros_supridos, litros_sem_suprimento
          ) VALUES (v_op.id, v_tanque.id, v_op.data_op, v_op.litros, v_total_litros, v_litros_restantes);
        ELSE
          INSERT INTO public.audit_log (tipo, alvo_id, detalhes)
          VALUES (
            v_op.tipo || '_sem_suprimento',
            v_op.id,
            jsonb_build_object('tanque', v_tanque.id, 'litros_solicitados', v_op.litros, 'litros_sem_suprimento', v_litros_restantes)::text
          );
        END IF;
      END IF;
    END LOOP;

    DROP TABLE _backfill_lotes;
  END LOOP;

  SET LOCAL session_replication_role = 'origin';

  RAISE NOTICE 'Backfill FIFO completo: % saídas, % transferências, % esvaziamentos, % porções em consumos_lote, % sem suprimento',
    v_n_saidas, v_n_transferencias, v_n_esvaziamentos, v_n_porcoes, v_n_sem_suprimento;
END$$;
```

### Step 3: Apply via MCP

`apply_migration` com name `backfill_fifo_completo`. **Pode demorar alguns minutos** (1000+ saídas + 200+ transferências + esvaziamentos).

### Step 4: Verify

```sql
SELECT
  (SELECT COUNT(*) FROM public.consumos_lote) AS total_porcoes,
  (SELECT COUNT(*) FROM public.consumos_lote WHERE consumo_tipo='saida') AS porcoes_saida,
  (SELECT COUNT(*) FROM public.consumos_lote WHERE consumo_tipo='transferencia_out') AS porcoes_transf,
  (SELECT COUNT(*) FROM public.consumos_lote WHERE consumo_tipo='esvaziamento') AS porcoes_esv,
  (SELECT COUNT(*) FROM public.saidas_sem_suprimento) AS sss_total;
```

Reporte: total de porções deve ser > 781 (era esse antes; agora inclui as novas fontes).

Specific Meloza Colorado:

```sql
SELECT id, nome FROM public.depositos WHERE nome='Meloza Colorado';
-- Pega o id, depois:

WITH t AS (SELECT 'COLE_AQUI_O_ID' AS id)
SELECT
  -- Saldo FIFO atual após backfill completo
  (SELECT COALESCE(SUM(litros_original - COALESCE(consumido, 0)), 0)
   FROM (
     SELECT l.id, l.litros_original,
       (SELECT SUM(litros) FROM public.consumos_lote cl WHERE cl.fonte_id = l.id) AS consumido
     FROM (
       SELECT id, quantidade_litros AS litros_original FROM public.entradas_combustivel WHERE deposito_id=(SELECT id FROM t) AND deleted_at IS NULL
       UNION ALL
       SELECT id, quantidade_litros FROM public.transferencias_combustivel WHERE deposito_destino_id=(SELECT id FROM t) AND deleted_at IS NULL
     ) l
   ) sub) AS saldo_fifo,
  -- Saldo físico
  (SELECT
    (SELECT COALESCE(SUM(quantidade_litros),0) FROM public.entradas_combustivel WHERE deposito_id=(SELECT id FROM t) AND deleted_at IS NULL)
    + (SELECT COALESCE(SUM(quantidade_litros),0) FROM public.transferencias_combustivel WHERE deposito_destino_id=(SELECT id FROM t) AND deleted_at IS NULL)
    - (SELECT COALESCE(SUM(litros),0) FROM public.saidas_combustivel WHERE tanque_id=(SELECT id FROM t) AND deleted_at IS NULL)
    - (SELECT COALESCE(SUM(quantidade_litros),0) FROM public.transferencias_combustivel WHERE deposito_origem_id=(SELECT id FROM t) AND deleted_at IS NULL)
    - (SELECT COALESCE(SUM(litros_descartados),0) FROM public.esvaziamentos_tanque WHERE deposito_id=(SELECT id FROM t))
  ) AS saldo_fisico;
```

Esperado: saldo_fifo ≈ saldo_fisico (diff < 0.01 ou pequeno por sem_suprimento).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260524100500_backfill_fifo_completo.sql
git commit -m "fix(combustivel): backfill FIFO COMPLETO (todas as fontes)

Replay cronológico unificado de saidas (qualquer tipo) + transferências
OUT + esvaziamentos pra cada tanque. TRUNCATE+repopula consumos_lote.

Side effects:
- Saídas equipamento_proprio: UPDATE preço FIFO
- Saídas carreta: PRESERVA preço externo (negociação)
- Transferências: UPDATE valor_total via FIFO + audit_log diff > R$ 0,01
- Esvaziamentos: UPDATE valor_perda via FIFO

Saidas sem suprimento → saidas_sem_suprimento (existente).
Transf/esv sem suprimento → audit_log (tabela polymorphic ficou
out of scope deste plano)."
```

---

## Task FC.14: Migration reconciliação automática + assert

**Files:**
- Create: `supabase/migrations/20260524100600_reconciliacao_validation.sql`

### Step 1: Criar migration

Write `supabase/migrations/20260524100600_reconciliacao_validation.sql`:

```sql
-- =============================================================================
-- FC.14 — Reconciliação automática FIFO vs físico
-- =============================================================================
-- View `v_reconciliacao_fifo`: pra cada tanque, saldo FIFO vs saldo físico.
-- DO block assert: nenhum tanque com diff > 0.01 L pós-backfill.

CREATE OR REPLACE VIEW public.v_reconciliacao_fifo AS
WITH lotes_por_tanque AS (
  SELECT e.deposito_id AS tanque_id, e.id AS lote_id, e.quantidade_litros AS litros_original
  FROM public.entradas_combustivel e WHERE e.deleted_at IS NULL
  UNION ALL
  SELECT t.deposito_destino_id, t.id, t.quantidade_litros
  FROM public.transferencias_combustivel t WHERE t.deleted_at IS NULL
),
saldo_fifo_por_tanque AS (
  SELECT lpt.tanque_id,
    SUM(lpt.litros_original - COALESCE(cl.consumido, 0)) AS saldo_fifo
  FROM lotes_por_tanque lpt
  LEFT JOIN LATERAL (
    SELECT SUM(litros) AS consumido FROM public.consumos_lote WHERE fonte_id = lpt.lote_id
  ) cl ON true
  GROUP BY lpt.tanque_id
),
saldo_fisico_por_tanque AS (
  SELECT d.id AS tanque_id,
    COALESCE(SUM(e.quantidade_litros), 0)
    + COALESCE(SUM(tin.quantidade_litros), 0)
    - COALESCE(SUM(s.litros), 0)
    - COALESCE(SUM(tout.quantidade_litros), 0)
    - COALESCE(SUM(ez.litros_descartados), 0) AS saldo_fisico
  FROM public.depositos d
  LEFT JOIN public.entradas_combustivel e ON e.deposito_id = d.id AND e.deleted_at IS NULL
  LEFT JOIN public.transferencias_combustivel tin ON tin.deposito_destino_id = d.id AND tin.deleted_at IS NULL
  LEFT JOIN public.saidas_combustivel s ON s.tanque_id = d.id AND s.deleted_at IS NULL
  LEFT JOIN public.transferencias_combustivel tout ON tout.deposito_origem_id = d.id AND tout.deleted_at IS NULL
  LEFT JOIN public.esvaziamentos_tanque ez ON ez.deposito_id = d.id
  WHERE d.deleted_at IS NULL
  GROUP BY d.id
)
SELECT
  d.id, d.nome,
  COALESCE(f.saldo_fifo, 0) AS saldo_fifo,
  COALESCE(p.saldo_fisico, 0) AS saldo_fisico,
  COALESCE(f.saldo_fifo, 0) - COALESCE(p.saldo_fisico, 0) AS diff
FROM public.depositos d
LEFT JOIN saldo_fifo_por_tanque f ON f.tanque_id = d.id
LEFT JOIN saldo_fisico_por_tanque p ON p.tanque_id = d.id
WHERE d.deleted_at IS NULL;

-- Assert: nenhum diff > 0.01
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.v_reconciliacao_fifo WHERE ABS(diff) > 0.01;
  IF v_count > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % tanques com saldo FIFO != físico (diff > 0.01 L)', v_count;
    -- Diff esperado em tanques com sem_suprimento histórico. Não falha hard pra permitir investigação.
  ELSE
    RAISE NOTICE 'Reconciliação OK: saldo FIFO == físico em todos os tanques';
  END IF;
END$$;
```

### Step 2: Apply

`apply_migration` com name `reconciliacao_validation`.

### Step 3: Verify

```sql
-- Lista tanques com diff > 0.01
SELECT * FROM public.v_reconciliacao_fifo WHERE ABS(diff) > 0.01 ORDER BY ABS(diff) DESC;
```

Reporte os tanques com diff. Esperado: ≤ 5-10 tanques com diff (devido a saídas sem suprimento histórico). Tanques saudáveis devem ter diff ≈ 0.

Confirmar Meloza Colorado:

```sql
SELECT * FROM public.v_reconciliacao_fifo WHERE nome = 'Meloza Colorado';
-- Expected: saldo_fifo ≈ 1804, saldo_fisico = 1804, diff ≈ 0
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260524100600_reconciliacao_validation.sql
git commit -m "feat(combustivel): view v_reconciliacao_fifo + assert

View pra reconciliar saldo FIFO vs saldo físico de cada tanque.
DO block faz assert: nenhum diff > 0.01 L deveria ocorrer pós-backfill
(soft warning, não falha hard pra permitir investigar discrepâncias
históricas)."
```

---

## Task FC.15: Final — build + security review + deploy

- [ ] **Step 1: Build + tests**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx tsc -b 2>&1 | tail -5
npm test -- --run 2>&1 | tail -10
npm run build 2>&1 | tail -5
```
Expected: tudo verde. 12 testes novos FIFO + 4 testes FIFOCard = 16 testes novos.

- [ ] **Step 2: /security-review**

```
/security-review
```

Expected: NO_FINDINGS. RPCs SECDEF com search_path; permission check defesa em profundidade; view security_invoker.

- [ ] **Step 3: Preview deploy**

```bash
npx --yes vercel deploy 2>&1 | tail -5
```

- [ ] **Step 4: Smoke test (pedir confirmação ao user)**

Roteiro pro user:
1. Combustível → Nova Saída → Meloza Colorado → 100L
   - Card FIFO sempre visível mostrando lote único + preço médio
2. Nova Saída → tanque com 2 lotes ativos → quantidade que esgota o 1º lote
   - Card mostra 2 linhas + total + fórmula explícita
3. Nova Transferência → origem com múltiplos lotes
   - Card mostra detalhe + valor_total computed read-only
4. (Se Esvaziamento Form wired) → Esvaziamento → card FIFO + valor da perda

- [ ] **Step 5: Promover prod**

```bash
npx --yes vercel --prod 2>&1 | tail -5
```

- [ ] **Step 6: Merge + push**

```bash
git checkout main && git pull origin main
git merge --no-ff fix/combustivel-fifo-completo -m "Merge branch 'fix/combustivel-fifo-completo'

Completa o FIFO de combustível — captura TODAS as 4 fontes físicas
de consumo (saidas equip/carreta + transferências OUT + esvaziamentos),
não só saidas equipamento_proprio.

Mudanças principais:
- Tabela consumos_lote (polimórfica, era saidas_lotes)
- Helper TS reescrito com consumosAnteriores + saldoAntesDoConsumo
- 3 RPCs (saída atualizada, transferência+esvaziamento novas)
- Componente FIFOCard sempre visível
- Forms saida/transferência/esvaziamento usam FIFOCard
- Backfill atomic recomputado com todas as fontes
- View v_reconciliacao_fifo pra validar saldo FIFO == físico

Spec: docs/superpowers/specs/2026-05-24-fifo-completo-design.md
Plan: docs/superpowers/plans/2026-05-24-fifo-completo.md"
git push origin main
```

---

## Critérios de Aceitação

- ✅ `consumos_lote` tabela polimórfica + view `saidas_lotes` backward compat
- ✅ Helper `calcularPrecoFIFO` com signature nova + 12 testes passing
- ✅ Componente `<FIFOCard>` com 4 testes passing
- ✅ 3 RPCs (saída atualizada + transferência + esvaziamento) deployadas
- ✅ Forms saída/transferência usam `<FIFOCard>`; esvaziamento criado/atualizado
- ✅ Mobile usa hook polimórfico; indicador compacto FIFO
- ✅ Backfill processou: ≥ 781 porções (era), agora ~1500+ (saídas + transferências + esvaziamentos)
- ✅ `v_reconciliacao_fifo`: Meloza Colorado tem saldo_fifo ≈ saldo_fisico (1.804 L, não 12.832)
- ✅ `/security-review` NO_FINDINGS

## Out of scope (capturado no spec)

- Tabela `consumos_sem_suprimento` polimórfica (transferências/esvaziamentos órfãs vão pra audit_log)
- UI relatório lote-por-operação pra transferências/esvaziamentos
- Validação hard de saldo no submit (bloquear se sem suprimento)
- Wiring do EsvaziamentoForm no nav (se criado novo)
