# Combustível — High-Risk Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os 7 problemas de alta gravidade identificados na auditoria `combustivel-audit.md` (saldo errado por soft-delete não filtrado, RLS faltando, SECURITY DEFINER inseguro, mobile gravando valores zerados/inválidos, policies blanket, triggers legacy duplicados, e preço médio ignorando transferências).

**Architecture:** 5 migrations SQL (idempotentes) + 1 helper TS puro (`calcularPrecoMedioTanque`) reusado por desktop+mobile + refactor do mobile saída pra usar hook e helpers em vez de insert direto. Sem mudança de schema (apenas comportamento de funções, triggers, policies, código aplicativo).

**Tech Stack:** Supabase Postgres 17, SQL migrations via `supabase/migrations/`, React 19 + TypeScript, vitest.

**Auditoria fonte:** `/Users/tiagocameli/projects/Gestao_Obras/combustivel-audit.md`

**Branch:** Criar `feat/combustivel-high-risk-fixes` baseada em `main`.

**Out of scope:** Decisão entre FIFO vs janela móvel ponderada para corte temporal do preço médio (Bug C1 do audit) — requer brainstorming separado pra definir política de negócio. Esse plano resolve "ignorar transferências" mas mantém a média ponderada global.

---

## File Structure

**Migrations SQL novas:**
- `supabase/migrations/20260521120000_combustivel_deleted_at_filter.sql` — HF.1 (filtra `deleted_at IS NULL` em 2 funções)
- `supabase/migrations/20260521120100_esvaziamentos_tanque_rls.sql` — HF.2 (RLS + policies)
- `supabase/migrations/20260521120200_combustivel_secdef_search_path.sql` — HF.3 (SET search_path)
- `supabase/migrations/20260521120300_drop_legacy_combustivel_triggers.sql` — HF.4 (drop legacy)
- `supabase/migrations/20260521120400_tighten_rls_combustivel.sql` — HF.7 (granular policies)

**TS novos:**
- `src/utils/precoMedioTanque.ts` — helper puro `calcularPrecoMedioTanque(tanqueId, entradas, transferencias)`
- `src/utils/precoMedioTanque.test.ts` — testes vitest

**TS modificados:**
- `src/pages/mobile/MSaidaCombustivelPage.tsx` — usa hook + helper + enum correto + UUID combustível (HF.5)
- `src/components/combustivel/SaidaCombustivelForm.tsx` — usa helper (HF.6)
- `src/components/combustivel/TransferenciaForm.tsx` — usa helper (HF.6)

---

## Task HF.0: Branch + setup

**Files:** none

- [ ] **Step 1: Criar branch**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
git checkout main
git pull origin main
git checkout -b feat/combustivel-high-risk-fixes
git branch --show-current
```

Expected: `feat/combustivel-high-risk-fixes`

---

## Task HF.1: Filtrar `deleted_at IS NULL` em `recalcular_nivel_deposito` e `calcular_estoque_combustivel_na_data`

**Auditoria:** Item 2 / Bugs T1+T2+C3. Ambas as funções somam transferências/entradas/saídas soft-deletadas no cálculo — saldo dos tanques fica inflado quando algum registro é soft-deleted.

**Files:**
- Create: `supabase/migrations/20260521120000_combustivel_deleted_at_filter.sql`

- [ ] **Step 1: Criar migration**

Write `supabase/migrations/20260521120000_combustivel_deleted_at_filter.sql`:

```sql
-- HF.1 — Combustível: filtrar deleted_at IS NULL nas funções de saldo.
--
-- Bug: recalcular_nivel_deposito e calcular_estoque_combustivel_na_data
-- somam registros soft-deletados (deleted_at IS NOT NULL), inflando o saldo
-- do tanque após soft-delete via UI. Resultado: nível e custo errados.
--
-- Fix: adicionar AND deleted_at IS NULL nos SELECTs.
-- Idempotente via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.recalcular_nivel_deposito(p_deposito_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
  v_nivel numeric;
  v_ultimo_insumo text;
BEGIN
  -- Entradas no tanque (filtrando soft-delete)
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_entradas
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL;

  -- Transferências recebidas
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_in
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_deposito_id
     AND deleted_at IS NULL;

  -- Saídas do tanque
  SELECT COALESCE(SUM(litros), 0)
    INTO v_saidas
    FROM public.saidas_combustivel
   WHERE tanque_id = p_deposito_id
     AND deleted_at IS NULL;

  -- Transferências enviadas
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_out
    FROM public.transferencias_combustivel
   WHERE deposito_origem_id = p_deposito_id
     AND deleted_at IS NULL;

  -- Esvaziamentos
  SELECT COALESCE(SUM(litros_descartados), 0)
    INTO v_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id;

  v_nivel := GREATEST(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);

  -- combustivel_atual_id = combustível da última entrada APÓS último esvaziamento
  SELECT tipo_combustivel
    INTO v_ultimo_insumo
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL
     AND data_hora >= COALESCE(
       (SELECT MAX(data_hora::text) FROM public.esvaziamentos_tanque WHERE deposito_id = p_deposito_id),
       '1970-01-01'
     )
   ORDER BY data_hora DESC
   LIMIT 1;

  UPDATE public.depositos
     SET nivel_atual_litros = v_nivel,
         combustivel_atual_id = v_ultimo_insumo
   WHERE id = p_deposito_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.calcular_estoque_combustivel_na_data(
  p_deposito_id text,
  p_data_hora text,
  p_excluir_id text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
BEGIN
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_entradas
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_in
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_deposito_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(litros), 0)
    INTO v_saidas
    FROM public.saidas_combustivel
   WHERE tanque_id = p_deposito_id
     AND data::text <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_out
    FROM public.transferencias_combustivel
   WHERE deposito_origem_id = p_deposito_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(litros_descartados), 0)
    INTO v_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id
     AND data_hora::text <= p_data_hora;

  RETURN GREATEST(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);
END;
$$;
```

- [ ] **Step 2: Aplicar migration localmente (se Supabase local rodando) ou via MCP em dev**

Two options:

**Opção A — Local CLI:**
```bash
supabase db reset --local
# ou supabase migration up se já tiver migrations aplicadas localmente
```

**Opção B — Supabase MCP em dev (sem ambiente local):**
Aplicar via MCP `mcp__plugin_supabase_supabase__apply_migration` com nome `combustivel_deleted_at_filter` e o SQL acima.

Expected: sem erros. Funções recriadas.

- [ ] **Step 3: Verificar funções via SQL**

```sql
-- Via MCP execute_sql ou supabase db query:
SELECT
  proname,
  prosecdef,
  proconfig
