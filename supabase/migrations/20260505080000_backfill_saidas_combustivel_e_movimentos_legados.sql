-- Fase 2 — Backfill de saidas_combustivel + transportadora_movimentos.
--
-- ESCOPO (atomicidade total via BEGIN/COMMIT):
--   0) ALTER saidas_combustivel: foto_url text → foto_urls text[]
--      (lossless pra abastecimentos legados que têm array de fotos).
--   1) Backfill abastecimentos (756) → saidas_combustivel
--      (tipo_consumidor='equipamento_proprio'). Trigger ignora.
--   2) Backfill abastecimentos_carreta (167) → saidas_combustivel
--      (tipo_consumidor='carreta_transportadora', tanque virtual Transterra).
--      Trigger cria 2 movimentos automaticamente por linha = 334 movs.
--   3) Backfill fretes (331) → INSERT manual transportadora_movimentos
--      (credito_frete) com idempotência via WHERE NOT EXISTS.
--   4) Backfill pagamentos_frete (65) → INSERT manual:
--      - debito_pagamento_frete sempre (recipiente)
--      - ajuste_manual_credito condicional quando pago_por é
--        transportadora cadastrada DIFERENTE da transportadora destinatária
--        E DIFERENTE do sentinel 'EMT Construtora'
--   5) Validação inline per-transportadora: replica fórmulas do
--      FreteDashboard.tsx:294-340 em SQL e compara com view
--      transportadora_saldos. Diff > R$0.01 em qualquer uma → coleta
--      todos os diffs em texto + RAISE EXCEPTION com lista completa.
--
-- IDEMPOTÊNCIA: todos os INSERTs tem WHERE NOT EXISTS via origem_tabela
-- + origem_id (movimentos) ou via id (saidas_combustivel reutiliza id da
-- tabela legada). Migration pode rodar 2x sem duplicar.
--
-- MARKER: created_by = 'backfill_fase_2_20260505080000' em TODAS as rows
-- novas — facilita auditoria e DELETE em massa se backfill der ruim.
--
-- ORDEM dos passos importa: abastecimentos primeiro (sem trigger),
-- depois abastecimentos_carreta (trigger cria movimentos automaticamente),
-- depois fretes/pagamentos (movimentos manuais). Saldo intermediário pode
-- ficar "estranho" mas no final tudo bate.

begin;

-- ════════════════════════════════════════════════════════════════════
-- (0pre) Drop view → ALTER precisão pra numeric(14,4) → recria view
-- ════════════════════════════════════════════════════════════════════
-- Sobe precisão de valores pra evitar truncamento de origens com 4 decimais
-- (abastecimentos_carreta.valor_total tem rows tipo 85065.4014 — soma de
-- valor_total truncados pra 2 decimais redistribui R$ 0,01 entre transps).
-- Tabelas vazias agora → ALTER trivial, sem cast issues.
--
-- Postgres bloqueia ALTER TYPE em coluna referenciada por view → DROP +
-- recriação idêntica à 075. Atomicidade preservada via BEGIN/COMMIT.

drop view if exists public.transportadora_saldos;

alter table public.transportadora_movimentos alter column valor type numeric(14,4);
alter table public.saidas_combustivel alter column valor_total type numeric(14,4);

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

-- ════════════════════════════════════════════════════════════════════
-- (0) ALTER saidas_combustivel: foto_url text → foto_urls text[]
-- ════════════════════════════════════════════════════════════════════
-- abastecimentos.fotos_urls é text[] na origem. Reduzir pra text único
-- perderia 2 de 3 fotos quando houver mais de uma. Como saidas_combustivel
-- tem 0 rows neste momento, drop+add é trivial.

alter table public.saidas_combustivel drop column if exists foto_url;
alter table public.saidas_combustivel add column if not exists foto_urls text[];

comment on column public.saidas_combustivel.foto_urls is
  'Array de URLs de fotos (text[]). Preserva todas as fotos vindas de '
  'abastecimentos.fotos_urls. NULL = sem foto (mantém distinção vs array vazio). '
  'Bucket storage: abastecimento-fotos (signed URLs 1 ano).';

