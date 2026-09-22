# Decisões do Gestão Obras

Registro do que foi decidido e por quê. A entrada mais nova fica no fim.

## 22/09/2026 — Fase 0 da migração para o ERP-EMT: arrumar a origem antes de copiar

Plano: `erp-emt/docs/PLANO-FRETE-COMBUSTIVEL-MANUTENCAO.md`, seção 7. Prova:
`supabase/provas/fase0_origem_antes_de_copiar.sql` (só leitura).

A Fase 0 tem quatro itens. O levantamento foi só leitura. Depois do ok do Tiago (22/09, noite),
duas migrations foram aplicadas em produção: a cópia do combustível vivo (item 4, não muda
comportamento) e o fechamento dos backups abertos (item 2).

### 1. Os 12 testes vermelhos do FIFO não existem mais

O plano pedia para resolver os 12 testes vermelhos de `src/utils/fifoCombustivel.test.ts`,
ou declarar que o FIFO do ERP seria reescrito. O número vinha dos planos de 11/06 a 03/07,
que tratavam as 12 falhas como dívida velha. O commit `afb245d` (09/07/2026, "FIFO desconta
transferência-out e esvaziamento no custeio") reabilitou os 12 e diz na mensagem que eles
"eram a spec". Em 22/09: 16 de 16 verdes no arquivo, suíte inteira 52 de 52 arquivos e
396 testes.

**Decisão:** o PEPS do ERP (Fase 3) é reescrito em SQL, e cada cenário destes 16 testes
(lote único, 70/30, transferência-out e esvaziamento drenando, troca de combustível, sem
suprimento parcial, consumos de outro tanque ignorados) vira um caso da prova SQL do ERP.

**Mas o FIFO existe em dois lugares aqui, e eles não concordam** (item 5). `calcularPrecoFIFO`
(TypeScript, faz a prévia no formulário, é o que os 16 testes cobrem) desconta transferência de
saída e esvaziamento. `private.recompute_fifo_tanque` (banco, autoritativo desde 28/05,
reprecifica toda saída de equipamento do tanque a cada mudança) não desconta. O que está
gravado é o do banco. Qual regra o ERP segue é decisão do Tiago.

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
`supabase/migrations/20260922120000_backups_saidas_fora_do_anon.sql` (+ rollback),
**aplicada em 22/09 com o ok do Tiago**. Liga RLS e revoga de `anon` e `authenticated`, sem mover
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

Impacto: só custo por equipamento. Recarimbar as duas como S500 baixaria elas em R$ 361,79
(734 × (6,7261 − 6,2332)) e subiria as nove em R$ 81,91 (734 × (6,3448 − 6,2332)). Nenhum saldo
de transportadora muda.

**O Tiago escolheu recarimbar (opção A), e o ensaio mostrou que não dá.** Numa transação
desfeita, o UPDATE para S500 volta a S10 na mesma linha: `fn_validate_saida_combustivel`
(BEFORE UPDATE) recarimba todo UPDATE pelo "combustível atual do tanque" na data, e às 15:00
de 01/05 esse combustível é o S10 das 13:27. E o recálculo do FIFO faz UPDATE em toda saída
de equipamento do tanque a cada mudança, então mesmo com o gatilho desligado o S10 voltaria
na primeira mexida no Meloza Colorado. Recarimbar exige mudar regra (o gatilho de
derivação, ou a hora das saídas). Voltou para decisão do Tiago.

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
preserva os grants), só registra no histórico de migrations. **Aplicado em 22/09 com o ok do
Tiago.** Depois de aplicar, o md5 das 31 funções no banco continuou o da manhã (31 de 31) e os
37 triggers seguiram ligados. A correção dos backups (item 2) também foi aplicada, e `anon`
recebe `permission denied`.

Advisors depois das duas: só apareceu o esperado (os três backups com "RLS sem policy", INFO).
O resto já existia: 4 views SECURITY DEFINER (`transportadora_saldos` entre elas), 4 funções
sem `search_path` e 14 funções SECURITY DEFINER executáveis por `anon`. Não mexi: é escrita
fora do autorizado num sistema que vai virar só leitura. Fica listado para o ERP não repetir.

### 5. O FIFO do banco não desconta transferência nem esvaziamento

Achado ao preparar o ensaio do S10. `private.recompute_fifo_tanque` monta os lotes com
entradas e transferências de entrada, e drena só com saídas. Transferência de saída e
esvaziamento reduzem o nível do tanque (`recalcular_nivel_deposito`) mas não os lotes. O helper
TypeScript foi corrigido para drenar em 09/07 (`afb245d`), mas ele só faz a prévia: o banco
reprecifica tudo por cima.

Medido com um simulador em transação desfeita (`supabase/provas/fase0_simulador_fifo_com_drenos.sql`),
nos 6 tanques próprios que têm dreno:

- Controle, sem drenos: as 1.804 saídas de equipamento batem com o `valor_total` gravado na
  quarta casa. O simulador é o algoritmo do banco.
- Com drenos: **só o Meloza EMT muda. 78 saídas, +R$ 440,69 no total, a maior +R$ 303,79.**
  Os outros cinco não mudam nada.
- Carreta é precificada pelo preço digitado, não pelo FIFO, então nenhuma conta corrente muda.

A conferência 9.2 exige origem igual ao destino. Se o ERP seguir a regra dos testes, o Meloza
EMT não bate por R$ 440,69, a menos que a origem seja corrigida antes. Decisão do Tiago.

### 6. O que isto muda no plano do ERP

- Seção 7, Fase 0: o item dos 12 testes vira "já resolvido em 09/07, os 16 testes são a spec".
- Seção 9, conferência 5: dizer que conta sem as excluídas (164 concluídas + 3 canceladas; há
  mais 5 concluídas excluídas, custo zero).
- Seção 2: a regra portada vem de `20260922110000_sync_combustivel_banco_vivo.sql`, e as
  9 funções e 11 triggers só-do-banco (auditoria, capacidade, fornecedor da entrada) entram na
  lista do que precisa ser portado.
- Seção 6.1: JOHN DEERE não é a JD COMERCIO (Tiago, 22/09). Vira fornecedor novo no ERP, como a EMT TRANSPORTES.
- Seção 11: a opção A do S10 não se sustenta sozinha (item 3), e a regra do FIFO (item 5) é pendência nova.
