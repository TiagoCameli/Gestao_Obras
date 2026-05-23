# OS ↔ Equipamento Status Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar automaticamente `equipamentos.status` quando uma OS entra em `em_execucao` ou conclui/cancela/é soft-deletada, eliminando a necessidade de mudança manual via `StatusChangeMotivoModal`.

**Architecture:** 1 trigger AFTER UPDATE OF status, deleted_at em `ordens_servico` + 1 função plpgsql SECURITY DEFINER com `search_path = pg_catalog, public`. Lógica única que cobre IDA (entrada em em_execucao), VOLTA (sair de em_execucao/aguardando_aprovacao para concluida/cancelada) e soft-delete; idempotente; trata OSs paralelas; NÃO toca em `equipamentos.ativo` (preserva invariante existente). Hooks `useMudarStatusOS` e `useExcluirOS` ganham 2 invalidações React Query no `onSuccess`.

**Tech Stack:** Postgres 17 (Supabase project `gunyitwrbxbmnezokgjq`), plpgsql, TypeScript, `@tanstack/react-query`, `supabase-js`.

**Spec:** `docs/superpowers/specs/2026-05-22-os-equipamento-status-sync-design.md`.

---

## File Structure

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260522130000_os_sync_equipamento_status.sql` | NOVO (~120 LOC) | Função `tg_os_sync_equipamento_status()` + trigger `trg_os_sync_equipamento_status_upd` + comment |
| `src/hooks/useOrdensServico.ts:239-246` | MODIFICAR | `useMudarStatusOS` onSuccess: +2 invalidações |
| `src/hooks/useOrdensServico.ts:259-261` | MODIFICAR | `useExcluirOS` onSuccess: +2 invalidações |

Nenhum arquivo novo do lado TypeScript. Mappers, tipos e componentes UI não mudam.

---

### Task 1: Criar a migration SQL

**Files:**
- Create: `supabase/migrations/20260522130000_os_sync_equipamento_status.sql`

- [ ] **Step 1: Verificar que o timestamp ainda está livre**

Run: `ls supabase/migrations/ | grep 20260522130000`
Expected: vazio (sem output).

Se houver colisão (alguém criou migration nesse timestamp), incrementar para `20260522140000` e ajustar referências.

- [ ] **Step 2: Criar o arquivo de migration com o conteúdo abaixo**

```sql
-- Frota/Manut audit #1 — Sincroniza equipamentos.status com OS.status
-- Quando OS entra em em_execucao pela 1a vez: equipamento -> manutencao_*.
-- Quando OS sai de em_execucao OU aguardando_aprovacao para concluida/cancelada
-- (ou e soft-deletada): equipamento volta para ativa.
-- Mapeamento OS.tipo -> equipamentos.status:
--   preventiva, preditiva -> manutencao_preventiva
--   corretiva, melhoria, garantia, recall -> manutencao_corretiva
-- NAO toca em equipamentos.ativo (invariante existente: ativo = status != 'fora_funcionamento').
-- Audit em historico_status_equipamento com os_id preenchido (so quando ha mudanca efetiva).
-- Idempotente. Trata OSs paralelas. Tratamento de fora_funcionamento: sobrescreve.

begin;

create or replace function public.tg_os_sync_equipamento_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_equip_status_atual text;
  v_novo_status_equip  text;
  v_motivo             text;
  v_hist_id            text;
  v_outras_ativas      integer;
  v_acao               text;   -- 'IDA' ou 'VOLTA'