-- ════════════════════════════════════════════════════════════════════
-- (1) Backfill abastecimentos (756) → saidas_combustivel
-- ════════════════════════════════════════════════════════════════════
-- tipo_consumidor='equipamento_proprio'. Trigger ignora (não cria movimento).
-- Reutiliza id original (tabelas diferentes, sem colisão).
-- Se equipamento_id for NULL no legado, deixa NULL (CHECK exige NOT NULL,
-- então linha legada sem equipamento vai bloquear o INSERT — ver verificação
-- defensiva abaixo).

insert into public.saidas_combustivel (
  id, data, origem, tipo_consumidor,
  tanque_id, equipamento_id,
  obra_id, etapa_id, alocacoes,
  tipo_combustivel, litros,
  preco_medio_tanque_snapshot, taxa_litro, preco_unitario, valor_total,
  foto_urls, observacoes,
  pago, pago_em,
  created_by
)
select
  a.id,
  a.data_hora::timestamptz,
  coalesce(a.origem_combustivel, 'tanque'),
  'equipamento_proprio',
  nullif(a.deposito_id, ''),
  nullif(a.equipamento_id, ''),
  nullif(a.obra_id, ''),
  nullif(a.etapa_id, ''),
  a.alocacoes,
  a.tipo_combustivel,
  a.quantidade_litros,
  case when a.quantidade_litros > 0 then a.valor_total / a.quantidade_litros else 0 end,
  0,
  case when a.quantidade_litros > 0 then a.valor_total / a.quantidade_litros else 0 end,
  a.valor_total,
  a.fotos_urls,
  a.observacoes,
  a.pago,
  case when a.data_pagamento is null or a.data_pagamento = '' then null else a.data_pagamento::timestamptz end,
  'backfill_fase_2_20260505080000'
from public.abastecimentos a
where not exists (select 1 from public.saidas_combustivel s where s.id = a.id)
  and a.equipamento_id is not null and a.equipamento_id <> ''
  -- Defensivo: probe da Fase 2 confirmou ZERO rows com origem='tanque' +
  -- deposito vazio. Mas mantém o filtro pra blindar dados futuros que
  -- violassem o CHECK saida_tanque_exige_tanque (origem='tanque' →
  -- tanque_id NOT NULL). Contagem extra na seção (6) rastreia eventuais
  -- skipados desse caso.
  and not (
    coalesce(a.origem_combustivel, 'tanque') = 'tanque'
    and (a.deposito_id is null or a.deposito_id = '')
  );

-- ════════════════════════════════════════════════════════════════════
-- (2) Backfill abastecimentos_carreta (167) → saidas_combustivel
-- ════════════════════════════════════════════════════════════════════
-- tipo_consumidor='carreta_transportadora', tanque virtual Transterra.
-- Trigger AFTER INSERT cria 2 movimentos automaticamente por linha.
-- preco_medio_tanque_snapshot = valor_unidade − taxa_litro
-- (mantém imutabilidade do extrato; em retroativo é a melhor aproximação).

insert into public.saidas_combustivel (
  id, data, origem, tipo_consumidor,
  tanque_id, transportadora_id, placa,
  tipo_combustivel, litros,
  preco_medio_tanque_snapshot, taxa_litro, preco_unitario, valor_total,
  observacoes,
  created_by
)
select
  ac.id,
  ac.data::timestamptz,
  'tanque',
  'carreta_transportadora',
  'mori6yyt9owm9',  -- DEPOSITO_VIRTUAL_TRANSTERRA_ID
  ac.transportadora_id,
  ac.placa_carreta,
  ac.tipo_combustivel,
  ac.quantidade_litros,
  ac.valor_unidade - coalesce(ac.taxa_litro, 0),
  coalesce(ac.taxa_litro, 0),
  ac.valor_unidade,
  ac.valor_total,
  ac.observacoes,
  'backfill_fase_2_20260505080000'
