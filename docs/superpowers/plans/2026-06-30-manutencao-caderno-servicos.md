# Manutenção — Caderno de Serviços — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o módulo Manutenção num caderno de registro de serviços por equipamento, com peças, terceiros e trocas de óleo, padronizado para relatórios.

**Architecture:** Evolui a tabela `ordens_servico` existente (vira "Serviço de Manutenção"), reusando máquina/número/data/horímetro/fotos/soma de custos. Adiciona tabelas filhas `os_terceiros` e `os_oleos` + tabela de apoio `tipos_oleo`, com somas via trigger e `custo_total` gerado sobre peças+terceiros+óleos. Remove planos preventivos, agenda, checklists, mão de obra e o fluxo de status. Espec: `docs/superpowers/specs/2026-06-30-manutencao-caderno-servicos-design.md`.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + RLS via `private.current_has_action()`), React Query, Vitest (unit), Playwright (E2E), exceljs (Excel), helpers de PDF da marca.

## Global Constraints

- Toda mudança de schema é uma migration versionada em par `_fix.sql` / `_rollback.sql` (rollback com timestamp +100), aplicada via MCP `apply_migration` com o `.sql` escrito no repo. Migrations idempotentes (`IF EXISTS` / `IF NOT EXISTS`).
- RLS em toda tabela nova: policies gated em `private.current_has_action('<chave>')`. Grants explícitos. Nada de schema sem migration.
- Chave de ação nova → escrever migration de backfill por cargo (armadilha conhecida: templates não fazem backfill em usuários existentes). Modelo: `supabase/migrations/20260528210000_engenharia_backfill_acoes_por_cargo_fix.sql`.
- IDs `text` (padrão do projeto, ex. nanoid no app), não uuid no app-layer; colunas `numeric(14,2)` para dinheiro; datas `timestamptz`/`date` ancoradas no fuso de Rio Branco.
- Hooks de mutação usam `.select()` e lançam erro quando 0 linhas (pega RLS silencioso). Padrão em `src/hooks/useOrdensServico.ts`.
- Branch de trabalho: `feat/manutencao-caderno-servicos`. Commits frequentes. Push só com ok do Tiago (deploy Vercel é no push da main). Migration no banco só com ok do Tiago.
- `npx tsc -b`, `npx eslint <arquivos tocados>`, `npx vitest run` limpos antes de cada commit de fechamento de fase. Os 12 testes pré-existentes de `src/utils/fifoCombustivel.test.ts` são dívida velha e seguem falhando — não conta como regressão.

---

## FASE 1 — Banco: novas tabelas, óleo, rollup de custo (aditivo, não quebra nada)

### Task 1.1: Tabela de tipos de óleo (`tipos_oleo`) + seed

**Files:**
- Create: `supabase/migrations/20260701100000_tipos_oleo_fix.sql`
- Create: `supabase/migrations/20260701100100_tipos_oleo_rollback.sql`

**Interfaces:**
- Produces: tabela `public.tipos_oleo(id text pk, nome text, aplicacao text, intervalo_meses int null, ativo bool, created_at, created_by)`; chave de ação `gerenciar_tipos_oleo`.

- [ ] **Step 1: Escrever a migration `_fix.sql`**

