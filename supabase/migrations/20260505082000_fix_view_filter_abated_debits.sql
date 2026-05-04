-- Fase 4 (fix arquitetural) — view transportadora_saldos não filtrava
-- débitos abatidos, causando double-counting no saldo.
--
-- BUG (descoberto durante implementação do PagamentoAbatimentoCard):
--   1. Pagamento de R$ 5.000 (bruto) com R$ 1.000 abatido em fuel debit:
--      - trigger cria debito_pagamento_frete = 5.000 → saldo cai 5.000
--      - fuel debit (R$ 1.000) marcado com abatido_em_pagamento_id =
--        ID do novo pagamento
--   2. View NÃO filtra abatido_em_pagamento_id → fuel debit continua
--      subtraindo 1.000 do saldo
--   3. Resultado: saldo cai 6.000 quando o cash real foi 4.000.
--
-- FIX: na soma de saldo, débitos com abatido_em_pagamento_id NOT NULL
-- contam como 0 (foram "pagos" pelo pagamento abatedor; só o
-- debito_pagamento_frete bruto deve contar).
--
-- debito_combustivel_total continua somando todos (incluindo abatidos)
-- como métrica histórica de consumo — não é saldo.
--
-- Standing rule #11 honrada: zero schema change, só ajuste de view.

begin;

create or replace view public.transportadora_saldos as
select
  t.id as transportadora_id,
  t.nome,
  t.eh_dona_de_tanque,
  coalesce(sum(
    case
      -- Créditos sempre somam
      when m.tipo in (
        'credito_frete',
        'credito_abastecimento_transterra',
        'ajuste_manual_credito'
      ) then m.valor
      -- Débitos JÁ abatidos por pagamento contam como zero pra evitar
      -- double-counting (o pagamento abatedor já é contabilizado como
      -- debito_pagamento_frete bruto na soma).
      when m.abatido_em_pagamento_id is not null then 0
      -- Demais débitos subtraem normalmente
      else -m.valor
    end
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
  'Saldo agregado por transportadora. Convenções:'
  ' (1) Tipos de crédito explícitos via IN (credito_frete, '
  'credito_abastecimento_transterra, ajuste_manual_credito) — não LIKE prefix '
  '(standing rule #5).'
  ' (2) Débitos de combustível abatidos em pagamento (abatido_em_pagamento_id '
  'IS NOT NULL) contam como 0 no saldo — evita double-counting com o '
  'debito_pagamento_frete bruto que já contabiliza o abatimento. '
  'debito_combustivel_total NÃO aplica esse filtro (métrica histórica de '
  'consumo, não saldo).';

-- Smoke test inline com a Triunfo: simula abatimento, lê saldo, reverte.
do $$
declare
  v_transp_id text := 'mlqm8sux861qf';
  v_pag_id text;
  v_mov_id text;
  v_mov_valor numeric;
  v_saldo_antes numeric;
  v_saldo_depois numeric;
  v_diff numeric;
begin
  -- Saldo inicial
  select coalesce(saldo, 0) into v_saldo_antes
    from public.transportadora_saldos where transportadora_id = v_transp_id;

  -- Pega 1 débito de combustível pendente + um pagamento_frete real pra usar como FK sentinel
  select id, valor into v_mov_id, v_mov_valor
    from public.transportadora_movimentos
   where transportadora_id = v_transp_id
     and tipo = 'debito_abastecimento_transterra'
     and abatido_em_pagamento_id is null
   order by data asc
   limit 1;

  if v_mov_id is null then
    raise notice 'Nenhum débito de combustível pendente da Triunfo pra testar — pulando smoke';
    return;
  end if;

  select id into v_pag_id from public.pagamentos_frete limit 1;
  if v_pag_id is null then
    raise notice 'Nenhum pagamento_frete pra usar como FK sentinel — pulando smoke';
    return;
  end if;

  -- Marca como abatido
  update public.transportadora_movimentos
     set abatido_em_pagamento_id = v_pag_id
   where id = v_mov_id;

  -- Lê saldo após
  select coalesce(saldo, 0) into v_saldo_depois
    from public.transportadora_saldos where transportadora_id = v_transp_id;

  -- Reverte (cleanup ANTES de validar pra não deixar lixo se assertion falhar)
  update public.transportadora_movimentos
     set abatido_em_pagamento_id = null
   where id = v_mov_id;

  -- Saldo deveria ter SUBIDO em v_mov_valor (débito deixou de subtrair)
  v_diff := v_saldo_depois - v_saldo_antes;
  if abs(v_diff - v_mov_valor) > 0.01 then
    raise exception 'Fix view falhou: marcar débito de R$ % como abatido alterou saldo em R$ % (esperado +R$ %). View ainda buggy?',
      v_mov_valor, v_diff, v_mov_valor;
  end if;

  raise notice 'Fix view OK: débito de R$ % abatido fez saldo subir +R$ % (esperado +R$ %).',
    v_mov_valor, v_diff, v_mov_valor;
end $$;

commit;