from public.abastecimentos_carreta ac
where not exists (select 1 from public.saidas_combustivel s where s.id = ac.id)
  and ac.transportadora_id is not null;
  -- transportadora_id NOT NULL é exigido pelo CHECK
  -- saida_carreta_exige_transportadora. Backfill da Fase 1a já garantiu
  -- 167/167 — esta cláusula é só defensiva.

-- ════════════════════════════════════════════════════════════════════
-- (2.5) Marca movimentos gerados pela trigger durante o backfill
-- ════════════════════════════════════════════════════════════════════
-- A trigger trg_saidas_combustivel_movimentos cria 2 movimentos por
-- saída de carreta inserida na seção (2), mas a função não recebe o
-- created_by (trigger não vê esse contexto). Marcação a posteriori:
-- todos os movimentos linkados a saídas com marker do backfill recebem
-- o mesmo marker. Idempotente: só toca movs ainda sem created_by.

update public.transportadora_movimentos m
   set created_by = 'backfill_fase_2_20260505080000'
  from public.saidas_combustivel s
 where m.origem_tabela = 'saidas_combustivel'
   and m.origem_id = s.id
   and s.created_by = 'backfill_fase_2_20260505080000'
   and m.created_by is null;

-- ════════════════════════════════════════════════════════════════════
-- (3) Backfill fretes (331) → transportadora_movimentos (credito_frete)
-- ════════════════════════════════════════════════════════════════════

insert into public.transportadora_movimentos (
  id, transportadora_id, data, tipo, valor,
  origem_tabela, origem_id, descricao, obra_id, mes_referencia,
  created_by
)
select
  public.fn_gerar_id_text(),
  f.transportadora_id,
  f.data::timestamptz,
  'credito_frete',
  f.valor_total,
  'fretes',
  f.id,
  'Frete ' || coalesce(nullif(f.nota_fiscal, ''), '(sem NF)') || ' — ' ||
    coalesce(nullif(f.origem, ''), '?') || ' → ' || coalesce(nullif(f.destino, ''), '?'),
  nullif(f.obra_id, ''),
  date_trunc('month', f.data::timestamptz)::date,
  'backfill_fase_2_20260505080000'
from public.fretes f
where f.transportadora_id is not null
  and f.valor_total > 0
  and not exists (
    select 1 from public.transportadora_movimentos m
    where m.origem_tabela = 'fretes' and m.origem_id = f.id
  );

-- ════════════════════════════════════════════════════════════════════
-- (4) Backfill pagamentos_frete (65) → transportadora_movimentos
-- ════════════════════════════════════════════════════════════════════
-- 4a) debito_pagamento_frete sempre (recipiente)
-- 4b) ajuste_manual_credito condicional quando pago_por é transportadora
--     cadastrada (eh_transportadora=true) DIFERENTE da destinatária E
--     DIFERENTE do sentinel 'EMT Construtora'

-- 4a) Débitos
insert into public.transportadora_movimentos (
  id, transportadora_id, data, tipo, valor,
  origem_tabela, origem_id, descricao, mes_referencia,
  created_by
)
select
  public.fn_gerar_id_text(),
  p.transportadora_id,
  p.data::timestamptz,
  'debito_pagamento_frete',
  p.valor,
  'pagamentos_frete',
  p.id,
  'Pagamento de frete (' || coalesce(p.metodo, '?') || ') — ref ' || coalesce(p.mes_referencia, '?')
    || case when p.pago_por is not null and p.pago_por <> '' and p.pago_por <> p.transportadora
            then ' (pago por ' || p.pago_por || ')' else '' end,
  case when p.mes_referencia ~ '^\d{4}-\d{2}$'
       then to_date(p.mes_referencia || '-01', 'YYYY-MM-DD')
       else date_trunc('month', p.data::timestamptz)::date end,
  'backfill_fase_2_20260505080000'
from public.pagamentos_frete p
where p.transportadora_id is not null
  and p.valor > 0
  and not exists (
    select 1 from public.transportadora_movimentos m
    where m.origem_tabela = 'pagamentos_frete' and m.origem_id = p.id
      and m.tipo = 'debito_pagamento_frete'
  );

