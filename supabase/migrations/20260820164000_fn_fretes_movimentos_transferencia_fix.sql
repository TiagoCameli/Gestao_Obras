create or replace function public.fn_fretes_movimentos()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_mov_id text;
  v_data timestamptz;
  v_descricao text;
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

  -- Descrição que aparece no extrato da transportadora.
  -- Transferência não tem nota fiscal (o formulário nem pergunta), então a
  -- linha antiga 'Frete  — A → B' saía com um buraco no lugar da NF.
  -- btrim com o conjunto explícito: btrim(x) sozinho corta só espaço, e um
  -- campo com \n continuaria "preenchido" e passaria pelo nullif.
  if new.tipo = 'transferencia' then
    v_descricao := 'Transferência — '
                || coalesce(nullif(btrim(new.origem,  E' \t\r\n'), ''), '?')
                || ' → '
                || coalesce(nullif(btrim(new.destino, E' \t\r\n'), ''), '?');
  else
    v_descricao := 'Frete '
                || coalesce(nullif(btrim(new.nota_fiscal, E' \t\r\n'), ''), '(sem NF)')
                || ' — '
                || coalesce(nullif(btrim(new.origem,  E' \t\r\n'), ''), '?')
                || ' → '
                || coalesce(nullif(btrim(new.destino, E' \t\r\n'), ''), '?');
  end if;

  -- UPDATE de registro que já estava ativo (não é restauração)
  if tg_op = 'UPDATE' and old.deleted_at is null then
    if new.transportadora_id is distinct from old.transportadora_id then
      delete from public.transportadora_movimentos
       where origem_tabela = 'fretes' and origem_id = old.id;
    else
      update public.transportadora_movimentos
         set valor = new.valor_total,
             data = v_data,
             -- descricao passou a ser reescrita aqui: antes, editar origem,
             -- destino ou NF deixava o extrato mostrando o texto antigo.
             descricao = v_descricao,
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
    v_descricao,
    new.obra_id, date_trunc('month', v_data AT TIME ZONE 'America/Sao_Paulo')::date
  );

  return new;
end;
$function$;
