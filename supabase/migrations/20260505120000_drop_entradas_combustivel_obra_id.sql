-- Entrada de combustível é compra pra tanque global (Fase 6 já tornou
-- tanques globais). Amarrar entrada a obra perdeu sentido — quem
-- escolhe é o tanque, não a obra. Mesmo padrão de depositos.obra_id.
--
-- 7 rows existentes perdem a referência (NOT NULL → DROP). Sem
-- backfill — semântica nova é "entrada é global, não pertence a obra".

begin;

alter table public.entradas_combustivel drop column if exists obra_id;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entradas_combustivel'
      and column_name = 'obra_id'
  ) then
    raise exception 'entradas_combustivel.obra_id ainda existe pós-DROP';
  end if;
  raise notice 'entradas_combustivel.obra_id dropado. Entradas agora são globais.';
end $$;

commit;
