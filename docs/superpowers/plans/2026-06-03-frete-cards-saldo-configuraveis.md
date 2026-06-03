# Cards de saldo configuráveis no dashboard de frete — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir, dentro do app, escolher quais fornecedores aparecem como cards de saldo no dashboard de frete (config global no Supabase).

**Architecture:** Tabela singleton `frete_dashboard_cards_config` com um `text[]` de ids de fornecedor, RLS gated em `ver_frete` (sem chave de ação nova). Os 5 cards chumbados viram um `.map()` sobre esse array, casando cada id com `saldosFiltrados.get(id)` (o `transportadora_id` dos movimentos é o próprio `fornecedores.id`). Botão "Gerenciar cards" reusa o `FilterMultiSelect` existente.

**Tech Stack:** Vite + React + TypeScript, Supabase (Postgres + RLS), React Query (@tanstack), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-frete-cards-saldo-configuraveis-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `supabase/migrations/20260603120000_frete_cards_config_fix.sql` | tabela + RLS + seed | Criar |
| `supabase/migrations/20260603120100_frete_cards_config_rollback.sql` | desfazer | Criar |
| `src/utils/freteSaldoCard.ts` | tipo `SaldoAgregado`, `SALDO_ZERO`, `montarLinhasSaldoCard` (pura) | Criar |
| `src/utils/freteSaldoCard.test.ts` | testes da função pura | Criar |
| `src/hooks/useFreteDashboardCards.ts` | ler/salvar o array de ids | Criar |
| `src/hooks/useFreteDashboardCards.test.tsx` | testes do hook | Criar |
| `src/components/frete/FreteDashboard.tsx` | render dinâmico + botão Gerenciar | Modificar |

**Convenção de migration deste repo (do vault):** pares `_fix.sql` / `_rollback.sql`, timestamp do rollback = +100 do fix. Aplicar via MCP Supabase **com confirmação do Tiago**, depois versionar os arquivos locais. Cuidado com o drift conhecido banco x migrations.

---

### Task 1: Função pura `montarLinhasSaldoCard`

Começamos pela peça pura (TDD fácil, sem banco nem React).

**Files:**
- Create: `src/utils/freteSaldoCard.ts`
- Test: `src/utils/freteSaldoCard.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// src/utils/freteSaldoCard.test.ts
import { describe, it, expect } from 'vitest';
import { montarLinhasSaldoCard, SALDO_ZERO } from './freteSaldoCard';

const fmt = (n: number) => n.toFixed(2);

describe('montarLinhasSaldoCard', () => {
  it('mostra Crédito Frete e Pago Frete sempre', () => {
    const linhas = montarLinhasSaldoCard(
      { saldo: 10, creditoFreteTotal: 30, pagoFreteTotal: 20, debitoCombustivelTotal: 0 },
      fmt,
    );
    expect(linhas).toEqual([
      { label: 'Crédito Frete', valor: '+30.00' },
      { label: 'Pago Frete', valor: '−20.00' },
    ]);
  });

  it('inclui Débito Combustível só quando > 0', () => {
    const linhas = montarLinhasSaldoCard(
      { saldo: -5, creditoFreteTotal: 30, pagoFreteTotal: 20, debitoCombustivelTotal: 15 },
      fmt,
    );
    expect(linhas).toHaveLength(3);
    expect(linhas[2]).toEqual({ label: 'Débito Combustível', valor: '−15.00' });
  });

  it('fornecedor sem movimento (SALDO_ZERO) gera só as duas linhas zeradas', () => {
    const linhas = montarLinhasSaldoCard(SALDO_ZERO, fmt);
    expect(linhas).toEqual([
      { label: 'Crédito Frete', valor: '+0.00' },
      { label: 'Pago Frete', valor: '−0.00' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/utils/freteSaldoCard.test.ts`
Expected: FAIL — "Failed to resolve import './freteSaldoCard'".

- [ ] **Step 3: Implementação mínima**

