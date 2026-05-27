# Engenharia — Discovery (varredura do projeto antes do plano mestre)

> Documento produzido na Fase 0 do prompt do módulo **Engenharia** (workspace de obras com notas, cálculos e arquivos). Lista achados do código atual, decisões já travadas pelo padrão dominante do repo, e gaps que precisam de decisão antes da Fase 1.
>
> **Data:** 2026-05-26
> **Escopo:** somente leitura. Nenhum arquivo de feature/schema foi tocado.
> **Próximo doc:** `docs/superpowers/plans/2026-05-26-engenharia-modulo.md`.
>
> ⚠ **Status:** este doc é o snapshot pré-decisão. A seção 12 (gaps pendentes) **NÃO** é mais a fonte da verdade — desde 2026-05-26 as decisões foram respondidas pelo user. Consulte a **seção 9 do plano-mestre** para o log canônico de decisões (D-1 a D-10). Aqui ficou o raciocínio original como contexto histórico.

---

## 1. Stack confirmado (do `package.json`)

| Categoria | Lib | Versão | Já no projeto |
|---|---|---|---|
| Runtime | React | ^19.2.0 | sim |
| Build | Vite | ^7.3.1 | sim |
| TS | typescript | ~5.9.3 | sim |
| Estilo | Tailwind | ^4.1.18 (+ `@tailwindcss/vite`) | sim |
| UI | shadcn (`radix-nova`, base `neutral`, CSS vars) | ^4.7.0 | sim |
| State server | @tanstack/react-query | ^5.90.21 | sim |
| Tabelas | @tanstack/react-table | ^8.21.3 | sim |
| Forms | react-hook-form | ^7.76.0 | sim |
| Forms validação | zod | ^4.4.3 + @hookform/resolvers ^5.4.0 | sim |
| Router | react-router-dom | ^7.13.0 | sim |
| Backend | @supabase/supabase-js | ^2.95.3 | sim |
| PDFs | jspdf, jspdf-autotable, pdfjs-dist | já tem | sim |
| Excel | exceljs, xlsx, xlsx-js-style | já tem | sim |
| Testes E2E | @playwright/test | ^1.60.0 | sim |
| Testes unit | vitest | ^4.1.7, @testing-library/react | sim |

**Dependências NOVAS que o módulo vai precisar** (lista preliminar — cada uma será confirmada na Fase 0.2 do plano antes do `npm i`):

| Lib | Motivo | Tamanho gzip aprox. | Alternativa considerada |
|---|---|---|---|
| `mathjs` | parser/avaliador do bloco de cálculo (sandbox seguro com `import` desabilitado) | ~150 KB | escrever parser custom (descartado — risco enorme) |
| `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-*` | editor rich-text estilo Word do bloco de nota | ~120 KB modular | Lexical (mais leve mas API ainda em flux) |
| `@dnd-kit/core` + `@dnd-kit/sortable` | drag-and-drop de pastas e reordenar linhas do cálculo | ~30 KB | react-dnd (mais pesado, API legada) |
| `@floating-ui/react` | spinner flutuante sobre número selecionado | ~15 KB | popper.js (legado) |
| `react-data-grid` | mini-grid Excel-like dentro do bloco de cálculo | ~40 KB | Handsontable Community (licença restritiva pra uso comercial) |
| `@tanstack/react-virtual` | virtualização de árvore/listagem com muitos itens | ~10 KB | nativo (problemas com >100 itens) |
| `file-type` | validação MIME real no upload (não só extensão) | ~30 KB | confiar em extensão (descartado — vetor de bypass) |

**Total novo (gzip aprox.):** ~395 KB — significativo. **Mitigação:** lazy-load por rota — bloco-cálculo só carrega quando usuário abre uma página `/engenharia/calculo/:id`; bloco-nota idem. A rota raiz `/engenharia` só precisa de `react-data-grid` e `tiptap` se for usar previews — provavelmente não.

**Decisão pendente (entra no plano da Fase 0):** aprovar com o usuário cada dep >100 KB.

---

## 2. Sistema de permissões — DOIS sistemas coexistindo

Esse é o ponto mais importante do discovery. O prompt original assumiu o sistema *legacy* — mas o projeto migrou para um sistema flat. **Vamos usar o moderno.**

