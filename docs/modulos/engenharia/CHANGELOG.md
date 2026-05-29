# Engenharia — CHANGELOG

## Onda Prancha v1 (2026-05-29)

### O que é

Novo tipo de bloco **Prancha** — quadro livre (canvas) ao lado de Nota e Cálculo. O usuário seleciona uma ferramenta na paleta lateral e aplica onde clicar no canvas. Elementos v1: caixa de texto, caixa de cálculo (reusa `recalcularDocumento` + `LinhaCalculo`), e formas geométricas SVG (linha, retângulo, quadrado, círculo).

### Banco de dados

- **2 tabelas novas:** `engenharia_pranchas` + `engenharia_pranchas_versoes`.
- **RLS per-command** em ambas as tabelas via `private.current_has_action(...)`.
- **1 função SECDEF nova:** `engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int)` — atomiza snapshot da versão + UPDATE da prancha. Optimistic concurrency via `p_versao_atual` (rejeita `conflito_versao` se DB já avançou). Cap de 50 versões por prancha (D-9). GRANT EXECUTE só para authenticated; REVOKE de anon/public.
- **Migration `20260529120000`** (+ rollback): tabelas + RLS + função SECDEF.
- **Migration `20260529130000`** (+ rollback): backfill das chaves de permissão por cargo.
- **Migrations ainda NÃO aplicadas no banco — aplicar via `supabase db push` / MCP no merge.**

### Permissões

- 3 chaves novas em `ACOES_PLATAFORMA`: `criar_engenharia_prancha`, `editar_engenharia_prancha`, `excluir_engenharia_prancha`.
- Deps adicionadas em `DEPENDENCIAS_ACOES` (`ver_engenharia` como raiz).
- `TEMPLATES_ACOES_POR_CARGO` atualizado para todos os cargos aplicáveis.

### Frontend

- Canvas DIY com `react-moveable@^0.56` (mover, redimensionar, rotacionar elementos).
- Formas SVG nativas (linha, retângulo, quadrado, círculo).
- Componentes React: `PranchaCanvas.tsx`, `PranchaToolbar.tsx`, `ElementoTexto.tsx`, `ElementoCalculo.tsx`, `ElementoForma.tsx`, `PranchaPage.tsx`.
- `ElementoCalculo` reusa `recalcularDocumento` + `LinhaCalculo` da Onda 6a — sem duplicação de engine.
- `src/modules/engenharia/types/prancha.ts` — `EngenhariaPrancha`, `EngenhariaPranchaVersao`, `ElementoPrancha` (union `texto | calculo | forma`) + mappers.
- `src/modules/engenharia/hooks/useEngenhariaPranchas.ts` — `useEngenhariaPrancha`, `usePranchasDaPasta`, `useCriarPrancha`, `useSalvarPrancha` (RPC), `useSoftDeletePrancha`.
- Lock pessimista via `useLockRecurso('prancha', id)` (mesmo hook genérico da Nota e do Cálculo).
- Auto-save debounce 5s + Cmd/Ctrl+S manual. Mensagem dedicada para `conflito_versao` com botão "Recarregar".
- `src/modules/engenharia/services/pranchaModel.ts` — modelo puro (lógica de criação/atualização de elementos, sem efeitos colaterais).
- Rota `/engenharia/prancha/:id` (lazy) + `ProtectedRoute acao="ver_engenharia"`.
- `PastaPage.tsx` — item "Novo > Prancha" habilitado; hidden quando `!temAcao('criar_engenharia_prancha')`.

### Libs novas

- `react-moveable@^0.56` — mover/redimensionar/rotacionar elementos no canvas.

### Testes

- 5 Vitest em `pranchaModel.test.ts` (modelo puro: criar elemento, atualizar posição, remover, tipos distintos, canvas vazio).
- `src/utils/permissions.test.ts` atualizado para incluir as 3 novas chaves de prancha.
- 1 spec Playwright `tests/engenharia-prancha.spec.ts` (1 cenário ativo: criar prancha + abrir canvas; roda após aplicar a migration).