```typescript
// src/utils/freteSaldoCard.ts

/** Agregado de movimentos de uma transportadora dentro do recorte filtrado. */
export interface SaldoAgregado {
  saldo: number;
  creditoFreteTotal: number;
  pagoFreteTotal: number;
  debitoCombustivelTotal: number;
}

/** Agregado vazio pra fornecedor sem nenhum movimento de frete. */
export const SALDO_ZERO: SaldoAgregado = {
  saldo: 0,
  creditoFreteTotal: 0,
  pagoFreteTotal: 0,
  debitoCombustivelTotal: 0,
};

/**
 * Monta as linhas de detalhe de um SaldoCard. O sinal de menos usado é o
 * caractere "−" (U+2212), igual ao resto do dashboard. Débito Combustível só
 * aparece quando há débito (cobre donas de tanque sem hardcode).
 */
export function montarLinhasSaldoCard(
  agg: SaldoAgregado,
  formatCurrency: (n: number) => string,
): { label: string; valor: string }[] {
  const linhas = [
    { label: 'Crédito Frete', valor: `+${formatCurrency(agg.creditoFreteTotal)}` },
    { label: 'Pago Frete', valor: `−${formatCurrency(agg.pagoFreteTotal)}` },
  ];
  if (agg.debitoCombustivelTotal > 0) {
    linhas.push({ label: 'Débito Combustível', valor: `−${formatCurrency(agg.debitoCombustivelTotal)}` });
  }
  return linhas;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/utils/freteSaldoCard.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/utils/freteSaldoCard.ts src/utils/freteSaldoCard.test.ts
git commit -m "feat(frete): funcao pura montarLinhasSaldoCard + SaldoAgregado"
```

---

### Task 2: Migration da tabela de config + RLS + seed

**Files:**
- Create: `supabase/migrations/20260603120000_frete_cards_config_fix.sql`
- Create: `supabase/migrations/20260603120100_frete_cards_config_rollback.sql`

- [ ] **Step 1: Escrever o arquivo `_fix.sql`**

```sql
-- supabase/migrations/20260603120000_frete_cards_config_fix.sql
-- Config global dos cards de saldo do dashboard de frete.
-- Linha única (id='global') com array ordenado de fornecedor_ids.
-- Edição liberada a quem vê o frete (reusa a chave de ação 'ver_frete'):
-- nenhuma chave nova => sem armadilha de backfill de templates.

create table if not exists public.frete_dashboard_cards_config (
  id             text primary key default 'global',
  fornecedor_ids text[] not null default '{}',
  updated_at     timestamptz not null default now(),
  updated_por    text not null default '',
  constraint frete_dashboard_cards_config_singleton check (id = 'global')
);

alter table public.frete_dashboard_cards_config enable row level security;

grant select, insert, update on public.frete_dashboard_cards_config to authenticated;

create policy "frete_cards_config_select"
  on public.frete_dashboard_cards_config for select to authenticated
  using (private.current_has_action('ver_frete'));

create policy "frete_cards_config_insert"
  on public.frete_dashboard_cards_config for insert to authenticated
  with check (private.current_has_action('ver_frete') and id = 'global');

create policy "frete_cards_config_update"
  on public.frete_dashboard_cards_config for update to authenticated
  using (private.current_has_action('ver_frete'))
  with check (private.current_has_action('ver_frete'));

-- Seed: preserva a ordem atual dos 5 cards. Nomes que não casarem são
-- simplesmente ignorados (a migration NÃO falha); podem ser adicionados
-- depois pelo seletor "Gerenciar cards".
insert into public.frete_dashboard_cards_config (id, fornecedor_ids)
select 'global', coalesce(array(
  select f.id
  from (values
    ('areacre', 1),
    ('transportadora triunfo', 2),
    ('andrade transporte', 3),
    ('etam construtora', 4),
    ('emt transportes', 5)
  ) as ord(nome, pos)
  join public.fornecedores f on lower(trim(f.nome)) = ord.nome
  order by ord.pos
), '{}'::text[])
on conflict (id) do nothing;
```

- [ ] **Step 2: Escrever o arquivo `_rollback.sql`**

```sql
-- supabase/migrations/20260603120100_frete_cards_config_rollback.sql
drop table if exists public.frete_dashboard_cards_config;
```

