-- Fase 1c (fix) — Reescreve view transportadora_saldos pra contar
-- ajuste_manual_credito como crédito.
--
-- BUG: a view original (migration 070) usava `tipo LIKE 'credito_%'` que
-- NÃO casa 'ajuste_manual_credito' (prefix matching falha — categoria
-- está no fim do nome). Resultado: ajustes de crédito eram somados como
-- débito, causando saldo errado pra ETAM (-R$ 1,3M) e EMT TRANSPORTES
-- (-R$ 14k) na primeira tentativa de backfill da Fase 2.
--
-- FIX: substitui LIKE por IN (lista_explícita). Reforça standing rule #5
-- (LIKE com prefix tem 2 modos de falhar — wildcard `_` e categoria que
-- está no fim do nome em vez do início).

begin;

create or replace view public.transportadora_saldos as
select
  t.id as transportadora_id,
  t.nome,
  t.eh_dona_de_tanque,
  coalesce(sum(
    case when m.tipo in (
      'credito_frete',
      'credito_abastecimento_transterra',
      'ajuste_manual_credito'
    ) then m.valor else -m.valor end
  ), 0) as saldo,
  coalesce(sum(case when m.tipo in ('debito_abastecimento_transterra', 'debito_abastecimento_emt')
                    then m.valor else 0 end), 0) as debito_combustivel_total,
  coalesce(sum(case when m.tipo = 'credito_frete' then m.valor else 0 end), 0) as credito_frete_total,
  coalesce(sum(case when m.tipo = 'debito_pagamento_frete' then m.valor else 0 end), 0) as pago_frete_total,
  count(m.id) filter (where m.id is not null) as qtd_movimentos
from public.fornecedores t
left join public.transportadora_movimentos m on m.transportadora_id = t.id
where t.eh_transportadora = true
group by t.id, t.nome, t.eh_dona_de_tanque;

comment on view public.transportadora_saldos is
  'ATENÇÃO: até a Fase 2 (backfill) ser executada, esta view retorna saldos '
  'PARCIAIS que cobrem APENAS movimentos gerados após a Fase 1c. Não confiar '
  'pra cálculo financeiro até confirmação do backfill. Após Fase 2 ser '
  'aplicada e validada (totais batendo com FreteDashboard.tsx legado), '
  'esta nota deve ser removida e a view passa a ser fonte canônica de saldos. '
  'NOTA TÉCNICA: tipos de crédito listados explicitamente via IN '
  '(credito_frete, credito_abastecimento_transterra, ajuste_manual_credito) '
  'em vez de LIKE prefix — tipos ajuste_manual_* têm a categoria no fim '
  'do nome, não no início. Ver docs/tech-debt.md standing rule #5.';

-- Validação: smoke test inline com INSERT/DELETE pra confirmar fix
do $$
declare
  v_transp_id text := 'mlppmxan37tev'; -- Areacre
  v_saldo_antes numeric;
  v_saldo_depois numeric;
  v_test_id text;
begin
  select coalesce(saldo, 0) into v_saldo_antes
    from public.transportadora_saldos where transportadora_id = v_transp_id;

  -- Insere 1 movimento de ajuste_manual_credito de R$ 1000
  v_test_id := public.fn_gerar_id_text();
  insert into public.transportadora_movimentos (
    id, transportadora_id, data, tipo, valor, origem_tabela, origem_id, descricao, created_by
  ) values (
    v_test_id, v_transp_id, now(), 'ajuste_manual_credito', 1000,
    'ajuste_manual', 'fix_view_smoke_test', 'Smoke test fix view 075', 'fix_view_smoke_test'
  );

  select coalesce(saldo, 0) into v_saldo_depois
    from public.transportadora_saldos where transportadora_id = v_transp_id;

  -- Cleanup
  delete from public.transportadora_movimentos where id = v_test_id;

  -- Diff esperado: +R$ 1000 (não -R$ 1000 como antes do fix)
  if v_saldo_depois - v_saldo_antes <> 1000 then
    raise exception 'Fix view falhou: ajuste_manual_credito de R$ 1000 alterou saldo em R$ % (esperado +1000). View ainda buggy?',
      v_saldo_depois - v_saldo_antes;
  end if;

  raise notice 'Fix view OK: ajuste_manual_credito agora soma como crédito (delta = +R$ %).', v_saldo_depois - v_saldo_antes;
end $$;

commit;