begin
  -- Decide ramo a executar
  -- IDA: OS entra em em_execucao pela 1a vez (sem ja estar soft-deletada)
  if old.status is distinct from 'em_execucao'
     and new.status = 'em_execucao'
     and new.deleted_at is null then
    v_acao := 'IDA';

  -- VOLTA: OS sai de em_execucao OU aguardando_aprovacao para concluida/cancelada
  -- (fluxo padrao: em_execucao -> aguardando_aprovacao -> concluida)
  elsif old.status in ('em_execucao', 'aguardando_aprovacao')
        and new.status in ('concluida', 'cancelada')
        and new.deleted_at is null then
    v_acao := 'VOLTA';

  -- VOLTA por soft-delete: OS estava em em_execucao ou aguardando_aprovacao
  elsif old.deleted_at is null
        and new.deleted_at is not null
        and old.status in ('em_execucao', 'aguardando_aprovacao') then
    v_acao := 'VOLTA';

  else
    return new;
  end if;

  -- Le status atual do equipamento (idempotencia + audit)
  select status into v_equip_status_atual
    from public.equipamentos
   where id = new.equipamento_id;

  if v_equip_status_atual is null then
    return new;  -- defensivo: equipamento orfao
  end if;

  -- IDA
  if v_acao = 'IDA' then
    v_novo_status_equip := case
      when new.tipo in ('preventiva', 'preditiva') then 'manutencao_preventiva'
      else 'manutencao_corretiva'
    end;

    if v_equip_status_atual = v_novo_status_equip then
      return new;  -- ja esta no destino, no-op
    end if;

    -- IMPORTANTE: NAO tocar em equipamentos.ativo. Invariante do projeto
    -- (migration 20260503210000): ativo = (status != 'fora_funcionamento').
    update public.equipamentos
       set status     = v_novo_status_equip,
           updated_at = now()
     where id = new.equipamento_id;

    v_motivo := 'OS ' || coalesce(new.numero, new.id) || ' iniciou execucao';

  -- VOLTA (concluida, cancelada, soft-delete)
  else
    -- Outra OS ativa (em_execucao ou aguardando_aprovacao) mantem em manutencao
    select count(*) into v_outras_ativas
      from public.ordens_servico
     where equipamento_id = new.equipamento_id
       and id <> new.id
       and status in ('em_execucao', 'aguardando_aprovacao')
       and deleted_at is null;

    if v_outras_ativas > 0 then
      return new;
    end if;

    if v_equip_status_atual = 'ativa' then
      return new;  -- ja esta ativa, no-op
    end if;

    update public.equipamentos
       set status     = 'ativa',
           updated_at = now()
     where id = new.equipamento_id;

    v_motivo := 'OS ' || coalesce(new.numero, new.id) || ' ' || case
      when new.deleted_at is not null then 'excluida'
      when new.status = 'concluida' then 'concluida'
      else 'cancelada'
    end;
  end if;

  -- Audit em historico_status_equipamento (so quando ha mudanca efetiva)
  v_hist_id := 'hist-os-' || new.id || '-' ||
               replace(extract(epoch from clock_timestamp())::numeric(20,6)::text, '.', '');

  insert into public.historico_status_equipamento
    (id, equipamento_id, status_de, status_para, motivo, os_id, created_by)
  values
    (v_hist_id, new.equipamento_id, v_equip_status_atual,
     case when v_acao = 'IDA' then v_novo_status_equip else 'ativa' end,
     v_motivo, new.id, coalesce(new.updated_by, new.created_by))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_os_sync_equipamento_status_upd on public.ordens_servico;
create trigger trg_os_sync_equipamento_status_upd
  after update of status, deleted_at on public.ordens_servico
  for each row
  when (old.status is distinct from new.status
        or old.deleted_at is distinct from new.deleted_at)
  execute function public.tg_os_sync_equipamento_status();

comment on function public.tg_os_sync_equipamento_status() is
  'Frota/Manut audit #1: sincroniza equipamentos.status com OS.status. '
  'IDA quando OS entra em em_execucao pela 1a vez; VOLTA quando sai de '
  'em_execucao/aguardando_aprovacao para concluida/cancelada (ou soft-delete). '
  'Mapeamento preventiva/preditiva -> manutencao_preventiva; resto -> '
  'manutencao_corretiva. NAO toca em equipamentos.ativo (invariante do projeto). '
  'Idempotente, trata OSs paralelas. SECURITY DEFINER + search_path setado para '
  'sobreviver a tighten de RLS (Frota/Manut audit #3).';

commit;
```

- [ ] **Step 3: Commit do arquivo da migration**

```bash
git add supabase/migrations/20260522130000_os_sync_equipamento_status.sql
git commit -m "migration: trigger OS↔equipamento status sync (Frota/Manut audit #1)

Função tg_os_sync_equipamento_status() + trigger
trg_os_sync_equipamento_status_upd em ordens_servico.

Spec: docs/superpowers/specs/2026-05-22-os-equipamento-status-sync-design.md"
```

---

### Task 2: Aplicar a migration no Supabase

**Files:**
- (apenas executa, não modifica)

- [ ] **Step 1: Aplicar via MCP**

Usar a ferramenta `mcp__plugin_supabase_supabase__apply_migration` com:
- `project_id`: `gunyitwrbxbmnezokgjq`
- `name`: `20260522130000_os_sync_equipamento_status`
- `query`: conteúdo completo do arquivo SQL (mesma string do Task 1 Step 2)

Expected: resposta de sucesso sem erro.

Se houver erro de sintaxe SQL, abortar, corrigir o arquivo no Task 1, repetir.

- [ ] **Step 2: Verificar que a função foi criada com SECURITY DEFINER + search_path**

Usar `mcp__plugin_supabase_supabase__execute_sql` com:

```sql
select proname, prosecdef, proconfig
from pg_proc
where proname = 'tg_os_sync_equipamento_status'
  and pronamespace = 'public'::regnamespace;
