-- Sincroniza o repo com o banco vivo no combustível (Fase 0 da migração para o ERP-EMT).
--
-- Os fixes deste projeto costumam ir direto no banco (SQL Editor ou MCP), e as migrations
-- do combustível deixaram de descrever o que roda. Esta migration é uma FOTO: cada função
-- abaixo é o pg_get_functiondef do banco gunyitwrbxbmnezokgjq em 22/09/2026, copiado sem
-- editar, e os 11 triggers são os que existem vivos sem CREATE TRIGGER no repo.
--
-- Aplicada no banco vivo ela não muda comportamento: recria as mesmas funções com o mesmo
-- corpo (CREATE OR REPLACE preserva os grants de EXECUTE que já existem) e os mesmos
-- triggers. Serve para o repo parar de mentir e é a referência que o ERP usa para portar as
-- regras (plano, seção 2).
--
-- Comparação feita função a função (corpo normalizado, assinatura, SECURITY DEFINER,
-- volatilidade e search_path) contra a última definição de cada uma em supabase/migrations/.
-- 11 funções do combustível já batiam e ficam de fora. Os *_rollback.sql desta pasta nunca
-- foram aplicados: quem ler a história tem que ignorá-los.
--
-- NÃO APLICADA. Registrar no histórico de migrations do banco é escrita em produção e
-- espera o ok do Tiago. O arquivo sozinho já fecha o descompasso do lado do repo.

-- ============================================================================
-- Lógica diferente do último arquivo do repo
-- ============================================================================

-- public.calcular_combustivel_tanque_na_data
CREATE OR REPLACE FUNCTION public.calcular_combustivel_tanque_na_data(p_deposito_id text, p_data_hora text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_combustivel text;
  v_data_ts timestamptz;
  v_ultimo_esvazia timestamptz;
  v_saldo numeric;
BEGIN
  IF p_deposito_id IS NULL OR p_data_hora IS NULL THEN RETURN NULL; END IF;
  v_data_ts := p_data_hora::timestamptz;

  v_saldo := public.calcular_estoque_combustivel_na_data(p_deposito_id, p_data_hora);
  IF v_saldo <= 0 THEN RETURN NULL; END IF;

  SELECT MAX(data_hora) INTO v_ultimo_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id AND data_hora <= v_data_ts;

  SELECT tipo_combustivel INTO v_combustivel
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND data_hora::timestamptz >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamptz)
   ORDER BY data_hora::timestamptz DESC LIMIT 1;

  IF v_combustivel IS NULL THEN
    SELECT t.tipo_combustivel INTO v_combustivel
      FROM public.transferencias_combustivel t
     WHERE t.deposito_destino_id = p_deposito_id AND t.deleted_at IS NULL
       AND t.tipo_combustivel IS NOT NULL
       AND t.data_hora::timestamptz <= v_data_ts
       AND t.data_hora::timestamptz >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamptz)
     ORDER BY t.data_hora::timestamptz DESC LIMIT 1;
  END IF;

  RETURN v_combustivel;
END;
$function$;

-- public.calcular_estoque_combustivel_na_data
CREATE OR REPLACE FUNCTION public.calcular_estoque_combustivel_na_data(p_deposito_id text, p_data_hora text, p_excluir_id text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
  v_data_ts timestamptz;
BEGIN
  IF p_deposito_id IS NULL OR p_data_hora IS NULL THEN
    RETURN 0;
  END IF;
  v_data_ts := p_data_hora::timestamptz;

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_entradas
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_transf_in
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_deposito_id AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(litros), 0) INTO v_saidas
    FROM public.saidas_combustivel
   WHERE tanque_id = p_deposito_id AND deleted_at IS NULL
     AND data <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_transf_out
    FROM public.transferencias_combustivel
   WHERE deposito_origem_id = p_deposito_id AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(litros_descartados), 0) INTO v_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id
     AND data_hora <= v_data_ts;

  RETURN GREATEST(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);
END;
$function$;

-- public.fn_saidas_combustivel_movimentos
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

  -- SOFT DELETE: saída apagada -> remove o(s) lançamento(s) da conta-corrente
  if tg_op = 'UPDATE' and new.deleted_at is not null then
    delete from public.transportadora_movimentos
     where origem_tabela = 'saidas_combustivel' and origem_id = new.id;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.deleted_at is null then
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
             data = new.data,
             mes_referencia = date_trunc('month', new.data)::date
       where origem_tabela = 'saidas_combustivel' and origem_id = new.id;
      return new;
    end if;
  end if;
  -- restauração (old.deleted_at not null e new.deleted_at null) cai pro INSERT abaixo, recriando

  -- Fluxo INSERT (também alcançado por UPDATE com mudança estrutural ou restauração)
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

-- public.fn_trigger_recalcular_nivel_esvazia
CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_nivel_esvazia()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF tg_op = 'DELETE' THEN
    IF old.deposito_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_id);
    END IF;
    RETURN old;
  END IF;

  IF new.deposito_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(new.deposito_id);
  END IF;

  IF tg_op = 'UPDATE'
     AND old.deposito_id IS DISTINCT FROM new.deposito_id
     AND old.deposito_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(old.deposito_id);
  END IF;

  RETURN new;
END;
$function$;

