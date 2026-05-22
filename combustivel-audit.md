# Auditoria — Módulo Combustível

**Projeto:** Gestao_Obras (`emtconstrutora.com`)
**Data:** 2026-05-21
**Escopo:** Análise read-only do módulo de combustível (entrada / saída / transferência / tanques / relatórios). Nenhum código modificado.
**Método:** Mapeamento → 3 fluxos → rastreamento de custos → cálculo → UI/UX → segurança → recomendações priorizadas.

---

## Sumário Executivo

O módulo combustível é o mais maduro do app em termos de UI analítica (KPIs, charts, anomalias) mas apresenta **falhas operacionais e financeiras críticas** principalmente no fluxo mobile (saída via QR) e no método de custeio (média ponderada vitalícia, sem corte temporal, ignora transferências). Há também **issues de segurança documentados**: `esvaziamentos_tanque` sem RLS, funções `SECURITY DEFINER` sem `search_path`, bucket de storage sem limites, e políticas blanket que permitem operadores fazer `DELETE`/`UPDATE` direto via PostgREST burlando soft-delete.

Os 3 piores problemas:

1. **Mobile insere saídas com `valor_total = 0`** e `tipo_consumidor` com valor inválido (`'equipamento'` em vez de `'equipamento_proprio'`) → registros financeiros zerados e provável falha de CHECK constraint silenciando o insert
2. **`recalcular_nivel_deposito` e `calcular_estoque_combustivel_na_data` não filtram `deleted_at IS NULL`** → soft-deletes de transferências/entradas não corrigem o saldo do tanque → custo e nível ficam errados
3. **Preço médio do tanque é vitalício** (ignora data) e **transferências não entram no cálculo** → tanques que só recebem por transferência têm `precoMedio = 0` e bloqueiam saídas; tanques com histórico longo subestimam o custo corrente

---

## Fase 1 — Mapeamento

### 1.1 Estrutura de Arquivos

**Total: ~145 arquivos** distribuídos em camadas. Estrutura compacta abaixo (cada bullet: caminho relativo a `src/`, LOC aproximado, função em 1 frase).

#### Páginas / rotas
- `pages/Combustivel.tsx` (14 LOC) — Wrapper que renderiza `FrotaCombustivelContainer`
- `pages/Depositos.tsx` (472) — Página de depósitos (materiais + combustível)
- `pages/mobile/MSaidaCombustivelPage.tsx` (327) — Saída mobile via QR scan do equipamento

#### Componentes UI — core v1 (formulários e listas operacionais)
- `components/combustivel/SaidaCombustivelForm.tsx` (1028) — Form unificado de saída (2 tipos consumidor × 3 origens)
- `components/combustivel/EntradaForm.tsx` (552) — Form de entrada com import Excel
- `components/combustivel/TransferenciaForm.tsx` (445) — Form de transferência entre tanques
- `components/combustivel/SaidaCombustivelList.tsx` (187), `EntradaList.tsx` (148), `TransferenciaList.tsx` (124) — Listas operacionais com tabela map() inline
- `components/combustivel/CombustivelDashboard.tsx` (749) — Dashboard analytics v1 (legado)
- `components/combustivel/SaidaDetalhesDrawer.tsx` (411), `EntradaDetalhesDrawer.tsx` (264), `TransferenciaDetalhesDrawer.tsx` (229) — Drawers de detalhe
- `components/combustivel/ExportarPDFModal.tsx` (367) — Export PDF/Excel
- `components/combustivel/HistoricoTimeline.tsx` (220) — Timeline de transações
- `components/combustivel/AbastecimentoFilters.tsx` (67), `AnexosUploader.tsx` (517), `AnexosBadge.tsx` (36), `FotoCaptureUploader.tsx` (356)

#### Componentes UI — v2 (analytics, anomalias, relatórios)
- `components/combustivel/v2/CombustivelTabsNav.tsx` (186) — Nav com 11 abas
- `components/combustivel/v2/ModeSwitch.tsx` (51) — Toggle Próprios/Carretas
- `components/combustivel/v2/filters/*` (12 arquivos, ~1700 LOC) — FilterBar avançado, presets, saved views, URL state
- `components/combustivel/v2/visao-geral/*` (12 arquivos, ~2400 LOC) — KPIs, 8 charts, recent table
- `components/combustivel/v2/anomalias/*` (4 arquivos, ~1300 LOC) — Detecção (5 detectores D1-D5), drawer forense
- `components/combustivel/v2/consumidores/*` (3 arquivos, ~600 LOC) — Rankings por equipamento/carreta
- `components/combustivel/v2/fornecedores/*` (3 arquivos, ~400 LOC) — Analytics por fornecedor
- `components/combustivel/v2/obras/*` (3 arquivos, ~440 LOC) — Analytics por obra
- `components/combustivel/v2/lixeira/LixeiraTab.tsx` (307) — Soft-delete management
- `components/combustivel/v2/relatorios/*` (16 arquivos, ~3700 LOC) — 4 modais de relatório + utils de export PDF/Excel
- `components/combustivel/v2/atribuicao/AtribuirSentinelModal.tsx` (415) — Atribui saídas "sentinel" a equipamentos
- `components/combustivel/v2/shared/*` (8 arquivos) — chartTheme, stats, formatters, error states

#### Componentes UI — frota/combustivel (gestão de tanques)
- `components/frota/combustivel/FrotaCombustivelContainer.tsx` (962) — Container orquestrador com 11 sub-abas
- `components/frota/combustivel/TanqueList.tsx` (227), `TanqueDetalhesDrawer.tsx` (223), `TanqueVisual.tsx` (197), `TanqueForm.tsx` (112)
- `components/frota/combustivel/EsvaziarTanqueModal.tsx` (105)

#### Componentes UI — depósitos (material, não-combustível mas relacionado)
- `components/depositos/DepositoCard.tsx` (188), `DepositoDetalheModal.tsx` (552), `BadgeTipoDeposito.tsx` (25), `SaidaMaterialForm.tsx` (480), `EntradaMaterialForm.tsx` (297), `TransferenciaMaterialForm.tsx` (291), `DepositoMaterialForm.tsx` (265), `LixeiraDepositos.tsx` (290)

#### Hooks
- `hooks/useSaidasCombustivel.ts` (188), `useEntradasCombustivel.ts` (112), `useTransferenciasCombustivel.ts` (97)
- `hooks/useEsvaziamentosTanque.ts` (71), `useSaldoDevedorCombustivel.ts` (33)
- `hooks/useDepositos.ts` (130), `useDepositosMaterial.ts` (48), `useDepositosObras.ts` (153), `useDepositosLixeira.ts` (128)

#### Utils / libs / types
- `lib/mappers.ts` (2062, parcial: mappers de combustível) — db ↔ TS interface conversions
- `utils/pdfExport.ts`, `utils/excelExport.ts`, `utils/extratoExport.ts`
- `types/index.ts` (parcial) — `Deposito`, `EntradaCombustivel`, `SaidaCombustivel`, `TransferenciaCombustivel`, `EsvaziamentoTanque`, `OrigemCombustivel`, `FiltrosAbastecimento`

#### Outras referências (importam combustível indiretamente)
- `pages/Dashboard.tsx` → `components/dashboard/ResumoCombustivel.tsx`
- `pages/Frete.tsx`, `components/frete/extrato/ExtratoAbastecimentosList.tsx` — abastecimentos da transportadora
- `App.tsx`, `Header.tsx`, `pages/mobile/MEquipamentoHubPage.tsx`
- `modules/cadastros/configs/tanques.config.tsx`, `depositosMaterial.config.tsx`

---

### 1.2 Estrutura do Banco

> Detalhamento via Supabase MCP. Projeto `gunyitwrbxbmnezokgjq`, Postgres 17.6.

