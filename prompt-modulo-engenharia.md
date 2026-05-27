# Prompt — Construção do módulo "Engenharia" (Workspace de obras com notas, cálculos e arquivos)

> Cole esse prompt no seu Claude Code dentro do projeto `Gestao_Obras`.
> Tempo estimado: 80–140 horas distribuídas em ondas (não tente fazer tudo em uma sessão).
> Pré-requisitos: Superpowers, Supabase Skill, shadcn + Shadcnblocks, Playwright e Security Review já instalados.

---

## Contexto que o Claude precisa carregar antes de começar

Antes de qualquer planejamento, leia (na ordem):

1. `CLAUDE.md` na raiz (se existir).
2. `src/utils/permissions.ts` — entender `MODULOS`, `ACOES`, `CARGOS` e a função `temPermissao()`.
3. `src/components/auth/PermissionGate.tsx` — entender o padrão de gate visual.
4. `src/contexts/AuthContext.tsx` (ou equivalente) — como `useAuth()` expõe usuário + perfil.
5. As migrations da pasta `supabase/migrations/` relacionadas a **obras** (`obras`, `obras_etapas`, etc.) — esse módulo cria pasta automaticamente por obra.
6. Padrão de soft-delete (`deleted_at`) e RLS usado no projeto (use o padrão dominante, **não invente outro**).
7. `tailwind.config` / `src/styles/theme.css` — design tokens, dark mode, paleta neutra.
8. `package.json` — verificar versões de React, Next/Vite, Tailwind, shadcn, e se há `math.js`, `tiptap`, `react-dnd` ou similares já instalados.

> Use `Superpowers` para fazer essa varredura inicial e produza um arquivo `docs/superpowers/discovery/engenharia-discovery.md` com:
> - Como obras são criadas hoje (qual hook/serviço dispara o INSERT).
> - Onde plugar o "criar pasta automática" (trigger SQL vs. application-level — recomende um e justifique).
> - Convenções de rota (`/app/*` vs. `/dashboard/*`) usadas no resto do app.
> - Onde mora o sidebar/menu principal — onde adicionar o link "Engenharia".

---

## Visão geral do módulo (o que você está construindo)

Um workspace tipo SharePoint/Notion híbrido para engenheiros da EMT Construtora:

- **Pastas hierárquicas**: cada obra cadastrada gera automaticamente uma pasta raiz. Existem também pastas avulsas (não vinculadas a obra). Dentro de qualquer pasta o usuário cria subpastas, notas, blocos de cálculo e faz upload de arquivos.
- **Arquivos**: upload de PDF, Excel (.xlsx/.xls), Word (.docx), imagens (jpg, png, webp), DWG (opcional). Preview inline quando possível.
- **Bloco de Nota**: editor rich-text estilo Word (negrito, itálico, listas, headings, tabelas simples, imagens inline, links, código).
- **Bloco de Cálculo** (o coração do módulo, e a parte mais arriscada — leia a Fase 6 inteira antes de codar):
  - Quadro livre (canvas) onde o usuário escreve cálculos linha a linha.
  - Sintaxe estilo Soulver/Calca: `1+1=` → o app preenche `2` automaticamente.
  - Se o usuário digitar a resposta e estiver errada, fica em **vermelho** com alerta até clicar em "Alerta revisado" ou corrigir.
  - Botão global de ligar/desligar a verificação automática.
  - **Spinner em número**: selecionar um número exibe um stepper (▲/▼) que aumenta/diminui o valor, recalculando o resto.
  - **Variáveis numéricas**: `x = 2*2` armazena `x=4` no escopo do bloco. Depois `x+1=` retorna `5`.
  - **Variáveis string**: `"Brita 4" = 110` define a variável "Brita 4" (case-insensitive, espaços tolerados). Depois `brita4 + x =` retorna o valor combinado. Aceitar com e sem aspas após a primeira definição.
  - Caixas de texto livres posicionáveis no quadro.
  - Mini-grids tipo Excel embutidos numa área selecionada do quadro (colunas × linhas, fórmulas básicas).
  - Modo claro = quadro branco; modo escuro = cinza-escuro (use os tokens do design system, não cor hardcoded).