-- public.fn_trigger_recalcular_nivel_transferencia
CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_nivel_transferencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF tg_op = 'DELETE' THEN
    IF old.deposito_origem_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_origem_id);
    END IF;
    IF old.deposito_destino_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_destino_id);
    END IF;
    RETURN old;
  END IF;

  IF new.deposito_origem_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(new.deposito_origem_id);
  END IF;
  IF new.deposito_destino_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(new.deposito_destino_id);
  END IF;

  IF tg_op = 'UPDATE' THEN
    IF old.deposito_origem_id IS DISTINCT FROM new.deposito_origem_id
       AND old.deposito_origem_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_origem_id);
    END IF;
    IF old.deposito_destino_id IS DISTINCT FROM new.deposito_destino_id
       AND old.deposito_destino_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_destino_id);
    END IF;
  END IF;

  RETURN new;
END;
$function$;

-- public.recalcular_nivel_deposito
CREATE OR REPLACE FUNCTION public.recalcular_nivel_deposito(p_deposito_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
  v_nivel numeric;
  v_ultimo_insumo text;
  v_ultimo_esvazia timestamp;
BEGIN
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_entradas
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_in
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(litros), 0)
    INTO v_saidas
    FROM public.saidas_combustivel
   WHERE tanque_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_out
    FROM public.transferencias_combustivel
   WHERE deposito_origem_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(litros_descartados), 0)
    INTO v_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id;

  v_nivel := GREATEST(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);

  -- Computa o último esvaziamento uma vez (timestamp, não text)
  SELECT MAX(data_hora) INTO v_ultimo_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id;

  IF v_nivel <= 0 THEN
    v_ultimo_insumo := NULL;
  ELSE
    SELECT tipo_combustivel
      INTO v_ultimo_insumo
      FROM public.entradas_combustivel
     WHERE deposito_id = p_deposito_id
       AND deleted_at IS NULL
       AND data_hora >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamp)
     ORDER BY data_hora DESC
     LIMIT 1;

    IF v_ultimo_insumo IS NULL THEN
      SELECT t.tipo_combustivel
        INTO v_ultimo_insumo
        FROM public.transferencias_combustivel t
       WHERE t.deposito_destino_id = p_deposito_id
         AND t.deleted_at IS NULL
         AND t.tipo_combustivel IS NOT NULL
         AND t.data_hora >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamp)
       ORDER BY t.data_hora DESC
       LIMIT 1;
    END IF;
  END IF;

  UPDATE public.depositos
     SET nivel_atual_litros = v_nivel,
         combustivel_atual_id = v_ultimo_insumo
   WHERE id = p_deposito_id;
END;
$function$;

-- public.registrar_saida_combustivel_fifo
CREATE OR REPLACE FUNCTION public.registrar_saida_combustivel_fifo(p_saida jsonb, p_lotes jsonb, p_litros_sem_suprimento numeric DEFAULT 0)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_saida_id text;
  v_foto_urls jsonb := p_saida->'foto_urls';
  v_arquivo_urls jsonb := p_saida->'arquivo_urls';
BEGIN
  IF NOT (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  ) THEN
    RAISE EXCEPTION 'Permissão negada para registrar saída de combustível';
  END IF;

  IF v_foto_urls IS NULL OR jsonb_typeof(v_foto_urls) <> 'array' THEN
    v_foto_urls := '[]'::jsonb;
  END IF;
  IF v_arquivo_urls IS NULL OR jsonb_typeof(v_arquivo_urls) <> 'array' THEN
    v_arquivo_urls := '[]'::jsonb;
  END IF;

  -- Insere só a saída. consumos_lote + saidas_sem_suprimento + preço FIFO das
  -- saídas equipamento_proprio são reconstruídos pelo trigger autoritativo.
  -- p_lotes / p_litros_sem_suprimento ignorados (compat de assinatura).
  INSERT INTO public.saidas_combustivel (
    id, data, origem, tipo_consumidor,
    tanque_id, equipamento_id, transportadora_id, placa,
    obra_id, etapa_id, alocacoes,
    tipo_combustivel, litros,
    preco_medio_tanque_snapshot, taxa_litro, preco_unitario, valor_total,
    preco_combustivel, preco_combustivel_areacre,
    foto_urls, arquivo_urls,
    observacoes, pago, pago_em, movimento_id, motorista,
    medicao_no_abastecimento, tipo_medicao_snapshot,
    created_by, updated_by
  ) VALUES (
    p_saida->>'id',
    (p_saida->>'data')::timestamp,
    p_saida->>'origem',
    p_saida->>'tipo_consumidor',
    NULLIF(p_saida->>'tanque_id', ''),
    NULLIF(p_saida->>'equipamento_id', ''),
    NULLIF(p_saida->>'transportadora_id', ''),
    NULLIF(p_saida->>'placa', ''),
    NULLIF(p_saida->>'obra_id', ''),
    NULLIF(p_saida->>'etapa_id', ''),
    p_saida->'alocacoes',
    p_saida->>'tipo_combustivel',
    (p_saida->>'litros')::numeric,
    NULLIF(p_saida->>'preco_medio_tanque_snapshot', '')::numeric,
    COALESCE((p_saida->>'taxa_litro')::numeric, 0),
    (p_saida->>'preco_unitario')::numeric,
    (p_saida->>'valor_total')::numeric,
    NULLIF(p_saida->>'preco_combustivel', '')::numeric,
    NULLIF(p_saida->>'preco_combustivel_areacre', '')::numeric,
    ARRAY(SELECT jsonb_array_elements_text(v_foto_urls)),
    ARRAY(SELECT jsonb_array_elements_text(v_arquivo_urls)),
    p_saida->>'observacoes',
    COALESCE((p_saida->>'pago')::boolean, false),
    NULLIF(p_saida->>'pago_em', '')::timestamptz,
    NULLIF(p_saida->>'movimento_id', ''),
    COALESCE(p_saida->>'motorista', ''),
    NULLIF(p_saida->>'medicao_no_abastecimento', '')::numeric,
    NULLIF(p_saida->>'tipo_medicao_snapshot', ''),
    NULLIF(p_saida->>'created_by', ''),
    NULLIF(p_saida->>'updated_by', '')
  )
  RETURNING id INTO v_saida_id;

  RETURN v_saida_id;