### Migrations (2 pares fix+rollback)

| Timestamp | Conteúdo |
|---|---|
| `20260529120000` | Tabelas `engenharia_pranchas` + `_versoes` + RLS + função SECDEF `engenharia_salvar_prancha_com_versao` |
| `20260529130000` | Backfill das chaves de permissão por cargo |

### Fora da v1 (próximas ondas)

Pan/zoom interativo, undo/redo, snap a grid, histórico na UI, variável compartilhada entre blocos, e fases P2–P5 do roadmap (mini-planilha, conversor de unidades, templates de cálculo, cota com escala, seção de pavimento, régua de km). Ver spec `docs/superpowers/specs/2026-05-28-engenharia-prancha-quadro-livre-design.md`.

### Verificação

- `npx tsc -b`: **0 erros**.
- `npx vitest run src/modules/engenharia/ src/utils/permissions.test.ts`: **94/94 passing** (9 test files).
- `npm run build`: build OK — chunk lazy `PranchaPage-BCLMLUYc.js` emitido (242.63 kB / 80.01 kB gzip).

---

## Onda 1 — Schema, RLS, triggers, locks (2026-05-26)

### Banco de dados

- **7 tabelas novas:**
  - `engenharia_pastas` (árvore hierárquica; `obra_id` ON DELETE SET NULL via D-3)
  - `engenharia_notas` + `engenharia_notas_versoes`
  - `engenharia_calculos` + `engenharia_calculos_versoes`
  - `engenharia_arquivos` (com check 0 < tamanho ≤ 50 MB)
  - `engenharia_locks` (pessimista, D-4 revisada)
- **11 índices** (incluindo 2 unique parciais: `(parent_id, lower(nome))` para subpastas e `obra_id` para pasta raiz única por obra).
- **RLS per-command** em todas as 7 tabelas via `private.current_has_action(...)`. 26 policies; locks tem INSERT/UPDATE bloqueado direto via REST (`with check (false)`) — só via funções SECDEF.
- **3 triggers SECDEF em `obras`:**
  - `AFTER INSERT` → cria pasta raiz automaticamente.
  - `AFTER UPDATE of nome` → sincroniza nome da pasta.
  - `BEFORE DELETE` → converte pasta raiz em `tipo='avulsa'` com prefixo `[Arquivada YYYY-MM-DD]` (D-3). Conteúdo de engenharia não some quando obra é apagada.
- **2 funções SECDEF para lock pessimista:**
  - `engenharia_acquire_lock(tipo, id, ttl_seg=300)` retorna `(adquirido, dono, expira_em)`. Idempotente: renova se for dono. Gate por permissão.
  - `engenharia_release_lock(tipo, id)` libera só o lock próprio.
- **Backfill** das 4 obras existentes — todas ganharam pasta raiz.

### Frontend

- `src/utils/permissions.ts`:
  - **17 chaves novas** em `ACOES_PLATAFORMA` no grupo `'Engenharia'`.
  - **16 deps** em `DEPENDENCIAS_ACOES` (`ver_engenharia` é raiz).
  - **TEMPLATES_ACOES_POR_CARGO** estendido para 7 cargos (Admin é automático via `[...TODAS_ACOES_PLATAFORMA]`; Operador/Apontador sem acesso).
- `src/utils/permissions.test.ts`: 14 testes Vitest verdes cobrindo `ACOES_PLATAFORMA`, `DEPENDENCIAS_ACOES`, e os 11 cargos.

### Migrations (5 pares fix+rollback)

| Timestamp | Conteúdo |
|---|---|
| `20260526150000` | 7 tabelas + índices + checks |
| `20260526160000` | RLS per-command + 26 policies |
| `20260526170000` | 3 triggers SECDEF em obras + backfill |
| `20260526180000` | 2 funções SECDEF de lock |
| `20260526190000` | Perf fix: `(select auth.uid())` na policy de delete em locks |

### Decisões aplicadas

