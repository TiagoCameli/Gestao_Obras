-- Fase 1a (parte 5) — Trigger defensivo + backfill remedial.
--
-- PROBLEMA: as colunas `transportadora_id` foram adicionadas como NULLABLE
-- na 030 e backfilled na 040. Mas o frontend (mapper freteToDb e similares)
-- ainda escreve só na coluna `transportadora text` — qualquer INSERT/UPDATE
-- realizado entre a aplicação da 040 e a Fase 4 (que vai atualizar os
-- mappers) deixa transportadora_id NULL. Janela de transição = dias até
-- semanas, então NULLs acumulam.
--
-- SOLUÇÃO: trigger BEFORE INSERT OR UPDATE OF transportadora que resolve
-- transportadora_id automaticamente via lookup em fornecedores. Isso estanca
-- o sangramento em TODOS os caminhos de escrita (mapper antigo, novo, SQL
-- direto, integrações futuras).
--
-- A trigger tem cleanup planejado: removida na Fase 5 junto com o DROP da
-- coluna `transportadora text`.
--
-- Ordem de operações desta migration:
--   1. CREATE FUNCTION fn_autopopulate_transportadora_id (lookup fuzzy)
--   2. CREATE TRIGGER nas 3 tabelas
--   3. UPDATE remedial pra absorver NULLs já acumulados
--   4. RAISE EXCEPTION se sobrar qualquer NULL (zero-tolerância)

begin;

-- Garante extensão (idempotente, já criada pela 040 mas defensivo).
create extension if not exists unaccent;

-- ── 1) Function compartilhada ──
-- IMPORTANTE: precisa ser SECURITY DEFINER (ou public access) pra rodar
-- sob qualquer role. Como não estamos limitando, fica SECURITY INVOKER
-- (default) — basta que authenticated tenha SELECT em fornecedores (já tem
-- via policy "Authenticated full access").
create or replace function public.fn_autopopulate_transportadora_id()
returns trigger
language plpgsql
as $$
begin
  if new.transportadora_id is null and new.transportadora is not null and trim(new.transportadora) <> '' then
    select id into new.transportadora_id
      from public.fornecedores
     where eh_transportadora = true
       and lower(trim(unaccent(nome))) = lower(trim(unaccent(new.transportadora)))
     limit 1;

    -- Lookup falhou: nome digitado não bate com nenhuma transportadora
    -- cadastrada. NÃO abortamos o INSERT (regra: trigger defensivo nunca
    -- quebra produção). Logamos via RAISE WARNING — aparece no Postgres
    -- log + chega ao client como notice. Próximo backfill remedial pega
    -- a row se o cadastro for criado depois.
    if new.transportadora_id is null then
      raise warning 'Transportadora % não encontrada em fornecedores (eh_transportadora=true). Linha inserida com transportadora_id NULL.', new.transportadora;
    end if;
  end if;
  return new;
end;
$$;

-- ── 2) Triggers nas 3 tabelas ──

-- fretes
drop trigger if exists trg_fretes_autopopulate_transportadora_id on public.fretes;
create trigger trg_fretes_autopopulate_transportadora_id
  before insert or update of transportadora on public.fretes
  for each row execute function public.fn_autopopulate_transportadora_id();

-- pagamentos_frete
drop trigger if exists trg_pagamentos_frete_autopopulate_transportadora_id on public.pagamentos_frete;
create trigger trg_pagamentos_frete_autopopulate_transportadora_id
  before insert or update of transportadora on public.pagamentos_frete
  for each row execute function public.fn_autopopulate_transportadora_id();

-- abastecimentos_carreta
drop trigger if exists trg_abastecimentos_carreta_autopopulate_transportadora_id on public.abastecimentos_carreta;
create trigger trg_abastecimentos_carreta_autopopulate_transportadora_id
  before insert or update of transportadora on public.abastecimentos_carreta
  for each row execute function public.fn_autopopulate_transportadora_id();

-- ── 3) Backfill remedial dos NULLs acumulados ──
-- Mesma lógica do 040, mas agora só pras rows que escaparam (NULL atual).
-- Sem o filtro `transportadora_id is null`, isto re-escreveria todas as
-- linhas (overhead desnecessário).

update public.fretes f
   set transportadora_id = forn.id
  from public.fornecedores forn
 where f.transportadora_id is null
   and forn.eh_transportadora = true
   and lower(trim(unaccent(f.transportadora))) = lower(trim(unaccent(forn.nome)));

update public.pagamentos_frete p
   set transportadora_id = forn.id
  from public.fornecedores forn
 where p.transportadora_id is null
   and forn.eh_transportadora = true
   and lower(trim(unaccent(p.transportadora))) = lower(trim(unaccent(forn.nome)));

update public.abastecimentos_carreta a
   set transportadora_id = forn.id
  from public.fornecedores forn
 where a.transportadora_id is null
   and forn.eh_transportadora = true
   and lower(trim(unaccent(a.transportadora))) = lower(trim(unaccent(forn.nome)));

-- ── 4) Validação zero-NULL ──
do $$
declare
  fretes_total int;
  fretes_sem_id int;
  pag_total int;
  pag_sem_id int;
  abast_total int;
  abast_sem_id int;
  exemplos text;
begin
  select count(*) into fretes_total from public.fretes;
  select count(*) into fretes_sem_id from public.fretes where transportadora_id is null;
  select count(*) into pag_total from public.pagamentos_frete;
  select count(*) into pag_sem_id from public.pagamentos_frete where transportadora_id is null;
  select count(*) into abast_total from public.abastecimentos_carreta;
  select count(*) into abast_sem_id from public.abastecimentos_carreta where transportadora_id is null;

  if fretes_sem_id > 0 then
    select string_agg(distinct transportadora, ', ' order by transportadora) into exemplos
      from public.fretes where transportadora_id is null;
    raise exception 'Backfill remedial fretes: % linhas sem transportadora_id (de %). Nomes: %',
      fretes_sem_id, fretes_total, exemplos;
  end if;
  if pag_sem_id > 0 then
    select string_agg(distinct transportadora, ', ' order by transportadora) into exemplos
      from public.pagamentos_frete where transportadora_id is null;
    raise exception 'Backfill remedial pagamentos_frete: % linhas sem transportadora_id (de %). Nomes: %',
      pag_sem_id, pag_total, exemplos;
  end if;
  if abast_sem_id > 0 then
    select string_agg(distinct transportadora, ', ' order by transportadora) into exemplos
      from public.abastecimentos_carreta where transportadora_id is null;
    raise exception 'Backfill remedial abastecimentos_carreta: % linhas sem transportadora_id (de %). Nomes: %',
      abast_sem_id, abast_total, exemplos;
  end if;

  raise notice 'Backfill remedial OK: fretes=%/%, pagamentos_frete=%/%, abastecimentos_carreta=%/%. Trigger ativo nas 3 tabelas.',
    fretes_total - fretes_sem_id, fretes_total,
    pag_total - pag_sem_id, pag_total,
    abast_total - abast_sem_id, abast_total;
end $$;

commit;