END;
$function$;

-- ============================================================================
-- Banco roda o fix; o último arquivo do repo era o rollback
-- ============================================================================

-- public.fn_stamp_transferencia_tipo_combustivel
CREATE OR REPLACE FUNCTION public.fn_stamp_transferencia_tipo_combustivel()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.deposito_origem_id IS NULL OR NEW.data_hora IS NULL THEN
    RETURN NEW;
  END IF;
  IF tg_op = 'UPDATE'
     AND NEW.deposito_origem_id IS NOT DISTINCT FROM OLD.deposito_origem_id
     AND NEW.data_hora IS NOT DISTINCT FROM OLD.data_hora THEN
    RETURN NEW;
  END IF;
  NEW.tipo_combustivel := public.calcular_combustivel_tanque_na_data(
    NEW.deposito_origem_id, NEW.data_hora::text);
  RETURN NEW;
END;
$function$;

-- public.fn_validate_transferencia_combustivel
CREATE OR REPLACE FUNCTION public.fn_validate_transferencia_combustivel()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
  if tg_op = 'UPDATE'
     and new.deposito_origem_id is not distinct from old.deposito_origem_id
     and new.deposito_destino_id is not distinct from old.deposito_destino_id
     and new.quantidade_litros is not distinct from old.quantidade_litros
     and new.data_hora is not distinct from old.data_hora then
    return new;
  end if;

  select combustivel_atual_id, nivel_atual_litros, nome
    into v_combustivel_origem, v_nivel_origem, v_nome_origem
    from public.depositos where id = new.deposito_origem_id;

  select nivel_atual_litros, combustivel_atual_id, eh_externo, nome
    into v_nivel_destino, v_combustivel_destino, v_eh_externo_destino, v_nome_destino
    from public.depositos where id = new.deposito_destino_id;

  if v_combustivel_origem is null then
    raise exception 'Tanque origem "%" nao tem combustivel identificavel (vazio ou sem registro).', v_nome_origem;
  end if;

  if coalesce(v_eh_externo_destino, false) then return new; end if;
  if v_combustivel_destino is null or coalesce(v_nivel_destino, 0) <= 0 then return new; end if;
  if v_combustivel_destino = v_combustivel_origem then return new; end if;

  select nome into v_nome_comb_origem from public.insumos where id = v_combustivel_origem;
  select nome into v_nome_comb_destino from public.insumos where id = v_combustivel_destino;
  raise exception
    'Tanque destino "%" ja contem % (% L). Nao pode receber % do tanque origem "%". Esvazie o destino primeiro.',
    v_nome_destino,
    coalesce(v_nome_comb_destino, v_combustivel_destino),
    v_nivel_destino,
    coalesce(v_nome_comb_origem, v_combustivel_origem),
    v_nome_origem;
end;
$function$;

-- public.fn_validate_saida_combustivel
CREATE OR REPLACE FUNCTION public.fn_validate_saida_combustivel()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_eh_externo boolean;
  v_nome_tanque text;
  v_saldo numeric;
  v_data_text text;
  v_excluir text;
  v_skip_saldo boolean := false;
BEGIN
  IF NEW.origem IS DISTINCT FROM 'tanque' OR NEW.tanque_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT eh_externo, nome
    INTO v_eh_externo, v_nome_tanque
    FROM public.depositos
   WHERE id = NEW.tanque_id;

  IF COALESCE(v_eh_externo, false) THEN
    RETURN NEW;
  END IF;

  v_data_text := NEW.data::text;

  -- COALESCE: nunca troca um tipo valido por NULL.
  NEW.tipo_combustivel := COALESCE(
    public.calcular_combustivel_tanque_na_data(NEW.tanque_id, v_data_text),
    NEW.tipo_combustivel
  );

  IF TG_OP = 'UPDATE'
     AND OLD.litros = NEW.litros
     AND OLD.data = NEW.data
     AND OLD.tanque_id IS NOT DISTINCT FROM NEW.tanque_id
     AND OLD.origem IS NOT DISTINCT FROM NEW.origem
  THEN
    v_skip_saldo := true;
  END IF;

  IF NOT v_skip_saldo THEN
    v_excluir := CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END;
    v_saldo := public.calcular_estoque_combustivel_na_data(
      NEW.tanque_id,
      v_data_text,
      v_excluir
    );

    IF NEW.litros > v_saldo THEN
      RAISE EXCEPTION
        'Saldo insuficiente no tanque "%": disponível % L em %, tentativa de saída de % L.',
        COALESCE(v_nome_tanque, NEW.tanque_id),
        v_saldo,
        v_data_text,
        NEW.litros;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- Corpo igual, banco tem search_path e o repo não