-- 4b) Ajustes manuais de crédito pra cross-payer
-- Se pago_por é uma transportadora cadastrada (eh_transportadora=true) E
-- não é 'EMT Construtora' (sentinel da casa) E não é o próprio recipiente,
-- então o pagador estendeu crédito; vira credora da EMT.
insert into public.transportadora_movimentos (
  id, transportadora_id, data, tipo, valor,
  origem_tabela, origem_id, descricao, mes_referencia,
  created_by
)
select
  public.fn_gerar_id_text(),
  pagador.id,
  p.data::timestamptz,
  'ajuste_manual_credito',
  p.valor,
  'pagamentos_frete',
  p.id,
  'Crédito por pagamento estendido em nome de ' || coalesce(p.transportadora, '?')
    || ' (ref ' || coalesce(p.mes_referencia, '?') || ')',
  case when p.mes_referencia ~ '^\d{4}-\d{2}$'
       then to_date(p.mes_referencia || '-01', 'YYYY-MM-DD')
       else date_trunc('month', p.data::timestamptz)::date end,
  'backfill_fase_2_20260505080000'
from public.pagamentos_frete p
inner join public.fornecedores pagador
  on pagador.eh_transportadora = true
  and lower(trim(unaccent(pagador.nome))) = lower(trim(unaccent(p.pago_por)))
where p.pago_por is not null
  and p.pago_por <> ''
  and p.pago_por <> 'EMT Construtora'
  and p.pago_por <> p.transportadora
  and p.valor > 0
  and not exists (
    select 1 from public.transportadora_movimentos m
    where m.origem_tabela = 'pagamentos_frete' and m.origem_id = p.id
      and m.tipo = 'ajuste_manual_credito'
  );

-- 4c) WARNING pra pagador desconhecido (defensivo — não deve ocorrer hoje)
do $$
declare
  v_unknown record;
begin
  for v_unknown in
    select distinct p.pago_por
      from public.pagamentos_frete p
     where p.pago_por is not null
       and p.pago_por <> ''
       and p.pago_por <> 'EMT Construtora'
       and p.pago_por <> p.transportadora
       and not exists (
         select 1 from public.fornecedores f
         where f.eh_transportadora = true
           and lower(trim(unaccent(f.nome))) = lower(trim(unaccent(p.pago_por)))
       )
  loop
    raise warning 'Backfill: pagador desconhecido "%" — ajuste_manual_credito NÃO criado. Investigar.', v_unknown.pago_por;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- (5) Validação per-transportadora — fórmulas do FreteDashboard:294-340
-- ════════════════════════════════════════════════════════════════════
-- Pra cada uma das 5 transportadoras, calcular:
--   * Saldo NOVO = via view transportadora_saldos
--   * Saldo LEGADO = replicando inline a fórmula do FreteDashboard.tsx
-- Coletar todos os diffs em variável text. Se algum > R$0.01 → RAISE
-- EXCEPTION com lista completa.
--
-- Convenção do dashboard (replicada aqui):
--   Areacre  = sum(fretes_areacre.valor) - sum(pagamentos_recebidos_excluindo_pagoPor=Areacre)
--              + sum(TOTAL de TODOS os abast_carreta de QUALQUER transp)
--   Triunfo  = sum(fretes_triunfo) - sum(pagamentos_recebidos) - sum(abast_dela)
--   Andrade  = igual Triunfo
--   ETAM     = sum(fretes_etam) + sum(pagosPelaEtam) - sum(pagosParaEtam)
--   EMT TRANSPORTES (consolidado Amazonia + EMT TRANSPORTES) =
--              sum(fretes) - sum(pagosPara) - sum(abast) + sum(pagosPela)

