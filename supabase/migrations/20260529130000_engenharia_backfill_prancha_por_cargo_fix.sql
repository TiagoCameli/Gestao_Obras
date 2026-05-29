-- Backfill das chaves de Prancha em acoes_permitidas, por cargo (idempotente).
-- Mesma lógica do backfill de engenharia (lição: chave nova sem backfill = ninguém acessa).
begin;

-- Administrador + Engenheiro Civil Sênior: criar + editar + excluir
update public.funcionarios
set acoes_permitidas = (
  select array_agg(distinct k) from unnest(
    coalesce(acoes_permitidas, '{}'::text[]) ||
    array['criar_engenharia_prancha','editar_engenharia_prancha','excluir_engenharia_prancha']
  ) as k
)
where cargo in ('Administrador','Engenheiro Civil Sênior');

-- Engenheiro Civil: criar + editar
update public.funcionarios
set acoes_permitidas = (
  select array_agg(distinct k) from unnest(
    coalesce(acoes_permitidas, '{}'::text[]) ||
    array['criar_engenharia_prancha','editar_engenharia_prancha']
  ) as k
)
where cargo = 'Engenheiro Civil';

commit;