D-2 (SECDEF), D-3 (obra deletada → pasta avulsa), D-4 revisada (lock pessimista, sem Yjs), D-5 (PermissionGate sem refactor), D-6 (palavras reservadas — Onda 6), D-7 (50 MB), D-8 (libs aprovadas em bloco).

### Não feitos nesta onda (esperados)

- 7 INFO `Unindexed foreign keys` em `criado_por`/`autor_id`/`usuario_id` — apontam pra `auth.users` só para display, sem JOIN/cascade frequente. Custo zero real. Não adicionar covering indexes desnecessários.
- 12+ INFO `Unused Index` — tabelas vazias; some quando UI da Onda 3 começar a consultar.

### Tech debt registrada (não bloqueante)

- `PermissionGate` legado em `src/components/auth/PermissionGate.tsx` — só conhece os 5 módulos antigos. Engenharia usa gates inline (`temAcao`). Refactor do PermissionGate é outro projeto.

### Verificação

- `mcp get_advisors security`: zero issues novos em `engenharia_*`.
- `mcp get_advisors performance`: 1 WARN corrigido (perf fix), restante são INFOs esperados.
- Smoke test SQL (DO block): 4 cenários OK (insert/update/delete/idempotência).
- `npx tsc -b`: 0 erros.
- `npx vitest run src/utils/permissions.test.ts`: 14/14 passing.
- 5 commits do módulo Engenharia + 1 commit do schema.sql.

---

## Onda 2 — Storage de arquivos (2026-05-26)

### Banco

- Bucket privado `engenharia-arquivos` (50 MB limite, 20 MIME types: PDF/Office/Excel/imagens/DWG/CSV/ZIP).
- 4 policies em `storage.objects` (per-command), gated por chaves Engenharia:
  - SELECT: `ver_engenharia`
  - INSERT: `upload_engenharia_arquivo`
  - UPDATE: `upload_engenharia_arquivo`
  - DELETE: `excluir_engenharia_arquivo` OR `excluir_permanente_engenharia`
- **Security hardening (Onda 2.2):** REVOKE EXECUTE das 5 funções SECDEF de:
  - `engenharia_after_insert_obra`, `engenharia_after_update_obra_nome`, `engenharia_before_delete_obra` — bloqueado de TODOS (anon/authenticated/public). São triggers, não devem ser chamadas via RPC.
  - `engenharia_acquire_lock`, `engenharia_release_lock` — bloqueado de anon/public (mantém grant para authenticated).
  - Elimina 8 dos 10 WARNs "SECDEF callable" do advisor; 2 remanescentes (authenticated x lock) são comportamento esperado.

### Frontend

- `src/modules/engenharia/services/` (novo diretório do módulo):
  - `arquivosPath.ts` — helpers puros: `slugify`, `extractExtension`, `buildStoragePath`.
  - `arquivosMime.ts` — constantes: `TAMANHO_MAX_BYTES` (50 MB), `MIME_PERMITIDOS` (20), `EXTENSOES_BLOQUEADAS` (26).
  - `arquivosService.ts` — 3 funções: `uploadArquivo`, `getSignedUrl`, `softDeleteArquivo`.

### Validação de upload (4 camadas)

1. Tamanho > 0 e ≤ 50 MB.
2. Extensão NÃO está na lista de 26 bloqueadas (`.exe`, `.bat`, `.sh`, `.scr`, `.dll`, `.jar`, `.app`, `.vbs`, `.js`, `.lnk`, etc.).
3. MIME real (bytes via `file-type`) está em `MIME_PERMITIDOS`.
4. Cleanup best-effort: se INSERT no DB falhar após upload, deleta o objeto do storage.

### Lib nova

- `file-type@^22.0.1` (~30 KB gzip).

### Migrations (3 pares fix+rollback)

| Timestamp | Conteúdo |
|---|---|
| `20260527100000` | Bucket privado + 4 policies em `storage.objects` |
| `20260527110000` | REVOKE EXECUTE nas 5 funções SECDEF (security hardening) |

### Testes