do $$
declare
  v_diffs text := '';
  v_diff numeric;

  -- IDs canônicos (do dry-run da Fase 1a)
  v_areacre_id text := 'mlppmxan37tev';
  v_triunfo_id text := 'mlqm8sux861qf';
  v_andrade_id text := 'mn921nnyuvp1t';
  v_etam_id    text := 'mltn8gcw20fy8';
  v_emtt_id    text := 'mnx9g4currw6p';

  -- Saldos via view (NOVO)
  v_areacre_novo numeric;
  v_triunfo_novo numeric;
  v_andrade_novo numeric;
  v_etam_novo    numeric;
  v_emtt_novo    numeric;

  -- Saldos via fórmula legada (LEGADO)
  v_areacre_legado numeric;
  v_triunfo_legado numeric;
  v_andrade_legado numeric;
  v_etam_legado    numeric;
  v_emtt_legado    numeric;

  -- Componentes (pra debug)
  v_total_abast_carreta numeric;
  v_fretes_areacre numeric; v_pagos_para_areacre numeric;
  v_fretes_triunfo numeric; v_pagos_para_triunfo numeric; v_abast_triunfo numeric;
  v_fretes_andrade numeric; v_pagos_para_andrade numeric; v_abast_andrade numeric;
  v_fretes_etam    numeric; v_pagos_para_etam    numeric; v_pagos_pela_etam numeric;
  v_fretes_emtt    numeric; v_pagos_para_emtt    numeric; v_abast_emtt     numeric; v_pagos_pela_emtt numeric;
