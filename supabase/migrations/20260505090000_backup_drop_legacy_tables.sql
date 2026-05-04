-- Fase 5 (final) — Backup snapshot + DROP das tabelas legadas
-- abastecimentos e abastecimentos_carreta.
--
-- CONTEXTO: ambas foram substituídas pela tabela unificada
-- saidas_combustivel (Fase 1c) com backfill 100% validado na Fase 2
-- (saidas_combustivel = 923 = 167 carreta + 756 sentinel). Hooks
-- legados (compat shims) e componentes que dependiam dessas tabelas
-- foram removidos nos commits anteriores desta Fase 5.
--
-- Pré-check FK externo: zero migrations declaram FK apontando pra
-- abastecimentos/abastecimentos_carreta (verificado via grep
-- "REFERENCES public.abastecimentos*" em supabase/migrations/).
-- DROP CASCADE é seguro — só remove triggers/views internos.
--
-- BACKUP STRATEGY:
--   * Snapshot completo das 2 tabelas em abastecimentos_backup_20260505
--     e abastecimentos_carreta_backup_20260505.
--   * Sem RLS (DBA-only).
--   * REVOKE explícito de anon + authenticated → não aparece em PostgREST.
--   * COMMENT documentando data de drop dos backups: 2026-07-04 (60 dias).
--   * Standing rule #13 documentada em docs/tech-debt.md.

begin;

-- ════════════════════════════════════════════════════════════════════
-- (1) Backups
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.abastecimentos_backup_20260505 as
  select * from public.abastecimentos;

create table if not exists public.abastecimentos_carreta_backup_20260505 as
  select * from public.abastecimentos_carreta;

-- Bloqueia acesso via PostgREST (anon + authenticated). DBA-only.
revoke all on public.abastecimentos_backup_20260505 from anon, authenticated;
revoke all on public.abastecimentos_carreta_backup_20260505 from anon, authenticated;

comment on table public.abastecimentos_backup_20260505 is
  'BACKUP — DBA only. Snapshot pré-DROP (Fase 5, 2026-05-05). DROP em '
  '2026-07-04 (60 dias). NÃO usar em queries de aplicação. Recovery: '
  'copiar rows necessárias manualmente; tabela original abastecimentos '
  'foi dropada nesta migration.';

comment on table public.abastecimentos_carreta_backup_20260505 is
  'BACKUP — DBA only. Snapshot pré-DROP (Fase 5, 2026-05-05). DROP em '
  '2026-07-04 (60 dias). NÃO usar em queries de aplicação. Recovery: '
  'copiar rows necessárias manualmente; tabela original '
  'abastecimentos_carreta foi dropada nesta migration.';

-- ════════════════════════════════════════════════════════════════════
-- (2) Validação de contagem (sanity — backup tem que ter o mesmo)
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_orig_a int; v_back_a int;
  v_orig_c int; v_back_c int;
begin
  select count(*) into v_orig_a from public.abastecimentos;
  select count(*) into v_back_a from public.abastecimentos_backup_20260505;
  select count(*) into v_orig_c from public.abastecimentos_carreta;
  select count(*) into v_back_c from public.abastecimentos_carreta_backup_20260505;

  if v_orig_a <> v_back_a then
    raise exception 'Backup abastecimentos: original=%, backup=%. Contagens divergem.', v_orig_a, v_back_a;
  end if;
  if v_orig_c <> v_back_c then
    raise exception 'Backup abastecimentos_carreta: original=%, backup=%. Contagens divergem.', v_orig_c, v_back_c;
  end if;

  raise notice 'Backup OK: abastecimentos=%/%, abastecimentos_carreta=%/%.',
    v_back_a, v_orig_a, v_back_c, v_orig_c;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- (3) DROP das tabelas legadas
-- ════════════════════════════════════════════════════════════════════
-- CASCADE: remove triggers/views/policies dependentes das tabelas.
-- Pré-check confirmou zero FK externo apontando pra cá.

drop table if exists public.abastecimentos cascade;
drop table if exists public.abastecimentos_carreta cascade;

-- ════════════════════════════════════════════════════════════════════
-- (4) Validação final
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_a_existe bool;
  v_c_existe bool;
  v_saidas int;
  v_movs int;
begin
  -- Confirma DROP
  select exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'abastecimentos')
    into v_a_existe;
  if v_a_existe then
    raise exception 'Tabela abastecimentos NÃO foi dropada';
  end if;
  select exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'abastecimentos_carreta')
    into v_c_existe;
  if v_c_existe then
    raise exception 'Tabela abastecimentos_carreta NÃO foi dropada';
  end if;

  -- Confirma que dados novos seguem intactos
  select count(*) into v_saidas from public.saidas_combustivel;
  if v_saidas <> 923 then
    raise warning 'saidas_combustivel mudou desde backfill (esperado 923, atual %). Atividade do app pós-Fase 2.',
      v_saidas;
  end if;
  select count(*) into v_movs from public.transportadora_movimentos;
  if v_movs < 741 then
    raise exception 'transportadora_movimentos com menos rows que esperado (%; mínimo 741 do backfill).', v_movs;
  end if;

  raise notice E'Fase 5 OK:\n  abastecimentos DROPADA, abastecimentos_carreta DROPADA.\n  saidas_combustivel: %, transportadora_movimentos: %.\n  Backups em abastecimentos_backup_20260505 (DBA-only, drop em 2026-07-04).',
    v_saidas, v_movs;
end $$;

commit;
