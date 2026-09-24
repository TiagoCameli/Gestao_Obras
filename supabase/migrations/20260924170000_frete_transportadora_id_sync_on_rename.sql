-- Frete/pagamento: transportadora_id acompanha a troca de nome na edicao.
--
-- Bug (NF 58040, frete mt98ec3tcdetq): o frete foi criado como Areacre e em
-- 26/08 editado para EMT TRANSPORTES. O front grava so o nome
-- (fretes.transportadora); quem resolve o id e o trigger
-- fn_autopopulate_transportadora_id, que so agia quando transportadora_id era
-- NULL (INSERT). Na edicao o id antigo ficava, a lista mostrava EMT TRANSPORTES
-- e a conta corrente (que usa transportadora_id) seguia creditando a Areacre.
--
-- Fix: no UPDATE, se o nome mudou e o id nao foi trocado explicitamente,
-- re-resolve o id pelo nome. Se o nome novo nao bate com nenhuma
-- transportadora cadastrada, mantem o id antigo e avisa (mesmo espirito
-- defensivo do INSERT). Nome inalterado nao re-resolve: preserva os fretes
-- antigos "Transportadora Triunfo" -> LMC Transportadora (renome do cadastro).
--
-- Vale para fretes e pagamentos_frete (mesma funcao nos dois triggers).
-- Trocar o id dispara fn_fretes_movimentos / fn_pagamentos_frete_movimentos,
-- que ja movem o lancamento da conta corrente para a transportadora nova.

create or replace function public.fn_autopopulate_transportadora_id()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_id text;
begin
  if new.transportadora is null or trim(new.transportadora) = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.transportadora_id is not null then
      return new;
    end if;
  else
    -- UPDATE: so re-resolve quando o nome mudou de fato e o id nao foi
    -- alterado junto pelo chamador.
    if new.transportadora is not distinct from old.transportadora
       or new.transportadora_id is distinct from old.transportadora_id then
      return new;
    end if;
  end if;

  select id into v_id
    from public.fornecedores
   where (eh_transportadora = true or eh_dona_de_tanque = true)
     and lower(trim(unaccent(nome))) = lower(trim(unaccent(new.transportadora)))
   limit 1;

  if v_id is not null then
    new.transportadora_id := v_id;
  elsif tg_op = 'INSERT' then
    raise warning 'Transportadora % nao encontrada em fornecedores (transportadora ou dona de tanque). Linha inserida com transportadora_id NULL.', new.transportadora;
  else
    raise warning 'Transportadora % nao encontrada em fornecedores; transportadora_id mantido (%).', new.transportadora, old.transportadora_id;
  end if;

  return new;
end;
$function$;

-- Dado: frete NF 58040 e da EMT TRANSPORTES (confirmado pelo Tiago em 24/09).
-- Credito nao estava abatido em pagamento. O trigger de movimentos apaga o
-- credito da Areacre e recria na EMT TRANSPORTES.
update public.fretes f
   set transportadora_id = fo.id
  from public.fornecedores fo
 where f.id = 'mt98ec3tcdetq'
   and f.nota_fiscal = '58040'
   and fo.nome = 'EMT TRANSPORTES'
   and fo.eh_transportadora = true;
