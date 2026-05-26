-- Engenharia — Onda 1.3: triggers SECDEF em obras
-- (A) AFTER INSERT  → cria pasta raiz automaticamente
-- (B) AFTER UPDATE of nome → sincroniza nome da pasta
-- (C) BEFORE DELETE → converte pasta raiz em avulsa (decisão D-3)
--
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4.Triggers).
-- Rollback: 20260526170100_engenharia_triggers_obras_rollback.sql.
--
-- Todas as funções são SECURITY DEFINER + search_path = public, pg_temp fixado
-- (decisão D-2 aprovada 2026-05-26).

begin;

-- (A) ============================================================
create or replace function public.engenharia_after_insert_obra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.engenharia_pastas (obra_id, nome, tipo, caminho, criado_por)
  values (new.id, new.nome, 'obra', '/' || new.id, null)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_engenharia_after_insert_obra on public.obras;
create trigger trg_engenharia_after_insert_obra
  after insert on public.obras
  for each row execute function public.engenharia_after_insert_obra();

-- (B) ============================================================
create or replace function public.engenharia_after_update_obra_nome()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.nome is distinct from old.nome then
    update public.engenharia_pastas
       set nome = new.nome,
           atualizado_em = now()
     where obra_id = new.id
       and tipo = 'obra'
       and deleted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_engenharia_after_update_obra_nome on public.obras;
create trigger trg_engenharia_after_update_obra_nome
  after update of nome on public.obras
  for each row execute function public.engenharia_after_update_obra_nome();

-- (C) ============================================================
-- BEFORE DELETE (não AFTER): no AFTER, ON DELETE SET NULL do FK já teria
-- zerado obra_id. Em BEFORE temos OLD.nome ainda disponível.
create or replace function public.engenharia_before_delete_obra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_data_hoje text := to_char(now(), 'YYYY-MM-DD');
begin
  -- Converte a pasta raiz da obra em "avulsa órfã", prefixando nome
  -- com "[Arquivada YYYY-MM-DD]" para o user identificar visualmente.
  update public.engenharia_pastas
     set tipo = 'avulsa',
         nome = '[Arquivada ' || v_data_hoje || '] ' || nome,
         obra_id = null,
         atualizado_em = now()
   where obra_id = old.id
     and tipo = 'obra'
     and deleted_at is null;

  -- Para subpastas (que não eram tipo='obra'), só zera obra_id (FK ON DELETE
  -- SET NULL faria isso, mas explicitar deixa o efeito claro e evita race).
  update public.engenharia_pastas
     set obra_id = null
   where obra_id = old.id
     and tipo <> 'obra';

  return old;
end $$;

drop trigger if exists trg_engenharia_before_delete_obra on public.obras;
create trigger trg_engenharia_before_delete_obra
  before delete on public.obras
  for each row execute function public.engenharia_before_delete_obra();

-- Comentários
comment on function public.engenharia_after_insert_obra()      is 'Engenharia: cria pasta raiz tipo=obra ao inserir em obras. SECDEF.';
comment on function public.engenharia_after_update_obra_nome() is 'Engenharia: sincroniza nome da pasta raiz quando obras.nome muda. SECDEF.';
comment on function public.engenharia_before_delete_obra()     is 'Engenharia: ao deletar obra, converte pasta raiz em avulsa (D-3 2026-05-26). SECDEF.';

-- Backfill: cria pasta raiz para obras existentes que ainda não têm uma.
-- Idempotente: WHERE NOT EXISTS + unique index já garantiriam só 1 pasta por obra.
insert into public.engenharia_pastas (obra_id, nome, tipo, caminho)
select o.id, o.nome, 'obra', '/' || o.id
  from public.obras o
 where not exists (
   select 1 from public.engenharia_pastas p
    where p.obra_id = o.id and p.tipo = 'obra' and p.deleted_at is null
 );

commit;
