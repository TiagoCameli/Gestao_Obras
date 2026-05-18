-- ─────────────────────────────────────────────────────────────────────
-- Recebimento de Ordem de Compra (v2.7)
--
-- Uma OC pode ser recebida em MÚLTIPLAS remessas (parcial → completa).
-- Cada remessa registra: data, NF de entrega, observações, e a lista
-- de itens recebidos com qtd, destino físico final, lote e validade.
--
-- Ao confirmar uma remessa, o app gera EntradaMaterial / EntradaCombustivel
-- automáticas, e amarra esses IDs nos itens do recebimento (rastreabilidade).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists recebimentos_oc (
  id text primary key,
  ordem_compra_id text not null references ordens_compra(id) on delete cascade,
  numero_remessa integer not null,
  data_recebimento text not null,
  nota_fiscal_entrega text default '',
  observacoes text default '',
  itens jsonb not null default '[]'::jsonb,
  recebido_por text not null default '',
  recebido_em text not null default '',
  -- Auditoria padrão Compras v2
  atualizado_em text default null,
  atualizado_por text default null,
  deletado_em text default null,
  deletado_por text default null
);

create index if not exists idx_recebimentos_oc_ordem_compra_id
  on recebimentos_oc (ordem_compra_id);

create index if not exists idx_recebimentos_oc_data
  on recebimentos_oc (data_recebimento desc);

-- Índice único parcial: (oc, número da remessa) só precisa ser único entre
-- remessas ATIVAS. Soft-delete preserva o row pra auditoria, mas o número
-- pode ser reaproveitado pra próxima remessa daquela OC.
create unique index if not exists recebimentos_oc_oc_remessa_ativa_uq
  on recebimentos_oc (ordem_compra_id, numero_remessa)
  where deletado_em is null;

-- RLS: mesmo padrão das outras tabelas do módulo Compras (auth all)
alter table recebimentos_oc enable row level security;

create policy "recebimentos_oc_all" on recebimentos_oc
  for all using (true) with check (true);
