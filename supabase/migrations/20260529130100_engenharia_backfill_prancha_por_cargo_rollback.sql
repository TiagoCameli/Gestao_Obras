-- Rollback: remove as chaves de prancha de todos (seguro: ninguém as tinha antes).
begin;
update public.funcionarios
set acoes_permitidas = (
  select array_agg(k) from unnest(acoes_permitidas) as k
  where k <> all (array['criar_engenharia_prancha','editar_engenharia_prancha','excluir_engenharia_prancha'])
)
where acoes_permitidas && array['criar_engenharia_prancha','editar_engenharia_prancha','excluir_engenharia_prancha'];
commit;