- 12 Vitest em `arquivosPath.test.ts` (helpers puros: slugify/extractExtension/buildStoragePath).
- 11 Vitest em `arquivosService.test.ts` (mock supabase + file-type; cobre validações + cleanup + signed URL + soft-delete).
- Total: **23 testes verdes**.

### Verificação

- `mcp get_advisors security`: 8 WARNs corrigidos (SECDEF revoke); 2 remanescentes são esperados.
- `npx tsc -b`: 0 erros.
- Bucket + 4 policies confirmados via `execute_sql`.
- 6 commits do módulo Engenharia nesta onda.

### Não feitos nesta onda (intencional)

- **Playwright E2E** — sem UI ainda. E2E real fica para a Onda 3 (UI de pastas + drop zone de upload).
- **Cron de limpeza de bytes soft-deletados** — tarefa futura (após 30 dias do `deleted_at`).

---

## Onda 3 — UI de Pastas (2026-05-27)

### Banco

- **1 trigger SECDEF**: `engenharia_pastas_check_no_cycle()` — BEFORE UPDATE of `parent_id` em `engenharia_pastas`.
  - Rejeita `new.parent_id = NEW.id` (self-parent).
  - Rejeita se `new.parent_id` está nos descendentes de `NEW.id` (ciclo) via CTE recursiva.
  - Permite `new.parent_id = NULL` (pasta vira raiz).
  - REVOKE EXECUTE de anon/authenticated/public — só roda via trigger.

### shadcn components adicionados

- `context-menu` — right-click em FolderCard.
- `skeleton` — loading states em listings.
- `breadcrumb` — navegação Engenharia / Pasta atual.

### Frontend (`src/modules/engenharia/`)

- `types/pasta.ts` — `EngenhariaPasta` (camelCase) + `EngenhariaPastaRow` (snake_case) + `dbToEngenhariaPasta()` mapper.
- `hooks/useEngenhariaPastas.ts` — 7 queries/mutators com `@tanstack/react-query`:
  - `useEngenhariaPastasRaizes()` — home `/engenharia`.
  - `useEngenhariaPastasFilhas(parentId)` — sidebar tree lazy + listing.
  - `useEngenhariaPasta(id)` — detalhe da pasta atual.
  - `useCriarPasta()` — calcula caminho via parent.
  - `useRenomearPasta()`.
  - `useMoverPasta()` — auto-ajusta tipo (subpasta/avulsa).
  - `useSoftDeletePasta()` — set `deleted_at`.
- `components/`:
  - `FolderCard.tsx` — Card + ContextMenu (Abrir/Renomear/Mover/Excluir) com gates por permissão e AlertDialog pro soft-delete.
  - `FolderTree.tsx` — sidebar recursivo com lazy-load por expansão.
  - `FolderBreadcrumb.tsx` — Engenharia / atual.
  - `FileDropZone.tsx` — drag-and-drop + botão "Selecionar arquivos" (consome `arquivosService` da Onda 2).
  - `CriarPastaDialog.tsx`, `RenomearPastaDialog.tsx`, `MoverPastaDialog.tsx` — RHF+Zod, shadcn Dialog.
- `pages/`:
  - `EngenhariaPage.tsx` — home com 2 seções (Obras + Avulsas) + botão "Nova pasta avulsa".
  - `PastaPage.tsx` — sidebar tree + breadcrumb + listing + dropzone + dropdown "Novo" (subpasta agora; nota/cálculo desabilitados aguardando Ondas 4/5).

### Rotas

- `/engenharia` (lazy) — gateada por `ProtectedRoute acao="ver_engenharia"`.
- `/engenharia/pasta/:id` (lazy) — idem.
- Link em `Header.tsx` entre Obras e Cadastros, active-match prefix.
- Entrada em `PAGINAS_FALLBACK`: `{ acao: 'ver_engenharia', rota: '/engenharia' }`.

### Migrations (1 par fix+rollback)

| Timestamp | Conteúdo |
|---|---|
| `20260527120000` | Trigger anti-ciclo + REVOKE EXECUTE |

### Testes

