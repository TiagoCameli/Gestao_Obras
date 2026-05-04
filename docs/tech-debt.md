# Débito Técnico

Lista de itens conhecidos que não estão no escopo imediato mas precisam ser
endereçados em algum momento. Cada item referencia o turno/contexto onde
foi identificado.

---

## Standing rules da refatoração

Regras de processo cravadas durante a refatoração Frete + Combustível +
Conta Corrente das Transportadoras. **Aplicáveis indefinidamente** ao
projeto inteiro, não só ao escopo da refatoração.

1. **Renames/moves de arquivo no repo passam por `git mv`** (ou
   `git rm` + `git add` no novo nome se rename direto não couber). Sem
   `mv` cru. Origem: rename das 17 órfãs do passo (a) da Fase 1a usou `mv`
   cru e perdeu blob chain do git.

2. **Antes de qualquer `supabase migration repair --status reverted/applied`**,
   conferir o estado do registry pra aquele timestamp via
   `supabase migration list | grep <TS>`. Se houver mais de 1 linha pra
   versão, ou se a linha representar algo que NÃO queremos
   reverter/aplicar, abortar e replanejar. Origem: `repair --status reverted
   20260428000000` no passo (3) anterior atingiu também a entrada legítima
   do `_rename_amazonia_to_emt_transportes` que já estava applied.

3. **Antes de tornar campo obrigatório em tipo TS**, fazer grep amplo
   cobrindo (a) usos do hook que retorna o tipo, (b) construções literais
   do tipo (busca por `: TipoNome`, `as TipoNome`, `<TipoNome>`,
   `TipoNome[]`), (c) factories ou converters que produzem o tipo.
   Reportar todos antes de aplicar a mudança. Origem: tornar
   `Deposito.ehExterno` obrigatório quebrou TS em 4 call sites de
   construção literal que o grep original (só `useDepositos`) não pegou.

4. **Tipos de FK no schema EMT: tudo é `text`**, mesmo quando o valor
   parece UUID. Tabelas com `id text` (formato UUID armazenado como
   string): `obras`, `equipamentos`, `funcionarios`, `etapas_obra`,
   `fornecedores`, `depositos`, `fretes`, `pagamentos_frete`,
   `abastecimentos_carreta`, `abastecimentos`, `transportadora_movimentos`,
   `saidas_combustivel`, `insumos`. Antes de criar uma FK pra qualquer
   uma delas, **confirmar tipo via probe** (`POST` com `id="not_a_uuid"`
   — se aceitar sem cast error, é text; se rejeitar com type error, é
   uuid). Não assumir uuid pelo formato visual (`xxxxxxxx-xxxx-...`).
   Origem: `db push` da Fase 1c falhou em
   `transportadora_movimentos.obra_id uuid REFERENCES obras(id)` porque
   `obras.id` é text armazenando string em formato uuid.

5. **`LIKE` com prefix tem 2 modos de falhar.** Sempre prefira
   `IN (lista_explícita)` em filtros de tipos enumerados.
   (a) `_` no padrão é wildcard que casa caracteres não previstos.
       Exemplo: `conname LIKE 'saida_%'` casa com
       `'saidas_combustivel_origem_check'` (o `s` no meio de `saidas`
       casa com o wildcard `_`). Pra `_` literal, escape com `\_` e
       `ESCAPE '\\'`. Origem: validação inline da Fase 1c reportou
       `7 CHECKs encontrado 4 esperados` por casamento acidental.
   (b) `'prefix_%'` só casa tipos onde a categoria está no INÍCIO do
       nome — não funciona pra naming onde a categoria está no fim,
       tipo `ajuste_manual_credito` (categoria `credito` está no fim).
       Origem: view `transportadora_saldos` da Fase 1c usava
       `tipo LIKE 'credito_%'` e tratou `ajuste_manual_credito` como
       débito, causando saldo errado pra ETAM (-R$ 1,3M) e EMT
       TRANSPORTES (-R$ 14k) na primeira tentativa de backfill da Fase 2.
       Fix em `20260505075000_fix_view_transportadora_saldos.sql`.