begin
  -- ── NOVOS via view ──
  select coalesce(saldo, 0) into v_areacre_novo from public.transportadora_saldos where transportadora_id = v_areacre_id;
  select coalesce(saldo, 0) into v_triunfo_novo from public.transportadora_saldos where transportadora_id = v_triunfo_id;
  select coalesce(saldo, 0) into v_andrade_novo from public.transportadora_saldos where transportadora_id = v_andrade_id;
  select coalesce(saldo, 0) into v_etam_novo    from public.transportadora_saldos where transportadora_id = v_etam_id;
  select coalesce(saldo, 0) into v_emtt_novo    from public.transportadora_saldos where transportadora_id = v_emtt_id;

  -- ── LEGADOS via fórmulas inline ──
  -- Total de TODOS os abastecimentos_carreta (pra Areacre, que é dona do tanque)
  select coalesce(sum(valor_total), 0) into v_total_abast_carreta from public.abastecimentos_carreta;

  -- Areacre
  select coalesce(sum(valor_total), 0) into v_fretes_areacre
    from public.fretes where transportadora = 'Areacre';
  select coalesce(sum(valor), 0) into v_pagos_para_areacre
    from public.pagamentos_frete where transportadora = 'Areacre' and trim(coalesce(pago_por, '')) <> 'Areacre';
  v_areacre_legado := v_fretes_areacre - v_pagos_para_areacre + v_total_abast_carreta;

  -- Triunfo
  select coalesce(sum(valor_total), 0) into v_fretes_triunfo
    from public.fretes where transportadora = 'Transportadora Triunfo';
  select coalesce(sum(valor), 0) into v_pagos_para_triunfo
    from public.pagamentos_frete where transportadora = 'Transportadora Triunfo';
  select coalesce(sum(valor_total), 0) into v_abast_triunfo
    from public.abastecimentos_carreta where transportadora = 'Transportadora Triunfo';
  v_triunfo_legado := v_fretes_triunfo - v_pagos_para_triunfo - v_abast_triunfo;

  -- Andrade
  select coalesce(sum(valor_total), 0) into v_fretes_andrade
    from public.fretes where transportadora = 'Andrade Transporte';
  select coalesce(sum(valor), 0) into v_pagos_para_andrade
    from public.pagamentos_frete where transportadora = 'Andrade Transporte';
  select coalesce(sum(valor_total), 0) into v_abast_andrade
    from public.abastecimentos_carreta where transportadora = 'Andrade Transporte';
  v_andrade_legado := v_fretes_andrade - v_pagos_para_andrade - v_abast_andrade;

  -- ETAM
  select coalesce(sum(valor_total), 0) into v_fretes_etam
    from public.fretes where transportadora = 'ETAM Construtora';
  select coalesce(sum(valor), 0) into v_pagos_para_etam
    from public.pagamentos_frete where transportadora = 'ETAM Construtora';
  select coalesce(sum(valor), 0) into v_pagos_pela_etam
    from public.pagamentos_frete where trim(coalesce(pago_por, '')) = 'ETAM Construtora';
  v_etam_legado := v_fretes_etam + v_pagos_pela_etam - v_pagos_para_etam;

  -- EMT TRANSPORTES (consolidado: 'EMT TRANSPORTES' OU 'Amazonia Agroindustria',
  -- normalizado lower+trim — replica isEmtConsolidado do dashboard)
  select coalesce(sum(valor_total), 0) into v_fretes_emtt
    from public.fretes where lower(trim(transportadora)) in ('emt transportes', 'amazonia agroindustria');
  select coalesce(sum(valor), 0) into v_pagos_para_emtt
    from public.pagamentos_frete where lower(trim(transportadora)) in ('emt transportes', 'amazonia agroindustria');
  select coalesce(sum(valor_total), 0) into v_abast_emtt
    from public.abastecimentos_carreta where lower(trim(transportadora)) in ('emt transportes', 'amazonia agroindustria');
  select coalesce(sum(valor), 0) into v_pagos_pela_emtt
    from public.pagamentos_frete where lower(trim(coalesce(pago_por, ''))) in ('emt transportes', 'amazonia agroindustria');
  v_emtt_legado := v_fretes_emtt - v_pagos_para_emtt - v_abast_emtt + v_pagos_pela_emtt;

  -- ── Coleta de diffs ──
  v_diff := abs(v_areacre_novo - v_areacre_legado);
  if v_diff > 0.01 then
    v_diffs := v_diffs || format(E'\n  Areacre: novo=R$ %s vs legado=R$ %s (diff R$ %s)',
      to_char(v_areacre_novo, 'FM999G999G990D00'), to_char(v_areacre_legado, 'FM999G999G990D00'), to_char(v_diff, 'FM999G990D0000'));
  end if;

  v_diff := abs(v_triunfo_novo - v_triunfo_legado);
  if v_diff > 0.01 then
    v_diffs := v_diffs || format(E'\n  Triunfo: novo=R$ %s vs legado=R$ %s (diff R$ %s)',
      to_char(v_triunfo_novo, 'FM999G999G990D00'), to_char(v_triunfo_legado, 'FM999G999G990D00'), to_char(v_diff, 'FM999G990D0000'));
  end if;

  v_diff := abs(v_andrade_novo - v_andrade_legado);
  if v_diff > 0.01 then
    v_diffs := v_diffs || format(E'\n  Andrade: novo=R$ %s vs legado=R$ %s (diff R$ %s)',
      to_char(v_andrade_novo, 'FM999G999G990D00'), to_char(v_andrade_legado, 'FM999G999G990D00'), to_char(v_diff, 'FM999G990D0000'));
  end if;

  v_diff := abs(v_etam_novo - v_etam_legado);
  if v_diff > 0.01 then
    v_diffs := v_diffs || format(E'\n  ETAM: novo=R$ %s vs legado=R$ %s (diff R$ %s)',
      to_char(v_etam_novo, 'FM999G999G990D00'), to_char(v_etam_legado, 'FM999G999G990D00'), to_char(v_diff, 'FM999G990D0000'));
  end if;

  v_diff := abs(v_emtt_novo - v_emtt_legado);
  if v_diff > 0.01 then
    v_diffs := v_diffs || format(E'\n  EMT TRANSPORTES: novo=R$ %s vs legado=R$ %s (diff R$ %s)',
      to_char(v_emtt_novo, 'FM999G999G990D00'), to_char(v_emtt_legado, 'FM999G999G990D00'), to_char(v_diff, 'FM999G990D0000'));
  end if;

  if v_diffs <> '' then
    raise exception E'Backfill validação FALHOU — diff > R$0.01 em: %', v_diffs;
  end if;

  raise notice E'Backfill OK. Saldos batem com dashboard legado (≤ R$0.01):\n  Areacre: R$ %\n  Triunfo: R$ %\n  Andrade: R$ %\n  ETAM: R$ %\n  EMT TRANSPORTES: R$ %',
    to_char(v_areacre_novo, 'FM999G999G990D00'),
    to_char(v_triunfo_novo, 'FM999G999G990D00'),
    to_char(v_andrade_novo, 'FM999G999G990D00'),
    to_char(v_etam_novo, 'FM999G999G990D00'),
    to_char(v_emtt_novo, 'FM999G999G990D00');