#### Tabela: `depositos`
Tanques de combustível (internos e externos). Serve como "conta corrente" de litros via `nivel_atual_litros` mantido por triggers.

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| `id` | text | NO | — |
| `nome` | text | NO | — |
| `capacidade_litros` | numeric | NO | `0` |
| `nivel_atual_litros` | numeric | NO | `0` |
| `ativo` | boolean | NO | `true` |
| `transportadora_proprietaria_id` | text | YES | — |
| `apelido` | text | YES | — |
| `eh_externo` | boolean | NO | `false` |
| `combustivel_atual_id` | text | YES | — |
| `foto_urls`, `arquivo_urls` | text[] | YES | `'{}'` |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | — | — |

**FK:** `combustivel_atual_id → insumos(id)`, `transportadora_proprietaria_id → fornecedores(id)`
**RLS:** ENABLED · Policy "Authenticated full access" (FOR ALL, role authenticated, qual=true)
**Triggers:** `trg_audit_depositos` (audit_combustivel_log), `trg_updated_at_depositos` (tg_set_updated_at)

#### Tabela: `entradas_combustivel`
Recebimento de combustível do fornecedor (compra/abastecimento do tanque).

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| `id` | text | NO | — |
| `data_hora` | **text** | NO | — (⚠️ não é timestamptz) |
| `deposito_id` | text | NO | — |
| `tipo_combustivel` | text | NO | `''` (FK soft `insumos.id`) |
| `quantidade_litros` | numeric | NO | `0` |
| `valor_total` | numeric | NO | `0` |
| `fornecedor` | text | NO | `''` (FK soft `fornecedores.id`) |
| `nota_fiscal`, `observacoes`, `criado_por` | text | NO | `''` |
| `foto_urls`, `arquivo_urls` | text[] | YES | `'{}'` |
| `deleted_at`, `deleted_by` | — | YES | — |

**FK:** `deposito_id → depositos(id)` ON DELETE CASCADE
**RLS:** ENABLED · Authenticated full access
**Triggers (em ordem de execução):**
1. `trg_entradas_combustivel_block_externo` BEFORE INSERT/UPDATE — rejeita se depósito `eh_externo=true`
2. `trg_validate_entrada_combustivel` BEFORE — bloqueia mistura de combustível
3. `trg_resolve_entrada_fornecedor` BEFORE — resolve fornecedor
4. `trg_entrada_combustivel_nivel` AFTER (LEGACY, SECURITY DEFINER) — chama `trigger_entrada_combustivel_nivel()`
5. `trg_entradas_combustivel_recalc_nivel` AFTER (NOVO) — chama `fn_trigger_recalcular_nivel_entrada()`
6. `trg_audit_entradas` AFTER — audit_combustivel_log
7. `trg_updated_at_entradas` BEFORE UPDATE

> **⚠️ Duplo trigger de nível:** Tanto o legacy (SECURITY DEFINER) quanto o novo coexistem. Cada operação chama `recalcular_nivel_deposito()` 2×.

#### Tabela: `saidas_combustivel`
Consumo de combustível por equipamento, carreta de transportadora, etc.

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| `id` | text | NO | — |
| `data` | timestamptz | NO | — |
| `origem` | text | NO | — (enum: `'tanque'\|'dinheiro'\|'requisicao'`) |
| `tipo_consumidor` | text | NO | — (enum: `'equipamento_proprio'\|'carreta_transportadora'`) |
| `tanque_id` | text | YES | — (FK depositos) |
| `equipamento_id`, `transportadora_id` | text | YES | — |
| `obra_id`, `etapa_id` | text | YES | — |
| `alocacoes` | jsonb | YES | — |
| `tipo_combustivel` | text | NO | — |
| `litros` | numeric(12,3) | NO | — |
| `preco_medio_tanque_snapshot` | numeric(12,4) | YES | — |
| `taxa_litro` | numeric(10,4) | NO | `0` |
| `preco_unitario` | numeric(12,4) | NO | — |
| `preco_combustivel`, `preco_combustivel_areacre` | numeric(14,4) | YES | — |
| `valor_total` | numeric(14,4) | NO | — |
| `movimento_id` | text | YES | — (FK transportadora_movimentos) |
| `medicao_no_abastecimento` | numeric | YES | — |
| `tipo_medicao_snapshot` | text | YES | — |
| `foto_urls`, `arquivo_urls` | text[] | YES | — |
| `motorista` | text | NO | `''` |
| `pago`, `pago_em` | bool/timestamptz | YES | — |

**FK:** múltiplas (tanque_id, equipamento_id, transportadora_id, obra_id, etapa_id, movimento_id)
**RLS:** ENABLED · Authenticated full access
**Triggers:**
1. `trg_saidas_combustivel_recalc_nivel` AFTER — recalcula nível do tanque
2. `trg_saidas_combustivel_movimentos` AFTER — cria entry em `transportadora_movimentos` quando `tipo_consumidor='carreta_transportadora'`
3. `trg_saidas_combustivel_sync_medicao_ins/upd` AFTER INSERT/UPDATE — upsert em `medicoes_equipamento`
4. `trg_audit_saidas` AFTER — audit
5. **Dois triggers de `updated_at`** (`trg_saidas_combustivel_set_updated_at` e `trg_updated_at_saidas`) — redundante

#### Tabela: `transferencias_combustivel`
Movimentação entre depósitos (apenas internos; externos bloqueados).

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| `id` | text | NO | — |
| `data_hora` | **text** | NO | — |
| `deposito_origem_id`, `deposito_destino_id` | text | NO | — |
| `quantidade_litros`, `valor_total` | numeric | NO | `0` |
| `observacoes`, `criado_por` | text | NO | `''` |
| `foto_urls`, `arquivo_urls` | text[] | YES | `'{}'` |
| `deleted_at`, `deleted_by` | — | YES | — |

**Triggers:** mesmo padrão de `entradas_combustivel` — **duplo trigger de nível ativo** (legacy SECURITY DEFINER + novo).

#### Tabela: `esvaziamentos_tanque`
Descarte intencional (resetar tipo de combustível do tanque).

| Coluna | Tipo | Nullable |
|---|---|---|
| `id`, `deposito_id`, `motivo`, `criado_por` | text | NO |
| `data_hora` | timestamptz | NO |
| `litros_descartados` | numeric | NO |

**⚠️ RLS:** **NÃO HABILITADO!** Tabela criada em `20260513000000` sem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Acessível diretamente via PostgREST por qualquer caller autenticado.

#### Tabela: `transportadora_movimentos`
Livro razão financeiro de transportadoras (créditos/débitos de frete e abastecimento).

| Coluna | Tipo | Nullable |
|---|---|---|
| `id`, `transportadora_id`, `tipo`, `origem_tabela`, `origem_id` | text | NO |
| `data` | timestamptz | NO |
| `valor` | numeric(14,4) | NO |
| `obra_id`, `mes_referencia`, `abatido_em_pagamento_id` | — | YES |

**RLS:** ENABLED · Authenticated full access (mesma policy blanket)

#### Views

| View | security_invoker | Tabelas expostas |
|---|---|---|
| `transportadora_movimentos_detalhe` | ✅ (após bloco4 housekeeping) | fretes, saidas_combustivel, pagamentos_frete |
| `transportadora_saldos` | ✅ (após bloco4) | fornecedores, transportadora_movimentos |
| `vw_saldos_deposito` | (não fuel-specific) | depositos_material |

> Risco residual: ambas as views foram criadas/recriadas com `CREATE OR REPLACE VIEW` **sem** `security_invoker` na declaração. A migration `bloco4_db_housekeeping` corrigiu via `ALTER VIEW`, mas qualquer nova `CREATE OR REPLACE` que esqueça a flag silenciosamente reverterá.

#### Funções/RPCs

