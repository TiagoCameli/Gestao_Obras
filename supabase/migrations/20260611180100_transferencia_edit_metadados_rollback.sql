-- Rollback de 20260611180000_transferencia_edit_metadados_fix.sql
-- Restaura as duas funcoes ao estado original (pre-fix).
-- ATENCAO: o original do stamp tem o cast quebrado (data_hora timestamp passado pra
-- uma funcao que espera text), que derruba qualquer insert/update de transferencia.
-- Restaurar isso reintroduz esse bug. So usar se precisar reverter o comportamento de
-- validacao; nesse caso, considere manter o cast ::text mesmo no rollback.

-- ORIGINAL: stamp sem cast e sem skip de metadados
CREATE OR REPLACE FUNCTION public.fn_stamp_transferencia_tipo_combustivel()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW.deposito_origem_id IS NULL OR NEW.data_hora IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.tipo_combustivel := public.calcular_combustivel_tanque_na_data(
    NEW.deposito_origem_id,
    NEW.data_hora
  );
  RETURN NEW;
END;
$body$;

-- ORIGINAL: mistura sem a guarda de edit de metadados
CREATE OR REPLACE FUNCTION public.fn_validate_transferencia_combustivel()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $body$
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
$body$;
