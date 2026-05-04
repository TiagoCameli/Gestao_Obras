-- Fase 1c — Cria estrutura de conta-corrente das transportadoras +
-- tabela unificada de saídas de combustível.
--
-- ESCOPO:
--   a) CREATE TABLE transportadora_movimentos (com auditoria created_at/by)
--   b) CREATE TABLE saidas_combustivel (substitui abastecimentos +
--      abastecimentos_carreta — mas só após backfill da Fase 2)
--   c) CREATE VIEW transportadora_saldos
--   d) CREATE FUNCTION saldo_devedor_combustivel
--   e) Triggers nas 3 tabelas-fonte (saidas_combustivel, fretes,
--      pagamentos_frete) que alimentam transportadora_movimentos
--   f) Trigger BEFORE UPDATE em saidas_combustivel pra updated_at
--   g) Validação inline
--
-- IMPORTANTE — JANELA DE TRANSIÇÃO 1c→2:
--   Após esta migration, INSERTs novos em fretes/pagamentos_frete/
--   saidas_combustivel disparam triggers e geram movimentos automaticamente.
--   Os 328 fretes + 65 pagamentos + 167 abast carreta + 756 abast LEGADOS
--   não têm movimentos correspondentes até a Fase 2 rodar o backfill.
--   View transportadora_saldos retorna saldos PARCIAIS (só pós-1c) durante
--   essa janela. Documentado via COMMENT ON VIEW (Opção C aprovada).
--
-- AJUSTE TÉCNICO vs spec original:
--   * equipamento_id ON DELETE RESTRICT (não SET NULL): cascade SET NULL
--     violaria CHECK (tipo_consumidor='equipamento_proprio' →
--     equipamento_id NOT NULL). RESTRICT explicita que equipamento
--     referenciado por saída não pode ser deletado. Mesmo princípio da
--     transportadora_id em fornecedores.
--   * motorista_id ON DELETE SET NULL: motorista é metadata, não define
--     a saída. Desligamento preserva a row.

begin;