```sql
-- Tipos de óleo (apoio do caderno de serviços). Cada tipo carrega o intervalo
-- de troca em meses (null = sem alerta). Alerta de troca é por (equipamento, tipo).
CREATE TABLE IF NOT EXISTS public.tipos_oleo (
  id            text PRIMARY KEY,
  nome          text NOT NULL,
  aplicacao     text NOT NULL CHECK (aplicacao IN ('motor','hidraulico','transmissao','diferencial','graxa','outro')),
  intervalo_meses int CHECK (intervalo_meses IS NULL OR intervalo_meses > 0),
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text
);
ALTER TABLE public.tipos_oleo ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipos_oleo_select ON public.tipos_oleo FOR SELECT
  USING (private.current_has_action('ver_manutencao'));
CREATE POLICY tipos_oleo_insert ON public.tipos_oleo FOR INSERT
  WITH CHECK (private.current_has_action('gerenciar_tipos_oleo'));
CREATE POLICY tipos_oleo_update ON public.tipos_oleo FOR UPDATE
  USING (private.current_has_action('gerenciar_tipos_oleo'));
CREATE POLICY tipos_oleo_delete ON public.tipos_oleo FOR DELETE
  USING (private.current_has_action('gerenciar_tipos_oleo'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_oleo TO authenticated;

INSERT INTO public.tipos_oleo (id, nome, aplicacao, intervalo_meses) VALUES
  ('toleo_motor_15w40', 'Óleo de Motor 15W40', 'motor', 6),
  ('toleo_hidraulico_68', 'Óleo Hidráulico 68', 'hidraulico', 12),
  ('toleo_transmissao_85w140', 'Óleo de Transmissão 85W140', 'transmissao', 12),
  ('toleo_diferencial', 'Óleo de Diferencial', 'diferencial', 12),
  ('toleo_atf', 'ATF (transmissão automática)', 'transmissao', 12),
  ('toleo_graxa', 'Graxa', 'graxa', NULL)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Escrever o `_rollback.sql`**

```sql
DROP TABLE IF EXISTS public.tipos_oleo CASCADE;
```

- [ ] **Step 3: Aplicar via MCP (com ok do Tiago)**

`apply_migration(project_id='gunyitwrbxbmnezokgjq', name='tipos_oleo', query=<conteúdo do _fix>)`.

- [ ] **Step 4: Verificar no banco**

Run (execute_sql): `SELECT count(*) FROM tipos_oleo;`
Expected: `6`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260701100000_tipos_oleo_fix.sql supabase/migrations/20260701100100_tipos_oleo_rollback.sql
git commit -m "feat(manutencao): tabela tipos_oleo + seed (6 tipos)"
```

---

### Task 1.2: Tabelas `os_terceiros` e `os_oleos` + colunas de custo + rollup

**Files:**
- Create: `supabase/migrations/20260701110000_os_terceiros_oleos_fix.sql`
- Create: `supabase/migrations/20260701110100_os_terceiros_oleos_rollback.sql`

**Interfaces:**
- Consumes: `tipos_oleo` (Task 1.1), `ordens_servico` (existente).
- Produces: tabelas `os_terceiros`, `os_oleos`; colunas `ordens_servico.custo_terceiros`, `ordens_servico.custo_oleos`; `custo_total` regenerado = `custo_pecas + custo_terceiros + custo_oleos`; triggers de soma.

- [ ] **Step 1: Escrever o `_fix.sql`**

