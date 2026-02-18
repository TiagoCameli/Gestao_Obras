-- Pedidos de Compra
create table if not exists pedidos_compra (
  id text primary key,
  numero text not null unique,
  data text not null,
  obra_id text references obras(id),
  solicitante text not null default '',
  urgencia text not null default 'normal',
  status text not null default 'pendente',
  observacoes text default '',
  itens jsonb not null default '[]'::jsonb,
  criado_por text default ''
);

-- Cotações
create table if not exists cotacoes (
  id text primary key,
  numero text not null unique,
  data text not null,
  pedido_compra_id text references pedidos_compra(id),
  prazo_resposta text default '',
  status text not null default 'em_cotacao',
  fornecedores jsonb not null default '[]'::jsonb,
  itens_pedido jsonb not null default '[]'::jsonb,
  observacoes text default '',
  criado_por text default ''
);

-- Ordens de Compra
create table if not exists ordens_compra (
  id text primary key,
  numero text not null unique,
  data_criacao text not null,
  data_entrega text default '',
  obra_id text references obras(id),
  etapa_obra_id text,
  fornecedor_id text references fornecedores(id),
  cotacao_id text references cotacoes(id),
  pedido_compra_id text references pedidos_compra(id),
  itens jsonb not null default '[]'::jsonb,
  custos_adicionais jsonb not null default '{"frete":0,"outrasDespesas":0,"impostos":0,"desconto":0}'::jsonb,
  total_materiais numeric not null default 0,
  total_geral numeric not null default 0,
  condicao_pagamento text default '',
  prazo_entrega text default '',
  status text not null default 'emitida',
  observacoes text default '',
  entrada_insumos boolean not null default false,
  criado_por text default ''
);

-- Enable RLS
alter table pedidos_compra enable row level security;
alter table cotacoes enable row level security;
alter table ordens_compra enable row level security;

-- Policies (allow all for authenticated users, matching existing pattern)
create policy "pedidos_compra_all" on pedidos_compra for all using (true) with check (true);
create policy "cotacoes_all" on cotacoes for all using (true) with check (true);
create policy "ordens_compra_all" on ordens_compra for all using (true) with check (true);