FROM pg_proc
WHERE proname IN ('recalcular_nivel_deposito', 'calcular_estoque_combustivel_na_data')
  AND pronamespace = 'public'::regnamespace;
```

Expected: ambas com `prosecdef=true` e `proconfig` contendo `search_path=public,pg_temp`.

- [ ] **Step 4: Smoke test — criar saída teste, soft-deletar, verificar nível**

Pode ser feito via aplicação:
1. Anotar nível atual de um tanque (ex: tanque T)
2. Registrar uma saída de 100L do tanque T → confirmar nível diminuiu 100L
3. Soft-delete a saída (via lixeira ou UI de delete)
4. Verificar nível voltou ao valor original

Se nível NÃO voltou ao original, a migration não foi aplicada ou há outro problema.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120000_combustivel_deleted_at_filter.sql
git commit -m "fix(combustivel): filtrar deleted_at em recalcular_nivel_deposito e calcular_estoque

Bug T1+T2+C3 do audit: ambas as funções somavam registros soft-deletados
no cálculo de saldo do tanque, inflando o nível após soft-delete via
UI. Resultado: saldo errado, validação de estoque incorreta no form.

Fix: adicionar AND deleted_at IS NULL nos SELECTs de entradas/saídas/
transferências. Esvaziamentos não têm deleted_at (sem soft-delete).
Também aproveita pra adicionar SET search_path = public, pg_temp
(Finding 1 do audit)."
```

---

## Task HF.2: Enable RLS em `esvaziamentos_tanque` + policies

**Auditoria:** Finding 2 (HIGH). Tabela criada sem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Acessível direto via PostgREST.

**Files:**
- Create: `supabase/migrations/20260521120100_esvaziamentos_tanque_rls.sql`

- [ ] **Step 1: Criar migration**

Write `supabase/migrations/20260521120100_esvaziamentos_tanque_rls.sql`:

```sql
-- HF.2 — Combustível: habilitar RLS + policies em esvaziamentos_tanque.
--
-- Finding 2 do audit: tabela criada em 20260513000000_f11... sem
-- ENABLE RLS. Qualquer authenticated pode INSERT/UPDATE/DELETE direto
-- via PostgREST, corrompendo o saldo dos tanques.
--
-- Fix: enable RLS + policies por ação (mesmo padrão dos tighten_rls).

ALTER TABLE public.esvaziamentos_tanque ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotente)
DROP POLICY IF EXISTS esvaziamentos_tanque_select ON public.esvaziamentos_tanque;
DROP POLICY IF EXISTS esvaziamentos_tanque_insert ON public.esvaziamentos_tanque;
DROP POLICY IF EXISTS esvaziamentos_tanque_update ON public.esvaziamentos_tanque;
DROP POLICY IF EXISTS esvaziamentos_tanque_delete ON public.esvaziamentos_tanque;

-- SELECT: qualquer authenticated com ver_frota
CREATE POLICY esvaziamentos_tanque_select
  ON public.esvaziamentos_tanque
  FOR SELECT
  TO authenticated
  USING (private.current_has_action('ver_frota'));

-- INSERT: editar_combustivel (mesmo perm que controla saídas/transferências)
CREATE POLICY esvaziamentos_tanque_insert
  ON public.esvaziamentos_tanque
  FOR INSERT
  TO authenticated
  WITH CHECK (private.current_has_action('editar_combustivel'));

-- UPDATE: editar_combustivel
CREATE POLICY esvaziamentos_tanque_update
  ON public.esvaziamentos_tanque
  FOR UPDATE
  TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

-- DELETE: excluir_combustivel (mesmo perm que controla outras tabelas combustível)
CREATE POLICY esvaziamentos_tanque_delete
  ON public.esvaziamentos_tanque
  FOR DELETE
  TO authenticated
  USING (private.current_has_action('excluir_combustivel'));
```

- [ ] **Step 2: Aplicar migration**

Via MCP `apply_migration` com nome `esvaziamentos_tanque_rls`.

Expected: sem erros.

- [ ] **Step 3: Verificar RLS**

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'esvaziamentos_tanque';
```

Expected: `relrowsecurity = true`.

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'esvaziamentos_tanque';
```

Expected: 4 policies (select/insert/update/delete).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260521120100_esvaziamentos_tanque_rls.sql
git commit -m "fix(combustivel): habilitar RLS + policies em esvaziamentos_tanque

Finding 2 do audit (HIGH): tabela foi criada em 20260513000000
sem ALTER TABLE ... ENABLE ROW LEVEL SECURITY. Qualquer usuário
authenticated podia inserir esvaziamentos arbitrários via PostgREST,
corrompendo silenciosamente o saldo dos tanques.

Fix: ENABLE RLS + 4 policies gated por private.current_has_action()
seguindo o padrão de tighten_rls_critical_tables."
```

---

## Task HF.3: SET `search_path` em SECURITY DEFINER functions

**Auditoria:** Finding 1 (HIGH). Funções SECURITY DEFINER sem `search_path` fixo permitem schema shadowing por usuário malicioso.

> **Note:** A migration HF.1 já adicionou `SET search_path = public, pg_temp` em `recalcular_nivel_deposito` e `calcular_estoque_combustivel_na_data` via `CREATE OR REPLACE FUNCTION`. Esta tarefa cobre as funções legacy que serão dropadas em HF.4 — se HF.4 vai dropá-las, HF.3 fica vazia. Mas o audit também mencionou `trigger_abastecimento_nivel` (legacy órfã, não está em trigger ativo). Vou listar e cobrir.

**Files:**
- Create: `supabase/migrations/20260521120200_combustivel_secdef_search_path.sql`

- [ ] **Step 1: Discovery — listar funções SECDEF de combustível sem search_path fixo**

Run via Supabase MCP `execute_sql`:

```sql
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
  AND (
    proname LIKE '%combustivel%'
    OR proname LIKE '%deposito%'
    OR proname LIKE 'trigger_%_nivel'
    OR proname = 'calcular_estoque_combustivel_na_data'
  )
ORDER BY proname;
```

Esperado: lista de funções. Para cada uma, `proconfig` deve conter `search_path=public,pg_temp` após esta task.

**Se output mostrar funções com `proconfig IS NULL`** (ex: `trigger_entrada_combustivel_nivel`, `trigger_transferencia_combustivel_nivel`, `trigger_abastecimento_nivel`), prosseguir; se HF.4 vai dropar todas, esta task pode commitar uma migration vazia documentando que HF.1+HF.4 cobrem tudo.

- [ ] **Step 2: Criar migration**

Write `supabase/migrations/20260521120200_combustivel_secdef_search_path.sql`:

```sql
-- HF.3 — Combustível: SET search_path em SECURITY DEFINER functions.
--
-- Finding 1 do audit (HIGH): funções SECDEF sem search_path fixo permitem
-- schema shadowing. Usuário malicioso pode criar tabelas em schema próprio
-- e manipular search_path da sessão, fazendo função privilegiada referenciar
-- objetos fantasmas.
--
-- recalcular_nivel_deposito e calcular_estoque_combustivel_na_data já
-- recebem SET search_path em HF.1 via CREATE OR REPLACE. Esta migration
-- cobre as legacy wrappers que ainda existem antes de serem dropadas em HF.4.
-- Idempotente.

