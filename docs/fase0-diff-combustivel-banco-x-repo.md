# Combustível: banco vivo x migrations do repo

Banco: `gunyitwrbxbmnezokgjq` (só leitura). Repo: worktree `fase0-origem-antes-de-copiar`, 270 arquivos em `supabase/migrations/`.

## Como comparei

- **Corpo da função**: `prosrc` vivo contra o corpo entre `$tag$` da última definição no repo. Ignorei espaço em branco e maiúsc/minúsc. Onde o hash não bateu, rodei um diff linha a linha, sem os comentários `--`.
- **Transcrição conferida**: toda definição salva em `vivas/` foi re-hasheada e bate com o md5 que o banco devolveu. O `fn_saidas_combustivel_movimentos` só bate sem o `lower()`, porque o `lower()` do Postgres não mexe no `Ã`.
- **Atributos**: comparei argumentos (com defaults), retorno, SECURITY DEFINER, volatilidade, `proconfig` e linguagem. Levei em conta os `ALTER FUNCTION` do repo; o único que toca estas funções é `20260521120500`, que põe SECDEF no `fn_saidas_combustivel_movimentos`.
- **Sobrecarga**: cada nome existe uma vez só no banco, sem overload.

> **Atenção: arquivos de rollback moram em `migrations/`.** Pela regra "maior timestamp", a última definição de 4 funções cai num arquivo `*_rollback.sql`, que nunca foi aplicado. Os DROPs dos rollbacks `20260528220100` e `20260529160100` também não foram, já que todas as funções `private.*` e os triggers de FIFO, saldo e ciclo existem vivos. Por isso, nesses 4 casos comparei também com a última definição que não é rollback. A migration de sincronização deve ignorar os `*_rollback.sql`.

## 1. Funções

Legenda:
- **IGUAL**: corpo e atributos idênticos.
- **IGUAL\***: só comentários diferem.
- **ATRIB**: o corpo é igual, mas o banco tem `SET search_path TO 'pg_catalog','public'` e o repo não tem search_path nenhum.

