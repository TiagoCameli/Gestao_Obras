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

-- Seed: as 4 transportadoras ativas com card hoje. "Transportadora Triunfo"
-- foi renomeada para "LMC Transportadora" (todos os movimentos antigos
-- migraram). ETAM Construtora fica de fora do default (saldo zero, card
-- removido em 2026-05-11) — pode ser adicionada depois no "Gerenciar cards".
-- Nomes que não casarem são ignorados (a migration NÃO falha).
insert into public.frete_dashboard_cards_config (id, fornecedor_ids)
select 'global', coalesce(array(
  select f.id
  from (values
    ('areacre', 1),
    ('lmc transportadora', 2),
    ('andrade transporte', 3),
    ('emt transportes', 4)
  ) as ord(nome, pos)
  join public.fornecedores f on lower(trim(f.nome)) = ord.nome
  order by ord.pos
), '{}'::text[])
on conflict (id) do nothing;
