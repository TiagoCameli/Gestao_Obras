-- ─────────────────────────────────────────────────────────────────────
-- Módulo Financeiro v1: Contas a Pagar
--
-- 5 tabelas:
--   financeiro_categorias  → plano de contas plano (despesa/receita)
--   financeiro_lancamentos → header (OC ou avulso)
--   financeiro_parcelas    → cronograma de pagamento (1:N)
--   financeiro_rateios     → onde o custo é alocado (1:N)
--   financeiro_pagamentos  → registro de pagamento por parcela (1:N)
--
-- Regras de negócio:
--   - 1 parcela = 1 pagamento (delete do pagamento estorna a parcela)
--   - Rateio em valor OU percentual (toggle por linha)
--   - Anexos via Supabase Storage (URLs guardados em array)
--   - Soft-delete pro lançamento (preserva auditoria)
-- ─────────────────────────────────────────────────────────────────────

create table if not exists financeiro_categorias (
  id text primary key,
  nome text not null,
  tipo text not null default 'despesa',
  ordem integer default 0,
  ativo boolean not null default true,
  criado_por text default '',
  criado_em text default '',
  atualizado_em text,
  atualizado_por text,
  deletado_em text,
  deletado_por text
);

create index if not exists idx_financeiro_categorias_ativo
  on financeiro_categorias (ativo, ordem) where deletado_em is null;

alter table financeiro_categorias enable row level security;
create policy "financeiro_categorias_all" on financeiro_categorias
  for all using (true) with check (true);

create table if not exists financeiro_lancamentos (
  id text primary key,
  numero text not null unique,
  origem text not null default 'avulso',
  ordem_compra_id text references ordens_compra(id),
  data_emissao text not null,
  data_vencimento text not null,
  fornecedor_id text references fornecedores(id),
  favorecido_nome text default '',
  empresa_pagadora_id text references empresas(id),
  categoria_id text references financeiro_categorias(id),
  descricao text not null default '',
  valor_total numeric not null default 0,
  forma_pagamento text default '',
  observacoes text default '',
  anexos_urls text[] default '{}',
  status text not null default 'em_aberto',
  criado_por text default '',
  criado_em text default '',
  atualizado_em text,
  atualizado_por text,
  deletado_em text,
  deletado_por text
);

create index if not exists idx_financeiro_lancamentos_status
  on financeiro_lancamentos (status, data_vencimento) where deletado_em is null;
create index if not exists idx_financeiro_lancamentos_oc
  on financeiro_lancamentos (ordem_compra_id) where deletado_em is null;
create index if not exists idx_financeiro_lancamentos_fornecedor
  on financeiro_lancamentos (fornecedor_id) where deletado_em is null;
create index if not exists idx_financeiro_lancamentos_categoria
  on financeiro_lancamentos (categoria_id) where deletado_em is null;

alter table financeiro_lancamentos enable row level security;
create policy "financeiro_lancamentos_all" on financeiro_lancamentos
  for all using (true) with check (true);

create table if not exists financeiro_parcelas (
  id text primary key,
  lancamento_id text not null references financeiro_lancamentos(id) on delete cascade,
  numero integer not null,
  data_vencimento text not null,
  valor numeric not null,
  data_pagamento text,
  valor_pago numeric,
  status text not null default 'em_aberto'
);

create unique index if not exists financeiro_parcelas_uq
  on financeiro_parcelas (lancamento_id, numero);

create index if not exists idx_financeiro_parcelas_status
  on financeiro_parcelas (status, data_vencimento);
create index if not exists idx_financeiro_parcelas_lanc
  on financeiro_parcelas (lancamento_id);

alter table financeiro_parcelas enable row level security;
create policy "financeiro_parcelas_all" on financeiro_parcelas
  for all using (true) with check (true);

create table if not exists financeiro_rateios (
  id text primary key,
  lancamento_id text not null references financeiro_lancamentos(id) on delete cascade,
  tipo_destino text not null,
  obra_id text references obras(id),
  etapa_obra_id text references etapas_obra(id),
  ordem_servico_id text references ordens_servico(id),
  equipamento_id text references equipamentos(id),
  deposito_material_id text references depositos_material(id),
  deposito_id text references depositos(id),
  valor numeric not null default 0,
  percentual numeric,
  observacoes text default ''
);

create index if not exists idx_financeiro_rateios_lanc
  on financeiro_rateios (lancamento_id);
create index if not exists idx_financeiro_rateios_obra
  on financeiro_rateios (obra_id, etapa_obra_id);
create index if not exists idx_financeiro_rateios_os
  on financeiro_rateios (ordem_servico_id);

alter table financeiro_rateios enable row level security;
create policy "financeiro_rateios_all" on financeiro_rateios
  for all using (true) with check (true);

create table if not exists financeiro_pagamentos (
  id text primary key,
  parcela_id text not null references financeiro_parcelas(id) on delete cascade,
  data_pagamento text not null,
  valor numeric not null,
  forma_pagamento text default '',
  comprovante_url text,
  observacoes text default '',
  criado_por text default '',
  criado_em text default ''
);

create index if not exists idx_financeiro_pagamentos_parcela
  on financeiro_pagamentos (parcela_id);
create index if not exists idx_financeiro_pagamentos_data
  on financeiro_pagamentos (data_pagamento desc);

alter table financeiro_pagamentos enable row level security;
create policy "financeiro_pagamentos_all" on financeiro_pagamentos
  for all using (true) with check (true);

-- Seed: 11 categorias padrão
insert into financeiro_categorias (id, nome, tipo, ordem, ativo) values
  ('fc_material',     'Material de construção',  'despesa', 10, true),
  ('fc_mo_terc',      'Mão de obra terceirizada', 'despesa', 20, true),
  ('fc_salario',      'Salário / Folha',          'despesa', 30, true),
  ('fc_combustivel',  'Combustível',              'despesa', 40, true),
  ('fc_manut_equip',  'Manutenção de equipamento','despesa', 50, true),
  ('fc_loc_equip',    'Locação de equipamento',   'despesa', 60, true),
  ('fc_frete',        'Frete',                    'despesa', 70, true),
  ('fc_imposto',      'Imposto / Taxa',           'despesa', 80, true),
  ('fc_admin',        'Administrativo / Sede',    'despesa', 90, true),
  ('fc_servico',      'Serviço técnico',          'despesa', 100, true),
  ('fc_outros',       'Outros',                   'despesa', 999, true)
on conflict (id) do nothing;