- 1 Vitest existente (23 da Onda 2) continua verde.
- Playwright E2E `tests/engenharia-pastas.spec.ts` — 5 cenários:
  1. Home `/engenharia` mostra seções Obras e Avulsas.
  2. Criar pasta avulsa via dialog.
  3. Navegar para pasta e criar subpasta via dropdown "Novo".
  4. Soft-delete via context-menu + AlertDialog.
  5. Renomear pasta de obra mostra item disabled com tag "via Obras".

### Verificação

- Smoke test SQL do trigger: 3 cenários OK (ciclo bloqueado, self-parent bloqueado, move válido aceito).
- `npx tsc -b`: 0 erros em `engenharia/`, `App.tsx`, `Header.tsx` (erros em rodotracker são de trabalho concorrente).
- 6+1 commits do módulo Engenharia nesta onda (subagent fez 5, mais 1 wrap-up de context-menu).

### Limitações conhecidas v1

- **Breadcrumb mostra só "Engenharia / Pasta Atual"** — render completo da cadeia exige parsing do `caminho` ou query recursiva. Refinamento (~30 min) fica para Onda 8 (polish).
- **DnD para mover pastas** — não nesta onda. Move via dialog basta MVP. DnD com @dnd-kit é refinamento Onda 8.

### Onda 3.2 (refinamento incluído)

- Subagent original deixou rename/delete acessíveis apenas via Dialog (sem entry-point). Wave 3.2 wirou `ContextMenu` dentro do `FolderCard` com `Renomear / Mover / Excluir` e destravou os 2 Playwright tests correspondentes.

---

## Onda 4 — Bloco de Nota (Tiptap + lock pessimista) (2026-05-27)

### Banco de dados

- **1 função SECDEF nova:** `engenharia_salvar_nota_com_versao(uuid, text, jsonb, int)` — atomiza snapshot da versão + UPDATE da nota numa única transação plpgsql. Optimistic concurrency via `p_versao_atual` (rejeita `conflito_versao` se DB já avançou). Cap de 50 versões por nota (D-9). GRANT EXECUTE só pra authenticated; REVOKE de anon/public.

### Frontend

- `src/modules/engenharia/types/nota.ts` — `EngenhariaNota`, `EngenhariaNotaVersao` + mappers `dbToEngenhariaNota` / `dbToEngenhariaNotaVersao`.
- `src/modules/engenharia/hooks/`:
  - `useLockRecurso.ts` (genérico, será reusado em cálculo na Onda 6). Estados: carregando/meu/outro/erro. Heartbeat 60s quando dono, polling 15s quando bloqueado, release no unmount.
  - `useEngenhariaNotas.ts` — `useEngenhariaNota`, `useNotasDaPasta`, `useCriarNota`, `useSalvarNota` (via RPC), `useSoftDeleteNota`.
  - `useNotaVersoes.ts` — `useNotaVersoes` + `useRestaurarVersao` (restaurar = chamar `engenharia_salvar_nota_com_versao` com conteúdo da versão alvo).
- `src/modules/engenharia/utils/prosemirrorText.ts` — `extrairTextoPlain` que caminha o JSON do ProseMirror preservando hardBreak (\n) e quebras de bloco (paragraph/heading/codeBlock/blockquote/tableRow).
- `src/modules/engenharia/components/`:
  - `LockBanner.tsx` — banner amarelo "Em uso por X" com countdown mm:ss + botão "Forçar liberação" (gate por `gerenciar_locks_engenharia`).
  - `NotaToolbar.tsx` — 18 botões de formatação (marks/headings/listas/inserts/aligns/blocks) + Salvar (Cmd+S hint) + Histórico (gate por `ver_historico_engenharia`).
  - `NotaEditor.tsx` — Tiptap com StarterKit + Underline + Image + Link + Table + TextAlign + Highlight + TaskList. Paste de imagem do clipboard via `arquivosService.uploadArquivo` + `getSignedUrl` (com `editorRef` para evitar orphan blob na janela do mount).
  - `HistoricoVersoesDrawer.tsx` — Sheet right com lista de versões (badge + autor via funcionarios + timestamp + preview 120 chars memoizado por versão) + "Ver diff" inline 2-pane (diffWords) + "Restaurar" com AlertDialog confirm (gate `!ehReadOnly`).
