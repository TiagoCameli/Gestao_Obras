# Baixa de estoque ao lançar peça/óleo no serviço — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps usam checkbox `- [ ]`.

**Goal:** No serviço de manutenção, peça/óleo só aparece com saldo, exige o almoxarifado de saída, mostra a unidade, puxa o custo médio da entrada e dá baixa no estoque.

**Architecture:** Peça já baixa via `v_saldo_estoque` (subtrai os_pecas com deposito). É só frontend. Óleo é híbrido: `os_oleos` ganha insumo_id+deposito_id, `insumos` ganha tipo_oleo_id, a view passa a descontar os_oleos, e um trigger valida saldo. Espec: `docs/superpowers/specs/2026-07-02-baixa-estoque-servico-manutencao-design.md`.

## Global Constraints
- Migration versionada `_fix`/`_rollback` (+100 no rollback), `.sql` no repo, aplicada via MCP com ok do Tiago. Aditiva/idempotente.
- Custo/valor unitário = `custo_medio` da view (read-only na UI).
- Hooks de mutação: `.select()` + erro se 0 linhas.
- `tsc -b`, `eslint` nos tocados, `vitest run` (fora as 12 do fifoCombustivel), `vite build` limpos antes do fechamento.
- Sem chave de permissão nova.

---

## Task 1: Migration (os_oleos, insumos, view, trigger)

**Files:** Create `supabase/migrations/20260702160000_baixa_estoque_oleo_fix.sql` + `_rollback` (20260702160100).

- [ ] **Step 1: `_fix.sql`**

```sql
-- (a) os_oleos: origem do almoxarifado (nullable p/ compat com óleos antigos)
ALTER TABLE public.os_oleos ADD COLUMN IF NOT EXISTS insumo_id text REFERENCES public.insumos(id);
ALTER TABLE public.os_oleos ADD COLUMN IF NOT EXISTS deposito_id text REFERENCES public.depositos_material(id);
CREATE INDEX IF NOT EXISTS idx_os_oleos_insumo ON public.os_oleos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_os_oleos_deposito ON public.os_oleos(deposito_id);

-- (b) insumos: marca "este insumo é um óleo do tipo X"
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS tipo_oleo_id text REFERENCES public.tipos_oleo(id);

-- (c) v_saldo_estoque passa a descontar TAMBÉM o consumo de os_oleos
--     (mesmo critério de os_pecas: OS ativa, deposito e insumo não nulos).
CREATE OR REPLACE VIEW public.v_saldo_estoque AS
WITH entradas_agg AS (
  SELECT deposito_material_id AS deposito_id, insumo_id,
         COALESCE(sum(quantidade),0) AS qty_entrada,
         COALESCE(sum(valor_total),0) AS valor_entrada
  FROM public.entradas_material GROUP BY deposito_material_id, insumo_id
), saidas_agg AS (
  SELECT deposito_material_id AS deposito_id, insumo_id, COALESCE(sum(quantidade),0) AS qty_saida
  FROM public.saidas_material GROUP BY deposito_material_id, insumo_id
), transf_in AS (
  SELECT deposito_destino_id AS deposito_id, insumo_id, COALESCE(sum(quantidade),0) AS qty_in
  FROM public.transferencias_material GROUP BY deposito_destino_id, insumo_id
), transf_out AS (
  SELECT deposito_origem_id AS deposito_id, insumo_id, COALESCE(sum(quantidade),0) AS qty_out
  FROM public.transferencias_material GROUP BY deposito_origem_id, insumo_id
), ospecas_agg AS (
  SELECT op.deposito_id, op.insumo_id, COALESCE(sum(op.quantidade),0) AS qty_os
  FROM public.os_pecas op
  JOIN public.ordens_servico os ON os.id = op.os_id
  WHERE os.status <> ALL (ARRAY['cancelada','rascunho']) AND op.deposito_id IS NOT NULL AND os.deleted_at IS NULL
  GROUP BY op.deposito_id, op.insumo_id
), osoleos_agg AS (
  SELECT oo.deposito_id, oo.insumo_id, COALESCE(sum(oo.quantidade),0) AS qty_oleo
  FROM public.os_oleos oo
  JOIN public.ordens_servico os ON os.id = oo.os_id
  WHERE os.status <> ALL (ARRAY['cancelada','rascunho']) AND oo.deposito_id IS NOT NULL AND oo.insumo_id IS NOT NULL AND os.deleted_at IS NULL
  GROUP BY oo.deposito_id, oo.insumo_id
)
SELECT i.id AS insumo_id, i.nome AS insumo_nome, i.unidade, i.codigo_sku, i.fabricante, i.estoque_minimo,
       d.id AS deposito_id, d.nome AS deposito_nome,
       COALESCE(ea.qty_entrada,0) + COALESCE(ti.qty_in,0) - COALESCE(sa.qty_saida,0)
         - COALESCE(too.qty_out,0) - COALESCE(opa.qty_os,0) - COALESCE(ooa.qty_oleo,0) AS saldo,
       CASE WHEN COALESCE(ea.qty_entrada,0) > 0 THEN ea.valor_entrada / ea.qty_entrada ELSE NULL END AS custo_medio,
       ea.qty_entrada AS total_entradas, ea.valor_entrada AS valor_total_entradas
FROM public.insumos i
CROSS JOIN public.depositos_material d
LEFT JOIN entradas_agg ea ON ea.insumo_id=i.id AND ea.deposito_id=d.id
LEFT JOIN saidas_agg sa ON sa.insumo_id=i.id AND sa.deposito_id=d.id
LEFT JOIN transf_in ti ON ti.insumo_id=i.id AND ti.deposito_id=d.id
LEFT JOIN transf_out too ON too.insumo_id=i.id AND too.deposito_id=d.id
LEFT JOIN ospecas_agg opa ON opa.insumo_id=i.id AND opa.deposito_id=d.id
LEFT JOIN osoleos_agg ooa ON ooa.insumo_id=i.id AND ooa.deposito_id=d.id
WHERE i.ativo = true;

-- (d) trigger de validação de saldo pra óleo (espelho do de peça)
CREATE OR REPLACE FUNCTION public.tg_os_oleos_valida_saldo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $fn$
declare v_saldo numeric; v_delta numeric; v_status_os text; v_nome text; v_dep text;
begin
  if new.deposito_id is null or new.insumo_id is null then return new; end if;
  select status into v_status_os from ordens_servico where id = new.os_id;
  if v_status_os in ('cancelada','rascunho') then return new; end if;
  v_delta := new.quantidade - coalesce(case when tg_op='UPDATE' then old.quantidade end, 0);
  if v_delta <= 0 then return new; end if;
  select saldo into v_saldo from v_saldo_estoque where deposito_id=new.deposito_id and insumo_id=new.insumo_id;
  if coalesce(v_saldo,0) < v_delta then
    select nome into v_nome from insumos where id=new.insumo_id;
    select nome into v_dep from depositos_material where id=new.deposito_id;
    raise exception 'Saldo insuficiente: % em "%". Disponível: %, necessário: %', v_nome, v_dep, coalesce(v_saldo,0), v_delta
      using errcode='23514';
  end if;
  return new;
end $fn$;
DROP TRIGGER IF EXISTS trg_os_oleos_valida_saldo ON public.os_oleos;
CREATE TRIGGER trg_os_oleos_valida_saldo BEFORE INSERT OR UPDATE ON public.os_oleos
  FOR EACH ROW EXECUTE FUNCTION public.tg_os_oleos_valida_saldo();
```

