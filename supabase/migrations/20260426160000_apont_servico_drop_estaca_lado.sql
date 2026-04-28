-- ═══════════════════════════════════════════════════════════════════════════
-- Apontamento por Serviço — estaca_inicial / estaca_final / lado deixam
-- de ser obrigatórios (não fazem sentido para todos os tipos de serviço,
-- ex.: "Administração local (%)").
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.apont_apontamentos_servico
  alter column estaca_inicial drop not null,
  alter column estaca_final   drop not null;

alter table public.apont_apontamentos_servico
  drop constraint if exists apont_as_lado_check;

alter table public.apont_apontamentos_servico
  alter column lado drop not null;

alter table public.apont_apontamentos_servico
  add constraint apont_as_lado_check
  check (lado is null or lado in ('direito','esquerdo','ambos'));