- `src/modules/engenharia/pages/NotaPage.tsx` — compõe LockBanner + Toolbar + Editor + Historico. Auto-save debounce 5s + Cmd/Ctrl+S manual (gated por readOnly). Mensagem dedicada para `conflito_versao` com botão "Recarregar" que invalida + refetch + resync local. Status "Salvando…/Salvo" com `aria-live="polite"`.
- `src/App.tsx` — rota `/engenharia/nota/:id` lazy + `ProtectedRoute acao="ver_engenharia"`.
- `src/modules/engenharia/pages/PastaPage.tsx` — dropdown "Novo > Nota" agora cria + navega (era disabled). Item escondido quando `!temAcao('criar_engenharia_nota')`.

### Libs novas

- `@tiptap/react@^3.23.6` + `@tiptap/starter-kit@^3.23.6` + 10 extensões (`image`, `link`, `table`, `table-row`, `table-header`, `table-cell`, `text-align`, `highlight`, `task-list`, `task-item`).
- `@tiptap/extension-underline@^3.23.6` — gap do plano original que assumia Underline em StarterKit; é package separado em Tiptap 3.x.
- `diff@^9.0.0` — histórico textual side-by-side.
- `@tailwindcss/typography@^0.5.19` (dev) — habilita classes `prose`/`prose-sm`/`dark:prose-invert` no editor; gap do plano original que assumia o plugin configurado.

### Migrations (1 par fix+rollback)

| Timestamp | Conteúdo |
|---|---|
| `20260528100000` | function SECDEF `engenharia_salvar_nota_com_versao` (atomico + optimistic concurrency + cap 50 versões) |

### Testes

- 5 Vitest novos em `useLockRecurso.test.ts` (acquire/release/poll/heartbeat/null-id).
- 6 Vitest novos em `prosemirrorText.test.ts` (text simples, hardBreak, parágrafos, listas aninhadas, vazio/null, tabelas).
- 1 spec Playwright novo em `tests/engenharia-notas.spec.ts` (4 cenários ativos: criar+abrir editor / auto-save / Cmd+S / abrir histórico; 1 cenário **skipped** aguardando fixture de 2 usuários na Onda 8).
- Total Vitest novos: **11**. Total Vitest do módulo: 34 verdes.

### Decisões aplicadas

D-4 revisada (lock pessimista, sem Yjs/CRDT), D-8 (libs aprovadas em bloco), D-9 (cap 50 versões).

### Não feitos nesta onda (intencional)

- Slash menu Tiptap (fica pra Onda 8, ~1h).
- Lock E2E 2-usuários (skipped no Playwright; depende de fixture criada na Onda 8).
- Diff visual lado-a-lado renderizando o JSON do ProseMirror (atual usa `diffWords` textual; v1 OK, refinamento futuro).

### Verificação

- `mcp get_advisors security`: 1 WARN esperado em `engenharia_salvar_nota_com_versao` ("Signed-In Users Can Execute SECURITY DEFINER") — função é pra ser chamada por authenticated, é o comportamento esperado. Sem regressões em outros lints.
- `npx tsc -b`: 0 erros.
- `npx vitest run src/modules/engenharia/`: 34/34 passing.
- `npm run build`: lazy chunk separado para `/engenharia/nota/:id` (~146 KB gzip).
- 14 commits do módulo Engenharia nesta onda (incluindo 4 commits de code review fixes).

---

## Onda 5 — Bloco de Cálculo, parte 1: parser, linhas, alerta (2026-05-28)

### Banco de dados

- **1 função SECDEF nova:** `engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int)` — atomiza snapshot da versão + UPDATE do cálculo. Optimistic concurrency via `p_versao_atual` (rejeita `conflito_versao`). Cap 50 versões (D-9). Inclui `p_alerta_ativo` (coluna do row, não do JSON). GRANT só authenticated; REVOKE anon/public.