-- ============================================================================

-- public.fn_block_entrada_em_deposito_externo
CREATE OR REPLACE FUNCTION public.fn_block_entrada_em_deposito_externo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

-- public.fn_block_transferencia_envolvendo_externo
CREATE OR REPLACE FUNCTION public.fn_block_transferencia_envolvendo_externo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

-- public.fn_trigger_recalcular_nivel_entrada
CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_nivel_entrada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
  if tg_op = 'UPDATE' and old.deposito_id is distinct from new.deposito_id and old.deposito_id is not null then
    perform public.recalcular_nivel_deposito(old.deposito_id);
  end if;
  return new;
end;
$function$;

-- public.fn_trigger_recalcular_nivel_saida
CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_nivel_saida()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    if old.tanque_id is not null then
      perform public.recalcular_nivel_deposito(old.tanque_id);
    end if;
    return old;
  end if;
  if new.tanque_id is not null then
    perform public.recalcular_nivel_deposito(new.tanque_id);
  end if;
  if tg_op = 'UPDATE' and old.tanque_id is distinct from new.tanque_id and old.tanque_id is not null then
    perform public.recalcular_nivel_deposito(old.tanque_id);
  end if;
  return new;
end;
$function$;

-- public.fn_validate_entrada_combustivel
CREATE OR REPLACE FUNCTION public.fn_validate_entrada_combustivel()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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

  -- Tanque externo: sem controle de mistura
  if coalesce(v_eh_externo, false) then return new; end if;
  -- Tanque vazio ou sem combustível registrado: aceita qualquer um
  if v_combustivel_atual is null or coalesce(v_nivel, 0) <= 0 then return new; end if;
  -- Mesmo combustível: ok
  if v_combustivel_atual = new.tipo_combustivel then return new; end if;

  -- Mistura → bloqueia
  select nome into v_nome_atual from public.insumos where id = v_combustivel_atual;
  select nome into v_nome_novo from public.insumos where id = new.tipo_combustivel;
  raise exception
    'Tanque "%" já contém % (% L). Não pode receber %. Esvazie o tanque primeiro ou use o mesmo combustível.',
    v_nome_tanque,
    coalesce(v_nome_atual, v_combustivel_atual),
    v_nivel,
    coalesce(v_nome_novo, new.tipo_combustivel);
end;
$function$;

-- public.saldo_devedor_combustivel
CREATE OR REPLACE FUNCTION public.saldo_devedor_combustivel(p_transportadora_id text, p_ate_data timestamp with time zone DEFAULT now())
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(sum(valor), 0)
  from public.transportadora_movimentos
  where transportadora_id = p_transportadora_id
    and tipo in ('debito_abastecimento_transterra', 'debito_abastecimento_emt')
    and abatido_em_pagamento_id is null
    and data <= p_ate_data;
$function$;

-- public.tg_saidas_combustivel_sync_medicao
CREATE OR REPLACE FUNCTION public.tg_saidas_combustivel_sync_medicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  med_id text;
begin
  med_id := 'med-abast-' || NEW.id;

  -- Saída soft-deletada → soft-delete da medição correspondente
  if NEW.deleted_at is not null then
    update public.medicoes_equipamento
      set deleted_at = NEW.deleted_at,
          deleted_by = NEW.deleted_by
      where id = med_id and deleted_at is null;
    return NEW;
  end if;

  -- Há leitura informada → upsert
  if NEW.medicao_no_abastecimento is not null
     and NEW.equipamento_id is not null
     and NEW.tipo_medicao_snapshot is not null then
    insert into public.medicoes_equipamento (
      id, equipamento_id, data, tipo_medicao, valor,
      origem, origem_id, observacoes, created_by, updated_by
    ) values (
      med_id,
      NEW.equipamento_id,
      NEW.data,
      NEW.tipo_medicao_snapshot,
      NEW.medicao_no_abastecimento,
      'abastecimento',
      NEW.id,
      '',
      NEW.created_by,
      NEW.updated_by
    )
    on conflict (id) do update set
      equipamento_id = excluded.equipamento_id,
      data = excluded.data,
      tipo_medicao = excluded.tipo_medicao,
      valor = excluded.valor,
      updated_at = now(),
      updated_by = excluded.updated_by,
      deleted_at = null,
      deleted_by = null;
  else
    -- Sem leitura (campo apagado em edição) → soft-delete a medição correspondente
    update public.medicoes_equipamento
      set deleted_at = now(),
          deleted_by = NEW.updated_by
      where id = med_id and deleted_at is null;
  end if;

  return NEW;
end;
$function$;

-- ============================================================================
-- Só o texto de mensagem ou comentário muda
-- ============================================================================

