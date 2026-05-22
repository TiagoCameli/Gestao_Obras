# OS ↔ Equipamento Status Sync — Design

**Item da auditoria:** `frota-manutencao-audit.md` Fase 8, prioridade #1 (🔴 ALTA).
**Data:** 2026-05-22.
**Status:** Design aprovado por seção, aguardando revisão final do usuário.
**Próximo passo:** invocar `superpowers:writing-plans` após aprovação.

---

## 1. Problema

Quando uma OS é aberta no sistema, o `status` do equipamento associado NÃO muda automaticamente para `manutencao_corretiva` (ou `manutencao_preventiva`). Quando a OS conclui, o status NÃO volta automaticamente para `ativa`. Toda transição depende de o usuário clicar manualmente em `StatusDropdown` → `StatusChangeMotivoModal`.

**Consequências em produção:**
- Equipamento aparece "operacional" no dashboard enquanto está fisicamente parado na oficina.
- Continua recebendo abastecimento de combustível (nenhuma regra de bloqueio).
- Pode receber apontamento de horas — mas as horas registradas são do mecânico mexendo, não horas operacionais.
- Pode receber checklist pré-uso de uma máquina em conserto.
- `% frota disponível` no dashboard calcula errado.
- Quando OS conclui, equipamento fica eternamente "em manutenção" se ninguém clicar para reativar.

**Contexto do banco existente:**
- `equipamentos.status` CHECK ∈ `{ativa, manutencao_preventiva, manutencao_corretiva, fora_funcionamento}`.
- `ordens_servico.status` ∈ `{rascunho, aberta, aguardando_pecas, em_execucao, aguardando_aprovacao, concluida, cancelada}`.
- `ordens_servico.tipo` ∈ `{preventiva, corretiva, preditiva, melhoria, garantia, recall}`.
- `historico_status_equipamento.os_id` já é coluna nullable — pronta para vincular transição à OS.
- Triggers `tg_os_grava_transicao` e `registra_execucao_atividade_em_conclusao` já existem e seguem padrão SECURITY DEFINER + `search_path = pg_catalog, public`.

---

## 2. Decisões tomadas

| Pergunta | Resposta | Justificativa |
|---|---|---|
| Gatilho DB vs hook client | **Trigger DB** | Padrão do projeto (`tg_os_grava_transicao`, `tg_sync_custo_pecas_os`); atomic com UPDATE da OS; evita o anti-pattern dos 2-calls do Item #5 |
| Quando equipamento muda para "em manutenção" | **Quando OS entra em `em_execucao` pela 1ª vez** | Operador escolheu este momento; estados `rascunho`/`aberta`/`aguardando_pecas` deixam equipamento disponível enquanto OS é só "agendamento" |
| Quando volta para "ativa" | **Quando OS sai de `em_execucao` ou `aguardando_aprovacao` para `concluida`/`cancelada`/soft-delete** | Fluxo padrão da OS é `em_execucao → aguardando_aprovacao → concluida`; ambos os estados intermediários significam "equipamento ainda parado". Sempre volta para `ativa` (mesmo se vinha de `fora_funcionamento`). |
| Equipamento em `fora_funcionamento` ao abrir OS | **Sobrescreve totalmente** (vai e volta) | Trata como qualquer outro estado; lógica mais simples |
| Mapeamento `tipo` OS → `status` equipamento | **`preventiva, preditiva → manutencao_preventiva`; resto → `manutencao_corretiva`** | Preditiva é planejada por condição (natureza preventiva); corretiva/melhoria/garantia/recall todas implicam algo a corrigir |
| Coluna `equipamentos.ativo` | **NÃO é tocada pelo trigger** | Invariante existente do projeto (migration `20260503210000_equipamentos_status_detalhado.sql`): `ativo = (status != 'fora_funcionamento')`. Equipamento em manutenção é `ativo=true` (ainda na frota corrente). Mexer aqui causaria regressão em `SaidaCombustivelForm` (filtra `ativo !== false`), em PDFs/dashboards e em índices parciais. |

---

## 3. Arquitetura

Tudo no banco, um único trigger + uma única função:

```
ordens_servico (UPDATE)
        │
        ▼
[WHEN cláusula]──── filtra disparos relevantes:
        │           • OLD.status ≠ 'em_execucao' AND NEW.status = 'em_execucao'  (IDA)
        │           • OLD.status IN ('em_execucao','aguardando_aprovacao')
        │             AND NEW.status IN ('concluida','cancelada')  (VOLTA)
        │           • OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
        │             AND OLD.status IN ('em_execucao','aguardando_aprovacao')  (SOFT-DELETE)
        ▼
tg_os_sync_equipamento_status()
   SECURITY DEFINER
   SET search_path = pg_catalog, public
        │
        ├──[IDA]──▶ UPDATE equipamentos SET status = mapeia(NEW.tipo)
        │          (NÃO toca em equipamentos.ativo — preserva invariante)
        │          INSERT historico_status_equipamento (os_id = NEW.id, motivo)
        │
        └──[VOLTA + SOFT-DELETE]──▶
                   verifica se há OUTRA OS ativa (em_execucao/aguardando_aprovacao) p/ mesmo equipamento
                   se sim → no-op (mantém em manutenção)
                   se não → UPDATE equipamentos SET status = 'ativa'
                            INSERT historico_status_equipamento (os_id = NEW.id, motivo)
```

**Componentes novos (1 migration):**
- Função `public.tg_os_sync_equipamento_status()` — plpgsql, SECURITY DEFINER, `search_path = pg_catalog, public`.
- Trigger `trg_os_sync_equipamento_status_upd` — `AFTER UPDATE OF status, deleted_at ON public.ordens_servico FOR EACH ROW`.

**Componentes existentes que NÃO mudam:**
- Triggers `tg_os_grava_transicao`, `registra_execucao_atividade_em_conclusao` — continuam funcionando lado a lado.
- Hooks `useCriarOS`, `useMudarStatusOS`, `useExcluirOS` — sem mudança de assinatura.
- `StatusChangeMotivoModal` — continua disponível para mudanças manuais sem OS associada (ex: sucateamento, vazamento detectado sem OS).

---

## 4. Implementação SQL

```sql
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
    -- Manutencao mantem ativo=true; mexer aqui regrediria SaidaCombustivelForm,
    -- PDFs e indices parciais.
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
```

### Justificativas de design SQL

- **SECURITY DEFINER:** trigger precisa escrever em `equipamentos` e `historico_status_equipamento` mesmo se o usuário invocador perder esses privilégios após o Item #3 (RLS tighten).
- **`search_path = pg_catalog, public`:** mesmo padrão de `tg_os_pecas_valida_saldo` e `registra_execucao_atividade_em_conclusao`; imune a schema shadowing.
- **`AFTER UPDATE OF status, deleted_at`:** evita disparos em UPDATEs de `custo_*` (que ocorrem com alta frequência via `tg_sync_custo_pecas_os`).
- **ID determinístico `'hist-os-' || NEW.id || '-' || epoch`:** rastreável; ON CONFLICT cobre re-execução acidental do mesmo INSERT na mesma microssegundo (extremamente improvável mas defensivo).

---

## 5. Matriz de comportamento

| Cenário | OLD.status | NEW.status | NEW.deleted_at | Ação | Mudança no equipamento |
|---|---|---|---|---|---|
| Criar OS | (INSERT) | aberta | NULL | — | — |
| Iniciar execução | aberta | em_execucao | NULL | **IDA** | `ativa` → `manutencao_*` |
| Aguardando peças | em_execucao | aguardando_pecas | NULL | — | mantém em manutenção |
| Retomar do aguardando_pecas | aguardando_pecas | em_execucao | NULL | IDA (idempotente) | já em manutenção: no-op |
| Concluir | em_execucao | concluida | NULL | **VOLTA** | `manutencao_*` → `ativa` |
| Cancelar do meio | em_execucao | cancelada | NULL | **VOLTA** | `manutencao_*` → `ativa` |
| Cancelar sem ter iniciado | aberta | cancelada | NULL | — | nunca tocou no equip |
| Soft-delete no meio | em_execucao | em_execucao | now() | **VOLTA** | `manutencao_*` → `ativa` |
| Soft-delete já concluída | concluida | concluida | now() | — | já voltou ao concluir |
| Reabrir e re-concluir | concluida→aberta→em_execucao→concluida | (3 disparos) | NULL | IDA + VOLTA | ciclo completo, idempotente |
| 2 OSs simultâneas, 1 conclui | em_execucao | concluida | NULL | — (outra OS ativa) | mantém em manutenção |

---

## 6. Edge-cases endereçados

**E1 — Reabertura de OS concluída.** Fluxo `concluida → aberta → em_execucao → concluida` gera 2 pares (IDA, VOLTA) no histórico — não é bug, é registro fiel.