| Função | SECURITY | search_path fixo |
|---|---|---|
| `recalcular_nivel_deposito` | DEFINER | ❌ — risco de schema shadowing |
| `calcular_estoque_combustivel_na_data` | DEFINER | ❌ |
| `trigger_entrada_combustivel_nivel` (legacy) | DEFINER | ❌ |
| `trigger_transferencia_combustivel_nivel` (legacy) | DEFINER | ❌ |
| `fn_trigger_recalcular_nivel_entrada/saida/transferencia/esvazia` | INVOKER | N/A |
| `fn_validate_entrada_combustivel` | INVOKER | N/A |
| `fn_validate_transferencia_combustivel` | INVOKER | N/A |
| `fn_block_entrada_em_deposito_externo` | INVOKER | N/A |
| `fn_block_transferencia_envolvendo_externo` | INVOKER | N/A |
| `fn_saidas_combustivel_movimentos` | INVOKER | N/A |
| `audit_combustivel_log` | INVOKER | N/A |
| `saldo_devedor_combustivel` | STABLE | N/A |
| `tg_saidas_combustivel_sync_medicao` | INVOKER | N/A |

#### Storage Buckets

| Bucket | Visibilidade | size_limit | mime_types |
|---|---|---|---|
| `abastecimento-fotos` | privado | **NULL** | **NULL** |

**Policies:** SELECT/INSERT/DELETE para authenticated. **Não há policy UPDATE** → upsert falha silenciosamente. **Sem limites de tamanho ou MIME no servidor** → validação só client-side.

---

### 1.3 Estrutura de Telas/Rotas

| Rota | Componente | Layout | Permissão | Função |
|---|---|---|---|---|
| `/combustivel` | `Combustivel` → `FrotaCombustivelContainer` | Desktop | `ver_frota` | Hub de combustível com 11 abas operacionais e analíticas |
| `/combustivel` (aba `visao_geral`) | `VisaoGeralTab` | Desktop | `aba_combustivel_visao_geral` | KPIs + 8 charts + tabela de últimos abastecimentos |
| `/combustivel` (aba `saidas`) | `SaidaCombustivelList` + `SaidaCombustivelForm` | Desktop | `aba_combustivel_saidas` + `criar_saida_combustivel` | Lista operacional de saídas com CRUD e atribuição de sentinel |
| `/combustivel` (aba `entradas`) | `EntradaList` + `EntradaForm` | Desktop | `aba_combustivel_entradas` + `criar_entrada_combustivel` | Lista de abastecimentos com import batch Excel |
| `/combustivel` (aba `transferencias`) | `TransferenciaList` + `TransferenciaForm` | Desktop | `aba_combustivel_transferencias` + `criar_transferencia_combustivel` | Lista de transferências entre tanques |
| `/combustivel` (aba `tanques`) | `TanqueList` + `TanqueForm` | Desktop | `aba_combustivel_tanques` + `editar_combustivel` | Cadastro e gestão de tanques |
| `/combustivel` (aba `consumidores`) | `ConsumidoresTab` | Desktop | `aba_combustivel_consumidores` | Análise por equipamento ou carreta |
| `/combustivel` (aba `obras`) | `ObrasTab` | Desktop | `aba_combustivel_obras` | Distribuição de combustível por obra |
| `/combustivel` (aba `fornecedores`) | `FornecedoresTab` | Desktop | `aba_combustivel_fornecedores` | Análise de compras por fornecedor |
| `/combustivel` (aba `anomalias`) | `AnomaliasTab` | Desktop | `aba_combustivel_anomalias` | Detecção D1-D5 + atribuição |
| `/combustivel` (aba `relatorios`) | `RelatoriosTab` | Desktop | `aba_combustivel_relatorios` | 4 relatórios (Mensal Consolidado, Por Equipamento, Por Obra, Raw Export) |
| `/combustivel` (aba `lixeira`) | `LixeiraTab` | Desktop | `aba_combustivel_lixeira` (admin) | Restaurar/purgar soft-deletes |
| `/m/saida-combustivel/:equipamentoId` | `MSaidaCombustivelPage` | Mobile | `ver_frota` | Saída via QR scan (campos reduzidos) |

> **Observação:** Sub-abas não persistem na URL — recarregamento volta sempre pra `visao_geral`. Limitação reconhecida no código (`SubTab fora da URL hoje — limitação atual; F2.X depois`).

---

## Fase 2 — Auditoria dos 3 Fluxos

### 2.1 ENTRADA de Combustível

**Trigger:** `/combustivel` aba **Entradas** → botão "+ Nova Entrada" (`FrotaCombustivelContainer.tsx:524-530`). Edit requer `editar_combustivel` + `pedirSenha()`.

**Dados capturados** (`EntradaForm.tsx`):

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `dataHora` | datetime-local | Sim | Apenas presença |
| `depositoId` | select | Sim | Filtro `ativo !== false`; externos excluídos |
| `tipoCombustivel` | select | Sim | Pre-check inline de mistura |
| `quantidadeLitros` | number step=0.0001 | Sim | min=0 (aceita string "0" — bug!) |
| `valorUnitario` | number | Sim | `> 0` (valorTotal calculado client) |
| `fornecedor` | select | Sim | Filtro `ativo !== false` |
| `notaFiscal` | text | Não | — |
| `observacoes` | textarea | Não | — |
| Anexos | AnexosUploader | Não | 8 fotos + 8 arquivos, 10MB each |

**Servidor:**
- `useAdicionarEntradaCombustivel` (`useEntradasCombustivel.ts:22-34`) → `supabase.from('entradas_combustivel').insert(entradaCombustivelToDb(...))` → invalida `['entradas_combustivel']` + `['depositos']`
- Triggers em ordem: `fn_block_entrada_em_deposito_externo` → `fn_validate_entrada_combustivel` → `resolve_entrada_fornecedor` → **dois triggers de nível** (legacy SECURITY DEFINER + novo) → audit → updated_at

**Persistência:** Tabela `entradas_combustivel`. Trigger atualiza `depositos.nivel_atual_litros` e `combustivel_atual_id` via `recalcular_nivel_deposito()`. Storage: `abastecimento-fotos/entrada/<pastaId>/`.

**Edge cases NÃO tratados:**
- ❌ **Quantidade = 0**: `isValid` (`EntradaForm.tsx:242`) testa `quantidadeLitros` (string "0" é truthy). Submete entrada com 0L sem erro.
- ❌ **Valor = 0 via Excel import**: `parseRow` valida presença mas não exige `> 0`. Linha com "0" passa.
- ❌ **Data futura**: nenhuma validação. `data_hora` é text no DB, sem constraint.
- ✅ Mistura combustível: trigger DB protege.
- ⚠️ **Edição alterando litros após uso**: recalcula nível mas se entrada era 1000L, saídas usaram 900L, e edição reduz pra 500L → nível negativo silenciado por `GREATEST(nivel, 0)`. Contabilidade fica errada.
- ❌ **Concurrent edits**: sem locking. Last-write-wins.
- ❌ **URLs assinadas com TTL 1h** salvas no DB → após 1h ficam quebradas (`<img src=expirada>`). `dbToEntradaCombustivel` lê `row.foto_urls` direto sem revalidar.

**Bugs identificados:**

| # | Arquivo:linha | Severidade | Bug |
|---|---|---|---|
| E1 | `EntradaForm.tsx:242` | **ALTA** | `isValid` não verifica `qtdLitros > 0`. Pode inserir entrada com 0 litros |
| E2 | `AnexosUploader.tsx:249-255` | MÉDIA | Upload de fotos antes do submit. Se INSERT falhar, arquivos ficam órfãos no bucket (sem cleanup) |
| E3 | `AnexosUploader.tsx:251` | MÉDIA | Signed URLs TTL 1h salvas no DB; imagens quebram após 1h |
| E4 | `EntradaForm.tsx:361,461` | MÉDIA | Criação inline de insumo/fornecedor com `mutate()` fire-and-forget. Se a sub-mutation falhar, INSERT principal falha por FK violation com mensagem confusa |
| E5 | schema vs migration | ALTA (latente) | Trigger legacy `trg_entrada_combustivel_nivel` (SECURITY DEFINER) **nunca foi dropado** pelas migrations; coexiste com `trg_entradas_combustivel_recalc_nivel` → `recalcular_nivel_deposito` roda 2× por operação |
| E6 | `useEntradasCombustivel.ts:39-44` | BAIXA | UPDATE não filtra `deleted_at IS NULL` → poderia reanimar soft-delete (improvável com IDs únicos) |
| E7 | `EntradaForm.tsx:80-84` | BAIXA | `valorUnitario` recalculado retroativamente como `valorTotal/qtd` na edição. Floating point pode desviar do original |

