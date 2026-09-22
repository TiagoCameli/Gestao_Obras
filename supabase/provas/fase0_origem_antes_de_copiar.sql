-- Fase 0 da migração para o ERP-EMT: prova de que a origem está pronta para ser copiada.
-- Plano: erp-emt/docs/PLANO-FRETE-COMBUSTIVEL-MANUTENCAO.md, seção 7.
-- SOMENTE LEITURA. Rodar no projeto gunyitwrbxbmnezokgjq. Nenhuma linha aqui escreve.
-- Resultados medidos em 22/09/2026 ficam anotados depois de cada bloco.

------------------------------------------------------------------------------
-- 1. Recontagem dos números do plano (seção 2)
------------------------------------------------------------------------------
select t, n from (values
  ('fretes',                     (select count(*) from fretes)),
  ('pagamentos_frete',           (select count(*) from pagamentos_frete)),
  ('transportadora_movimentos',  (select count(*) from transportadora_movimentos)),
  ('pedidos_material',           (select count(*) from pedidos_material)),
  ('localidades',                (select count(*) from localidades)),
  ('depositos',                  (select count(*) from depositos)),
  ('entradas_combustivel',       (select count(*) from entradas_combustivel)),
  ('saidas_combustivel',         (select count(*) from saidas_combustivel)),
  ('transferencias_combustivel', (select count(*) from transferencias_combustivel)),
  ('esvaziamentos_tanque',       (select count(*) from esvaziamentos_tanque)),
  ('consumos_lote',              (select count(*) from consumos_lote)),
  ('saidas_sem_suprimento',      (select count(*) from saidas_sem_suprimento)),
  ('anomalias_checks',           (select count(*) from anomalias_checks)),
  ('ordens_servico',             (select count(*) from ordens_servico)),
  ('os_pecas',                   (select count(*) from os_pecas)),
  ('os_oleos',                   (select count(*) from os_oleos)),
  ('os_terceiros',               (select count(*) from os_terceiros)),
  ('tipos_oleo',                 (select count(*) from tipos_oleo)),
  ('entradas_material',          (select count(*) from entradas_material)),
  ('documentos_equipamento',     (select count(*) from documentos_equipamento)),
  ('especificacoes_equipamento', (select count(*) from especificacoes_equipamento)),
  ('equipamentos',               (select count(*) from equipamentos))
) v(t, n);
-- 22/09/2026 (tarde): fretes 852, pagamentos_frete 114, transportadora_movimentos 2649,
-- pedidos_material 66, localidades 7, depositos 8 (2 externos), entradas 62, saidas 3088,
-- transferencias 5, esvaziamentos 4, consumos_lote 2458, sem_suprimento 1, anomalias 87,
-- OS 172, os_pecas 306, os_oleos 58, os_terceiros 38, tipos_oleo 18, entradas_material 332,
-- documentos 98, especificacoes 47, equipamentos 109.
-- Diferença contra o plano (manhã): +3 fretes, +8 movimentos, +5 saídas, +4 consumos_lote.
-- É o uso normal do dia, o app segue gravando. Nada estrutural mudou.

-- OS por status, separando as excluídas (conferência 9.5 do plano conta SEM as excluídas)
select (deleted_at is not null) as excluida, status, count(*), sum(custo_total)
  from ordens_servico group by 1, 2 order by 1, 2;
-- 164 concluídas + 3 canceladas vivas, R$ 299.367,27. Mais 5 concluídas excluídas, custo 0.

-- Tabelas do escopo que o inventário do plano não lista
select t, n from (values
  ('saidas_material',          (select count(*) from saidas_material)),
  ('transferencias_material',  (select count(*) from transferencias_material)),
  ('depositos_material',       (select count(*) from depositos_material)),
  ('depositos_obras',          (select count(*) from depositos_obras)),
  ('depositos_lixeira',        (select count(*) from depositos_lixeira)),
  ('financeiro_equipamento',   (select count(*) from financeiro_equipamento)),
  ('os_contador',              (select count(*) from os_contador)),
  ('categorias_material',      (select count(*) from categorias_material))
) v(t, n);
-- 0, 0, 3, 1, 0, 0, 1, 4. Vazias não migram. depositos_material e categorias_material
-- entram no de-para do almoxarifado (Fase 2). os_contador é substituído por documento_sequencias.

