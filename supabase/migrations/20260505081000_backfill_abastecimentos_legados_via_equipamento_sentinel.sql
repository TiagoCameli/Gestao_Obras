-- Fase 2 (continuação) — Backfill dos 756 abastecimentos legados via
-- equipamento sentinel.
--
-- CONTEXTO: a Fase 0 wipou equipamento_id de TODOS os 756 abastecimentos
-- ("set to Sem equipamento atrelado"). Resultado: nenhum tem equipamento_id
-- preenchido. O backfill da migration 080 skipou todos porque a CHECK
-- saida_equipamento_exige_equipamento exige equipamento_id NOT NULL.
--
-- DECISÃO: criar 1 row sentinel em equipamentos com id='desconhecido' e
-- backfilar os 756 com esse id. Preserva o histórico de consumo no novo
-- modelo (mesmo que sem identificação do equipamento real). Permite Fase 5
-- dropar a tabela legada `abastecimentos` sem perder dados.
--
-- Sentinel marcado com:
--   * status='fora_funcionamento' + ativo=false → não aparece em dropdowns
--     operacionais (forms da Fase 4 vão filtrar por ativo=true).
--   * empresa_id = EMT Construtora (mm4em4xic5sp2) — operação principal.
--
-- IDEMPOTÊNCIA:
--   * INSERT do sentinel via ON CONFLICT DO NOTHING.
--   * INSERT em saidas_combustivel via WHERE NOT EXISTS por id (mesmo
--     padrão da 080).
--
-- MARKER: created_by = 'backfill_fase_2_20260505081000' nas saídas novas
-- pra distinguir do batch anterior.

begin;

-- ════════════════════════════════════════════════════════════════════
-- (1) Cria equipamento sentinel
-- ════════════════════════════════════════════════════════════════════

insert into public.equipamentos (
  id, nome, tipo, empresa_id,
  codigo_patrimonio, numero_serie, ano, marca, modelo,
  propriedade, status, tipo_medicao, medicao_inicial,
  ativo, data_aquisicao, data_venda, criado_por
) values (
  'desconhecido',
  'Equipamento Desconhecido',
  '',
  'mm4em4xic5sp2',                              -- EMT Construtora
  '',
  '',
  '',
  '',
  '',
  'propria',
  'fora_funcionamento',                         -- não aparece em dropdowns operacionais
  'horimetro',
  0,
  false,                                        -- inativo (filtros UI escondem)
  '',
  '',
  'system_migration_20260505081000'
)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- (2) Backfill abastecimentos (756) → saidas_combustivel
-- ════════════════════════════════════════════════════════════════════
-- tipo_consumidor='equipamento_proprio', equipamento_id='desconhecido'.
-- Reutiliza id original. Trigger ignora (não cria movimento financeiro
-- — saída de equipamento próprio não afeta conta-corrente).

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
  'desconhecido',                               -- sentinel
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
  'backfill_fase_2_20260505081000'
from public.abastecimentos a
where not exists (select 1 from public.saidas_combustivel s where s.id = a.id)
  -- Mesma proteção defensiva da 080: não tenta migrar rows com
  -- origem='tanque' + deposito vazio (probe da Fase 2 confirmou ZERO).
  and not (
    coalesce(a.origem_combustivel, 'tanque') = 'tanque'
    and (a.deposito_id is null or a.deposito_id = '')
  );

-- ════════════════════════════════════════════════════════════════════
-- (3) Validação
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_sentinel_existe bool;
  v_saidas_total int;
  v_saidas_sentinel int;
  v_abast_legado int;
  v_abast_orfas int;
  v_movs_apos int;
  v_movs_antes_estimado int := 741;  -- contagem da migration 080
begin
  -- Sentinel existe?
  select exists (select 1 from public.equipamentos where id = 'desconhecido')
    into v_sentinel_existe;
  if not v_sentinel_existe then
    raise exception 'Sentinel "desconhecido" não foi criado em equipamentos';
  end if;

  -- Contagens
  select count(*) into v_saidas_total from public.saidas_combustivel;
  select count(*) into v_saidas_sentinel
    from public.saidas_combustivel where equipamento_id = 'desconhecido';
  select count(*) into v_abast_legado from public.abastecimentos;
  select count(*) into v_abast_orfas
    from public.abastecimentos
   where coalesce(origem_combustivel, 'tanque') = 'tanque'
     and (deposito_id is null or deposito_id = '');

  -- v_saidas_sentinel deve ser igual a v_abast_legado − v_abast_orfas
  if v_saidas_sentinel <> (v_abast_legado - v_abast_orfas) then
    raise exception 'Backfill sentinel: esperado % rows (% legado − % órfãs com tanque sem deposito); encontrado %',
      v_abast_legado - v_abast_orfas, v_abast_legado, v_abast_orfas, v_saidas_sentinel;
  end if;

  -- Movimentos não devem ter mudado (sentinel é equipamento_proprio → trigger ignora)
  select count(*) into v_movs_apos from public.transportadora_movimentos;
  if v_movs_apos <> v_movs_antes_estimado then
    -- Se o app inseriu movs entre 080 e 081, a contagem cresce — log mas não aborta
    raise notice 'transportadora_movimentos: % rows (estimado pós-080 era %). Diferença = atividade do app.',
      v_movs_apos, v_movs_antes_estimado;
  end if;

  raise notice E'Backfill sentinel OK:\n  saidas_combustivel total: % (167 carreta + % equipamento via sentinel)\n  abastecimentos legados: %\n  abastecimentos legados órfãs (skipped): %\n  transportadora_movimentos: % (sem mudança esperada — trigger ignora equipamento_proprio)',
    v_saidas_total, v_saidas_sentinel,
    v_abast_legado, v_abast_orfas,
    v_movs_apos;
end $$;

commit;