---

### 2.2 SAÍDA de Combustível

> Dois pontos de entrada: **desktop** (form completo) e **mobile** (QR scan, simplificado). Ambos escrevem em `saidas_combustivel`.

#### Desktop (`SaidaCombustivelForm.tsx`)

**Trigger:** Aba **Saídas** → botão "Nova Saída". Edição requer `editar_combustivel` + senha.

**Campos** (campos chave; ~15 inputs condicionais):

| Campo | Obrigatório | Notas |
|---|---|---|
| Data e Hora | sim | datetime-local |
| Obra | sim | — |
| Tipo Combustível | sim | — |
| Litros | sim | `> 0` |
| Preço Unitário | sim | calculado se origem=tanque, manual caso contrário |
| Equipamento | sim (se equipamento_proprio) | FilterCombobox com busca |
| Transportadora | sim (se carreta) | + Placa + Motorista |
| Tanque | sim (se origem=tanque) | filtra externos por tipoConsumidor |
| Etapa | não | opcional |
| Medição (horímetro/odômetro) | não | alerta se decrescente, **não bloqueia** |
| Pago / Pago em | sim (se origem=requisicao) | bloco financeiro |
| Anexos | não | AnexosUploader |

**Tipos de consumidor:** `equipamento_proprio` (UI mostra Equipamento + Medição), `carreta_transportadora` (UI mostra Transportadora + Placa + Motorista + Preço Areacre).

**Tipos de origem:** `tanque` (preço calculado), `dinheiro` (preço manual), `requisicao` (preço manual + bloco pago).

**Lógica condicional sofisticada:**
- Preço médio do tanque calculado client-side via `entradasCombustivel.filter(e => e.depositoId === tanqueId)` — **média ponderada global, sem corte temporal** (`SaidaCombustivelForm.tsx:247-254`)
- Para carreta + tanque externo: campos `precoCombustivel` + `precoCombustivelAreacre` + cálculo de margem EMT
- Sanity warnings (não bloqueantes) para >= 1000L ou >= R$10k

#### Mobile (`MSaidaCombustivelPage.tsx`)

**Trigger:** Rota `/m/saida-combustivel/:equipamentoId` via menu do equipamento ou QR scan.

**Campos:**

| Campo | Obrigatório |
|---|---|
| Tanque de origem | sim |
| **Obra** | sim (alterado recentemente) |
| **Etapa** | sim (alterado recentemente) |
| Litros | sim (`> 0`) |
| Leitura horímetro/odômetro | não |
| Fotos (até 8) | não |
| Observações | não |

**Insert direto no Supabase** (linha 116, **não via hook**) → cache desktop fica stale.

#### Servidor

- Hook `useAdicionarSaidaCombustivel` invalida 5 query keys (`saidas_combustivel`, `transportadora_movimentos`, `transportadora_saldos`, `abastecimentos`, `abastecimentos_carreta`)
- Triggers em ordem: `set_updated_at` → `fn_trigger_recalcular_nivel_saida` → `fn_saidas_combustivel_movimentos` (só para carreta) → `tg_saidas_combustivel_sync_medicao` (se medição) → audit

#### Persistência

- `saidas_combustivel` (todos os campos)
- `transportadora_movimentos` (só para `carreta_transportadora`) — trigger cria 1 ou 2 entradas conforme tanque tem `transportadora_proprietaria_id`
- `medicoes_equipamento` (upsert via trigger se `medicao_no_abastecimento` preenchido) — id determinístico `'med-abast-' || saida.id`
- `depositos.nivel_atual_litros` recalculado

#### Edge cases NÃO tratados

- ❌ **Litros = 0 mobile**: `litrosNum > 0` mas aceita 0.001
- ❌ **Estoque insuficiente**: nenhum check client nem trigger. Nível fica negativo
- ❌ **Equipamento/obra/etapa inativa**: sem filtro de status em listas
- ❌ **Data futura**: sem validação
- ⚠️ **Medição decrescente**: desktop alerta mas não bloqueia; mobile sem alerta
- ❌ **Mobile sem internet**: não suportado (TODO no código)
- ❌ **Mobile `tipo_combustivel: 'diesel'` hardcoded**: ignora combustível do tanque

#### Bugs CRÍTICOS no mobile

| # | Arquivo:linha | Severidade | Bug |
|---|---|---|---|
| **S1** | `MSaidaCombustivelPage.tsx:120` | **ALTA** | `tipo_consumidor: 'equipamento'` (deveria ser `'equipamento_proprio'`). **Viola CHECK constraint** → INSERT falha silenciosamente |
| **S2** | `MSaidaCombustivelPage.tsx:110-112` | **ALTA** | `preco_unitario: 0` + `valor_total: 0` hardcoded → todo insert mobile contabilizado como R$0,00 |
| **S3** | `MSaidaCombustivelPage.tsx:128` | **ALTA** | `tipo_combustivel: 'diesel'` (string, não UUID FK) → quebra exibição na lista desktop (`combustMap.get('diesel')` retorna undefined) |
| S4 | `MSaidaCombustivelPage.tsx:131` | MÉDIA | `preco_medio_tanque_snapshot: null` → perda de rastreabilidade financeira |
| S5 | `MSaidaCombustivelPage.tsx:116` | MÉDIA | Insert direto bypassa hook → React Query cache fica stale |
| S6 | `MSaidaCombustivelPage.tsx:127` | MÉDIA | `alocacoes: []` (vazio mesmo com `etapa_id` preenchido). Desktop envia `[{etapaId, percentual:100}]` |
| S7 | `MSaidaCombustivelPage.tsx:265-280` | MÉDIA | Medição decrescente não bloqueada → pode corromper último valor em `medicoes_equipamento` |
| S8 | `MSaidaCombustivelPage.tsx:158` | BAIXA | Sem aviso se `equipamento.tipoMedicao = null` → default `'km'` aplicado silenciosamente |

#### Discrepâncias desktop ↔ mobile

| Aspecto | Desktop | Mobile |
|---|---|---|
| Caminho de escrita | Hook + mapper | Insert direto |
| Cache invalidado | 5 query keys | **Não** |
| `tipo_consumidor` | `'equipamento_proprio'` ✅ | `'equipamento'` ❌ |
| `tipo_combustivel` | UUID FK ✅ | `'diesel'` string ❌ |
| `preco_unitario` | Calculado ✅ | `0` ❌ |
| `valor_total` | `litros × preco` ✅ | `0` ❌ |
| `preco_medio_tanque_snapshot` | Persistido ✅ | `null` ❌ |
| `alocacoes` | `[{etapa, 100%}]` ✅ | `[]` ❌ |
| Tanques externos | Filtrados ✅ | Todos ativos |
| Medição decrescente | Alerta visual | Sem alerta |
| Suporte offline | N/A | **Não** |

> **Resumo crítico:** O mobile efetivamente registra "saídas fantasma" — sem valor financeiro, com enum inválido (provavelmente nem persiste por CHECK violation), e com cache stale. **Esses bugs devem ser corrigidos URGENTE.**

---

### 2.3 TRANSFERÊNCIA de Combustível

**Trigger:** Aba **Transferências** → botão "+ Nova Transferência". Também tem import Excel.

**Dados capturados** (`TransferenciaForm.tsx`):