6. **Trigger functions de auto-movimento (Fase 1c) não setam
   `created_by`.** Movimentos criados via app post-Fase 1c ficam com
   `created_by IS NULL`. Se um dia for útil distinguir "auto-trigger"
   de "manual via UI", modificar as 3 funções `fn_*_movimentos`
   (`fn_saidas_combustivel_movimentos`, `fn_fretes_movimentos`,
   `fn_pagamentos_frete_movimentos`) pra setar `created_by = 'auto_trigger'`
   ou similar. Não fazer agora — a seção 6 do backfill da Fase 2 já
   trata via `RAISE NOTICE` quando há movs sem marker; modelo atual é
   "OR NULL" pra app activity = aceitável.

7. **Precisão monetária no schema EMT.** Algumas tabelas
   (`abastecimentos_carreta.valor_total`) armazenam valores calculados
   com 4 decimais (litros × valor_unidade — ex: `85065.4014`). Pra
   preservar fidelidade na cadeia `transportadora_movimentos` /
   `saidas_combustivel`, ambas usam `numeric(14,4)` (decisão tomada na
   migration 080 após o backfill diff R$ 0,01-0,02 por
   redistribuição de truncamento). Display em UI deve rodar
   `Math.round(v × 100) / 100` ou equivalente. Cuidado ao adicionar
   tabelas novas que somem ou comparem esses valores — sempre
   `numeric(14,4)` na cadeia financeira; só arredonda no momento do
   display.

8. **Equipamento sentinel `'desconhecido'` (Fase 2/081).** 756
   abastecimentos legados não tinham `equipamento_id` (UI histórica
   não exigia, e a Fase 0 wipou todos os refs). Pra honrar a CHECK
   `saida_equipamento_exige_equipamento` no novo schema, criamos 1 row
   sentinel em `equipamentos` (`id='desconhecido'`, `nome='Equipamento
   Desconhecido'`, `tipo='Sentinel'`, `marca='Desconhecido'`,
   `modelo='Desconhecido'`, `ativo=false`, `status='fora_funcionamento'`)
   e backfilamos os 756 com esse id. Filtrar `equipamento_id <>
   'desconhecido'` em: queries de stats da Frota, relatórios de consumo
   por equipamento, dropdowns operacionais (já filtram via `ativo=true`
   por convenção). Investigar quando der: existe backup/audit log que
   permita atribuir os 756 ao equipamento real? Se sim, UPDATE pontual
   depois.

---

## Adicionar `created_at` / `updated_at` em fretes, pagamentos_frete, abastecimentos_carreta

**Identificado em:** Refatoração Frete + Combustível + Conta Corrente, Fase 1a
(turno onde tivemos que decodar o ID em base36 pra inferir hora de inserção
de 3 fretes com `transportadora_id IS NULL`).

**Contexto:** as 3 tabelas foram criadas antes do versionamento de migrations
e nunca ganharam colunas de auditoria temporal. A única coluna temporal hoje
é `data` (data semântica do evento, não da inserção — pode ser retroativa).

**Workaround atual:** o `id` é gerado client-side via
`Date.now().toString(36) + Math.random().toString(36).slice(2,7)`. Os 8
primeiros caracteres encodam `Date.now()` em base36 e podem ser decodados
pra inferir hora de inserção com precisão de segundo. Frágil — depende da
convenção de geração de ID se manter.

**Plano sugerido (quando entrar em escopo):**

1. Migration: `ALTER TABLE ... ADD COLUMN created_at timestamptz NOT NULL
   DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()`.
2. Backfill `created_at` decodando do ID:
   `UPDATE ... SET created_at = to_timestamp(('x' || lpad(substring(id, 1, 8), 16, '0'))::bit(64)::bigint::numeric / 1000)`.