| função | status | última definição no repo | o que muda (viva x repo) |
|---|---|---|---|
| private.inicio_ciclo_aberto | IGUAL\* | 20260529160000_combustivel_travas_saldo_ciclo_fix | Só comentários. |
| private.recompute_fifo_tanque | IGUAL\* | 20260528220000_combustivel_fifo_autoritativo_fix | Só comentários. |
| private.saldo_min_tanque | IGUAL | 20260529160000 | — |
| private.tanque_eh_externo | IGUAL | 20260529160000 | — |
| private.trg_guard_saldo_entrada | IGUAL | 20260529160000 | — |
| private.trg_guard_saldo_saida | IGUAL | 20260529160000 | — |
| private.trg_guard_saldo_transferencia | IGUAL | 20260529160000 | — |
| private.trg_lock_ciclo_entrada | IGUAL | 20260529160000 | — |
| private.trg_lock_ciclo_saida | IGUAL\* | 20260529160000 | Só comentários. |
| private.trg_lock_ciclo_transferencia | DIFERENTE (só texto) | 20260529160000 | A lógica é a mesma. Só a mensagem do DELETE mudou: a viva não tem o trecho "(tanque zerou e recebeu combustível novo)". |
| private.trg_recompute_fifo_entrada | IGUAL | 20260528220000 | — |
| private.trg_recompute_fifo_saida | IGUAL | 20260528220000 | — |
| private.trg_recompute_fifo_transferencia | IGUAL | 20260528220000 | — |
| public.audit_combustivel_log | SÓ NO BANCO | — | Trigger de auditoria (create, update com diff, soft-delete, restore, hard delete) que grava em `audit_log`. |
| public.calcular_combustivel_tanque_na_data | DIFERENTE | 20260522060000_simplify_combustivel_fallbacks | A viva devolve NULL quando o saldo na data é ≤ 0, porque chama `calcular_estoque_combustivel_na_data`. Também compara datas como `timestamptz`. O repo compara o esvaziamento como texto (`data_hora::text <= p_data_hora`) e não checa saldo. |
| public.calcular_estoque_combustivel_na_data | DIFERENTE (+atrib) | 20260521120000_combustivel_deleted_at_filter | A viva é **STABLE** (o repo é VOLATILE), tem guarda de NULL (retorna 0) e compara tudo como `::timestamptz`. O repo compara saídas e esvaziamentos como texto (`data::text <= p_data_hora`), o que depende do formato: `'T'` e `' '` dão resultados diferentes. |
| public.calcular_preco_medio_tanque_na_data | IGUAL | 20260521120600 | — |
| public.check_pode_dar_saida | SÓ NO BANCO | — | `saldo_deposito_insumo(...) >= p_quantidade` (módulo de material). |
| public.depositos_purgar_lixeira_expirada | SÓ NO BANCO | — | Apaga de vez os itens de `depositos_lixeira` com retenção vencida (tabelas `*_material`). |
| public.depositos_set_atualizado_em | SÓ NO BANCO | — | `new.atualizado_em = now()`. |
| public.fn_block_entrada_em_deposito_externo | ATRIB | 20260505060000 | Corpo igual (só comentário); a diferença é o search_path. |
| public.fn_block_transferencia_envolvendo_externo | ATRIB | 20260505060000 | Corpo igual; a diferença é o search_path. |
| public.fn_saidas_combustivel_movimentos | DIFERENTE | 20260505180000_split_preco (SECDEF e search_path vêm do ALTER em 20260521120500 e batem) | A viva trata soft delete: `deleted_at` preenchido apaga os movimentos, e a restauração recria. O UPDATE in-place também grava `mes_referencia`. A descrição do débito usa o nome do tanque em vez de "Abastecimento na Transterra". O `fix_tanque_posto_progresso.sql` da raiz, que está fora das migrations, só traz a parte da descrição; o soft delete e o `mes_referencia` não estão em arquivo nenhum. |
| public.fn_stamp_transferencia_tipo_combustivel | DIFERENTE do último (rollback); **IGUAL a 20260611180000_fix** | 20260611180100_transferencia_edit_metadados_**rollback** | Viva = fix: num UPDATE sem mudança de origem ou data, não recalcula o tipo. O rollback recalcula sempre. |
| public.fn_trigger_recalcular_nivel_entrada | ATRIB | 20260505130000 | Corpo igual; a diferença é o search_path. |
| public.fn_trigger_recalcular_nivel_esvazia | DIFERENTE (+atrib) | 20260513000000_f11_lock | A viva, num UPDATE que troca o `deposito_id`, recalcula também o depósito antigo. O repo não recalcula. |
| public.fn_trigger_recalcular_nivel_saida | ATRIB | 20260505130000 | Corpo igual; a diferença é o search_path. |
| public.fn_trigger_recalcular_nivel_transferencia | DIFERENTE (+atrib) | 20260505130000 | A viva, num UPDATE que troca origem ou destino, recalcula também os depósitos antigos. O repo não recalcula. |
| public.fn_validate_capacidade_entrada | SÓ NO BANCO | — | Barra entrada que passa da `capacidade_litros` do tanque (ignora externo e capacidade ≤ 0; no UPDATE desconta o valor antigo). Sem search_path. |
| public.fn_validate_capacidade_transferencia | SÓ NO BANCO | — | A mesma regra para o tanque de destino da transferência. Sem search_path. |
| public.fn_validate_data_nao_futura_wc | IGUAL\* | 20260523160000 | Só comentários. |
| public.fn_validate_entrada_combustivel | ATRIB (+comentários) | 20260513000000_f11_lock | Corpo igual; a diferença é o search_path. |
| public.fn_validate_saida_combustivel | DIFERENTE do último (rollback); **IGUAL\* a 20260529150000_fix** | 20260529150100_validate_saida_coalesce_tipo_**rollback** | Viva = fix: `COALESCE(calcular_combustivel..., NEW.tipo_combustivel)`, ou seja, nunca troca um tipo válido por NULL. O rollback atribui direto e pode anular o tipo. |
| public.fn_validate_transferencia_combustivel | DIFERENTE do último (rollback); **IGUAL a 20260611180000_fix** | 20260611180100_**rollback** | Viva = fix: num UPDATE sem mudança de origem, destino, litros ou data, pula a validação de mistura. O rollback valida sempre. |
| public.inicio_ciclo_aberto_tanque | IGUAL | 20260529160000 | — |
| public.recalcular_nivel_deposito | DIFERENTE | 20260522060000_simplify (6ª definição) | A viva calcula o último esvaziamento uma vez, como `timestamp`, e compara com `COALESCE(v, '1970-01-01'::timestamp)`. O repo usa uma subquery `max(data_hora::text)` e compara timestamp com texto. O nível e o combustível resultantes são equivalentes, salvo formato de texto. |
| public.registrar_saida_combustivel_fifo | DIFERENTE do rollback **e** do fix | último: 20260528220100_**rollback**; não-rollback: 20260528220000_fix | Contra o fix: a lógica é a mesma (só insere a saída; `p_lotes` ignorado). A diferença é que a viva normaliza `foto_urls` e `arquivo_urls` que não são array para `[]`; o fix usa `COALESCE(ARRAY(jsonb_array_elements_text(...)), '{}')`, que dá erro se vier um escalar. Contra o rollback: o rollback ainda grava `consumos_lote` e `saidas_sem_suprimento` a partir do cliente. |
| public.resolve_entrada_fornecedor | SÓ NO BANCO | — | Trigger que troca o id do fornecedor de `NEW.fornecedor` pelo nome. |
| public.saldo_deposito_insumo | SÓ NO BANCO | — | Saldo de material (entradas + transf. entrada − saídas − transf. saída, com `deletado_em is null`). |
| public.saldo_devedor_combustivel | ATRIB | 20260505070000 | Corpo e default `now()` iguais; a diferença é o search_path. |
| public.tg_saidas_combustivel_sync_medicao | ATRIB | 20260512130000 | Corpo igual; a diferença é o search_path. |
| public.tg_set_updated_at | SÓ NO BANCO | — | `NEW.updated_at := now()`. |

