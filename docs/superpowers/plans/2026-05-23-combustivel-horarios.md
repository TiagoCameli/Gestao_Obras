# Combustível Horários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Padronizar tratamento de timezone, migrar `data_hora text → timestamptz` em entradas/transferências, adicionar trigger anti-futuro com janela permissiva, consolidar funções `fmt*` redundantes em utilitário único com TZ BRT fixo.

**Architecture:** Convenção uniforme: tudo gravado como `timestamptz` em UTC, exibido em BRT via `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`. Forms convertem `<input datetime-local>` (string sem offset) pra ISO BRT no submit (não mais UTC implícito). Migration mantém dados existentes parseados como UTC (compatível com o que o app já gravou).

**Tech Stack:** PostgreSQL (Supabase MCP), React, TypeScript.

**Audit fonte:** `combustivel-horarios-precos.md` seção C + Parte E.1.

**Branch:** `feat/combustivel-horarios` (baseada em main).

---

## File Structure

**Migrations:**
- `supabase/migrations/20260523130000_combustivel_data_hora_timestamptz.sql` — migrar text→timestamptz
- `supabase/migrations/20260523130100_combustivel_trigger_anti_futuro.sql` — validação 24h grace
- `supabase/migrations/20260523130200_drop_dup_updated_at_trigger.sql` — cleanup

**TS modificados:**
- `src/components/combustivel/v2/shared/formatters.ts` — `fmtData` e `fmtDataHora` ganham TZ BRT
- `src/components/combustivel/v2/shared/formatters.test.ts` — testes
- 9 arquivos com `fmtData`/`fmtDataHora` local → consolidam pelo shared
- `src/components/combustivel/SaidaCombustivelForm.tsx` — default convertido pra BRT no input datetime-local

---

## Task TH.0: Branch setup

- [ ] **Step 1: Branch**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
git checkout main && git pull origin main
git checkout -b feat/combustivel-horarios
git branch --show-current
```

Expected: `feat/combustivel-horarios`.

---

## Task TH.1: Helper formatters com TZ BRT + testes

**Files:**
- Modify: `src/components/combustivel/v2/shared/formatters.ts`
- Create: `src/components/combustivel/v2/shared/formatters.test.ts`

### Step 1: Failing tests

Create `src/components/combustivel/v2/shared/formatters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { fmtData, fmtDataHora } from './formatters'

describe('fmtData', () => {
  it('formata ISO UTC em DD/MM/YY BRT', () => {
    // 2026-05-21 14:43:00+00 (UTC) = 11:43 BRT = 2026-05-21
    expect(fmtData('2026-05-21T14:43:00+00:00')).toBe('21/05/26')
  })

  it('formata ISO UTC tarde-noite respeitando virada de dia em BRT', () => {
    // 2026-05-22 02:00:00+00 (UTC) = 23:00 do dia 21 em BRT
    expect(fmtData('2026-05-22T02:00:00+00:00')).toBe('21/05/26')
  })

  it('retorna — pra string vazia', () => {
    expect(fmtData('')).toBe('—')
  })

  it('retorna fallback pra ISO inválido', () => {
    expect(fmtData('lixo')).toBe('lixo'.slice(0, 10))
  })
})

describe('fmtDataHora', () => {
  it('formata ISO UTC com hora em BRT', () => {
    // 2026-05-21 14:43:00+00 = 11:43 BRT
    expect(fmtDataHora('2026-05-21T14:43:00+00:00')).toBe('21/05/26 11:43')
  })

  it('formata virada de dia em BRT', () => {
    // 2026-05-22 02:30:00+00 = 23:30 BRT do dia 21
    expect(fmtDataHora('2026-05-22T02:30:00+00:00')).toBe('21/05/26 23:30')
  })

  it('retorna — pra string vazia', () => {
    expect(fmtDataHora('')).toBe('—')
  })
})
```

### Step 2: Run failing tests

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm test src/components/combustivel/v2/shared/formatters.test.ts
```

Expected: FAIL (funções atuais não usam TZ BRT — provavelmente passam por coincidência se o ambiente do CI estiver em BRT, mas falham os casos de virada de dia).

### Step 3: Atualizar `formatters.ts`

Modify `src/components/combustivel/v2/shared/formatters.ts` — substituir as funções `fmtData` e `fmtDataHora` por:

```typescript
const FMT_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

const FMT_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Sao_Paulo',
})

/**
 * Formata ISO timestamp como DD/MM/YY em horário de Brasília.
 * Retorna '—' se vazio, ou slice de 10 chars se inválido.
 */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 10)
  return FMT_DATA.format(d).replace(/,$/, '') // pt-BR não adiciona vírgula em dateStyle, mas safety
}

/**
 * Formata ISO timestamp como DD/MM/YY HH:MM em horário de Brasília.
 * Retorna '—' se vazio.
 */
export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 16)
  // pt-BR usa formato "21/05/26, 11:43" — remover a vírgula
  return FMT_DATA_HORA.format(d).replace(', ', ' ')
}
```

### Step 4: Tests PASS

```bash
npm test src/components/combustivel/v2/shared/formatters.test.ts
```

Expected: 6 passed.

### Step 5: Commit

```bash
git add src/components/combustivel/v2/shared/formatters.ts \
        src/components/combustivel/v2/shared/formatters.test.ts
git commit -m "feat(combustivel): fmtData/fmtDataHora com timezone BRT fixo

Audit C.1: funções usavam d.getHours()/d.getDate() que dependem da
timezone do device. Operador em qualquer fuso vê o mesmo horário BRT
agora, via Intl.DateTimeFormat com timeZone='America/Sao_Paulo'.

6 testes vitest cobrindo virada de dia (UTC vs BRT) e casos vazios."
```

---

## Task TH.2: Consolidar 9 fmtData/fmtDataHora locais → shared

**Files modify:**
- `src/components/combustivel/TransferenciaListV2.tsx`
- `src/components/combustivel/SaidaCombustivelListV2.tsx`
- `src/components/combustivel/EntradaListV2.tsx`
- `src/components/combustivel/TransferenciaDetalhesDrawer.tsx`
- `src/components/combustivel/EntradaDetalhesDrawer.tsx`
- `src/components/combustivel/SaidaDetalhesDrawer.tsx`
- `src/components/combustivel/HistoricoTimeline.tsx`
- `src/components/combustivel/v2/anomalias/SaidasAfetadasList.tsx`
- `src/components/combustivel/v2/anomalias/AnomaliaDrawer.tsx`
- `src/components/combustivel/v2/lixeira/LixeiraTab.tsx`

### Step 1: Pra cada arquivo, substituir definição local por import

Pattern de mudança:

**Antes:**
```tsx
function fmtData(iso: string): string {
  // implementação local
}
```

**Depois:**
```tsx
import { fmtData } from './v2/shared/formatters'
// (path relativo varia: pra v2/anomalias é '../shared/formatters')
```

Mesmo pra `fmtDataHora` e `fmtDataHoraBR`.

> **Cuidado:** se o nome local é `fmtDataHoraBR` (3 arquivos), import como alias:
> ```tsx
> import { fmtDataHora as fmtDataHoraBR } from './v2/shared/formatters'
> ```

### Step 2: TypeScript + build após cada arquivo (sanity)

```bash
npx tsc -b 2>&1 | tail -3
```

### Step 3: Tests

```bash
npm test 2>&1 | tail -8
```

Expected: passing (consolidação não muda comportamento; testes do shared cobrem).

### Step 4: Commit

```bash
git add src/components/combustivel/
git commit -m "refactor(combustivel): consolidar 9 fmtData/fmtDataHora locais no shared

Audit C.1+E.1#3: existiam 9 cópias locais com lógica idêntica usando
d.getHours() (TZ do device). Agora todas importam de v2/shared/formatters
que usa Intl.DateTimeFormat com TZ BRT fixo.

Garante consistência de exibição em qualquer fuso (operador em Acre
vê mesmo horário BRT que operador em São Paulo)."
```

---

## Task TH.3: Migration data_hora text → timestamptz

**Files:**
- Create: `supabase/migrations/20260523130000_combustivel_data_hora_timestamptz.sql`

### Step 1: Discovery — confirmar 0 inválidos

Via MCP:
```sql
SELECT 'entradas' AS tabela,
  COUNT(*) FILTER (WHERE NOT (data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}')) AS invalidos
FROM public.entradas_combustivel WHERE deleted_at IS NULL
UNION ALL
SELECT 'transferencias',
  COUNT(*) FILTER (WHERE NOT (data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}'))
FROM public.transferencias_combustivel WHERE deleted_at IS NULL;
```

Expected: 0 inválidos em ambas (já confirmado em B.4).

### Step 2: Criar migration

Write `supabase/migrations/20260523130000_combustivel_data_hora_timestamptz.sql`:

```sql
-- TH.3 — Migrar data_hora text → timestamptz em entradas e transferencias.
--
-- Audit C.1 + E.1#1: data_hora era text sem constraint de formato. Migration
-- converte para timestamptz interpretando os textos como UTC (consistente
-- com saidas_combustivel.data, que já é timestamptz UTC).
--
-- Pré-condições verificadas: 0 registros com formato inválido (B.4 do audit).
-- Formato existente: 'YYYY-MM-DDTHH:MM' (text), interpretado como UTC.
--
-- Idempotente: usa ADD COLUMN IF NOT EXISTS + DROP COLUMN no final.

-- entradas_combustivel
ALTER TABLE public.entradas_combustivel
  ADD COLUMN IF NOT EXISTS data_hora_tz timestamptz;

UPDATE public.entradas_combustivel
SET data_hora_tz = (data_hora || ':00')::timestamptz AT TIME ZONE 'UTC' AT TIME ZONE 'UTC'
WHERE data_hora_tz IS NULL AND data_hora IS NOT NULL AND data_hora <> '';

-- Set NOT NULL e renomear colunas
ALTER TABLE public.entradas_combustivel
  ALTER COLUMN data_hora_tz SET NOT NULL;
ALTER TABLE public.entradas_combustivel
  DROP COLUMN data_hora CASCADE;
ALTER TABLE public.entradas_combustivel
  RENAME COLUMN data_hora_tz TO data_hora;

-- Recreate index se foi dropado por CASCADE
CREATE INDEX IF NOT EXISTS idx_entradas_combustivel_data_hora
  ON public.entradas_combustivel(data_hora);

-- transferencias_combustivel — mesmo pattern
ALTER TABLE public.transferencias_combustivel
  ADD COLUMN IF NOT EXISTS data_hora_tz timestamptz;

UPDATE public.transferencias_combustivel
SET data_hora_tz = (data_hora || ':00')::timestamptz AT TIME ZONE 'UTC' AT TIME ZONE 'UTC'
WHERE data_hora_tz IS NULL AND data_hora IS NOT NULL AND data_hora <> '';

ALTER TABLE public.transferencias_combustivel
  ALTER COLUMN data_hora_tz SET NOT NULL;
ALTER TABLE public.transferencias_combustivel
  DROP COLUMN data_hora CASCADE;
ALTER TABLE public.transferencias_combustivel
  RENAME COLUMN data_hora_tz TO data_hora;

CREATE INDEX IF NOT EXISTS idx_transferencias_combustivel_data_hora
  ON public.transferencias_combustivel(data_hora);
```

> **Nota crítica sobre `AT TIME ZONE 'UTC' AT TIME ZONE 'UTC'`:** O cast `::timestamptz` de uma string sem offset assume timezone da sessão. Para forçar interpretação como UTC, fazemos `::timestamp` (sem TZ) e depois `AT TIME ZONE 'UTC'`. Verificar via test query na próxima step.

### Step 3: Sanity check — testar conversão em 1 registro antes de aplicar massa

```sql
-- Testa SEM aplicar:
SELECT
  id, data_hora,
  (data_hora || ':00')::timestamp AT TIME ZONE 'UTC' AS data_hora_tz_proposto
FROM public.entradas_combustivel
WHERE data_hora IS NOT NULL AND data_hora <> ''
LIMIT 3;
```

Conferir: o `data_hora_tz_proposto` deve ter offset `+00` (UTC). Ex: `2026-05-20T04:25` (text) vira `2026-05-20 04:25:00+00`.

Se o resultado parece correto, prosseguir. Senão, ajustar a expressão de conversão.

### Step 4: Aplicar migration via MCP

`mcp__plugin_supabase_supabase__apply_migration` com:
- name: `combustivel_data_hora_timestamptz`
- query: SQL ajustada (após sanity check)

### Step 5: Verify

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('entradas_combustivel', 'transferencias_combustivel')
  AND column_name = 'data_hora';
```

Expected: `data_type = 'timestamp with time zone'` em ambas.

```sql
SELECT COUNT(*) AS total_entradas,
  COUNT(*) FILTER (WHERE data_hora IS NULL) AS nulls
FROM public.entradas_combustivel;
```

Expected: 0 nulls.

### Step 6: Commit

```bash
git add supabase/migrations/20260523130000_combustivel_data_hora_timestamptz.sql
git commit -m "fix(combustivel): data_hora text → timestamptz em entradas + transferências