| Campo | Tipo | Validação |
|---|---|---|
| `dataHora` | datetime-local | Required |
| `depositoOrigemId` | select | Required; filtra `ativo !== false` |
| `depositoDestinoId` | select | Required; exclui origem |
| `quantidadeLitros` | number step=0.0001 | `> 0`, `≤ estoqueOrigem`, `≤ espaçoDestino` |
| `valorTotal` | number | Opcional; auto-calculado `qtd × precoMedio` |
| `observacoes` | textarea | — |
| Anexos | AnexosUploader | — |

**Snapshot de preço:** `precoMedio = ΣvalorTotal_entradas_origem / Σlitros_entradas_origem` — **média ponderada GLOBAL** (sem data, ignora transferências recebidas). Esse valor é só sugestão; usuário pode editar. **No DB só fica `valor_total` — sem snapshot de R$/L da origem.**

**Servidor:**
- Hook `useAdicionarTransferenciaCombustivel` → INSERT direto → invalida `['transferencias_combustivel']` + `['depositos']`
- Triggers BEFORE: `fn_block_transferencia_envolvendo_externo` → `fn_validate_transferencia_combustivel`
- Triggers AFTER: legacy SECURITY DEFINER + novo → ambos chamam `recalcular_nivel_deposito` para origem e destino (**4 UPDATEs em `depositos` por operação**)

**Persistência:** Tabela `transferencias_combustivel`. Não cria entry em `transportadora_movimentos`. **Não aparece em relatórios de custo por obra.**

#### Edge cases NÃO tratados

- ✅ Quantidade ≤ 0: client `isValid` + (DB sem CHECK)
- ✅ Origem = destino: client filtra + check (DB sem CHECK)
- ⚠️ **Origem sem estoque**: client checa via RPC mas **nenhuma validação no DB** → INSERT direto via API pode registrar transferência sem estoque
- ✅ Origem sem `combustivel_atual_id`: trigger DB bloqueia
- ✅ Tanques externos: trigger DB bloqueia
- ⚠️ **Custo do litro de origem não rastreado no destino**: sem coluna `valor_por_litro_origem` ou similar

#### Bugs identificados

| # | Arquivo:linha | Severidade | Bug |
|---|---|---|---|
| **T1** | `20260513000000_f11....sql:55-80` + `20260505130000_fix....sql:29-55` | **CRÍTICA** | `recalcular_nivel_deposito` **não filtra `deleted_at IS NULL`** → transferências soft-deletadas continuam afetando nível dos depósitos |
| **T2** | `20260512230000_fix_calcular_estoque....sql` | **ALTA** | `calcular_estoque_combustivel_na_data` (RPC usada pelo form pra validar estoque) também ignora `deleted_at` → form aprova transferência baseado em estoque incorreto |
| T3 | duplo trigger (legacy + novo) | BAIXA | `recalcular_nivel_deposito` roda 2× por operação. Idempotente, mas custo desnecessário (4 UPDATEs em `depositos`) |
| T4 | schema.sql ausência | MÉDIA | Colunas `foto_urls`, `arquivo_urls`, `deleted_at`, `deleted_by` da `transferencias_combustivel` **não estão em nenhuma migration** — foram adicionadas direto via dashboard, sem rastreabilidade |
| T5 | `transferencias_combustivel` | BAIXA | Sem CHECK `quantidade_litros > 0` no DB. Bypass da UI é possível |
| T6 | `TransferenciaForm.tsx:117-127` | BAIXA | `precoMedio` calculado sobre entradas ativas mas ignora transferências recebidas → subestima custo do tanque destino |
| T7 | `FrotaCombustivelContainer.tsx:505-511` | MÉDIA | `mutateAsync` sem try/catch; erros do DB não exibidos como toast amigável; modal fica aberto sem feedback |

---

## Fase 3 — Rastreamento de Custos (CRÍTICO)

### 3.1 Cenário "Comprei 5.000L de diesel por R$ 25.000"

**Onde é registrado:**
- Tabela `entradas_combustivel`
- Colunas: `quantidade_litros = 5000`, `valor_total = 25000`, `deposito_id`, `tipo_combustivel`, `fornecedor`
- `valor_unitario` (R$ 5,00/L) é **calculado no frontend apenas** (`EntradaForm.tsx:81-85`) e **NÃO persistido** — `entradaCombustivelToDb` em `mappers.ts:178-193` omite o campo.

**Lançamento contábil paralelo?**
- **Não existe.** Sem entry em `entradas_material`, `lancamentos_financeiros` ou qualquer tabela financeira.
- Trigger `fn_trigger_recalcular_nivel_entrada` apenas recalcula `depositos.nivel_atual_litros`.

**Aparece em:**
- Aba **Fornecedores** — `KpisRowFornecedores.tsx:30-33` agrega `e.valorTotal` e `e.quantidadeLitros`
- Aba **Relatórios** → Mensal Consolidado — usa `entradasNoMes`
- **Não aparece** no KPI "Custo total" da Visão Geral (esse soma apenas `saidas_combustivel.valor_total`)
- **Não há reconciliação** entre "quanto comprei" vs "quanto consumi"

### 3.2 Cenário "Caminhão XPTO consumiu 200L no paliativo"

**Pra onde o custo vai:**

| Campo | Valor |
|---|---|
| `saidas_combustivel.equipamento_id` | ID do caminhão |
| `saidas_combustivel.obra_id` | ID da obra de paliativo |
| `saidas_combustivel.etapa_id` | ID da etapa (opcional) |
| `saidas_combustivel.transportadora_id` | NULL (equipamento próprio) |

**Centro de custo:** Não existe coluna `centro_custo_id`. Agrupamento é só por obra. Etapa opcional não aparece em nenhum relatório de custo (só metadado).

**Como `preco_unitario` é calculado:**

Método: **Média Ponderada GLOBAL** (sem corte temporal). Cálculo 100% **frontend** em `SaidaCombustivelForm.tsx:247-254`:

```typescript
const precoMedioTanque = useMemo(() => {
  if (origem !== 'tanque' || !tanqueId) return 0;
  const ents = entradasCombustivel.filter((e) => e.depositoId === tanqueId);
  if (ents.length === 0) return 0;
  const totalValor = ents.reduce((s, e) => s + e.valorTotal, 0);
  const totalLitros = ents.reduce((s, e) => s + e.quantidadeLitros, 0);
  return totalLitros > 0 ? totalValor / totalLitros : 0;
}, [origem, tanqueId, entradasCombustivel]);
```

Snapshot gravado em `saidas_combustivel.preco_medio_tanque_snapshot` no momento do INSERT. `valor_total = litros × precoUnitario` calculado no frontend.

**Onde os 200L aparecem:**
- `CustoPorObra.tsx:47-49` — agrega `s.valorTotal` por `s.obraId`
- `ObrasRankingTable.tsx:41-43` — `cur.custo += s.valorTotal`
- `KpisRowObras.tsx:30` — `custo += s.valorTotal`
- `porObraExport.ts:104-122` — alimenta PDF/Excel

### 3.3 Cenário "Transferi 1.000L do tanque obra A pra obra B"

**O custo "viaja" de A pra B?** **Parcialmente.**

- A transferência é registrada em `transferencias_combustivel` com `valor_total` (calculado client-side como `qtd × precoMedio_origem`)
- **Não há repasse rastreável de R$/L pro destino** — não existe coluna `valor_por_litro` ou `snapshot_preco_origem`. Só `valor_total` no row.
- O preço médio do tanque B é recalculado quando alguém faz saída de B — mas **o cálculo só olha `entradas_combustivel` do depósito B, ignorando o que entrou via transferência**.

**Problema crítico:** Se o tanque B só recebe via transferência (nenhuma compra direta), `precoMedioTanque = 0` no form de saída → bloqueio total de operações.