**E2 — Duas OSs em paralelo no mesmo equipamento.**
- OS-A (corretiva) → em_execucao: equip vira `manutencao_corretiva`.
- OS-B (preventiva) → em_execucao: equip muda para `manutencao_preventiva` (sobrescreve). Audit log preserva ambas.
- OS-A conclui: query `outras_em_exec > 0` (vê OS-B) → no-op.
- OS-B conclui: equip volta para `ativa`.
- **Quirk aceito:** status do equipamento reflete a OS "mais recente que mexeu" entre as concorrentes.

**E3 — Hard-delete de OS via PostgREST direto.** Trigger é AFTER UPDATE; hard-delete não dispara. Equipamento ficaria órfão em `manutencao_*`. **Mitigado pelo Item #3** da auditoria (RLS tighten elimina DELETE direto por Operador).

**E4 — Equipamento deletado enquanto OS está aberta.** FK `ordens_servico.equipamento_id → equipamentos.id ON DELETE RESTRICT` bloqueia. Sem ação necessária.

**E5 — Edição da OS reapontando para outro equipamento.** Caso raríssimo. Trigger atua no NOVO equipamento, deixando o anterior em manutenção órfã. **Ressalva:** considerar futuramente bloquear edição de `equipamento_id` após criação. **Fora do escopo deste item.**

**E6 — Equipamento já em manutenção por mudança manual.** Idempotência da IDA: se equip já está no destino, trigger faz no-op (sem linha nova no histórico). Trade-off: perde-se o vínculo `os_id` no histórico nesse caso específico. Aceitável.

**E7 — Equipamento em `fora_funcionamento`.** Sobrescreve totalmente (decisão da pergunta 3).

**E8 — `NEW.numero` NULL.** `COALESCE(NEW.numero, NEW.id)` no motivo cobre defensivamente.

---

## 7. Mudanças no client

### Resumo: zero mudança de assinatura nos hooks.

Apenas adicionar invalidações em `onSuccess` para que o React Query reflita o novo status do equipamento.

**Arquivo:** `src/hooks/useOrdensServico.ts`

**`useMudarStatusOS` `onSuccess`** — adicionar:
```ts
qc.invalidateQueries({ queryKey: ['equipamentos'] });
qc.invalidateQueries({
  predicate: (q) => q.queryKey[0] === 'historico_status_equipamento'
});
```

**`useExcluirOS` `onSuccess`** — adicionar as 2 mesmas linhas.

**`useCriarOS` `onSuccess`** — nenhuma mudança (criar OS não dispara trigger).

### Componentes que ganham comportamento "grátis"

- `FrotaList` / `FrotaGrid` / `FrotaStats` — re-renderizam após invalidação de `['equipamentos']`.
- `FrotaDetalhe` → `HistoricoEquipamentoSection` — timeline pega nova linha automaticamente.
- `StatusDropdown` / `StatusChangeMotivoModal` — continuam funcionando para mudanças manuais.

### Não-mudanças deliberadas

- Sem indicador visual em `OSDetalhe` ("este botão Concluir vai liberar o equipamento") — não é bloqueante.
- Sem feature flag — rollback de 5 linhas + drop trigger.
- Sem alteração de assinatura de mutation para evitar refator de chamadores.

---

## 8. Error handling

**Filosofia:** trigger faz parte da **mesma transação** do UPDATE da OS. Qualquer passo que falhar dentro do trigger aborta a transação inteira → UPDATE da OS rolla back. Ou tudo consistente, ou nada.

| Caso | Comportamento | Razão |
|---|---|---|
| FK violation: equipamento_id da OS não existe | `RETURN NEW` defensivo; UPDATE da OS prossegue | Não quebrar fluxo por inconsistência histórica |
| CHECK constraint em equipamentos.status violada | Erro `23514` propaga; UPDATE aborta | Enum desatualizado é bug real, falhar ruidosamente |
| INSERT histórico falha por FK/NOT NULL | Transação aborta | Audit log é parte do estado consistente |
| Hard-delete via PostgREST | Trigger não dispara; mitigado pelo Item #3 | Endereçado em outro item |
| Race: 2 UPDATEs simultâneos na mesma OS | Postgres serializa via row-lock; 2º vê OLD.status já novo → no-op | Cláusula `OLD.status IS DISTINCT FROM` defende |
| Race: 2 OSs concluindo ao mesmo tempo | READ COMMITTED pode causar orfanização rara (ambas no-op) | Risco residual aceito; usuário reativa manual se ocorrer |
| Invalidação no client falha | UI fica até 60s stale; próximo focus corrige | Estado de verdade no DB; UI eventualmente sincroniza |

**Sem retry automático. Sem fallback client-side. Sem tabela de erros separada.**

---

## 9. Plano de testes

### Estratégia