### Frontend

- `src/modules/engenharia/services/calcEngine.ts` — `evalSafe` (math.js sandboxed) + `parseLinha` (separa `lhs=rhs`, avalia, compara). 13 testes Vitest.
- `src/modules/engenharia/types/calculo.ts` — `LinhaCalculo`, `DocumentoCalculo`, `EngenhariaCalculo`, `EngenhariaCalculoVersao` + mappers + `novaLinhaVazia`.
- `src/modules/engenharia/hooks/useEngenhariaCalculos.ts` — `useEngenhariaCalculo`, `useCalculosDaPasta`, `useCriarCalculo`, `useSalvarCalculo` (RPC), `useSoftDeleteCalculo`.
- `src/modules/engenharia/hooks/useCalculoVersoes.ts` — `useCalculoVersoes` + `useRestaurarVersaoCalculo`.
- `src/modules/engenharia/components/LinhaCalculo.tsx` — linha do canvas: input puro controlado + resultado como ghost text + alerta vermelho/⚠ quando RHS errado + botão "Alerta revisado".
- `src/modules/engenharia/components/CalculoToolbar.tsx` — switch "Verificação automática" + adicionar linha + Salvar + Histórico.
- `src/modules/engenharia/components/HistoricoCalculoDrawer.tsx` — espelha o HistoricoVersoesDrawer da Onda 4 (Sheet + lista + diff textual + restaurar), preview via `extrairTextoCalculo`.
- `src/modules/engenharia/pages/CalculoPage.tsx` — canvas com lock pessimista (`useLockRecurso('calculo', id)`) + auto-save debounce 5s + Cmd/Ctrl+S + recarregar em conflito.
- `src/App.tsx` — rota `/engenharia/calculo/:id` lazy + `ProtectedRoute acao="ver_engenharia"`.
- `src/modules/engenharia/pages/PastaPage.tsx` — dropdown "Novo > Cálculo" agora cria + navega (era disabled); hidden quando `!temAcao('criar_engenharia_calculo')`.

### Libs novas

- `mathjs@14.9.1` (~150 KB) — sandbox via `calcEngine`. Cai só no chunk lazy `/engenharia/calculo/:id` (~195 KB gzip total do chunk, mathjs incluso).

### Migrations (1 par fix+rollback)

| Timestamp | Conteúdo |
|---|---|
| `20260528200000` | function SECDEF `engenharia_salvar_calculo_com_versao` (atômico + optimistic concurrency + cap 50) |

### Testes

- 13 Vitest em `calcEngine.test.ts` (4 sandbox incl. `import`/`createUnit` throws; 9 parser).
- 1 spec Playwright `tests/engenharia-calculos.spec.ts` (5 ativos: cria+abre / `1+1=` preenche no blur / `2*5=11` alerta vermelho calculado=10 / "Alerta revisado" limpa / desligar switch tira o vermelho; 1 skipped lock 2-usuários — Onda 8).
- Total Vitest do módulo: 47 verdes.

### Divergências do plano (documentadas)

