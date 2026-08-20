-- Rollback de 20260820164000_fn_fretes_movimentos_transferencia_fix.sql
-- Restaura a definição que estava viva no banco antes do fix
-- (md5 do pg_get_functiondef: 1d8b1079a44466f5503881cdaf265397).
--
-- Diferenças que este rollback desfaz:
--   1. descricao 'Transferência — A → B' para tipo = 'transferencia';
--   2. descricao deixa de ser reescrita no UPDATE (volta a ficar congelada
--      no texto do INSERT original);
--   3. NF em branco volta a sair como string vazia em vez de '(sem NF)'.

CREATE OR REPLACE FUNCTION public.fn_fretes_movimentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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

  -- SOFT DELETE: frete marcado como apagado -> remove o lançamento da conta-corrente
  if tg_op = 'UPDATE' and new.deleted_at is not null then
    delete from public.transportadora_movimentos
     where origem_tabela = 'fretes' and origem_id = new.id;
    return new;
  end if;

  v_data := ((new.data::date + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo');

  -- UPDATE de registro que já estava ativo (não é restauração)
  if tg_op = 'UPDATE' and old.deleted_at is null then
    if new.transportadora_id is distinct from old.transportadora_id then
      delete from public.transportadora_movimentos
       where origem_tabela = 'fretes' and origem_id = old.id;
    else
      update public.transportadora_movimentos
         set valor = new.valor_total,
             data = v_data,
             mes_referencia = date_trunc('month', v_data AT TIME ZONE 'America/Sao_Paulo')::date
       where origem_tabela = 'fretes' and origem_id = new.id;
      return new;
    end if;
  end if;
  -- restauração (old.deleted_at not null e new.deleted_at null) cai pro INSERT abaixo, recriando

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