**Há log/histórico?**
- Row em `transferencias_combustivel` (com soft-delete via `deleted_at`)
- Trigger recalcula nível dos 2 tanques (mas ignora `deleted_at` — bug T1)
- Sem auditoria separada nem entry em `transportadora_movimentos`

**Aparece em relatório?**
- Aba **Transferências** (lista operacional)
- **Nenhum** relatório de custo consulta `transferencias_combustivel`. Custo por obra do destino fica sem o custo do recebido.

### 3.4 Diagrama do Fluxo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPRA (EntradaForm.tsx)                             │
│  Usuário: data, fornecedor, litros, valor_total                          │
│  Tabela: entradas_combustivel                                            │
│  Colunas: quantidade_litros, valor_total                                 │
│  Trigger: recalcula depositos.nivel_atual_litros                         │
│  ❌ SEM lançamento financeiro paralelo                                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    TANQUE (depositos)                                   │
│  nivel_atual_litros atualizado por trigger                              │
│  preco_medio (frontend, vitalício, sem data):                            │
│    Σ(entradas.valor_total) / Σ(entradas.quantidade_litros)               │
│  ⚠️ Ignora transferências recebidas                                       │
│  ⚠️ Ignora soft-deletes de entradas/transferências                       │
└──────────────┬─────────────────────────────────┬───────────────────────┘
               │                                 │
               │ saída                           │ transferência
               ▼                                 ▼
┌──────────────────────────────┐   ┌─────────────────────────────────────┐
│ CONSUMO equipamento_proprio  │   │ TRANSFERÊNCIA                        │
│ saidas_combustivel           │   │ transferencias_combustivel           │
│ preco_unitario = precoMedio  │   │ valor_total = qtd × precoMedioOrigem │
│ valor_total = litros × preco │   │ ❌ NÃO gera movimento financeiro      │
│ obra_id, equipamento_id,     │   │ ❌ NÃO aparece em CustoPorObra        │
│ etapa_id gravados            │   │ Trigger: recalcula nível origem+dest │
└──────────────────────────────┘   └─────────────────────────────────────┘
               │
               │ saída carreta
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ CONSUMO carreta_transportadora                                          │
│ saidas_combustivel                                                       │
│ preco_unitario = precoCombustivel + taxaLitro                            │
│ Trigger fn_saidas_combustivel_movimentos AFTER INSERT:                   │
│   • tanque com proprietária: INSERT credito (proprietária)               │
│                              + INSERT debito (transportadora)            │
│   • tanque EMT: INSERT debito_abastecimento_emt (transportadora)         │
│ Tabela paralela: transportadora_movimentos                               │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  RELATÓRIO / CUSTO                                       │
│                                                                          │
│ KPI "Custo total" = ΣvalorTotal saidas_combustivel                       │
│ "Custo por Obra" = grouped by obra_id                                    │
│ "R$/L médio" = custo / volume (média das saídas filtradas)               │
│ Relatórios PDF/Excel: por obra, por equipamento, mensal consolidado     │
│ Fornecedores: baseado em entradas_combustivel (não em saídas)            │
│ ❌ Sem reconciliação entradas vs saídas                                  │
│ ❌ Transferências invisíveis nos relatórios de custo                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 4 — Cálculo de Custo

### 4.1 Método de Custeio

**Média Ponderada Global SEM corte temporal** (custo médio ponderado acumulado desde o início).

### 4.2 Onde no Código

| Ponto de cálculo | Arquivo | Linha |
|---|---|---|
| `precoMedioTanque` (saída via tanque) | `SaidaCombustivelForm.tsx` | 247-254 |
| `precoMedio` (transferência) | `TransferenciaForm.tsx` | 117-122 |
| `precoMedio` (relatório extrato) | `extratoExport.ts` | 681, 767 |
| `rPorL = custo/volume` (KPI analítico) | `KpisRow.tsx` | 124 |
| `rPorL` por obra (ranking) | `ObrasRankingTable.tsx` | 60 |
| `rPorL` por equipamento (export) | `porObraExport.ts` | 179 |

### 4.3 Consistência entre Relatórios

**Existem 2 contextos distintos**, parcialmente consistentes:

| Contexto | Método | Campo usado |
|---|---|---|
| Precificação de saída (snapshot) | Média ponderada global do tanque no momento do form | `preco_medio_tanque_snapshot` gravado |
| KPIs analíticos (R$/L médio) | `ΣvalorTotal / Σlitros` sobre saídas filtradas | `s.valorTotal / s.litros` em runtime |
| "Melhor preço" fornecedor | Média ponderada por fornecedor sobre entradas | `v.custo / v.litros` |

O snapshot é imutável após INSERT. Dashboards recalculam em runtime a partir de `valor_total`. **Os dois batem** se o snapshot foi calculado corretamente, mas o R$/L do dashboard é uma "média de médias" — não idêntico ao snapshot individual.

### 4.4 Considera Frete / Impostos / Perdas?

**Não.**
- `EntradaForm` captura apenas: data, tanque, combustível, litros, valor unitário, fornecedor, NF, observações
- **Não há** campo pra ICMS, PIS/COFINS, frete de entrega, perdas por evaporação
- O preço médio embute implicitamente qualquer sobrepreço que o usuário digitar no `valor_total`, mas sem rastreabilidade dos componentes

### 4.5 Casos de Cálculo Errado

| # | Cenário | Impacto |
|---|---|---|
| **C1** | Preço médio vitalício (ignora data) | Tanque com entradas de 2025 a R$4/L e 2026 a R$6/L → preço médio dilui histórico antigo. Custo corrente subestimado. |
| **C2** | Transferências recebidas ignoradas no cálculo | Tanque B só recebe via transferência → `precoMedioTanque = 0` → saídas bloqueadas |
| **C3** | `recalcular_nivel_deposito` ignora `deleted_at` em transferências | Soft-delete não corrige saldo → nível e custo do tanque ficam errados |
| **C4** | Edição manual de `preco_unitario` em saída | Não atualiza `preco_medio_tanque_snapshot` → divergência entre snapshot e novo preço |
| **C5** | Carreta + tanque externo | `preco_combustivel` é editável; pode divergir do preço médio real do tanque. `valor_total` pode não bater com snapshot |
| **C6** | Sem reconciliação compra ↔ consumo | Impossível comparar "comprei R$25k de diesel este mês" com "consumi R$Xk" por obra |
| **C7** | Sem frete/impostos/perdas | Preço médio não reflete custo total de aquisição |

---

## Fase 5 — UI/UX (vs shadcn / Linear / Stripe baseline)

### 5.1 Resumo Transversal

| Item Bloco 3 | Status |
|---|---|
| Skeleton de loading | ✅ Implementado em `SkeletonBlock` (uma das poucas áreas com Skeleton) |
| Forms RHF + Zod | ❌ `useState` manual em todos (`SaidaCombustivelForm`, `EntradaForm`, `TransferenciaForm`) |
| Tabelas com `@tanstack/react-table` | ❌ `map()` inline em todas |
| Drawers com Sheet shadcn | ❌ Custom `Drawer` em `src/components/ui/` |
| Modais com Dialog shadcn | ❌ Custom `Modal` em `src/components/ui/` |
| Tabs shadcn | ❌ Custom `CombustivelTabsNav` + tabs manuais em drawers |
| Totais visíveis no topo | ⚠️ Só em `SaidaCombustivelList`; `EntradaList`/`TransferenciaList` sem |
| Filtros com presets | ✅ 7 presets de período |
| Date range picker visual | ❌ `<input type="date">` nativo |
| Empty states tratados | ✅ |
| Error state tratado | ✅ `ErrorState` + `CombustivelErrorBoundary` |
| Toast global | ❌ `alert()` para feedback; toast real só no mobile e no import Excel |
| `window.confirm/prompt` | ❌ Presente em 3 lugares |

### 5.2 Por Tela (resumo dos pontos mais críticos)

