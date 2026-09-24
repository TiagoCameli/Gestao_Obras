-- Rollback de 20260924170000_frete_transportadora_id_sync_on_rename.
-- Volta o trigger a resolver o id so no INSERT (id NULL).
-- NAO devolve o frete NF 58040 para a Areacre (aquilo era o erro).

create or replace function public.fn_autopopulate_transportadora_id()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  if new.transportadora_id is null and new.transportadora is not null and trim(new.transportadora) <> '' then
    select id into new.transportadora_id
      from public.fornecedores
     where (eh_transportadora = true or eh_dona_de_tanque = true)
       and lower(trim(unaccent(nome))) = lower(trim(unaccent(new.transportadora)))
     limit 1;

    -- Lookup falhou: nome digitado nao bate com transportadora nem dona de
    -- tanque cadastrada. NAO abortamos (trigger defensivo). RAISE WARNING.
    if new.transportadora_id is null then
      raise warning 'Transportadora % nao encontrada em fornecedores (transportadora ou dona de tanque). Linha inserida com transportadora_id NULL.', new.transportadora;
    end if;
  end if;
  return new;
end;
$function$;