- [ ] **Step 3: Aplicar a migration (com confirmação do Tiago)**

Aplicar via MCP Supabase no projeto `gunyitwrbxbmnezokgjq` (carregar a tool com `ToolSearch("select:mcp__...apply_migration")` antes). **Confirmar com o Tiago antes de rodar** (escrita no banco). Conteúdo = o do `_fix.sql`.

- [ ] **Step 4: Verificar o seed no banco**

Rodar (via MCP `execute_sql`):
```sql
select id, fornecedor_ids, array_length(fornecedor_ids, 1) as qtd
from public.frete_dashboard_cards_config;
```
Expected: 1 linha, `id='global'`, `qtd` entre 1 e 5 (idealmente 5, se os 5 nomes casarem). Se vier menos, anotar quais nomes não casaram (serão adicionáveis pelo seletor depois).

- [ ] **Step 5: Commit dos arquivos de migration**

```bash
git add supabase/migrations/20260603120000_frete_cards_config_fix.sql \
        supabase/migrations/20260603120100_frete_cards_config_rollback.sql
git commit -m "feat(frete): migration config global dos cards de saldo (RLS ver_frete)"
```

---

### Task 3: Hook `useFreteDashboardCards` (ler + salvar)

**Files:**
- Create: `src/hooks/useFreteDashboardCards.ts`
- Test: `src/hooks/useFreteDashboardCards.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// src/hooks/useFreteDashboardCards.test.tsx
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ usuario: { funcionarioId: 'func-1' } }),
}));

import { useFreteDashboardCards, useSalvarFreteDashboardCards } from './useFreteDashboardCards';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as Mock;

/** Monta from().select().eq().maybeSingle() resolvendo em `result`. */
function mockSelectChain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ select });
  return { select, eq, maybeSingle };
}

/** Monta from().update().eq().select() resolvendo em `result`. */
function mockUpdateChain(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ update });
  return { update, eq, select };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe('useFreteDashboardCards', () => {
  it('retorna o array fornecedor_ids da linha global', async () => {
    mockSelectChain({ data: { fornecedor_ids: ['a', 'b'] }, error: null });
    const { result } = renderHook(() => useFreteDashboardCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['a', 'b']);
  });

  it('retorna [] quando não há linha', async () => {
    mockSelectChain({ data: null, error: null });
    const { result } = renderHook(() => useFreteDashboardCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useSalvarFreteDashboardCards', () => {
  it('salva e resolve quando 1 linha é alterada', async () => {
    const { update } = mockUpdateChain({ data: [{ id: 'global' }], error: null });
    const { result } = renderHook(() => useSalvarFreteDashboardCards(), { wrapper });
    await expect(result.current.mutateAsync(['x', 'y'])).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ fornecedor_ids: ['x', 'y'], updated_por: 'func-1' }),
    );
  });

  it('lança erro quando 0 linhas (RLS rejeitou em silêncio)', async () => {
    mockUpdateChain({ data: [], error: null });
    const { result } = renderHook(() => useSalvarFreteDashboardCards(), { wrapper });
    await expect(result.current.mutateAsync(['x'])).rejects.toThrow(/permiss|linha/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useFreteDashboardCards.test.tsx`
Expected: FAIL — "Failed to resolve import './useFreteDashboardCards'".

- [ ] **Step 3: Implementar o hook**

