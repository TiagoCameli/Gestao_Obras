-- F11 — Cada tanque é "amarrado" a um combustível enquanto tem nível > 0.
-- Não pode misturar: receber entrada/transferência de combustível diferente
-- só se o tanque estiver vazio ou já contiver o mesmo combustível.
-- Tanques externos (eh_externo) ficam fora dessa regra — não temos controle
-- de estoque interno deles.
--
-- Componentes:
-- 1. depositos.combustivel_atual_id  — coluna que reflete o líquido corrente
-- 2. esvaziamentos_tanque             — tabela de descarte explícito p/ trocas
-- 3. recalcular_nivel_deposito        — atualizado pra subtrair esvaziamentos
--                                        e setar combustivel_atual_id
-- 4. triggers de validação            — bloqueia entradas/transferências misturando

begin;

-- ── (1) Coluna ────────────────────────────────────────────────────
alter table public.depositos
  add column if not exists combustivel_atual_id text
    references public.insumos(id) on delete restrict;

-- ── (2) Tabela esvaziamentos_tanque ───────────────────────────────
create table if not exists public.esvaziamentos_tanque (
  id text primary key,
  deposito_id text not null references public.depositos(id) on delete cascade,
  data_hora timestamptz not null default now(),
  litros_descartados numeric not null check (litros_descartados > 0),
  motivo text not null,
  criado_por text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_esvaziamentos_deposito
  on public.esvaziamentos_tanque(deposito_id, data_hora desc);

-- ── (3) Recalcula nível + combustível atual (extensão do existing) ──
create or replace function public.recalcular_nivel_deposito(p_deposito_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_entradas numeric;
  v_saidas numeric;
  v_transf_in numeric;
  v_transf_out numeric;
  v_esvazia numeric;
  v_novo_nivel numeric;
  v_combustivel text;
  v_ultimo_esvazia timestamptz;
begin
  if p_deposito_id is null then
    return;
  end if;

  select coalesce(sum(quantidade_litros), 0)
    into v_entradas
    from public.entradas_combustivel
   where deposito_id = p_deposito_id;

  select coalesce(sum(litros), 0)
    into v_saidas
    from public.saidas_combustivel
   where origem = 'tanque'
     and tanque_id = p_deposito_id;

  select coalesce(sum(quantidade_litros), 0)
    into v_transf_in
    from public.transferencias_combustivel
   where deposito_destino_id = p_deposito_id;

  select coalesce(sum(quantidade_litros), 0)
    into v_transf_out
    from public.transferencias_combustivel
   where deposito_origem_id = p_deposito_id;

  select coalesce(sum(litros_descartados), 0)
    into v_esvazia
    from public.esvaziamentos_tanque
   where deposito_id = p_deposito_id;

  v_novo_nivel := greatest(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);

  -- Determina o combustível corrente: última entrada APÓS o último esvaziamento.
  -- Se nivel <= 0, tanque está vazio → null.
  if v_novo_nivel <= 0 then
    v_combustivel := null;
  else
    select max(data_hora) into v_ultimo_esvazia
      from public.esvaziamentos_tanque
     where deposito_id = p_deposito_id;

    select tipo_combustivel into v_combustivel
      from public.entradas_combustivel
     where deposito_id = p_deposito_id
       and (v_ultimo_esvazia is null or data_hora::timestamptz > v_ultimo_esvazia)
     order by data_hora desc
     limit 1;

    -- Fallback: tanque com nível mas sem entrada pós-esvaziamento → pega de
    -- transferência recebida (origem do combustível seria a transfer)
    if v_combustivel is null then
      select d.combustivel_atual_id into v_combustivel
        from public.transferencias_combustivel t
        join public.depositos d on d.id = t.deposito_origem_id
       where t.deposito_destino_id = p_deposito_id
         and (v_ultimo_esvazia is null or t.data_hora::timestamptz > v_ultimo_esvazia)
       order by t.data_hora desc
       limit 1;
    end if;
  end if;

  update public.depositos
     set nivel_atual_litros = v_novo_nivel,
         combustivel_atual_id = v_combustivel
   where id = p_deposito_id;
end;
$$;

-- Trigger pra esvaziamentos_tanque (mesmo padrão dos existing)
create or replace function public.fn_trigger_recalcular_nivel_esvazia()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.deposito_id is not null then
      perform public.recalcular_nivel_deposito(old.deposito_id);
    end if;
    return old;
  end if;
  if new.deposito_id is not null then
    perform public.recalcular_nivel_deposito(new.deposito_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_esvaziamentos_recalc_nivel on public.esvaziamentos_tanque;
create trigger trg_esvaziamentos_recalc_nivel
  after insert or update or delete on public.esvaziamentos_tanque
  for each row execute function public.fn_trigger_recalcular_nivel_esvazia();

-- ── (4) Validação de mistura — entradas_combustivel ──────────────
create or replace function public.fn_validate_entrada_combustivel()
returns trigger
language plpgsql
as $$
declare
  v_nivel numeric;
  v_combustivel_atual text;
  v_eh_externo boolean;
  v_nome_tanque text;
  v_nome_atual text;
  v_nome_novo text;
begin
  select nivel_atual_litros, combustivel_atual_id, eh_externo, nome
    into v_nivel, v_combustivel_atual, v_eh_externo, v_nome_tanque
    from public.depositos
   where id = new.deposito_id;

  if coalesce(v_eh_externo, false) then return new; end if;
  if v_combustivel_atual is null or coalesce(v_nivel, 0) <= 0 then return new; end if;
  if v_combustivel_atual = new.tipo_combustivel then return new; end if;

  select nome into v_nome_atual from public.insumos where id = v_combustivel_atual;
  select nome into v_nome_novo from public.insumos where id = new.tipo_combustivel;
  raise exception
    'Tanque "%" já contém % (% L). Não pode receber %. Esvazie o tanque primeiro ou use o mesmo combustível.',
    v_nome_tanque,
    coalesce(v_nome_atual, v_combustivel_atual),
    v_nivel,
    coalesce(v_nome_novo, new.tipo_combustivel);
end;
$$;

drop trigger if exists trg_validate_entrada_combustivel on public.entradas_combustivel;
create trigger trg_validate_entrada_combustivel
  before insert or update on public.entradas_combustivel
  for each row execute function public.fn_validate_entrada_combustivel();

-- ── (5) Validação de mistura — transferencias_combustivel ────────
create or replace function public.fn_validate_transferencia_combustivel()
returns trigger
language plpgsql
as $$
declare
  v_combustivel_origem text;
  v_nivel_origem numeric;
  v_nivel_destino numeric;
  v_combustivel_destino text;
  v_eh_externo_destino boolean;
  v_nome_origem text;
  v_nome_destino text;
  v_nome_comb_origem text;
  v_nome_comb_destino text;
begin
  select combustivel_atual_id, nivel_atual_litros, nome
    into v_combustivel_origem, v_nivel_origem, v_nome_origem
    from public.depositos where id = new.deposito_origem_id;

  select nivel_atual_litros, combustivel_atual_id, eh_externo, nome
    into v_nivel_destino, v_combustivel_destino, v_eh_externo_destino, v_nome_destino
    from public.depositos where id = new.deposito_destino_id;

  if v_combustivel_origem is null then
    raise exception 'Tanque origem "%" não tem combustível identificável (vazio ou sem registro).', v_nome_origem;
  end if;

  if coalesce(v_eh_externo_destino, false) then return new; end if;
  if v_combustivel_destino is null or coalesce(v_nivel_destino, 0) <= 0 then return new; end if;
  if v_combustivel_destino = v_combustivel_origem then return new; end if;

  select nome into v_nome_comb_origem from public.insumos where id = v_combustivel_origem;
  select nome into v_nome_comb_destino from public.insumos where id = v_combustivel_destino;
  raise exception
    'Tanque destino "%" já contém % (% L). Não pode receber % do tanque origem "%". Esvazie o destino primeiro.',
    v_nome_destino,
    coalesce(v_nome_comb_destino, v_combustivel_destino),
    v_nivel_destino,
    coalesce(v_nome_comb_origem, v_combustivel_origem),
    v_nome_origem;
end;
$$;

drop trigger if exists trg_validate_transferencia_combustivel on public.transferencias_combustivel;
create trigger trg_validate_transferencia_combustivel
  before insert or update on public.transferencias_combustivel
  for each row execute function public.fn_validate_transferencia_combustivel();

-- ── (6) Backfill: seta combustivel_atual_id da última entrada ────
update public.depositos d
   set combustivel_atual_id = (
     select e.tipo_combustivel
       from public.entradas_combustivel e
      where e.deposito_id = d.id
      order by e.data_hora desc
      limit 1
   )
 where coalesce(d.nivel_atual_litros, 0) > 0
   and coalesce(d.eh_externo, false) = false
   and d.combustivel_atual_id is null;

-- ── (7) Recalcula tudo (sanity) ───────────────────────────────────
do $$
declare v record;
begin
  for v in select id from public.depositos loop
    perform public.recalcular_nivel_deposito(v.id);
  end loop;
  raise notice 'F11 aplicado: combustivel_atual_id + esvaziamentos + triggers + backfill.';
end $$;

commit;