- [ ] **Step 2: `_rollback.sql`** — DROP TRIGGER + FUNCTION tg_os_oleos_valida_saldo; recriar v_saldo_estoque SEM o osoleos_agg (colar a def original, sem o CTE de óleo); `ALTER TABLE insumos DROP COLUMN IF EXISTS tipo_oleo_id`; `ALTER TABLE os_oleos DROP COLUMN IF EXISTS insumo_id, DROP COLUMN IF EXISTS deposito_id`.
- [ ] **Step 3:** Aplicar via MCP `apply_migration` (com ok do Tiago). Verificar: inserir os_oleo de teste com deposito+insumo e ver saldo cair em v_saldo_estoque; remover e voltar; trigger barra saldo insuficiente.
- [ ] **Step 4: Commit** os 2 .sql.

---

## Task 2: Tipos + mappers (insumos.tipoOleoId, os_oleos.insumoId/depositoId)

**Files:** Modify `src/types/index.ts`, `src/lib/mappers.ts` (insumoToDb/dbToInsumo), `src/hooks/useOSOleos.ts` (dbToOSOleo/osOleoToDb).

- [ ] **Step 1:** `Insumo` (types): + `tipoOleoId?: string | null`. `OSOleo` (types): + `insumoId?: string | null; depositoId?: string | null`.
- [ ] **Step 2:** `dbToInsumo`: `tipoOleoId: row.tipo_oleo_id ?? null`. `insumoToDb`: `tipo_oleo_id: i.tipoOleoId || null`.
- [ ] **Step 3:** `dbToOSOleo`: `insumoId: row.insumo_id ?? null, depositoId: row.deposito_id ?? null`. `osOleoToDb`: incluir `insumo_id: o.insumoId ?? null, deposito_id: o.depositoId ?? null`.
- [ ] **Step 4:** `tsc -b` limpo. Commit.

---

## Task 3: Peça — util puro + testes + modal

**Files:** Create `src/utils/estoqueServico.ts` + `.test.ts`; Modify `src/components/manutencao/os/AdicionarPecaOSModal.tsx`.

