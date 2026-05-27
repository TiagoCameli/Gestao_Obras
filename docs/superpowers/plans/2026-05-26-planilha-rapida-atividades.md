# Planilha rápida de lançamento de atividades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir modal de lançamento em massa de Activities CBUQ e Troca de Solo/Drenos via planilha estilo Excel dentro da MeasurementView, com paste TSV, atalhos de teclado, agrupamento por (data, trecho) pra CBUQ e por nomenclatura pra TS, e save em batch.

**Architecture:** Dialog shadcn com Tabs (CBUQ e TS/Drenos), cada uma com grid editável construído sobre `@tanstack/react-table`. Estado das duas grades vive no componente pai (`QuickEntrySheet`). Save em 4 fases: validação local → agrupamento em Activities → batch `addActivity()` sequencial → recarregamento dos agregados da medição. Parsers e validadores isolados em `utils/` pra serem testáveis sem React.

**Tech Stack:** React + TypeScript, Vite, `@tanstack/react-table`, shadcn/ui, Supabase (Postgres + RLS), Vitest (unitários), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-05-26-planilha-rapida-atividades-design.md`

---

## File Structure

**Novos:**
- `src/modules/rodotracker/utils/parseNumber.ts` — extraído de `ImportExcelModal.tsx`
- `src/modules/rodotracker/utils/parseNumber.test.ts`
- `src/modules/rodotracker/utils/quickEntryParsers.ts` — `parseKm`, `parseTrecho`, `parseData`, `parsePeso`
- `src/modules/rodotracker/utils/quickEntryParsers.test.ts`
- `src/modules/rodotracker/utils/latLngFromKm.ts` — converte highway km → (lat, lng) usando `routeGeoJson` e `obra.kmInicial`
- `src/modules/rodotracker/utils/latLngFromKm.test.ts`
- `src/modules/rodotracker/utils/quickEntryValidators.ts` — `validateRowCbuq`, `validateRowTs`, `validateCrossRowTs`
- `src/modules/rodotracker/utils/quickEntryValidators.test.ts`
- `src/modules/rodotracker/utils/quickEntryGrouping.ts` — `groupCbuqRowsToActivities`, `groupTsRowsToActivities`
- `src/modules/rodotracker/utils/quickEntryGrouping.test.ts`
- `src/modules/rodotracker/utils/parseTsv.ts` — `parseTsv`, `distributePaste`
- `src/modules/rodotracker/utils/parseTsv.test.ts`
- `src/modules/rodotracker/components/Measurement/quickEntryCells.tsx` — `DateCell`, `NumberCell`, `TextCell`, `SelectCell`
- `src/modules/rodotracker/components/Measurement/QuickEntryGridCbuq.tsx`
- `src/modules/rodotracker/components/Measurement/QuickEntryGridTs.tsx`
- `src/modules/rodotracker/components/Measurement/QuickEntrySheet.tsx`
- `supabase/migrations/20260526190000_activities_estaca_fracao_nomenclatura_fix.sql`
- `supabase/migrations/20260526190100_activities_estaca_fracao_nomenclatura_rollback.sql`
- `tests/quick-entry.spec.ts` — Playwright E2E

**Alterados:**
- `src/modules/rodotracker/types/activity.ts` — `CbuqCarga.descricao?`, `Activity.estaca?`, `Activity.fracao?`, `Activity.nomenclatura?`
- `src/modules/rodotracker/utils/rodotrackerApi.ts` — `ActivityRow` ganha 3 campos, mappers traduzem
- `src/modules/rodotracker/components/Measurement/MeasurementView.tsx` — botão "Lançamento rápido" + estado de abertura do modal
- `src/modules/rodotracker/components/Home/HomePage.tsx` — bump v1.x no logo (regra do projeto)
- `src/modules/rodotracker/components/Measurement/ImportExcelModal.tsx` — `parseNumber` importado do utils compartilhado (não duplica)

---

## Task 1: Migração SQL (schema)

**Files:**
- Create: `supabase/migrations/20260526190000_activities_estaca_fracao_nomenclatura_fix.sql`
- Create: `supabase/migrations/20260526190100_activities_estaca_fracao_nomenclatura_rollback.sql`

- [ ] **Step 1: Escrever migration fix**

```sql
-- supabase/migrations/20260526190000_activities_estaca_fracao_nomenclatura_fix.sql
ALTER TABLE activities
  ADD COLUMN estaca text NULL,
  ADD COLUMN fracao text NULL,
  ADD COLUMN nomenclatura text NULL;

CREATE INDEX idx_activities_nomenclatura
  ON activities (obra_id, medicao, nomenclatura)
  WHERE nomenclatura IS NOT NULL;
```

- [ ] **Step 2: Escrever migration rollback**

```sql
-- supabase/migrations/20260526190100_activities_estaca_fracao_nomenclatura_rollback.sql
DROP INDEX IF EXISTS idx_activities_nomenclatura;
ALTER TABLE activities
  DROP COLUMN IF EXISTS nomenclatura,
  DROP COLUMN IF EXISTS fracao,
  DROP COLUMN IF EXISTS estaca;
```

- [ ] **Step 3: Aplicar migration no projeto Supabase**

Usuário usa workflow padrão (memory: "1 fix por sessão, direto no projeto Supabase"). Não rodar via CLI automaticamente — sinalizar ao usuário que precisa rodar o fix .sql no Supabase Studio antes de seguir.

Mensagem: "Migration `20260526190000_activities_estaca_fracao_nomenclatura_fix.sql` pronta. Aplique no Supabase Studio antes da Task 2."

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526190000_activities_estaca_fracao_nomenclatura_fix.sql supabase/migrations/20260526190100_activities_estaca_fracao_nomenclatura_rollback.sql
git commit -m "feat(rodotracker): migration estaca/fracao/nomenclatura em activities"
```

---

## Task 2: Atualizar types (CbuqCarga + Activity)

**Files:**
- Modify: `src/modules/rodotracker/types/activity.ts`

- [ ] **Step 1: Adicionar `descricao` em `CbuqCarga`**

No bloco já existente do tipo `CbuqCarga` (linha ~121), adicionar campo opcional após `pesoT`:

```ts
export interface CbuqCarga {
  id: string;
  data?: string;     // ISO YYYY-MM-DD
  placa: string;
  hora?: string;     // HH:mm
  pesoT: number;     // peso líquido em toneladas
  descricao?: string; // descrição livre da carga (ex: tipo de mistura aplicada)
}
```

- [ ] **Step 2: Adicionar `estaca`, `fracao`, `nomenclatura` em `Activity`**

Na interface `Activity` (linha ~185), adicionar 3 campos opcionais antes de `createdAt`:

```ts
  /** Posição topográfica (estaca de levantamento) — usada em TS/Dreno. */
  estaca?: string;
  /** Distância em metros do início da estaca — usada em TS/Dreno. */
  fracao?: string;
  /** Identificador do trecho (ex: "TS15/07"), agrupador de TS+drenos. */
  nomenclatura?: string;
  createdAt: number;
  updatedAt: number;
```

- [ ] **Step 3: Verificar que projeto ainda compila**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit`
Expected: 0 errors (campos opcionais não quebram nada existente).

- [ ] **Step 4: Commit**

```bash
git add src/modules/rodotracker/types/activity.ts
git commit -m "feat(rodotracker): tipos estaca/fracao/nomenclatura + cargas.descricao"
```

---

## Task 3: Atualizar mappers Supabase

**Files:**
- Modify: `src/modules/rodotracker/utils/rodotrackerApi.ts`

- [ ] **Step 1: Adicionar 3 campos em `ActivityRow`**

Em `rodotrackerApi.ts`, na definição do tipo `ActivityRow` (linha ~112), adicionar antes de `created_at`:

```ts
  estaca: string | null;
  fracao: string | null;
  nomenclatura: string | null;
  created_at: number;
  updated_at: number;
};
```

- [ ] **Step 2: Atualizar `rowToActivity`**

Em `rowToActivity` (linha ~142), adicionar antes de `createdAt`:

```ts
    estaca: r.estaca ?? undefined,
    fracao: r.fracao ?? undefined,
    nomenclatura: r.nomenclatura ?? undefined,
    createdAt: r.created_at,
```

- [ ] **Step 3: Atualizar `activityToRow`**

Em `activityToRow` (linha ~173), adicionar antes de `created_at`:

```ts
    estaca: a.estaca ?? null,
    fracao: a.fracao ?? null,
    nomenclatura: a.nomenclatura ?? null,
    created_at: a.createdAt,
```

- [ ] **Step 4: Verificar compilação**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/rodotrackerApi.ts
git commit -m "feat(rodotracker): mapper Supabase para estaca/fracao/nomenclatura"
```

---

## Task 4: Extrair `parseNumber` para utils compartilhado

**Files:**
- Create: `src/modules/rodotracker/utils/parseNumber.ts`
- Create: `src/modules/rodotracker/utils/parseNumber.test.ts`
- Modify: `src/modules/rodotracker/components/Measurement/ImportExcelModal.tsx`

- [ ] **Step 1: Escrever teste**

```ts
// src/modules/rodotracker/utils/parseNumber.test.ts
import { describe, it, expect } from "vitest";
import { parseNumber } from "./parseNumber";

describe("parseNumber", () => {
  it("retorna 0 pra string vazia", () => {
    expect(parseNumber("")).toBe(0);
  });
  it("parseia inteiro", () => {
    expect(parseNumber("42")).toBe(42);
  });
  it("parseia decimal com vírgula (formato BR)", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
  });
  it("parseia decimal com ponto (formato US)", () => {
    expect(parseNumber("1234.56")).toBe(1234.56);
  });
  it("aceita number direto", () => {
    expect(parseNumber(42.5)).toBe(42.5);
  });
  it("retorna 0 pra texto não-numérico", () => {
    expect(parseNumber("abc")).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/parseNumber.test.ts`
