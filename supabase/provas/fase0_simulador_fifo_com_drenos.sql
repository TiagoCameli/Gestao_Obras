-- Simula o FIFO dos 16 testes (fifoCombustivel.test.ts) em cima dos dados reais e compara com o
-- que private.recompute_fifo_tanque gravou. NÃO ESCREVE: o bloco termina em raise exception e
-- um segundo bloco aborta sempre, mesmo se o primeiro sair por outro caminho.
--
-- modo 0 = linha de controle, sem drenos. Tem que dar "mudam = 0" em todo tanque: prova que o
--          simulador é o algoritmo do banco.
-- modo 1 = com drenos: transferência de saída (lotes do mesmo tipo) e esvaziamento (qualquer
--          tipo, só lote com data_origem <= data do esvaziamento).
--
-- 22/09/2026: modo 0 → 1.804 saídas, 0 mudam. modo 1 → só Meloza EMT: 78 mudam, +440,6867.

do $sim$
declare
  v_tanque text; v_modo int; ev record; lote record;
  v_rest numeric; v_cons numeric; v_val numeric; v_lit numeric;
  resultado jsonb := '[]'::jsonb;
begin
  create temp table _res (modo int, tanque text, saida_id text, litros numeric, valor_sim numeric) on commit drop;
  for v_modo in 0..1 loop
    for v_tanque in select id from public.depositos where not coalesce(eh_externo, false) and id in (
        select deposito_origem_id from public.transferencias_combustivel where deleted_at is null
        union select deposito_id from public.esvaziamentos_tanque) loop
      create temp table if not exists _lotes (seq bigserial, tipo text, data_origem timestamp, saldo numeric, preco numeric) on commit drop;
      truncate _lotes;
      insert into _lotes (tipo, data_origem, saldo, preco)
        select * from (
          select e.tipo_combustivel, e.data_hora, e.quantidade_litros,
                 case when e.quantidade_litros > 0 then e.valor_total / e.quantidade_litros else 0 end
            from public.entradas_combustivel e where e.deposito_id = v_tanque and e.deleted_at is null
          union all
          select t.tipo_combustivel, t.data_hora, t.quantidade_litros,
                 case when t.quantidade_litros > 0 then t.valor_total / t.quantidade_litros else 0 end
            from public.transferencias_combustivel t where t.deposito_destino_id = v_tanque and t.deleted_at is null) x
        order by 2;
      for ev in
        select * from (
          select 'saida' k, s.id, s.data quando, s.litros, s.tipo_combustivel tipo, s.tipo_consumidor, s.created_at ca
            from public.saidas_combustivel s where s.tanque_id = v_tanque and s.origem = 'tanque' and s.deleted_at is null
          union all
          select 'transf', t.id, t.data_hora, t.quantidade_litros, t.tipo_combustivel, null, t.created_at
            from public.transferencias_combustivel t where v_modo = 1 and t.deposito_origem_id = v_tanque and t.deleted_at is null
          union all
          select 'esvaz', x.id, x.data_hora, x.litros_descartados, null, null, null
            from public.esvaziamentos_tanque x where v_modo = 1 and x.deposito_id = v_tanque) e
        order by quando, ca nulls first, id
      loop
        v_rest := ev.litros; v_val := 0; v_lit := 0;
        for lote in select seq, saldo, preco from _lotes
            where saldo > 0 and data_origem <= ev.quando
              and (ev.k = 'esvaz' or ev.tipo is null or tipo = ev.tipo)
            order by data_origem, seq loop
          exit when v_rest <= 0;
          v_cons := least(v_rest, lote.saldo);
          update _lotes set saldo = saldo - v_cons where seq = lote.seq;
          v_val := v_val + v_cons * lote.preco; v_lit := v_lit + v_cons; v_rest := v_rest - v_cons;
        end loop;
        if ev.k = 'saida' and ev.tipo_consumidor = 'equipamento_proprio' and v_lit > 0 then
          insert into _res values (v_modo, v_tanque, ev.id, ev.litros, (v_val / v_lit) * ev.litros);
        end if;
      end loop;
    end loop;
  end loop;
  select jsonb_agg(r) into resultado from (
    select r.modo, d.nome, count(*) saidas_equip,
      count(*) filter (where abs(r.valor_sim - s.valor_total) > 0.00005) mudam,
      round(sum(r.valor_sim - s.valor_total), 4) delta_total,
      round(max(abs(r.valor_sim - s.valor_total)), 4) maior_delta
    from _res r join public.saidas_combustivel s on s.id = r.saida_id join public.depositos d on d.id = r.tanque
    group by 1, 2 order by 1, 2) r;
  raise exception 'SIM %', resultado;
end $sim$;
do $aborto$ begin raise exception 'ABORTO GARANTIDO'; end $aborto$;