DO $$
BEGIN
  -- trigger_entrada_combustivel_nivel (será dropada em HF.4, mas se ainda existe, fixar)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_entrada_combustivel_nivel' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.trigger_entrada_combustivel_nivel() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_transferencia_combustivel_nivel' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.trigger_transferencia_combustivel_nivel() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_abastecimento_nivel' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.trigger_abastecimento_nivel() SET search_path = public, pg_temp';
  END IF;

  -- Funções material que também podem ser SECDEF sem search_path (defesa em profundidade)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calcular_estoque_material' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.calcular_estoque_material(text, text) SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calcular_estoque_material_na_data' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.calcular_estoque_material_na_data(text, text, text) SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calcular_todo_estoque_material' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.calcular_todo_estoque_material() SET search_path = public, pg_temp';
  END IF;
END$$;
```

- [ ] **Step 3: Aplicar migration**

Via MCP `apply_migration` com nome `combustivel_secdef_search_path`.

- [ ] **Step 4: Verificar**

```sql
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
  AND (
    proname LIKE 'trigger_%_nivel'
    OR proname LIKE 'calcular_estoque%'
    OR proname = 'recalcular_nivel_deposito'
  )
ORDER BY proname;
```

Expected: todas têm `proconfig` contendo `search_path=public,pg_temp`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521120200_combustivel_secdef_search_path.sql
git commit -m "fix(combustivel): SET search_path em SECURITY DEFINER legacy functions

Finding 1 do audit (HIGH): funções SECDEF sem search_path fixo permitem
schema shadowing. recalcular_nivel_deposito e calcular_estoque_combustivel_na_data
já foram cobertas em HF.1 via CREATE OR REPLACE.

Esta migration cobre as funções legacy (trigger_entrada_combustivel_nivel,
trigger_transferencia_combustivel_nivel, trigger_abastecimento_nivel) e
funções de material como defesa em profundidade — usando DO block com
IF EXISTS pra ser idempotente caso HF.4 já tenha dropado algumas."
```

---

## Task HF.4: Drop legacy triggers + functions

**Auditoria:** Bug E5+T3 (ALTA latente). Triggers legacy `trg_entrada_combustivel_nivel` e `trg_transferencia_combustivel_nivel` (SECURITY DEFINER) coexistem com triggers novos → `recalcular_nivel_deposito` roda 2× por operação. Função `trigger_abastecimento_nivel` ainda existe órfã (tabela `abastecimentos` foi dropada).

**Files:**
- Create: `supabase/migrations/20260521120300_drop_legacy_combustivel_triggers.sql`

- [ ] **Step 1: Discovery — confirmar quais triggers existem**

```sql
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgrelid IN ('public.entradas_combustivel'::regclass, 'public.transferencias_combustivel'::regclass)
  AND tgname IN (
    'trg_entrada_combustivel_nivel',
    'trg_transferencia_combustivel_nivel',
    'trg_entradas_combustivel_recalc_nivel',
    'trg_transferencias_combustivel_recalc_nivel'
  );
```

Expected: 4 triggers — 2 legacy (singular `trg_entrada/transferencia_combustivel_nivel`) + 2 novos (plural `trg_entradas/transferencias_combustivel_recalc_nivel`).

```sql
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'trigger_entrada_combustivel_nivel',
    'trigger_transferencia_combustivel_nivel',
    'trigger_abastecimento_nivel'
  );
```

Expected: 3 funções legacy.

- [ ] **Step 2: Criar migration**

Write `supabase/migrations/20260521120300_drop_legacy_combustivel_triggers.sql`:

```sql
-- HF.4 — Combustível: drop legacy nivel triggers + functions.
--
-- Bug E5+T3 do audit: triggers legacy AFTER (trg_entrada_combustivel_nivel,
-- trg_transferencia_combustivel_nivel) coexistem com triggers novos
-- (trg_entradas/transferencias_combustivel_recalc_nivel). Ambos chamam
-- recalcular_nivel_deposito após cada operação → função roda 2× por
-- operação. Idempotente, mas custo desnecessário e risco de divergência
-- futura.
--
-- Função trigger_abastecimento_nivel está órfã (tabela abastecimentos foi
-- dropada em 20260505).
--
-- Fix: drop triggers + funções legacy. Os triggers novos cobrem 100% da
-- funcionalidade.

-- Drop legacy triggers (idempotente)
DROP TRIGGER IF EXISTS trg_entrada_combustivel_nivel ON public.entradas_combustivel;
DROP TRIGGER IF EXISTS trg_transferencia_combustivel_nivel ON public.transferencias_combustivel;

-- Drop legacy functions (no longer referenced by any trigger)
DROP FUNCTION IF EXISTS public.trigger_entrada_combustivel_nivel();
DROP FUNCTION IF EXISTS public.trigger_transferencia_combustivel_nivel();
DROP FUNCTION IF EXISTS public.trigger_abastecimento_nivel();
```

- [ ] **Step 3: Aplicar migration**

Via MCP `apply_migration` com nome `drop_legacy_combustivel_triggers`.

- [ ] **Step 4: Verificar — triggers dropados, novos ainda presentes**

```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid IN ('public.entradas_combustivel'::regclass, 'public.transferencias_combustivel'::regclass)
  AND tgname LIKE '%nivel%';
```

Expected: apenas `trg_entradas_combustivel_recalc_nivel` e `trg_transferencias_combustivel_recalc_nivel`. Sem `trg_entrada_combustivel_nivel` ou `trg_transferencia_combustivel_nivel`.

```sql
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname LIKE 'trigger_%_nivel';
```

Expected: vazio (todas as 3 funções legacy dropadas).

- [ ] **Step 5: Smoke test — INSERT + nível**

Inserir uma entrada teste num tanque e confirmar que o nível atualiza corretamente (uma única vez agora, em vez de 2×).

