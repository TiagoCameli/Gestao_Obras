-- Marco 1 / PR7 — Financeiro do equipamento.
--
-- 1 linha por equipamento (PK = equipamento_id). Os campos relevantes
-- dependem da propriedade do equipamento:
--   - propriedade='propria': aquisição, financiamento, valor de mercado,
--     depreciação (via vida útil).
--   - propriedade='alugada': contrato com locadora, valor mensal,
--     vigência, indexador, o que está incluso (manutenção/combustível/operador).
--
-- O campo manutencao_inclusa é especialmente importante: se TRUE, OS do
-- equipamento são "informativas" e o custo NÃO entra no R$/hora trabalhada
-- (porque a locadora paga). Sem isso, comparativo próprio vs alugado fica
-- enviesado.

begin;

create table if not exists public.financeiro_equipamento (
  equipamento_id text primary key references public.equipamentos(id) on delete cascade,

  -- ─── Próprios ───
  valor_aquisicao numeric(14,2),
  fornecedor_aquisicao_id text references public.fornecedores(id) on delete set null,
  nf_aquisicao text not null default '',
  forma_aquisicao text check (
    forma_aquisicao is null
    or forma_aquisicao in ('a_vista','financiado','consorcio','leasing','outro')
  ),
  banco_financiador text not null default '',
  valor_parcela numeric(14,2),
  prestacoes_total int check (prestacoes_total is null or prestacoes_total >= 0),
  prestacoes_pagas int check (prestacoes_pagas is null or prestacoes_pagas >= 0),
  valor_mercado_atual numeric(14,2),
  vida_util_meses int check (vida_util_meses is null or vida_util_meses > 0),
  valor_residual_estimado numeric(14,2),

  -- ─── Alugados ───
  locadora_id text references public.fornecedores(id) on delete set null,
  contrato_numero text not null default '',
  valor_mensal numeric(14,2),
  vigencia_inicio date,
  vigencia_fim date,
  indexador text check (
    indexador is null
    or indexador in ('IPCA','IGPM','INPC','prefixado','outro')
  ),
  manutencao_inclusa boolean not null default false,
  combustivel_incluso boolean not null default false,
  operador_incluso boolean not null default false,
  horas_minimas_mensais numeric,

  -- ─── Comum ───
  observacoes text not null default '',
  arquivo_urls text[] not null default '{}',

  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists financeiro_equipamento_locadora_idx
  on public.financeiro_equipamento (locadora_id)
  where locadora_id is not null;

alter table public.financeiro_equipamento enable row level security;

drop policy if exists "Authenticated full access" on public.financeiro_equipamento;
create policy "Authenticated full access" on public.financeiro_equipamento
  for all to authenticated using (true) with check (true);

comment on table public.financeiro_equipamento is
  'Dados financeiros do equipamento. Campos de aquisição (próprio) e locação '
  '(alugado) coexistem; preencher conforme propriedade. Coluna manutencao_inclusa '
  'sinaliza contratos onde locadora paga manutenção (afeta cálculo de R$/hora).';

comment on column public.financeiro_equipamento.manutencao_inclusa is
  'Quando TRUE, OS do equipamento são informativas (custo não entra no R$/h '
  'porque a locadora paga). Crítico para comparativo próprio × alugado honesto.';

create or replace view public.v_equipamento_depreciacao as
select
  f.equipamento_id,
  f.valor_aquisicao,
  f.valor_residual_estimado,
  f.vida_util_meses,
  case
    when f.valor_aquisicao is null
      or f.vida_util_meses is null
      or f.vida_util_meses <= 0
      then null
    else (
      coalesce(f.valor_aquisicao,0) - coalesce(f.valor_residual_estimado,0)
    ) / f.vida_util_meses
  end as depreciacao_mensal,
  e.data_aquisicao
from public.financeiro_equipamento f
join public.equipamentos e on e.id = f.equipamento_id
where e.propriedade = 'propria'
  and f.valor_aquisicao is not null;

comment on view public.v_equipamento_depreciacao is
  'Depreciação mensal projetada por equipamento próprio (linear). Pra usar '
  'no relatório anual de custo total do equipamento.';

commit;
