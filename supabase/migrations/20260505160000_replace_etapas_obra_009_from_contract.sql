-- Reset das 135 etapas legadas da obra 009 (BR-364 Lote 09) e
-- repopulação a partir da medição de contrato em
-- rodotracker_contract_items (8 etapas + 12 subetapas + 245 itens =
-- 265 rows). Source of truth da medição passa a alimentar o cadastro.
--
-- FK strategy:
--   * saidas_combustivel.etapa_id (756 rows com etapa preenchida na
--     obra 009): ON DELETE SET NULL — viram NULL automaticamente. Usuário
--     fará matching manual depois.
--   * apontamentos.etapa_obra_id (1351 rows na obra 009, NOT NULL): drop
--     NOT NULL + SET NULL. Módulo apontamentos legado será apagado em
--     breve (substituído pelo apontamento_rh).
--   * registros_horas_diaristas.etapa_id (15 rows na obra 009, NOT NULL):
--     drop NOT NULL + SET NULL — mesma justificativa.
--
-- Backup das 135 antes do DELETE em etapas_obra_backup_20260505_obra009.

begin;

-- (1) Backup
create table if not exists public.etapas_obra_backup_20260505_obra009 as
  select * from public.etapas_obra
   where obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

revoke all on public.etapas_obra_backup_20260505_obra009 from anon, authenticated;

comment on table public.etapas_obra_backup_20260505_obra009 is
  'BACKUP — DBA only. Snapshot pré-replace das 135 etapas legadas da obra '
  'BR-364 Lote 09 (2026-05-05). Drop em 2026-07-04 (60 dias).';

-- (2) Drop NOT NULL nas FKs antes de zerar (NOT NULL bloqueia UPDATE → NULL)
alter table public.apontamentos alter column etapa_obra_id drop not null;
alter table public.registros_horas_diaristas alter column etapa_id drop not null;

-- (3) Zera FKs nas tabelas que apontam pras 135 antigas
update public.apontamentos
   set etapa_obra_id = null
 where obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

update public.registros_horas_diaristas
   set etapa_id = null
 where obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

-- saidas_combustivel: ON DELETE SET NULL faz no próximo passo automaticamente.

-- (4) DELETE das 135 etapas legadas
delete from public.etapas_obra
 where obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

-- (5) INSERT das 265 vindas de rodotracker_contract_items
--   id: gera novo (etapas_obra usa text PK, formato base36 client-side
--       não-aplicável aqui — uso uuid em texto pra evitar colisão)
--   nome: code + ' - ' + name (ex: "01.01 - Conservação rotineira ...")
--   ordenação visual: code já tem zero padding, order by nome.asc funciona
insert into public.etapas_obra (id, obra_id, nome, unidade, quantidade, valor_unitario, criado_por)
  select
    gen_random_uuid()::text,
    obra_id,
    coalesce(code, '') || ' - ' || name,
    coalesce(unit, ''),
    coalesce(contracted_qty, 0),
    coalesce(unit_price, 0),
    'medicao_contrato'
  from public.rodotracker_contract_items
 where obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa'
 order by code asc;

-- (6) Validação
do $$
declare
  v_count_novo int;
  v_count_esperado int;
  v_orfas_saidas int;
  v_orfas_apont int;
  v_orfas_diar int;
begin
  select count(*) into v_count_esperado
    from public.rodotracker_contract_items
   where obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

  select count(*) into v_count_novo
    from public.etapas_obra
   where obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

  if v_count_novo <> v_count_esperado then
    raise exception 'Esperado % etapas pós-insert, encontrado %', v_count_esperado, v_count_novo;
  end if;

  -- Confirma órfãos zerados
  select count(*) into v_orfas_saidas
    from public.saidas_combustivel s
   where s.obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa'
     and s.etapa_id is not null;

  select count(*) into v_orfas_apont
    from public.apontamentos a
   where a.obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa'
     and a.etapa_obra_id is not null;

  select count(*) into v_orfas_diar
    from public.registros_horas_diaristas r
   where r.obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa'
     and r.etapa_id is not null;

  raise notice E'Replace OK. % etapas (era 135). FKs zeradas:\n  saidas_combustivel.etapa_id ainda preenchidas: %\n  apontamentos.etapa_obra_id ainda preenchidas: %\n  registros_horas_diaristas.etapa_id ainda preenchidas: %.\nBackup em etapas_obra_backup_20260505_obra009.',
    v_count_novo, v_orfas_saidas, v_orfas_apont, v_orfas_diar;
end $$;

commit;