3. Trigger `BEFORE UPDATE` pra manter `updated_at` atualizado.
4. Atualizar mappers TS e tipos.

**Não é bloqueante** pra refatoração atual — usar decode do ID resolve casos
pontuais. Mas vai voltar a morder em qualquer auditoria temporal séria.

---

## Badge "EXTERNO" no card do TanqueList

**Identificado em:** Refatoração Frete + Combustível, Fase 1b (planejamento).

**Contexto:** o depósito virtual `Transterra (Areacre)` (id `mori6yyt9owm9`)
aparece junto com os tanques internos no `TanqueList`. UX seria melhor com um
badge visual destacando que ele é controlado por terceiro.

**Plano sugerido:** adicionar pill âmbar "EXTERNO — Areacre" no card quando
`deposito.eh_externo = true`. Cosmético, não-bloqueante. Pode entrar junto
com a Fase 4 (telas novas).

---

## IDs canônicos de seed

IDs gerados client-side e hardcoded em migrations de seed. Referenciar daqui
pra evitar ambiguidade em migrations futuras / scripts de backfill.

| Constante | Valor | Origem | Significado |
|---|---|---|---|
| `DEPOSITO_VIRTUAL_TRANSTERRA_ID` | `mori6yyt9owm9` | Migration `20260505060000` | Depósito virtual Transterra (Areacre); `eh_externo=true`. Não tem estoque interno — só amarra movimentos pra conta-corrente da Areacre. |

---

## Filtro `eh_externo` na UI — manter consistência na Fase 4

**Identificado em:** Refatoração Frete + Combustível, commit de UI da Fase 1b
(filtros `eh_externo=false` aplicados nos forms operacionais via hook
`useDepositos()` default; views/lists/exports usam `useDepositos({ incluirExternos: true })`
ou wrapper `useTodosDepositos`).

**Contexto:** a regra de filtragem de depósitos externos vive HOJE no hook
`useDepositos`. Forms que CRIAM rows (entrada/saída/transferência) filtram
por default; views que EXIBEM rows usam todos.

**Risco na Fase 4:** quando o `SaidaCombustivelForm` novo colapsar
`AbastecimentoForm` (saída tanque) + `AbastecimentoCarretaForm` numa única
tela com toggle de tipo de consumidor, a regra precisa continuar:
- Tipo `equipamento_proprio` → só depósitos internos no select de tanque.
- Tipo `carreta_transportadora` → todos os depósitos (incluindo Transterra).

**Plano:** o novo form deve receber 2 listas (ou chamar `useDepositos({ incluirExternos: <depende do tipo> })` reativamente conforme o toggle).
Não duplicar a regra dentro do componente — manter no hook ou em um helper.

---

## `migrateToSupabase.ts` não popula campos novos de `Deposito`

**Identificado em:** Refatoração Frete + Combustível, commit de UI da Fase 1b
(grep ampliado de construções literais de Deposito).

**Contexto:** `src/utils/migrateToSupabase.ts:140` lê depósitos do localStorage
via `readLS<Deposito>(KEYS.depositos)` (cast TS, sem checagem de schema). O
mapper `depositoToDb` agora envia `transportadora_proprietaria_id`, `apelido`
e `eh_externo`. Quando o LS legado não tem esses campos, eles vão como
`undefined` → vira `NULL` no payload → DB usa `DEFAULT` da coluna
(`null/null/false` respectivamente).

**Comportamento atual:** funciona silenciosamente. Migrações de localStorage
gravam depósitos sempre como internos (`eh_externo=false`), o que é o caso
universal já que ninguém criou Transterra via app.

**Quando endereçar:** se algum dia houver necessidade de re-rodar este
script com dados que já tenham `eh_externo=true` no LS (improvável — Transterra
é seed via migration). Em caso de re-run, fazer schema validation antes do
batch upsert.
