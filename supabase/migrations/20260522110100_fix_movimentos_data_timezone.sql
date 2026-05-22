-- Bugfix da auditoria: triggers fn_fretes_movimentos e fn_pagamentos_frete_movimentos
-- estavam fazendo `v_data := new.data::timestamptz` que em sessão UTC interpreta
-- "2026-05-15" como '2026-05-15 00:00:00+00 UTC'. Ao exibir em São Paulo (-3)
-- vira '2026-05-14 21:00' → user vê 14/05 no lugar de 15/05.
--
-- Fix: converter texto data → timestamp em São Paulo (meio-dia local),
-- que vira '2026-05-15 15:00+00 UTC'. Imune a TZ shift em qualquer fuso ±12h.
--
-- Inclui backfill dos 911 movimentos existentes onde a hora está em UTC midnight
-- (padrão deixado pelo trigger antigo). Triggers de audit são desabilitados
-- durante o backfill pra não poluir audit_log com 911 entradas de "update".

-- ============================================================================
-- 1. fn_fretes_movimentos — usa noon SP TZ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_fretes_movimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_mov_id text;
  v_data timestamptz;
begin
  if tg_op = 'DELETE' then
    delete from public.transportadora_movimentos
     where origem_tabela = 'fretes' and origem_id = old.id;
    return old;
  end if;

  -- Converte text "YYYY-MM-DD" → noon em São Paulo (imune a TZ shift)
  v_data := ((new.data::date + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo');

  if tg_op = 'UPDATE' then
    if new.transportadora_id is distinct from old.transportadora_id then
      delete from public.transportadora_movimentos
       where origem_tabela = 'fretes' and origem_id = old.id;
      -- Cai pro INSERT abaixo
    else
      update public.transportadora_movimentos
         set valor = new.valor_total, data = v_data
       where origem_tabela = 'fretes' and origem_id = new.id;
      return new;
    end if;
  end if;

  if new.transportadora_id is null then
    raise warning 'fretes id=% sem transportadora_id; movimento credito_frete NÃO criado.', new.id;
    return new;
  end if;

  if new.valor_total is null or new.valor_total <= 0 then
    raise warning 'fretes id=% com valor_total inválido (%); movimento NÃO criado.', new.id, new.valor_total;
    return new;
  end if;

  v_mov_id := public.fn_gerar_id_text();

  insert into public.transportadora_movimentos (
    id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
    descricao, obra_id, mes_referencia
  ) values (
    v_mov_id, new.transportadora_id, v_data,
    'credito_frete', new.valor_total,
    'fretes', new.id,
    'Frete ' || coalesce(new.nota_fiscal, '(sem NF)') || ' — ' || coalesce(new.origem, '?') || ' → ' || coalesce(new.destino, '?'),
    new.obra_id, date_trunc('month', v_data AT TIME ZONE 'America/Sao_Paulo')::date
  );

  return new;
end;
$function$;

-- ============================================================================
-- 2. fn_pagamentos_frete_movimentos — usa noon SP TZ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_pagamentos_frete_movimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_mov_id text;
  v_data timestamptz;
begin
  if tg_op = 'DELETE' then
    delete from public.transportadora_movimentos
     where origem_tabela = 'pagamentos_frete' and origem_id = old.id;
    return old;
  end if;

  -- Converte text "YYYY-MM-DD" → noon em São Paulo
  v_data := ((new.data::date + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo');

  if tg_op = 'UPDATE' then
    if new.transportadora_id is distinct from old.transportadora_id then
      delete from public.transportadora_movimentos
       where origem_tabela = 'pagamentos_frete' and origem_id = old.id;
    else
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
         else date_trunc('month', v_data AT TIME ZONE 'America/Sao_Paulo')::date end
  );

  return new;
end;
$function$;

-- ============================================================================
-- 3. Backfill movimentos existentes (TZ shift retroativo)
-- ============================================================================
-- Critério: o trigger antigo gravava '00:00:00+00' (UTC midnight). Identificamos
-- esses casos via `extract(hour from m.data AT TIME ZONE 'UTC') = 0` E que a origem
-- seja frete/pagamento (saidas_combustivel e ajuste_manual têm tempo real).

-- Desabilita audit trigger temporariamente pra não poluir audit_log
ALTER TABLE public.transportadora_movimentos DISABLE TRIGGER trg_audit_transp_movimentos;

UPDATE public.transportadora_movimentos m
SET data = (
  ((
    CASE
      WHEN m.origem_tabela = 'fretes' THEN (SELECT f.data FROM public.fretes f WHERE f.id = m.origem_id)
      WHEN m.origem_tabela = 'pagamentos_frete' THEN (SELECT p.data FROM public.pagamentos_frete p WHERE p.id = m.origem_id)
    END
  )::date + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo'
)
WHERE m.origem_tabela IN ('fretes', 'pagamentos_frete')
  AND extract(hour from (m.data AT TIME ZONE 'UTC')) = 0
  AND extract(minute from (m.data AT TIME ZONE 'UTC')) = 0
  AND extract(second from (m.data AT TIME ZONE 'UTC')) = 0;

ALTER TABLE public.transportadora_movimentos ENABLE TRIGGER trg_audit_transp_movimentos;