```typescript
// src/hooks/useFreteDashboardCards.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const QUERY_KEY = ['frete-dashboard-cards'] as const;
const TABELA = 'frete_dashboard_cards_config';
const ID_GLOBAL = 'global';

/** Lê o array ordenado de fornecedor_ids que devem virar card de saldo. */
export function useFreteDashboardCards() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from(TABELA)
        .select('fornecedor_ids')
        .eq('id', ID_GLOBAL)
        .maybeSingle();
      if (error) throw error;
      return (data?.fornecedor_ids ?? []) as string[];
    },
  });
}

/** Salva o array de fornecedor_ids na config global (uma linha só). */
export function useSalvarFreteDashboardCards() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (fornecedorIds: string[]) => {
      // `.select()` + checagem de 0 linhas: se o RLS bloquear, o Supabase
      // devolve sucesso com 0 linhas. Tratamos como falha explícita.
      const { data, error } = await supabase
        .from(TABELA)
        .update({
          fornecedor_ids: fornecedorIds,
          updated_at: new Date().toISOString(),
          updated_por: usuario?.funcionarioId ?? '',
        })
        .eq('id', ID_GLOBAL)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'Não foi possível salvar os cards: você não tem permissão (nenhuma linha foi alterada).',
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/hooks/useFreteDashboardCards.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFreteDashboardCards.ts src/hooks/useFreteDashboardCards.test.tsx
git commit -m "feat(frete): hook useFreteDashboardCards (ler/salvar config global)"
```

---

### Task 4: Render dinâmico + botão "Gerenciar cards" no FreteDashboard

Integração. Não há teste unitário novo (a lógica testável já está nas Tasks 1 e 3); validação por `tsc`/build + smoke manual.

**Files:**
- Modify: `src/components/frete/FreteDashboard.tsx`

- [ ] **Step 1: Adicionar imports no topo do arquivo**

Adicionar (se algum já existir, não duplicar):
```typescript
import { useFornecedores } from '../../hooks/useFornecedores';
import { useFreteDashboardCards, useSalvarFreteDashboardCards } from '../../hooks/useFreteDashboardCards';
import { montarLinhasSaldoCard, SALDO_ZERO } from '../../utils/freteSaldoCard';
```
(Ajustar a profundidade `../` conforme o arquivo; `FreteDashboard.tsx` está em `src/components/frete/`, então `../../hooks` e `../../utils`.)

- [ ] **Step 2: Adicionar estado e dados dentro do componente**

Logo após os outros hooks/`useMemo` de saldo (perto da linha ~480, depois de `saldosFiltrados`), inserir:
```typescript
const { data: fornecedorIds = [] } = useFreteDashboardCards();
const salvarCards = useSalvarFreteDashboardCards();
const { data: fornecedores = [] } = useFornecedores();
const fornecedorById = useMemo(() => {
  const m = new Map<string, (typeof fornecedores)[number]>();
  for (const f of fornecedores) m.set(f.id, f);
  return m;
}, [fornecedores]);

const [gerenciarOpen, setGerenciarOpen] = useState(false);
const [draftIds, setDraftIds] = useState<string[]>([]);
```
(`useState`/`useMemo` já são importados no arquivo. Se `useFornecedores` já estava em uso, reaproveitar a variável existente em vez de redeclarar.)

- [ ] **Step 3: Remover os consts chumbados dos 5 fornecedores**

Apagar o bloco das linhas ~482-502 (`const sAreacre = ...` até `const saldoEmtTransportes = ...`, incluindo `aggOf`, `aAreacre..aEmtTransportes`, `saldoAreacre..saldoEmtTransportes`). O render dinâmico usa `saldosFiltrados.get(id)` direto.

Atenção: se o `tsc` no Step 6 acusar que alguma dessas variáveis ainda é usada em outro ponto (ex.: algum KPI), **mantenha apenas a(s) usada(s)** e remova o resto. `saldosFiltrados` e `saldoByNome` continuam — não apagar.

- [ ] **Step 4: Substituir o grid de cards chumbado pelo dinâmico**