**`FrotaCombustivelContainer` (shell):**
- **Amador:** `alert()` + `window.confirm()` + `window.prompt()` pra feedback e confirmação destrutiva. Comentários no código reconhecem ("swap por modal em F6", "sem lib de toast")
- **Friction:** Sub-tab state não persiste na URL → recarregar volta pra `visao_geral`
- **Falta:** Badge de contagem de anomalias pendentes na nav; export "tudo" no nível da página

**`SaidaCombustivelList` / `EntradaList` / `TransferenciaList`:**
- **Amador:** Header `bg-emt-verde text-white` em Entrada/Transferência (verde brilhante estilo 2012). Zebra `bg-emt-cinza-claro`. Mistura `bg-white rounded-lg shadow` (legado) vs tokens (`var(--color-border)`)
- **Friction:** Sem paginação, sem ordenação por coluna, sem busca inline livre, sem seleção múltipla
- **Falta:** Totais não aparecem em Entrada/Transferência; sem coluna R$/L derivada; sem export CSV direto da lista filtrada
- **Mobile:** 7-9 colunas em scroll horizontal; sem modo card responsivo; alvos de toque pequenos nos ícones

**`TanqueList`:**
- **OK:** `TanqueVisual` com barra de nível animada — destaque positivo
- **Amador:** Botão "Esvaziar" (irreversível) como link de texto pequeno ao lado de "Editar" — risco de click acidental. Classes hardcoded `bg-white dark:bg-slate-800` em vez de tokens
- **Falta:** Sem indicador de "tanque crítico" (nível < 20%) em cor de alerta; sem KPI de capacidade total vs nível total

**`SaidaCombustivelForm` (1028 LOC):**
- **OK:** Radio cards de tipo consumidor bem executados; preview de cálculo inline; sanity warnings; banner "Para salvar, preencha..."
- **Amador:** 15+ `useState` em vez de RHF+Zod; inline "Novo Combustível" como input raw; `<input type="number">` raw sem componente do sistema
- **Friction:** Form muito longo (~15 inputs visíveis simultâneos); sem step/wizard
- **Mobile:** Modal full-screen com 15+ campos sem sticky footer → usuário rola até o fim com teclado aberto

**`MSaidaCombustivelPage` (mobile):**
- **OK:** Inputs grandes `h-12 rounded-xl text-lg`, `inputMode="decimal"`, ícones leading, botão fixo no fundo, toast real
- **Amador:** **Dados gravados com valores fixos/errados** (vide bugs S1-S8). Bug de enum quebra exibição na lista desktop. Sem confirmação visual do nível do tanque após seleção
- **Falta:** Capacidade/nível atual do tanque escolhido; preço estimado da saída; modo offline; campo de combustível visível

**`Visão Geral` (KPIs + charts):**
- **OK:** O componente mais polish do módulo. `KpiCard` próximo de Linear/Stripe. Hover microinterações. Trend invertido para custos. Sparkline. KPI Anomalias clicável que filtra a outra aba
- **Amador:** `title=` nativo do browser pra tooltip (delay e visual inconsistentes); KPIs longos (nome de equipamento) podem quebrar layout sem `truncate`

**`SaidaDetalhesDrawer`:**
- **OK:** Mini KPIs no topo; Field component consistente; grid de fotos; sentinel banner
- **Amador:** Tabs manuais com `<button>` + `border-b-2` em vez de Tabs shadcn; `Drawer` custom sem focus trap robusto

**`FilterBar` + `PeriodoPanel`:**
- **OK:** Sticky com backdrop-blur, Popover por filtro, counted() helper, 7 presets de período, saved views
- **Amador:** Popover custom (não shadcn/Radix); `<input type="date">` sem calendário visual; sem "Selecionar todos" no MultiSelect
- **Falta:** Sem feedback de "Aplicar (124 resultados)" enquanto Popover aberto; sem filtro de range de litros/valor

### 5.3 Prioridades de Modernização (impacto visual)

1. Substituir `alert()`/`window.confirm()`/`window.prompt()` por toast/modal — ponto mais amador
2. Substituir header verde em `EntradaList`/`TransferenciaList` por tokens — impacto imediato
3. Migrar forms para RHF + Zod — reduz código e adiciona validação tipada
4. Adicionar `@tanstack/react-table` nas listas com paginação e sort
5. **Corrigir `MSaidaCombustivelPage`** — bugs S1-S6 são URGENTES (dados incorretos no banco)

---

## Fase 6 — Segurança

### 6.1 Findings (≥80% confiança)

#### HIGH severity

**Finding 1 — SECURITY DEFINER sem `SET search_path`**
- **Localização:** `recalcular_nivel_deposito`, `calcular_estoque_combustivel_na_data`, `trigger_entrada_combustivel_nivel`, `trigger_transferencia_combustivel_nivel`, e outras legacy
- **Risco:** Schema shadowing. Usuário autenticado pode criar tabelas em schema controlado por ele e manipular `search_path` da sessão, fazendo função privilegiada referenciar objetos fantasmas
- **Fix:** `ALTER FUNCTION public.<nome>(...) SET search_path = public, pg_temp` em todas as SECURITY DEFINER do módulo

**Finding 2 — `esvaziamentos_tanque` sem RLS habilitado**
- **Localização:** `20260513000000_f11_lock_combustivel_por_tanque.sql:22-33`
- **Risco:** Tabela criada com `CREATE TABLE IF NOT EXISTS` sem `ENABLE ROW LEVEL SECURITY`. Acessível direto via PostgREST sem restrição
- **Exploit:** Operador insere esvaziamento falso → nível calculado cai → registra entrada real → real e contábil divergem sem rastro
- **Fix:** `ALTER TABLE esvaziamentos_tanque ENABLE ROW LEVEL SECURITY` + policies por cargo via `private.current_has_action()`

#### MEDIUM severity

**Finding 3 — Views sem `security_invoker` declarado (risco de regressão)**
- **Localização:** `transportadora_movimentos_detalhe`, `transportadora_saldos`
- **Status atual:** Corrigido via `ALTER VIEW` em `bloco4_db_housekeeping`. **Mas** as `CREATE OR REPLACE VIEW` originais não têm a flag → qualquer nova recriação que esqueça da flag reverte
- **Fix:** Incluir `WITH (security_invoker = true)` nas definições inline

**Finding 4 — Bucket `abastecimento-fotos` sem `file_size_limit` e `allowed_mime_types`**
- **Localização:** Migration original do bucket sem limites; `tighten_storage_bucket_limits` (Bloco 1.5) corrigiu 3 outros buckets mas omitiu este
- **Risco:** Validação só client-side. POST direto via API aceita qualquer MIME e qualquer tamanho
- **Fix:** `UPDATE storage.buckets SET file_size_limit=20971520, allowed_mime_types=[...] WHERE id='abastecimento-fotos'`

**Finding 5 — Mobile envia `tipo_consumidor: 'equipamento'` (CHECK violation)**
- **Localização:** `MSaidaCombustivelPage.tsx:120`
- **Risco:** Viola CHECK constraint → INSERT falha silenciosamente. Impacto financeiro: rastreabilidade de saída perdida; trigger de movimento não dispara
- **Fix:** Corrigir para `'equipamento_proprio'` no insert mobile

**Finding 6 — Policies blanket nas tabelas de combustível**
- **Localização:** Todas com `FOR ALL TO authenticated USING(true) WITH CHECK(true)`
- **Risco:** Qualquer authenticated (incluindo `Operador`) pode:
  - `DELETE FROM saidas_combustivel` direto (hard delete sem rastro)
  - `UPDATE preco_unitario, valor_total` em saídas
  - `UPDATE abatido_em_pagamento_id` em `transportadora_movimentos` — "abate" dívidas sem pagamento real
- **Contraste:** Outras tabelas (`fretes`, `financeiro_lancamentos`) já migraram para policies granulares via `private.current_has_action()`
- **Fix:** Aplicar mesmo padrão (similar a `20260520120000_tighten_rls_critical_tables.sql`)