```sql
-- (a) Colunas de custo novas + regeneração do custo_total (sai mão de obra da soma)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS custo_terceiros numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS custo_oleos numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_total;
ALTER TABLE public.ordens_servico ADD COLUMN custo_total numeric(14,2)
  GENERATED ALWAYS AS (coalesce(custo_pecas,0) + coalesce(custo_terceiros,0) + coalesce(custo_oleos,0)) STORED;

-- (b) Expande o CHECK de tipo (preserva os antigos)
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_tipo_check;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_tipo_check
  CHECK (tipo IN ('preventiva','corretiva','preditiva','melhoria','garantia','recall',
                  'troca_oleo','lubrificacao','pneu','solda','eletrica','revisao_geral','outro'));

-- (c) os_terceiros
CREATE TABLE IF NOT EXISTS public.os_terceiros (
  id          text PRIMARY KEY,
  os_id       text NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  prestador   text NOT NULL,
  descricao   text NOT NULL DEFAULT '',
  valor       numeric(14,2) NOT NULL CHECK (valor >= 0),
  nota_fiscal text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text
);
CREATE INDEX IF NOT EXISTS idx_os_terceiros_os ON public.os_terceiros(os_id);
ALTER TABLE public.os_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_terceiros_select ON public.os_terceiros FOR SELECT USING (private.current_has_action('ver_manutencao'));
CREATE POLICY os_terceiros_insert ON public.os_terceiros FOR INSERT WITH CHECK (private.current_has_action('adicionar_terceiro_os'));
CREATE POLICY os_terceiros_update ON public.os_terceiros FOR UPDATE USING (private.current_has_action('adicionar_terceiro_os'));
CREATE POLICY os_terceiros_delete ON public.os_terceiros FOR DELETE USING (private.current_has_action('adicionar_terceiro_os'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_terceiros TO authenticated;

-- (d) os_oleos
CREATE TABLE IF NOT EXISTS public.os_oleos (
  id             text PRIMARY KEY,
  os_id          text NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo_oleo_id   text NOT NULL REFERENCES public.tipos_oleo(id),
  quantidade     numeric NOT NULL CHECK (quantidade > 0),
  unidade        text NOT NULL DEFAULT 'L' CHECK (unidade IN ('L','kg')),
  valor_unitario numeric(14,2) NOT NULL CHECK (valor_unitario >= 0),
  valor_total    numeric(14,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     text
);
CREATE INDEX IF NOT EXISTS idx_os_oleos_os ON public.os_oleos(os_id);
CREATE INDEX IF NOT EXISTS idx_os_oleos_tipo ON public.os_oleos(tipo_oleo_id);
ALTER TABLE public.os_oleos ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_oleos_select ON public.os_oleos FOR SELECT USING (private.current_has_action('ver_manutencao'));
CREATE POLICY os_oleos_insert ON public.os_oleos FOR INSERT WITH CHECK (private.current_has_action('adicionar_oleo_os'));
CREATE POLICY os_oleos_update ON public.os_oleos FOR UPDATE USING (private.current_has_action('adicionar_oleo_os'));
CREATE POLICY os_oleos_delete ON public.os_oleos FOR DELETE USING (private.current_has_action('adicionar_oleo_os'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_oleos TO authenticated;

-- (e) Trigger de soma: terceiros -> ordens_servico.custo_terceiros
CREATE OR REPLACE FUNCTION public.os_recalc_custo_terceiros() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_os text;
BEGIN
  v_os := COALESCE(NEW.os_id, OLD.os_id);
  UPDATE public.ordens_servico SET custo_terceiros = (
    SELECT COALESCE(sum(valor),0) FROM public.os_terceiros WHERE os_id = v_os
  ) WHERE id = v_os;
  RETURN NULL;
END $$;
CREATE TRIGGER tg_os_terceiros_soma AFTER INSERT OR UPDATE OR DELETE ON public.os_terceiros
  FOR EACH ROW EXECUTE FUNCTION public.os_recalc_custo_terceiros();

-- (f) Trigger de soma: óleos -> ordens_servico.custo_oleos
CREATE OR REPLACE FUNCTION public.os_recalc_custo_oleos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_os text;
BEGIN
  v_os := COALESCE(NEW.os_id, OLD.os_id);
  UPDATE public.ordens_servico SET custo_oleos = (
    SELECT COALESCE(sum(valor_total),0) FROM public.os_oleos WHERE os_id = v_os
  ) WHERE id = v_os;
  RETURN NULL;
END $$;
CREATE TRIGGER tg_os_oleos_soma AFTER INSERT OR UPDATE OR DELETE ON public.os_oleos
  FOR EACH ROW EXECUTE FUNCTION public.os_recalc_custo_oleos();
```

- [ ] **Step 2: Escrever o `_rollback.sql`**

```sql
DROP TRIGGER IF EXISTS tg_os_oleos_soma ON public.os_oleos;
DROP TRIGGER IF EXISTS tg_os_terceiros_soma ON public.os_terceiros;
DROP FUNCTION IF EXISTS public.os_recalc_custo_oleos() CASCADE;
DROP FUNCTION IF EXISTS public.os_recalc_custo_terceiros() CASCADE;
DROP TABLE IF EXISTS public.os_oleos CASCADE;
DROP TABLE IF EXISTS public.os_terceiros CASCADE;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_total;
ALTER TABLE public.ordens_servico ADD COLUMN custo_total numeric(14,2)
  GENERATED ALWAYS AS (coalesce(custo_pecas,0)+coalesce(custo_servico_terceiro,0)+coalesce(custo_mao_obra_propria,0)) STORED;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_oleos;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_terceiros;
-- (não reverte o CHECK de tipo: manter o ampliado é inofensivo)
```

- [ ] **Step 3: Aplicar via MCP (com ok do Tiago) e verificar**