```

Expected:
- `prosecdef` = `true`
- `proconfig` contém `search_path=pg_catalog, public`

Se prosecdef=false ou proconfig vazio, abortar — função não foi criada corretamente.

- [ ] **Step 3: Verificar que o trigger foi criado e está enabled**

```sql
select tgname, tgenabled
from pg_trigger
where tgname = 'trg_os_sync_equipamento_status_upd';
```

Expected:
- `tgname` = `trg_os_sync_equipamento_status_upd`
- `tgenabled` = `O` (origin: enabled)

---

### Task 3: Editar `useMudarStatusOS` — adicionar invalidações

**Files:**
- Modify: `src/hooks/useOrdensServico.ts:239-246`

- [ ] **Step 1: Localizar o bloco `onSuccess` de `useMudarStatusOS`**

Linha 239-246 atual:
```ts
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
      qc.invalidateQueries({ queryKey: ['ordem_servico', variables.osId] });
      // Invalida todas as queries de detalhe por numero (não temos o numero aqui)
      qc.invalidateQueries({ queryKey: ['ordem_servico_numero'] });
      qc.invalidateQueries({ queryKey: ['os_transicoes', variables.osId] });
    },
```

- [ ] **Step 2: Adicionar as 2 invalidações novas dentro do bloco**

Substituir o `onSuccess` por:
```ts
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
      qc.invalidateQueries({ queryKey: ['ordem_servico', variables.osId] });
      // Invalida todas as queries de detalhe por numero (não temos o numero aqui)
      qc.invalidateQueries({ queryKey: ['ordem_servico_numero'] });
      qc.invalidateQueries({ queryKey: ['os_transicoes', variables.osId] });
      // Frota/Manut audit #1: trigger no DB pode ter mudado equipamentos.status
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'historico_status_equipamento',
      });
    },
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos (pode haver erros pré-existentes do projeto; nenhum novo).

Se aparecer erro `Type 'unknown' is not assignable...` no predicate, ajustar para `(q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'historico_status_equipamento'`.

---

### Task 4: Editar `useExcluirOS` — adicionar invalidações

**Files:**
- Modify: `src/hooks/useOrdensServico.ts:259-261`

- [ ] **Step 1: Localizar o bloco `onSuccess` de `useExcluirOS`**

Linha 259-261 atual:
```ts
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
    },
```

- [ ] **Step 2: Substituir por versão com invalidações de equipamento + histórico**

```ts
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordens_servico'] });
      // Frota/Manut audit #1: trigger no DB pode ter mudado equipamentos.status
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'historico_status_equipamento',
      });
    },
```

- [ ] **Step 3: Verificar typecheck novamente**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit das duas mudanças de hook**

```bash
git add src/hooks/useOrdensServico.ts
git commit -m "feat(frota): hooks de OS invalidam queries de equipamento após mudança

useMudarStatusOS e useExcluirOS adicionam invalidação de ['equipamentos']
e ['historico_status_equipamento'] no onSuccess para refletir a mudança
automática feita pelo trigger trg_os_sync_equipamento_status_upd.

Spec: docs/superpowers/specs/2026-05-22-os-equipamento-status-sync-design.md"
```

---

### Task 5: Smoke test SQL — IDA e VOLTA básica

**Files:**
- (apenas executa queries via MCP)

> **Objetivo:** validar que trigger funciona em um caso simples antes de partir para os 15 testes manuais. Criar OS sintética, mover status, verificar efeitos. Reverter no final.

- [ ] **Step 1: Escolher um equipamento de teste e snapshot do estado**

```sql
-- Equipamento qualquer em status 'ativa'. Anotar o id retornado.
select id, nome, status from public.equipamentos
where status = 'ativa' and ativo = true
order by created_at desc
limit 1;
```

Expected: 1 linha. Anote `id` como `<EQUIP_ID>` para os steps seguintes.

- [ ] **Step 2: Criar OS sintética em status `aberta`**

```sql
insert into public.ordens_servico
  (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values
  ('test-os-sync-1', 'OS-TEST-SYNC-1', '<EQUIP_ID>', 'corretiva', 'media', 'aberta',
   'Teste smoke trigger', 'smoke-test', 'smoke-test');
```

Expected: sucesso. Verificar:
```sql
select status from public.equipamentos where id = '<EQUIP_ID>';
```
Esperado: ainda `ativa` (criar OS em status `aberta` não dispara IDA).

- [ ] **Step 3: Mover OS para `em_execucao` (dispara IDA)**

```sql
update public.ordens_servico
   set status = 'em_execucao', updated_by = 'smoke-test'
 where id = 'test-os-sync-1';
```

Verificar equipamento:
```sql
select status, ativo from public.equipamentos where id = '<EQUIP_ID>';
```
Expected: `status='manutencao_corretiva'`, `ativo=false`.

Verificar histórico:
```sql
select status_de, status_para, motivo, os_id
from public.historico_status_equipamento
where os_id = 'test-os-sync-1'
order by created_at desc;
```
Expected: 1 linha — `status_de='ativa'`, `status_para='manutencao_corretiva'`, `motivo='OS OS-TEST-SYNC-1 iniciou execucao'`.

- [ ] **Step 4: Mover OS para `concluida` (dispara VOLTA)**

```sql
update public.ordens_servico
   set status = 'concluida', updated_by = 'smoke-test'
 where id = 'test-os-sync-1';
```

Verificar:
```sql
select status, ativo from public.equipamentos where id = '<EQUIP_ID>';
```
Expected: `status='ativa'`, `ativo=true`.

