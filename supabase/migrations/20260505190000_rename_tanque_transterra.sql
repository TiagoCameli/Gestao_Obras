-- Rename do tanque externo da Areacre pra "Transterra Areacre".
-- Hoje: nome="Transterra (Areacre)" + apelido="Transterra" → UI concatena
-- nome+apelido em alguns places gerando "Transterra (Transterra (Areacre))".
-- Limpa pra nome único sem apelido.

begin;

update public.depositos
   set nome = 'Transterra Areacre',
       apelido = null
 where id = 'mori6yyt9owm9';

do $$
declare v_nome text; v_apelido text;
begin
  select nome, apelido into v_nome, v_apelido
    from public.depositos where id = 'mori6yyt9owm9';
  if v_nome <> 'Transterra Areacre' then
    raise exception 'Rename falhou: nome=% (esperado Transterra Areacre)', v_nome;
  end if;
  raise notice 'OK. Tanque mori6yyt9owm9 renomeado pra "Transterra Areacre" (apelido limpo).';
end $$;

commit;
