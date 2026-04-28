-- ═══════════════════════════════════════════════════════════════════════════
-- Apontamento por Serviço — passa a usar os itens de contrato da obra
-- (rodotracker_contract_items) como catálogo de serviços. Para "improdutivo"
-- o servico_id é opcional (a hora parada não tem item de contrato).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Drop FK antiga e converte servico_id pra text + nullable
alter table public.apont_apontamentos_servico
  drop constraint if exists apont_apontamentos_servico_servico_id_fkey;

alter table public.apont_apontamentos_servico
  alter column servico_id drop not null,
  alter column servico_id type text using servico_id::text;

-- 2) Nova FK pra rodotracker_contract_items
alter table public.apont_apontamentos_servico
  add constraint apont_aps_servico_fk
  foreign key (servico_id)
  references public.rodotracker_contract_items(id)
  on delete restrict;

-- 3) Drop catálogo antigo (não é mais usado)
drop table if exists public.apont_servicos cascade;