Audit C.1 + E.1#1: data_hora era text sem constraint de formato. Migration
converte para timestamptz interpretando os textos existentes como UTC
(consistente com saidas_combustivel.data, já timestamptz UTC).

0 registros inválidos pré-migration (confirmado em B.4 do audit).
CASCADE drop + rename pra fazer in-place. Index recreado."
```

> **Nota:** este migration provavelmente requer alteração no mapper TS (`src/lib/mappers.ts`) — funções que faziam parse manual de string podem precisar ajuste. Verificar build após aplicar.

### Step 7: Verificar build TS

```bash
npm run build 2>&1 | tail -10
```

Se houver erros nos mappers (`entradaCombustivelToDb`, `dbToEntradaCombustivel`), ajustar o tipo de `dataHora` na interface `EntradaCombustivel` (`src/types/index.ts`) se necessário.

---

## Task TH.4: Trigger anti-futuro (janela 24h grace)

**Files:**
- Create: `supabase/migrations/20260523130100_combustivel_trigger_anti_futuro.sql`

### Step 1: Criar migration

Write `supabase/migrations/20260523130100_combustivel_trigger_anti_futuro.sql`:

```sql
-- TH.4 — Trigger anti-futuro com janela 24h grace.
--
-- Audit C + E.1#2: nenhum check bloqueia data muito no futuro. Janela
-- permissiva de 24h cobre fuso, hora errada do device, etc. — sem
-- bloquear retroatividade legítima (62% dos lançamentos são retroativos > 30d).

CREATE OR REPLACE FUNCTION public.fn_validate_data_nao_futura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_data timestamptz;
BEGIN
  -- pega o campo data correto baseado na tabela
  IF TG_TABLE_NAME = 'saidas_combustivel' THEN
    v_data := NEW.data;
  ELSE
    v_data := NEW.data_hora;
  END IF;

  IF v_data > now() + interval '24 hours' THEN
    RAISE EXCEPTION 'Data não pode ser mais de 24h no futuro (recebido: %, agora: %)',
      v_data, now();
  END IF;

  RETURN NEW;
END;
$$;

-- Aplicar nas 3 tabelas
DROP TRIGGER IF EXISTS trg_saidas_combustivel_anti_futuro ON public.saidas_combustivel;
CREATE TRIGGER trg_saidas_combustivel_anti_futuro
  BEFORE INSERT OR UPDATE OF data ON public.saidas_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_data_nao_futura();

DROP TRIGGER IF EXISTS trg_entradas_combustivel_anti_futuro ON public.entradas_combustivel;
CREATE TRIGGER trg_entradas_combustivel_anti_futuro
  BEFORE INSERT OR UPDATE OF data_hora ON public.entradas_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_data_nao_futura();

DROP TRIGGER IF EXISTS trg_transferencias_combustivel_anti_futuro ON public.transferencias_combustivel;
CREATE TRIGGER trg_transferencias_combustivel_anti_futuro
  BEFORE INSERT OR UPDATE OF data_hora ON public.transferencias_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_data_nao_futura();
```

### Step 2: Apply via MCP

`apply_migration` com nome `combustivel_trigger_anti_futuro`.

### Step 3: Sanity test

```sql
-- Teste 1: tentar inserir saída com data > 24h no futuro (deve FALHAR)
-- Não vamos inserir de verdade — só verificamos via SELECT que a função existe:
SELECT proname FROM pg_proc
WHERE proname = 'fn_validate_data_nao_futura' AND pronamespace = 'public'::regnamespace;

-- Verifica triggers
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE '%anti_futuro%';
```

Expected: 3 triggers (saidas, entradas, transferencias).

### Step 4: Commit

```bash
git add supabase/migrations/20260523130100_combustivel_trigger_anti_futuro.sql
git commit -m "fix(combustivel): trigger anti-futuro com janela 24h grace

Audit C + E.1#2: nenhum check bloqueava data muito no futuro. Janela
permissiva de 24h cobre fuso/hora errada do device sem bloquear
retroatividade legítima (62% dos lançamentos > 30d retroativos)."
```

---

## Task TH.5: Drop trigger updated_at duplicado em saidas_combustivel

**Files:**
- Create: `supabase/migrations/20260523130200_drop_dup_updated_at_trigger.sql`

### Step 1: Discovery

```sql
SELECT tgname, pg_get_triggerdef(oid) AS def
FROM pg_trigger
WHERE tgrelid = 'public.saidas_combustivel'::regclass
  AND tgname LIKE '%updated_at%';