------------------------------------------------------------------------------
-- 2. Tabelas de backup: ficam FORA da migração
------------------------------------------------------------------------------
select n.nspname, c.relname, c.relrowsecurity as rls,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies,
       has_table_privilege('anon', c.oid, 'select') as anon_le,
       has_table_privilege('authenticated', c.oid, 'select') as auth_le
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'v', 'm', 'p')
   and n.nspname not in ('pg_catalog', 'information_schema')
   and c.relname ~* '(backup|bkp|_bak|_old|snapshot|_copy|_tmp|temp_)'
 order by 1, 2;
-- 8 tabelas, 2.930 linhas:
--   private._fifo_backfill_backup_20260528   1146
--   private.bkp_fretes_tarifa_20260901        121
--   public.abastecimentos_backup_20260505     756  (a tabela abastecimentos original não existe mais)
--   public.abastecimentos_carreta_backup_20260505 167
--   public.etapas_obra_backup_20260505_obra009    135
--   public.saidas_andrade_backup2_20260826    212  RLS DESLIGADA, anon lê, altera, apaga e trunca
--   public.saidas_arla_backup_20260826         81  RLS DESLIGADA, idem
--   public.saidas_motorista_backup_20260826   212  RLS DESLIGADA, idem
-- As três de 26/08 estão expostas para qualquer um com a chave pública do site.
-- Correção proposta (NÃO aplicada, é escrita em produção): ver o arquivo de migration
-- 20260922120000_backups_saidas_fora_do_anon.sql.

------------------------------------------------------------------------------
-- 3. Pendência S10 01/05 a 20/05, tanque Meloza Colorado (mmjak3d05dfun)
------------------------------------------------------------------------------
-- Tipos: mlplpomwf0uod = Diesel S10, mlvjtpi8o1vmk = Diesel S500.

-- 3a. Saldo do tanque nos marcos da janela, pela função viva
select public.calcular_estoque_combustivel_na_data('mmjak3d05dfun', '2026-05-01T13:26:00', null) as antes_da_entrada_s10,
       public.calcular_estoque_combustivel_na_data('mmjak3d05dfun', '2026-05-01T15:01:00', null) as depois_das_2_saidas,
       public.calcular_estoque_combustivel_na_data('mmjak3d05dfun', '2026-05-11T15:17:00', null) as depois_da_transferencia,
       public.calcular_estoque_combustivel_na_data('mmjak3d05dfun', '2026-05-20T12:57:00', null) as antes_do_s500_de_2005;
-- 734 / 5000 / 0 / 0. Antes da entrada de S10 só havia S500 no tanque (nenhuma entrada de
-- outro tipo antes de 01/05 13:27), então os 734 L eram S500.

-- 3b. O que saiu na janela, por tipo
select tipo_combustivel,
       sum(litros) filter (where data >= '2026-05-01 13:27' and data < '2026-05-11 15:16') as entre_0105_e_1105,
       sum(litros) filter (where data >= '2026-05-11 15:16' and data < '2026-05-20 12:58') as entre_1105_e_2005
  from saidas_combustivel
 where tanque_id = 'mmjak3d05dfun' and deleted_at is null
 group by 1;
-- Só as duas saídas de 01/05 15:00 (mfuelbkf31 643 L col-usina-01, mfuelbkf32 91 L pc-001),
-- as duas carimbadas S10, 734 L. Depois delas, 5.000 L de S10 saem por transferência
-- (mp391xf0q564d, 11/05) e o tanque zera.
-- Conclusão física: as 734 L eram o residual de S500. Carimbadas S10, elas tiraram 734 L do
-- lote S10 (6,7261), que fica devendo 734 L na transferência, e deixaram 734 L de S500 do lote
-- de 27/04 (6,2332) "vivos" no FIFO.

