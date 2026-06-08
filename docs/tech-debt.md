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

11. **Abatimento parcial de débito não suportado na V1 (Fase 4).**
    O `PagamentoAbatimentoCard` permite marcar débitos inteiros pra
    abater (checkbox por linha, FIFO sugerido), mas não permite abater
    uma fração de um débito (ex: pagar R$ 3k contra um débito de R$ 5k
    deixando R$ 2k pendente). O modelo atual usa só
    `transportadora_movimentos.abatido_em_pagamento_id` (FK), que é
    binário (abatido inteiro ou não-abatido). Se necessidade aparecer
    (débito muito grande > pagamento line item, ou usuário quer pagar
    parcial), criar coluna `valor_abatido numeric(14,4)` em
    `transportadora_movimentos` (default 0) e ajustar:
    - `saldo_devedor_combustivel(transportadora_id, ate_data)` SQL
      function — somar `(valor − coalesce(valor_abatido, 0))` em vez
      de excluir abatidos.
    - View `transportadora_saldos` — case quando valor_abatido > 0
      subtrai só (valor − valor_abatido).
    - `PagamentoAbatimentoCard` — input numérico ao lado do checkbox
      pra editar valor parcial; default = valor cheio do débito.
    - UPDATE no submit do PagamentoFreteForm — passa `valor_abatido`
      junto com `abatido_em_pagamento_id`.

12. **Tornar campo obrigatório em tipo TS cascata por TODOS os call
    sites de literal.** Quando adicionei `ehTransportadora` /
    `taxaLitroPadrao` / `ehDonaDeTanque` em `Fornecedor` (Fase 4 / Item 1)
    pra refletir colunas DB existentes, `tsc` quebrou em 5 sites de
    construção literal (EntradaForm, EntradaMaterialForm,
    fornecedores.config, Compras.tsx, Obras.tsx). Já tinha acontecido na
    Fase 1b com Deposito (3 campos novos → 4 sites literais). Padrão de
    fix sempre o mesmo: hardcode false/0/false em criação nova; preserva
    initial em edição. **Continuação da standing rule #3**: não basta
    fazer grep amplo antes — também planejar o esforço cascata. Vale
    checar TODOS os literais antes de subir o tipo, ou tornar campos
    opcionais (`?`) com default no mapper se a UI não souber preencher.

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

9. **Compat shim `useAbastecimentosCarreta` lança em `categoria='emt'`
   (Fase 3).** O INSERT/UPDATE via shim **não** suporta criar carreta
   no tanque EMT — porque o shape legado `AbastecimentoCarreta` não
   carrega `tanqueId` (precisa do usuário escolher), e o fluxo EMT já
   foi resolvido fora do shim (`AbastecimentoCarretaForm` chama
   `onSubmitEmt` que escreve direto via `useAdicionarSaidaCombustivel`).
   Se algum dia um caller novo tentar usar o shim com `categoria='emt'`,
   vai estourar a Error mensagem clara apontando o caminho correto.
   Quando a Fase 4 colapsar tudo no `SaidaCombustivelForm` novo, este
   shim pode ser removido junto.

10. **`useDesmarcarAbastecimentoPago` não limpa o sentinel `[pago por: X]`
    em `observacoes` (Fase 3).** O `useMarcarAbastecimentoPago` injeta
    `[pago por: X]` em `observacoes` quando `pagoPor` é passado (campo
    descartado do schema novo, preservado defensivamente). Mas o
    `useDesmarcarAbastecimentoPago` só zera `pago` e `pago_em` — deixa
    o sentinel pendurado nas observações. Aceitável por enquanto (texto
    livre, raro de marcar+desmarcar+reler), mas se incomodar visualmente,
    fazer o desmarcador tentar STRIP via regex `/\n?\[pago por: [^\]]+\]/`.
    Não fazer agora — escopo de Fase 4+ se virar dor.

13. **Backups DBA-only `abastecimentos_backup_20260505` e
    `abastecimentos_carreta_backup_20260505` (Fase 5).** Snapshot pré-DROP
    das tabelas legadas (756 + 167 rows). Sem RLS, REVOKE all em anon +
    authenticated → não aparecem em PostgREST. **Drop programado:
    2026-07-04** (60 dias após a Fase 5). Antes de dropar:
    confirmar que ninguém mais precisa dos dados (ex: investigação de
    auditoria). Recovery se preciso: copiar rows manualmente de volta
    pro schema novo (`saidas_combustivel` + `transportadora_movimentos`)
    — mappers da Fase 2 (`scripts/backfill_*` na época) servem de
    referência mas não rodam mais (tabelas originais foram dropadas).
    Migration de drop: criar
    `supabase/migrations/20260704000000_drop_legacy_backups.sql` com
    `DROP TABLE IF EXISTS public.abastecimentos_backup_20260505;` +
    `DROP TABLE IF EXISTS public.abastecimentos_carreta_backup_20260505;`
    e remover esta entrada do tech-debt.

