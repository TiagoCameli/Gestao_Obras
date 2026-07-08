-- Fix 2026-07-08: tanque externo "Posto Progresso" no módulo de combustível.
-- 4 partes: (1) view transportadora_saldos inclui donas de tanque;
-- (2) trigger de movimentos usa o nome do tanque na descrição do débito;
-- (3) fornecedor Posto Progresso vira dona de tanque;
-- (4) cria o depósito externo Posto Progresso.
-- A trigger fn_saidas_combustivel_movimentos já é genérica (crédito pra dona,
-- débito pra transportadora); o resto acontece sozinho.

-- (1) View: conta corrente também pra dona de tanque que não é transportadora
CREATE OR REPLACE VIEW public.transportadora_saldos AS
 SELECT t.id AS transportadora_id,
    t.nome,
    t.eh_dona_de_tanque,
    COALESCE(sum(
        CASE
            WHEN m.tipo = ANY (ARRAY['credito_frete'::text, 'credito_abastecimento_transterra'::text, 'ajuste_manual_credito'::text]) THEN m.valor
            WHEN m.abatido_em_pagamento_id IS NOT NULL THEN 0::numeric
            ELSE - m.valor
        END), 0::numeric) AS saldo,
    COALESCE(sum(
        CASE
            WHEN m.tipo = ANY (ARRAY['debito_abastecimento_transterra'::text, 'debito_abastecimento_emt'::text]) THEN m.valor
            ELSE 0::numeric
        END), 0::numeric) AS debito_combustivel_total,
    COALESCE(sum(
        CASE
            WHEN m.tipo = 'credito_frete'::text THEN m.valor
            ELSE 0::numeric
        END), 0::numeric) AS credito_frete_total,
    COALESCE(sum(
        CASE
            WHEN m.tipo = 'debito_pagamento_frete'::text THEN m.valor
            ELSE 0::numeric
        END), 0::numeric) AS pago_frete_total,
    count(m.id) FILTER (WHERE m.id IS NOT NULL) AS qtd_movimentos
   FROM fornecedores t
     LEFT JOIN transportadora_movimentos m ON m.transportadora_id = t.id AND m.deleted_at IS NULL AND NOT (EXISTS ( SELECT 1
           FROM fretes f
          WHERE m.origem_tabela = 'fretes'::text AND f.id = m.origem_id AND f.deleted_at IS NOT NULL)) AND NOT (EXISTS ( SELECT 1
           FROM pagamentos_frete p
          WHERE m.origem_tabela = 'pagamentos_frete'::text AND p.id = m.origem_id AND p.deleted_at IS NOT NULL)) AND NOT (EXISTS ( SELECT 1
           FROM saidas_combustivel s
          WHERE m.origem_tabela = 'saidas_combustivel'::text AND s.id = m.origem_id AND s.deleted_at IS NOT NULL))
  WHERE t.eh_transportadora = true OR t.eh_dona_de_tanque = true
  GROUP BY t.id, t.nome, t.eh_dona_de_tanque;

-- (2) Trigger: descrição do débito deixa de chumbar "Transterra"
-- (única mudança na função: a linha da descricao do débito em tanque externo)
CREATE OR REPLACE FUNCTION public.fn_saidas_combustivel_movimentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_proprietaria_id text;
  v_credito_id text;
  v_debito_id text;
  v_old_transp text;
  v_old_tanque text;
  v_credito_valor numeric;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    delete from public.transportadora_movimentos
     where origem_tabela = 'saidas_combustivel' and origem_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    v_old_transp := old.transportadora_id;
    v_old_tanque := old.tanque_id;
    if (new.transportadora_id is distinct from v_old_transp)
       or (new.tanque_id is distinct from v_old_tanque)
       or (new.tipo_consumidor is distinct from old.tipo_consumidor) then
      delete from public.transportadora_movimentos
       where origem_tabela = 'saidas_combustivel' and origem_id = old.id;
      -- Cai pro fluxo de INSERT abaixo
    else
      -- Recalcula in-place: crédito proprietária com fórmula nova; débito = valor_total
      update public.transportadora_movimentos
         set valor = case
               when tipo = 'credito_abastecimento_transterra'
                 then new.litros * (coalesce(new.preco_combustivel_areacre, new.preco_combustivel, 0) + coalesce(new.taxa_litro, 0))
               else new.valor_total
             end,
             data = new.data
       where origem_tabela = 'saidas_combustivel' and origem_id = new.id;
      return new;
    end if;
  end if;

  -- Fluxo INSERT (também alcançado por UPDATE com mudança estrutural)
  if new.tipo_consumidor != 'carreta_transportadora' then
    return new;
  end if;

  if new.transportadora_id is null then
    raise warning 'saidas_combustivel id=% sem transportadora_id; movimento NÃO criado.', new.id;
    return new;
  end if;

  if new.tanque_id is null then
    raise warning 'saidas_combustivel id=% origem=carreta sem tanque_id; movimento NÃO criado.', new.id;
    return new;
  end if;

  select transportadora_proprietaria_id
    into v_proprietaria_id
    from public.depositos
   where id = new.tanque_id;

  if v_proprietaria_id is not null then
    -- Split: crédito usa preco_combustivel_areacre (fallback preco_combustivel pra robustez);
    -- débito usa preco_combustivel via valor_total.
    v_credito_valor := new.litros * (coalesce(new.preco_combustivel_areacre, new.preco_combustivel, 0) + coalesce(new.taxa_litro, 0));
    v_credito_id := public.fn_gerar_id_text();
    v_debito_id := public.fn_gerar_id_text();

    insert into public.transportadora_movimentos (
      id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
      descricao, obra_id, mes_referencia
    ) values (
      v_credito_id, v_proprietaria_id, new.data,
      'credito_abastecimento_transterra', v_credito_valor,
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
      'Abastecimento no tanque ' || coalesce((select nome from public.depositos where id = new.tanque_id), '?')
        || ' (' || coalesce((select nome from public.fornecedores where id = v_proprietaria_id), '?') || ')',
      new.obra_id, date_trunc('month', new.data)::date
    );

    update public.saidas_combustivel set movimento_id = v_debito_id where id = new.id;
  else
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
$function$;

-- (3) Fornecedor Posto Progresso vira dona de tanque
UPDATE fornecedores SET eh_dona_de_tanque = true WHERE id = 'mrc6m0jfvca02';

-- (4) Depósito externo Posto Progresso (mesmo formato do Transterra Areacre)
INSERT INTO depositos (
  id, nome, capacidade_litros, nivel_atual_litros, ativo, criado_por,
  transportadora_proprietaria_id, apelido, eh_externo, foto_urls, arquivo_urls
) VALUES (
  public.fn_gerar_id_text(), 'Posto Progresso', 0, 0, true, 'fix_20260708',
  'mrc6m0jfvca02', NULL, true, '{}', '{}'
);
