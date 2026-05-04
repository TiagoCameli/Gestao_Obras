-- Fase 1b — Suporte a depósitos externos + seed do tanque Transterra.
--
-- CONTEXTO: até agora, todo depósito é "da casa" (EMT). A operação real tem
-- também o tanque Transterra, que fica fisicamente na Areacre — quando
-- carretas de qualquer transportadora abastecem ali, gera crédito pra
-- Areacre e débito pra transportadora que abasteceu. Não controlamos
-- estoque desse tanque (Areacre que controla). Modelamos como uma row em
-- depositos com flag `eh_externo=true`, ligada à Areacre via
-- `transportadora_proprietaria_id`.
--
-- ESCOPO desta migration (atomicidade forte — tudo ou nada):
--   a) ALTER TABLE depositos: novas colunas (proprietaria_id, apelido, eh_externo)
--   b) Index parcial em transportadora_proprietaria_id
--   c) Trigger BLOQUEIA INSERT/UPDATE em entradas_combustivel quando depósito é externo
--   d) Trigger BLOQUEIA INSERT/UPDATE em transferencias_combustivel quando QUALQUER lado é externo
--   e) INSERT do depósito virtual Transterra (id literal hardcoded)
--   f) Validação inline RAISE EXCEPTION
--
-- ID DO SEED: 'mori6yyt9owm9' (gerado client-side com a convenção padrão
-- Date.now().toString(36) + random; documentado em docs/tech-debt.md sob
-- DEPOSITO_VIRTUAL_TRANSTERRA_ID). NÃO MUDAR esse ID — outras migrations
-- futuras vão referenciar.

begin;

-- ── (a) ALTER TABLE depositos ──
alter table public.depositos
  add column if not exists transportadora_proprietaria_id text
    references public.fornecedores(id) on delete restrict,
  add column if not exists apelido text,
  add column if not exists eh_externo boolean not null default false;

comment on column public.depositos.transportadora_proprietaria_id is
  'FK para fornecedores. NULL = tanque "da casa" (EMT). Se preenchido, '
  'identifica a empresa terceira que controla este tanque (ex: Areacre = Transterra).';

comment on column public.depositos.eh_externo is
  'true = depósito controlado por terceiro, sem estoque interno. Bloqueia '
  'entradas_combustivel e transferencias_combustivel via trigger. Saídas pra '
  'esse depósito fazem sentido (carretas abastecendo) e geram movimentos na '
  'conta-corrente da transportadora_proprietaria.';

-- ── (b) Index parcial ──
create index if not exists depositos_transportadora_proprietaria_id_idx
  on public.depositos (transportadora_proprietaria_id)
  where transportadora_proprietaria_id is not null;

-- ── (c) Trigger: bloqueia entrada de combustível em depósito externo ──
create or replace function public.fn_block_entrada_em_deposito_externo()
returns trigger
language plpgsql
as $$
declare
  v_eh_externo boolean;
  v_nome text;
begin
  if new.deposito_id is null then
    return new; -- entrada sem depósito não cabe a nós bloquear
  end if;
  select eh_externo, nome into v_eh_externo, v_nome
    from public.depositos
   where id = new.deposito_id;
  if v_eh_externo then
    raise exception 'Não é possível registrar entrada de combustível em depósito externo (% / id=%). '
                    'Depósitos externos são controlados pelo proprietário (Areacre etc) e não têm estoque interno.',
                    v_nome, new.deposito_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_entradas_combustivel_block_externo on public.entradas_combustivel;
create trigger trg_entradas_combustivel_block_externo
  before insert or update of deposito_id on public.entradas_combustivel
  for each row execute function public.fn_block_entrada_em_deposito_externo();

-- ── (d) Trigger: bloqueia transferências envolvendo depósito externo (origem OU destino) ──
create or replace function public.fn_block_transferencia_envolvendo_externo()
returns trigger
language plpgsql
as $$
declare
  v_origem_externa boolean := false;
  v_destino_externo boolean := false;
  v_origem_nome text;
  v_destino_nome text;