```

Expected: 2 triggers — `trg_saidas_combustivel_set_updated_at` e `trg_updated_at_saidas`. Verificar se chamam a mesma função.

### Step 2: Criar migration

Write `supabase/migrations/20260523130200_drop_dup_updated_at_trigger.sql`:

```sql
-- TH.5 — Drop trigger updated_at duplicado em saidas_combustivel.
--
-- Audit §1.2 + E.1#6: dois triggers BEFORE UPDATE setam o mesmo
-- updated_at. Redundante. Manter o de naming consistente com outras
-- tabelas (`trg_updated_at_saidas`) e dropar o outro.

DROP TRIGGER IF EXISTS trg_saidas_combustivel_set_updated_at ON public.saidas_combustivel;
```

> **Decisão:** dropar `trg_saidas_combustivel_set_updated_at` (nome verboso). Manter `trg_updated_at_saidas` (padrão do projeto). Se o discovery mostrar que são DIFERENTES (funções distintas), ajustar conforme.

### Step 3: Apply

`apply_migration` `drop_dup_updated_at_trigger`.

### Step 4: Verify

```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.saidas_combustivel'::regclass
  AND tgname LIKE '%updated_at%';
```

Expected: apenas 1 trigger.

### Step 5: Commit

```bash
git add supabase/migrations/20260523130200_drop_dup_updated_at_trigger.sql
git commit -m "fix(combustivel): drop trigger updated_at duplicado em saidas_combustivel

Audit §1.2 + E.1#6: 2 triggers BEFORE UPDATE setavam o mesmo updated_at.
Mantém o padrão do projeto (trg_updated_at_saidas), dropa o verboso."
```

---

## Task TH.6: Form datetime-local converte default pra BRT

**Files:**
- Modify: `src/components/combustivel/SaidaCombustivelForm.tsx`

### Step 1: Mapear local

```bash
grep -n "new Date().toISOString().slice(0, 16)\|new Date().toISOString()\.slice" src/components/combustivel/SaidaCombustivelForm.tsx src/components/combustivel/EntradaForm.tsx src/components/combustivel/TransferenciaForm.tsx
```

Expected: encontrar em cada form.

### Step 2: Criar helper

Add to `src/components/combustivel/v2/shared/formatters.ts`:

```typescript
/**
 * Retorna data atual no formato esperado por <input type="datetime-local">
 * mas convertida pra horário de Brasília (não UTC implícito).
 * Ex: se agora UTC = "2026-05-21T14:43:00Z", retorna "2026-05-21T11:43"
 */