```sql
-- Anotar nível inicial
SELECT id, nivel_atual_litros FROM public.depositos WHERE id = '<tanque-de-teste-id>';
-- Inserir uma entrada de 100L
-- (via UI ou SQL — não exemplificado aqui)
-- Confirmar nível subiu exatamente 100L
SELECT id, nivel_atual_litros FROM public.depositos WHERE id = '<tanque-de-teste-id>';
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260521120300_drop_legacy_combustivel_triggers.sql
git commit -m "fix(combustivel): drop legacy triggers + functions de nivel

Bug E5+T3 do audit: triggers legacy AFTER (SECURITY DEFINER) coexistiam
com triggers novos chamando recalcular_nivel_deposito 2× por operação.
trigger_abastecimento_nivel estava órfã (tabela foi dropada).

Drop:
- trg_entrada_combustivel_nivel + trigger_entrada_combustivel_nivel()
- trg_transferencia_combustivel_nivel + trigger_transferencia_combustivel_nivel()
- trigger_abastecimento_nivel() (órfã)

Os triggers novos (trg_entradas/transferencias_combustivel_recalc_nivel)
cobrem 100% da funcionalidade."
```

---

## Task HF.5: Helper `calcularPrecoMedioTanque` + Mobile fix (bugs S1-S6)

**Auditoria:** Item 1 (ALTA) — Mobile `MSaidaCombustivelPage.tsx` grava `valor_total=0`, `preco_unitario=0`, `tipo_consumidor='equipamento'` (CHECK violation), `tipo_combustivel='diesel'` hardcoded, `alocacoes=[]`, e bypassa hook (cache stale).

**Files:**
- Create: `src/utils/precoMedioTanque.ts`
- Create: `src/utils/precoMedioTanque.test.ts`
- Modify: `src/pages/mobile/MSaidaCombustivelPage.tsx`

### Step 1: Criar helper puro + testes (TDD)

- [ ] **Step 1.1: Failing tests**

Create `src/utils/precoMedioTanque.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcularPrecoMedioTanque } from './precoMedioTanque'
import type { EntradaCombustivel, TransferenciaCombustivel } from '../types'

const e = (depositoId: string, qtd: number, valor: number): EntradaCombustivel => ({
  id: 'e-' + Math.random(),
  dataHora: '2026-01-01T00:00:00Z',
  depositoId,
  tipoCombustivel: 'diesel',
  quantidadeLitros: qtd,
  valorTotal: valor,
  fornecedor: '',
  notaFiscal: '',
  observacoes: '',
  criadoPor: '',
})

const t = (origemId: string, destinoId: string, qtd: number, valor: number): TransferenciaCombustivel => ({
  id: 't-' + Math.random(),
  dataHora: '2026-01-01T00:00:00Z',
  depositoOrigemId: origemId,
  depositoDestinoId: destinoId,
  quantidadeLitros: qtd,
  valorTotal: valor,
  observacoes: '',
  criadoPor: '',
})

describe('calcularPrecoMedioTanque', () => {
  it('retorna 0 se não houver entradas nem transferências recebidas', () => {
    expect(calcularPrecoMedioTanque('t1', [], [])).toBe(0)
  })

  it('média ponderada apenas com entradas', () => {
    // 1000L a R$ 5 + 500L a R$ 6 = R$ 8000 / 1500L = R$ 5,3333
    const entradas = [e('t1', 1000, 5000), e('t1', 500, 3000)]
    expect(calcularPrecoMedioTanque('t1', entradas, [])).toBeCloseTo(8000 / 1500, 4)
  })

  it('ignora entradas de outros depósitos', () => {
    const entradas = [e('t1', 1000, 5000), e('OUTRO', 500, 9999)]
    expect(calcularPrecoMedioTanque('t1', entradas, [])).toBe(5)
  })

  it('inclui transferências recebidas (depositoDestinoId === tanqueId)', () => {
    // entrada: 1000L a R$5; transferência IN: 500L a R$6 → 8000/1500 = R$ 5,3333
    const entradas = [e('t1', 1000, 5000)]
    const transferencias = [t('OUTRO', 't1', 500, 3000)]
    expect(calcularPrecoMedioTanque('t1', entradas, transferencias)).toBeCloseTo(8000 / 1500, 4)
  })

  it('ignora transferências enviadas (depositoOrigemId === tanqueId)', () => {
    const entradas = [e('t1', 1000, 5000)]
    const transferencias = [t('t1', 'OUTRO', 500, 9999)] // sai de t1, não soma
    expect(calcularPrecoMedioTanque('t1', entradas, transferencias)).toBe(5)
  })

  it('tanque que só recebe via transferência (sem entradas)', () => {
    // Bug C2 do audit: antes retornava 0 → bloqueava saídas
    const transferencias = [t('OUTRO', 't1', 500, 3000)]
    expect(calcularPrecoMedioTanque('t1', [], transferencias)).toBe(6)
  })

  it('respeita litros zero (divisão evitada)', () => {
    // edge: entrada com 0 litros não deve causar Infinity ou NaN
    const entradas = [e('t1', 0, 0)]
    expect(calcularPrecoMedioTanque('t1', entradas, [])).toBe(0)
  })
})
```

- [ ] **Step 1.2: Run tests — esperar FAIL**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm test src/utils/precoMedioTanque.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement helper**

Create `src/utils/precoMedioTanque.ts`:

```typescript
import type { EntradaCombustivel, TransferenciaCombustivel } from '../types'

/**
 * Calcula o preço médio ponderado de combustível em um tanque, incluindo:
 * - Entradas (compras) com depositoId === tanqueId
 * - Transferências recebidas (depositoDestinoId === tanqueId)
 *
 * Retorna 0 se não houver dados (em vez de NaN) — tanque vazio bloqueia
 * o submit naturalmente via validação client.
 *
 * Bug C2 do audit: antes só somava entradas, então tanque que só recebia
 * por transferência retornava 0 e bloqueava saídas.
 *
 * Spec: combustivel-audit.md / HF.5
 */
export function calcularPrecoMedioTanque(
  tanqueId: string,
  entradas: EntradaCombustivel[],
  transferencias: TransferenciaCombustivel[],
): number {
  let totalLitros = 0
  let totalValor = 0

  for (const e of entradas) {
    if (e.depositoId === tanqueId) {
      totalLitros += e.quantidadeLitros
      totalValor += e.valorTotal
    }
  }

  for (const t of transferencias) {
    if (t.depositoDestinoId === tanqueId) {
      totalLitros += t.quantidadeLitros
      totalValor += t.valorTotal
    }
  }

  return totalLitros > 0 ? totalValor / totalLitros : 0
}
```

- [ ] **Step 1.4: Run tests — esperar PASS**

```bash
npm test src/utils/precoMedioTanque.test.ts
```

Expected: `7 tests passed`.

