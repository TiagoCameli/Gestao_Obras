# Auditoria — Gestão Obras

**Data:** 2026-05-20
**Escopo:** estado atual do branch `main` (com mudanças não commitadas), schema Supabase em produção, código `src/`, configuração de testes.
**Método:** análise estática (leitura de código + grep), MCP do Supabase (`list_tables`, `get_advisors`, `execute_sql`), inspeção das skills `supabase` e `shadcnblocks`.

---

## TL;DR — os 7 pontos mais urgentes

1. **RLS é placebo.** 92 tabelas têm `rls_enabled=true`, mas o advisor do Supabase reporta `rls_policy_always_true` em **91 delas** — todas usam `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. Qualquer usuário logado pode ler/escrever em tudo, inclusive `funcionarios` (CPF), `audit_log` e `perfis_permissao`.
2. **`temPermissao()` retorna `true` sempre.** Todo `<PermissionGate>` da UI é um no-op. Só `temAcao()` (usado no roteador) funciona — então o ataque é "abriu a página? clica no botão que não devia ver e a mutation passa".
3. **`login_attempts` é gravável por `anon`.** O lockout de 5 tentativas é client-side e o atacante pode `DELETE` o contador antes de cada tentativa.
4. **Portal público de cotação aceita escrita anônima** em `cotacao_links_publicos` e `cotacao_respostas_fornecedor` sem validação server-side do token.
5. **Zero testes reais.** Só existe `tests/example.spec.ts` (boilerplate apontando pra `playwright.dev`). Sem unit-test framework instalado, sem script `test`.
6. **Código morto e legado.** `src/pages/Insumos.tsx` (440 LOC) não está em rota; `src/pages/Obras.tsx` (3.069 LOC, "legado") ainda é servido em `/cadastros/legado`.
7. **68 foreign keys sem índice** + 37 índices nunca usados — performance vai degradar conforme o volume cresce (já há tabelas com 1.925 e 1.118 linhas).

---

## 1. Estrutura & Stack

### 1.1 Stack runtime (agrupada)

| Categoria | Pacotes |
|---|---|
| UI / styling | `radix-ui ^1.4.3`, `shadcn ^4.7.0`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react ^1.16.0`, `@fontsource-variable/geist` |
| Data / state | `@tanstack/react-query ^5.90.21`, `dexie ^4.4.2` (IndexedDB offline) |
| Auth / DB | `@supabase/supabase-js ^2.95.3` |
| Charts / maps | `recharts ^3.8.0`, `leaflet ^1.9.4`, `react-leaflet ^5.0.0` |
| PDF / Excel | `jspdf`, `jspdf-autotable`, `exceljs`, `xlsx`, `xlsx-js-style`, `pdfjs-dist` |
| AI / ML | `@vladmandic/face-api ^1.7.15` (reconhecimento facial pra ponto) |
| QR | `qrcode` |
| Routing | `react-router-dom ^7.13.0` |
| Core | `react ^19.2.0`, `react-dom ^19.2.0` |

### 1.2 Stack dev/test