---

## Regras inegociáveis (não pule)

1. **Use Superpowers desde a Fase 1** — crie `docs/superpowers/plans/2026-XX-XX-engenharia-modulo.md` com plano de execução, riscos, decisões arquiteturais. Atualize a cada onda.
2. **Não crie tabelas/colunas sem migration**. Toda mudança de schema vai por migration na Supabase Skill e é versionada.
3. **Não invente padrão de RLS, soft-delete ou permissões diferente do resto do app.** Espelhe o padrão dominante. Se houver dúvida, pare e pergunte ao usuário.
4. **Não tente construir o Bloco de Cálculo em uma sessão.** Quebre em sub-ondas (parser básico → variáveis numéricas → variáveis string → spinner → mini-grid → caixas de texto). Cada sub-onda termina com testes Playwright passando.
5. **Use bibliotecas maduras para o que é difícil**:
   - Parser de expressões: **math.js** (já tem suporte a variáveis, unidades, funções). Não escreva parser do zero.
   - Editor rich-text: **Tiptap** (extensível, ProseMirror por baixo). Não use `contentEditable` puro.
   - Drag-and-drop / canvas livre: **dnd-kit** + posicionamento absoluto, OU **react-moveable**. Decida na Fase 6.0.
   - Mini-grid Excel-like: **Handsontable Community** (free, gratuito para uso não-comercial — verificar licença) ou **react-data-grid**. Decida na Fase 6.5.
6. **Antes de instalar dependência nova**, justifique no plano (`docs/superpowers/plans/...`) e cheque tamanho do bundle. Aprove com o usuário se for >100kb gzip.
7. **Storage no Supabase Storage** com bucket privado + assinaturas temporárias (signed URLs). Nunca exponha URLs públicas de arquivos de obra.
8. **Tudo em modo claro E escuro desde o primeiro componente.** Sem cor hex hardcoded.
9. **Permissões frontend (`PermissionGate`) E backend (`RLS`)** — toda ação protegida nos dois lados. Sem exceção.
10. **Toda feature termina com**: migration aplicada + componente em produção + teste Playwright passando + entrada no CHANGELOG do módulo.

---

## Fase 0 — Briefing e plano mestre (1–2 h)

Produza `docs/superpowers/plans/2026-XX-XX-engenharia-modulo.md` contendo:

- Resumo executivo do módulo (3–5 linhas).
- Stack escolhido (Tiptap, math.js, dnd-kit, Handsontable/react-data-grid, Supabase Storage) com justificativa de 1 linha cada.
- Mapa de rotas: `/app/engenharia`, `/app/engenharia/pasta/[id]`, `/app/engenharia/nota/[id]`, `/app/engenharia/calculo/[id]`.
- Lista de tabelas novas (esquema preliminar).
- Lista de buckets do Storage.
- Diagrama (mermaid) de relacionamento: `obras` ←→ `engenharia_pastas` ←→ (`engenharia_pastas` recursivo, `engenharia_notas`, `engenharia_calculos`, `engenharia_arquivos`).
- Riscos e mitigações (no mínimo: parser, performance do canvas com muitos elementos, tamanho de arquivos, conflito de edição concorrente).
- Roadmap de 8–12 ondas curtas com critério de aceitação de cada uma.

**Pare e mostre o plano ao usuário antes de seguir para Fase 1.**

---

## Fase 1 — Schema do banco (2–4 h)

Crie a migration `engenharia_schema_inicial.sql` com as tabelas abaixo. Ajuste nomes/colunas conforme convenção do projeto.