**Resumo**
- 11 IGUAL e 4 IGUAL\* (só comentários).
- 7 ATRIB (só o search_path `pg_catalog, public` é exclusivo do banco).
- 3 onde a viva é o fix e o último arquivo é rollback (`fn_stamp_transferencia_tipo_combustivel`, `fn_validate_transferencia_combustivel`, `fn_validate_saida_combustivel`).
- 8 DIFERENTE de verdade. Na lógica: `calcular_combustivel_tanque_na_data`, `calcular_estoque_combustivel_na_data`, `fn_saidas_combustivel_movimentos`, `fn_trigger_recalcular_nivel_esvazia`, `fn_trigger_recalcular_nivel_transferencia`, `recalcular_nivel_deposito` e `registrar_saida_combustivel_fifo`. Só no texto: `trg_lock_ciclo_transferencia`.
- 9 SÓ NO BANCO.
- 0 SÓ NO REPO.

Fora das migrations: `supabase/schema.sql` tem versões antigas de `recalcular_nivel_deposito` e `calcular_estoque_combustivel_na_data`, as duas diferentes da viva. `fix_tanque_posto_progresso.sql` e `rollback_tanque_posto_progresso.sql`, na raiz, têm `fn_saidas_combustivel_movimentos`, também diferente da viva.

## 2. Triggers

Tabelas: entradas_combustivel, saidas_combustivel, transferencias_combustivel, esvaziamentos_tanque, consumos_lote, depositos, saidas_sem_suprimento. Rodei os CREATE e DROP TRIGGER das migrations em ordem, sem os `*_rollback.sql`, e comparei com o `pg_get_triggerdef` vivo.

- Os triggers que existem nos dois lados são **iguais**. As únicas diferenças são cosméticas: a ordem dos eventos (`INSERT OR UPDATE OR DELETE` vira `INSERT OR DELETE OR UPDATE`) e os parênteses do WHEN em `trg_saidas_combustivel_sync_medicao_upd`.
- Se eu incluir os rollbacks, eles derrubariam `trg_fifo_recompute_*`, `trg_guard_saldo_*` e `trg_lock_ciclo_*`. Os 9 estão vivos, o que confirma que os rollbacks não foram aplicados.
- consumos_lote e saidas_sem_suprimento: nenhum trigger vivo nem no repo.
- **Triggers criados no repo que não existem vivos: nenhum.**
- **Triggers vivos sem CREATE TRIGGER no repo (11)**, confirmado por grep em todo o repo:

| tabela | trigger | definição viva |
|---|---|---|
| depositos | trg_audit_depositos | AFTER INSERT OR DELETE OR UPDATE, FOR EACH ROW, `audit_combustivel_log()` |
| depositos | trg_updated_at_depositos | BEFORE UPDATE, FOR EACH ROW, `tg_set_updated_at()` |
| entradas_combustivel | trg_audit_entradas | AFTER INSERT OR DELETE OR UPDATE, `audit_combustivel_log()` |
| entradas_combustivel | trg_resolve_entrada_fornecedor | BEFORE INSERT OR UPDATE OF fornecedor, `resolve_entrada_fornecedor()` |
| entradas_combustivel | trg_updated_at_entradas | BEFORE UPDATE, `tg_set_updated_at()` |
| entradas_combustivel | trg_validate_capacidade_entrada | BEFORE INSERT OR UPDATE, `fn_validate_capacidade_entrada()` |
| saidas_combustivel | trg_audit_saidas | AFTER INSERT OR DELETE OR UPDATE, `audit_combustivel_log()` |
| saidas_combustivel | trg_updated_at_saidas | BEFORE UPDATE, `tg_set_updated_at()` (a migration 20260523160000 só o cita num comentário) |
| transferencias_combustivel | trg_audit_transferencias | AFTER INSERT OR DELETE OR UPDATE, `audit_combustivel_log()` |
| transferencias_combustivel | trg_updated_at_transferencias | BEFORE UPDATE, `tg_set_updated_at()` |
| transferencias_combustivel | trg_validate_capacidade_transferencia | BEFORE INSERT OR UPDATE, `fn_validate_capacidade_transferencia()` |

Os 37 triggers vivos, todos habilitados (`O`), estão em `vivas/_triggers_vivos.sql`.

## 3. Arquivos salvos

Tudo em `/Users/tiagocameli/.claude/jobs/4af09bf6/tmp/`.

- **`vivas/<schema>.<nome>.sql`**: `pg_get_functiondef` completo de 31 funções, conferido por hash. São todas as DIFERENTE, SÓ NO BANCO, ATRIB e os casos de rollback, além de `private.inicio_ciclo_aberto`, `private.recompute_fifo_tanque`, `private.trg_lock_ciclo_saida` e `public.fn_validate_data_nao_futura_wc`, que são IGUAL\* e foram salvas porque o hash com comentários não bateu. As 11 IGUAL não foram salvas.
- **`vivas/_triggers_vivos.sql`**: os triggers vivos.
- **`repo/<schema>.<nome>.sql`**: a última definição do repo; `*.nonrollback.sql` é a última que não é rollback.
- **Scripts**: `extract.py`, `load.py`, `triggers.py`, `difffile.py` e `extra.py`.
