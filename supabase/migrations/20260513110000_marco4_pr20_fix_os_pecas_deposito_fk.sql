-- Marco 4 / PR20 (fix): os_pecas.deposito_id apontava por engano para a tabela
-- 'depositos' (combustível). O correto é 'depositos_material' (almoxarifado).
-- A coluna estava vazia em produção (não houve uso ainda), então a troca é
-- segura sem migração de dados.

-- 1) Limpa valores antigos que apontem pra depositos (não deveriam existir)
update os_pecas set deposito_id = null
where deposito_id is not null
  and deposito_id in (select id from depositos);

-- 2) Drop FK antiga
alter table public.os_pecas
  drop constraint if exists os_pecas_deposito_id_fkey;

-- 3) Cria FK correta
alter table public.os_pecas
  add constraint os_pecas_deposito_material_id_fkey
  foreign key (deposito_id) references public.depositos_material(id);

comment on column public.os_pecas.deposito_id is
  'FK para depositos_material(id). Origem do consumo da peça no almoxarifado.';