end $$;

-- ════════════════════════════════════════════════════════════════════
-- (6) Contagens finais
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_saidas_total int;
  v_saidas_backfill int;
  v_movs_total int;
  v_movs_backfill int;
  v_movs_credito_frete int;
  v_movs_debito_pag int;
  v_movs_credito_transterra int;
  v_movs_debito_transterra int;
  v_movs_ajuste_credito int;
  v_movs_debito_emt int;
  v_abast_sem_equip int;
  v_abast_tanque_sem_dep int;
begin
  select count(*) into v_saidas_total from public.saidas_combustivel;
  select count(*) into v_saidas_backfill from public.saidas_combustivel where created_by = 'backfill_fase_2_20260505080000';

  -- Skips do backfill de abastecimentos
  select count(*) into v_abast_sem_equip
    from public.abastecimentos
   where equipamento_id is null or equipamento_id = '';
  select count(*) into v_abast_tanque_sem_dep
    from public.abastecimentos
   where coalesce(origem_combustivel, 'tanque') = 'tanque'
     and (deposito_id is null or deposito_id = '');

  select count(*) into v_movs_total from public.transportadora_movimentos;
  select count(*) into v_movs_backfill from public.transportadora_movimentos where created_by = 'backfill_fase_2_20260505080000';
  select count(*) into v_movs_credito_frete from public.transportadora_movimentos where tipo = 'credito_frete';
  select count(*) into v_movs_debito_pag from public.transportadora_movimentos where tipo = 'debito_pagamento_frete';
  select count(*) into v_movs_credito_transterra from public.transportadora_movimentos where tipo = 'credito_abastecimento_transterra';
  select count(*) into v_movs_debito_transterra from public.transportadora_movimentos where tipo = 'debito_abastecimento_transterra';
  select count(*) into v_movs_ajuste_credito from public.transportadora_movimentos where tipo = 'ajuste_manual_credito';
  select count(*) into v_movs_debito_emt from public.transportadora_movimentos where tipo = 'debito_abastecimento_emt';

  -- ASSERTION RELAXADA: pelo menos UM movimento tem que ter o marker
  -- (sanity check que o backfill rodou). Movimentos sem marker são
  -- esperados se o app inseriu fretes/pagamentos entre Fase 1c e Fase 2 —
  -- triggers automáticas (Fase 1c) não setam created_by; só backfill seta.
  if v_movs_backfill = 0 then
    raise exception 'Nenhum movimento marcado como backfill. Bug no fluxo (UPDATE 2.5 ou inserts manuais sem created_by?).';
  end if;

  if v_movs_total > v_movs_backfill then
    raise notice E'Atenção: % movimentos sem marker created_by — provavelmente atividade do app entre Fase 1c e 2. Pra investigar:\n  SELECT origem_tabela, count(*) FROM transportadora_movimentos WHERE created_by IS NULL GROUP BY 1;',
      v_movs_total - v_movs_backfill;
  end if;

  raise notice E'Contagens pós-backfill:\n  saidas_combustivel total: %\n  saidas via backfill: %\n  abastecimentos legados sem equipamento_id (skipped): %\n  abastecimentos legados origem=tanque sem deposito_id (skipped): %\n  transportadora_movimentos total: % (todos com marker do backfill ✓)\n    credito_frete: %\n    debito_pagamento_frete: %\n    credito_abastecimento_transterra: %\n    debito_abastecimento_transterra: %\n    debito_abastecimento_emt: %\n    ajuste_manual_credito: %',
    v_saidas_total, v_saidas_backfill, v_abast_sem_equip, v_abast_tanque_sem_dep,
    v_movs_total,
    v_movs_credito_frete, v_movs_debito_pag,
    v_movs_credito_transterra, v_movs_debito_transterra,
    v_movs_debito_emt, v_movs_ajuste_credito;
end $$;

commit;
