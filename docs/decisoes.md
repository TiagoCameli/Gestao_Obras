# Decisões do Gestão Obras

Registro do que foi decidido e por quê. A entrada mais nova fica no fim.

## 22/09/2026 — Fase 0 da migração para o ERP-EMT: arrumar a origem antes de copiar

Plano: `erp-emt/docs/PLANO-FRETE-COMBUSTIVEL-MANUTENCAO.md`, seção 7. Prova:
`supabase/provas/fase0_origem_antes_de_copiar.sql` (só leitura).

A Fase 0 tem quatro itens. Nenhum deles escreveu no banco de produção: o que precisa de
escrita está versionado e espera o ok do Tiago.

### 1. Os 12 testes vermelhos do FIFO não existem mais

O plano pedia para resolver os 12 testes vermelhos de `src/utils/fifoCombustivel.test.ts`,
ou declarar que o FIFO do ERP seria reescrito. O número vinha dos planos de 11/06 a 03/07,
que tratavam as 12 falhas como dívida velha. O commit `afb245d` (09/07/2026, "FIFO desconta
transferência-out e esvaziamento no custeio") reabilitou os 12 e diz na mensagem que eles
"eram a spec". Em 22/09: 16 de 16 verdes no arquivo, suíte inteira 52 de 52 arquivos e
396 testes.

**Decisão:** o PEPS do ERP (Fase 3) é reescrito em SQL, e estes 16 testes viram a
especificação dele, junto com a função viva `private.recompute_fifo_tanque`. Cada cenário
do arquivo (lote único, 70/30, transferência-out e esvaziamento drenando, troca de
combustível, sem suprimento parcial, consumos de outro tanque ignorados) vira um caso da
prova SQL do ERP.

Cuidado registrado: o FIFO existe em dois lugares aqui. `calcularPrecoFIFO` (TypeScript, faz
a prévia no formulário) e `private.recompute_fifo_tanque` (banco, é o autoritativo desde
28/05 e regrava `consumos_lote` e o preço das saídas). A conferência 9.2 da virada compara
com o banco, não com o helper.

### 2. Tabelas de backup ficam fora da migração

Oito tabelas, 2.930 linhas: `private._fifo_backfill_backup_20260528`,
`private.bkp_fretes_tarifa_20260901`, `abastecimentos_backup_20260505`,
`abastecimentos_carreta_backup_20260505`, `etapas_obra_backup_20260505_obra009`,
`saidas_andrade_backup2_20260826`, `saidas_arla_backup_20260826`,
`saidas_motorista_backup_20260826`. Nenhum script de migração lê delas. Ficam no banco
de origem, que não é apagado (Fase 5).

**Achado de segurança, fora do plano:** as três de 26/08 estão em `public` com RLS desligada
e `anon` com SELECT, UPDATE, DELETE e TRUNCATE. Qualquer pessoa com a chave pública do site
lê placa, motorista e valor, e pode apagar o backup que é a única fonte dos rollbacks das
correções da Andrade e do Arla. Correção pronta em
`supabase/migrations/20260922120000_backups_saidas_fora_do_anon.sql` (+ rollback), **não
aplicada**, esperando o ok do Tiago. Liga RLS e revoga de `anon` e `authenticated`, sem mover
de schema, porque os `fix_`/`rollback_` da raiz leem essas tabelas pelo nome.

Também ficou fora do inventário do plano, e não muda nada: `saidas_material` e
`transferencias_material` estão vazias, `financeiro_equipamento` e `depositos_lixeira` também.
`depositos_material` (3) e `categorias_material` (4) entram no de-para do almoxarifado na Fase 2.

### 3. Pendência do S10 de 01/05 a 20/05 no Meloza Colorado: diagnóstico fechado, decisão do Tiago

A pendência anotada em 29/05 dizia que "toda saída" entre 01/05 e 20/05 saía carimbada S10.
Hoje são só duas: `mfuelbkf31` (643 L, col-usina-01) e `mfuelbkf32` (91 L, pc-001), as duas de
01/05 15:00, 734 L, R$ 4.936,96 a 6,7261. As outras 39 da janela já estão como S500.

Os números fecham sem margem: às 13:26 de 01/05 o tanque tinha 734 L, todos de S500 (não
houve entrada de outro tipo antes). Entraram 5.000 L de S10 às 13:27, saíram as duas de
734 L às 15:00, e em 11/05 saíram 5.000 L de S10 por transferência, zerando o tanque. As
duas saídas são o residual de S500.

Com o carimbo S10, o FIFO (segmentado por tipo) tirou os 734 L do lote de S10, que fica
devendo 734 L na transferência, e deixou 734 L de S500 do lote de 27/04 (6,2332) vivos. Esse
residual fantasma foi consumido por 9 saídas de 20/05 a 22/05 que, na física, deviam ter
saído do lote de 20/05 (6,3448). As 9 são de equipamento: **nenhuma é de carreta e nenhuma
tem movimento na conta corrente** (linha de controle: saída de carreta dá 1 movimento).

Impacto: só custo por equipamento. Recarimbar as duas como S500 baixa elas em R$ 361,79
(734 × (6,7261 − 6,2332)) e sobe as nove em R$ 81,91 (734 × (6,3448 − 6,2332)). O resto da
cascata, nas saídas seguintes do tanque, só se mede rodando o recálculo. Nenhum saldo de
transportadora muda. A decisão (corrigir na origem antes da carga, ou migrar como está) é
do Tiago; ver o resumo da Fase 0.

### 4. Descompasso entre banco e migrations do combustível

O plano citava uma função (`calcular_combustivel_tanque_na_data`). A comparação foi feita nas
42 funções do combustível e nos triggers das 7 tabelas, contra a última definição de cada uma
em `supabase/migrations/`:

- 11 iguais.
- 7 com lógica diferente: `calcular_combustivel_tanque_na_data` (o banco devolve NULL com
  saldo ≤ 0 e compara como `timestamptz`, o repo compara texto), `calcular_estoque_combustivel_na_data`
  (banco STABLE, `timestamptz`; repo VOLATILE comparando `data::text`), `fn_saidas_combustivel_movimentos`
  (o banco trata soft delete e grava `mes_referencia`), `recalcular_nivel_deposito`, os dois
  gatilhos de nível de esvaziamento e transferência (o banco recalcula também o tanque antigo
  quando o UPDATE troca o tanque) e `registrar_saida_combustivel_fifo` (o banco aceita
  `foto_urls` solto).
- 3 em que o banco roda o fix e o último arquivo do repo é o `*_rollback.sql`, que nunca foi
  aplicado. **Os `*_rollback.sql` de `supabase/migrations/` não são história, são emergência.**
- 7 com o corpo igual e `search_path` só no banco. 5 que mudam só texto de mensagem ou comentário.
- 9 funções e 11 triggers (auditoria, `updated_at`, capacidade, resolução do fornecedor da
  entrada) que existem só no banco, sem nenhum arquivo no repo.

**Decisão:** o repo passa a ter a foto do banco em
`supabase/migrations/20260922110000_sync_combustivel_banco_vivo.sql`: o `pg_get_functiondef`
das 31 funções, copiado sem editar, e os 11 triggers. Conferido por md5 contra o banco, 31 de
31. É daqui, e não das migrations antigas, que o ERP porta as regras do combustível na Fase 3.

Aplicar esse arquivo no banco não muda comportamento (mesmo corpo, e `CREATE OR REPLACE`
preserva os grants), só registra no histórico de migrations. Mesmo assim é escrita em
produção, então **não foi aplicado** e espera o ok do Tiago.

### 5. O que isto muda no plano do ERP

- Seção 7, Fase 0: o item dos 12 testes vira "já resolvido em 09/07, os 16 testes são a spec".
- Seção 9, conferência 5: dizer que conta sem as excluídas (164 concluídas + 3 canceladas; há
  mais 5 concluídas excluídas, custo zero).
- Seção 2: a regra portada vem de `20260922110000_sync_combustivel_banco_vivo.sql`, e as
  9 funções e 11 triggers só-do-banco (auditoria, capacidade, fornecedor da entrada) entram na
  lista do que precisa ser portado.
- Seção 6.1 e usuários: nada mudou.