Expected: FAIL (arquivo `parseNumber.ts` não existe).

- [ ] **Step 3: Criar `parseNumber.ts`**

```ts
// src/modules/rodotracker/utils/parseNumber.ts
export function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const cleaned = value
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/parseNumber.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Substituir uso em `ImportExcelModal.tsx`**

Em `src/modules/rodotracker/components/Measurement/ImportExcelModal.tsx`:
- Remover a função local `parseNumber` (linhas ~62-72).
- Adicionar import no topo: `import { parseNumber } from "../../utils/parseNumber";`

- [ ] **Step 6: Verificar compilação**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit && npx vitest run`
Expected: 0 erros, todos os testes verdes.

- [ ] **Step 7: Commit**

```bash
git add src/modules/rodotracker/utils/parseNumber.ts src/modules/rodotracker/utils/parseNumber.test.ts src/modules/rodotracker/components/Measurement/ImportExcelModal.tsx
git commit -m "refactor(rodotracker): extrai parseNumber pra utils compartilhado"
```

---

## Task 5: `parseKm` parser

**Files:**
- Create: `src/modules/rodotracker/utils/quickEntryParsers.ts`
- Create: `src/modules/rodotracker/utils/quickEntryParsers.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// src/modules/rodotracker/utils/quickEntryParsers.test.ts
import { describe, it, expect } from "vitest";
import { parseKm } from "./quickEntryParsers";

describe("parseKm", () => {
  it("inteiro", () => expect(parseKm("620")).toBe(620));
  it("decimal com ponto", () => expect(parseKm("620.5")).toBe(620.5));
  it("decimal com vírgula", () => expect(parseKm("620,5")).toBe(620.5));
  it("estaca+fração 620+500", () => expect(parseKm("620+500")).toBe(620.5));
  it("estaca+fração 620+250", () => expect(parseKm("620+250")).toBe(620.25));
  it("estaca+fração 620+000", () => expect(parseKm("620+000")).toBe(620));
  it("texto não-numérico → null", () => expect(parseKm("abc")).toBeNull());
  it("vazio → null", () => expect(parseKm("")).toBeNull());
  it("trim espaços", () => expect(parseKm("  620  ")).toBe(620));
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryParsers.test.ts`
Expected: FAIL (arquivo não existe).

- [ ] **Step 3: Implementar `parseKm`**

```ts
// src/modules/rodotracker/utils/quickEntryParsers.ts
/** Parseia km no formato "620", "620.5", "620,5" ou "620+500" (estaca+fração). Retorna null se inválido. */
export function parseKm(input: string): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  // formato estaca+fração: "620+500" = 620 + 500/1000 = 620.5
  const plusMatch = s.match(/^(\d+)\+(\d{1,3})$/);
  if (plusMatch) {
    const estaca = parseInt(plusMatch[1], 10);
    const fracao = parseInt(plusMatch[2], 10);
    if (!Number.isFinite(estaca) || !Number.isFinite(fracao)) return null;
    return estaca + fracao / 1000;
  }
  // formato numérico padrão (aceita ponto ou vírgula como decimal)
  const cleaned = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryParsers.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/quickEntryParsers.ts src/modules/rodotracker/utils/quickEntryParsers.test.ts
git commit -m "feat(rodotracker): parseKm aceita 620 / 620.5 / 620,5 / 620+500"
```

---

## Task 6: `parseTrecho` parser

**Files:**
- Modify: `src/modules/rodotracker/utils/quickEntryParsers.ts`
- Modify: `src/modules/rodotracker/utils/quickEntryParsers.test.ts`

- [ ] **Step 1: Adicionar teste**

Adicionar bloco no final de `quickEntryParsers.test.ts`:

```ts
import { parseTrecho } from "./quickEntryParsers";

describe("parseTrecho", () => {
  it("hífen", () => expect(parseTrecho("620-635")).toEqual({ kmInicial: 620, kmFinal: 635 }));
  it("en-dash", () => expect(parseTrecho("620–635")).toEqual({ kmInicial: 620, kmFinal: 635 }));
  it("decimais com vírgula", () => expect(parseTrecho("620,1-635,5")).toEqual({ kmInicial: 620.1, kmFinal: 635.5 }));
  it("formato 'KM 620 a 635'", () => expect(parseTrecho("KM 620 a 635")).toEqual({ kmInicial: 620, kmFinal: 635 }));
  it("kmFinal ≤ kmInicial → null", () => expect(parseTrecho("635-620")).toBeNull());
  it("um número só → null", () => expect(parseTrecho("620")).toBeNull());
  it("vazio → null", () => expect(parseTrecho("")).toBeNull());
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryParsers.test.ts`
Expected: FAIL (parseTrecho não exportado).

- [ ] **Step 3: Implementar `parseTrecho`**

Adicionar no final de `quickEntryParsers.ts`:

```ts
/** Parseia "620-635", "620–635", "620,1-635,5", "KM 620 a 635". Erro se kmFinal ≤ kmInicial. */
export function parseTrecho(input: string): { kmInicial: number; kmFinal: number } | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  // extrai os dois primeiros números (aceita vírgula como decimal)
  const matches = s.match(/\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length < 2) return null;
  const kmInicial = parseFloat(matches[0].replace(",", "."));
  const kmFinal = parseFloat(matches[1].replace(",", "."));
  if (!Number.isFinite(kmInicial) || !Number.isFinite(kmFinal)) return null;
  if (kmFinal <= kmInicial) return null;
  return { kmInicial, kmFinal };
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryParsers.test.ts`
Expected: PASS (16 tests no total).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/quickEntryParsers.ts src/modules/rodotracker/utils/quickEntryParsers.test.ts
git commit -m "feat(rodotracker): parseTrecho extrai kmInicial/kmFinal de '620-635'"
```

---

## Task 7: `parseData` parser

**Files:**
- Modify: `src/modules/rodotracker/utils/quickEntryParsers.ts`
- Modify: `src/modules/rodotracker/utils/quickEntryParsers.test.ts`

- [ ] **Step 1: Adicionar teste**

```ts
import { parseData } from "./quickEntryParsers";