Histórico deve ter 2 linhas agora:
```sql
select status_de, status_para, motivo
from public.historico_status_equipamento
where os_id = 'test-os-sync-1'
order by created_at;
```
Expected: 2 linhas, a 2ª com `status_para='ativa'`, motivo `'OS OS-TEST-SYNC-1 concluida'`.

- [ ] **Step 5: Limpeza do smoke test**

```sql
delete from public.historico_status_equipamento where os_id = 'test-os-sync-1';
delete from public.os_transicoes where os_id = 'test-os-sync-1';
delete from public.ordens_servico where id = 'test-os-sync-1';
```

Expected: 3 DELETEs com sucesso. Equipamento permanece em `status='ativa'` (não desfazemos a transição final intencionalmente — auditoria preservada se rodou em produção).

> Se este smoke falhar, **abortar e investigar** antes de prosseguir para Task 6. Não fazer rollback automático — verificar se o problema é do trigger ou do ambiente.

---

### Task 6: Testes manuais T1–T19

**Files:**
- (apenas executa queries via MCP)

> **Objetivo:** validar os 19 cenários (15 originais + T16-T19 para fluxo via `aguardando_aprovacao` e invariante de `ativo`) contra o ambiente. Cada step é auto-contido — cria dados, exerce o trigger, verifica, limpa. Usa `os_id` no formato `test-os-syncN` para facilitar limpeza.

> **Pré-requisito:** ter `<EQUIP_ID>` de um equipamento `ativa` (mesmo equipamento usado no Task 5 está OK).

> **Padrão de cada teste:** `INSERT OS → UPDATE status → SELECT verificação → cleanup`.

- [ ] **Step T1: Happy path corretiva + verifica invariante de `ativo`**

```sql
-- setup
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t1', 'OS-T1', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T1', 'test', 'test');
-- ida
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t1';
-- verifica
select status, ativo from public.equipamentos where id='<EQUIP_ID>';
-- esperado: status=manutencao_corretiva, ativo=true (invariante preservada)
-- volta
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t1';
select status, ativo from public.equipamentos where id='<EQUIP_ID>';
-- esperado: status=ativa, ativo=true
select count(*) from public.historico_status_equipamento where os_id='test-os-t1'; -- esperado: 2
-- cleanup
delete from public.historico_status_equipamento where os_id='test-os-t1';
delete from public.os_transicoes where os_id='test-os-t1';
delete from public.ordens_servico where id='test-os-t1';
```

Expected: status intermediário `manutencao_corretiva` **com `ativo=true`** (não regressão), status final `ativa`, 2 linhas no histórico.

- [ ] **Step T2: Happy path preventiva**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t2', 'OS-T2', '<EQUIP_ID>', 'preventiva', 'media', 'aberta', 'T2', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t2';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_preventiva
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t2';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa
delete from public.historico_status_equipamento where os_id='test-os-t2';
delete from public.os_transicoes where os_id='test-os-t2';
delete from public.ordens_servico where id='test-os-t2';
```

Expected: status intermediário `manutencao_preventiva`.

- [ ] **Step T3: Mapeamento preditiva → preventiva**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t3', 'OS-T3', '<EQUIP_ID>', 'preditiva', 'media', 'aberta', 'T3', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t3';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_preventiva
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t3';
delete from public.historico_status_equipamento where os_id='test-os-t3';
delete from public.os_transicoes where os_id='test-os-t3';
delete from public.ordens_servico where id='test-os-t3';
```

Expected: `manutencao_preventiva` no intermediário.

- [ ] **Step T4: Mapeamento melhoria/garantia/recall → corretiva**

```sql
-- 3 OSs, uma de cada tipo. Roda sequencial.
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values
  ('test-os-t4a', 'OS-T4A', '<EQUIP_ID>', 'melhoria', 'media', 'aberta', 'T4 melhoria', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t4a';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t4a';

insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t4b', 'OS-T4B', '<EQUIP_ID>', 'garantia', 'media', 'aberta', 'T4 garantia', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t4b';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t4b';

insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t4c', 'OS-T4C', '<EQUIP_ID>', 'recall', 'media', 'aberta', 'T4 recall', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t4c';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t4c';

delete from public.historico_status_equipamento where os_id like 'test-os-t4%';
delete from public.os_transicoes where os_id like 'test-os-t4%';
delete from public.ordens_servico where id like 'test-os-t4%';
```

Expected: as 3 levaram a `manutencao_corretiva` no intermediário.

