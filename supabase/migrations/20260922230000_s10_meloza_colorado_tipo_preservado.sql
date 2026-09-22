-- S10 do Meloza Colorado: as duas saídas de 01/05 15:00 voltam a S500, e o tipo deixa de
-- ser recarimbado em UPDATE que não mexe em tanque, data ou origem.
-- Aplicada pelo MCP em 22/09/2026, com o ok do Tiago ("conserte esse problema do s10").
--
-- O PROBLEMA (docs/decisoes.md, Fase 0, item 3): às 13:26 de 01/05 o tanque tinha 734 L,
-- todos de S500. Entraram 5.000 L de S10 às 13:27, saíram mfuelbkf31 (643 L) e mfuelbkf32
-- (91 L) às 15:00, e em 11/05 os 5.000 L de S10 saíram por transferência. As duas saídas eram
-- o residual de S500, mas o gatilho carimbava S10 pelo "combustível atual do tanque".
--
-- POR QUE O GATILHO MUDA: fn_validate_saida_combustivel recarimbava o tipo em TODO UPDATE, e
-- private.recompute_fifo_tanque faz UPDATE em toda saída de equipamento do tanque a cada
-- mudança. Corrigir o tipo à mão voltava a S10 na primeira mexida no tanque (provado em
-- transação desfeita). Agora o tipo só é derivado no INSERT e quando muda tanque, data ou
-- origem, o mesmo desenho do fix das transferências de 11/06/2026.
--
-- EFEITO MEDIDO (ensaio desfeito, depois conferido em produção):
--   as duas: R$ 4.936,9574 → R$ 4.575,1688 (−361,7886)
--   71 saídas posteriores de equipamento: +206,3273 (a cascata do FIFO)
--   total do tanque: −155,4613. Nível 905 L, sem saída sem suprimento.
--   conta corrente das transportadoras: igual em contagem e soma (carreta não é FIFO).
--   um segundo recálculo do tanque mantém as duas em S500.

create or replace function public.fn_validate_saida_combustivel()
 returns trigger
 language plpgsql
as $function$
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

  -- O tipo so e derivado do tanque quando a saida nasce ou quando muda de tanque,
  -- de data ou de origem. Num UPDATE que nao mexe nisso (o recalculo do FIFO so
  -- regrava preco), o tipo gravado fica: e o que deixa corrigir o tipo de uma saida
  -- sem o gatilho desfazer (S10 do Meloza Colorado, 22/09/2026).
  IF TG_OP = 'INSERT'
     OR OLD.tanque_id IS DISTINCT FROM NEW.tanque_id
     OR OLD.data IS DISTINCT FROM NEW.data
     OR OLD.origem IS DISTINCT FROM NEW.origem
  THEN
    -- COALESCE: nunca troca um tipo valido por NULL.
    NEW.tipo_combustivel := COALESCE(
      public.calcular_combustivel_tanque_na_data(NEW.tanque_id, v_data_text),
      NEW.tipo_combustivel
    );
  END IF;

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

-- As duas saidas de 01/05 15:00 eram o residual de S500 (734 L no tanque as 13:26),
-- carimbadas S10 pela entrada das 13:27. O UPDATE dispara o recalculo do FIFO do tanque.
update public.saidas_combustivel
   set tipo_combustivel = 'mlvjtpi8o1vmk'
 where id in ('mfuelbkf31', 'mfuelbkf32')
   and tipo_combustivel = 'mlplpomwf0uod';

do $confere$
declare v int;
begin
  select count(*) into v from public.saidas_combustivel
   where id in ('mfuelbkf31', 'mfuelbkf32') and tipo_combustivel = 'mlvjtpi8o1vmk';
  if v <> 2 then raise exception 'S10 do Meloza: % de 2 saidas ficaram S500', v; end if;
  select count(*) into v from public.consumos_lote where fonte_id = 'moyqkpn2o5zp8';
  if v <> 0 then raise exception 'Lote S10 de 01/05 ainda consumido por % saidas', v; end if;
end $confere$;