Trocar todo o bloco JSX das linhas ~1106-1153 (a `<div className="grid ...">` com os 5 `<SaldoCard>`) por:
```tsx
<div className="flex items-center justify-between gap-2 mb-3">
  <h2 className="text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">Saldos</h2>
  <div className="flex items-center gap-2">
    {gerenciarOpen && (
      <>
        <FilterMultiSelect
          options={fornecedores.map((f) => ({
            id: f.id,
            label: f.ehTransportadora ? f.nome : `${f.nome} (sem frete)`,
          }))}
          selected={draftIds}
          onChange={setDraftIds}
          placeholder="Selecionar fornecedores"
        />
        <button
          type="button"
          disabled={salvarCards.isPending}
          onClick={() => salvarCards.mutate(draftIds, { onSuccess: () => setGerenciarOpen(false) })}
          className="rounded-md px-3 py-1 text-xs font-medium bg-[var(--color-accent)] text-white disabled:opacity-60"
        >
          {salvarCards.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </>
    )}
    <button
      type="button"
      onClick={() => { setDraftIds(fornecedorIds); setGerenciarOpen((o) => !o); }}
      className="rounded-md px-3 py-1 text-xs font-medium border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]"
    >
      {gerenciarOpen ? 'Fechar' : 'Gerenciar cards'}
    </button>
  </div>
</div>
{salvarCards.isError && (
  <p className="text-xs text-red-600 mb-2">{(salvarCards.error as Error).message}</p>
)}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
  {fornecedorIds.map((id) => {
    const f = fornecedorById.get(id);
    if (!f) return null;
    const agg = saldosFiltrados.get(id) ?? SALDO_ZERO;
    return (
      <SaldoCard
        key={id}
        titulo={`Saldo ${f.nome}`}
        saldo={agg.saldo}
        linhas={montarLinhasSaldoCard(agg, formatCurrency)}
        onClick={onVerContaCorrente}
      />
    );
  })}
</div>
```
Notas:
- `FilterMultiSelect`, `SaldoCard`, `formatCurrency` e `onVerContaCorrente` já existem no arquivo.
- `saldosFiltrados` é `Map<transportadoraId, {saldo, creditoFreteTotal, pagoFreteTotal, debitoCombustivelTotal}>` e `transportadoraId === fornecedor.id`, por isso `.get(id)` funciona direto.
- Fornecedor sem movimento → `SALDO_ZERO` → card R$ 0,00 (cinza).

- [ ] **Step 5: Lint/typecheck**

Run: `npm run lint`
Expected: sem erros novos no `FreteDashboard.tsx` (corrigir imports/variáveis não usadas se aparecer).

- [ ] **Step 6: Build (typecheck completo)**

Run: `npm run build`
Expected: build OK. Se o `tsc` reclamar de variável chumbada removida no Step 3 ainda referenciada em outro lugar, reavaliar conforme a nota do Step 3.

- [ ] **Step 7: Commit**

```bash
git add src/components/frete/FreteDashboard.tsx
git commit -m "feat(frete): cards de saldo dinamicos + botao Gerenciar cards"
```

---

### Task 5: Verificação final

- [ ] **Step 1: Suíte de testes do que mexemos**

Run: `npx vitest run src/utils/freteSaldoCard.test.ts src/hooks/useFreteDashboardCards.test.tsx`
Expected: todos PASS.

- [ ] **Step 2: Smoke manual no app**

Run: `npm run dev`, abrir o dashboard de frete logado como usuário com `ver_frete`.
Conferir:
- Os 5 cards aparecem iguais a antes (Areacre, Triunfo, Andrade, ETAM, EMT Transportes), na mesma ordem, com os mesmos valores (Débito Combustível só onde havia).
- Clicar "Gerenciar cards", desmarcar um fornecedor, "Salvar" → o card some. Marcar um fornecedor novo (inclusive um "(sem frete)") → aparece (zerado se sem frete). Recarregar a página → a seleção persiste (veio do banco).
- Clicar num card ainda abre a conta corrente (`onVerContaCorrente`).

- [ ] **Step 3: Confirmar com o Tiago e decidir merge**

Apresentar o resultado. Branch: `feature/frete-cards-saldo-configuraveis`. Decidir merge/PR com o Tiago (não mergear sem ok).

---

## Notas de risco

- **Drift migrations:** este repo tem drift conhecido banco x arquivos. A migration é aplicada via MCP; versionar o arquivo local no par fix/rollback e não assumir que o histórico remoto bate 1:1.
- **`ver_frete` como gate de escrita:** decisão de produto (qualquer um que vê frete edita a config global). Se um dia quiser restringir, criar chave dedicada `gerenciar_cards_frete` + **migration de backfill por cargo** (armadilha já documentada no vault).
- **Write storm:** salvar só no botão "Salvar" (não a cada checkbox) já evita escrita repetida na linha singleton.