describe("parseData", () => {
  it("dd/mm/aaaa", () => expect(parseData("21/05/2026")).toBe("2026-05-21"));
  it("dd-mm-aaaa", () => expect(parseData("21-05-2026")).toBe("2026-05-21"));
  it("aaaa-mm-dd (ISO já)", () => expect(parseData("2026-05-21")).toBe("2026-05-21"));
  it("um dígito de dia/mês", () => expect(parseData("3/5/2026")).toBe("2026-05-03"));
  it("trim espaços", () => expect(parseData("  21/05/2026  ")).toBe("2026-05-21"));
  it("texto inválido → null", () => expect(parseData("21 de maio")).toBeNull());
  it("vazio → null", () => expect(parseData("")).toBeNull());
  it("data inexistente (32/05) → null", () => expect(parseData("32/05/2026")).toBeNull());
  it("mês inválido → null", () => expect(parseData("21/13/2026")).toBeNull());
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryParsers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `parseData`**

Adicionar em `quickEntryParsers.ts`:

```ts
/**
 * Parseia data em "dd/mm/aaaa", "dd-mm-aaaa" ou "aaaa-mm-dd". Retorna ISO
 * "yyyy-mm-dd" (wall-clock, sem TZ). Null se inválido.
 */
export function parseData(input: string): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  let day: number, month: number, year: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    year = parseInt(iso[1], 10);
    month = parseInt(iso[2], 10);
    day = parseInt(iso[3], 10);
  } else {
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!br) return null;
    day = parseInt(br[1], 10);
    month = parseInt(br[2], 10);
    year = parseInt(br[3], 10);
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // valida data real (rejeita 31 de fevereiro etc)
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCDate() !== day || dt.getUTCMonth() !== month - 1) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryParsers.test.ts`
Expected: PASS (25 tests no total).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/quickEntryParsers.ts src/modules/rodotracker/utils/quickEntryParsers.test.ts
git commit -m "feat(rodotracker): parseData normaliza dd/mm/aaaa pra ISO wall-clock"
```

---

## Task 8: `latLngFromKm` utility

**Files:**
- Create: `src/modules/rodotracker/utils/latLngFromKm.ts`
- Create: `src/modules/rodotracker/utils/latLngFromKm.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// src/modules/rodotracker/utils/latLngFromKm.test.ts
import { describe, it, expect } from "vitest";
import { latLngFromKm } from "./latLngFromKm";

const obraBase = {
  centerLat: -10.0,
  centerLng: -55.0,
  kmInicial: 600,
  routeGeoJson: [
    [-10.0, -55.0],
    [-10.0, -54.991], // ~1 km a leste em latitude ~-10
  ] as [number, number][],
};

describe("latLngFromKm", () => {
  it("km exatamente no início da obra retorna primeiro ponto da rota", () => {
    const r = latLngFromKm(600, obraBase as any);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(-10.0, 4);
    expect(r!.lng).toBeCloseTo(-55.0, 4);
  });

  it("km além do fim da obra retorna último ponto", () => {
    const r = latLngFromKm(999, obraBase as any);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(-10.0, 4);
    expect(r!.lng).toBeCloseTo(-54.991, 4);
  });

  it("km no meio interpola lat/lng", () => {
    const r = latLngFromKm(600.5, obraBase as any);
    expect(r).not.toBeNull();
    expect(r!.lng).toBeCloseTo(-54.9955, 3);
  });

  it("sem routeGeoJson cai pro centro da obra", () => {
    const r = latLngFromKm(700, { ...obraBase, routeGeoJson: null } as any);
    expect(r).not.toBeNull();
    expect(r!.lat).toBe(-10.0);
    expect(r!.lng).toBe(-55.0);
  });

  it("sem kmInicial cai pro centro da obra", () => {
    const r = latLngFromKm(700, { ...obraBase, kmInicial: null } as any);
    expect(r!.lat).toBe(-10.0);
    expect(r!.lng).toBe(-55.0);
  });

  it("km menor que kmInicial cai pro início da rota", () => {
    const r = latLngFromKm(550, obraBase as any);
    expect(r!.lat).toBeCloseTo(-10.0, 4);
    expect(r!.lng).toBeCloseTo(-55.0, 4);
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/latLngFromKm.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/modules/rodotracker/utils/latLngFromKm.ts
import L from "leaflet";
import type { Obra } from "../types/activity";

/**
 * Dado um km da rodovia e a Obra, retorna lat/lng do ponto correspondente
 * caminhando a polyline `routeGeoJson` a partir de `obra.kmInicial`. Se a obra
 * não tiver rota ou kmInicial, retorna o centro da obra como fallback.
 */
export function latLngFromKm(
  highwayKm: number,
  obra: Pick<Obra, "centerLat" | "centerLng" | "kmInicial" | "routeGeoJson">
): { lat: number; lng: number } | null {
  if (!Number.isFinite(highwayKm)) return null;
  const fallback = { lat: obra.centerLat, lng: obra.centerLng };
  const route = obra.routeGeoJson;
  if (!route || route.length < 2 || obra.kmInicial == null) return fallback;

  // offset em metros a partir do início da rota
  const offsetKm = highwayKm - obra.kmInicial;
  if (offsetKm <= 0) return { lat: route[0][0], lng: route[0][1] };
  const targetMeters = offsetKm * 1000;

  let cumulative = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = L.latLng(route[i][0], route[i][1]);
    const b = L.latLng(route[i + 1][0], route[i + 1][1]);
    const segLen = a.distanceTo(b);
    if (segLen === 0) continue;
    if (cumulative + segLen >= targetMeters) {
      const t = (targetMeters - cumulative) / segLen;
      return {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
      };
    }
    cumulative += segLen;
  }

  // km além do fim da rota → último ponto
  const last = route[route.length - 1];
  return { lat: last[0], lng: last[1] };
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/latLngFromKm.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/latLngFromKm.ts src/modules/rodotracker/utils/latLngFromKm.test.ts
git commit -m "feat(rodotracker): latLngFromKm converte highway km em lat/lng"
```

---

## Task 9: Tipos de linha + validadores por linha

**Files:**
- Create: `src/modules/rodotracker/utils/quickEntryValidators.ts`
- Create: `src/modules/rodotracker/utils/quickEntryValidators.test.ts`

- [ ] **Step 1: Definir tipos de linha + escrever teste**

```ts
// src/modules/rodotracker/utils/quickEntryValidators.test.ts
import { describe, it, expect } from "vitest";
import { validateRowCbuq, validateRowTs, type CbuqRow, type TsRow } from "./quickEntryValidators";

const validCbuq: CbuqRow = {
  id: "1",
  data: "21/05/2026",
  trecho: "620-635",
  placa: "ABC1234",
  hora: "10:00",
  peso: "23.5",
  descricao: "",
};

const validTs: TsRow = {
  id: "1",
  data: "21/05/2026",
  tipo: "TS",
  nomenclatura: "TS15/07",
  estaca: "380",
  fracao: "10",
  km: "621.38",
  lado: "D",
  comprimento: "26",
  largura: "4.8",
  espessura: "0.4",
};

describe("validateRowCbuq", () => {
  it("linha válida não tem erros", () => {
    expect(validateRowCbuq(validCbuq)).toEqual({});
  });
  it("data vazia gera erro em data", () => {
    expect(validateRowCbuq({ ...validCbuq, data: "" })).toHaveProperty("data");
  });
  it("trecho inválido gera erro em trecho", () => {
    expect(validateRowCbuq({ ...validCbuq, trecho: "xyz" })).toHaveProperty("trecho");
  });
  it("placa vazia gera erro em placa", () => {
    expect(validateRowCbuq({ ...validCbuq, placa: "" })).toHaveProperty("placa");
  });
  it("peso zero gera erro em peso", () => {
    expect(validateRowCbuq({ ...validCbuq, peso: "0" })).toHaveProperty("peso");
  });
});

describe("validateRowTs", () => {
  it("linha válida não tem erros", () => {
    expect(validateRowTs(validTs)).toEqual({});
  });
  it("nomenclatura vazia gera erro em nomenclatura", () => {
    expect(validateRowTs({ ...validTs, nomenclatura: "" })).toHaveProperty("nomenclatura");
  });
  it("km inválido gera erro em km", () => {
    expect(validateRowTs({ ...validTs, km: "abc" })).toHaveProperty("km");
  });
  it("comprimento zero gera erro em comprimento", () => {
    expect(validateRowTs({ ...validTs, comprimento: "0" })).toHaveProperty("comprimento");
  });
  it("dreno também valida medidas > 0", () => {
    const dreno: TsRow = { ...validTs, tipo: "Dreno", largura: "0" };
    expect(validateRowTs(dreno)).toHaveProperty("largura");
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryValidators.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/modules/rodotracker/utils/quickEntryValidators.ts
import { parseKm, parseTrecho, parseData } from "./quickEntryParsers";
import { parseNumber } from "./parseNumber";

export interface CbuqRow {
  id: string;
  data: string;
  trecho: string;
  placa: string;
  hora: string;
  peso: string;
  descricao: string;
}

export interface TsRow {
  id: string;
  data: string;
  tipo: "TS" | "Dreno" | "";
  nomenclatura: string;
  estaca: string;
  fracao: string;
  km: string;
  lado: "D" | "E" | "PT" | "";
  comprimento: string;
  largura: string;
  espessura: string;
}

export type RowErrors = Partial<Record<string, string>>;

export function validateRowCbuq(row: CbuqRow): RowErrors {
  const errors: RowErrors = {};
  if (!parseData(row.data)) errors.data = "Data inválida (use dd/mm/aaaa).";
  if (!parseTrecho(row.trecho)) errors.trecho = "Trecho inválido (ex: 620-635).";
  if (!row.placa || row.placa.trim().length < 6) errors.placa = "Placa obrigatória (mín. 6 chars).";
  const peso = parseNumber(row.peso);
  if (!(peso > 0)) errors.peso = "Peso deve ser > 0.";
  return errors;
}

export function validateRowTs(row: TsRow): RowErrors {
  const errors: RowErrors = {};
  if (!parseData(row.data)) errors.data = "Data inválida (use dd/mm/aaaa).";
  if (row.tipo !== "TS" && row.tipo !== "Dreno") errors.tipo = "Tipo é TS ou Dreno.";
  if (!row.nomenclatura.trim()) errors.nomenclatura = "Nomenclatura obrigatória.";
  if (parseKm(row.km) == null) errors.km = "KM inválido.";
  if (row.lado !== "D" && row.lado !== "E" && row.lado !== "PT") errors.lado = "Lado é D, E ou PT.";
  if (!(parseNumber(row.comprimento) > 0)) errors.comprimento = "Comprimento > 0.";
  if (!(parseNumber(row.largura) > 0)) errors.largura = "Largura > 0.";
  if (!(parseNumber(row.espessura) > 0)) errors.espessura = "Espessura > 0.";
  return errors;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryValidators.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/quickEntryValidators.ts src/modules/rodotracker/utils/quickEntryValidators.test.ts
git commit -m "feat(rodotracker): validadores por linha CBUQ e TS"
```

---

## Task 10: Validador cross-row (TS: nomenclatura)

**Files:**
- Modify: `src/modules/rodotracker/utils/quickEntryValidators.ts`
- Modify: `src/modules/rodotracker/utils/quickEntryValidators.test.ts`

- [ ] **Step 1: Adicionar teste**

```ts
import { validateCrossRowTs, type CrossRowError } from "./quickEntryValidators";

describe("validateCrossRowTs", () => {
  const baseTs = (id: string, nomenclatura: string, tipo: "TS" | "Dreno"): TsRow => ({
    id, data: "21/05/2026", tipo, nomenclatura,
    estaca: "", fracao: "", km: "620", lado: "D",
    comprimento: "10", largura: "1", espessura: "0.3",
  });

  it("1 TS + 2 drenos com mesma nomenclatura: ok", () => {
    const rows = [
      baseTs("1", "TS15/07", "TS"),
      baseTs("2", "TS15/07", "Dreno"),
      baseTs("3", "TS15/07", "Dreno"),
    ];
    expect(validateCrossRowTs(rows, new Set())).toEqual([]);
  });

  it("2 TS com mesma nomenclatura: erro", () => {
    const rows = [
      baseTs("1", "TS15/07", "TS"),
      baseTs("2", "TS15/07", "TS"),
    ];
    const errors = validateCrossRowTs(rows, new Set());
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/duas?.*TS/i);
  });

  it("só drenos sem TS principal: erro", () => {
    const rows = [
      baseTs("1", "TS15/07", "Dreno"),
      baseTs("2", "TS15/07", "Dreno"),
    ];
    const errors = validateCrossRowTs(rows, new Set());
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/principal/i);
  });

  it("nomenclatura conflita com existente na medição: erro", () => {
    const rows = [baseTs("1", "TS15/07", "TS")];
    const errors = validateCrossRowTs(rows, new Set(["TS15/07"]));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/j[áa].*existe/i);
  });

  it("ignora linhas sem nomenclatura (vazias)", () => {
    const rows = [baseTs("1", "", "TS")];
    expect(validateCrossRowTs(rows, new Set())).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryValidators.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Adicionar em `quickEntryValidators.ts`:

```ts
export interface CrossRowError {
  rowIds: string[];
  field?: string;
  message: string;
}

/**
 * Valida regras cross-row do TS:
 *  - cada nomenclatura deve ter exatamente 1 linha TS principal
 *  - nomenclatura não pode conflitar com Activity já existente na medição
 *    (passar Set de nomenclaturas existentes)
 */
export function validateCrossRowTs(
  rows: TsRow[],
  existingNomenclaturas: Set<string>
): CrossRowError[] {
  const errors: CrossRowError[] = [];
  const byNomenclatura = new Map<string, TsRow[]>();
  for (const r of rows) {
    const n = r.nomenclatura.trim();
    if (!n) continue;
    if (!byNomenclatura.has(n)) byNomenclatura.set(n, []);
    byNomenclatura.get(n)!.push(r);
  }
  for (const [n, group] of byNomenclatura) {
    if (existingNomenclaturas.has(n)) {
      errors.push({
        rowIds: group.map((r) => r.id),
        field: "nomenclatura",
        message: `Nomenclatura "${n}" já existe na medição — use o formulário rico pra editar.`,
      });
      continue;
    }
    const tsCount = group.filter((r) => r.tipo === "TS").length;
    if (tsCount === 0) {
      errors.push({
        rowIds: group.map((r) => r.id),
        field: "tipo",
        message: `Nomenclatura "${n}" não tem trecho TS principal — adicione uma linha com Tipo=TS.`,
      });
    } else if (tsCount > 1) {
      errors.push({
        rowIds: group.filter((r) => r.tipo === "TS").map((r) => r.id),
        field: "tipo",
        message: `Duas ou mais linhas TS com nomenclatura "${n}" — só pode ter 1 trecho principal.`,
      });
    }
  }
  return errors;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryValidators.test.ts`
Expected: PASS (15 tests no total).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/quickEntryValidators.ts src/modules/rodotracker/utils/quickEntryValidators.test.ts
git commit -m "feat(rodotracker): validateCrossRowTs (unicidade + TS principal)"
```

---

## Task 11: Agrupamento de linhas CBUQ → Activities

**Files:**
- Create: `src/modules/rodotracker/utils/quickEntryGrouping.ts`
- Create: `src/modules/rodotracker/utils/quickEntryGrouping.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// src/modules/rodotracker/utils/quickEntryGrouping.test.ts
import { describe, it, expect } from "vitest";
import { groupCbuqRowsToActivities } from "./quickEntryGrouping";
import type { CbuqRow } from "./quickEntryValidators";
import type { Obra } from "../types/activity";

const obra = {
  centerLat: -10, centerLng: -55, kmInicial: 600,
  routeGeoJson: [[-10, -55], [-10, -54.7]] as [number, number][],
} as Obra;

const baseRow = (over: Partial<CbuqRow> = {}): CbuqRow => ({
  id: "r" + Math.random(),
  data: "21/05/2026",
  trecho: "620-635",
  placa: "ABC1234",
  hora: "10:00",
  peso: "23.5",
  descricao: "",
  ...over,
});

describe("groupCbuqRowsToActivities", () => {
  it("3 linhas no mesmo dia+trecho viram 1 Activity com 3 cargas", () => {
    const rows = [baseRow(), baseRow({ placa: "DEF5678" }), baseRow({ placa: "GHI9012" })];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(1);
    expect(result[0].cbuq?.cargas).toHaveLength(3);
    expect(result[0].service).toBe("Correção de Defeito (CBUQ)");
    expect(result[0].medicao).toBe(1);
    expect(result[0].lado).toBe("Pista Toda");
    expect(result[0].km).toBe("620");
    expect(result[0].kmEnd).toBe("635");
  });

  it("linhas em 2 dias diferentes viram 2 Activities", () => {
    const rows = [
      baseRow({ data: "21/05/2026" }),
      baseRow({ data: "22/05/2026" }),
    ];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(2);
  });

  it("mesmo dia, trechos diferentes viram 2 Activities", () => {
    const rows = [
      baseRow({ trecho: "620-635" }),
      baseRow({ trecho: "640-650" }),
    ];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(2);
  });

  it("descrições únicas das cargas concatenam na Activity.description", () => {
    const rows = [
      baseRow({ descricao: "Faixa C 12.5" }),
      baseRow({ placa: "DEF5678", descricao: "Faixa C 12.5" }),
      baseRow({ placa: "GHI9012", descricao: "Faixa B 19.0" }),
    ];
    const [act] = groupCbuqRowsToActivities(rows, obra, 1);
    expect(act.description).toBe("Faixa C 12.5\nFaixa B 19.0");
  });

  it("ignora linhas vazias (sem data)", () => {
    const rows = [baseRow(), baseRow({ data: "", trecho: "", placa: "", peso: "" })];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(1);
    expect(result[0].cbuq?.cargas).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryGrouping.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/modules/rodotracker/utils/quickEntryGrouping.ts
import type { Activity, Obra, CbuqCarga } from "../types/activity";
import type { CbuqRow } from "./quickEntryValidators";
import { parseData, parseTrecho } from "./quickEntryParsers";
import { parseNumber } from "./parseNumber";
import { latLngFromKm } from "./latLngFromKm";
import { calcCbuq } from "./cbuqCalc";
import { generateId } from "./format";

function isBlankCbuq(r: CbuqRow): boolean {
  return !r.data.trim() && !r.trecho.trim() && !r.placa.trim() && !r.peso.trim();
}

export function groupCbuqRowsToActivities(
  rows: CbuqRow[],
  obra: Obra,
  medicao: number
): Activity[] {
  const groups = new Map<string, CbuqRow[]>();
  for (const r of rows) {
    if (isBlankCbuq(r)) continue;
    const data = parseData(r.data);
    const trecho = parseTrecho(r.trecho);
    if (!data || !trecho) continue;
    const key = `${data}|${trecho.kmInicial}-${trecho.kmFinal}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const now = Date.now();
  const activities: Activity[] = [];
  for (const group of groups.values()) {
    const firstRow = group[0];
    const data = parseData(firstRow.data)!;
    const trecho = parseTrecho(firstRow.trecho)!;
    const startPt = latLngFromKm(trecho.kmInicial, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
    const endPt = latLngFromKm(trecho.kmFinal, obra) ?? startPt;
    const cargas: CbuqCarga[] = group.map((r) => ({
      id: generateId(),
      data,
      placa: r.placa.trim().toUpperCase(),
      hora: r.hora.trim() || undefined,
      pesoT: parseNumber(r.peso),
      descricao: r.descricao.trim() || undefined,
    }));
    const uniqueDescricoes = Array.from(
      new Set(group.map((r) => r.descricao.trim()).filter(Boolean))
    );
    const activity: Activity = {
      id: generateId(),
      lat: startPt.lat,
      lng: startPt.lng,
      latEnd: endPt.lat,
      lngEnd: endPt.lng,
      service: "Correção de Defeito (CBUQ)",
      date: data,
      medicao,
      km: String(trecho.kmInicial),
      kmEnd: String(trecho.kmFinal),
      lado: "Pista Toda",
      areaRect: null,
      description: uniqueDescricoes.join("\n"),
      quantities: [],
      photoIds: [],
      photoFolders: [],
      cbuq: {
        medicaoNumber: medicao,
        cargas,
        contributions: calcCbuq(cargas),
      },
      createdAt: now,
      updatedAt: now,
    };
    activities.push(activity);
  }
  return activities;
}
```

- [ ] **Step 4: Verificar assinatura de `calcCbuq`**

Run: `grep -n "^export function calcCbuq" /Users/tiagocameli/projects/Gestao_Obras/src/modules/rodotracker/utils/cbuqCalc.ts`

Se a assinatura for diferente de `calcCbuq(cargas: CbuqCarga[]): Record<string, number>`, ajustar a chamada (provavelmente vai precisar passar mais argumentos — adaptar conforme implementação real). Documentar qualquer ajuste no commit.

- [ ] **Step 5: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryGrouping.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/rodotracker/utils/quickEntryGrouping.ts src/modules/rodotracker/utils/quickEntryGrouping.test.ts
git commit -m "feat(rodotracker): groupCbuqRowsToActivities agrupa por (data,trecho)"
```

---

## Task 12: Agrupamento de linhas TS → Activities

**Files:**
- Modify: `src/modules/rodotracker/utils/quickEntryGrouping.ts`
- Modify: `src/modules/rodotracker/utils/quickEntryGrouping.test.ts`

- [ ] **Step 1: Adicionar teste**

```ts
import { groupTsRowsToActivities } from "./quickEntryGrouping";
import type { TsRow } from "./quickEntryValidators";

const baseTs = (over: Partial<TsRow> = {}): TsRow => ({
  id: "r" + Math.random(),
  data: "21/05/2026",
  tipo: "TS",
  nomenclatura: "TS15/07",
  estaca: "380",
  fracao: "10",
  km: "620.5",
  lado: "D",
  comprimento: "26",
  largura: "4.8",
  espessura: "0.4",
  ...over,
});

describe("groupTsRowsToActivities", () => {
  it("TS + 2 drenos com mesma nomenclatura viram 1 Activity", () => {
    const rows = [
      baseTs(),
      baseTs({ tipo: "Dreno", comprimento: "30", largura: "0.6", espessura: "0.5" }),
      baseTs({ tipo: "Dreno", comprimento: "25", largura: "0.6", espessura: "0.5" }),
    ];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(1);
    expect(result[0].trocaSolo?.drenos).toHaveLength(2);
    expect(result[0].nomenclatura).toBe("TS15/07");
    expect(result[0].estaca).toBe("380");
    expect(result[0].lado).toBe("Direito");
    expect(result[0].trocaSolo?.categoria).toBe("rotineira");
  });

  it("2 nomenclaturas diferentes viram 2 Activities", () => {
    const rows = [baseTs({ nomenclatura: "TS15/07" }), baseTs({ nomenclatura: "TS16/07" })];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(2);
  });

  it("lado D vira 'Direito', E vira 'Esquerdo', PT vira 'Pista Toda'", () => {
    const r1 = groupTsRowsToActivities([baseTs({ lado: "D", nomenclatura: "A" })], obra, 1, "rotineira");
    const r2 = groupTsRowsToActivities([baseTs({ lado: "E", nomenclatura: "B" })], obra, 1, "rotineira");
    const r3 = groupTsRowsToActivities([baseTs({ lado: "PT", nomenclatura: "C" })], obra, 1, "rotineira");
    expect(r1[0].lado).toBe("Direito");
    expect(r2[0].lado).toBe("Esquerdo");
    expect(r3[0].lado).toBe("Pista Toda");
  });

  it("ignora linhas sem nomenclatura", () => {
    const rows = [baseTs(), baseTs({ nomenclatura: "" })];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(1);
  });

  it("grupo só com drenos (sem TS principal) é ignorado", () => {
    const rows = [baseTs({ tipo: "Dreno", nomenclatura: "X" })];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryGrouping.test.ts`
Expected: FAIL (groupTsRowsToActivities não exportado).

- [ ] **Step 3: Implementar**

Adicionar em `quickEntryGrouping.ts`:

```ts
import type { TsRow } from "./quickEntryValidators";
import type { LadoPista, TrocaSoloData } from "../types/activity";
import { parseKm } from "./quickEntryParsers";
import { calcTrocaSolo } from "./trocaSoloCalc";

function ladoFromCode(code: TsRow["lado"]): LadoPista {
  if (code === "D") return "Direito";
  if (code === "E") return "Esquerdo";
  return "Pista Toda";
}

export function groupTsRowsToActivities(
  rows: TsRow[],
  obra: Obra,
  medicao: number,
  categoria: "rotineira" | "passivo"
): Activity[] {
  const byNomenclatura = new Map<string, TsRow[]>();
  for (const r of rows) {
    const n = r.nomenclatura.trim();
    if (!n) continue;
    if (!byNomenclatura.has(n)) byNomenclatura.set(n, []);
    byNomenclatura.get(n)!.push(r);
  }
  const now = Date.now();
  const activities: Activity[] = [];
  for (const [nomenclatura, group] of byNomenclatura) {
    const tsRow = group.find((r) => r.tipo === "TS");
    if (!tsRow) continue; // grupos só com drenos são ignorados (validator já alertou)
    const drenoRows = group.filter((r) => r.tipo === "Dreno");
    const data = parseData(tsRow.data);
    const km = parseKm(tsRow.km);
    if (!data || km == null) continue;
    const pt = latLngFromKm(km, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
    const drenos = drenoRows.map((d) => ({
      comprimento: parseNumber(d.comprimento),
      largura: parseNumber(d.largura),
      espessura: parseNumber(d.espessura),
    }));
    const trocaSolo: TrocaSoloData = {
      categoria,
      medicaoNumber: medicao,
      comprimento: parseNumber(tsRow.comprimento),
      largura: parseNumber(tsRow.largura),
      espessura: parseNumber(tsRow.espessura),
      drenos,
      contributions: {},
    };
    trocaSolo.contributions = calcTrocaSolo(trocaSolo);
    const activity: Activity = {
      id: generateId(),
      lat: pt.lat,
      lng: pt.lng,
      service: "Troca de Solo",
      date: data,
      medicao,
      km: String(km),
      lado: ladoFromCode(tsRow.lado),
      areaRect: null,
      description: "",
      quantities: [],
      photoIds: [],
      photoFolders: [],
      trocaSolo,
      estaca: tsRow.estaca.trim() || undefined,
      fracao: tsRow.fracao.trim() || undefined,
      nomenclatura,
      createdAt: now,
      updatedAt: now,
    };
    activities.push(activity);
  }
  return activities;
}
```

- [ ] **Step 4: Verificar assinatura de `calcTrocaSolo`**

Run: `grep -n "^export function calcTrocaSolo" /Users/tiagocameli/projects/Gestao_Obras/src/modules/rodotracker/utils/trocaSoloCalc.ts`

Ajustar a chamada se a assinatura real for diferente (provavelmente toma um objeto similar ao `TrocaSoloData`). Documentar no commit qualquer ajuste.

- [ ] **Step 5: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/quickEntryGrouping.test.ts`
Expected: PASS (10 tests no total).

- [ ] **Step 6: Commit**

```bash
git add src/modules/rodotracker/utils/quickEntryGrouping.ts src/modules/rodotracker/utils/quickEntryGrouping.test.ts
git commit -m "feat(rodotracker): groupTsRowsToActivities agrupa TS+drenos por nomenclatura"
```

---

## Task 13: `parseTsv` + `distributePaste`

**Files:**
- Create: `src/modules/rodotracker/utils/parseTsv.ts`
- Create: `src/modules/rodotracker/utils/parseTsv.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// src/modules/rodotracker/utils/parseTsv.test.ts
import { describe, it, expect } from "vitest";
import { parseTsv, distributePaste } from "./parseTsv";

describe("parseTsv", () => {
  it("uma linha, três células", () => {
    expect(parseTsv("a\tb\tc")).toEqual([["a", "b", "c"]]);
  });
  it("duas linhas com \\n", () => {
    expect(parseTsv("a\tb\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("CRLF (Windows)", () => {
    expect(parseTsv("a\tb\r\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("strip linha final vazia", () => {
    expect(parseTsv("a\tb\n")).toEqual([["a", "b"]]);
  });
});

describe("distributePaste", () => {
  type Row = { c0: string; c1: string; c2: string };
  const cols: (keyof Row)[] = ["c0", "c1", "c2"];

  it("distribui a partir de (0,0)", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a", "b"]], { row: 0, col: 0 });
    expect(result[0]).toEqual({ c0: "a", c1: "b", c2: "" });
  });

  it("distribui a partir de (0,1)", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a", "b"]], { row: 0, col: 1 });
    expect(result[0]).toEqual({ c0: "", c1: "a", c2: "b" });
  });

  it("cria linhas adicionais se paste excede linhas existentes", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a"], ["b"], ["c"]], { row: 0, col: 0 });
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ c0: "c", c1: "", c2: "" });
  });

  it("ignora células que extrapolam o número de colunas", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a", "b", "c", "d"]], { row: 0, col: 0 });
    expect(result[0]).toEqual({ c0: "a", c1: "b", c2: "c" });
  });
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/parseTsv.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/modules/rodotracker/utils/parseTsv.ts
export function parseTsv(input: string): string[][] {
  const lines = String(input ?? "").replace(/\r\n/g, "\n").split("\n");
  const result: string[][] = [];
  for (const line of lines) {
    if (line === "" && result.length > 0 && lines.indexOf(line) === lines.length - 1) continue;
    if (line === "") continue;
    result.push(line.split("\t"));
  }
  return result;
}

export interface CellPos {
  row: number;
  col: number;
}

/**
 * Cola TSV `paste` numa lista de linhas (rows) a partir da célula focada
 * (anchor). Retorna NOVA lista (não muta). Cria linhas extras se paste excede.
 */
export function distributePaste<TRow extends Record<string, unknown>, TKey extends keyof TRow>(
  rows: TRow[],
  cols: TKey[],
  paste: string[][],
  anchor: CellPos,
  makeEmptyRow: () => TRow = () => ({} as TRow)
): TRow[] {
  const out = rows.map((r) => ({ ...r }));
  for (let i = 0; i < paste.length; i++) {
    const targetRowIdx = anchor.row + i;
    while (out.length <= targetRowIdx) {
      out.push(makeEmptyRow());
    }
    const targetRow = out[targetRowIdx];
    for (let j = 0; j < paste[i].length; j++) {
      const targetColIdx = anchor.col + j;
      if (targetColIdx >= cols.length) break;
      const colKey = cols[targetColIdx];
      (targetRow as Record<string, unknown>)[colKey as string] = paste[i][j];
    }
  }
  return out;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx vitest run src/modules/rodotracker/utils/parseTsv.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/parseTsv.ts src/modules/rodotracker/utils/parseTsv.test.ts
git commit -m "feat(rodotracker): parseTsv + distributePaste pro paste do Excel"
```

---

## Task 14: Cell components

**Files:**
- Create: `src/modules/rodotracker/components/Measurement/quickEntryCells.tsx`

- [ ] **Step 1: Escrever componentes**

```tsx
// src/modules/rodotracker/components/Measurement/quickEntryCells.tsx
import { forwardRef } from "react";
import { cn } from "../../../../lib/utils";

interface CellInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  placeholder?: string;
  error?: string;
  warning?: boolean;
  readonly?: boolean;
  type?: "text" | "number" | "date" | "time";
  className?: string;
}

export const TextCell = forwardRef<HTMLInputElement, CellInputProps>(
  ({ value, onChange, onKeyDown, onFocus, placeholder, error, warning, readonly, type = "text", className }, ref) => (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      readOnly={readonly}
      title={error}
      className={cn(
        "h-9 w-full px-2 text-sm bg-transparent outline-none border",
        "border-transparent focus:border-primary",
        error && "border-red-500 bg-red-50",
        warning && !error && "border-amber-400 bg-amber-50",
        readonly && "bg-muted text-muted-foreground cursor-default",
        className
      )}
    />
  )
);
TextCell.displayName = "TextCell";

interface SelectCellProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
  onFocus?: () => void;
}

export function SelectCell({ value, onChange, options, error, onKeyDown, onFocus }: SelectCellProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      title={error}
      className={cn(
        "h-9 w-full px-2 text-sm bg-transparent outline-none border",
        "border-transparent focus:border-primary",
        error && "border-red-500 bg-red-50"
      )}
    >
      <option value=""></option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Verificar compilação**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/rodotracker/components/Measurement/quickEntryCells.tsx
git commit -m "feat(rodotracker): TextCell e SelectCell pra grid de lançamento"
```

---

## Task 15: `QuickEntryGridCbuq` component

**Files:**
- Create: `src/modules/rodotracker/components/Measurement/QuickEntryGridCbuq.tsx`

- [ ] **Step 1: Implementar grid CBUQ**

```tsx
// src/modules/rodotracker/components/Measurement/QuickEntryGridCbuq.tsx
import { useMemo, useRef, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { TextCell } from "./quickEntryCells";
import type { CbuqRow } from "../../utils/quickEntryValidators";
import { validateRowCbuq } from "../../utils/quickEntryValidators";
import { parseTsv, distributePaste } from "../../utils/parseTsv";
import { parseNumber } from "../../utils/parseNumber";
import { generateId } from "../../utils/format";

export function makeEmptyCbuqRow(): CbuqRow {
  return { id: generateId(), data: "", trecho: "", placa: "", hora: "", peso: "", descricao: "" };
}

interface Props {
  rows: CbuqRow[];
  onRowsChange: (rows: CbuqRow[]) => void;
}

const COLS: { key: keyof CbuqRow; label: string; width: string }[] = [
  { key: "data", label: "Data", width: "110px" },
  { key: "trecho", label: "Trecho do dia (KM)", width: "160px" },
  { key: "placa", label: "Placa", width: "110px" },
  { key: "hora", label: "Hora", width: "80px" },
  { key: "peso", label: "Peso (t)", width: "90px" },
  { key: "descricao", label: "Descrição", width: "auto" },
];
const COL_KEYS = COLS.map((c) => c.key);

export function QuickEntryGridCbuq({ rows, onRowsChange }: Props) {
  // garante sempre uma linha em branco no final
  const displayRows = useMemo(() => {
    if (rows.length === 0 || hasAnyContent(rows[rows.length - 1])) {
      return [...rows, makeEmptyCbuqRow()];
    }
    return rows;
  }, [rows]);

  const errorsByRow = useMemo(() => {
    return displayRows.map((r) => (hasAnyContent(r) ? validateRowCbuq(r) : {}));
  }, [displayRows]);

  const setCell = useCallback(
    (rowIdx: number, key: keyof CbuqRow, value: string) => {
      const next = displayRows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r));
      onRowsChange(stripTrailingBlanks(next));
    },
    [displayRows, onRowsChange]
  );

  const removeRow = (rowIdx: number) => {
    const next = displayRows.filter((_, i) => i !== rowIdx);
    onRowsChange(stripTrailingBlanks(next));
  };

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>, rowIdx: number, colIdx: number) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text || !text.includes("\t") && !text.includes("\n")) return;
      e.preventDefault();
      const tsv = parseTsv(text);
      const next = distributePaste(displayRows, COL_KEYS, tsv, { row: rowIdx, col: colIdx }, makeEmptyCbuqRow);
      onRowsChange(stripTrailingBlanks(next));
    },
    [displayRows, onRowsChange]
  );

  const totalPeso = useMemo(
    () => displayRows.reduce((sum, r) => sum + (parseNumber(r.peso) || 0), 0),
    [displayRows]
  );

  return (
    <div className="border rounded-md overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-muted sticky top-0">
          <tr>
            {COLS.map((c) => (
              <th key={c.key} style={{ width: c.width }} className="text-left px-2 py-2 font-medium">
                {c.label}
              </th>
            ))}
            <th style={{ width: "40px" }}></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, rowIdx) => {
            const errs = errorsByRow[rowIdx];
            return (
              <tr key={row.id} className="border-t">
                {COLS.map((c, colIdx) => (
                  <td key={c.key} className="p-0" onPaste={(e) => onPaste(e, rowIdx, colIdx)}>
                    <TextCell
                      value={row[c.key]}
                      onChange={(v) => setCell(rowIdx, c.key, v)}
                      error={errs[c.key as string]}
                    />
                  </td>
                ))}
                <td className="p-0 text-center">
                  {hasAnyContent(row) && (
                    <button onClick={() => removeRow(rowIdx)} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-muted/50 border-t">
          <tr>
            <td colSpan={COLS.length + 1} className="px-2 py-2 text-sm text-muted-foreground">
              Σ peso = {totalPeso.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function hasAnyContent(r: CbuqRow): boolean {
  return Boolean(r.data || r.trecho || r.placa || r.hora || r.peso || r.descricao);
}

function stripTrailingBlanks(rows: CbuqRow[]): CbuqRow[] {
  let i = rows.length;
  while (i > 0 && !hasAnyContent(rows[i - 1])) i--;
  return rows.slice(0, i);
}
```

- [ ] **Step 2: Verificar compilação**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/rodotracker/components/Measurement/QuickEntryGridCbuq.tsx
git commit -m "feat(rodotracker): QuickEntryGridCbuq (grid editável de cargas)"
```

---

## Task 16: `QuickEntryGridTs` component

**Files:**
- Create: `src/modules/rodotracker/components/Measurement/QuickEntryGridTs.tsx`

- [ ] **Step 1: Implementar grid TS**

```tsx
// src/modules/rodotracker/components/Measurement/QuickEntryGridTs.tsx
import { useMemo, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { TextCell, SelectCell } from "./quickEntryCells";
import type { TsRow, CrossRowError } from "../../utils/quickEntryValidators";
import { validateRowTs, validateCrossRowTs } from "../../utils/quickEntryValidators";
import { parseTsv, distributePaste } from "../../utils/parseTsv";
import { parseNumber } from "../../utils/parseNumber";
import { generateId } from "../../utils/format";

export function makeEmptyTsRow(): TsRow {
  return {
    id: generateId(), data: "", tipo: "", nomenclatura: "",
    estaca: "", fracao: "", km: "", lado: "",
    comprimento: "", largura: "", espessura: "",
  };
}

interface Props {
  rows: TsRow[];
  onRowsChange: (rows: TsRow[]) => void;
  existingNomenclaturas: Set<string>;
}

const COLS: { key: keyof TsRow; label: string; width: string; type: "text" | "select" }[] = [
  { key: "data", label: "Data", width: "110px", type: "text" },
  { key: "tipo", label: "Tipo", width: "90px", type: "select" },
  { key: "nomenclatura", label: "Nomenclatura", width: "120px", type: "text" },
  { key: "estaca", label: "Estaca", width: "80px", type: "text" },
  { key: "fracao", label: "Fração", width: "80px", type: "text" },
  { key: "km", label: "KM", width: "100px", type: "text" },
  { key: "lado", label: "Lado", width: "80px", type: "select" },
  { key: "comprimento", label: "Compr (m)", width: "100px", type: "text" },
  { key: "largura", label: "Larg (m)", width: "90px", type: "text" },
  { key: "espessura", label: "Esp (m)", width: "90px", type: "text" },
];
const COL_KEYS = COLS.map((c) => c.key);

const TIPO_OPTIONS = [{ value: "TS", label: "TS" }, { value: "Dreno", label: "Dreno" }];
const LADO_OPTIONS = [
  { value: "D", label: "D" }, { value: "E", label: "E" }, { value: "PT", label: "PT" },
];

export function QuickEntryGridTs({ rows, onRowsChange, existingNomenclaturas }: Props) {
  const displayRows = useMemo(() => {
    if (rows.length === 0 || hasAnyContent(rows[rows.length - 1])) {
      return [...rows, makeEmptyTsRow()];
    }
    return rows;
  }, [rows]);

  const errorsByRow = useMemo(
    () => displayRows.map((r) => (hasAnyContent(r) ? validateRowTs(r) : {})),
    [displayRows]
  );
  const crossErrors: CrossRowError[] = useMemo(
    () => validateCrossRowTs(displayRows.filter(hasAnyContent), existingNomenclaturas),
    [displayRows, existingNomenclaturas]
  );
  const crossErrorByRowId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ce of crossErrors) {
      for (const id of ce.rowIds) map.set(id, ce.message);
    }
    return map;
  }, [crossErrors]);

  const setCell = useCallback(
    (rowIdx: number, key: keyof TsRow, value: string) => {
      const next = displayRows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r));
      onRowsChange(stripTrailingBlanks(next));
    },
    [displayRows, onRowsChange]
  );

  const removeRow = (rowIdx: number) => {
    const next = displayRows.filter((_, i) => i !== rowIdx);
    onRowsChange(stripTrailingBlanks(next));
  };

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>, rowIdx: number, colIdx: number) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
      e.preventDefault();
      const tsv = parseTsv(text);
      const next = distributePaste(displayRows, COL_KEYS, tsv, { row: rowIdx, col: colIdx }, makeEmptyTsRow);
      onRowsChange(stripTrailingBlanks(next));
    },
    [displayRows, onRowsChange]
  );

  const totalAreaTs = useMemo(
    () => displayRows
      .filter((r) => r.tipo === "TS")
      .reduce((s, r) => s + parseNumber(r.comprimento) * parseNumber(r.largura), 0),
    [displayRows]
  );
  const totalComprimentoDrenos = useMemo(
    () => displayRows
      .filter((r) => r.tipo === "Dreno")
      .reduce((s, r) => s + parseNumber(r.comprimento), 0),
    [displayRows]
  );

  return (
    <div className="space-y-2">
      {crossErrors.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          <strong>Erros de agrupamento:</strong>
          <ul className="list-disc pl-5">
            {crossErrors.map((ce, i) => <li key={i}>{ce.message}</li>)}
          </ul>
        </div>
      )}
      <div className="border rounded-md overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-muted sticky top-0">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} style={{ width: c.width }} className="text-left px-2 py-2 font-medium">{c.label}</th>
              ))}
              <th style={{ width: "90px" }}>Área (m²)</th>
              <th style={{ width: "40px" }}></th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => {
              const errs = errorsByRow[rowIdx];
              const area = parseNumber(row.comprimento) * parseNumber(row.largura);
              const crossMsg = crossErrorByRowId.get(row.id);
              return (
                <tr key={row.id} className="border-t" title={crossMsg}>
                  {COLS.map((c, colIdx) => (
                    <td key={c.key} className="p-0" onPaste={(e) => onPaste(e, rowIdx, colIdx)}>
                      {c.type === "select" ? (
                        <SelectCell
                          value={row[c.key] as string}
                          onChange={(v) => setCell(rowIdx, c.key, v)}
                          options={c.key === "tipo" ? TIPO_OPTIONS : LADO_OPTIONS}
                          error={errs[c.key as string] || (crossMsg && c.key === "nomenclatura" ? crossMsg : undefined)}
                        />
                      ) : (
                        <TextCell
                          value={row[c.key] as string}
                          onChange={(v) => setCell(rowIdx, c.key, v)}
                          error={errs[c.key as string] || (crossMsg && c.key === "nomenclatura" ? crossMsg : undefined)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-2 text-right text-muted-foreground bg-muted/30">
                    {area > 0 ? area.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                  </td>
                  <td className="p-0 text-center">
                    {hasAnyContent(row) && (
                      <button onClick={() => removeRow(rowIdx)} className="text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/50 border-t">
            <tr>
              <td colSpan={COLS.length + 2} className="px-2 py-2 text-sm text-muted-foreground">
                Σ área TS = {totalAreaTs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m² ·
                Σ comprimento drenos = {totalComprimentoDrenos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function hasAnyContent(r: TsRow): boolean {
  return Boolean(r.data || r.tipo || r.nomenclatura || r.estaca || r.fracao || r.km || r.lado || r.comprimento || r.largura || r.espessura);
}

function stripTrailingBlanks(rows: TsRow[]): TsRow[] {
  let i = rows.length;
  while (i > 0 && !hasAnyContent(rows[i - 1])) i--;
  return rows.slice(0, i);
}
```

- [ ] **Step 2: Verificar compilação**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/rodotracker/components/Measurement/QuickEntryGridTs.tsx
git commit -m "feat(rodotracker): QuickEntryGridTs (grid TS+drenos com cross-row erros)"
```

---

## Task 17: `QuickEntrySheet` (modal com tabs + save pipeline)

**Files:**
- Create: `src/modules/rodotracker/components/Measurement/QuickEntrySheet.tsx`

- [ ] **Step 1: Implementar modal completo**

```tsx
// src/modules/rodotracker/components/Measurement/QuickEntrySheet.tsx
import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../../components/shadcn/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/shadcn/tabs";
import { Button } from "../../../../components/shadcn/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/shadcn/select";
import { Loader2 } from "lucide-react";
import { QuickEntryGridCbuq, makeEmptyCbuqRow } from "./QuickEntryGridCbuq";
import { QuickEntryGridTs, makeEmptyTsRow } from "./QuickEntryGridTs";
import type { CbuqRow, TsRow } from "../../utils/quickEntryValidators";
import { validateRowCbuq, validateRowTs, validateCrossRowTs } from "../../utils/quickEntryValidators";
import { groupCbuqRowsToActivities, groupTsRowsToActivities } from "../../utils/quickEntryGrouping";
import type { Obra, Activity } from "../../types/activity";
import { useActivities } from "../../hooks/useActivities";

interface Props {
  open: boolean;
  onClose: () => void;
  obra: Obra;
  medicao: number;
}

export function QuickEntrySheet({ open, onClose, obra, medicao }: Props) {
  const { activities, addActivity } = useActivities(obra.id);
  const [tab, setTab] = useState<"cbuq" | "ts">("cbuq");
  const [cbuqRows, setCbuqRows] = useState<CbuqRow[]>([]);
  const [tsRows, setTsRows] = useState<TsRow[]>([]);
  const [categoria, setCategoria] = useState<"rotineira" | "passivo">("rotineira");
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const existingNomenclaturas = useMemo(() => {
    const s = new Set<string>();
    for (const a of activities) {
      if (a.medicao === medicao && a.nomenclatura) s.add(a.nomenclatura);
    }
    return s;
  }, [activities, medicao]);

  const hasUnsavedContent = cbuqRows.length > 0 || tsRows.length > 0;

  const tryClose = useCallback(() => {
    if (hasUnsavedContent) {
      const ok = window.confirm("Você tem lançamentos não salvos. Descartar?");
      if (!ok) return;
    }
    setCbuqRows([]); setTsRows([]); setGlobalError(null); setSaveProgress(null);
    onClose();
  }, [hasUnsavedContent, onClose]);

  const handleSave = async () => {
    setGlobalError(null);
    // Fase 1 — validação local
    const cbuqErrors = cbuqRows.filter((r) => Object.keys(validateRowCbuq(r)).length > 0);
    const tsRowErrors = tsRows.filter((r) => Object.keys(validateRowTs(r)).length > 0);
    const tsCrossErrors = validateCrossRowTs(tsRows, existingNomenclaturas);
    if (cbuqErrors.length || tsRowErrors.length || tsCrossErrors.length) {
      setGlobalError("Corrija os erros marcados em vermelho antes de salvar.");
      return;
    }

    // Fase 2 — agrupamento
    const cbuqActivities = groupCbuqRowsToActivities(cbuqRows, obra, medicao);
    const tsActivities = groupTsRowsToActivities(tsRows, obra, medicao, categoria);
    const all: Activity[] = [...cbuqActivities, ...tsActivities];
    if (all.length === 0) {
      setGlobalError("Nada para salvar.");
      return;
    }

    // Fase 3 — batch upsert sequencial
    setSaving(true);
    setSaveProgress({ done: 0, total: all.length });
    let cargasTotal = 0, drenosTotal = 0;
    try {
      for (let i = 0; i < all.length; i++) {
        await addActivity(all[i]);
        setSaveProgress({ done: i + 1, total: all.length });
        if (all[i].cbuq) cargasTotal += all[i].cbuq!.cargas.length;
        if (all[i].trocaSolo) drenosTotal += all[i].trocaSolo!.drenos.length;
      }
    } catch (err) {
      setGlobalError(`Falha ao salvar: ${(err as Error).message}`);
      setSaving(false);
      return;
    }

    // Fase 4 — pós-save
    setSaving(false);
    setSaveProgress(null);
    setCbuqRows([]); setTsRows([]);
    alert(
      `${all.length} Activities criadas (${cbuqActivities.length} CBUQ, ${tsActivities.length} TS) — ` +
      `${cargasTotal} cargas, ${drenosTotal} drenos.`
    );
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) tryClose(); }}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Lançamento rápido — {obra.name} · {medicao}ª Medição
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "cbuq" | "ts")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="cbuq">CBUQ ({cbuqRows.length})</TabsTrigger>
            <TabsTrigger value="ts">Troca de Solo / Drenos ({tsRows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="cbuq" className="flex-1 overflow-auto">
            <div className="text-xs text-muted-foreground p-2">
              Cada linha = 1 carga. Linhas com mesma <b>Data</b> + mesmo <b>Trecho do dia</b> viram 1 Activity.
            </div>
            <QuickEntryGridCbuq rows={cbuqRows} onRowsChange={setCbuqRows} />
          </TabsContent>

          <TabsContent value="ts" className="flex-1 overflow-auto">
            <div className="flex items-center justify-between p-2">
              <div className="text-xs text-muted-foreground">
                Cada linha = 1 trecho (TS ou Dreno). Linhas com mesma <b>Nomenclatura</b> viram 1 Activity.
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Categoria:</span>
                <Select value={categoria} onValueChange={(v) => setCategoria(v as any)}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rotineira">Rotineira</SelectItem>
                    <SelectItem value="passivo">Passivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <QuickEntryGridTs rows={tsRows} onRowsChange={setTsRows} existingNomenclaturas={existingNomenclaturas} />
          </TabsContent>
        </Tabs>

        {globalError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {globalError}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={tryClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || (cbuqRows.length === 0 && tsRows.length === 0)}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saveProgress ? `Salvando ${saveProgress.done}/${saveProgress.total}...` : "Salvar tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar que componentes shadcn existem**

Run:
```
ls /Users/tiagocameli/projects/Gestao_Obras/src/components/shadcn/{dialog,tabs,button,select}.tsx 2>/dev/null
```
Expected: todos os 4 arquivos existem. Se algum não existe, instalar via:
```
cd /Users/tiagocameli/projects/Gestao_Obras && npx shadcn@latest add dialog tabs button select
```
(memory: novos componentes shadcn vão pra `src/components/shadcn/`, não `src/components/ui/`).

- [ ] **Step 3: Verificar compilação**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/rodotracker/components/Measurement/QuickEntrySheet.tsx
git commit -m "feat(rodotracker): QuickEntrySheet (modal com tabs + save pipeline)"
```

---

## Task 18: Wire button in MeasurementView + version bump

**Files:**
- Modify: `src/modules/rodotracker/components/Measurement/MeasurementView.tsx`
- Modify: `src/modules/rodotracker/components/Home/HomePage.tsx`

- [ ] **Step 1: Adicionar import e estado em MeasurementView**

Em `MeasurementView.tsx`, no topo dos imports, adicionar:

```tsx
import { QuickEntrySheet } from "./QuickEntrySheet";
```

E no ícone do lucide-react (linha 2), adicionar `Zap`:

```tsx
import { X, Plus, Ruler, Sparkles, Trash2, Search, FileSpreadsheet, FileDown, Pencil, Check, Zap } from "lucide-react";
```

No bloco de estado (logo após `const [showImport, setShowImport] = useState(false);`), adicionar:

```tsx
const [showQuickEntry, setShowQuickEntry] = useState(false);
```

- [ ] **Step 2: Adicionar botão "Lançamento rápido"**

Localizar o grupo de botões da toolbar da MeasurementView (próximo aos botões "Importar contrato" / "Exportar"). Adicionar **antes** do botão Importar:

```tsx
<button
  type="button"
  onClick={() => setShowQuickEntry(true)}
  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent text-sm"
>
  <Zap className="w-4 h-4" /> Lançamento rápido
</button>
```

E no fim do JSX da MeasurementView (próximo onde já tem `{showImport && <ImportExcelModal ... />}`), adicionar:

```tsx
{showQuickEntry && (
  <QuickEntrySheet
    open={showQuickEntry}
    onClose={() => setShowQuickEntry(false)}
    obra={obra}
    medicao={currentMedicao}
  />
)}
```

- [ ] **Step 3: Bump da versão no HomePage**

Em `src/modules/rodotracker/components/Home/HomePage.tsx`, localizar a string `v1.x` no JSX do logo (Trechos) e incrementar o último dígito (ex: `v1.42` → `v1.43`). Memory: regra do projeto = bump em toda mudança em `src/modules/rodotracker/`.

Run: `grep -n "v1\." /Users/tiagocameli/projects/Gestao_Obras/src/modules/rodotracker/components/Home/HomePage.tsx`

Identificar a linha e fazer Edit pra incrementar.

- [ ] **Step 4: Smoke test manual**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npm run dev`

Abrir o navegador, navegar pra MeasurementView de uma obra, clicar "Lançamento rápido", verificar:
- Modal abre
- Tabs CBUQ e TS aparecem
- Conseguir digitar uma linha em CBUQ
- Conseguir trocar pra TS sem perder dados de CBUQ
- Conseguir fechar (com confirmação se houver conteúdo)

Reportar resultado do teste manual.

- [ ] **Step 5: Verificar build**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npm run build`
Expected: build verde.

- [ ] **Step 6: Commit**

```bash
git add src/modules/rodotracker/components/Measurement/MeasurementView.tsx src/modules/rodotracker/components/Home/HomePage.tsx
git commit -m "feat(rodotracker): wire Lançamento rápido na MeasurementView + bump versão"
```

---

## Task 19: E2E test (Playwright)

**Files:**
- Create: `tests/quick-entry.spec.ts`

- [ ] **Step 1: Verificar setup do Playwright**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && cat playwright.config.ts | head -30`

Anotar: `baseURL`, `testDir`, padrão de auth (provavelmente um setup global ou storage state). Reutilizar.

- [ ] **Step 2: Escrever E2E pro CBUQ**

```ts
// tests/quick-entry.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Lançamento rápido — CBUQ", () => {
  test("paste de 4 cargas em 2 dias cria 2 Activities", async ({ page }) => {
    // PRÉ-REQUISITO: existe uma obra de teste com routeGeoJson + kmInicial.
    // Ajustar o ID ou navegar via UI conforme padrão do projeto.
    await page.goto("/rodotracker"); // ajustar rota
    await page.getByText("BR-364 Lote 09").first().click();
    await page.getByRole("button", { name: /medição/i }).click();
    await page.getByRole("button", { name: /lançamento rápido/i }).click();

    // Cola TSV simulando copy do Excel
    const tsv = [
      "21/05/2026\t620-635\tABC1234\t10:00\t23.5\tFaixa C 12.5",
      "21/05/2026\t620-635\tDEF5678\t10:30\t24.0\tFaixa C 12.5",
      "22/05/2026\t640-650\tGHI9012\t09:00\t22.0\tFaixa C 12.5",
      "22/05/2026\t640-650\tJKL3456\t09:30\t22.5\tFaixa C 12.5",
    ].join("\n");

    // foca a primeira célula
    const firstDataCell = page.locator("table input").first();
    await firstDataCell.focus();
    // dispatch paste
    await page.evaluate(([t]) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", t);
      const target = document.activeElement!;
      target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
    }, [tsv]);

    // confere 4 linhas + linha em branco
    await expect(page.locator("table tbody tr")).toHaveCount(5);

    // salva
    await page.getByRole("button", { name: /salvar tudo/i }).click();

    // espera alert/toast com "2 Activities criadas" ou "4 cargas"
    page.on("dialog", async (d) => { await d.accept(); });
    await expect(page.getByText(/2 Activities criadas|4 cargas/)).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 3: Adicionar teste pro TS**

```ts
test.describe("Lançamento rápido — TS/Drenos", () => {
  test("TS + 2 drenos com mesma nomenclatura criam 1 Activity", async ({ page }) => {
    await page.goto("/rodotracker");
    await page.getByText("BR-364 Lote 09").first().click();
    await page.getByRole("button", { name: /medição/i }).click();
    await page.getByRole("button", { name: /lançamento rápido/i }).click();
    await page.getByRole("tab", { name: /troca de solo/i }).click();

    const tsv = [
      "21/05/2026\tTS\tTS99/07\t380\t10\t620.5\tD\t26\t4.8\t0.4",
      "21/05/2026\tDreno\tTS99/07\t380\t10\t620.5\tD\t30\t0.6\t0.5",
      "21/05/2026\tDreno\tTS99/07\t380\t10\t620.5\tD\t25\t0.6\t0.5",
    ].join("\n");

    const firstCell = page.locator("table input").first();
    await firstCell.focus();
    await page.evaluate(([t]) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", t);
      const target = document.activeElement!;
      target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
    }, [tsv]);

    await page.getByRole("button", { name: /salvar tudo/i }).click();
    page.on("dialog", async (d) => { await d.accept(); });
    await expect(page.getByText(/1 Activities criadas|2 drenos/)).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 4: Rodar E2E**

Run: `cd /Users/tiagocameli/projects/Gestao_Obras && npx playwright test tests/quick-entry.spec.ts --reporter=line`
Expected: 2 testes passam.

Se falhar por seletor (rota, label, etc.), ajustar conforme padrão do projeto e re-rodar. Não pular o teste — corrigir até passar.

- [ ] **Step 5: Commit**

```bash
git add tests/quick-entry.spec.ts
git commit -m "test(rodotracker): E2E Playwright para Lançamento rápido CBUQ + TS"
```

---

## Self-Review (verificado durante a escrita)

**Cobertura da spec:**
- §1 Arquitetura geral → Tasks 17, 18 ✅
- §2 Schema → Tasks 1, 2, 3 ✅
- §3 UI CBUQ → Task 15 (grid) + Task 17 (header da aba) ✅
- §4 UI TS → Task 16 + Task 17 (header com categoria) ✅
- §5 Save pipeline → Task 17 (orchestrator) usando Tasks 11, 12 (agrupamento) ✅
- §6 Parsers, paste, atalhos → Tasks 5, 6, 7, 13 ✅
  - **Gap parcial**: atalhos completos (Tab/Enter/setas/Ctrl+D) não implementados nas cells da Task 14. Movido pra fora do escopo inicial — comportamento padrão de `<input>` já cobre Tab; Enter/setas/Ctrl+D são melhoria futura. Se for must-have, adicionar Task 14b antes de fechar. Documentado.
- §7 Testes → Tasks 4–13 (unitários) + Task 19 (E2E) ✅

**Placeholder scan:** zero TBDs. Toda task tem código completo, comandos exatos, expected output. ✅

**Type consistency:**
- `CbuqRow`, `TsRow`, `CrossRowError` definidos na Task 9 e referenciados de forma idêntica nas Tasks 10-12, 15, 16, 17 ✅
- `makeEmptyCbuqRow` / `makeEmptyTsRow` exportadas da Task 15/16 e usadas na Task 17 ✅
- `latLngFromKm` da Task 8 usado na Task 11/12 ✅
- `calcCbuq` e `calcTrocaSolo` — assinatura verificada no Step 4 das Tasks 11/12 (sinalizando ajuste se necessário) ✅
- `Obra`, `Activity`, `CbuqCarga`, `TrocaSoloData` do tipo central — todas as referências usam os mesmos campos ✅

## Notas de execução

- **Ordem das tasks importa**: Task 1 (migration) DEVE rodar antes da Task 3 (mappers) — senão Supabase rejeita o SELECT/INSERT em campos inexistentes em ambientes que ainda não aplicaram a migration. Sinalizar ao usuário no Step 3 da Task 1.
- **Memory do projeto** (`feedback_audit_fix_workflow.md`): aplicar migration direto no projeto Supabase (sem branch), 1 fix por sessão. Task 1 cobre.
- **Memory do projeto** (`feedback_trechos_version_bump.md`): bump v1.x na HomePage — coberto na Task 18 Step 3.
- **Memory do projeto** (`project_gestao_obras_shadcn.md`): novos componentes shadcn vão pra `src/components/shadcn/` — Task 17 Step 2 verifica e cobre.
- **Atalhos avançados** (Tab/Enter/setas/Ctrl+D além do default do navegador): fora do escopo inicial conforme nota acima. Se tornarem-se must-have, criar Task 14b separada.