### `engenharia_pastas`
```
id              uuid pk default gen_random_uuid()
parent_id       uuid null references engenharia_pastas(id) on delete cascade
obra_id         uuid null references obras(id) on delete cascade   -- preenchido só na pasta raiz da obra
nome            text not null
tipo            text not null check (tipo in ('obra','avulsa','subpasta'))
caminho         text not null         -- materialized path para consultas rápidas, ex: /obra-uuid/sub1/sub2
criado_por      uuid references usuarios(id)
criado_em       timestamptz default now()
atualizado_em   timestamptz default now()
deleted_at      timestamptz null
```
Index em `parent_id`, `obra_id`, `caminho`. Unique parcial `(parent_id, lower(nome)) where deleted_at is null`.

### `engenharia_notas`
```
id              uuid pk
pasta_id        uuid not null references engenharia_pastas(id) on delete cascade
titulo          text not null
conteudo_json   jsonb not null default '{}'::jsonb   -- documento Tiptap
criado_por      uuid
criado_em       timestamptz default now()
atualizado_em   timestamptz default now()
deleted_at      timestamptz null
versao          int not null default 1
```

### `engenharia_notas_versoes` (histórico)
```
id, nota_id, conteudo_json, versao, autor_id, criado_em
```
Snapshot a cada save manual + a cada N minutos de auto-save. Limite de 50 versões por nota.

### `engenharia_calculos`
```
id              uuid pk
pasta_id        uuid not null references engenharia_pastas(id) on delete cascade
titulo          text not null
documento_json  jsonb not null default '{}'::jsonb   -- estrutura própria descrita na Fase 6
alerta_ativo    boolean not null default true        -- ligar/desligar verificação
criado_por      uuid
criado_em       timestamptz default now()
atualizado_em   timestamptz default now()
deleted_at      timestamptz null
versao          int not null default 1
```

### `engenharia_calculos_versoes`
Mesma ideia da nota: snapshots para histórico.

### `engenharia_arquivos`
```
id              uuid pk
pasta_id        uuid not null references engenharia_pastas(id) on delete cascade
nome_original   text not null
extensao        text not null
mime_type       text not null
tamanho_bytes   bigint not null
storage_path    text not null         -- caminho dentro do bucket
checksum_sha256 text                  -- para dedup futura
criado_por      uuid
criado_em       timestamptz default now()
deleted_at      timestamptz null
```

### Trigger automática: pasta de obra
- Trigger `AFTER INSERT ON obras` que cria `engenharia_pastas(tipo='obra', obra_id=NEW.id, nome=NEW.nome, parent_id=null)`.
- Trigger `AFTER UPDATE OF nome ON obras` que atualiza o nome da pasta correspondente.
- Trigger `AFTER UPDATE OF deleted_at ON obras` que faz soft-delete da pasta raiz da obra (mas mantém arquivos no storage — só esconde).

### RLS
- `engenharia_pastas`, `engenharia_notas`, `engenharia_calculos`, `engenharia_arquivos`: SELECT, INSERT, UPDATE, DELETE protegidos por função `tem_permissao(auth.uid(), 'ENGENHARIA', 'ler/criar/editar/deletar')`.
- Soft-delete: políticas adicionam `deleted_at is null` no SELECT.
- Versões: somente quem tem acesso à nota/cálculo pai pode ler versões.

### Após aplicar a migration
1. Rode `supabase db lint` (ou equivalente) e corrija warnings.
2. Atualize `src/types/database.ts` (regenerar types).
3. Rode `Security Review` skill sobre as policies.
4. Commit: `feat(engenharia): schema inicial`.

---

## Fase 2 — Storage e upload de arquivos (4–6 h)

1. Crie bucket privado `engenharia-arquivos` no Supabase.
2. Defina policy: só autenticados com permissão `ENGENHARIA.ler` baixam; só com `ENGENHARIA.editar` fazem upload; quem `criou` ou tem `ENGENHARIA.deletar` apaga.
3. Padrão de path no bucket: `pastas/{pasta_id}/{arquivo_id}-{slug-do-nome}.{ext}`.
4. Implemente serviço `src/services/engenharia/arquivos.ts`:
   - `uploadArquivo(pastaId, file)` — gera UUID, calcula sha256, faz upload, insere em `engenharia_arquivos`. Limita 50 MB por arquivo (configurável). Bloqueia extensões executáveis (.exe, .bat, .sh, .ps1, .scr, .com).
   - `getSignedUrl(arquivoId, expiresInSec=300)` — gera signed URL.
   - `deletarArquivo(arquivoId)` — soft-delete no DB, mantém objeto no bucket por 30 dias (cron limpa depois).