- **Sandbox math.js:** só `import` + `createUnit` são bloqueados, NÃO os 7 nomes que o plano-mestre listou. O `evaluate` do math.js usa `parse` internamente — sobrescrever `parse` quebra a engine. Seguimos a recomendação oficial (https://mathjs.org/docs/expressions/security.html).
- **`2*5=20 → ok` do prompt original é incorreto** (2*5=10). O parser segue a regra correta (RHS bate com LHS calculado); há teste Vitest documentando.
- **LinhaCalculo input controlado:** o design original (`value` computado) injetava o resultado no input ao digitar `=`, impedindo o usuário de digitar o próprio RHS. Corrigido: input puro em `linha.expressao` + resultado como ghost text à direita + auto-fill no blur.

### Verificação

- `get_advisors security`: 1 WARN esperado em `engenharia_salvar_calculo_com_versao` (authenticated SECDEF executável — comportamento esperado). Sem novos tipos de lint; total 77→78.
- `npx tsc -b`: 0 erros.
- `npx vitest run src/modules/engenharia/`: 47/47.
- `npm run build`: chunk lazy `CalculoPage-*.js` ~195 KB gzip (mathjs incluso).
- ~10 commits do módulo nesta onda.

### ⛔ Hard stop

Onda 6 (variáveis nomeadas + spinner + grid Excel + palavras reservadas) NÃO segue automático — requer aprovação manual do usuário (decisão do prompt original seção 5).

---

## Onda 6a — Bloco de Cálculo: variáveis (numéricas + string + aliases + reservadas) (2026-05-28)

> Parte da Onda 6 (sub-fases 6.1 + 6.2). Spinner (6.3), caixas de texto (6.4) e mini-grid (6.5) ficam para ondas 6b/6c/6d.

### Frontend / Engine

- `src/modules/engenharia/services/calcReservedWords.ts` — 36 palavras reservadas (funções/constantes math.js) + `normalizarNome` + `ehReservada`. Bloqueiam a DEFINIÇÃO de variável (não o uso da função). Decisão D-6.
- `src/modules/engenharia/services/calcDocumento.ts` — `recalcularDocumento(linhas)` (função pura): avaliação document-level com scope cumulativo, detecção atribuição-vs-avaliação, variáveis string com aliases (greedy longest-match + word boundaries), cascade. + `substituirAliases`.
- `src/modules/engenharia/components/LinhaCalculo.tsx` — refatorado: recebe `LinhaAvaliada` pronta (não chama mais `parseLinha`); input puro controlado; erro de reservada/indefinida inline via `avaliada.erroEngine`.
- `src/modules/engenharia/pages/CalculoPage.tsx` — `useMemo(recalcularDocumento(linhas))` → cascade; persiste resultado/alerta derivados preservando `revisado`.

### Regra de detecção (atribuição vs avaliação)

- LHS = identificador simples (`x`) OU string literal (`"Brita 4"`) com RHS não-vazio → **atribuição** (define variável). Ex: `x = 2*2`, `"Brita 4" = 110`.
- Caso contrário → **avaliação** (comportamento da Onda 5): `x*2=`, `2*5=11`.

### Variáveis string + aliases

- `"Brita 4" = 110` → chave segura `__sv_brita_4` no scope do math.js.
- Referências `brita4`, `Brita 4`, `BRITA 4` substituídas antes da avaliação por regex greedy longest-match com `\b` (word boundaries impedem casar dentro de chave já substituída ou de outros identificadores tipo `cobrita`).

### Palavras reservadas (D-6)

- `"sin" = 5`, `sin = 5`, `"log10" = 100` → rejeitados com erro inline ("é palavra reservada").
- `"viga_principal" = 5` → aceito. `sqrt(16)=` → funciona (só a definição é bloqueada).

### Testes

- +5 Vitest `calcReservedWords.test.ts`.
- +20 Vitest `calcDocumento.test.ts` (variáveis num/string, aliases, cenário canônico `x+y+brita4=117`, greedy longest-match, reservadas, compat Onda 5, `substituirAliases`).
- +3 Playwright `engenharia-calculos.spec.ts` (variável numérica cascade, cenário canônico 117, palavra reservada). Seletores de placeholder migrados pra regex.
- Total Vitest do módulo: **72 verdes**.

### Sem libs novas. Sem migration (só frontend/engine).

### Verificação

- `npx vitest run src/modules/engenharia/`: 72/72.
- `npx tsc -b`: 0 erros no escopo engenharia.
- Cenário canônico `x=4, y=3, "Brita 4"=110, x+y+brita4= → 117` ✓ (Vitest + Playwright).

### Pendente da Onda 6 (próximas ondas)

- 6b: spinner numérico (`@floating-ui/react`).
- 6c: caixas de texto livres (mini-Tiptap).
- 6d: mini-grid Excel (`react-data-grid`).
- Lock 2-contextos E2E + performance 100 linhas <200ms (quando houver virtualização).