### 2.1 Sistema LEGACY (não usar pra engenharia)

- `src/utils/permissions.ts` — `MODULOS` (5: `dashboard`, `cadastros`, `frete`, `frota`, `funcionarios`) + `ACOES` (`visualizar | criar | editar | excluir | exportar | ajustar_filtros`).
- `PERFIL_<CARGO>` por cargo — matriz `{ modulo → acao[] }`.
- API: `useAuth().temPermissao(modulo, acao)`.
- Componente: `src/components/auth/PermissionGate.tsx` — usa exclusivamente o legacy. **Não cobre engenharia** (não tem o módulo no enum).

### 2.2 Sistema MODERNO (usar este)

- `src/utils/permissions.ts` — `ACOES_PLATAFORMA: AcaoPlataforma[]` — lista flat com `{ chave, label, grupo }`. Hoje tem ~280 chaves.
- Mapa `DEPENDENCIAS_ACOES: Record<string, string[]>` — declara dependências entre chaves (ex.: `editar_frete` depende de `ver_frete`). O formulário de permissões valida automaticamente.
- `ACOES_DESTRUTIVAS` — set marcado visualmente em vermelho no form de permissões.
- `GRUPOS_NAO_IMPLEMENTADOS` — grupos escondidos da UI até existirem rotas reais (hoje só `'Sistema'`). Engenharia vai entrar aqui e depois sair.
- API: `useAuth().temAcao(chave)` — checagem flat contra `acoesPermitidas: string[]` salvo em `funcionarios.acoes_permitidas`.
- **Comportamento fail-CLOSED**: se `acoesPermitidas` veio vazio do banco, AuthContext faz fallback pro template do cargo via `acoesPadraoDoCargo(cargo)` — **sem isso o usuário fica sem nada**.
- Cargos: 10 (`Administrador`, `Gerente`, `Gerente Financeiro`, `Gerente de Compras`, `Supervisor`, `Operador`, `Financeiro`, `Apontador`, **`Engenheiro Civil Sênior`**, **`Engenheiro Civil`**). Os dois últimos já existem — o módulo Engenharia se encaixa no perfil deles.

### 2.3 RLS no banco (moderna)

`private.current_has_action(chave text) returns boolean` — função SECDEF que verifica `acoes_permitidas` do funcionário logado, com **bypass automático pra Admin**. Padrão atual nas migrations recentes (ex.: `20260525130000_tighten_rls_apont_tables.sql`):

```sql
CREATE POLICY <tabela>_select ON public.<tabela> FOR SELECT TO authenticated
  USING (private.current_has_action('ver_<modulo>'));

CREATE POLICY <tabela>_insert ON public.<tabela> FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_<modulo>'));

CREATE POLICY <tabela>_update ON public.<tabela> FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_<modulo>'))
  WITH CHECK (private.current_has_action('editar_<modulo>'));

CREATE POLICY <tabela>_delete ON public.<tabela> FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_<modulo>'));
```

Tabelas legadas ainda têm `FOR ALL USING(true)` (inclusive `obras`) — não vamos consertar isso neste módulo, só seguir o padrão moderno nas tabelas novas.

### 2.4 Onde aplicar permissão no frontend

`PermissionGate` está desatualizado. **Usar o padrão inline**:

```tsx
const { temAcao } = useAuth();
const canCreate = temAcao('criar_engenharia_pasta');
return canCreate ? <Button>Nova pasta</Button> : null;
```

Esse padrão já é usado em `ObrasPage.tsx` (`canExport = temAcao('exportar_orcamento')`) e em todo o `Header.tsx`. **Recomendação:** não tocar no `PermissionGate.tsx` neste módulo — atualizar o componente é outro projeto.

### 2.5 Chaves de ação propostas (entram em `ACOES_PLATAFORMA`)

Grupo `Engenharia`:

| Chave | Label | Depende de |
|---|---|---|
| `ver_engenharia` | Acessar módulo Engenharia | — |
| `criar_engenharia_pasta` | Criar pasta no Engenharia | `ver_engenharia` |
| `editar_engenharia_pasta` | Renomear/mover pasta | `ver_engenharia` |
| `excluir_engenharia_pasta` | Mover pasta para lixeira | `ver_engenharia`, `editar_engenharia_pasta` |
| `criar_engenharia_nota` | Criar bloco de nota | `ver_engenharia` |
| `editar_engenharia_nota` | Editar/salvar bloco de nota | `ver_engenharia` |
| `excluir_engenharia_nota` | Mover nota para lixeira | `ver_engenharia`, `editar_engenharia_nota` |
| `criar_engenharia_calculo` | Criar bloco de cálculo | `ver_engenharia` |
| `editar_engenharia_calculo` | Editar/salvar bloco de cálculo | `ver_engenharia` |
| `excluir_engenharia_calculo` | Mover cálculo para lixeira | `ver_engenharia`, `editar_engenharia_calculo` |
| `upload_engenharia_arquivo` | Subir arquivo | `ver_engenharia` |
| `excluir_engenharia_arquivo` | Excluir arquivo | `ver_engenharia` |
| `ver_lixeira_engenharia` | Visualizar lixeira | `ver_engenharia` |
| `restaurar_lixeira_engenharia` | Restaurar itens da lixeira | `ver_lixeira_engenharia` |
| `excluir_permanente_engenharia` | Excluir permanentemente | `ver_lixeira_engenharia`, `restaurar_lixeira_engenharia` |
| `ver_historico_engenharia` | Ver versões de nota/cálculo | `ver_engenharia` |

Templates de cargo propostos:
- **Engenheiro Civil Sênior**: todas exceto `excluir_permanente_engenharia` (só Admin).
- **Engenheiro Civil**: tudo exceto exclusões (`excluir_*`, `excluir_permanente_*`).
- **Administrador**: tudo.
- **Gerente / Gerente Financeiro / Gerente de Compras / Supervisor**: só `ver_engenharia` + `ver_lixeira_engenharia` (read-only).
- **Operador / Apontador / Financeiro**: nada.

Cada cargo é mapeado em `acoesPadraoDoCargo()` (já existe, ver `permissions.ts`).

---

## 3. Schema da tabela `obras` — fundamental

`obras` **não está em migration** — está em `supabase/schema.sql` (criada antes do versionamento de migrations começar em fev/2026):

