-- Permite editar metadados (valor/obs/fotos) de uma transferencia de combustivel
-- ja existente sem re-rodar as validacoes de criacao contra o estado ATUAL dos tanques.
-- Tambem conserta o cast quebrado no stamp (data_hora timestamp -> a funcao espera text),
-- que derrubava QUALQUER insert/update de transferencia.
--
-- Contexto: a edicao de transferencia (feature 2026-06-11) expos que toda validacao
-- de criacao rodava de novo no UPDATE contra o estado de HOJE dos tanques. Numa
-- transferencia historica (ex.: origem que trocou de S500 pra S10 depois), isso dava
-- "combustiveis incompativeis" falso, e o cast quebrado no stamp barrava antes ainda.
-- Aplicada em producao via MCP em 2026-06-11.

-- FIX 1: stamp do tipo_combustivel
--  (a) cast ::text no argumento (a funcao e calcular_combustivel_tanque_na_data(text,text))
--  (b) em edit de metadados (origem/data inalterados) NAO re-deriva o tipo (preserva o salvo)
CREATE OR REPLACE FUNCTION public.fn_stamp_transferencia_tipo_combustivel()
RETURNS trigger LANGUAGE plpgsql AS $body$
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
$body$;

-- FIX 2: validacao de mistura pula a re-checagem quando a transferencia ja existe
-- e nenhum campo fisico (origem/destino/litros/data) mudou. INSERT e edits fisicos
-- continuam 100% validados.
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
$body$;