14. **`Abastecimento` e `AbastecimentoCarreta` types vivem em
    `src/types/index.ts` mesmo sem tabela DB (Fase 5).** Após o DROP
    das tabelas legadas, mantemos os tipos TS porque ainda há 3 callers
    que constroem o shape pra exports:
    - `src/utils/pdfExport.ts::exportarSaidasPDF` (param `Abastecimento[]`)
    - `src/utils/excelExport.ts::exportarSaidasExcel` +
      `RelatorioCompletoCombustivelExcel` (param `Abastecimento[]`)
    - `src/components/frete/FreteDashboard.tsx` (adapter inline produzindo
      `AbastecimentoCarreta[]` pra cards de saldo legados)

    Os callers acima recebem o shape via adapters ad-hoc nos containers
    (`Dashboard.tsx`, `FrotaCombustivelContainer.tsx`, `Frete.tsx`) que
    convertem `SaidaCombustivel[]` (schema novo) → shape legado. Ideal:
    refatorar exports pra consumir `SaidaCombustivel[]` direto e deletar
    os 2 tipos. Não é bloqueante — adapters são localizados e o custo
    de manutenção é baixo.

15. **Nunca usar `sed -i ''` em arquivos do projeto — usar Edit tool.**
    Comandos `sed -i '' 's/.../.../g' arquivo.tsx` em arquivos com
    múltiplas linhas e regex multi-line podem **zerar o arquivo
    inteiro** se a substituição engatilhar greedy match. Origem:
    Commit 1 da Fase 5 usei `sed -i '' 's/onClick={() => goSaldo([^}]*)}/onClick={onVerContaCorrente}/g'`
    em `FreteDashboard.tsx` (1641 linhas) e o arquivo virou 0 bytes —
    teve que `git checkout HEAD --` e re-aplicar via Edit tool em 5
    chamadas individuais. Edit tool é atômico, mostra diff antes,
    falha de forma segura se old_string não bater. Sed em arquivos do
    repo só com extremo cuidado e backup prévio.

16. **Limite default de 1000 linhas do PostgREST/Supabase em qualquer
    `select` sem `.range()`.** Toda query que faz `supabase.from(x).select()`
    sem paginação volta no máximo 1000 linhas, SILENCIOSAMENTE (sem erro).
    Se o resultado alimenta um agregado client-side (soma, contagem, custo
    por X), o número fica subcontado assim que a tabela passa de 1000 linhas,
    e ninguém percebe porque não quebra. Origem: cards SALDOS do FreteDashboard
    somavam todos os `transportadora_movimentos` no cliente; ao passar de 1000
    movimentos no total (1074), Areacre e EMT apareceram com saldo errado
    (Areacre R$ 345.310,79 em vez de R$ 801.922,33) enquanto a Conta Corrente
    (lê a view agregada `transportadora_saldos`, soma no banco) seguia certa.
    Fix em `da5e5be` (cards passam a ler a view) e na paginação de
    `useSaidasCombustivel` (já tinha 1392 saídas, capava em 1000).
    **Regra:** pra agregados, preferir SEMPRE somar no banco (view/RPC) em vez
    de puxar todas as linhas pro cliente. Quando precisar mesmo da lista
    inteira, paginar com loop `.range(from, from+999)` + `.order` por coluna
    ÚNICA (id) de tiebreaker, até o lote vir < 1000.
    **Watch list** (tabelas crescendo, ainda < 1000 mas mesmo risco quando
    passarem): `fretes` (439), `pagamentos_frete` (80), e
    `transportadora_movimentos` por transportadora (Areacre já em 650). Auditar
    os hooks `useFretes` / `usePagamentosFrete` antes de virarem o próximo
    345.310,79.

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

## ~~`migrateToSupabase.ts` não popula campos novos de `Deposito`~~ (RESOLVIDO Fase 5)

**Resolvido em:** Commit 5 da Fase 5 (`6dd3c1c`) — script
`src/utils/migrateToSupabase.ts` e a página `src/pages/MigrarDados.tsx` foram
deletados. O script era one-shot pra migração inicial do localStorage pro
Supabase e já tinha cumprido seu papel. Sem callers ativos hoje. Se algum dia
precisar re-importar dados de LS legado, escrever script novo com schema
validation desde o início (sem reaproveitar a estrutura antiga).