5. Adicione validação MIME real (não só extensão) — use lib como `file-type` no upload.
6. Teste Playwright: upload de PDF, JPG, XLSX e tentar subir .exe (deve rejeitar).

---

## Fase 3 — Sistema de pastas (UI) (6–10 h)

1. Página `/app/engenharia` — lista de pastas raiz separadas em 2 seções: **Obras** e **Avulsas**.
2. Sidebar tipo árvore (recursiva) com lazy-loading dos filhos. Componente: `<FolderTree>`.
3. Breadcrumb sempre visível: `Engenharia / Ramal do Gama / Cálculos estruturais / Bloco 3`.
4. Ações por pasta (menu de contexto + botões):
   - Criar subpasta
   - Criar nota
   - Criar bloco de cálculo
   - Fazer upload de arquivo (drag-and-drop também)
   - Renomear (não permitido na pasta raiz de obra — sincronizada com `obras.nome`)
   - Mover para outra pasta (validar que não cria ciclo)
   - Soft-delete (com confirmação dupla)
5. Quando o usuário cria uma pasta avulsa, o campo `obra_id` fica `null`, `parent_id` fica `null`, `tipo='avulsa'`.
6. Quando uma obra é criada (Fase 1 trigger), a pasta raiz aparece automaticamente na seção "Obras".
7. UI: use componentes shadcn (`Tree`, `ContextMenu`, `Dialog`, `Breadcrumb`). Tudo dark-mode pronto.

Teste Playwright: criar obra → verificar pasta apareceu; criar subpasta → criar nota dentro → mover nota para outra pasta.

---

## Fase 4 — Bloco de Nota (Word-like) (8–12 h)

1. Editor com **Tiptap** + extensões: StarterKit, Heading, BulletList, OrderedList, TaskList, Table, Image (com upload pro mesmo bucket), Link, CodeBlock, Highlight, TextAlign.
2. Barra de ferramentas fixa no topo (estilo Word/Notion).
3. Auto-save a cada 5 segundos de inatividade + save manual (Ctrl/Cmd+S).
4. Cada save gera versão se passou >2 min do último snapshot.
5. Painel lateral "Histórico de versões" com diff visual (use `diff` lib + render).
6. Suporte a colar imagens (paste do clipboard → upload pro bucket).
7. Modo leitura para usuários sem permissão de editar.
8. Slash menu (`/`) para inserir blocos (heading, lista, tabela, divisor).

Teste Playwright: criar nota, digitar texto, formatar, salvar, fechar, reabrir → conteúdo persiste; abrir versão anterior.

---

## Fase 5 — Bloco de Cálculo, parte 1: parser e linhas simples (10–16 h)

> **Esta é a fase mais delicada. Não pule etapas, não combine sub-fases.**

### 5.1 — Decisões arquiteturais (escreva no plano antes de codar)
- Parser: **math.js**. Justificar: já tem `evaluate(expr, scope)`, suporta variáveis, funções, unidades.
- Modelo de dados (`documento_json` do cálculo):
  ```json
  {
    "linhas": [
      { "id": "uuid", "tipo": "calculo", "expressao": "x = 2*2", "resultado": null, "alerta": null, "ordem": 0 },
      { "id": "uuid", "tipo": "calculo", "expressao": "x + 1 = 5", "resultado": 5, "alerta": "ok", "ordem": 1 },
      { "id": "uuid", "tipo": "texto", "conteudo": "Comentário do engenheiro", "ordem": 2 },
      { "id": "uuid", "tipo": "grid", "colunas": 4, "linhas": 6, "dados": [...], "ordem": 3 }
    ],
    "variaveis_definidas": [ "x", "Brita 4" ],
    "config": { "alerta_ativo": true }
  }
  ```
