-- Rollback de 20260820163500_frete_tipo_transferencia_fix.sql
--
-- ATENÇÃO: dropar a coluna apaga a marcação de todo frete de transferência já
-- lançado. Rode o SELECT abaixo antes e guarde os ids se quiser reclassificar
-- depois:
--   select id, data, origem, destino, transportadora, valor_total
--     from public.fretes where tipo = 'transferencia' and deleted_at is null;

drop index if exists public.idx_fretes_tipo_transferencia;

alter table public.fretes
  drop constraint if exists fretes_tipo_check;

alter table public.fretes
  drop column if exists tipo;