export function nowAsLocalInputBRT(): string {
  const now = new Date()
  // toLocaleString em pt-BR com TZ BRT
  const parts = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(now)

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  const hour = parts.find((p) => p.type === 'hour')?.value
  const minute = parts.find((p) => p.type === 'minute')?.value

  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * Converte ISO string BRT (vindo do input datetime-local) pra ISO UTC.
 * Ex: "2026-05-21T11:43" (entendido como BRT) → "2026-05-21T14:43:00.000Z"
 */
export function inputLocalBRTtoISOUTC(brtIso: string): string {
  // brtIso vem sem offset. Anexamos -03:00 (BRT) e deixamos Date converter.
  // Brasília não tem horário de verão atualmente, mas se voltar, ajustar.
  if (!brtIso) return ''
  const completed = brtIso.length === 16 ? brtIso + ':00' : brtIso
  return new Date(completed + '-03:00').toISOString()
}
```

Adicionar testes em `formatters.test.ts`:

```typescript
import { nowAsLocalInputBRT, inputLocalBRTtoISOUTC } from './formatters'

describe('nowAsLocalInputBRT', () => {
  it('retorna formato YYYY-MM-DDTHH:MM', () => {
    const result = nowAsLocalInputBRT()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('inputLocalBRTtoISOUTC', () => {
  it('converte 11:43 BRT em 14:43 UTC (+3h)', () => {
    expect(inputLocalBRTtoISOUTC('2026-05-21T11:43')).toBe('2026-05-21T14:43:00.000Z')
  })

  it('vazio retorna vazio', () => {
    expect(inputLocalBRTtoISOUTC('')).toBe('')
  })
})
```

### Step 3: Tests

```bash
npm test src/components/combustivel/v2/shared/formatters.test.ts
```

Expected: 8 passed (6 originais + 2 novos).

### Step 4: Usar nos forms

Modify `src/components/combustivel/SaidaCombustivelForm.tsx`:

Substituir o `defaultValues.data`:

```typescript
import { nowAsLocalInputBRT, inputLocalBRTtoISOUTC } from '../combustivel/v2/shared/formatters'

// ...
defaultValues: {
  data: initial?.data
    ? initial.data.slice(0, 16)  // edit: usa o que está
    : nowAsLocalInputBRT(),       // novo: agora em BRT
  // ...
},
```

E no submit (linha ~514):
```typescript
// Antes:
data: formData.data.length === 16 ? `${formData.data}:00` : formData.data,

// Depois:
data: inputLocalBRTtoISOUTC(formData.data),
```

Mesma adaptação em `EntradaForm.tsx` (campo `dataHora`) e `TransferenciaForm.tsx`.

### Step 5: TypeScript + build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -10
```

### Step 6: Smoke manual

```bash
npm run dev
```

Abrir form de Nova Saída → confirmar que o campo data mostra hora ATUAL BRT (não UTC). Salvar → verificar no DB que valor gravado é `agora_BRT + 3h = UTC`.

Encerrar dev server.

### Step 7: Commit

```bash
git add src/components/combustivel/v2/shared/formatters.ts \
        src/components/combustivel/v2/shared/formatters.test.ts \
        src/components/combustivel/SaidaCombustivelForm.tsx \
        src/components/combustivel/EntradaForm.tsx \
        src/components/combustivel/TransferenciaForm.tsx
git commit -m "fix(combustivel): forms convertem datetime-local BRT → UTC no save

Audit C.2 + E.1#4: <input type='datetime-local'> sem offset era
gravado como UTC implícito. Operador BR digitava '11:43' achando que
era BRT, mas ficava gravado '11:43 UTC' (=08:43 BRT).

Agora:
- Default = nowAsLocalInputBRT() (hora BR correta no campo)
- Submit = inputLocalBRTtoISOUTC(formValue) → converte BRT → UTC antes
  de mandar pro banco
- Helper centralizado em v2/shared/formatters.ts (com testes)

Operador vê hora certa, banco grava UTC consistente."
```

---

## Task TH.7: Final — build + security + deploy + push

- [ ] **Step 1: Build + tests**

```bash
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -10
```

Expected: passa. 8+ novos testes (formatters).

- [ ] **Step 2: /security-review**

```
/security-review
```

Expected: NO_FINDINGS. Migration de schema é defensiva, trigger é apenas validação.

- [ ] **Step 3: Preview deploy**

```bash
npx --yes vercel deploy 2>&1 | tail -5
```

- [ ] **Step 4: Smoke test (com confirmação user)**

Roteiro:
- Aba Saídas → verificar horários exibidos em BRT consistente
- Nova saída → data default é hora BR atual; salvar → DB grava UTC equivalente
- Aba Entradas → idem
- Aba Transferências → idem
- Tentar inserir saída com data > 24h no futuro via console SQL — deve dar erro

- [ ] **Step 5: Prod**

```bash
npx --yes vercel --prod 2>&1 | tail -5
```

- [ ] **Step 6: Merge + push**

```bash
git checkout main && git pull origin main
git merge --no-ff feat/combustivel-horarios -m "Merge branch 'feat/combustivel-horarios'

Audit C + E.1 inteiro:
- fmtData/fmtDataHora com TZ BRT fixo via Intl.DateTimeFormat
- 9 cópias locais consolidadas no shared
- data_hora text → timestamptz em entradas + transferencias
- Trigger anti-futuro 24h grace nas 3 tabelas combustível
- Drop trigger updated_at duplicado em saidas_combustivel
- Forms convertem datetime-local BRT → UTC no save

Plan: docs/superpowers/plans/2026-05-23-combustivel-horarios.md"
git push origin main
```

---

## Critérios de Aceitação

- ✅ `formatters.test.ts` 8+ tests passing
- ✅ Migration `data_hora text → timestamptz` aplicada em prod, 0 erros
- ✅ Trigger anti-futuro ativo (3 triggers — saidas, entradas, transferências)
- ✅ Trigger duplicado de updated_at removido
- ✅ Forms mostram hora BR correta no default; salvar grava UTC correspondente
- ✅ Listas/drawers exibem horário BRT consistente independente de TZ do device
- ✅ `/security-review` NO_FINDINGS