- [ ] **Step 1 (TDD):** `estoqueServico.ts` com função pura `validarQtdContraSaldo(qtd:number, saldo:number): string|null` (retorna msg de erro se qtd>saldo ou qtd<=0, senão null) e `custoDoDeposito(saldos, depositoId): {custoMedio:number|null, unidade:string, saldo:number} | null`. Testes: qtd ok; qtd>saldo → erro; qtd 0 → erro; custoDoDeposito acha/não acha.
- [ ] **Step 2:** Reescrever `AdicionarPecaOSModal`:
  - Lista de peças = `useSaldoEstoqueTotal({apenasManutencao:true})` filtrando `saldoTotal > 0` (só com saldo). Opções `{value: insumoId, label: insumoNome (saldo un)}`.
  - Ao escolher: `useSaldoEstoquePorDeposito(insumoId)` → select **Depósito (obrigatório)** só com `saldo>0` (label: `nome — saldo un`). Ao escolher depósito: **unidade** exibida e **custo unitário read-only = custoMedio**.
  - Quantidade: valida `validarQtdContraSaldo(qtd, saldoDoDeposito)`; bloqueia submit e mostra "Disponível: X un".
  - Remove o Select de Status da UI (mantém `status:'reservada'`). onSubmit igual (já manda depositoId/custoUnitario/quantidade). Mantém as props atuais (insumos/depositos ainda entram mas o filtro passa a ser por saldo; posso ignorar `depositos` prop e usar os do saldo).
- [ ] **Step 3:** vitest do util + tsc + eslint. Commit.

---

## Task 4: Óleo — modal + hook

**Files:** Modify `src/components/manutencao/os/AdicionarOleoOSModal.tsx`, `src/hooks/useOSOleos.ts`.

- [ ] **Step 1:** `useAdicionarOleoOS`/`useExcluirOleoOS`: acrescentar invalidação de `['saldo_estoque_total']` e `['saldo_estoque_deposito']` no onSuccess (pra o saldo do almoxarifado refletir). O mutationFn já aceita o objeto ampliado (insumoId/depositoId vêm no OSOleo).
- [ ] **Step 2:** Reescrever `AdicionarOleoOSModal`:
  - Fonte: `useInsumos()` (tem tipoOleoId) ∩ `useSaldoEstoqueTotal({apenasManutencao:true})`; mostra só insumos com `tipoOleoId` não nulo E `saldoTotal>0`. Select "Óleo (do almoxarifado)".
  - Ao escolher: `useSaldoEstoquePorDeposito(insumoId)` → **Depósito (obrigatório)** só com saldo; **unidade** e **valor unitário (read-only = custoMedio)** automáticos; **tipoOleoId derivado** do insumo escolhido (`insumo.tipoOleoId`).
  - Quantidade validada contra saldo do depósito (mesmo util da Task 3).
  - Submit chama `useAdicionarOleoOS` com `{osId, tipoOleoId, insumoId, depositoId, quantidade, unidade, valorUnitario:custoMedio, valorTotal, createdBy}`.
  - Se não houver óleo com saldo → estado vazio ("Cadastre um óleo no almoxarifado e dê entrada").
- [ ] **Step 3:** tsc + eslint. Commit.

---

## Task 5: Cadastro — tipo de óleo no PecaFormModal

**Files:** Modify `src/components/manutencao/almoxarifado/PecaFormModal.tsx`.

- [ ] **Step 1:** Adicionar `useTiposOleo(true)` + estado `tipoOleoId` (init `insumoExistente?.tipoOleoId ?? ''`). Campo Select "Tipo de óleo (deixe vazio se não for óleo)" com os tipos ativos + opção vazia. No `insumo` montado no submit: `tipoOleoId: tipoOleoId || null`.
- [ ] **Step 2:** tsc + eslint. Commit.

---

## Fechamento
- [ ] `tsc -b`, `eslint` nos tocados, `vitest run`, `vite build` limpos.
- [ ] Migration aplicada via MCP (ok do Tiago). Merge/push main (ok do Tiago) → deploy.
- [ ] Teste manual em produção (cadastrar óleo-peça no almox + entrada; registrar serviço consumindo peça+óleo; ver saldo cair; remover e voltar; exceder saldo bloqueia; vencimento ok). Cleanup do teste.
- [ ] Vault: status.md + log.md.

## Self-review (cobertura da spec)
Peça: só-com-saldo/depósito-obrigatório/unidade/custo-médio/baixa → Task 3 (+ view já pronta). Óleo híbrido: insumo_id+deposito_id+tipo mantido, view desconta óleo, trigger valida → Tasks 1,2,4. Cadastro marca óleo → Task 5. Custo read-only=custo_medio → Tasks 3/4. Compat (nullable) → Task 1. Vencimento intacto (tipo_oleo_id mantido) → Task 1. Testes → Task 3.