### 6.2 Status RLS por Tabela

| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE | Risco anon | Achado |
|---|---|---|---|---|---|---|---|
| `depositos` | ✅ | ✅ auth | ✅ auth | ✅ auth | ✅ auth | ❌ | F6 |
| `depositos_material` | ✅ | ✅ auth | ✅ auth | ✅ auth | ✅ auth | ❌ | — |
| `entradas_combustivel` | ✅ | ✅ auth | ✅ auth | ✅ auth | ✅ auth | ❌ | F6 |
| `saidas_combustivel` | ✅ | ✅ auth | ✅ auth | ✅ auth | ✅ auth | ❌ | F6 |
| `transferencias_combustivel` | ✅ | ✅ auth | ✅ auth | ✅ auth | ✅ auth | ❌ | F6 |
| `esvaziamentos_tanque` | **❌ NÃO HABILITADO** | aberto | aberto | aberto | aberto | ⚠️ | **F2 (HIGH)** |
| `transportadora_movimentos` | ✅ | ✅ auth | ✅ auth | ✅ auth | ✅ auth | ❌ | F6 |

---

## Fase 7 — Recomendações Priorizadas

> Tabela final com 15 itens, agrupados em 🔴 ALTA (bugs que causam custo errado ou risco de segurança) / 🟡 MÉDIA (UX e dados ruidosos) / 🟢 BAIXA (polish).
> Esforço estimado por **dev sênior** com conhecimento do projeto.

| # | Prioridade | Problema | Esforço |
|---|---|---|---|
| 1 | 🔴 **ALTA** | **Mobile `MSaidaCombustivelPage` grava `valor_total=0`, `preco_unitario=0`, `tipo_consumidor='equipamento'` (inválido pelo CHECK), `tipo_combustivel='diesel'` hardcoded, `alocacoes=[]`** — saídas mobile estão zeradas financeiramente e/ou não persistindo. (Bugs S1-S6) | 4-6h (calcular preço médio do tanque + ajustar enum + usar UUID do insumo + via hook pra invalidar cache) |
| 2 | 🔴 **ALTA** | **`recalcular_nivel_deposito` e `calcular_estoque_combustivel_na_data` não filtram `deleted_at IS NULL`** em entradas/saídas/transferências. Soft-deletes não corrigem saldo. (Bugs T1+T2+C3) | 3-4h (migration ajustando as 2 funções; testar regressão) |
| 3 | 🔴 **ALTA** | **`esvaziamentos_tanque` sem RLS** — qualquer authenticated pode inserir/deletar esvaziamentos arbitrários e corromper saldo. (Finding 2) | 1-2h (migration: ENABLE RLS + policies) |
| 4 | 🔴 **ALTA** | **SECURITY DEFINER sem `search_path`** em funções de estoque (`recalcular_nivel_deposito`, `calcular_estoque_combustivel_na_data`, triggers legacy). Risco de schema shadowing. (Finding 1) | 1h (migration `ALTER FUNCTION ... SET search_path = public, pg_temp` por função) |
| 5 | 🔴 **ALTA** | **Preço médio do tanque é vitalício e ignora transferências recebidas**. Tanque B só por transferência → `precoMedio=0` → bloqueia saídas. Tanque com histórico longo subestima custo corrente. (Bugs C1+C2+T6) | 8-12h (decidir método: FIFO ou ponderada com janela; recalcular incluindo transferências; testes) |
| 6 | 🔴 **ALTA** | **Policies blanket permitem Operador fazer DELETE/UPDATE direto via PostgREST** burlando soft-delete. (Finding 6) | 3-4h (migration aplicando policies granulares similares a `20260520120000_tighten_rls_critical_tables.sql`) |
| 7 | 🔴 **ALTA** | **Trigger legacy `trg_entrada_combustivel_nivel` e `trg_transferencia_combustivel_nivel` (SECURITY DEFINER) coexistem com triggers novos** — `recalcular_nivel_deposito` roda 2× por operação. Risco de regressão. (Bug E5+T3) | 1h (migration `DROP TRIGGER IF EXISTS` nos legacy + cleanup das funções órfãs) |
| 8 | 🟡 **MÉDIA** | **Bucket `abastecimento-fotos` sem `file_size_limit` e `allowed_mime_types`**. Storage aceita qualquer arquivo via POST direto. (Finding 4) | 30min (migration UPDATE em `storage.buckets`) |
| 9 | 🟡 **MÉDIA** | **`alert()` / `window.confirm()` / `window.prompt()`** no `FrotaCombustivelContainer` pra feedback CRUD e confirmações destrutivas — ponto mais amador do módulo | 4-6h (criar/usar `useToast` + `ConfirmDialog` consistentes em 3+ lugares) |
| 10 | 🟡 **MÉDIA** | **`EntradaList` e `TransferenciaList` com header `bg-emt-verde text-white` e zebra `bg-emt-cinza-claro`** — visual datado tipo gestão 2012. Inconsistente com módulo v2 | 2-3h (substituir por tokens de design; alinhar com `SaidaCombustivelList`) |
| 11 | 🟡 **MÉDIA** | **Forms usam `useState` manual em vez de RHF+Zod** — `SaidaCombustivelForm` (1028 LOC, 15+ estados), `EntradaForm`, `TransferenciaForm`. Validação frágil, código verboso | 12-16h por form (3 forms = 36-48h) |
| 12 | 🟡 **MÉDIA** | **Listas usam `map()` inline sem paginação nem sort por coluna**. Com 500+ rows DOM fica pesado | 6-8h (migrar 3 listas para `@tanstack/react-table` com sort, pagination, expand-row) |
| 13 | 🟡 **MÉDIA** | **Drawers/Modais custom em vez de Sheet/Dialog shadcn**. Sem focus trap robusto, sem padronização | 6-8h (migrar para shadcn — já tem precedente na Fase B do Frete) |
| 14 | 🟢 **BAIXA** | **`isValid` em forms não checa numéricos > 0 (string "0" passa)**; bugs em fire-and-forget de mutations de combustível/fornecedor inline; URLs assinadas TTL 1h salvas no DB | 4-6h (RHF+Zod cobre as duas primeiras; re-mint de URLs no mapper db→TS) |
| 15 | 🟢 **BAIXA** | **`data_hora` como `text` em `entradas_combustivel` e `transferencias_combustivel`** (deveria ser `timestamptz`). 2 triggers de `updated_at` em `saidas_combustivel` redundantes. Colunas `foto_urls/arquivo_urls/deleted_at` de transferencias sem migration. Tabelas `abastecimentos_backup_*` esquecidas em prod | 3-4h (migrations de housekeeping; documentar schema final) |

---

## Apêndice — Recomendações Estratégicas (fora do escopo de 15 itens)

- **Reconciliação compra ↔ consumo:** Criar relatório que mostre, por obra e por mês, "entradas atribuíveis vs saídas realizadas" — atualmente impossível. Pode exigir nova tabela `compras_para_obras` ou alocação na entrada
- **Frete/impostos no preço médio:** Adicionar campos `valor_frete`, `valor_impostos` em `entradas_combustivel` e incluir no cálculo do preço médio
- **Centro de custo dedicado:** Coluna `centro_custo_id` em `saidas_combustivel` (vs só `obra_id/etapa_id`)
- **Modo offline mobile:** Suporte a fila local de saídas pra sincronizar quando voltar a internet (relevante pra obra remota)
- **Removed `abastecimentos`/`abastecimentos_carreta` backup tables** — depois de confirmado que não há dependências, dropá-las

---

*Auditoria gerada via subagent-driven analysis (Superpowers). Fontes:*
- *Round 1: file mapping, DB schema via Supabase MCP, routes, UI/UX analysis*
- *Round 2: 3 flow audits (entrada/saída/transferência), cost tracking, cost calculation*
- *Round 3: security analysis*
- *Síntese e priorização: controlador da sessão*
