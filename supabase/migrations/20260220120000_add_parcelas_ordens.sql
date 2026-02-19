alter table ordens_compra add column if not exists parcelas jsonb default '[]'::jsonb;