- [ ] **Step 1.5: Commit**

```bash
git add src/utils/precoMedioTanque.ts src/utils/precoMedioTanque.test.ts
git commit -m "feat(combustivel): helper puro calcularPrecoMedioTanque + 7 testes

Spec: combustivel-audit.md HF.5+HF.6.

Diferenças vs cálculo inline atual:
- Agora considera TRANSFERÊNCIAS RECEBIDAS (Bug C2 do audit) — antes
  tanque que só recebia por transferência retornava 0 e bloqueava saídas
- Função pura testável; será usada pelo mobile (HF.5) e pelos forms
  desktop (HF.6) eliminando duplicação inline"
```

### Step 2: Refatorar MSaidaCombustivelPage pra usar hook + helper + corrigir bugs

- [ ] **Step 2.1: Read current file state**

```bash
wc -l src/pages/mobile/MSaidaCombustivelPage.tsx
```

Expected: ~310 LOC após patches recentes.

- [ ] **Step 2.2: Modificar imports + state**

Modify `src/pages/mobile/MSaidaCombustivelPage.tsx`.

Substituir os imports do topo:

```typescript
import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Droplet, CheckCircle2, AlertTriangle, Gauge } from 'lucide-react';
import Button from '../../components/ui/Button';
import SmartSelect from '../../components/ui/SmartSelect';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { useDepositos } from '../../hooks/useDepositos';
import { useObras } from '../../hooks/useObras';
import { useEtapas } from '../../hooks/useEtapas';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import AnexosUploader from '../../components/combustivel/AnexosUploader';
import { useAdicionarSaidaCombustivel } from '../../hooks/useSaidasCombustivel';
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel';
import { useTransferenciasCombustivel } from '../../hooks/useTransferenciasCombustivel';
import { calcularPrecoMedioTanque } from '../../utils/precoMedioTanque';
import { useInsumos } from '../../hooks/useInsumos';
```

> **Nota:** Verificar se `useInsumos` existe — provavelmente sim (combustível é um insumo). Se não existir, pegar combustíveis via outra fonte (depósito tem `combustivelAtualId`).

- [ ] **Step 2.3: Substituir handleSubmit corrigindo todos os bugs**

Encontrar a função `handleSubmit` em `MSaidaCombustivelPage.tsx` (cerca da linha 100). Substituir por:

```typescript
  const { data: entradasCombustivel = [] } = useEntradasCombustivel();
  const { data: transferencias = [] } = useTransferenciasCombustivel();
  const { data: insumos = [] } = useInsumos();
  const adicionarSaidaMutation = useAdicionarSaidaCombustivel();

  // Preço médio do tanque selecionado (inclui transferências recebidas — HF.6)
  const precoMedioTanque = useMemo(() => {
    if (!tanqueId) return 0;
    return calcularPrecoMedioTanque(tanqueId, entradasCombustivel, transferencias);
  }, [tanqueId, entradasCombustivel, transferencias]);

  // Combustível do tanque selecionado (UUID, não string hardcoded)
  const tanqueSelecionado = useMemo(
    () => tanquesAtivos.find((t) => t.id === tanqueId),
    [tanquesAtivos, tanqueId]
  );
  const combustivelDoTanque = tanqueSelecionado?.combustivelAtualId ?? '';
```

E substituir a função `handleSubmit` inteira:

```typescript
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting || !equipamentoId || !equipamento || !tanqueSelecionado) return;
    setErro(null);
    setSubmitting(true);
    try {
      const saidaId = gerarId('saida');
      const medicaoNum = medicaoLeitura.trim() ? numOrZero(medicaoLeitura) : null;
      const agora = new Date().toISOString();
      const valorTotal = litrosNum * precoMedioTanque;

      await adicionarSaidaMutation.mutateAsync({
        id: saidaId,
        data: agora,
        origem: 'tanque',
        tipoConsumidor: 'equipamento_proprio',  // Fix Bug S1 (era 'equipamento')
        tanqueId,
        equipamentoId,
        transportadoraId: null,
        placa: null,
        obraId,
        etapaId,
        alocacoes: etapaId ? [{ etapaId, percentual: 100 }] : null,  // Fix Bug S6
        tipoCombustivel: combustivelDoTanque,  // Fix Bug S3 (era 'diesel' hardcoded)
        litros: litrosNum,
        precoMedioTanqueSnapshot: precoMedioTanque,  // Fix Bug S4 (era null)
        taxaLitro: 0,
        precoUnitario: precoMedioTanque,  // Fix Bug S2 (era 0)
        precoCombustivel: null,
        precoCombustivelAreacre: null,
        valorTotal,  // Fix Bug S2 (era 0)
        observacoes: observacoes.trim() || `Saída via mobile · ${usuario?.nome ?? ''}`,
        pago: false,
        pagoEm: null,
        movimentoId: null,
        fotoUrls: fotoUrls,
        arquivoUrls: [],
        motorista: usuario?.nome ?? '',
        medicaoNoAbastecimento: medicaoNum,
        tipoMedicaoSnapshot: equipamento.tipoMedicao ?? null,
        createdAt: agora,
        updatedAt: agora,
        createdBy: usuario?.nome ?? '',
        updatedBy: usuario?.nome ?? '',
      });

      showToast({
        kind: 'success',
        message: `Saída de ${litrosNum.toLocaleString('pt-BR')}L registrada.`,
      });
      navigate(`/m/eq/${equipamentoId}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar saída');
    } finally {
      setSubmitting(false);
    }
  }
```

> **Nota crítica:** O objeto enviado pra `mutateAsync` é `SaidaCombustivel` (interface TS). Verifique campos exatos lendo `src/types/index.ts` antes de finalizar — alguns nomes podem variar (ex: `pagoEm` vs `pagoPor`, `precoCombustivel` etc). O mapper `saidaCombustivelToDb` em `src/lib/mappers.ts` faz a conversão pro snake_case.

- [ ] **Step 2.4: Remover imports não usados (supabase direto)**

Após o refactor, `supabase.from('saidas_combustivel').insert(...)` não é mais usado. Remover o import de `supabase` se ele estava no topo só pra esse uso.

Run:
```bash
grep -n "supabase\|gerarId" src/pages/mobile/MSaidaCombustivelPage.tsx
```

Manter `gerarId` (ainda usado pro `saidaId`). Remover o import de `supabase` se exclusivo.

- [ ] **Step 2.5: Verify TypeScript + build**

```bash
npx tsc -b 2>&1 | tail -10
```

Expected: zero errors. Se houver erro de tipo no payload da mutation, conferir `SaidaCombustivel` em `src/types/index.ts` e ajustar nomes.

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built`.