-- ════════════════════════════════════════════════════════════════════
-- (a) Tabela transportadora_movimentos
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.transportadora_movimentos (
  id text primary key,
  transportadora_id text not null references public.fornecedores(id) on delete restrict,
  data timestamptz not null,
  tipo text not null check (tipo in (
    'credito_frete',
    'debito_pagamento_frete',
    'credito_abastecimento_transterra',
    'debito_abastecimento_transterra',
    'debito_abastecimento_emt',
    'ajuste_manual_credito',
    'ajuste_manual_debito'
  )),
  valor numeric(14,2) not null check (valor > 0),
  origem_tabela text not null check (origem_tabela in (
    'fretes', 'pagamentos_frete', 'saidas_combustivel', 'ajuste_manual'
  )),
  origem_id text not null,
  descricao text,
  obra_id text references public.obras(id) on delete set null,
  mes_referencia date,
  abatido_em_pagamento_id text references public.pagamentos_frete(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists transportadora_movimentos_transp_data_idx
  on public.transportadora_movimentos (transportadora_id, data desc);

create index if not exists transportadora_movimentos_origem_idx
  on public.transportadora_movimentos (origem_tabela, origem_id);

create index if not exists transportadora_movimentos_abatido_idx
  on public.transportadora_movimentos (abatido_em_pagamento_id)
  where abatido_em_pagamento_id is not null;

alter table public.transportadora_movimentos enable row level security;

drop policy if exists "Authenticated full access" on public.transportadora_movimentos;
create policy "Authenticated full access" on public.transportadora_movimentos
  for all to authenticated using (true) with check (true);

comment on table public.transportadora_movimentos is
  'Conta-corrente cronológica de cada transportadora. Créditos (frete prestado, '
  'abastecimento na Transterra/Areacre) e débitos (pagamento recebido, '
  'abastecimento consumido) gerados via triggers em fretes, pagamentos_frete '
  'e saidas_combustivel. Saldo agregado disponível na view transportadora_saldos.';

comment on column public.transportadora_movimentos.valor is
  'Sempre positivo (CHECK > 0). O sinal vem do tipo (credito_* soma, debito_* subtrai).';

comment on column public.transportadora_movimentos.abatido_em_pagamento_id is
  'Preenchido pelo PagamentoFreteForm quando este movimento de débito for '
  'abatido em um pagamento de frete (Fase 4). NULL = ainda em aberto.';

-- ════════════════════════════════════════════════════════════════════
-- (b) Tabela saidas_combustivel
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.saidas_combustivel (
  id text primary key,
  data timestamptz not null,
  origem text not null check (origem in ('tanque', 'dinheiro', 'requisicao')),
  tipo_consumidor text not null check (tipo_consumidor in (
    'equipamento_proprio', 'carreta_transportadora'
  )),

  -- FKs condicionais
  tanque_id text references public.depositos(id) on delete restrict,
  equipamento_id text references public.equipamentos(id) on delete restrict,
  transportadora_id text references public.fornecedores(id) on delete restrict,
  placa text,
  motorista_id text references public.funcionarios(id) on delete set null,

  obra_id text references public.obras(id) on delete set null,
  etapa_id text references public.etapas_obra(id) on delete set null,
  alocacoes jsonb,

  tipo_combustivel text not null,
  litros numeric(12,3) not null check (litros > 0),
  preco_medio_tanque_snapshot numeric(12,4),
  taxa_litro numeric(10,4) not null default 0,
  preco_unitario numeric(12,4) not null,
  valor_total numeric(14,2) not null,

  foto_url text,
  observacoes text,

  pago boolean,
  pago_em timestamptz,

  movimento_id text references public.transportadora_movimentos(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,

  -- CHECKs cruzados de pertinência
  constraint saida_carreta_exige_transportadora
    check (tipo_consumidor != 'carreta_transportadora' or transportadora_id is not null),
  constraint saida_equipamento_exige_equipamento
    check (tipo_consumidor != 'equipamento_proprio' or equipamento_id is not null),
  constraint saida_tanque_exige_tanque
    check (origem != 'tanque' or tanque_id is not null),
  constraint saida_externa_sem_tanque
    check (origem = 'tanque' or tanque_id is null)
);

create index if not exists saidas_combustivel_data_idx
  on public.saidas_combustivel (data desc);

create index if not exists saidas_combustivel_transportadora_idx
  on public.saidas_combustivel (transportadora_id, data desc)
  where transportadora_id is not null;

create index if not exists saidas_combustivel_tanque_idx
  on public.saidas_combustivel (tanque_id, data desc)
  where tanque_id is not null;

create index if not exists saidas_combustivel_obra_idx
  on public.saidas_combustivel (obra_id)
  where obra_id is not null;

alter table public.saidas_combustivel enable row level security;

drop policy if exists "Authenticated full access" on public.saidas_combustivel;
create policy "Authenticated full access" on public.saidas_combustivel
  for all to authenticated using (true) with check (true);

comment on table public.saidas_combustivel is
  'Tabela unificada de saídas de combustível. Substitui abastecimentos + '
  'abastecimentos_carreta após backfill da Fase 2 e drop das antigas na Fase 5. '
  'Diferencia equipamento próprio (sem movimento financeiro) vs carreta de '
  'transportadora (gera movimentos via trigger).';

comment on column public.saidas_combustivel.tanque_id is
  'FK para depositos. Pra carretas que abastecem na Transterra, usar o ID '
  'mori6yyt9owm9 (DEPOSITO_VIRTUAL_TRANSTERRA_ID, documentado em '
  'docs/tech-debt.md). Tanque externo bloqueia entrada/transferência via '
  'triggers da Fase 1b mas aceita saída.';

comment on column public.saidas_combustivel.preco_medio_tanque_snapshot is
  'Snapshot do preço médio do tanque no momento da saída. Não recalculado '
  'retroativamente — extrato financeiro fica imutável após o INSERT.';

comment on column public.saidas_combustivel.movimento_id is
  'FK para o movimento de DÉBITO criado pela trigger. Usado pra rastreio. '
  'NULL quando tipo_consumidor=equipamento_proprio (não gera movimento).';

-- ════════════════════════════════════════════════════════════════════
-- (c) View transportadora_saldos
-- ════════════════════════════════════════════════════════════════════

create or replace view public.transportadora_saldos as
select
  t.id as transportadora_id,
  t.nome,
  t.eh_dona_de_tanque,
  coalesce(sum(case when m.tipo like 'credito_%' then m.valor else -m.valor end), 0) as saldo,
  coalesce(sum(case when m.tipo in ('debito_abastecimento_transterra', 'debito_abastecimento_emt')
                    then m.valor else 0 end), 0) as debito_combustivel_total,
  coalesce(sum(case when m.tipo = 'credito_frete' then m.valor else 0 end), 0) as credito_frete_total,
  coalesce(sum(case when m.tipo = 'debito_pagamento_frete' then m.valor else 0 end), 0) as pago_frete_total,
  count(m.id) filter (where m.id is not null) as qtd_movimentos
from public.fornecedores t
left join public.transportadora_movimentos m on m.transportadora_id = t.id
where t.eh_transportadora = true
group by t.id, t.nome, t.eh_dona_de_tanque;

comment on view public.transportadora_saldos is
  'ATENÇÃO: até a Fase 2 (backfill) ser executada, esta view retorna saldos '
  'PARCIAIS que cobrem APENAS movimentos gerados após a Fase 1c. Não confiar '
  'pra cálculo financeiro até confirmação do backfill. Após Fase 2 ser '
  'aplicada e validada (totais batendo com FreteDashboard.tsx legado), '
  'esta nota deve ser removida e a view passa a ser fonte canônica de saldos.';

-- ════════════════════════════════════════════════════════════════════
-- (d) Function saldo_devedor_combustivel(transportadora_id, ate_data)
-- ════════════════════════════════════════════════════════════════════

create or replace function public.saldo_devedor_combustivel(
  p_transportadora_id text,
  p_ate_data timestamptz default now()
) returns numeric
language sql
stable
as $$
  select coalesce(sum(valor), 0)
  from public.transportadora_movimentos
  where transportadora_id = p_transportadora_id
    and tipo in ('debito_abastecimento_transterra', 'debito_abastecimento_emt')
    and abatido_em_pagamento_id is null
    and data <= p_ate_data;
$$;

comment on function public.saldo_devedor_combustivel(text, timestamptz) is
  'Retorna o total em débitos de combustível ainda não abatidos para a '
  'transportadora. Usada pelo PagamentoFreteForm (Fase 4) pra sugerir '
  'abatimento automático. STABLE — resultado consistente dentro de uma '
  'transação.';

-- ════════════════════════════════════════════════════════════════════
-- (e) Helpers: base36 + gerador de id texto (mesmo padrão do client)
-- ════════════════════════════════════════════════════════════════════
-- IDs base36 batem com o padrão JS Date.now().toString(36) + random:
-- lexicograficamente comparáveis (ordenáveis cronologicamente pelos
-- primeiros chars), decodificáveis pra timestamp de inserção (ver
-- docs/tech-debt.md sob "created_at"). Coerência total com o resto do
-- schema (fretes, pagamentos, abastecimentos, depositos, etc).

create or replace function public.fn_to_base36(n bigint)
returns text
language plpgsql
immutable
as $$
declare
  alphabet text := '0123456789abcdefghijklmnopqrstuvwxyz';
  result text := '';
  remainder int;
begin
  if n = 0 then return '0'; end if;
  while n > 0 loop
    remainder := (n % 36)::int;
    result := substring(alphabet, remainder + 1, 1) || result;
    n := n / 36;
  end loop;
  return result;
end;
$$;

create or replace function public.fn_gerar_id_text()
returns text
language plpgsql
volatile
as $$
declare
  v_ts text;
  v_rnd text;
  v_alphabet text := '0123456789abcdefghijklmnopqrstuvwxyz';
  i int;
begin
  -- ms epoch em base36 (8 chars no horizonte atual)
  v_ts := public.fn_to_base36((extract(epoch from clock_timestamp()) * 1000)::bigint);
  -- 5 chars de random base36 (igual ao slice(2,7) do Math.random().toString(36))
  v_rnd := '';
  for i in 1..5 loop
    v_rnd := v_rnd || substring(v_alphabet, (floor(random() * 36)::int) + 1, 1);
  end loop;
  return v_ts || v_rnd;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- (f) Trigger updated_at em saidas_combustivel (BEFORE UPDATE)
-- ════════════════════════════════════════════════════════════════════
-- Roda ANTES da trigger AFTER UPDATE de movimentos. Ordem natural OK.

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_saidas_combustivel_set_updated_at on public.saidas_combustivel;
create trigger trg_saidas_combustivel_set_updated_at
  before update on public.saidas_combustivel
  for each row execute function public.fn_set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- (g) Trigger de movimentos em saidas_combustivel
-- ════════════════════════════════════════════════════════════════════
-- AFTER INSERT: cria movimento(s) conforme tanque externo/EMT.
-- AFTER UPDATE: híbrido — UPDATE in-place se só valor mudou; recria se
--               transportadora/tanque mudou (delete + insert).
-- AFTER DELETE: deleta movimentos linkados.
--
-- Princípio defensivo: nunca aborta a operação em saidas_combustivel.
-- Se faltar dado (transportadora_id NULL etc), RAISE WARNING + skip.

create or replace function public.fn_saidas_combustivel_movimentos()
returns trigger
language plpgsql
as $$
declare
  v_proprietaria_id text;
  v_credito_id text;
  v_debito_id text;
  v_old_transp text;
  v_old_tanque text;
begin
  -- Guard de recursão: o UPDATE de movimento_id no final desta função
  -- (ver fim do bloco INSERT carreta) re-dispara este mesmo trigger em
  -- modo UPDATE. Sem efeito prático (movimentos têm os mesmos valores),
  -- mas é I/O desnecessário e poluição em pg_trigger_depth.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    delete from public.transportadora_movimentos
     where origem_tabela = 'saidas_combustivel' and origem_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Captura estado anterior pra decidir update vs recriar
    v_old_transp := old.transportadora_id;
    v_old_tanque := old.tanque_id;

    -- Se transportadora ou tanque mudou, deleta movimentos antigos pra recriar
    if (new.transportadora_id is distinct from v_old_transp)
       or (new.tanque_id is distinct from v_old_tanque)
       or (new.tipo_consumidor is distinct from old.tipo_consumidor) then
      delete from public.transportadora_movimentos
       where origem_tabela = 'saidas_combustivel' and origem_id = old.id;
      -- Cai pro fluxo de INSERT abaixo
    else
      -- Só valor mudou → UPDATE in-place
      update public.transportadora_movimentos
         set valor = new.valor_total, data = new.data
       where origem_tabela = 'saidas_combustivel' and origem_id = new.id;
      return new;
    end if;
  end if;

  -- Fluxo INSERT (também alcançado por UPDATE com mudança estrutural)
  if new.tipo_consumidor != 'carreta_transportadora' then
    return new; -- equipamento próprio não gera movimento financeiro
  end if;

  if new.transportadora_id is null then
    raise warning 'saidas_combustivel id=% sem transportadora_id; movimento NÃO criado.', new.id;
    return new;
  end if;

  if new.tanque_id is null then
    raise warning 'saidas_combustivel id=% origem=carreta sem tanque_id; movimento NÃO criado.', new.id;
    return new;
  end if;

  -- Lookup do tanque
  -- Predicado semântico: a EXISTÊNCIA de transportadora_proprietaria_id é o
  -- que define se o tanque rende crédito pra terceiro. eh_externo é flag
  -- de UI (filtra dropdown); pra lógica financeira usamos a proprietária
  -- direto. Se um dia houver inconsistência (eh_externo=true sem
  -- proprietária, ou vice-versa), esta lógica continua correta.
  select transportadora_proprietaria_id
    into v_proprietaria_id
    from public.depositos
   where id = new.tanque_id;

  if v_proprietaria_id is not null then
    -- Tanque com proprietária terceira (ex: Transterra/Areacre):
    -- crédito p/ proprietária + débito p/ transportadora que abasteceu
    v_credito_id := public.fn_gerar_id_text();
    v_debito_id := public.fn_gerar_id_text();

    insert into public.transportadora_movimentos (
      id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
      descricao, obra_id, mes_referencia
    ) values (
      v_credito_id, v_proprietaria_id, new.data,
      'credito_abastecimento_transterra', new.valor_total,
      'saidas_combustivel', new.id,
      'Abastecimento de carreta no tanque ' || coalesce((select nome from public.depositos where id = new.tanque_id), '?'),
      new.obra_id, date_trunc('month', new.data)::date
    );

    insert into public.transportadora_movimentos (
      id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
      descricao, obra_id, mes_referencia
    ) values (
      v_debito_id, new.transportadora_id, new.data,
      'debito_abastecimento_transterra', new.valor_total,
      'saidas_combustivel', new.id,
      'Abastecimento na Transterra (' || coalesce((select nome from public.fornecedores where id = v_proprietaria_id), '?') || ')',
      new.obra_id, date_trunc('month', new.data)::date
    );

    -- Linka o débito na saída pra rastreio
    update public.saidas_combustivel set movimento_id = v_debito_id where id = new.id;
  else
    -- Tanque EMT (a casa): só débito p/ transportadora; EMT não recebe crédito
    v_debito_id := public.fn_gerar_id_text();

    insert into public.transportadora_movimentos (
      id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
      descricao, obra_id, mes_referencia
    ) values (
      v_debito_id, new.transportadora_id, new.data,
      'debito_abastecimento_emt', new.valor_total,
      'saidas_combustivel', new.id,
      'Abastecimento no tanque EMT ' || coalesce((select nome from public.depositos where id = new.tanque_id), '?'),
      new.obra_id, date_trunc('month', new.data)::date
    );

    update public.saidas_combustivel set movimento_id = v_debito_id where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_saidas_combustivel_movimentos on public.saidas_combustivel;
create trigger trg_saidas_combustivel_movimentos
  after insert or update or delete on public.saidas_combustivel
  for each row execute function public.fn_saidas_combustivel_movimentos();

-- ════════════════════════════════════════════════════════════════════
-- (h) Trigger de movimentos em fretes
-- ════════════════════════════════════════════════════════════════════

create or replace function public.fn_fretes_movimentos()
returns trigger
language plpgsql
as $$
declare
  v_mov_id text;
  v_data timestamptz;
begin
  if tg_op = 'DELETE' then
    delete from public.transportadora_movimentos
     where origem_tabela = 'fretes' and origem_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.transportadora_id is distinct from old.transportadora_id then
      -- Mudou de transportadora: deleta antigo, recria
      delete from public.transportadora_movimentos
       where origem_tabela = 'fretes' and origem_id = old.id;
      -- Cai pro INSERT abaixo
    else
      -- Só valor / data mudou → UPDATE in-place
      v_data := new.data::timestamptz;
      update public.transportadora_movimentos
         set valor = new.valor_total, data = v_data
       where origem_tabela = 'fretes' and origem_id = new.id;
      return new;
    end if;
  end if;

  -- Fluxo INSERT (ou UPDATE que mudou transportadora)
  if new.transportadora_id is null then
    raise warning 'fretes id=% sem transportadora_id; movimento credito_frete NÃO criado.', new.id;
    return new;
  end if;

  if new.valor_total is null or new.valor_total <= 0 then
    raise warning 'fretes id=% com valor_total inválido (%); movimento NÃO criado.', new.id, new.valor_total;
    return new;
  end if;

  v_mov_id := public.fn_gerar_id_text();
  v_data := new.data::timestamptz;

  insert into public.transportadora_movimentos (
    id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
    descricao, obra_id, mes_referencia
  ) values (
    v_mov_id, new.transportadora_id, v_data,
    'credito_frete', new.valor_total,
    'fretes', new.id,
    'Frete ' || coalesce(new.nota_fiscal, '(sem NF)') || ' — ' || coalesce(new.origem, '?') || ' → ' || coalesce(new.destino, '?'),
    new.obra_id, date_trunc('month', v_data)::date
  );

  return new;
end;
$$;

drop trigger if exists trg_fretes_movimentos on public.fretes;
create trigger trg_fretes_movimentos
  after insert or update or delete on public.fretes
  for each row execute function public.fn_fretes_movimentos();

-- ════════════════════════════════════════════════════════════════════
-- (i) Trigger de movimentos em pagamentos_frete
-- ════════════════════════════════════════════════════════════════════

create or replace function public.fn_pagamentos_frete_movimentos()
returns trigger
language plpgsql
as $$
declare
  v_mov_id text;
  v_data timestamptz;
begin
  if tg_op = 'DELETE' then
    delete from public.transportadora_movimentos
     where origem_tabela = 'pagamentos_frete' and origem_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.transportadora_id is distinct from old.transportadora_id then
      delete from public.transportadora_movimentos
       where origem_tabela = 'pagamentos_frete' and origem_id = old.id;
    else
      v_data := new.data::timestamptz;
      update public.transportadora_movimentos
         set valor = new.valor, data = v_data
       where origem_tabela = 'pagamentos_frete' and origem_id = new.id;
      return new;
    end if;
  end if;

  if new.transportadora_id is null then
    raise warning 'pagamentos_frete id=% sem transportadora_id; movimento debito_pagamento_frete NÃO criado.', new.id;
    return new;
  end if;

  if new.valor is null or new.valor <= 0 then
    raise warning 'pagamentos_frete id=% com valor inválido (%); movimento NÃO criado.', new.id, new.valor;
    return new;
  end if;

  v_mov_id := public.fn_gerar_id_text();
  v_data := new.data::timestamptz;

  insert into public.transportadora_movimentos (
    id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
    descricao, mes_referencia
  ) values (
    v_mov_id, new.transportadora_id, v_data,
    'debito_pagamento_frete', new.valor,
    'pagamentos_frete', new.id,
    'Pagamento de frete (' || coalesce(new.metodo, '?') || ') — ref ' || coalesce(new.mes_referencia, '?'),
    case when new.mes_referencia ~ '^\d{4}-\d{2}$'
         then to_date(new.mes_referencia || '-01', 'YYYY-MM-DD')
         else date_trunc('month', v_data)::date end
  );

  return new;
end;
$$;

drop trigger if exists trg_pagamentos_frete_movimentos on public.pagamentos_frete;
create trigger trg_pagamentos_frete_movimentos
  after insert or update or delete on public.pagamentos_frete
  for each row execute function public.fn_pagamentos_frete_movimentos();

-- ════════════════════════════════════════════════════════════════════
-- (j) Validação inline
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_count_mov bigint;
  v_count_saidas bigint;
  v_view_exists bool;
  v_func_exists bool;
  v_trg_count int;
  v_check_count int;
  v_policy_mov int;
  v_policy_saidas int;
begin
  -- Tabelas vazias
  select count(*) into v_count_mov from public.transportadora_movimentos;
  if v_count_mov <> 0 then
    raise exception 'Esperado 0 movimentos pós-DDL; encontrado %', v_count_mov;
  end if;

  select count(*) into v_count_saidas from public.saidas_combustivel;
  if v_count_saidas <> 0 then
    raise exception 'Esperado 0 saídas pós-DDL; encontrado %', v_count_saidas;
  end if;

  -- View existe
  select exists (select 1 from pg_views where viewname = 'transportadora_saldos' and schemaname = 'public')
    into v_view_exists;
  if not v_view_exists then
    raise exception 'View transportadora_saldos não criada';
  end if;

  -- Função existe
  select exists (select 1 from pg_proc where proname = 'saldo_devedor_combustivel')
    into v_func_exists;
  if not v_func_exists then
    raise exception 'Função saldo_devedor_combustivel não criada';
  end if;

  -- 4 triggers ativas (3 de movimentos + 1 de updated_at)
  select count(*) into v_trg_count from pg_trigger where tgname in (
    'trg_saidas_combustivel_movimentos',
    'trg_fretes_movimentos',
    'trg_pagamentos_frete_movimentos',
    'trg_saidas_combustivel_set_updated_at'
  );
  if v_trg_count <> 4 then
    raise exception 'Esperado 4 triggers (3 movimentos + 1 updated_at); encontrado %', v_trg_count;
  end if;

  -- 4 CHECKs cruzados em saidas_combustivel (nomes explícitos pra evitar
  -- match acidental com CHECKs inline auto-nomeados como
  -- saidas_combustivel_<col>_check — `_` em LIKE é wildcard).
  select count(*) into v_check_count from pg_constraint
   where conrelid = 'public.saidas_combustivel'::regclass
     and contype = 'c'
     and conname in (
       'saida_carreta_exige_transportadora',
       'saida_equipamento_exige_equipamento',
       'saida_tanque_exige_tanque',
       'saida_externa_sem_tanque'
     );
  if v_check_count <> 4 then
    raise exception 'Esperado 4 CHECK constraints cruzados em saidas_combustivel; encontrado %', v_check_count;
  end if;

  -- RLS ativo nas 2 tabelas novas
  select count(*) into v_policy_mov from pg_policies where tablename = 'transportadora_movimentos';
  if v_policy_mov < 1 then
    raise exception 'RLS policy faltando em transportadora_movimentos';
  end if;
  select count(*) into v_policy_saidas from pg_policies where tablename = 'saidas_combustivel';
  if v_policy_saidas < 1 then
    raise exception 'RLS policy faltando em saidas_combustivel';
  end if;

  raise notice 'Fase 1c OK: tabelas vazias (movimentos=%, saidas=%), view+função criadas, 4 triggers ativas, 4 CHECKs cruzados, RLS habilitado.',
    v_count_mov, v_count_saidas;
end $$;

commit;