-- private.trg_lock_ciclo_transferencia
CREATE OR REPLACE FUNCTION private.trg_lock_ciclo_transferencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_io timestamp; v_id timestamp; v_fechado boolean := false;
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
  IF OLD.deposito_origem_id IS NOT NULL AND NOT private.tanque_eh_externo(OLD.deposito_origem_id) THEN
    v_io := private.inicio_ciclo_aberto(OLD.deposito_origem_id);
    IF v_io IS NOT NULL AND OLD.data_hora < v_io THEN v_fechado := true; END IF;
  END IF;
  IF OLD.deposito_destino_id IS NOT NULL AND NOT private.tanque_eh_externo(OLD.deposito_destino_id) THEN
    v_id := private.inicio_ciclo_aberto(OLD.deposito_destino_id);
    IF v_id IS NOT NULL AND OLD.data_hora < v_id THEN v_fechado := true; END IF;
  END IF;
  IF NOT v_fechado THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Ciclo fechado: esta transferência é de um ciclo já encerrado. Não dá pra excluir.';
  END IF;
  IF NEW.deposito_origem_id IS DISTINCT FROM OLD.deposito_origem_id OR NEW.deposito_destino_id IS DISTINCT FROM OLD.deposito_destino_id
     OR NEW.quantidade_litros IS DISTINCT FROM OLD.quantidade_litros OR NEW.data_hora IS DISTINCT FROM OLD.data_hora
     OR NEW.tipo_combustivel IS DISTINCT FROM OLD.tipo_combustivel THEN
    RAISE EXCEPTION 'Ciclo fechado: transferência travada. Só dá pra ajustar fotos e observação.';
  END IF;
  RETURN NEW;
END;
$function$;