- [ ] **Step 2.6: Commit**

```bash
git add src/pages/mobile/MSaidaCombustivelPage.tsx
git commit -m "fix(combustivel-mobile): corrige bugs S1-S6 da auditoria

Mobile MSaidaCombustivelPage estava gravando saídas com:
- tipo_consumidor='equipamento' (viola CHECK; deveria ser 'equipamento_proprio')
- preco_unitario=0, valor_total=0 (registros zerados financeiramente)
- tipo_combustivel='diesel' hardcoded (deveria ser UUID do insumo do tanque)
- preco_medio_tanque_snapshot=null (perda de rastreabilidade)
- alocacoes=[] (deveria ser [{etapaId, percentual:100}] quando etapa preenchida)
- Insert direto sem hook → cache React Query stale no desktop

Fix:
- Usa useAdicionarSaidaCombustivel (invalida 5 query keys)
- Usa novo helper calcularPrecoMedioTanque (HF.5 step 1) incluindo
  entradas + transferências recebidas
- tipoCombustivel = combustivelAtualId do depósito (UUID)
- Enum correto, snapshot persistido, alocações corretas

Refs: combustivel-audit.md Bug S1, S2, S3, S4, S5, S6"
```

---

## Task HF.6: Forms desktop usam o helper compartilhado

**Auditoria:** Item 5 (Bug C2). Desktop `SaidaCombustivelForm` e `TransferenciaForm` calculam `precoMedio` inline considerando apenas `entradas_combustivel` — ignorando transferências recebidas.

**Files:**
- Modify: `src/components/combustivel/SaidaCombustivelForm.tsx`
- Modify: `src/components/combustivel/TransferenciaForm.tsx`

### SaidaCombustivelForm

- [ ] **Step 1.1: Add helper import**

Modify `src/components/combustivel/SaidaCombustivelForm.tsx`.

Adicionar import:
```typescript
import { calcularPrecoMedioTanque } from '../../utils/precoMedioTanque';
import { useTransferenciasCombustivel } from '../../hooks/useTransferenciasCombustivel';
```

E adicionar hook no corpo do componente (junto com `useEntradasCombustivel`):
```typescript
const { data: transferencias = [] } = useTransferenciasCombustivel();
```

- [ ] **Step 1.2: Substituir cálculo inline**

Encontrar o bloco `const precoMedioTanque = useMemo(...)` (cerca da linha 247):

```typescript
// Trecho atual a ser substituído:
const precoMedioTanque = useMemo(() => {
  if (origem !== 'tanque' || !tanqueId) return 0;
  const ents = entradasCombustivel.filter((e) => e.depositoId === tanqueId);
  if (ents.length === 0) return 0;
  const totalValor = ents.reduce((s, e) => s + e.valorTotal, 0);
  const totalLitros = ents.reduce((s, e) => s + e.quantidadeLitros, 0);
  return totalLitros > 0 ? totalValor / totalLitros : 0;
}, [origem, tanqueId, entradasCombustivel]);
```

Substituir por:

```typescript
const precoMedioTanque = useMemo(() => {
  if (origem !== 'tanque' || !tanqueId) return 0;
  return calcularPrecoMedioTanque(tanqueId, entradasCombustivel, transferencias);
}, [origem, tanqueId, entradasCombustivel, transferencias]);
```

- [ ] **Step 1.3: Verify TypeScript**

```bash
npx tsc -b 2>&1 | tail -5
```

Expected: zero errors.

### TransferenciaForm

- [ ] **Step 2.1: Add helper import**

Modify `src/components/combustivel/TransferenciaForm.tsx`.

Adicionar import (junto aos outros do topo):
```typescript
import { calcularPrecoMedioTanque } from '../../utils/precoMedioTanque';
```

- [ ] **Step 2.2: Substituir cálculo inline**

Encontrar o bloco `const precoMedio = useMemo(...)` (cerca da linha 117):

```typescript
// Trecho atual a ser substituído:
const entradasOrigem = allEntradas.filter((e) => e.depositoId === depositoOrigemId);
const totalLitrosEntradas = entradasOrigem.reduce((s, e) => s + e.quantidadeLitros, 0);
const totalValorEntradas = entradasOrigem.reduce((s, e) => s + e.valorTotal, 0);
const precoMedio = totalLitrosEntradas > 0 ? totalValorEntradas / totalLitrosEntradas : 0;
```

Substituir por:

```typescript
const precoMedio = depositoOrigemId
  ? calcularPrecoMedioTanque(depositoOrigemId, allEntradas, allTransferencias)
  : 0;
```

> **Nota:** Esse trecho já pode ter `allTransferencias` no escopo via `useTransferenciasCombustivel()`. Se não tem, adicionar:
> ```typescript
> const { data: allTransferencias = [] } = useTransferenciasCombustivel();
> ```

- [ ] **Step 2.3: Verify TypeScript + build**

```bash
npx tsc -b 2>&1 | tail -5
npm run build 2>&1 | tail -3
```

Expected: zero errors, build passes.

- [ ] **Step 2.4: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: todos passando (inclui os 7 do `precoMedioTanque.test.ts`).

- [ ] **Step 2.5: Commit**

```bash
git add src/components/combustivel/SaidaCombustivelForm.tsx src/components/combustivel/TransferenciaForm.tsx
git commit -m "fix(combustivel): forms desktop usam helper compartilhado (inclui transferências)

Bug C2 do audit (ALTA): cálculo inline em SaidaCombustivelForm:247 e
TransferenciaForm:117 considerava apenas entradas do depósito, ignorando
transferências recebidas. Tanque que só recebe por transferência tinha
precoMedio=0 e bloqueava saídas.

Fix: substitui inline pelo helper calcularPrecoMedioTanque (criado em
HF.5 step 1), que agora soma entradas + transferências recebidas.
Mesma lógica usada pelo mobile MSaidaCombustivelPage.

Refs: combustivel-audit.md item 5 (Bug C2)."
```

---

## Task HF.7: Granular RLS policies em tabelas de combustível

**Auditoria:** Finding 6 (MEDIUM mas listado como ALTA pelo audit). Todas as tabelas têm `FOR ALL TO authenticated USING(true) WITH CHECK(true)` — Operador pode DELETE/UPDATE direto via PostgREST burlando soft-delete.

**Files:**
- Create: `supabase/migrations/20260521120400_tighten_rls_combustivel.sql`

- [ ] **Step 1: Criar migration**

Write `supabase/migrations/20260521120400_tighten_rls_combustivel.sql`:

```sql
-- HF.7 — Combustível: granular RLS policies (substituir blanket).
--
-- Finding 6 do audit: todas as tabelas combustível tinham
-- "Authenticated full access" (FOR ALL TO authenticated USING(true) WITH CHECK(true)).
-- Resultado: qualquer usuário authenticated podia DELETE/UPDATE direto
-- via PostgREST, burlando soft-delete e fluxos de aprovação.
--
-- Fix: substituir por policies separadas SELECT/INSERT/UPDATE/DELETE
-- gated por private.current_has_action(), mesmo padrão de
-- 20260520180000_tighten_rls_fretes.sql.
--
-- Tabelas afetadas: depositos, entradas_combustivel, saidas_combustivel,
-- transferencias_combustivel, transportadora_movimentos.
--
-- Note: esvaziamentos_tanque é coberto pela HF.2 (RLS habilitado +
-- policies criadas naquela migration).

-- ============== depositos ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.depositos;
DROP POLICY IF EXISTS depositos_select ON public.depositos;
DROP POLICY IF EXISTS depositos_insert ON public.depositos;
DROP POLICY IF EXISTS depositos_update ON public.depositos;
DROP POLICY IF EXISTS depositos_delete ON public.depositos;

CREATE POLICY depositos_select ON public.depositos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY depositos_insert ON public.depositos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY depositos_update ON public.depositos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY depositos_delete ON public.depositos
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== entradas_combustivel ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_select ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_insert ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_update ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_delete ON public.entradas_combustivel;

CREATE POLICY entradas_combustivel_select ON public.entradas_combustivel
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY entradas_combustivel_insert ON public.entradas_combustivel
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_entrada_combustivel'));

CREATE POLICY entradas_combustivel_update ON public.entradas_combustivel
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY entradas_combustivel_delete ON public.entradas_combustivel
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== saidas_combustivel ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_select ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_insert ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_update ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_delete ON public.saidas_combustivel;

CREATE POLICY saidas_combustivel_select ON public.saidas_combustivel
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

-- INSERT: aceita criar_saida_combustivel (equipamento próprio) OU criar_abastecimento_carreta (carreta)
CREATE POLICY saidas_combustivel_insert ON public.saidas_combustivel
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  );

CREATE POLICY saidas_combustivel_update ON public.saidas_combustivel
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY saidas_combustivel_delete ON public.saidas_combustivel
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== transferencias_combustivel ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_select ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_insert ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_update ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_delete ON public.transferencias_combustivel;

CREATE POLICY transferencias_combustivel_select ON public.transferencias_combustivel
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY transferencias_combustivel_insert ON public.transferencias_combustivel
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_transferencia_combustivel'));

CREATE POLICY transferencias_combustivel_update ON public.transferencias_combustivel
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY transferencias_combustivel_delete ON public.transferencias_combustivel
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== transportadora_movimentos ==============
-- Tabela é ledger gerada por trigger; UPDATE/DELETE diretos devem ser admin-only.
DROP POLICY IF EXISTS "Authenticated full access" ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_select ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_insert ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_update ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_delete ON public.transportadora_movimentos;

CREATE POLICY transportadora_movimentos_select ON public.transportadora_movimentos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frete'));

-- INSERT: feito apenas por trigger fn_saidas_combustivel_movimentos (SECURITY DEFINER).
-- Operador comum não deve criar movimento direto. Restringe a ajuste_manual perm
-- (a definir; se não houver, usar gerenciar_permissoes como admin gate).
CREATE POLICY transportadora_movimentos_insert ON public.transportadora_movimentos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY transportadora_movimentos_update ON public.transportadora_movimentos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY transportadora_movimentos_delete ON public.transportadora_movimentos
  FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'));
```

> **Note sobre `transportadora_movimentos`:** Esta tabela é ledger; INSERTs vêm da trigger `fn_saidas_combustivel_movimentos` (SECURITY DEFINER, INVOKER no SQL) que roda com privilégios de owner. Sob nova policy de INSERT restrita, a trigger continua funcionando porque triggers bypass RLS quando função é dona da tabela. Verificar isso após apply.

- [ ] **Step 2: Aplicar migration**

Via MCP `apply_migration` com nome `tighten_rls_combustivel`.

Expected: sem erros. Se algum DROP POLICY falhar com "does not exist", está OK (idempotente).

- [ ] **Step 3: Verificar policies criadas**

```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('depositos', 'entradas_combustivel', 'saidas_combustivel',
                    'transferencias_combustivel', 'transportadora_movimentos')
ORDER BY tablename, cmd;
```

Expected: 5 tabelas × 4 policies = 20 rows.

- [ ] **Step 4: Smoke test — operador comum não consegue DELETE direto**

Via app (logado como Operador), tentar excluir uma saída via UI normal — deve continuar funcionando (via soft-delete usando ação `excluir_combustivel`).

Via SQL como Operador (testar via Supabase Studio com auth do Operador), tentar:
```sql
DELETE FROM public.saidas_combustivel WHERE id = '<algum-id>';
```

Expected: erro `42501: new row violates row-level security policy` se Operador não tem `excluir_combustivel`. Se tem, OK — depende da configuração de cargo.

- [ ] **Step 5: Verificar que trigger de movimento ainda funciona**

Registrar uma saída tipo carreta via UI desktop. Verificar que entry foi criado em `transportadora_movimentos` via:

```sql
SELECT * FROM public.transportadora_movimentos
ORDER BY created_at DESC LIMIT 5;
```

