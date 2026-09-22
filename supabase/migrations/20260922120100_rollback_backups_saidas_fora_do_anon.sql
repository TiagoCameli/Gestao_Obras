-- Rollback de 20260922120000_backups_saidas_fora_do_anon.sql. Só para emergência.
-- Volta ao estado de 22/09/2026: RLS desligada e os grants padrão do Supabase.

alter table public.saidas_andrade_backup2_20260826  disable row level security;
alter table public.saidas_arla_backup_20260826      disable row level security;
alter table public.saidas_motorista_backup_20260826 disable row level security;

grant all on table public.saidas_andrade_backup2_20260826  to anon, authenticated;
grant all on table public.saidas_arla_backup_20260826      to anon, authenticated;
grant all on table public.saidas_motorista_backup_20260826 to anon, authenticated;
