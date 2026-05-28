-- Engenharia — Onda 5.1: function SECDEF que salva cálculo + cria versão (atômico).
-- Spec: docs/superpowers/plans/2026-05-27-engenharia-onda-5-calculo-parser.md.
-- Rollback: 20260528200100_engenharia_salvar_calculo_com_versao_rollback.sql.

begin;

create or replace function public.engenharia_salvar_calculo_com_versao(
  p_calculo_id uuid,
  p_titulo text,
  p_documento_json jsonb,
  p_alerta_ativo boolean,
  p_versao_atual int
)
returns table (
  ok boolean,
  nova_versao int,
  motivo text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_versao_db int;
  v_doc_db jsonb;
begin
  if not private.current_has_action('editar_engenharia_calculo') then
    return query select false, null::int, 'sem_permissao';
    return;
  end if;

  select versao, documento_json into v_versao_db, v_doc_db
    from public.engenharia_calculos
   where id = p_calculo_id and deleted_at is null
   for update;

  if not found then
    return query select false, null::int, 'calculo_nao_encontrado';
    return;
  end if;

  if v_versao_db <> p_versao_atual then
    return query select false, v_versao_db, 'conflito_versao';
    return;
  end if;

  insert into public.engenharia_calculos_versoes (calculo_id, versao, documento_json, autor_id)
  values (p_calculo_id, v_versao_db, v_doc_db, v_user);

  update public.engenharia_calculos
     set titulo = p_titulo,
         documento_json = p_documento_json,
         alerta_ativo = p_alerta_ativo,
         versao = v_versao_db + 1,
         atualizado_em = now()
   where id = p_calculo_id;

  -- Cap 50 versões (D-9)
  delete from public.engenharia_calculos_versoes
   where calculo_id = p_calculo_id
     and id not in (
       select id from public.engenharia_calculos_versoes
        where calculo_id = p_calculo_id
        order by versao desc
        limit 50
     );

  return query select true, v_versao_db + 1, ''::text;
end $$;

grant execute on function public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int) to authenticated;
revoke execute on function public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int) from anon, public;

comment on function public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int)
  is 'Engenharia: salva calculo atomicamente (snapshot da versao antiga + update). Optimistic concurrency via p_versao_atual. Cap 50 versoes. SECDEF.';

commit;