- Escopo de variáveis: **por bloco de cálculo**. Não vaza entre blocos diferentes.
- Re-execução: ao editar qualquer linha, reavaliar todas as linhas seguintes em ordem (cascade).

### 5.2 — UI do quadro
- Container com fundo `bg-card` (modo claro: branco; modo escuro: cinza-escuro, via token, sem hex).
- Cada linha = um componente `<LinhaCalculo>` com input próprio, exibindo a expressão à esquerda e o resultado à direita após o `=`.
- Foco persistente, navegação com Enter (nova linha) e Shift+Enter (linha de texto).

### 5.3 — Parser básico
- Quando a linha termina com `=` (sem nada depois), executar `math.evaluate(expr_sem_igual, scope)` e preencher o resultado.
- Renderizar resultado em cor neutra (sucesso).
- Persistir resultado no JSON (não recalcular sempre que renderiza — apenas em edição).

### 5.4 — Verificação de resposta manual
- Se o usuário digita `1+1 = 3`, parser detecta que tem valor após o `=`.
- Comparar `math.evaluate(esquerda)` com valor após `=`. Tolerância configurável (default 1e-9 para floats).
- Se diferente: marcar `alerta = "erro"`, renderizar a linha inteira em texto vermelho e mostrar ícone ⚠ ao lado.
- Botão "Alerta revisado" ao lado do ícone: clica → seta `alerta = "revisado"`, volta cor normal (mas mantém o valor manual, não corrige).
- Botão global no topo do bloco "Verificação automática" (Switch shadcn): liga/desliga e persiste em `alerta_ativo` no DB.
- Se a verificação estiver desligada, parser ainda calcula `1+1=` (sem resposta), mas não compara `1+1=3`.

### 5.5 — Testes Playwright (obrigatórios antes da Fase 6)
- Digitar `1+1=` → vê `2`.
- Digitar `2*5=20` → ok, sem alerta.
- Digitar `2*5=11` → vê em vermelho, com ⚠.
- Clicar "Alerta revisado" → cor volta ao normal, valor `11` persiste.
- Desligar verificação → mesmo `2*5=99` não fica vermelho.

**Pare aqui. Faça commit. Mostre ao usuário. Só siga para 5.6 se aprovado.**

---

## Fase 6 — Bloco de Cálculo, parte 2: variáveis, spinner, grid, caixas (16–24 h)

### 6.1 — Variáveis numéricas
- Sintaxe `nome = expressao` define variável.
- Nome aceita: `[a-zA-Z_][a-zA-Z0-9_]*` (regra math.js).
- Ao avaliar, math.js já lida com isso via `scope`. Manter um único `scope` por bloco, atualizado em cascade.
- Linha de definição mostra `x = 4` (resultado computado à direita).
- Reuso: `x + 1 =` → `5`.

### 6.2 — Variáveis string (com aspas)
- Sintaxe `"Brita 4" = 110`.
- Internamente, converter `"Brita 4"` para identificador canônico `__var_brita_4` (slugify + lowercase + prefixo) e armazenar mapping no escopo do bloco:
  ```json
  "aliases": { "brita 4": "__var_brita_4", "brita4": "__var_brita_4" }
  ```
- Quando o parser processa uma linha, antes de chamar `math.evaluate`, fazer pre-processamento:
  1. Detectar trechos entre aspas → resolver via aliases.
  2. Detectar tokens "soltos" multi-palavra/sem-aspas que batem com algum alias (case-insensitive, espaços ignorados) → substituir pelo identificador canônico.
- Aceitar tanto `"Brita 4"` quanto `brita 4`, `Brita4`, `BRITA4` depois da primeira definição.
- Cuidado: priorizar match mais longo (greedy) para evitar conflito com variáveis curtas (ex.: `x` vs. `xreta`).
- Teste obrigatório: `x = 4`, `y = 3`, `"Brita 4" = 110`, depois `x+y+brita4 =` → `117`.

