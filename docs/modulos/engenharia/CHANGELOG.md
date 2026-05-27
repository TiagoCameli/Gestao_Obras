# Engenharia — CHANGELOG

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
