-- Troca saidas_combustivel.motorista_id (FK funcionarios) por
-- saidas_combustivel.motorista (text livre). Padrão segue
-- fretes.motorista, que já é text desde 20260217143758.
--
-- Motivo: na operação real, o motorista da carreta nem sempre
-- está cadastrado em funcionarios (terceirizado, freelance, etc).
-- Forçar Select pra cadastro impede registro de saídas legítimas.
--
-- Backfill: pra rows com motorista_id preenchido, copia
-- funcionarios.nome pra motorista. Rows com motorista_id NULL
-- ficam com motorista = ''.

begin;

alter table public.saidas_combustivel
  add column if not exists motorista text not null default '';

update public.saidas_combustivel s
   set motorista = f.nome
  from public.funcionarios f
 where s.motorista_id is not null
   and s.motorista_id = f.id
   and s.motorista = '';

alter table public.saidas_combustivel
  drop column if exists motorista_id;

do $$
declare
  v_id_existe bool;
  v_text_existe bool;
  v_total int;
  v_preenchidos int;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saidas_combustivel'
      and column_name = 'motorista_id'
  ) into v_id_existe;
  if v_id_existe then
    raise exception 'saidas_combustivel.motorista_id ainda existe pós-DROP';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saidas_combustivel'
      and column_name = 'motorista' and data_type = 'text'
  ) into v_text_existe;
  if not v_text_existe then
    raise exception 'saidas_combustivel.motorista (text) não foi criada';
  end if;

  select count(*), count(*) filter (where motorista <> '')
    into v_total, v_preenchidos
    from public.saidas_combustivel;

  raise notice 'OK. saidas_combustivel: % rows, % com motorista preenchido (backfill).',
    v_total, v_preenchidos;
end $$;

commit;