Testes **manuais** + queries SQL de verificação em local/staging. Sem suite Vitest/Playwright (repo não tem cobertura de trigger hoje; criar do zero é fora do escopo).

### Checklist de cenários (T1–T15)

| # | Cenário | Esperado |
|---|---|---|
| T1 | Happy path corretiva: criar → em_execucao → concluida | Equip vira `manutencao_corretiva` e volta para `ativa`; 2 linhas no histórico com `os_id` |
| T2 | Happy path preventiva | Status intermediário = `manutencao_preventiva` |
| T3 | Mapeamento preditiva | → `manutencao_preventiva` |
| T4 | Mapeamento melhoria/garantia/recall | Cada uma → `manutencao_corretiva` |
| T5 | Cancelar sem ter iniciado (aberta → cancelada) | Equip continua `ativa`; sem linha no histórico |
| T6 | Cancelar depois de iniciar | Volta para `ativa`; histórico com motivo "cancelada" |
| T7 | Soft-delete no meio | Volta para `ativa`; motivo "excluída" |
| T8 | Soft-delete depois de concluir | No-op; sem linha extra |
| T9 | Aguardando_pecas no meio | Equip mantém `manutencao_*`; idempotência ao retomar |
| T10 | Reabertura completa | 4 linhas no histórico (2 IDA + 2 VOLTA) |
| T11 | Duas OSs paralelas | Mantém em manutenção até a última concluir |
| T12 | fora_funcionamento sobrescreve | Vai para `manutencao_*` e volta para `ativa` (não para fora_funcionamento) |
| T13 | Idempotência: equipamento já em manutenção manual | Trigger não duplica histórico |
| T14 | FK defensiva (equipamento órfão) | Inspeção SQL do ramo `IF v_equip_status_atual IS NULL` |
| T15 | Performance: UPDATE em massa de 100 OSs | ~1s extra aceito |

### Verificação SQL pós-migration

```sql
-- 1. Trigger existe e habilitada
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgname='trg_os_sync_equipamento_status_upd';

-- 2. Função com SECURITY DEFINER + search_path correto
SELECT prosecdef, proconfig FROM pg_proc
WHERE proname='tg_os_sync_equipamento_status';
-- Esperado: prosecdef=true, proconfig={search_path=pg_catalog, public}

-- 3. Após T1: histórico tem linhas com os_id preenchido
SELECT count(*) FROM historico_status_equipamento WHERE os_id IS NOT NULL;
-- Esperado: > 0
```

### Critérios de aprovação

- ✅ T1–T15 passam.
- ✅ Sem regressão visual em FrotaList/FrotaDetalhe/OSDetalhe.
- ✅ Console limpo (sem erros React Query).
- ✅ Advisors security sem novo lint após migration.

### Rollback (2 minutos)

```sql
DROP TRIGGER trg_os_sync_equipamento_status_upd ON public.ordens_servico;
DROP FUNCTION public.tg_os_sync_equipamento_status();
```

+ reverter ~5 linhas em `useOrdensServico.ts`.

---

## 10. Out of scope (registrado para depois)

- **Bloquear edição de `ordens_servico.equipamento_id` após criação** (E5).
- **Indicador visual em `OSDetalhe`** mostrando que concluir liberará o equipamento.
- **Suite automatizada de testes de trigger** (Vitest com mock pg ou Playwright contra staging).
- **Auto-mudança de status quando OS sai de em_execucao para aguardando_pecas** — decisão: NÃO mudar (combinou que o estado intermediário mantém em manutenção).
- **Notificação ao operador** quando o status muda automaticamente — talvez no futuro.

---

## 11. Arquivos a serem criados/modificados

| Arquivo | Tipo | Linhas estimadas |
|---|---|---|
| `supabase/migrations/<timestamp>_os_sync_equipamento_status.sql` | NOVO | ~110 |
| `src/hooks/useOrdensServico.ts` | EDITAR | +6 (2 invalidações em 2 hooks + comentário) |

---

## 12. Dependências e ordem com outros itens da auditoria

- **Independente do Item #3 (RLS tighten):** este item pode ser entregue antes; mitigação de hard-delete (E3) virá quando Item #3 rodar.
- **Independente do Item #5 (mudança de status manual transacional):** ambos endereçam transações atômicas, mas em fluxos diferentes — não há conflito.
- **Compatível com Item #4 (`registra_execucao_atividade_em_conclusao` ID determinístico):** os dois triggers AFTER UPDATE coexistem na mesma OS sem interferência.

---

*Spec elaborado via Superpowers brainstorming. Próximo: revisão do usuário → invocar `superpowers:writing-plans`.*