### 6.3 — Spinner em número
- Usuário seleciona um número dentro de uma expressão (ex.: clica/touch no `5` de `5 + 3`).
- Aparece um stepper flutuante (▲/▼) acima do número.
- Clicar ▲ incrementa, ▼ decrementa, com step configurável (1 default, Shift+click → step 10, Alt+click → step 0.1).
- Cada incremento dispara recalculo em cascade da linha e linhas seguintes.
- Implementação: usar `react-number-format` para detectar tokens numéricos OU implementar tokenização própria via math.js parser AST.
- Posicionamento: usar `floating-ui` (lib oficial pra popover/tooltip dinâmico).

### 6.4 — Caixas de texto livres
- Slash menu `/texto` ou botão "Inserir caixa de texto" → adiciona linha `tipo: "texto"`.
- Caixa de texto não é avaliada, apenas armazena comentário do engenheiro.
- Pode ter formatação básica (negrito, itálico) — Tiptap mini-instance ou só `contentEditable` se for muito pequeno.

### 6.5 — Mini-grid Excel-like
- Slash menu `/grid` ou botão "Inserir tabela de cálculo".
- Usuário define dimensões iniciais (ex.: 4 colunas × 6 linhas) — pode redimensionar depois.
- Cada célula aceita número, texto ou fórmula tipo `=A1+B1`.
- Suporte mínimo: SUM, AVERAGE, multiplicação, soma, subtração, referência por coluna-letra/linha-número.
- Biblioteca recomendada: **react-data-grid** (MIT, leve) ou **Handsontable Community** (mais features, checar licença).
- Variáveis do bloco **NÃO** entram automaticamente nas células da grid (escopo separado, evita confusão). Documentar isso.
- Resultados da grid podem ser "exportados" para uma variável do bloco via comando `gridA.total → x`.

### 6.6 — Botão global de alerta (revisitar)
- Já feito na 5.4 — verificar que se aplica também a expressões com variáveis (ex.: `x + 1 = 6` quando `x=4` deve dar erro).

### 6.7 — Persistência e auto-save
- Auto-save 5s de inatividade.
- Versionamento idêntico ao da nota (`engenharia_calculos_versoes`).
- Salvar `documento_json` completo + `alerta_ativo`.

### 6.8 — Testes Playwright (mínimo obrigatório)
1. Definir `x=4`, depois `x*2=` → `8`.
2. Definir `"Brita 4" = 110`, depois `brita4 + 5 =` → `115`.
3. Definir `x=4`, `y=3`, `"Brita 4"=110`, depois `x+y+brita4=` → `117`.
4. Selecionar um número, clicar spinner → valor sobe, cascade recalcula.
5. Inserir grid 3×3, preencher, ver soma com `=SUM(A1:A3)`.
6. Inserir caixa de texto, digitar, salvar, reabrir.
7. Desligar alerta, digitar `2+2=99` → sem vermelho.

**Não combine sub-fases.** Faça uma de cada vez, com PR/commit separado, e teste antes de avançar.

---

## Fase 7 — Integração com Obras (2–4 h)

1. Confirmar que a trigger SQL da Fase 1 está criando pasta raiz no `INSERT` de obra.
2. Na tela de detalhes da obra (`/app/obras/[id]`), adicionar um botão/link "Abrir workspace de engenharia" que vai pra `/app/engenharia/pasta/{pasta_id_da_obra}`.
3. Adicionar widget na home do módulo Engenharia: "Últimas obras com atividade" (consulta cruzando `engenharia_notas.atualizado_em` e `engenharia_calculos.atualizado_em`).
4. Teste Playwright: criar obra nova → ir pra Engenharia → ver pasta da obra no topo da seção "Obras".

---

## Fase 8 — Permissões e papéis (4–6 h)

