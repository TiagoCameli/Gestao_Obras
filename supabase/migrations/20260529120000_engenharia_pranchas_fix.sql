-- Engenharia — Prancha v1: tabelas, índices, RLS e SECDEF de salvar com versão.
-- Espelha engenharia_calculos. Spec: docs/superpowers/specs/2026-05-28-engenharia-prancha-quadro-livre-design.md
-- Rollback: 20260529120100_engenharia_pranchas_rollback.sql

begin;

-- ── Tabelas ───────────────────────────────────────────────
create table public.engenharia_pranchas (
  id              uuid primary key default gen_random_uuid(),
  pasta_id        uuid not null references public.engenharia_pastas(id) on delete cascade,
  titulo          text not null,
  documento_json  jsonb not null default '{}'::jsonb,
  versao          int not null default 1,
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  deleted_at      timestamptz null
);
create index engenharia_pranchas_pasta_idx      on public.engenharia_pranchas (pasta_id);
create index engenharia_pranchas_deleted_at_idx on public.engenharia_pranchas (deleted_at);

create table public.engenharia_pranchas_versoes (
  id              uuid primary key default gen_random_uuid(),
  prancha_id      uuid not null references public.engenharia_pranchas(id) on delete cascade,
  versao          int not null,
  documento_json  jsonb not null,
  autor_id        uuid references auth.users(id),
  criado_em       timestamptz not null default now()
);
create unique index engenharia_pranchas_versoes_unique on public.engenharia_pranchas_versoes (prancha_id, versao);
create index engenharia_pranchas_versoes_prancha_idx on public.engenharia_pranchas_versoes (prancha_id);

-- ── RLS ───────────────────────────────────────────────────
alter table public.engenharia_pranchas enable row level security;

create policy engenharia_pranchas_select on public.engenharia_pranchas
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_pranchas_select_lixeira on public.engenharia_pranchas
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_pranchas_insert on public.engenharia_pranchas
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_prancha'));

create policy engenharia_pranchas_update on public.engenharia_pranchas
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_prancha')
    or private.current_has_action('excluir_engenharia_prancha')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_prancha')
    or private.current_has_action('excluir_engenharia_prancha')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_pranchas_delete on public.engenharia_pranchas
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

alter table public.engenharia_pranchas_versoes enable row level security;

create policy engenharia_pranchas_versoes_select on public.engenharia_pranchas_versoes
  for select to authenticated
  using (private.current_has_action('ver_historico_engenharia'));

create policy engenharia_pranchas_versoes_insert on public.engenharia_pranchas_versoes
  for insert to authenticated
  with check (private.current_has_action('editar_engenharia_prancha'));

create policy engenharia_pranchas_versoes_delete on public.engenharia_pranchas_versoes
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ── SECDEF: salvar prancha com versão (atômico + optimistic concurrency) ──
create or replace function public.engenharia_salvar_prancha_com_versao(
  p_prancha_id uuid,
  p_titulo text,
  p_documento_json jsonb,
  p_versao_atual int
)
returns table (ok boolean, nova_versao int, motivo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_versao_db int;
  v_doc_db jsonb;
begin
  if not private.current_has_action('editar_engenharia_prancha') then
    return query select false, null::int, 'sem_permissao';
    return;
  end if;

  select versao, documento_json into v_versao_db, v_doc_db
    from public.engenharia_pranchas
   where id = p_prancha_id and deleted_at is null
   for update;

  if not found then
    return query select false, null::int, 'prancha_nao_encontrada';
    return;
  end if;

  if v_versao_db <> p_versao_atual then
    return query select false, v_versao_db, 'conflito_versao';
    return;
  end if;

  insert into public.engenharia_pranchas_versoes (prancha_id, versao, documento_json, autor_id)
  values (p_prancha_id, v_versao_db, v_doc_db, v_user);

  update public.engenharia_pranchas
     set titulo = p_titulo,
         documento_json = p_documento_json,
         versao = v_versao_db + 1,
         atualizado_em = now()
   where id = p_prancha_id;

  delete from public.engenharia_pranchas_versoes
   where prancha_id = p_prancha_id
     and id not in (
       select id from public.engenharia_pranchas_versoes
        where prancha_id = p_prancha_id
        order by versao desc
        limit 50
     );

  return query select true, v_versao_db + 1, ''::text;
end $$;

grant execute on function public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int) to authenticated;
revoke execute on function public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int) from anon, public;

comment on function public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int)
  is 'Engenharia: salva prancha atomicamente (snapshot + update). Optimistic concurrency via p_versao_atual. Cap 50 versoes. SECDEF.';

commit;