- E2E: `@playwright/test ^1.60.0` (configurado, **sem testes reais**)
- Build: Vite 7.3.1, TypeScript 5.9.3, Tailwind 4.1.18, eslint 9
- **Não instalados:** vitest, jest, @testing-library/*, RHF, zod

### 1.3 Scripts npm

```
dev               vite
build             tsc -b && vite build
lint              eslint .
preview           vite preview
seed:manutencao   node scripts/seedManutencao.mjs
```

> Nenhum script `test`, `test:e2e` ou `playwright test`.

### 1.4 Rotas (`src/App.tsx`)

| Rota | Componente | Proteção | Layout |
|---|---|---|---|
| `/login` | `Login` | público | nenhum |
| `/cotacao/r/:token` | `PortalCotacao` | público (token) | nenhum |
| `/` | `HomeRedirect` → `Dashboard` | autenticado | `MainLayout` |
| `/obras` | `ObrasPage` | `modulo=obras` | `MainLayout` |
| `/cadastros` | `CadastrosHub` | `modulo=cadastros` | `MainLayout` |
| `/cadastros/legado` | `Obras` (3069 LOC, legado) | `modulo=cadastros` | `MainLayout` |
| `/cadastros/etapas` | `EtapasPage` | `modulo=cadastros` | `MainLayout` |
| `/cadastros/usuarios` | `Funcionarios` | `modulo=funcionarios` | `MainLayout` |
| `/cadastros/unificacao` | `UnificacaoPage` | `modulo=cadastros` | `MainLayout` |
| `/cadastros/:slug` | `EntityCadastroRoute` | `modulo=cadastros` | `MainLayout` |
| `/compras` | `Compras` (1341 LOC) | `modulo=compras` | `MainLayout` |
| `/financeiro` | `Financeiro` | `modulo=financeiro` | `MainLayout` |
| `/depositos` | `Depositos` | `modulo=depositos` | `MainLayout` |
| `/frete` | `Frete` (996 LOC) | `modulo=frete` | `MainLayout` |
| `/frota` | `Frota` | `modulo=frota` | `MainLayout` |
| `/manutencao` (+ `/dashboard`, `/os`, `/os/:numero`, `/planos`, `/planos/:id`, `/agenda`, `/almoxarifado`, `/checklists`) | `Manutencao` (sub-routing por `pathname`) | `modulo=frota` | `MainLayout` |
| `/combustivel` | `Combustivel` | `modulo=frota` | `MainLayout` |
| `/funcionarios` | `Funcionarios` | `modulo=funcionarios` | `MainLayout` |
| `/apontamento` | `ApontamentoPage` | `modulo=apontamento_rh` | `MainLayout` |
| `/acesso-negado` | `AcessoNegado` | autenticado | `MainLayout` |
| `*` | `NotFound` | autenticado | `MainLayout` |
| `/medicao/*` | `RodoTrackerPage` | `modulo=medicao` | `FullscreenLayout` |
| `/m`, `/m/eq/:id`, `/m/eq/:id/info`, `/m/checklist/:id`, `/m/medicao/:id`, `/m/abrir-os/:id`, `/m/saida-combustivel/:id` | 7 páginas mobile | autenticado | `MobileLayout` |

**Achado crítico:** `src/pages/Insumos.tsx` (440 LOC) **existe mas não está roteado** — código órfão.

### 1.5 Top-level `src/`

| Pasta | Função |
|---|---|
| `pages/` | 16 páginas + `mobile/` com 7 telas dedicadas |
| `modules/cadastros/` | Cadastros baseados em config (`*.config.tsx`) + renderizador universal |
| `modules/rodotracker/` | Medição/planejamento rodoviário, mapa Leaflet, sidebar arrastável |
| `modules/apontamento/` | RH: ponto, alocação, serviço, aprovação |
| `components/ui/` | 16 componentes "core" customizados (não shadcn) |
| `components/shadcn/` | 3 componentes shadcn (card, chart, table) — pasta nova |
| `components/auth/` | `ProtectedRoute`, `PermissionGate`, modais |
| `components/layout/` | `MainLayout`, `FullscreenLayout`, `Header`, `UserMenu` |
| `components/<feature>/` | 11 pastas acopladas ao domínio (compras, frete, frota, financeiro, etc.) |
| `hooks/` | 66 hooks (em sua maioria wrappers React Query sobre Supabase) |
| `contexts/` | `AuthContext`, `ThemeContext` |
| `lib/` | Cliente Supabase, fila offline (IndexedDB), service worker, mappers |
| `utils/` | 25 helpers (formatters, validators, exporters) |
| `types/` | `index.ts` único com tipos do domínio inteiro |

### 1.6 Componentes reutilizáveis

| Categoria | Qtd | Componentes |
|---|---|---|
| Form | 7 | `Input`, `Select`, `SearchableSelect`, `SmartSelect`, `ComboboxInput`, `FilterCombobox`, `PrazoEntregaInput` |
| Dialogs / overlays | 5 | `Modal`, `Drawer`, `ConfirmDialog`, `PasswordDialog`, `ImportExcelModal` |
| Data display | 4 | `Card` (custom), `shadcn/card`, `shadcn/table`, `shadcn/chart` |
| Feedback | 2 | `Toast` (provider), `Skeleton` |
| Actions | 1 | `Button` |
| Layout | 4 | `MainLayout`, `FullscreenLayout`, `Header`, `UserMenu` |
| Auth | 4 | `ProtectedRoute`, `PermissionGate`, `MeuPerfilModal`, `AlterarSenhaModal` |

**Gap shadcn:** faltam `EmptyState`, `Alert`, `Badge`, `Tabs`, `Tooltip`, `DropdownMenu`, `Sheet`, `Sonner`, `Pagination`, `DataTable`, `Form` (RHF), `DatePicker`, `Command`. `Skeleton` existe mas é usado em apenas 4 lugares — o resto das páginas usa `<p>Carregando...</p>`.

---

## 2. Banco de Dados (Supabase)

**Projeto:** `gunyitwrbxbmnezokgjq` (Gestão Obras), Postgres 17, US-East-1
**Schema auditado:** `public` (92 tabelas, 12 views)

### 2.1 RLS — visão honesta

| Métrica | Valor |
|---|---|
| Tabelas em `public` | 92 |
| Tabelas com `rls_enabled=true` | **92 (100%)** |
| Tabelas com policy `USING (true)` (advisor `rls_policy_always_true`) | **91 (98.9%)** |
| Tabelas com RLS efetivamente restritiva | **1** (`categorias_material` — única que aparece em multiple_permissive_policies) |

**Conclusão:** RLS está ligado mas vazio. Equivale a não ter RLS — a porta tem fechadura e está destrancada.

### 2.2 Views

12 views, **nenhuma com `security_invoker=true`** — herdam permissões do dono (postgres/`supabase_admin`), bypassando RLS de quem consulta.

Lista: `transportadora_movimentos_detalhe`, `transportadora_saldos`, `v_checklists_nao_conformidades`, `v_custo_pecas_equipamento_12m`, `v_custo_pecas_equipamento_mensal`, `v_documentos_vencendo`, `v_equipamento_depreciacao`, `v_equipamento_medicao_atual`, `v_proximas_preventivas`, `v_saldo_estoque`, `v_saldo_estoque_total`, `vw_saldos_deposito`.

> Quando você fechar o RLS (próximo passo), recompile estas views com `WITH (security_invoker = true)` ou o acesso vai parar.

### 2.3 Estrutura das relações (125 FKs)

**Tabelas-hub (mais referenciadas):**
- `equipamentos` (78 rows) — referenciada por 12 tabelas (`apontamentos`, `checklist_execucoes`, `documentos_equipamento`, `especificacoes_equipamento`, `equipamento_plano`, `execucoes_atividade`, `financeiro_equipamento`, `historico_status_equipamento`, `medicoes_equipamento`, `ordens_compra`, `ordens_servico`, `saidas_combustivel`)
- `obras` (4 rows) — referenciada por 12 tabelas
- `fornecedores` (11 rows) — referenciada por 9 tabelas
- `apont_funcionarios` (72 rows) — hub do módulo apontamento, 7 referências

**Clusters identificados:**
- **Compras:** `pedidos_compra → cotacoes → ordens_compra → recebimentos_oc` + `cotacao_links_publicos`/`cotacao_respostas_fornecedor`
- **Apontamento RH:** prefixo `apont_*` (12 tabelas) referenciando `apont_funcionarios`
- **Manutenção:** `ordens_servico → os_pecas / os_mao_obra / os_transicoes / execucoes_atividade ← plano_atividades ← planos_preventivos`
- **Combustível:** `entradas_combustivel`, `saidas_combustivel`, `transferencias_combustivel`, `transportadora_movimentos`, `esvaziamentos_tanque` (girando em torno de `depositos`)
- **RodoTracker:** `rodotracker_obras → rodotracker_activities / rodotracker_plan_items / rodotracker_contract_items / rodotracker_medicao`

**Tabelas órfãs identificadas:** `audit_log`, `compras_auditoria`, `compras_notificacoes`, `apont_auditoria`, `apont_permissoes_usuario`, `os_contador`, `sequencias_diarias`, `login_attempts`, `unidades_medida`, `categorias_material`, `tipos_insumo`, `tipos_equipamento`, `localidades`, `empresas`, `perfis_permissao`, `anomalias_checks` — não têm FK de saída (são lookups, configs ou logs).

### 2.4 Backups in-place (rolando)

3 tabelas marcadas como "BACKUP — DBA only" com drop agendado **2026-07-04**:
- `abastecimentos_backup_20260505` (756 rows)
- `abastecimentos_carreta_backup_20260505` (167 rows)
- `etapas_obra_backup_20260505_obra009` (135 rows)

Lembrar de dropar na data.

### 2.5 Supabase advisors

**Security advisors — 94 WARNs (nenhum ERROR):**

| Lint | Ocorrências | Tabelas/objetos |
|---|---|---|
| `rls_policy_always_true` | **91** | quase todas as tabelas `public.*` — confirma §2.1 |
| `function_search_path_mutable` | 2 | `fn_apont_escalar_para_ponto`, `fn_apont_escalar_apontamentos_para_ponto` |
| `public_bucket_allows_listing` | 1 | bucket `financeiro-anexos` — anyone pode listar arquivos |

**Performance advisors — 111 findings (2 WARN, 109 INFO):**

| Lint | Nível | Ocorrências |
|---|---|---|
| `auth_rls_initplan` | WARN | 1 (`categorias_material`) |
| `multiple_permissive_policies` | WARN | 1 (`categorias_material`) |
| `unindexed_foreign_keys` | INFO | **68** |
| `unused_index` | INFO | **37** |
| `no_primary_key` | INFO | 3 (os 3 backups — esperado) |
| `auth_db_connections_absolute` | INFO | 1 (config Auth: 10 conexões fixas) |

**Implicação:** 68 FKs sem índice numa app com volumes crescentes (1.925 apontamentos, 1.118 saídas combustível, 896 movimentos transportadora) — JOINs vão começar a doer. Os 37 índices não usados são candidatos a remoção depois de auditoria.

---

## 3. UI tela a tela

> Skim de cada arquivo (50–180 linhas iniciais) cruzado com o catálogo da skill `shadcnblocks` (1.338 blocks em 71 categorias).

| Tela (arquivo) | Rota | O que faz hoje | O que falta pra ficar profissional |
|---|---|---|---|
| `Login.tsx` (205 LOC) | `/login` | Form e-mail/senha, countdown de bloqueio, "lembrar-me", glow ambient via CSS-vars manuais. | Migrar pra `form-signin-1` + `field-standard-1` com `react-hook-form + zod`; remover `inputCls` inline gigante (linhas 72–78). |
| `Dashboard.tsx` (377 LOC) | `/` | KPIs de obras, combustível e gastos por etapa com `recharts/BarChart` e filtros por URL. | Trocar `<p>Carregando...</p>` (linha 171) por `chart-card`/`skeleton-standard-1`; adotar `dashboard-01`/`stats1` no header. |
| `ObrasPage.tsx` (347 LOC) | `/obras` | Lista obras com busca, filtro de status, KPI de contrato, export PDF/Excel. | Usar `data-table1` com sort/filter/paginação nativos (hoje filtra client-side em `useMemo`); `empty-standard-1` quando vazio. |
| `Obras.tsx` (3.069 LOC, **legado**) | `/cadastros/legado` | Mega-arquivo histórico — substituído por `CadastrosHub` mas ainda servido. | **Deletar a rota e o arquivo.** O `EntityCadastroRoute` cobre tudo; mantê-lo dobra superfície de bug. |
| `Compras.tsx` (1.341 LOC) | `/compras` | 5 abas (Visão, Pedidos, Cotações, OCs, Recebimentos), 30+ imports, modais, notificações. | Quebrar em sub-rotas (`/compras/pedidos`, etc.); `application-shell-1` + `data-table1` por aba — 1.341 LOC num arquivo é insustentável. |
| `Financeiro.tsx` (288 LOC) | `/financeiro` | 4 abas (Visão, Lançamentos, Contas, Categorias) + modal + drawer detalhe. | Substituir tabs custom (linhas 41–48) por `Tabs` do shadcn; `chart-card10` na Visão Geral. |
| `Depositos.tsx` (472 LOC) | `/depositos` | Grid de cards de depósitos com filtros, modais de entrada/saída/transferência. | `empty-standard-1` quando vazio; `command-standard-1` na busca (hoje só `<input>`). |
| `Frete.tsx` (996 LOC) | `/frete` | 6 abas com filtros, import Excel, exports. | Promover abas a sub-rotas; `data-table1` com toolbar (`FilterBar` custom hoje tem 200 LOC). |
| `Frota.tsx` (597 LOC) | `/frota` | Lista equipamentos em grid/lista alternável, filtros avançados, export QR em lote. | Cards via `gallery1`/`product-card1`; toolbar com `command-standard-1` e presets salvos. |
| `Manutencao.tsx` (353 LOC) | `/manutencao*` | Hub de 6 sub-páginas roteado **por `pathname` manual** com sub-nav + 4 KPIs. | Trocar `if (pathname === '…')` (linhas 65–71) por sub-rotas declarativas; `chart-card` nos KPIs; `data-table1` na lista de OS. |
| `Combustivel.tsx` (14 LOC) | `/combustivel` | Thin wrapper que renderiza `FrotaCombustivelContainer`. | OK; melhorias vão no container. |
| `Funcionarios.tsx` (201 LOC) | `/funcionarios` `/cadastros/usuarios` | CRUD com password gate, modal de form, gate por permissões. | `user-profile1`/`team1` nos cards; `alert-dialog-standard-1` no lugar de `ConfirmDialog`; matriz de permissões em `tabs`. |
| `Insumos.tsx` (440 LOC, **órfão**) | (sem rota) | Tela completa de entrada/saída/transferência de insumos — não roteada. | **Remover do repo** OU adicionar rota `/insumos`. Código morto importado por ninguém. |
| `PortalCotacao.tsx` (448 LOC) | `/cotacao/r/:token` | Portal público do fornecedor: valida token, tabela de itens, assinatura via canvas. | `empty-standard-1` para token inválido/expirado; `form-contact-1` + `signature` no fluxo final. |
| `AcessoNegado.tsx` (19 LOC), `NotFound.tsx` (16 LOC) | `/acesso-negado`, `/*` | 403/404 simples com link "Voltar". | Substituir por `error-404`/`error-403` blocks (categoria `empty` tem 22 variantes). |
| `CadastrosHub.tsx` | `/cadastros` | Cards por categoria com cores accent custom. | Migrar pros `bento1`/`feature3` blocks; usar `Badge` shadcn em vez de spans customizados. |
| `EntityCadastroRoute.tsx` + `EntityCadastroPage.tsx` | `/cadastros/:slug` | Renderizador universal de cadastro com Drawer de form, busca, lista, importador Excel — driven por config. | `data-table1` com schemas (sort/filter por coluna); `Form` do shadcn (RHF) no Drawer pra validação inline. |
| `EtapasPage.tsx` | `/cadastros/etapas` | Lista hierárquica de etapas/subetapas/itens com agregação de valores. | `accordion-standard-1` ou `tree` pra hierarquia (hoje é flat com badges de tipo). |
| `UnificacaoPage.tsx` | `/cadastros/unificacao` | Lista pares Colaborador×Funcionário sugeridos com botões pular/vincular. | Layout `compare1` side-by-side; `comparison_table` pra evidenciar diferenças. |
| `RodoTrackerPage.tsx` | `/medicao/*` | Mapa Leaflet + sidebar arrastável + modais + views planejamento/medição. | Módulo mais polido. Adicionar `kbd` shortcuts e `command-standard-1` palette pra alternar obras/atividades. |
| `ApontamentoPage.tsx` | `/apontamento` | 7 abas (Dashboard, Funcionários, Alocação, Ponto, Serviço, Aprovação, Histórico) + Drawer. | Tabs custom → `Tabs` shadcn; `data-table1` em Ponto/Serviço. |
| `MEquipamentosPage.tsx` (105 LOC) | `/m` | Busca + lista de equipamentos ativos, link pro hub. | `command-mobile-1`; skeleton de lista (hoje `isLoading` sem feedback). |
| `MEquipamentoHubPage.tsx` (225 LOC) | `/m/eq/:id` | Cards grandes de ações filtrados por permissão. | Bom pro mobile. Adicionar `alert-warning-1` quando equipamento `fora_funcionamento`. |
| `MEquipamentoInfoPage.tsx` (143 LOC) | `/m/eq/:id/info` | Lista de linhas com ícone+label+valor. | Usar `description-list` pattern em vez do `Linha` custom inline. |
| `MChecklistPage.tsx` (527 LOC) | `/m/checklist/:id` | Perguntas do template, captura foto+observação em "não", envia ou enfileira offline. | `accordion-standard-1` pras categorias; `progress` indicator (hoje sem feedback do quanto falta). |
| `MMedicaoPage.tsx` (235 LOC) | `/m/medicao/:id` | Form de horímetro/km online/offline. | `input-group-standard-1` com unidade (h/km) acoplada. |
| `MAbrirOSPage.tsx` (389 LOC) | `/m/abrir-os/:id` | Form de defeito + até 5 fotos, sintomas como chips. | Chips → `badge` clicáveis; `file-upload-photo-1` pras fotos. |
| `MSaidaCombustivelPage.tsx` (317 LOC) | `/m/saida-combustivel/:id` | Form de saída de combustível (tanque, litros, medição, foto). | `field-standard-1` com erro inline; `sonner-standard-1` no lugar do toast custom. |

### 3.1 Padrões transversais (aplicam-se a quase todas as telas)

1. **Loading:** 9 de 10 páginas usam `<p>Carregando...</p>` em vez do `Skeleton` que já existe. Padronizar.
2. **Empty states:** nenhum componente `Empty` no projeto. Aplicar `empty-standard-1` (22 variantes disponíveis).
3. **Erros:** sem `Alert` / `ErrorBoundary` — erros caem em `console`/`toast`. Adotar `alert-error-1`.
4. **Tabs custom:** `Compras`, `Frete`, `Financeiro`, `Manutencao`, `Apontamento` cada um reimplementa abas com spans + URL params. Centralizar em `Tabs` shadcn.
5. **Tabelas:** zero tabela tem sort por coluna nem paginação real — todas `.map()` em arrays do React Query. Migrar pra `data-table1` (32 variantes) com `@tanstack/react-table`.
6. **Forms:** nenhum form usa React Hook Form + Zod. Cada um faz `useState` por campo. Padronizar com `form-*` blocks + RHF + zod.
7. **CSS-vars manuais vs tokens shadcn:** páginas inteiras usam `bg-[var(--color-surface)]`/`text-[var(--color-fg)]` em vez de `bg-background`/`text-foreground`. Migração híbrida em curso (pasta `components/shadcn/` recém-criada) — finalizar.
8. **Modal vs Sheet/Drawer:** existem `Modal` e `Drawer` custom. shadcn oferece `Dialog`/`Sheet`/`Drawer` (17+22+29 variantes). Substituir.

---

## 4. Testes

### 4.1 Inventário

```
tests/example.spec.ts                        ← único arquivo de teste
```

É o **boilerplate default do `npm init playwright`**: testa o site `playwright.dev`, **não o app**.

### 4.2 Configuração

| Camada | Configurado? | Tem testes reais? | Cobertura |
|---|---|---|---|
| Unit (vitest/jest) | **Não** | Não | 0% |
| Integration | **Não** | Não | 0% |
| E2E (playwright) | Sim (3 browsers, `baseURL: localhost:5173`, `webServer: npm run dev`) | Não — só boilerplate | 0% do app |

Existe `RELATORIO_SMOKE_TEST_COMPRAS.md` (17 KB) no root sugerindo que testes manuais foram feitos. Nada automatizado.

### 4.3 Top 3 fluxos E2E pra implementar primeiro (por risco de negócio)

#### 1. Compras: Pedido → Cotação → OC → Recebimento

**Por quê:** Fluxo financeiro mais crítico. Erro = pagamento errado, OC duplicada, estoque inconsistente. `Compras.tsx` tem 1.341 LOC e múltiplas mutations em cadeia.

**Assertions:**
- Login com usuário com `criar_compra` + `aprovar_pedido`
- Criar pedido com 2 itens, aprovar, ver na aba Cotações com status correto
- Lançar 2 fornecedores, escolher vencedor, ver OC gerada com numeração sequencial (`PC-2026-XXX`)
- Receber OC parcialmente, conferir que saldo no depósito aumenta exatamente em `qtd_recebida` e status vira `parcial`
- Excluir pedido → confirmar modal e ver registro na lixeira (`useComprasLixeira`)

#### 2. Login + permissões + redirect

**Por quê:** Toda a app está atrás de `ProtectedRoute` + `temAcao`. Quebrar isso é incidente de segurança. `HomeRedirect` (`App.tsx:65-79`) decide tela inicial por permissão — fácil regressar.

**Assertions:**
- Usuário sem permissão alguma → `/acesso-negado`
- Usuário com só `ver_compras` → redirect de `/` direto pra `/compras` (linha 72-76)
- Acessar `/financeiro` por URL direta sem `modulo=financeiro` → `AcessoNegado`
- Após 5 tentativas → countdown aparece e botão fica disabled (`Login.tsx:22-41`)
- Logout limpa sessão e volta pra `/login`

#### 3. Checklist pré-uso mobile (offline-first)

**Por quê:** Único fluxo offline-first do app (`enqueueChecklist` + `indexedDBSuportado`). Falha = operador sem como liberar equipamento OU perda de dados ao reconectar.

**Assertions:**
- Listar equipamentos, abrir hub, iniciar checklist
- Responder "não" em pergunta obrigatória → exigir foto + observação (botão "Concluir" disabled antes)
- Concluir online → insert em `checklist_respostas` e redirect pro hub
- Repetir com `context.setOffline(true)` → IndexedDB + mensagem "salvo offline" (`MChecklistPage.tsx:23` usa `enqueueChecklist`)
- Voltar online → checklist sobe automaticamente (testar `useOfflineSync`/`useChecklistSync`)

---

## 5. Segurança — Top 5 problemas urgentes

Auditoria com leitura efetiva do código + advisors Supabase. Severidade decrescente.

### #1 — RLS plano: 91 tabelas com `USING (true)` (Severity: HIGH)

**Onde:**
- `supabase/schema.sql:22,251,261,274,297,616` e ~20 linhas similares
- `supabase/migrations/20260425120000_apontamento_schema.sql:272-289`
- Confirmado pelo advisor `rls_policy_always_true` em 91 tabelas

**Categoria:** rls_missing / broken_authorization

**Descrição:** Todas as tabelas sensíveis — `funcionarios` (CPF, endereço, DOB), `colaboradores` (CPF/RG), `perfis_permissao`, `audit_log`, `apont_funcionarios` (com `fotos_referencia_facial` biométricas), `cotacoes`, financeiro — usam a mesma policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. Sem qualquer restrição por usuário, cargo ou módulo no DB. Toda autorização está apenas na UI via `temAcao()`.

**Exploit:** Qualquer usuário logado abre DevTools, pega o JWT da sessão, e do console roda `supabase.from('funcionarios').select('*')` pra exfiltrar todos os CPFs/endereços/telefones. Ou `supabase.from('perfis_permissao').update({permissoes:'<all true>'}).eq('funcionario_id', '<self>')` pra se promover a Admin. Ou `supabase.from('audit_log').delete().neq('id','')` pra apagar o rastro das próprias ações.

**Fix:** Trocar policies `authenticated → true` por policies que leiam `cargo`/`acoes_permitidas` de `funcionarios` via helper `SECURITY DEFINER` (ex.: `auth_user_has_action(text)`), restringindo write em `perfis_permissao`, `funcionarios`, `audit_log` e financeiro. Mínimo: travar UPDATE/DELETE em `perfis_permissao` e `audit_log` a `cargo='admin'`.

**Confiança:** 10

### #2 — `temPermissao` / `temAlgumaPermissao` sempre retornam `true` (Severity: HIGH)

**Onde:**
- `src/contexts/AuthContext.tsx:214-220`
- `src/components/auth/PermissionGate.tsx:14`

**Categoria:** auth_bypass

**Descrição:** Hard-coded `return true`. Todo `<PermissionGate>` é no-op — qualquer botão de aprovar/excluir/editar escondido por gate é renderizado pra qualquer usuário. `ProtectedRoute` usa o `temAcao` separado (correto, fail-closed) então roteamento sobrevive, mas botões in-page não.

**Exploit:** Usuário "Visualizador" entra numa página permitida (ex.: Funcionários). Botão de excluir escondido por `<PermissionGate modulo="..." acao="excluir">` aparece pra ele. Clica, mutation passa pelo backend (que aceita por causa do #1).

**Fix:** Em `AuthContext.tsx`, implementar `temPermissao(modulo, acao)` checando `usuario.permissoes[modulo][acao]` (e fail-closed quando `usuario` null), igual ao padrão de `temAcao`. Auditar todos os `<PermissionGate>` existentes depois.

**Confiança:** 10

### #3 — `login_attempts` grava por `anon`, defeitando lockout (Severity: HIGH)

**Onde:**
- `supabase/schema.sql:296-299`
- `src/contexts/AuthContext.tsx:131-160`

**Categoria:** auth_bypass / rate_limit_bypass

**Descrição:** Lockout é client-side: `login()` lê `login_attempts`, bloqueia se `bloqueado_ate > now`, em falha faz upsert incrementando. Pra suportar pré-auth, a tabela tem `CREATE POLICY "Anon access login_attempts" FOR ALL TO anon USING (true) WITH CHECK (true)`. Qualquer um (sem auth) lê e escreve.

**Exploit:** Atacante (a) chama `supabase.auth.signInWithPassword` direto sem tocar `login_attempts`, OU (b) antes de cada tentativa faz `supabase.from('login_attempts').delete().eq('email', alvo)` pra zerar o contador, OU (c) lê pra enumerar quais e-mails estão bloqueados.

**Fix:** Mover lockout pra função Postgres `SECURITY DEFINER` exposta como RPC (`register_login_attempt(email)`, `is_locked(email)`), travando a tabela em `service_role`. Idealmente: usar rate-limiting nativo do Supabase Auth + CAPTCHA.

**Confiança:** 10

### #4 — Portal público de cotação permite escrita anônima sem validação server-side (Severity: MEDIUM)

**Onde:**
- `src/pages/PortalCotacao.tsx:36-61, 116-131`
- `src/hooks/useCotacaoLinksPublicos.ts:113-129, 161-194`

**Categoria:** data_integrity / broken_authorization

**Descrição:** `/cotacao/r/:token` roda com cliente anon e (1) lê `cotacoes` + `fornecedores` por id (linha completa, com CNPJ/email/telefone), (2) insere em `cotacao_respostas_fornecedor`, (3) faz `update(...)` raw em `cotacao_links_publicos.respondido=true`. Validação de token só na UI — comentário em `useCotacaoLinksPublicos.ts:159` admite "RLS aberta cobre o INSERT". Token de 32 chars `crypto.getRandomValues` é forte, mas concede leitura completa + escrita pra quem o possui.

**Exploit:** Fornecedor com link válido pode: (a) enviar resposta pra ID de outro link (a mutation aceita qualquer `link` que vier do cliente, não re-deriva do token); (b) flipar `respondido=true` em link alheio pra trancar o concorrente; (c) inserir várias respostas se burlar o check de UI. Link encaminhado dá leitura da cotação + contato do fornecedor pra qualquer terceiro.

**Fix:** Trocar acesso anon a tabelas por RPC Postgres `responder_cotacao(token, payload)` `SECURITY DEFINER` que (a) carrega link por token dentro da função, (b) valida expiry + not-yet-responded atomicamente, (c) insere resposta e atualiza link na mesma transação, (d) retorna só os campos mínimos. Tirar policies anon das tabelas. Considerar tokens one-time-use.

**Confiança:** 9

### #5 — Uploads sem validação + URLs assinadas por 1 ano (Severity: MEDIUM)

**Onde:**
- `src/modules/apontamento/utils/apontamentoApi.ts:457-475` (`uploadDocumento`)
- `src/modules/apontamento/utils/apontamentoApi.ts:416-429` (`uploadFoto`)
- `src/components/combustivel/FotoCaptureUploader.tsx:6` (`SIGNED_URL_TTL_SECS = 60 * 60 * 24 * 365`)
- Bucket `financeiro-anexos` — advisor `public_bucket_allows_listing` ativo

**Categoria:** file_upload / pii_leak

**Descrição:** `uploadDocumento` (docs RH por funcionário) aceita qualquer tipo/tamanho — só sanitiza filename, sem MIME allowlist nem max-size, `contentType` default `application/octet-stream`. `uploadFoto` (foto de referência facial) idem. RLS de storage é o mesmo padrão `authenticated → all`. `FotoCaptureUploader.tsx` minta signed URLs **válidas por 1 ano** pra fotos de combustível com GPS+timestamp overlaid — se vazarem (logs, screenshots, sync), qualquer um na internet busca a imagem por 12 meses. Bucket `financeiro-anexos` é público e listável.

**Exploit:** (a) Funcionário loga e faz upload de 2 GB ou executável mascarado de doc em qualquer `funcionarioId` pra consumir storage / hospedar arquivo malicioso. (b) Por causa do RLS plano, qualquer user `list`/`download` fotos biométricas e documentos pessoais (RG, CPF, contrato) de outros. (c) Signed URL de combustível colada em Slack/email/log expõe foto GPS-tagueada por um ano sem revogar.

**Fix:** Em `uploadDocumento`, enforce MIME allowlist + size cap (10 MB), espelhando `FotoCaptureUploader`. Reduzir `SIGNED_URL_TTL_SECS` pra horas (re-mint on demand). Storage RLS por prefixo de path (`name like auth.uid() || '/%'` ou via lookup em `funcionarios.auth_user_id`). Biometria e docs RH: servir só via backend, sem signed URL no cliente.

**Confiança:** 8

### Out of scope (mas vale flagar)

- `update_datas.mjs` e `check_db.mjs` na raiz contêm URL/anon key do Supabase inline — são publishable por design, mas idealmente moveriam pra `scripts/` pra não parecer secret commitado.
- `.env.local` com `SUPABASE_SERVICE_ROLE_KEY` real está gitignorado corretamente. Confirmar histórico: `git log --all -- .env.local` não deve mostrar nada.

---

## 6. Próximos passos sugeridos (por ordem)

### Bloco 1 — Segurança crítica (fazer antes de qualquer feature nova)

1. **Corrigir `temPermissao()`** em `AuthContext.tsx:214-220` (1h de trabalho, destrava o resto)
2. **Reescrever RLS policies** em pelo menos 5 tabelas críticas: `perfis_permissao`, `funcionarios`, `colaboradores`, `audit_log`, `financeiro_lancamentos`. Usar helper `SECURITY DEFINER` que lê `cargo`/`acoes_permitidas`. Recompilar views afetadas com `WITH (security_invoker = true)`.
3. **Trancar `login_attempts`** atrás de RPC; remover policy anon
4. **Reescrever portal de cotação** com RPC `responder_cotacao(token, payload)` SECURITY DEFINER
5. **Endurecer uploads:** MIME allowlist + size cap; reduzir TTL de signed URL pra horas

### Bloco 2 — Higiene do código (sem feature, baixo risco)

1. **Deletar** `src/pages/Insumos.tsx` (órfão) e rota `/cadastros/legado` + `src/pages/Obras.tsx` (3.069 LOC)
2. **Configurar vitest** (não tem unit-test framework) — adicionar ao `package.json` + script `test`
3. **Escrever os 3 testes E2E** prioritários (Compras, Login+permissões, Checklist offline) — base já está pronta no `playwright.config.ts`
4. **Indexar as 68 FKs** sem índice (lista no advisor de performance) — script único de migration

### Bloco 3 — Modernização de UI (gradual, sob demanda)

1. Quando tocar numa página, aproveitar pra **migrar tabs custom → `Tabs` shadcn** e **`<p>Carregando...</p>` → `Skeleton`**
2. Trocar `Modal`/`Drawer` custom por `Dialog`/`Sheet` shadcn
3. Adotar React Hook Form + Zod nos forms novos
4. Substituir tabelas-`.map` por `data-table1` (com `@tanstack/react-table`) começando pelas maiores (Compras, Frete, Apontamento)
5. Padronizar `EmptyState` (`empty-standard-1`) e `Alert` (`alert-error-1`)

### Bloco 4 — Banco / performance (quando volume crescer)

1. Recompilar todas as 12 views com `security_invoker = true`
2. Setar `search_path` nas 2 funções `fn_apont_escalar_*`
3. Trocar policy do bucket `financeiro-anexos` (não-listável publicamente)
4. Auditar e remover os 37 índices não usados
5. Dropar os 3 backups (`abastecimentos_backup_*`, `etapas_obra_backup_*`) em 2026-07-04 conforme planejado

---

**Fim do relatório.** Sem modificações no código — apenas este `audit.md` foi criado.