Expected: nova entrada visível. Se trigger falhou silenciosamente, **será necessário ajustar a policy de INSERT** pra incluir o role do trigger (geralmente `postgres` ou criar policy `TO postgres`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260521120400_tighten_rls_combustivel.sql
git commit -m "fix(combustivel): granular RLS policies em tabelas de combustível

Finding 6 do audit (HIGH em impacto): tabelas combustível tinham
'Authenticated full access' (FOR ALL TO authenticated USING(true)
WITH CHECK(true)). Operador podia DELETE direto via PostgREST burlando
soft-delete; UPDATE em preco_unitario/valor_total sem permissão de edit.

Fix: substitui por policies separadas SELECT/INSERT/UPDATE/DELETE gated
por private.current_has_action(). Mesmo padrão de tighten_rls_fretes
e tighten_rls_critical_tables.

Permissões usadas:
- ver_frota (SELECT em depositos/entradas/saidas/transferencias)
- ver_frete (SELECT em transportadora_movimentos)
- criar_entrada_combustivel, criar_saida_combustivel, criar_abastecimento_carreta
- criar_transferencia_combustivel
- editar_combustivel (UPDATE em todas)
- excluir_combustivel (DELETE em todas)
- gerenciar_permissoes (INSERT/UPDATE/DELETE em transportadora_movimentos —
  pois movimentos são gerados por trigger e ajustes manuais devem ser admin-only)

Refs: combustivel-audit.md Finding 6."
```

---

## Task HF.8: Build + security review + deploy + push

**Files:** none (operacional)

- [ ] **Step 1: Build + testes passam**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -10
```

Expected: `✓ built`, testes verdes (deve incluir os 7 novos de `precoMedioTanque`).

- [ ] **Step 2: `/security-review`**

No Claude Code:
```
/security-review
```

Expected:
- Funções com `search_path = public, pg_temp` (HF.1, HF.3)
- `esvaziamentos_tanque` agora tem RLS (HF.2)
- Triggers legacy removidos (HF.4)
- Policies granulares ativas (HF.7)
- Mobile saída usando hook (HF.5)

Se security-review identificar regressão (improvável dado que estamos endurecendo, não relaxando), corrigir antes de prosseguir.

- [ ] **Step 3: Preview deploy**

```bash
npx --yes vercel deploy 2>&1 | tail -5
```

Anotar URL do preview.

- [ ] **Step 4: Smoke test em produção-like (preview)**

Roteiro mínimo:

**A. Mobile (saída via QR)** — corrige bugs S1-S6:
1. Abrir preview no iPhone ou Android (Safari/Chrome)
2. Logar
3. Ir em /m → escanear QR de equipamento → "Saída de combustível"
4. Selecionar tanque, obra, etapa
5. Digitar 50L
6. Tirar 1 foto
7. Salvar
8. Confirmar: registro criado com `valor_total > 0`, `tipo_consumidor='equipamento_proprio'`, `tipo_combustivel` UUID correto.
9. Voltar pro desktop (mesma sessão ou outra aba): a saída deve aparecer na lista imediatamente (cache invalidado).

**B. Soft-delete reflete no saldo** — confirma HF.1:
1. Desktop → Combustível → Saídas
2. Registrar saída teste de 100L → confirmar nível do tanque diminuiu 100L
3. Excluir essa saída (soft-delete via lixeira)
4. Verificar: nível do tanque voltou ao valor original

**C. Transferência aparece no preço médio** — confirma HF.5/HF.6:
1. Tanque B com 0 entradas próprias
2. Transferir 500L do tanque A pro B (tanque A com histórico)
3. Tentar saída do tanque B
4. Verificar: `preço médio` no preview ≠ 0 (antes era 0 e bloqueava)

**D. Esvaziamento exige permissão** — confirma HF.2:
1. Logar como Operador (sem `editar_combustivel`)
2. Tentar esvaziar tanque (botão na lista de tanques)
3. Verificar: erro "row-level security policy" ou similar

- [ ] **Step 5: Promover prod (com confirmação do usuário)**

Pedir aprovação ao usuário. Se OK:

```bash
npx --yes vercel --prod 2>&1 | tail -5
```

- [ ] **Step 6: Merge na main + push**

```bash
git checkout main
git pull origin main
git merge --no-ff feat/combustivel-high-risk-fixes -m "Merge branch 'feat/combustivel-high-risk-fixes'

Corrige os 7 problemas de alto risco do audit combustivel-audit.md:

HF.1 — recalcular_nivel_deposito e calcular_estoque_combustivel_na_data
       filtram deleted_at IS NULL
HF.2 — esvaziamentos_tanque ganha RLS + policies
HF.3 — SET search_path em SECURITY DEFINER legacy
HF.4 — drop triggers legacy duplicados
HF.5 — Mobile MSaidaCombustivelPage corrige bugs S1-S6
HF.6 — Preço médio inclui transferências recebidas
HF.7 — Granular RLS policies em depositos/entradas/saidas/transferencias/transp_movimentos

Plan: docs/superpowers/plans/2026-05-21-combustivel-high-risk-fixes.md
Audit: combustivel-audit.md"

git push origin main 2>&1 | tail -3
```

---

## Critérios de Aceitação

- ✅ `npm test` passa com os 7 novos testes de `calcularPrecoMedioTanque`
- ✅ `npm run build` passa
- ✅ 5 migrations aplicadas em prod sem erros
- ✅ Smoke test mobile: nova saída tem `valor_total > 0`, `tipo_consumidor='equipamento_proprio'`, `tipo_combustivel` UUID correto
- ✅ Smoke test soft-delete: saldo do tanque reflete soft-deletes corretamente
- ✅ Smoke test transferência: tanque que só recebe via transferência permite saída (preço médio > 0)
- ✅ Smoke test RLS: Operador sem `editar_combustivel` recebe erro ao tentar UPDATE direto via SQL
- ✅ `/security-review` retorna `NO_FINDINGS` ou apenas pre-existing concerns

---

## Pós-implementação

**Out of scope deste plano** (requer brainstorming separado pra definir política de negócio):

- **Item 5 do audit (parcial — Bug C1):** Decisão entre FIFO, LIFO, ponderada com janela móvel temporal. O preço médio continua sendo ponderado vitalício após HF.6 — o que pode subestimar custo corrente quando preço de compra varia muito ao longo do tempo. Requer brainstorming com stakeholder pra definir o método correto pro negócio.

- **Itens 8-15 do audit** (MÉDIA/BAIXA priority): UX issues (alert/confirm/prompt), header verde EntradaList/TransferenciaList, RHF+Zod migration, @tanstack/react-table nas listas, Sheet/Dialog shadcn, file size limits no bucket, etc. Cobrir em planos separados.

## Riscos Conhecidos

- **HF.7 + trigger de movimento:** A nova policy de INSERT em `transportadora_movimentos` (restringida a `gerenciar_permissoes`) pode bloquear o trigger `fn_saidas_combustivel_movimentos` se este não rodar como `postgres` ou owner. Mitigação: Step 5 da Task HF.7 valida via smoke test; se falhar, ajustar policy pra incluir o role do trigger (geralmente adicionar policy `TO postgres` ou marcar trigger como SECURITY DEFINER se já não for).

- **HF.4 ordem de migrations:** Se a migration HF.3 (`SET search_path`) rodar DEPOIS de HF.4 (drop functions), o `ALTER FUNCTION ... SET search_path` no DO block usa `IF EXISTS` pra ser idempotente — não vai falhar. Garantir que os arquivos têm o naming `20260521120200_...` (HF.3) < `20260521120300_...` (HF.4) pra ordem cronológica.

- **HF.5 mapper de tipos:** O objeto enviado pra `mutateAsync` precisa bater 100% com o tipo `SaidaCombustivel` em `src/types/index.ts`. Se algum campo opcional for omitido ou tiver typo, TypeScript pega. Verificar antes de commitar.