- [ ] **Step T5: Cancelar sem ter iniciado (no-op)**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t5', 'OS-T5', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T5', 'test', 'test');
-- direto pra cancelada sem passar por em_execucao
update public.ordens_servico set status='cancelada', updated_by='test' where id='test-os-t5';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa (inalterado)
select count(*) from public.historico_status_equipamento where os_id='test-os-t5'; -- esperado: 0
delete from public.os_transicoes where os_id='test-os-t5';
delete from public.ordens_servico where id='test-os-t5';
```

Expected: equipamento permanece `ativa`, zero linhas no histórico para a OS.

- [ ] **Step T6: Cancelar depois de iniciar**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t6', 'OS-T6', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T6', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t6';
update public.ordens_servico set status='cancelada', updated_by='test' where id='test-os-t6';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa
select motivo from public.historico_status_equipamento where os_id='test-os-t6' order by created_at desc limit 1;
-- esperado: 'OS OS-T6 cancelada'
delete from public.historico_status_equipamento where os_id='test-os-t6';
delete from public.os_transicoes where os_id='test-os-t6';
delete from public.ordens_servico where id='test-os-t6';
```

Expected: 2 linhas no histórico (ida + volta com motivo `cancelada`).

- [ ] **Step T7: Soft-delete no meio**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t7', 'OS-T7', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T7', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t7';
-- soft-delete
update public.ordens_servico set deleted_at=now(), deleted_by='test', updated_by='test' where id='test-os-t7';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa
select motivo from public.historico_status_equipamento where os_id='test-os-t7' order by created_at desc limit 1;
-- esperado: 'OS OS-T7 excluida'
delete from public.historico_status_equipamento where os_id='test-os-t7';
delete from public.os_transicoes where os_id='test-os-t7';
delete from public.ordens_servico where id='test-os-t7';
```

Expected: equipamento volta para `ativa`, motivo `excluida`.

- [ ] **Step T8: Soft-delete depois de concluir (no-op extra)**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t8', 'OS-T8', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T8', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t8';
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t8';
-- equipamento ja voltou; conta historico antes do soft-delete
select count(*) as c_antes from public.historico_status_equipamento where os_id='test-os-t8';
update public.ordens_servico set deleted_at=now(), deleted_by='test', updated_by='test' where id='test-os-t8';
select count(*) as c_depois from public.historico_status_equipamento where os_id='test-os-t8';
-- esperado: c_antes == c_depois (nada novo)
delete from public.historico_status_equipamento where os_id='test-os-t8';
delete from public.os_transicoes where os_id='test-os-t8';
delete from public.ordens_servico where id='test-os-t8';
```

Expected: `c_antes == c_depois` (soft-delete não dispara nova linha porque OS não estava em `em_execucao` no momento do soft-delete).

- [ ] **Step T9: Aguardando_pecas no meio (idempotência)**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t9', 'OS-T9', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T9', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t9';
-- conta historico apos IDA
select count(*) as c1 from public.historico_status_equipamento where os_id='test-os-t9';
-- aguardando_pecas: equipamento deve continuar em manutencao
update public.ordens_servico set status='aguardando_pecas', updated_by='test' where id='test-os-t9';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva
-- volta pra em_execucao: idempotente, sem nova linha
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t9';
select count(*) as c2 from public.historico_status_equipamento where os_id='test-os-t9';
-- esperado: c2 == c1 (no-op)
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t9';
delete from public.historico_status_equipamento where os_id='test-os-t9';
delete from public.os_transicoes where os_id='test-os-t9';
delete from public.ordens_servico where id='test-os-t9';
```

Expected: status continua `manutencao_corretiva` em aguardando_pecas; retomar para em_execucao **não** gera nova linha de histórico.

- [ ] **Step T10: Reabertura completa**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t10', 'OS-T10', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T10', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t10';   -- IDA #1
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t10';     -- VOLTA #1
update public.ordens_servico set status='aberta', updated_by='test' where id='test-os-t10';        -- no-op
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t10';   -- IDA #2
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t10';     -- VOLTA #2
select count(*) from public.historico_status_equipamento where os_id='test-os-t10'; -- esperado: 4
delete from public.historico_status_equipamento where os_id='test-os-t10';
delete from public.os_transicoes where os_id='test-os-t10';
delete from public.ordens_servico where id='test-os-t10';
```

Expected: 4 linhas no histórico (2 pares IDA+VOLTA).