Run (execute_sql): inserir um terceiro de teste numa OS existente e conferir `custo_terceiros` e `custo_total`. Expected: soma reflete.
```sql
-- usar o id da OS de teste existente
INSERT INTO os_terceiros (id,os_id,prestador,valor) VALUES ('tst_terc','<os_id>','Oficina X',500);
SELECT custo_terceiros, custo_total FROM ordens_servico WHERE id='<os_id>';
DELETE FROM os_terceiros WHERE id='tst_terc';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701110000_os_terceiros_oleos_fix.sql supabase/migrations/20260701110100_os_terceiros_oleos_rollback.sql
git commit -m "feat(manutencao): os_terceiros + os_oleos + rollup de custo (peças+terceiros+óleos)"
```

---

### Task 1.3: View `v_oleos_vencendo` (alerta por equipamento+tipo, por data)

**Files:**
- Create: `supabase/migrations/20260701120000_v_oleos_vencendo_fix.sql`
- Create: `supabase/migrations/20260701120100_v_oleos_vencendo_rollback.sql`

**Interfaces:**
- Consumes: `os_oleos`, `tipos_oleo`, `ordens_servico` (data via `data_abertura`), `equipamentos`.
- Produces: view `public.v_oleos_vencendo(equipamento_id, equipamento_nome, tipo_oleo_id, tipo_oleo_nome, aplicacao, ultima_troca date, intervalo_meses, data_vencimento date, dias_para_vencer int, situacao text)`.

- [ ] **Step 1: Escrever o `_fix.sql`**

```sql
CREATE OR REPLACE VIEW public.v_oleos_vencendo AS
WITH ultima AS (
  SELECT o.tipo_oleo_id,
         os.equipamento_id,
         max(os.data_abertura::date) AS ultima_troca
  FROM public.os_oleos o
  JOIN public.ordens_servico os ON os.id = o.os_id AND os.deleted_at IS NULL
  GROUP BY o.tipo_oleo_id, os.equipamento_id
)
SELECT u.equipamento_id,
       e.nome AS equipamento_nome,
       u.tipo_oleo_id,
       t.nome AS tipo_oleo_nome,
       t.aplicacao,
       u.ultima_troca,
       t.intervalo_meses,
       (u.ultima_troca + make_interval(months => t.intervalo_meses))::date AS data_vencimento,
       ((u.ultima_troca + make_interval(months => t.intervalo_meses))::date - CURRENT_DATE) AS dias_para_vencer,
       CASE
         WHEN (u.ultima_troca + make_interval(months => t.intervalo_meses))::date < CURRENT_DATE THEN 'vencido'
         WHEN (u.ultima_troca + make_interval(months => t.intervalo_meses))::date <= CURRENT_DATE + 30 THEN 'a_vencer'
         ELSE 'ok'
       END AS situacao
FROM ultima u
JOIN public.tipos_oleo t ON t.id = u.tipo_oleo_id
JOIN public.equipamentos e ON e.id = u.equipamento_id
WHERE t.intervalo_meses IS NOT NULL;

GRANT SELECT ON public.v_oleos_vencendo TO authenticated;
```
(Nota: confirmar o nome da coluna de nome do equipamento em `equipamentos` — usar `e.nome` ou o que existir; checar com `\d equipamentos` antes.)

- [ ] **Step 2: Escrever o `_rollback.sql`**

```sql
DROP VIEW IF EXISTS public.v_oleos_vencendo;
```

- [ ] **Step 3: Aplicar via MCP e verificar**

Run: `SELECT * FROM v_oleos_vencendo LIMIT 5;` Expected: roda sem erro (vazio é ok se não houver óleo lançado).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701120000_v_oleos_vencendo_fix.sql supabase/migrations/20260701120100_v_oleos_vencendo_rollback.sql
git commit -m "feat(manutencao): view v_oleos_vencendo (alerta de troca por equipamento+tipo)"
```

---

### Task 1.4: Permissões novas + backfill

**Files:**
- Modify: `src/utils/permissions.ts` (grupo Manutenção em ACOES_PLATAFORMA, DEPENDENCIAS_ACOES, templates)
- Create: `supabase/migrations/20260701130000_manutencao_caderno_backfill_fix.sql`
- Create: `supabase/migrations/20260701130100_manutencao_caderno_backfill_rollback.sql`
- Test: `src/utils/permissions.caderno.test.ts`

**Interfaces:**
- Produces: chaves `adicionar_terceiro_os`, `adicionar_oleo_os`, `gerenciar_tipos_oleo` no grupo 'Manutenção', com dependências em `ver_manutencao`.

- [ ] **Step 1: Escrever o teste (Vitest)**

```ts
import { describe, it, expect } from 'vitest';
import { ACOES_PLATAFORMA, DEPENDENCIAS_ACOES, acoesPadraoDoCargo } from './permissions';