1. Adicionar `ENGENHARIA` em `MODULOS` de `src/utils/permissions.ts`.
2. Definir granularidade:
   - `ENGENHARIA.ler` — ver pastas, notas, cálculos, baixar arquivos.
   - `ENGENHARIA.criar` — criar pastas, notas, cálculos, upload.
   - `ENGENHARIA.editar` — editar conteúdo, mover, renomear.
   - `ENGENHARIA.deletar` — soft-delete.
   - `ENGENHARIA.admin` — restaurar deletados, ver histórico completo, gerenciar pastas de obra.
3. Mapear nos cargos existentes (10 cargos do projeto). Engenheiros: criar+editar+deletar. Auxiliares: ler. Admin/Diretor: tudo. Operacional: nada (a menos que vire engenheiro).
4. `<PermissionGate modulo="ENGENHARIA" acao="criar">` em todos os botões de criação.
5. RLS no banco já está na Fase 1 — só revalidar.
6. Teste Playwright com 3 usuários diferentes (cargos distintos): tentar cada ação, verificar bloqueio correto.

---

## Fase 9 — UI/UX premium (paralelo a tudo, refinar no final) (6–10 h)

- Use tokens do design system. **Zero cor hardcoded.**
- Modo escuro testado em cada tela.
- Layout responsivo (desktop primeiro, tablet ok, mobile read-only).
- Atalhos de teclado documentados em `?` (modal): Ctrl+S, Ctrl+N (nova nota), Ctrl+Shift+N (novo cálculo), `/` para slash menu.
- Feedback visual em todas as ações async (toast / inline spinner).
- Empty states com ilustração e CTA.
- Acessibilidade: foco visível, navegação por teclado completa, contraste AA.

---

## Fase 10 — Testes E2E completos (4–6 h)

Suite Playwright cobrindo:
- Criação de obra → pasta automática.
- CRUD de pastas avulsas.
- CRUD de notas + versão.
- CRUD de cálculos com todas as features da Fase 6.
- Upload, download (signed URL), delete de arquivos.
- Permissões com 3 papéis.
- Soft-delete + restore (admin).

Mínimo de 30 testes. Execução verde antes do merge.

---

## Fase 11 — Security review (2–3 h)

Rode `security-review` skill sobre:
- Migrations da Fase 1 (RLS, triggers).
- Serviço de upload (validação MIME, tamanho, path traversal).
- Signed URLs (TTL curto).
- Parser de cálculo: garantir que `math.evaluate` está com `evaluate` (não `eval` JS) e sem expor `import`/`createUnit`/funções perigosas (use `math.create({})` com configuração mínima — desabilitar `import`).
- Aliases de variáveis string: garantir que slugify não permite injeção.

Corrija HIGH/CRITICAL antes do merge.

---

## Fase 12 — Documentação + CHANGELOG (2 h)

1. `docs/modulos/engenharia/README.md` — overview, screenshots, arquitetura.
2. `docs/modulos/engenharia/calculo-bloco.md` — sintaxe completa do bloco de cálculo, exemplos, limitações conhecidas.
3. `docs/modulos/engenharia/CHANGELOG.md` — entradas por onda.
4. Atualize o README principal do projeto com o novo módulo.

---

## Ordem de execução recomendada (ondas)

1. **Onda 1** — Fase 0 (plano) + Fase 1 (schema) + Fase 7 trigger de obras. Critério: criar obra cria pasta automática.
2. **Onda 2** — Fase 3 UI de pastas + Fase 2 storage de arquivos. Critério: CRUD de pastas + upload funcional.
3. **Onda 3** — Fase 4 bloco de nota completo. Critério: editor Word-like funcionando com auto-save e histórico.
4. **Onda 4** — Fase 5 cálculo simples (sem variáveis). Critério: `1+1=` funciona, alerta de erro funciona, switch global funciona.
5. **Onda 5** — Fase 6.1 + 6.2 variáveis numéricas e string. Critério: cenário `x+y+brita4=117` funciona em E2E.
6. **Onda 6** — Fase 6.3 spinner. Critério: stepper aparece, recálculo em cascade ok.
7. **Onda 7** — Fase 6.4 caixas de texto + Fase 6.5 mini-grid.
8. **Onda 8** — Fase 8 permissões.
9. **Onda 9** — Fase 9 UI premium + Fase 10 E2E completos + Fase 11 security + Fase 12 docs.