- [ ] **Step T11: Duas OSs paralelas no mesmo equipamento**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values
  ('test-os-t11a', 'OS-T11A', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T11A', 'test', 'test'),
  ('test-os-t11b', 'OS-T11B', '<EQUIP_ID>', 'preventiva', 'media', 'aberta', 'T11B', 'test', 'test');
-- A pra em_execucao -> manutencao_corretiva
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t11a';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva
-- B pra em_execucao -> sobrescreve pra manutencao_preventiva
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t11b';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_preventiva
-- Conclui A: deveria permanecer em manutencao_preventiva (B ainda ativa)
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t11a';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_preventiva (no-op)
-- Conclui B: volta pra ativa
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t11b';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa

delete from public.historico_status_equipamento where os_id like 'test-os-t11%';
delete from public.os_transicoes where os_id like 'test-os-t11%';
delete from public.ordens_servico where id like 'test-os-t11%';
```

Expected: sobrescrita corretiva→preventiva ocorre; ao concluir a 1ª, equipamento mantém em preventiva; só ao concluir a 2ª volta para ativa.

- [ ] **Step T12: fora_funcionamento sobrescreve**

```sql
-- coloca equipamento em fora_funcionamento manualmente
update public.equipamentos set status='fora_funcionamento', ativo=false where id='<EQUIP_ID>';
insert into public.historico_status_equipamento (id, equipamento_id, status_de, status_para, motivo, created_by)
values ('hist-pre-t12', '<EQUIP_ID>', 'ativa', 'fora_funcionamento', 'Setup T12', 'test');

insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t12', 'OS-T12', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T12', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t12';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva (sobrescreveu fora_funcionamento)
select status_de from public.historico_status_equipamento where os_id='test-os-t12' order by created_at desc limit 1;
-- esperado: 'fora_funcionamento'
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t12';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa (nao volta para fora_funcionamento)

delete from public.historico_status_equipamento where os_id='test-os-t12';
delete from public.historico_status_equipamento where id='hist-pre-t12';
delete from public.os_transicoes where os_id='test-os-t12';
delete from public.ordens_servico where id='test-os-t12';
-- equipamento ja esta em 'ativa' apos o trigger; nada a restaurar
```

Expected: trigger sobrescreve `fora_funcionamento`; ao concluir, vai para `ativa` (não restaura fora_funcionamento).

- [ ] **Step T13: Idempotência — equipamento já em manutenção manual**

```sql
-- equipamento manualmente em manutencao_corretiva (sem OS)
update public.equipamentos set status='manutencao_corretiva', ativo=false where id='<EQUIP_ID>';
insert into public.historico_status_equipamento (id, equipamento_id, status_de, status_para, motivo, created_by)
values ('hist-pre-t13', '<EQUIP_ID>', 'ativa', 'manutencao_corretiva', 'Setup T13 manual', 'test');

insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t13', 'OS-T13', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T13', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t13';
-- equipamento ja esta no destino: trigger nao deve gerar nova linha
select count(*) from public.historico_status_equipamento where os_id='test-os-t13'; -- esperado: 0
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva (inalterado)

-- conclui: agora trigger volta pra ativa
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t13';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa
select count(*) from public.historico_status_equipamento where os_id='test-os-t13'; -- esperado: 1 (so a volta)

delete from public.historico_status_equipamento where os_id='test-os-t13';
delete from public.historico_status_equipamento where id='hist-pre-t13';
delete from public.os_transicoes where os_id='test-os-t13';
delete from public.ordens_servico where id='test-os-t13';
```

Expected: IDA não loga (idempotente); VOLTA loga 1 linha; equipamento volta para `ativa`.

- [ ] **Step T14: FK defensiva — inspeção SQL apenas**

```sql
-- Verificar que o ramo defensivo existe na funcao
select pg_get_functiondef('public.tg_os_sync_equipamento_status'::regproc) ~ 'v_equip_status_atual is null' as has_defensive_branch;
```

Expected: `true`. Não há como reproduzir órfão de FK porque RESTRICT bloqueia.

- [ ] **Step T15: Performance — UPDATE em massa**

```sql
-- Criar 20 OSs sinteticas (massa pequena para nao impactar prod)
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
select
  'test-os-t15-' || g,
  'OS-T15-' || g,
  '<EQUIP_ID>',
  'corretiva', 'baixa', 'aberta',
  'T15 perf', 'test', 'test'
from generate_series(1, 20) g;

-- Medir tempo da IDA em todas
explain analyze update public.ordens_servico set status='em_execucao', updated_by='test' where id like 'test-os-t15-%';

-- Volta todas
update public.ordens_servico set status='cancelada', updated_by='test' where id like 'test-os-t15-%';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa

-- Cleanup
delete from public.historico_status_equipamento where os_id like 'test-os-t15-%';
delete from public.os_transicoes where os_id like 'test-os-t15-%';
delete from public.ordens_servico where id like 'test-os-t15-%';
```

Expected: tempo proporcional ao número de linhas, sem timeout. ~5-10ms adicional por linha é aceitável.

- [ ] **Step T16: Fluxo via aguardando_aprovacao (caminho padrão)**

> **Crítico:** este é o fluxo recomendado pelo projeto (`em_execucao → aguardando_aprovacao → concluida`). Sem esta cobertura, o trigger pode falhar silenciosamente em produção.

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t16', 'OS-T16', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T16', 'test', 'test');

-- IDA
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t16';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva

-- aguardando_aprovacao: equipamento DEVE continuar em manutencao
update public.ordens_servico set status='aguardando_aprovacao', updated_by='test' where id='test-os-t16';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_corretiva (sem mudanca)
select count(*) from public.historico_status_equipamento where os_id='test-os-t16'; -- esperado: 1 (so a IDA)

-- concluida vindo de aguardando_aprovacao: VOLTA dispara
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t16';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa
select count(*) from public.historico_status_equipamento where os_id='test-os-t16'; -- esperado: 2

delete from public.historico_status_equipamento where os_id='test-os-t16';
delete from public.os_transicoes where os_id='test-os-t16';
delete from public.ordens_servico where id='test-os-t16';
```

Expected: equipamento volta para `ativa` mesmo passando por `aguardando_aprovacao` (regressão coberta).

- [ ] **Step T17: Soft-delete de OS em aguardando_aprovacao**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t17', 'OS-T17', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T17', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t17';
update public.ordens_servico set status='aguardando_aprovacao', updated_by='test' where id='test-os-t17';
-- soft-delete enquanto aguardando_aprovacao
update public.ordens_servico set deleted_at=now(), deleted_by='test', updated_by='test' where id='test-os-t17';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa
select motivo from public.historico_status_equipamento where os_id='test-os-t17' order by created_at desc limit 1;
-- esperado: 'OS OS-T17 excluida'
delete from public.historico_status_equipamento where os_id='test-os-t17';
delete from public.os_transicoes where os_id='test-os-t17';
delete from public.ordens_servico where id='test-os-t17';
```

Expected: VOLTA dispara via ramo do soft-delete também a partir de `aguardando_aprovacao`.

- [ ] **Step T18: Cancelar vindo de aguardando_aprovacao**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values ('test-os-t18', 'OS-T18', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T18', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t18';
update public.ordens_servico set status='aguardando_aprovacao', updated_by='test' where id='test-os-t18';
update public.ordens_servico set status='cancelada', updated_by='test' where id='test-os-t18';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa
delete from public.historico_status_equipamento where os_id='test-os-t18';
delete from public.os_transicoes where os_id='test-os-t18';
delete from public.ordens_servico where id='test-os-t18';
```

Expected: VOLTA dispara em `aguardando_aprovacao → cancelada`.

- [ ] **Step T19: OSs paralelas com uma em aguardando_aprovacao**

```sql
insert into public.ordens_servico (id, numero, equipamento_id, tipo, prioridade, status, defeito_reportado, created_by, updated_by)
values
  ('test-os-t19a', 'OS-T19A', '<EQUIP_ID>', 'corretiva', 'media', 'aberta', 'T19A', 'test', 'test'),
  ('test-os-t19b', 'OS-T19B', '<EQUIP_ID>', 'preventiva', 'media', 'aberta', 'T19B', 'test', 'test');
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t19a';
update public.ordens_servico set status='aguardando_aprovacao', updated_by='test' where id='test-os-t19a';
-- OS-A está em aguardando_aprovacao. Inicia OS-B.
update public.ordens_servico set status='em_execucao', updated_by='test' where id='test-os-t19b';
-- Conclui OS-A: outra OS (B) está em_execucao → trigger NÃO volta para ativa.
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t19a';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: manutencao_preventiva (OS-B mantém)
update public.ordens_servico set status='concluida', updated_by='test' where id='test-os-t19b';
select status from public.equipamentos where id='<EQUIP_ID>'; -- esperado: ativa

delete from public.historico_status_equipamento where os_id like 'test-os-t19%';
delete from public.os_transicoes where os_id like 'test-os-t19%';
delete from public.ordens_servico where id like 'test-os-t19%';
```

Expected: query "outras_ativas" cobre `aguardando_aprovacao` corretamente.

---

### Task 7: Verificação final dos advisors de segurança

**Files:**
- (apenas executa ferramenta MCP)

- [ ] **Step 1: Rodar advisors de segurança via MCP**

Usar `mcp__plugin_supabase_supabase__get_advisors` com:
- `project_id`: `gunyitwrbxbmnezokgjq`
- `type`: `security`

- [ ] **Step 2: Verificar que NÃO há novo lint do tipo `function_search_path_mutable` ou `security_definer_view` envolvendo a nova função**

Procurar na resposta por:
- `tg_os_sync_equipamento_status` — não deve aparecer em nenhum lint.

Expected: nenhuma menção à nova função.

Se aparecer:
- `function_search_path_mutable` → bug no nosso DDL (`search_path` não foi setado). Voltar a Task 1, corrigir, re-aplicar.
- `authenticated_security_definer_function_executable` → não deve aparecer (a função é trigger-only, não exposta via RPC); se aparecer, revogar `EXECUTE` para `authenticated`.

- [ ] **Step 3: Commit (se houve qualquer correção)**

Caso tenha precisado corrigir o DDL, criar nova migration corretiva e commitar:

```bash
git add supabase/migrations/<timestamp>_fix_os_sync_status_search_path.sql
git commit -m "fix(migration): corrige search_path em tg_os_sync_equipamento_status"
```

Se step 2 passou sem ajustes: pular este step.

---

### Task 8: Smoke test no client (mobile + desktop)

**Files:**
- (interação com UI no browser)

- [ ] **Step 1: Subir dev server**

Run: `npm run dev`
Expected: servidor sobe sem erro em `localhost:5173` (ou porta do projeto).

- [ ] **Step 2: Login e navegar até Manutenção**

Login com usuário com permissão `criar_os`, `mudar_status_os`, `ver_frota`.
Ir para tela de Manutenção → tab Ordens de Serviço.

- [ ] **Step 3: Criar OS de teste (corretiva) e mover para em_execucao**

1. Clicar "+ Nova OS"
2. Selecionar um equipamento qualquer (anotar nome/id pra próximo passo).
3. Tipo: Corretiva. Prioridade: Média. Defeito: "Smoke test UI".
4. Salvar.
5. Abrir o detalhe da OS criada.
6. Mudar status para `em_execucao` via o botão de mudar status.

Expected após (6):
- Sem erros no console do browser.
- Toast/feedback de sucesso visível.

- [ ] **Step 4: Verificar que a lista de Frota reflete o novo status do equipamento**

1. Navegar para Frota.
2. Buscar pelo equipamento.

Expected:
- Status do equipamento agora aparece como "Manutenção Corretiva" (ou label equivalente).
- Sem necessidade de F5 (invalidação automática funciona).

- [ ] **Step 5: Concluir a OS e verificar que volta para Ativa na Frota**

1. Voltar para Manutenção → OS criada.
2. Mover status para `concluida`.
3. Navegar para Frota.

Expected:
- Equipamento aparece como "Ativa" novamente, sem F5.

- [ ] **Step 6: Verificar timeline no FrotaDetalhe**

1. Frota → click no equipamento → aba/seção Histórico.

Expected:
- Timeline mostra 2 transições novas vinculadas à OS (motivo "OS XXX iniciou execução" e "OS XXX concluída").

- [ ] **Step 7: Cleanup**

Excluir a OS de teste (soft-delete via UI ou direto via SQL):

```sql
delete from public.historico_status_equipamento where os_id='<OS_TESTE_ID>';
delete from public.os_transicoes where os_id='<OS_TESTE_ID>';
delete from public.ordens_servico where id='<OS_TESTE_ID>';
```

---

### Task 9: Atualizar o audit document e fechar o item #1

**Files:**
- Modify: `frota-manutencao-audit.md` (se commitado, marcar item #1 como resolvido)

- [ ] **Step 1: Verificar se o audit está commitado**

Run: `git ls-files frota-manutencao-audit.md`
- Se retornar o arquivo: prosseguir step 2.
- Se vazio (arquivo untracked): pular para step 3 (nada a fazer).

- [ ] **Step 2: Marcar item #1 como ✅ resolvido na tabela de prioridades**

Editar a tabela em `frota-manutencao-audit.md` Fase 8, linha do item #1, mudar a coluna **Prioridade** de `🔴 ALTA` para `✅ RESOLVIDO`. Adicionar ao final do "Problema" a referência da migration: ` (resolvido em migration 20260522130000 + spec 2026-05-22-os-equipamento-status-sync-design)`.

```bash
git add frota-manutencao-audit.md
git commit -m "docs(audit): item #1 resolvido (OS↔equipamento status sync)"
```

- [ ] **Step 3: Não há audit commitado ainda**

Caso o audit ainda esteja untracked, simplesmente não atualizar agora. Quando o usuário decidir commitar o audit, ele já refletirá o estado das outras correções pendentes.

---

## Self-Review

✅ **Spec coverage:**
- Seção 3 Arquitetura → Task 1 (migration) + Task 3+4 (hooks).
- Seção 4 SQL → Task 1.
- Seção 5 Matriz de comportamento → Task 5 (smoke) + Task 6 (T1–T19).
- Seção 6 Edge-cases E1–E10 → coberto por T1–T19 (E9 aguardando_aprovacao em T16-T18; E10 invariante de `ativo` em T1).
- Seção 7 Mudanças no client → Task 3 + Task 4.
- Seção 8 Error handling → cobrição via T5/T6/T7/T8 (cancelar sem iniciar, race covers, soft-delete).
- Seção 9 Plano de testes T1–T19 → Task 6 inteira.
- Seção 10 Out-of-scope → não há tasks (correto).
- Seção 11 Arquivos → Task 1 e Tasks 3+4.
- Seção 12 Dependências com #3/#4/#5 → mencionado nos comments SQL e no audit.

✅ **Placeholder scan:** sem TBD/TODO. `<EQUIP_ID>`, `<OS_TESTE_ID>`, `<timestamp>` são marcadores legítimos para preenchimento durante execução, sempre explicados no contexto.

✅ **Type consistency:** `tg_os_sync_equipamento_status` e `trg_os_sync_equipamento_status_upd` usados consistentemente em todas as tasks. Caminhos de arquivo e linhas conferem com o estado real do código (verificado: hook em linhas 213 e 249).

---

## Rollback

Se algo der errado após Task 2 e for necessário reverter:

```sql
drop trigger if exists trg_os_sync_equipamento_status_upd on public.ordens_servico;
drop function if exists public.tg_os_sync_equipamento_status();
```

E `git revert` dos commits das Tasks 3+4 (1 commit) e Task 1 (1 commit).

Tempo total: ~2 minutos.

---

*Plan gerado via Superpowers writing-plans skill. Spec source: `docs/superpowers/specs/2026-05-22-os-equipamento-status-sync-design.md`.*