begin
  if new.deposito_origem_id is not null then
    select eh_externo, nome into v_origem_externa, v_origem_nome
      from public.depositos where id = new.deposito_origem_id;
  end if;
  if new.deposito_destino_id is not null then
    select eh_externo, nome into v_destino_externo, v_destino_nome
      from public.depositos where id = new.deposito_destino_id;
  end if;

  if v_origem_externa and v_destino_externo then
    raise exception 'Transferência inválida: ambos origem (%) e destino (%) são depósitos externos. Movimentos entre tanques externos não são rastreados pelo nosso sistema.',
                    v_origem_nome, v_destino_nome;
  elsif v_origem_externa then
    raise exception 'Transferência inválida: origem é depósito externo (% / id=%). Não controlamos estoque do tanque externo, então não podemos retirar combustível dele.',
                    v_origem_nome, new.deposito_origem_id;
  elsif v_destino_externo then
    raise exception 'Transferência inválida: destino é depósito externo (% / id=%). Não controlamos estoque do tanque externo, então não podemos depositar combustível nele.',
                    v_destino_nome, new.deposito_destino_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transferencias_combustivel_block_externo on public.transferencias_combustivel;
create trigger trg_transferencias_combustivel_block_externo
  before insert or update of deposito_origem_id, deposito_destino_id on public.transferencias_combustivel
  for each row execute function public.fn_block_transferencia_envolvendo_externo();

-- ── (e) Seed do depósito virtual Transterra ──
-- ATENÇÃO: este INSERT roda ANTES das triggers de bloqueio importarem
-- (depositos não tem trigger de bloqueio nele mesmo — só nas tabelas filhas).
-- ON CONFLICT pra idempotência caso a migration seja re-rodada.

insert into public.depositos (
  id, nome, apelido, obra_id,
  transportadora_proprietaria_id, eh_externo, ativo,
  capacidade_litros, nivel_atual_litros, criado_por
) values (
  'mori6yyt9owm9',                                    -- DEPOSITO_VIRTUAL_TRANSTERRA_ID
  'Transterra (Areacre)',                             -- nome (canonical, mostrado em listagens)
  'Transterra',                                       -- apelido (display curto)
  '99a8ba7d-1b26-4d19-a983-379d46ac86aa',             -- obra BR-364 Lote 9
  'mlppmxan37tev',                                    -- Areacre
  true,                                               -- eh_externo
  true,                                               -- ativo
  0,                                                  -- capacidade_litros (não rastreamos)
  0,                                                  -- nivel_atual_litros (não rastreamos)
  'system_migration_20260505060000'                   -- criado_por (rastro da origem)
)
on conflict (id) do nothing;

-- ── (f) Validação inline ──
do $$
declare
  total_externos int;
  externo_id text;
  externo_transp text;
  externo_nome text;
  internos_consistentes int;
begin
  -- Exatamente 1 depósito externo
  select count(*) into total_externos from public.depositos where eh_externo = true;
  if total_externos <> 1 then
    raise exception 'Esperado 1 depósito eh_externo=true; encontrado %', total_externos;
  end if;

  -- Esse externo é o Transterra com Areacre
  select id, transportadora_proprietaria_id, nome
    into externo_id, externo_transp, externo_nome
    from public.depositos where eh_externo = true;
  if externo_id <> 'mori6yyt9owm9' then
    raise exception 'Depósito externo tem id=% (esperado mori6yyt9owm9)', externo_id;
  end if;
  if externo_transp is distinct from 'mlppmxan37tev' then
    raise exception 'Depósito externo % tem transportadora_proprietaria_id=% (esperado mlppmxan37tev/Areacre)',
      externo_id, externo_transp;
  end if;

  -- Os 3 internos preservados, sem proprietária e sem flag externo
  select count(*) into internos_consistentes
    from public.depositos
   where eh_externo = false
     and transportadora_proprietaria_id is null
     and id in ('mmjak3d05dfun', 'morb6x252ikgy', 'mora91lkaic8b');
  if internos_consistentes <> 3 then
    raise exception 'Esperado 3 depósitos internos preservados (Meloza, Canteiro S500, Canteiro S10) com proprietária NULL e eh_externo=false; encontrado %', internos_consistentes;
  end if;

  raise notice 'Fase 1b OK: 1 externo (% / Transterra/Areacre), 3 internos preservados, triggers de bloqueio ativas em entradas_combustivel e transferencias_combustivel.', externo_id;
end $$;

commit;