-- private.inicio_ciclo_aberto
CREATE OR REPLACE FUNCTION private.inicio_ciclo_aberto(p_tanque_id text)
 RETURNS timestamp without time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  WITH mov AS (
    SELECT e.data_hora AS quando, e.quantidade_litros AS delta, 1 AS infl, 1 AS ord
      FROM public.entradas_combustivel e WHERE e.deposito_id = p_tanque_id AND e.deleted_at IS NULL
    UNION ALL
    SELECT t.data_hora, t.quantidade_litros, 1, 1 FROM public.transferencias_combustivel t
     WHERE t.deposito_destino_id = p_tanque_id AND t.deleted_at IS NULL
    UNION ALL
    SELECT t.data_hora, -t.quantidade_litros, 0, 0 FROM public.transferencias_combustivel t
     WHERE t.deposito_origem_id = p_tanque_id AND t.deleted_at IS NULL
    UNION ALL
    SELECT s.data, -s.litros, 0, 0 FROM public.saidas_combustivel s
     WHERE s.tanque_id = p_tanque_id AND s.origem = 'tanque' AND s.deleted_at IS NULL
    UNION ALL
    SELECT ev.data_hora, -ev.litros_descartados, 0, 0 FROM public.esvaziamentos_tanque ev
     WHERE ev.deposito_id = p_tanque_id
  ),
  r AS (
    SELECT quando, delta, infl,
           SUM(delta) OVER (ORDER BY quando, ord ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS bal_after
    FROM mov
  )
  SELECT MAX(quando) FROM r WHERE infl = 1 AND (bal_after - delta) <= 0.001;
$function$;

-- private.recompute_fifo_tanque
CREATE OR REPLACE FUNCTION private.recompute_fifo_tanque(p_tanque_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_saida   record;
  v_lote    record;
  v_restante      numeric;
  v_consome       numeric;
  v_total_valor   numeric;
  v_total_litros  numeric;
  v_preco         numeric;
  v_externo       boolean;
BEGIN
  IF p_tanque_id IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.fifo_recomputing', '1', true);

  SELECT eh_externo INTO v_externo FROM public.depositos WHERE id = p_tanque_id;
  IF COALESCE(v_externo, false) THEN
    DELETE FROM public.consumos_lote
    WHERE consumo_tipo = 'saida'
      AND consumo_id IN (SELECT id FROM public.saidas_combustivel WHERE tanque_id = p_tanque_id);
    DELETE FROM public.saidas_sem_suprimento WHERE tanque_id = p_tanque_id;
    PERFORM set_config('app.fifo_recomputing', '', true);
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _fifo_lotes (
    seq          bigserial PRIMARY KEY,
    fonte_tipo   text NOT NULL,
    fonte_id     text NOT NULL,
    tipo_comb    text,
    data_origem  timestamp NOT NULL,
    saldo        numeric NOT NULL,
    preco        numeric NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _fifo_lotes RESTART IDENTITY;

  INSERT INTO _fifo_lotes (fonte_tipo, fonte_id, tipo_comb, data_origem, saldo, preco)
  SELECT 'entrada', e.id, e.tipo_combustivel, e.data_hora, e.quantidade_litros,
         CASE WHEN e.quantidade_litros > 0 THEN e.valor_total / e.quantidade_litros ELSE 0 END
  FROM public.entradas_combustivel e
  WHERE e.deposito_id = p_tanque_id AND e.deleted_at IS NULL;

  INSERT INTO _fifo_lotes (fonte_tipo, fonte_id, tipo_comb, data_origem, saldo, preco)
  SELECT 'transferencia', t.id, t.tipo_combustivel, t.data_hora, t.quantidade_litros,
         CASE WHEN t.quantidade_litros > 0 THEN t.valor_total / t.quantidade_litros ELSE 0 END
  FROM public.transferencias_combustivel t
  WHERE t.deposito_destino_id = p_tanque_id AND t.deleted_at IS NULL;

  DELETE FROM public.consumos_lote
  WHERE consumo_tipo = 'saida'
    AND consumo_id IN (SELECT id FROM public.saidas_combustivel WHERE tanque_id = p_tanque_id);
  DELETE FROM public.saidas_sem_suprimento WHERE tanque_id = p_tanque_id;

  FOR v_saida IN
    SELECT id, data, litros, tipo_consumidor, tipo_combustivel
    FROM public.saidas_combustivel
    WHERE tanque_id = p_tanque_id AND origem = 'tanque' AND deleted_at IS NULL
    ORDER BY data ASC, created_at ASC, id ASC
  LOOP
    v_restante := v_saida.litros;
    v_total_valor := 0;
    v_total_litros := 0;

    FOR v_lote IN
      SELECT seq, fonte_tipo, fonte_id, saldo, preco
      FROM _fifo_lotes
      WHERE tipo_comb = v_saida.tipo_combustivel
        AND data_origem <= v_saida.data
        AND saldo > 0
      ORDER BY data_origem ASC, seq ASC
    LOOP
      EXIT WHEN v_restante <= 0;
      v_preco := v_lote.preco;
      v_consome := LEAST(v_restante, v_lote.saldo);
      INSERT INTO public.consumos_lote (consumo_id, consumo_tipo, fonte_tipo, fonte_id, litros, preco_lote)
      VALUES (v_saida.id, 'saida', v_lote.fonte_tipo, v_lote.fonte_id, v_consome, v_preco);
      UPDATE _fifo_lotes SET saldo = saldo - v_consome WHERE seq = v_lote.seq;
      v_total_valor := v_total_valor + v_consome * v_preco;
      v_total_litros := v_total_litros + v_consome;
      v_restante := v_restante - v_consome;
    END LOOP;

    IF v_saida.tipo_consumidor = 'equipamento_proprio' AND v_total_litros > 0 THEN
      UPDATE public.saidas_combustivel
      SET preco_unitario               = v_total_valor / v_total_litros,
          preco_medio_tanque_snapshot  = v_total_valor / v_total_litros,
          valor_total                  = (v_total_valor / v_total_litros) * v_saida.litros
      WHERE id = v_saida.id;
    END IF;

    IF v_restante > 0 THEN
      INSERT INTO public.saidas_sem_suprimento (
        saida_id, tanque_id, data_saida, litros_solicitados, litros_supridos, litros_sem_suprimento
      ) VALUES (
        v_saida.id, p_tanque_id, v_saida.data, v_saida.litros, v_total_litros, v_restante
      );
    END IF;
  END LOOP;

  PERFORM set_config('app.fifo_recomputing', '', true);
END;
$function$;

-- private.trg_lock_ciclo_saida
CREATE OR REPLACE FUNCTION private.trg_lock_ciclo_saida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_inicio timestamp;
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
  IF OLD.origem IS DISTINCT FROM 'tanque' OR OLD.tanque_id IS NULL OR private.tanque_eh_externo(OLD.tanque_id) THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_inicio := private.inicio_ciclo_aberto(OLD.tanque_id);
  IF v_inicio IS NULL OR OLD.data >= v_inicio THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
  -- ciclo fechado
  IF TG_OP = 'DELETE' OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Ciclo fechado: o tanque "%" já zerou e recebeu combustível novo. Não dá pra excluir esta saída.',
      (SELECT nome FROM public.depositos WHERE id = OLD.tanque_id);
  END IF;
  IF NEW.tanque_id IS DISTINCT FROM OLD.tanque_id OR NEW.litros IS DISTINCT FROM OLD.litros OR NEW.data IS DISTINCT FROM OLD.data THEN
    RAISE EXCEPTION 'Ciclo fechado no tanque "%": só dá pra ajustar equipamento, obra, etapa, fotos, observação e medição. Tanque, litros e data estão travados.',
      (SELECT nome FROM public.depositos WHERE id = OLD.tanque_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- public.fn_validate_data_nao_futura_wc
CREATE OR REPLACE FUNCTION public.fn_validate_data_nao_futura_wc()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_data    timestamp;
  v_now_br  timestamp;
begin
  if TG_TABLE_NAME = 'saidas_combustivel' then
    v_data := NEW.data;
  else
    v_data := NEW.data_hora;
  end if;

  v_now_br := (now() AT TIME ZONE 'America/Sao_Paulo')::timestamp;

  if v_data > v_now_br + interval '24 hours' then
    raise exception
      'Data % não pode ser mais de 24h no futuro (agora BR: %)',
      v_data, v_now_br;
  end if;

  return NEW;
end;
$function$;

-- ============================================================================
-- Existem só no banco, sem nenhum arquivo no repo
-- ============================================================================

-- public.audit_combustivel_log
CREATE OR REPLACE FUNCTION public.audit_combustivel_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_tipo text;
  v_alvo_id text;
  v_funcionario_id text;
  v_detalhes text;
  v_diff jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_alvo_id := OLD.id;
  ELSE
    v_alvo_id := NEW.id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_tipo := TG_TABLE_NAME || '_create';
    v_funcionario_id := COALESCE(NEW.created_by, 'system');
    v_detalhes := to_jsonb(NEW)::text;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_tipo := TG_TABLE_NAME || '_delete';
      v_funcionario_id := COALESCE(NEW.deleted_by, 'system');
      v_detalhes := jsonb_build_object('deleted_by', NEW.deleted_by, 'deleted_at', NEW.deleted_at)::text;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_tipo := TG_TABLE_NAME || '_restore';
      v_funcionario_id := COALESCE(NEW.updated_by, 'system');
      v_detalhes := jsonb_build_object('restored_by', NEW.updated_by, 'restored_at', NEW.updated_at)::text;
    ELSE
      v_tipo := TG_TABLE_NAME || '_update';
      v_funcionario_id := COALESCE(NEW.updated_by, 'system');
      SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
      INTO v_diff
      FROM (
        SELECT k AS key,
               to_jsonb(OLD) -> k AS old_val,
               to_jsonb(NEW) -> k AS new_val
        FROM jsonb_object_keys(to_jsonb(NEW)) AS k
      ) sub
      WHERE old_val IS DISTINCT FROM new_val
        AND key NOT IN ('updated_at', 'updated_by');
      v_detalhes := COALESCE(v_diff::text, '{}');
      -- Skip se nada mudou de fato (evita ruído quando só updated_at foi tocado)
      IF v_diff IS NULL OR v_diff = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_tipo := TG_TABLE_NAME || '_hard_delete';
    v_funcionario_id := 'system';
    v_detalhes := to_jsonb(OLD)::text;
  END IF;

  INSERT INTO public.audit_log (id, tipo, funcionario_id, alvo_id, detalhes, data_hora)
  VALUES (
    'al_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 0, 9),
    v_tipo,
    v_funcionario_id,
    v_alvo_id,
    v_detalhes,
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- public.check_pode_dar_saida
CREATE OR REPLACE FUNCTION public.check_pode_dar_saida(p_deposito_id text, p_insumo_id text, p_quantidade numeric)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select saldo_deposito_insumo(p_deposito_id, p_insumo_id) >= p_quantidade;
$function$;

-- public.depositos_purgar_lixeira_expirada
CREATE OR REPLACE FUNCTION public.depositos_purgar_lixeira_expirada()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_total integer := 0;
  rec record;
begin
  for rec in
    select id, entidade, entidade_id
      from depositos_lixeira
     where restaurado_em is null and retencao_ate < now()
  loop
    if rec.entidade = 'deposito' then
      delete from depositos_material where id = rec.entidade_id;
    elsif rec.entidade = 'entrada' then
      delete from entradas_material where id = rec.entidade_id;
    elsif rec.entidade = 'saida' then
      delete from saidas_material where id = rec.entidade_id;
    elsif rec.entidade = 'transferencia' then
      delete from transferencias_material where id = rec.entidade_id;
    end if;
    delete from depositos_lixeira where id = rec.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$function$;

-- public.depositos_set_atualizado_em
CREATE OR REPLACE FUNCTION public.depositos_set_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  new.atualizado_em = now();
  return new;
end;
$function$;

-- public.fn_validate_capacidade_entrada
CREATE OR REPLACE FUNCTION public.fn_validate_capacidade_entrada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_capacidade numeric;
  v_nivel_atual numeric;
  v_eh_externo boolean;
  v_nome text;
  v_delta numeric;
  v_novo_nivel numeric;
BEGIN
  IF new.deposito_id IS NULL OR new.deleted_at IS NOT NULL THEN RETURN new; END IF;

  SELECT capacidade_litros, nivel_atual_litros, eh_externo, nome
    INTO v_capacidade, v_nivel_atual, v_eh_externo, v_nome
    FROM public.depositos
   WHERE id = new.deposito_id;

  IF COALESCE(v_eh_externo, false) OR COALESCE(v_capacidade, 0) <= 0 THEN RETURN new; END IF;

  v_delta := new.quantidade_litros;
  IF tg_op = 'UPDATE'
     AND old.deposito_id = new.deposito_id
     AND old.deleted_at IS NULL THEN
    v_delta := v_delta - old.quantidade_litros;
  END IF;

  v_novo_nivel := COALESCE(v_nivel_atual, 0) + v_delta;

  IF v_novo_nivel > v_capacidade THEN
    RAISE EXCEPTION
      'Capacidade excedida no tanque "%": % L atuais + % L = % L, capacidade % L.',
      COALESCE(v_nome, new.deposito_id), COALESCE(v_nivel_atual, 0), v_delta,
      v_novo_nivel, v_capacidade;
  END IF;
  RETURN new;
END;
$function$;

-- public.fn_validate_capacidade_transferencia
CREATE OR REPLACE FUNCTION public.fn_validate_capacidade_transferencia()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_capacidade numeric;
  v_nivel_atual numeric;
  v_eh_externo boolean;
  v_nome text;
  v_delta numeric;
  v_novo_nivel numeric;
BEGIN
  IF new.deposito_destino_id IS NULL OR new.deleted_at IS NOT NULL THEN RETURN new; END IF;

  SELECT capacidade_litros, nivel_atual_litros, eh_externo, nome
    INTO v_capacidade, v_nivel_atual, v_eh_externo, v_nome
    FROM public.depositos
   WHERE id = new.deposito_destino_id;

  IF COALESCE(v_eh_externo, false) OR COALESCE(v_capacidade, 0) <= 0 THEN RETURN new; END IF;

  v_delta := new.quantidade_litros;
  IF tg_op = 'UPDATE'
     AND old.deposito_destino_id = new.deposito_destino_id
     AND old.deleted_at IS NULL THEN
    v_delta := v_delta - old.quantidade_litros;
  END IF;

  v_novo_nivel := COALESCE(v_nivel_atual, 0) + v_delta;

  IF v_novo_nivel > v_capacidade THEN
    RAISE EXCEPTION
      'Capacidade excedida no tanque destino "%": % L atuais + % L = % L, capacidade % L.',
      COALESCE(v_nome, new.deposito_destino_id), COALESCE(v_nivel_atual, 0),
      v_delta, v_novo_nivel, v_capacidade;
  END IF;
  RETURN new;
END;
$function$;

-- public.resolve_entrada_fornecedor
CREATE OR REPLACE FUNCTION public.resolve_entrada_fornecedor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  resolved_name text;
BEGIN
  IF NEW.fornecedor IS NOT NULL AND NEW.fornecedor <> '' THEN
    SELECT nome INTO resolved_name
    FROM fornecedores
    WHERE id = NEW.fornecedor
    LIMIT 1;
    IF resolved_name IS NOT NULL THEN
      NEW.fornecedor := resolved_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- public.saldo_deposito_insumo
CREATE OR REPLACE FUNCTION public.saldo_deposito_insumo(p_deposito_id text, p_insumo_id text)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  with mov as (
    select coalesce(sum(quantidade), 0) as v
      from entradas_material
     where deposito_material_id = p_deposito_id
       and insumo_id = p_insumo_id
       and deletado_em is null
    union all
    select coalesce(sum(quantidade), 0)
      from transferencias_material
     where deposito_destino_id = p_deposito_id
       and insumo_id = p_insumo_id
       and deletado_em is null
    union all
    select -coalesce(sum(quantidade), 0)
      from saidas_material
     where deposito_material_id = p_deposito_id
       and insumo_id = p_insumo_id
       and deletado_em is null
    union all
    select -coalesce(sum(quantidade), 0)
      from transferencias_material
     where deposito_origem_id = p_deposito_id
       and insumo_id = p_insumo_id
       and deletado_em is null
  )
  select coalesce(sum(v), 0) from mov;
$function$;

-- public.tg_set_updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- Triggers vivos sem CREATE TRIGGER no repo
-- ============================================================================

drop trigger if exists trg_audit_depositos on public.depositos;
CREATE TRIGGER trg_audit_depositos AFTER INSERT OR DELETE OR UPDATE ON public.depositos FOR EACH ROW EXECUTE FUNCTION audit_combustivel_log();

drop trigger if exists trg_updated_at_depositos on public.depositos;
CREATE TRIGGER trg_updated_at_depositos BEFORE UPDATE ON public.depositos FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

drop trigger if exists trg_audit_entradas on public.entradas_combustivel;
CREATE TRIGGER trg_audit_entradas AFTER INSERT OR DELETE OR UPDATE ON public.entradas_combustivel FOR EACH ROW EXECUTE FUNCTION audit_combustivel_log();

drop trigger if exists trg_resolve_entrada_fornecedor on public.entradas_combustivel;
CREATE TRIGGER trg_resolve_entrada_fornecedor BEFORE INSERT OR UPDATE OF fornecedor ON public.entradas_combustivel FOR EACH ROW EXECUTE FUNCTION resolve_entrada_fornecedor();

drop trigger if exists trg_updated_at_entradas on public.entradas_combustivel;
CREATE TRIGGER trg_updated_at_entradas BEFORE UPDATE ON public.entradas_combustivel FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

drop trigger if exists trg_validate_capacidade_entrada on public.entradas_combustivel;
CREATE TRIGGER trg_validate_capacidade_entrada BEFORE INSERT OR UPDATE ON public.entradas_combustivel FOR EACH ROW EXECUTE FUNCTION fn_validate_capacidade_entrada();

drop trigger if exists trg_audit_saidas on public.saidas_combustivel;
CREATE TRIGGER trg_audit_saidas AFTER INSERT OR DELETE OR UPDATE ON public.saidas_combustivel FOR EACH ROW EXECUTE FUNCTION audit_combustivel_log();

drop trigger if exists trg_updated_at_saidas on public.saidas_combustivel;
CREATE TRIGGER trg_updated_at_saidas BEFORE UPDATE ON public.saidas_combustivel FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

drop trigger if exists trg_audit_transferencias on public.transferencias_combustivel;
CREATE TRIGGER trg_audit_transferencias AFTER INSERT OR DELETE OR UPDATE ON public.transferencias_combustivel FOR EACH ROW EXECUTE FUNCTION audit_combustivel_log();

drop trigger if exists trg_updated_at_transferencias on public.transferencias_combustivel;
CREATE TRIGGER trg_updated_at_transferencias BEFORE UPDATE ON public.transferencias_combustivel FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

drop trigger if exists trg_validate_capacidade_transferencia on public.transferencias_combustivel;
CREATE TRIGGER trg_validate_capacidade_transferencia BEFORE INSERT OR UPDATE ON public.transferencias_combustivel FOR EACH ROW EXECUTE FUNCTION fn_validate_capacidade_transferencia();