```sql
CREATE TABLE IF NOT EXISTS obras (
  id text PRIMARY KEY,             -- <<< text, não uuid
  nome text NOT NULL,
  endereco text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planejamento',
  data_inicio text NOT NULL DEFAULT '',
  data_previsao_fim text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  orcamento numeric NOT NULL DEFAULT 0,
  criado_por text NOT NULL DEFAULT ''
);
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON obras FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**Implicações pro plano:**
1. **FK em `engenharia_pastas`**: `obra_id text references obras(id) on delete cascade` (não uuid).
2. **`obras` não tem `deleted_at`** — hoje deleção é `DELETE` físico (com `ON DELETE CASCADE` em filhos). Se você apagar uma obra, a pasta raiz dela (e tudo dentro: subpastas, notas, cálculos, arquivos do storage) some via cascade. **É o comportamento esperado?** → entra na lista de decisões do plano.
3. **RLS atual de `obras` é frouxa** (`USING(true)`) — herdar esse comportamento NÃO. Engenharia usa o padrão moderno desde o dia 1.

`funcionarios.id` também é `text`; `funcionarios.auth_user_id` é `uuid` apontando pra `auth.users(id)`. Para `criado_por` das tabelas novas: usar `uuid references auth.users(id)` (uuid, não funcionario_id text — mais simples e bate com `auth.uid()` direto).

---

## 4. Onde plugar "criar pasta automática" ao cadastrar obra

Duas opções:

### Opção A — **Trigger SQL (recomendada)**

```sql
CREATE OR REPLACE FUNCTION engenharia_criar_pasta_obra()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO engenharia_pastas (id, obra_id, nome, tipo, parent_id, caminho)
  VALUES (gen_random_uuid()::text, NEW.id, NEW.nome, 'obra', NULL, '/' || NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_engenharia_pasta_after_insert_obra
  AFTER INSERT ON obras
  FOR EACH ROW EXECUTE FUNCTION engenharia_criar_pasta_obra();
```

- ✅ Resiste a qualquer caminho de criação (UI, import Excel, script ad-hoc, migração futura).
- ✅ Idempotente (`ON CONFLICT DO NOTHING` + unique index em `(obra_id) WHERE tipo='obra'`).
- ✅ Mesma transação — atômico.
- ⚠️ Cuidado com permissão: trigger roda com permissão de quem fez INSERT em obras (RLS frouxa hoje). Como precisa inserir em `engenharia_pastas` (que vai ter RLS apertada), a função precisa ser `SECURITY DEFINER` com owner privilegiado, ou bypass dentro de `private.`.

### Opção B — Application-level (no hook `useObras.criar()` ou serviço)

- ❌ Falha em criação fora da UI.
- ❌ Duas escritas separadas (obra + pasta) — se a segunda falhar, fica obra sem pasta.

**Recomendação: Opção A.** Justificativa no plano.

Para `UPDATE OF nome ON obras`: outro trigger sincroniza `engenharia_pastas.nome`. Para deleção, hoje é `DELETE` físico → CASCADE remove a pasta — comportamento atual a confirmar com usuário (vs. soft-delete da obra que viraria soft-delete da pasta).

---

## 5. Convenções de rota

`src/App.tsx` usa `BrowserRouter` com **rotas flat** — sem prefixo `/app/*`.

```ts
const PAGINAS_FALLBACK = [
  { acao: 'ver_obras', rota: '/obras' },
  { acao: 'ver_compras', rota: '/compras' },
  // ...
];
```

**Correção do prompt original:** `/app/engenharia/...` → `/engenharia/...`.

Mapa proposto:

| Rota | Conteúdo |
|---|---|
| `/engenharia` | Home — duas seções (Obras com pasta automática, Avulsas) |
| `/engenharia/pasta/:id` | Navegação dentro da pasta (lista de subpastas, notas, cálculos, arquivos) |
| `/engenharia/nota/:id` | Editor Tiptap fullscreen |
| `/engenharia/calculo/:id` | Quadro de cálculo fullscreen |
| `/engenharia/lixeira` | Lixeira (admin/quem tem `ver_lixeira_engenharia`) |

**Lazy-loading:** padrão do projeto é `const Foo = lazy(() => import('./pages/Foo'))` + `<Suspense>`. Bloco-nota e bloco-cálculo entram lazy.

Adicionar à `PAGINAS_FALLBACK`: `{ acao: 'ver_engenharia', rota: '/engenharia' }`.

---

## 6. Onde adicionar o link no menu

`src/components/layout/Header.tsx` — **nav horizontal top-bar**, não sidebar.

```ts
const links: { to: string; label: string; acao?: string }[] = [
  { to: '/cadastros', label: 'Cadastros', acao: 'ver_cadastros' },
  { to: '/', label: 'Dashboard', acao: 'ver_dashboard' },
  { to: '/obras', label: 'Obras', acao: 'ver_obras' },
  // ...
  { to: '/medicao', label: 'Medição', acao: 'ver_medicao' },
];
```

Posicionar entre `Obras` e `Cadastros`. Filtragem por `temAcao` já é feita no array via `visibleLinks`. Active-match precisa de regra: `if (to === '/engenharia') return pathname === '/engenharia' || pathname.startsWith('/engenharia/');`

---

## 7. Estrutura de código (onde colocar arquivos)

O projeto tem **dois padrões coexistindo**:

| Padrão | Onde | Exemplos |
|---|---|---|
| **Pages flat + components/feature** | `src/pages/<Name>.tsx` + `src/components/<feature>/*.tsx` | Compras, Frete, Frota, Combustível, Manutenção |
| **Módulo isolado** | `src/modules/<modulo>/*.tsx` | apontamento (`ApontamentoPage`), rodotracker, cadastros |

Para Engenharia (módulo grande, várias subtelas internas, vai ter ~30+ arquivos):

**Recomendação: `src/modules/engenharia/`** (segue o padrão dos módulos grandes mais recentes).

Layout proposto:
```
src/modules/engenharia/
  EngenhariaPage.tsx           # roteador interno (raiz)
  PastaPage.tsx                # navegação dentro de pasta
  NotaPage.tsx                 # editor Tiptap
  CalculoPage.tsx              # quadro de cálculo
  LixeiraPage.tsx
  components/
    FolderTree.tsx
    Breadcrumb.tsx
    FileUploader.tsx
    NoteEditor.tsx
    CalcCanvas.tsx
    CalcLine.tsx
    CalcGrid.tsx
    CalcSpinner.tsx
    HistoricoVersoes.tsx
  hooks/
    useEngenhariaPastas.ts
    useEngenhariaNotas.ts
    useEngenhariaCalculos.ts
    useEngenhariaArquivos.ts
  services/
    arquivosService.ts         # upload, signed URL, checksum
    calcEngine.ts              # wrapper math.js com sandbox
    calcParser.ts              # pré-processamento de variáveis string
  types/
    engenharia.ts              # tipos compartilhados
  utils/
    permissoes.ts              # constantes das chaves novas (também adicionadas em ACOES_PLATAFORMA)
```

Hooks **fora** de `src/hooks/` (que é flat e gigante). shadcn UI continua em `@/components/shadcn` (memória do user).

---

## 8. Convenção de soft-delete

Padrão dominante:

- Coluna `deleted_at timestamptz NULL`.
- SELECT policies filtram `deleted_at IS NULL`.
- "Lixeira" tem chaves de ação próprias: `ver_lixeira_<modulo>`, `restaurar_lixeira_<modulo>`, `excluir_permanente_<modulo>`.
- Cron/job apaga objetos do Storage depois de N dias (existe em outros módulos — não achei o cron exato, mas é o padrão referido em outros audits).

Aplicar idêntico em engenharia. **Exceção**: arquivos no storage não somem imediatamente — soft-delete no DB + retenção física de 30 dias.

---

## 9. Convenção de migrations

Datas seguem `YYYYMMDDHHMMSS_descricao.sql`. Padrão observado:

- **Audit fixes**: 2 arquivos por fix — `<ts>_<nome>_fix.sql` + `<ts+100>_rollback_<nome>.sql` (par fix + rollback, MEMÓRIA do user confirma).
- **Schema novo (módulo)**: pode ser 1 arquivo grande, mas para o tamanho desse módulo recomendo dividir em ~5 migrations da Onda 1 (cada uma com seu rollback):
  1. `<ts>_engenharia_tables_fix.sql` + rollback
  2. `<ts+1>_engenharia_rls_fix.sql` + rollback
  3. `<ts+2>_engenharia_trigger_pasta_obra_fix.sql` + rollback
  4. `<ts+3>_engenharia_storage_bucket_fix.sql` + rollback (cria bucket via SQL/admin API)
  5. `<ts+4>_engenharia_acoes_plataforma_seed_fix.sql` + rollback (insere chaves padrão se houver tabela de seed)

Workflow (memória): direto no projeto Supabase, sem branch. Confirmar cada apply.

---

## 10. Tema / dark mode

`src/index.css` importa Tailwind 4 + shadcn + `./styles/theme.css`. Tokens OKLCH para dark mode em `.dark` (linhas 15-77). **NÃO usar hex hardcoded** — sempre tokens (`bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-destructive`, etc.).

Para o canvas do bloco de cálculo: fundo `bg-card` (modo claro: branco; dark: cinza-escuro automaticamente). Erro: `text-destructive` + ícone `text-destructive`.

---

## 11. Storage

Padrão Supabase já usado no projeto (frete fotos, combustível fotos, etc.):
- Bucket privado.
- Path determinístico (`<modulo>/<entidade_id>/<arquivo_id>-<slug>.<ext>`).
- Signed URLs com TTL curto (5 min) para download.
- Upload via `supabase.storage.from(bucket).upload(...)`.

Novo bucket: `engenharia-arquivos`. Policies (a confirmar via Supabase Skill):
- `SELECT/DOWNLOAD`: `ver_engenharia`.
- `INSERT`: `upload_engenharia_arquivo`.
- `DELETE`: `excluir_engenharia_arquivo` OU dono do arquivo.

Validação MIME real (lib `file-type`) no momento do upload, bloqueando: `.exe`, `.bat`, `.sh`, `.ps1`, `.scr`, `.com`, `.dll`, `.msi`, `.jar`, `.app`.

---

## 12. Decisões pendentes / gaps a fechar antes da Fase 1

Lista que entra como "decisões abertas" no plano mestre:

1. **`obras` não tem `deleted_at`** — deleção é DELETE físico. Quando obra for deletada, a pasta da Engenharia e todo o conteúdo somem via cascade. **Aceitar isso?** Alternativa: criar soft-delete em `obras` também (mas é refactor fora do escopo deste módulo).
2. **Trigger SQL com SECURITY DEFINER** — confirmar com user que essa é a forma certa de bypass de RLS pra criar pasta automática.
3. **PermissionGate desatualizado** — não vamos refatorar agora. Gates inline com `temAcao`. **Confirmar.**
4. **Dependências novas (~395 KB gzip)** — aprovar cada uma antes de `npm i`. Especialmente `mathjs` (~150 KB) e `react-data-grid` (~40 KB).
5. **Modelo de conflito de edição concorrente** — MVP "last write wins" + warning de versão antiga. Sem CRDT. **OK?**
6. **Histórico de versões — limite** — 50 versões por nota/cálculo? Snapshot a cada save manual + auto-save a cada 2 min?
7. **Tamanho máximo de arquivo upload** — 50 MB default. Algum tipo (ex.: DWG) precisa subir mais?
8. **Aliases de variáveis string no cálculo** — confirmar regra de match longest-first e case-insensitive. Reservar palavras (não deixar `"sin" = 5` que mascara `Math.sin`).
9. **Onde guardar `acoesPermitidas` defaults dos cargos** — `acoesPadraoDoCargo()` em `permissions.ts`. Precisa estender pra incluir as novas chaves.
10. **Sidebar vs top-bar** — projeto usa top-bar (Header). Engenharia entra como link de top-bar normal. Não criar sidebar específica.

---

## 13. Memórias relevantes do user aplicadas aqui

- **shadcn em `src/components/shadcn/`** — confirmado (`components.json` alias `ui: "@/components/shadcn"`).
- **Timestamps wall-clock sem TZ pra colunas user-entered** — engenharia tem poucos campos user-entered de data (notas e cálculos não usam datas digitadas pelo usuário no contexto operacional). `criado_em`/`atualizado_em` continuam `timestamptz` (sistema).
- **Workflow audit-fix (1 fix por sessão, fix+rollback, sem ritual de spec/plano)** — esse workflow é pra fixes pontuais. Pra módulo novo, plano-mestre + ondas é o caminho certo (já confirmado pelo user na abertura desta sessão).
- **Bump de versão da home apenas para `src/modules/rodotracker/`** — não se aplica ao módulo Engenharia.
- **Bloco 3 modernização (Skeleton, Tabs shadcn, RHF+Zod, data-table)** — aplicar desde o dia 1 (módulo novo = baseline moderna).

---

## 14. Resumo executivo (pra entrar no plano)

- **Stack**: React 19 + shadcn + tanstack + Tiptap + math.js + dnd-kit + react-data-grid.
- **Permissões**: `ACOES_PLATAFORMA` flat keys + `temAcao` inline + RLS via `private.current_has_action`.
- **Schema**: 5 tabelas novas (`engenharia_pastas`, `engenharia_notas`, `engenharia_notas_versoes`, `engenharia_calculos`, `engenharia_calculos_versoes`, `engenharia_arquivos`) + trigger SECDEF que cria pasta automática ao inserir obra.
- **Storage**: bucket privado `engenharia-arquivos` + signed URLs (TTL 5 min) + validação MIME real.
- **Estrutura**: `src/modules/engenharia/` (não pages flat).
- **Rotas**: `/engenharia`, `/engenharia/pasta/:id`, `/engenharia/nota/:id`, `/engenharia/calculo/:id`, `/engenharia/lixeira`.
- **Menu**: novo link no `Header.tsx` entre Obras e Cadastros.
- **Soft-delete**: padrão `deleted_at` + lixeira por permissão.
- **Cargos**: Engenheiro Civil e Engenheiro Civil Sênior já existem — só precisamos adicionar chaves novas em `acoesPadraoDoCargo`.
- **Riscos top 3**: parser/sandbox do math.js, performance do canvas com >100 linhas, conflito de edição concorrente.
