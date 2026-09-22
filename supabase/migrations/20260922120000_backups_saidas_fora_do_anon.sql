-- Fecha três tabelas de backup de 26/08/2026 que ficaram em public sem RLS e com SELECT
-- para anon e authenticated. Qualquer pessoa com a chave pública do site lia placa,
-- motorista, litros e valor das saídas de combustível, e também podia UPDATE, DELETE e
-- TRUNCATE (medido em information_schema.role_table_grants em 22/09). Esses backups são a
-- única fonte dos rollbacks das correções de Andrade (placas, motoristas) e Arla (balde).
--
-- Achado na Fase 0 da migração para o ERP-EMT (22/09/2026). NÃO APLICADA: é escrita em
-- produção e espera o ok do Tiago.
--
-- Não move de schema de propósito: fix_/rollback_ andrade, arla e motoristas na raiz do
-- repo leem essas tabelas pelo nome em public, e rodam como postgres (MCP), que ignora RLS.

alter table public.saidas_andrade_backup2_20260826  enable row level security;
alter table public.saidas_arla_backup_20260826      enable row level security;
alter table public.saidas_motorista_backup_20260826 enable row level security;

revoke all on table public.saidas_andrade_backup2_20260826  from anon, authenticated;
revoke all on table public.saidas_arla_backup_20260826      from anon, authenticated;
revoke all on table public.saidas_motorista_backup_20260826 from anon, authenticated;

-- Sem policy: com RLS ligada e sem grant, ninguém do app lê. Só postgres/service_role.