describe('permissões caderno de manutenção', () => {
  const novas = ['adicionar_terceiro_os','adicionar_oleo_os','gerenciar_tipos_oleo'];
  it('as 3 chaves existem no grupo Manutenção', () => {
    for (const c of novas) {
      const a = ACOES_PLATAFORMA.find(x => x.chave === c);
      expect(a, c).toBeTruthy();
      expect(a!.grupo).toBe('Manutenção');
    }
  });
  it('dependem de ver_manutencao', () => {
    for (const c of novas) expect(DEPENDENCIAS_ACOES[c]).toContain('ver_manutencao');
  });
  it('Administrador recebe as 3', () => {
    const a = acoesPadraoDoCargo('Administrador');
    for (const c of novas) expect(a).toContain(c);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/utils/permissions.caderno.test.ts` → FAIL.

- [ ] **Step 3: Adicionar as chaves em `ACOES_PLATAFORMA`** (no grupo Manutenção, junto de `adicionar_peca_os`):

```ts
  { chave: 'adicionar_terceiro_os', label: 'Adicionar serviço de terceiro à OS', grupo: 'Manutenção' },
  { chave: 'adicionar_oleo_os', label: 'Adicionar troca de óleo à OS', grupo: 'Manutenção' },
  { chave: 'gerenciar_tipos_oleo', label: 'Gerenciar tipos de óleo', grupo: 'Manutenção' },
```
E em `DEPENDENCIAS_ACOES` (bloco Manutenção):
```ts
  adicionar_terceiro_os: ['ver_manutencao'],
  adicionar_oleo_os: ['ver_manutencao'],
  gerenciar_tipos_oleo: ['ver_manutencao'],
```
Admin já pega tudo via `TODAS_ACOES_PLATAFORMA`. Adicionar as 3 aos templates que hoje têm `adicionar_peca_os` (ex.: Gerente, Supervisor) para paridade.

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/utils/permissions.caderno.test.ts` → PASS.

- [ ] **Step 5: Migration de backfill** (`_fix.sql`) — concede as 3 chaves a quem já tem `adicionar_peca_os`:

```sql
UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT array(SELECT DISTINCT unnest(acoes_permitidas || ARRAY['adicionar_terceiro_os','adicionar_oleo_os','gerenciar_tipos_oleo']))
)
WHERE 'adicionar_peca_os' = ANY(acoes_permitidas);
```
`_rollback.sql`: remove as 3 chaves dos arrays (filtro `<> ALL`).

- [ ] **Step 6: Aplicar backfill via MCP (com ok) e commit**

```bash
git add src/utils/permissions.ts src/utils/permissions.caderno.test.ts supabase/migrations/20260701130000_manutencao_caderno_backfill_fix.sql supabase/migrations/20260701130100_manutencao_caderno_backfill_rollback.sql
git commit -m "feat(manutencao): chaves adicionar_terceiro_os/adicionar_oleo_os/gerenciar_tipos_oleo + backfill"
```

---

## FASE 2 — UI do caderno

> Tipos TS: adicionar em `src/types/index.ts` as interfaces `OSTerceiro`, `OSOleo`, `TipoOleo` (espelhando as colunas das tabelas). Atualizar `OrdemServico` com `custoTerceiros`, `custoOleos` e o `tipo` ampliado. Camada de dados: gerar tipos via `npx supabase gen types` se o projeto usa, senão manter manual (seguir o padrão atual do arquivo).

### Task 2.1: Hooks de dados (terceiros, óleos, tipos de óleo)

**Files:**
- Create: `src/hooks/useOSTerceiros.ts`, `src/hooks/useOSOleos.ts`, `src/hooks/useTiposOleo.ts`
- Modify: `src/types/index.ts` (interfaces novas)
- Test: `src/hooks/useOSTerceiros.test.tsx`

**Interfaces:**
- Produces:
  - `useTerceirosOS(osId): {data: OSTerceiro[]}`; `useAdicionarTerceiroOS()`, `useExcluirTerceiroOS()`.
  - `useOleosOS(osId)`; `useAdicionarOleoOS()`, `useExcluirOleoOS()`.
  - `useTiposOleo()`, `useCriarTipoOleo()`, `useAtualizarTipoOleo()`, `useExcluirTipoOleo()`.
  - `useOleosVencendo(): {data: OleoVencendo[]}` (lê a view).

- [ ] **Step 1: Escrever teste do hook de mutação** (espelha `src/hooks/useTransferenciasCombustivel.test.tsx`): mock do supabase, garante que `useAdicionarTerceiroOS` faz `.insert().select()` e lança erro em 0 linhas. (Código completo do teste seguindo o arquivo-modelo citado.)
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar os hooks** seguindo exatamente o padrão de `src/hooks/useOrdensServico.ts` (`useAdicionarPecaOS`/`useExcluirPecaOS` são o molde): `.insert(...).select()`, lança erro se 0 linhas, invalida as queries `['os', osId]`, `['os-terceiros', osId]`/`['os-oleos', osId]` e `['oleos-vencendo']`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(manutencao): hooks de terceiros, óleos e tipos de óleo`.

---

### Task 2.2: Modais "Adicionar Terceiro" e "Adicionar Óleo"

**Files:**
- Create: `src/components/manutencao/os/AdicionarTerceiroOSModal.tsx`
- Create: `src/components/manutencao/os/AdicionarOleoOSModal.tsx`

**Interfaces:**
- Consumes: hooks da Task 2.1; `useTiposOleo` para o select de óleo.
- Produces: componentes default-export `({ osId, onClose }) => JSX`.

- [ ] **Step 1: `AdicionarTerceiroOSModal`** — espelhar `AdicionarPecaOSModal.tsx`. Campos: prestador (texto), descrição (texto), valor (number), nota fiscal (texto, opcional). Valida valor ≥ 0. Submit chama `useAdicionarTerceiroOS`.
- [ ] **Step 2: `AdicionarOleoOSModal`** — campos: tipo de óleo (select de `useTiposOleo`, só ativos), quantidade (number), unidade (L/kg), valor unitário (number). Mostra **total ao vivo** = qtd × unit (espelhar o preview de `AdicionarPecaOSModal`). Submit chama `useAdicionarOleoOS`.
- [ ] **Step 3: Verificação manual** — abrir os modais numa OS de teste, lançar 1 terceiro e 1 óleo, conferir que aparecem e somam.
- [ ] **Step 4: Commit** `feat(manutencao): modais de terceiro e óleo na OS`.

---

### Task 2.3: Detalhe do serviço com as 3 seções + tirar status/mão de obra da UI

**Files:**
- Modify: `src/components/manutencao/os/OSDetalhe.tsx`
- Modify: `src/components/manutencao/Manutencao.tsx` / router (rótulos "Serviço")

**Interfaces:**
- Consumes: hooks 2.1, modais 2.2.

- [ ] **Step 1:** Em `OSDetalhe.tsx`, adicionar duas tabelas novas (Terceiros, Óleos) espelhando a tabela de Peças existente, cada uma com botão de adicionar (abre o modal) e de excluir linha. Mostrar `custoTerceiros` e `custoOleos` na seção Custos, e o `custoTotal` já somando os três.
- [ ] **Step 2:** Remover da UI (não do banco ainda): seção/timeline de status, botões de mudar status/aprovar/cancelar, e a seção de Mão de Obra + seu modal. (DB sai na Fase 4.)
- [ ] **Step 3:** Renomear rótulos visíveis de "Ordem de Serviço/OS" para "Serviço" onde fizer sentido (mantém `numero` como identificador).
- [ ] **Step 4: Verificação manual** — detalhe mostra Peças+Terceiros+Óleos, total correto, sem status/mão de obra. tsc + build limpos.
- [ ] **Step 5: Commit** `feat(manutencao): detalhe do serviço com peças/terceiros/óleos, sem status/mão de obra`.

---

### Task 2.4: Tela de registro de serviço + lista (caderno)

**Files:**
- Modify: `NovaOSModal.tsx` → vira "Registrar serviço" (ou novo `RegistrarServicoModal.tsx`)
- Modify: a lista de OS (`OrdensServicoPage` dentro de `Manutencao.tsx`)

- [ ] **Step 1:** Form de registro: máquina (select equipamentos), data, **tipo** (novo enum completo), horímetro/km, descrição, depois as 3 seções (reusar os modais/edição inline). Status fixo `concluida` por baixo dos panos (não exibido).
- [ ] **Step 2:** Lista "caderno": colunas máquina, data, tipo, custo total; filtros por máquina, período e tipo. Tirar filtros de status. Rodapé com total do período.
- [ ] **Step 3: Verificação manual** — registrar um serviço completo do zero (peça + terceiro + óleo), ver na lista com total certo.
- [ ] **Step 4: Commit** `feat(manutencao): registro de serviço + lista (caderno)`.

---

### Task 2.5: Cadastro de Tipos de Óleo

**Files:**
- Create: `src/components/manutencao/TiposOleoPage.tsx`
- Modify: router de Manutenção (nova aba/rota `/manutencao/tipos-oleo`, gated em `gerenciar_tipos_oleo` ou `ver_manutencao`)

- [ ] **Step 1:** CRUD simples (lista + form) de `tipos_oleo`: nome, aplicação (select), intervalo em meses (number, vazio = sem alerta), ativo. Usa hooks da Task 2.1.
- [ ] **Step 2: Verificação manual** — criar/editar/inativar um tipo; ver refletir no select do modal de óleo.
- [ ] **Step 3: Commit** `feat(manutencao): cadastro de tipos de óleo`.

---

## FASE 3 — Relatórios, painel de óleos e dashboard

### Task 3.1: Pure function de óleos vencendo + painel

**Files:**
- Create: `src/components/manutencao/OleosVencendoPanel.tsx`
- (lógica de dias/situação vem da view; o painel só formata)

- [ ] **Step 1:** Painel que lê `useOleosVencendo()` e mostra tabela: máquina, tipo, última troca, vencimento, situação (chip vencido/a vencer/ok). Filtro só vencido/a vencer por padrão.
- [ ] **Step 2: Verificação manual** — lançar um óleo com data antiga numa OS de teste e ver aparecer como vencido.
- [ ] **Step 3: Commit** `feat(manutencao): painel de óleos vencendo`.

### Task 3.2: Relatório por máquina + mensal (Excel + PDF)

**Files:**
- Modify/replace: `src/utils/manutencaoPdfExport.ts`
- Create: `src/utils/manutencaoExcelExport.ts` (usa `exceljs`, espelhar `src/utils/extratoExport.ts`)

- [ ] **Step 1:** Função pura `montarRelatorioPorMaquina(equipamentoId, periodo, servicos)` que agrupa por categoria (peças/terceiros/óleo) com subtotais e total. Teste Vitest com dados de exemplo (entrada → totais esperados).
- [ ] **Step 2:** PDF por máquina (template da marca) + Excel por máquina. Atualizar o relatório mensal pra usar as novas categorias e remover a seção de preventivas.
- [ ] **Step 3: Verificação manual** — gerar Excel e PDF de uma máquina com serviços, conferir subtotais.
- [ ] **Step 4: Commit** `feat(manutencao): relatório por máquina e mensal (Excel + PDF)`.

### Task 3.3: Reforma do dashboard

**Files:**
- Modify: `src/components/manutencao/DashboardManutencao.tsx`

- [ ] **Step 1:** Trocar widgets de preventivas por: custo por máquina, custo por tipo de serviço, total do mês, e resumo de óleos vencendo (reusa OleosVencendoPanel).
- [ ] **Step 2: Verificação manual + tsc/build.**
- [ ] **Step 3: Commit** `feat(manutencao): dashboard reformado pro caderno`.

---

## FASE 4 — Remoções (app + banco)

> Espelhar o procedimento das remoções de Engenharia/Compras: mapear importadores antes, editar rotas/nav/permissions, migration de drop versionada, scrub de chaves, verificação (grep + tsc + build + vitest), commit.

### Task 4.1: Confirmar zero acoplamento e contagem de dados

- [ ] **Step 1:** Grep: nada fora dos arquivos a remover importa `PlanosPreventivosPage`, `planos/*`, `AgendaPreventivasPage`, `ChecklistsPage`, `checklists/*`, `AdicionarMaoObraOSModal`, `MudarStatusOSModal`, `useMaoObraOS`, `useTransicoesOS`.
- [ ] **Step 2:** Contar linhas das tabelas a dropar (planos_*, equipamento_plano, execucoes_*, checklists_*, os_mao_obra, os_transicoes) — esperado quase tudo teste/zero. Registrar a contagem.

### Task 4.2: Remover app (rotas, componentes, permissões)

**Files:**
- Modify: `src/App.tsx` (rotas /manutencao/planos, /agenda, /checklists), `Manutencao.tsx` (abas), `src/utils/permissions.ts`
- Delete: componentes de planos/agenda/checklists + modais de status/mão de obra + hooks `useMaoObraOS`/`useTransicoesOS`

- [ ] **Step 1:** Remover rotas + abas + as chaves de permissão (planos/checklist/agenda/status/mão de obra) do `permissions.ts` (defs, deps, templates, ACOES_PERIGOSAS). 
- [ ] **Step 2:** Deletar os componentes/hooks. Atualizar o `permissions.test.ts` se referenciar as chaves removidas.
- [ ] **Step 3:** tsc + eslint + vitest + build limpos.
- [ ] **Step 4: Commit** `refactor(manutencao): remove planos/agenda/checklists/status/mão de obra do app`.

### Task 4.3: Migration de drop (banco) + scrub de chaves

**Files:**
- Create: `supabase/migrations/20260701140000_manutencao_drop_legado_fix.sql` + `_rollback`

- [ ] **Step 1:** `_fix.sql`: `DROP TABLE IF EXISTS ... CASCADE` para planos_preventivos, plano_atividades, plano_atividade_pecas, equipamento_plano, execucoes_atividade, checklists_modelos, execucoes_checklist, os_mao_obra, os_transicoes; `DROP VIEW IF EXISTS v_proximas_preventivas`; `DROP FUNCTION IF EXISTS tg_os_grava_transicao` e demais funções órfãs; scrub das chaves removidas em `funcionarios.acoes_permitidas` (lista explícita, padrão da migration de Compras/Financeiro). Ajustar `custo_total` se ainda referenciar `custo_mao_obra_propria` (já tratado na Task 1.2). Conferir triggers em `equipamentos`/`ordens_servico` que dependiam de preventivas (ex.: `os_sync_equipamento_status`) — preservar o que continua válido.
- [ ] **Step 2:** `_rollback.sql`: advisory apontando re-aplicar as migrations originais (não restaura dados).
- [ ] **Step 3:** Aplicar via MCP (com ok), verificar 0 objetos legados, equipamentos/ordens_servico intactos.
- [ ] **Step 4: Commit** `feat(manutencao): drop das tabelas de planos/checklists/mão de obra/status (banco)`.

---

## Fechamento
- [ ] tsc + eslint + vitest + build limpos no total.
- [ ] Atualizar vault: `projects/gestao-obras/status.md` (seção do redesign), `log.md`, `index.md`.
- [ ] Merge na main + push (com ok do Tiago) → deploy Vercel. Conferir deploy READY.

## Self-review (cobertura da spec)
- Caderno enxuto sem status → Task 2.3/2.4. Sem mão de obra → 2.3 + 4.2/4.3. Peças do catálogo → reusa os_pecas (sem mudança). Terceiros itemizados → 1.2 + 2.1/2.2/2.3. Óleo com lista própria → 1.1 + 2.5; alerta por tipo/data → 1.3 + 3.1. Remoções → Fase 4. Relatórios Excel+PDF → 3.2. Dashboard → 3.3. Permissões → 1.4. Premissas (peça não baixa estoque, valor editável, terceiro texto livre) → refletidas nos modelos/modais.