> Cada onda fecha com: testes verdes + commit + atualização do plano em `docs/superpowers/plans/...` + uma frase no CHANGELOG. Não comece a próxima onda antes de fechar a atual.

---

## Armadilhas conhecidas (leia antes de começar)

1. **math.js `import` e `eval`**: por padrão, math.js permite `import('algo')` em expressões. Isso é vetor de RCE. Crie a instância assim:
   ```ts
   import { create, all } from 'mathjs'
   const math = create(all)
   math.import({ import: () => { throw new Error('disabled') }, createUnit: () => { throw new Error('disabled') }, evaluate: () => { throw new Error('disabled') }, parse: () => { throw new Error('disabled') }, simplify: () => { throw new Error('disabled') }, derivative: () => { throw new Error('disabled') } }, { override: true })
   ```
   Verifique a doc oficial (versão atual) — a forma exata pode ter mudado.
2. **Tiptap + Next.js SSR**: editor renderiza client-side. Use `dynamic(() => import(...), { ssr: false })` ou diretiva `'use client'`.
3. **Auto-save brigando com edição**: debouncear corretamente, não sobrescrever conteúdo enquanto usuário digita.
4. **Recursão de pastas infinita**: validar no UPDATE de `parent_id` que não cria ciclo (recursive CTE no Postgres ou validação no app).
5. **Pasta de obra deletada mas obra ainda existe**: trigger de DELETE da obra → soft-delete da pasta. Trigger de UPDATE deleted_at IS NULL (restore da obra) → restore da pasta.
6. **Performance do canvas com muitos elementos**: virtualizar lista de linhas se >100 (use `@tanstack/react-virtual`).
7. **Conflito de edição simultânea**: 2 engenheiros editando a mesma nota. Para MVP, "last write wins" + aviso de versão antiga ("Alguém editou após você abrir, recarregar?"). Não implemente CRDT agora — fica para v2.
8. **Bundle size**: math.js + Tiptap + Handsontable pode estourar. Lazy-load esses componentes (rota carrega só o que precisa).

---

## Critérios de "pronto" do módulo

- [ ] Criar uma obra cria pasta raiz automaticamente.
- [ ] Engenheiro consegue criar subpastas, notas, cálculos e fazer upload de PDF/XLSX/JPG.
- [ ] Bloco de nota com editor Word-like + auto-save + histórico funcionando.
- [ ] Bloco de cálculo com TODOS os comportamentos descritos (parser, alerta, switch, variáveis numéricas, variáveis string, spinner, caixas, mini-grid).
- [ ] Cenário canônico `x=4`, `y=3`, `"Brita 4"=110`, `x+y+brita4=117` passa em teste E2E.
- [ ] Permissões frontend + RLS no backend bloqueiam acessos indevidos (testado com 3 papéis).
- [ ] Dark mode 100% em todas as telas.
- [ ] 30+ testes Playwright verdes.
- [ ] Security review sem HIGH/CRITICAL pendente.
- [ ] Documentação publicada em `docs/modulos/engenharia/`.
- [ ] CHANGELOG atualizado.
- [ ] Lighthouse score ≥ 85 nas páginas principais.

---

## Se algo der errado

- Bug no parser → adicione caso ao `engenharia_calculos.spec.ts`, corrija, re-rode toda a suite.
- Migration quebrou produção → use branch da Supabase pra testar antes (Supabase Skill suporta).
- Performance do canvas → virtualize, lazy-load, mostre só blocos visíveis.
- Conflito de variável string com nome de função math.js (ex.: usuário cria `"sin" = 5`) → reservar palavras (lista de bloqueio) e mostrar erro no momento da definição.

---

**Lembrete final**: esse é um módulo grande. Não pule etapas para "ganhar tempo". A Fase 6 (cálculo) sozinha vai consumir mais tempo que o resto somado. Faça com calma, em ondas curtas, testando E2E em cada uma.
