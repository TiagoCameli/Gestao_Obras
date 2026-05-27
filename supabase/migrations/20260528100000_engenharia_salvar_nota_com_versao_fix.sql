-- Engenharia — Onda 4.1: function SECDEF que salva nota + cria versão (atômico).
-- Spec: docs/superpowers/plans/2026-05-27-engenharia-onda-4-bloco-nota.md.
-- Rollback: 20260528100100_engenharia_salvar_nota_com_versao_rollback.sql.

begin;

create or replace function public.engenharia_salvar_nota_com_versao(
  p_nota_id uuid,
  p_titulo text,
  p_conteudo_json jsonb,
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
  v_conteudo_db jsonb;
begin
  -- Gate: precisa de permissão pra editar nota
  if not private.current_has_action('editar_engenharia_nota') then
    return query select false, null::int, 'sem_permissao';
    return;
  end if;

  -- Lock optimistic check + leitura do estado atual
  select versao, conteudo_json into v_versao_db, v_conteudo_db
    from public.engenharia_notas
   where id = p_nota_id and deleted_at is null
   for update;

  if not found then
    return query select false, null::int, 'nota_nao_encontrada';
    return;
  end if;

  if v_versao_db <> p_versao_atual then
    -- Conflito: alguém salvou entre o load do cliente e este save
    return query select false, v_versao_db, 'conflito_versao';
    return;
  end if;

  -- Snapshot da versão antiga em engenharia_notas_versoes
  insert into public.engenharia_notas_versoes (nota_id, versao, conteudo_json, autor_id)
  values (p_nota_id, v_versao_db, v_conteudo_db, v_user);

  -- Update nota com novo conteúdo e versão incrementada
  update public.engenharia_notas
     set titulo = p_titulo,
         conteudo_json = p_conteudo_json,
         versao = v_versao_db + 1,
         atualizado_em = now()
   where id = p_nota_id;

  -- Limpa versões antigas além das 50 mais recentes (cap conforme D-9 default)
  delete from public.engenharia_notas_versoes
   where nota_id = p_nota_id
     and id not in (
       select id from public.engenharia_notas_versoes
        where nota_id = p_nota_id
        order by versao desc
        limit 50
     );

  return query select true, v_versao_db + 1, ''::text;
end $$;

grant execute on function public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int) to authenticated;
revoke execute on function public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int) from anon, public;

comment on function public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int)
  is 'Engenharia: salva nota atomicamente (snapshot da versao antiga + update). Optimistic concurrency via p_versao_atual. Cap 50 versoes. SECDEF.';

commit;