-- 3c. Quem consumiu o residual fantasma de S500 depois de 20/05
select s.id, s.data, s.equipamento_id, s.transportadora_id, s.litros,
       sum(c.litros) filter (where c.fonte_id = 'mok5zmutc9kwb') as do_lote_2704,
       (select count(*) from transportadora_movimentos m where m.origem_id = s.id) as movimentos_cc
  from saidas_combustivel s join consumos_lote c on c.consumo_id = s.id
 where s.tanque_id = 'mmjak3d05dfun' and s.deleted_at is null and s.data >= '2026-05-01'
   and exists (select 1 from consumos_lote c2 where c2.consumo_id = s.id and c2.fonte_id = 'mok5zmutc9kwb')
 group by 1, 2, 3, 4, 5 order by s.data;
-- 9 saídas de 20/05 14:14 a 22/05 08:35, todas de equipamento, nenhuma de carreta,
-- zero movimento na conta corrente. Somam 734 L do lote de 27/04 a 6,2332, que na física
-- deviam ter saído do lote de 20/05 a 6,3448.
-- Impacto: só custo por equipamento. Nenhum saldo de transportadora muda.

------------------------------------------------------------------------------
-- 4. Depois do ok do Tiago (22/09/2026, noite): as duas migrations aplicadas
------------------------------------------------------------------------------
-- 4a. Backups fechados: RLS ligada, zero grant para anon/authenticated, linhas intactas.
select c.relname, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'select') as anon_le,
       has_table_privilege('anon', c.oid, 'delete') as anon_apaga,
       (select count(*) from information_schema.role_table_grants g
         where g.table_schema = 'public' and g.table_name = c.relname
           and g.grantee in ('anon', 'authenticated')) as grants_app
  from pg_class c
 where c.relname in ('saidas_andrade_backup2_20260826', 'saidas_arla_backup_20260826',
                     'saidas_motorista_backup_20260826');
-- rls true, anon_le false, anon_apaga false, grants_app 0 nas três. Linhas 212/81/212.
-- Linha de controle: `set local role anon; select count(*) from public.saidas_arla_backup_20260826`
-- dá 42501 permission denied.

-- 4b. Cópia do banco aplicada sem mudar nada: md5(pg_get_functiondef) das 31 funções igual ao
-- medido de manhã (31 de 31), e os 37 triggers das 7 tabelas do combustível seguem ligados.

------------------------------------------------------------------------------
-- 5. Ensaio do recarimbo S10 → S500 (opção A), em transação que aborta
------------------------------------------------------------------------------
-- do $ensaio$ ... update saidas_combustivel set tipo_combustivel = 'mlvjtpi8o1vmk'
--   where id in ('mfuelbkf31','mfuelbkf32') ... raise exception ... $ensaio$;
-- do $aborto$ begin raise exception 'ABORTO GARANTIDO'; end $aborto$;
-- Resultado: as duas voltam a S10 no mesmo UPDATE. fn_validate_saida_combustivel (BEFORE
-- UPDATE) recarimba pelo "combustível atual do tanque" na data, que às 15:00 de 01/05 é o S10
-- que entrou às 13:27. Zero saída mudou. Recarimbo manual não se sustenta.

------------------------------------------------------------------------------
-- 6. FIFO do banco x FIFO dos 16 testes, simulado em transação que aborta
------------------------------------------------------------------------------
-- private.recompute_fifo_tanque drena os lotes só com saídas. O helper TypeScript (e os 16
-- testes, desde 09/07) drena também com transferência de saída (mesmo tipo) e esvaziamento
-- (qualquer tipo, só lote que já existia). O banco reprecifica toda saída de equipamento do
-- tanque a cada mudança, então o que vale gravado é a regra do banco.
-- Simulador (DO block, abortado) nos 6 tanques próprios com dreno:
--   controle (sem drenos): 1.804 saídas de equipamento, 0 com diferença > 0,00005.
--     O simulador é o algoritmo do banco.
--   com drenos: só o Meloza EMT muda. 78 saídas, +R$ 440,6867 no total, maior +R$ 303,7866.
--     ARLA GREGÓRIO, Meloza Colorado, Canteiro 1, Canteiro 2 e Pátio Colorado: 0.
-- Carreta é precificada pelo preço digitado, não pelo FIFO: nenhuma conta corrente muda.
