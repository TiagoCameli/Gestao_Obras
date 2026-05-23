# Etapas Ramal do Gama — Investigation + Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Investigar por que o usuário acha que cadastrou etapas pra "003 - Recuperação do Ramal do Gama" mas `etapas_obra` está vazio, e aplicar fix conforme o cenário descoberto (dados, fluxo de UI, ou import).

**Architecture:** Investigation-driven. Task 1 lê código + roda queries pra confirmar onde a discrepância está. Task 2 aplica o fix correto baseado nos achados (pode ser correção operacional, UX nova, ou só documentação).

**Tech Stack:** SQL (Supabase MCP) + React (TS). Possível modificação em `EtapasPage.tsx`, `ObrasPage.tsx`, ou hook `useEtapas`.

**Branch:** `fix/combustivel-etapas-ramal-gama` (baseada em main).

**Audit fonte:** `combustivel-horarios-precos.md` seção D.8.

---

## Task RG.0: Branch setup

- [ ] **Step 1: Criar branch**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
git checkout main && git pull origin main
git checkout -b fix/combustivel-etapas-ramal-gama
git branch --show-current
```

Expected: `fix/combustivel-etapas-ramal-gama`

---

## Task RG.1: Investigação aprofundada

**Files:** somente leitura (queries + leitura de código)

### Step 1: Verificar se Ramal do Gama está mesmo sem etapas

Via `mcp__plugin_supabase_supabase__execute_sql`:

```sql
SELECT id, nome FROM public.obras WHERE nome ILIKE '%ramal%gama%';
```

Expected: 1 obra, id `c5f6493a-5921-434c-93c5-f3a14cd2e428`.

```sql
SELECT COUNT(*) AS total_etapas,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS ativas
FROM public.etapas_obra
WHERE obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428';
```

> Nota: `etapas_obra` provavelmente não tem `deleted_at` (confirmado em discovery), mas se tiver, filtra.

Reportar exato número.

### Step 2: Procurar etapas órfãs com nome similar

Se usuário "cadastrou" mas com `obra_id` errado (typo ou outra obra), vamos achar:

```sql
SELECT eo.id, eo.nome, eo.obra_id, o.nome AS obra_nome
FROM public.etapas_obra eo
LEFT JOIN public.obras o ON o.id = eo.obra_id
WHERE eo.nome ILIKE '%ramal%' OR eo.nome ILIKE '%gama%' OR o.nome ILIKE '%ramal%gama%';
```

Se aparecer etapas com `obra_nome` diferente ou `obra_id` órfão (`obra_nome IS NULL`), é o caso de associação errada.

### Step 3: Verificar import via Excel/CSV

Search no código por features de import de etapas em lote:

```bash
grep -rn "ImportEtapas\|importEtapas\|salvarEtapasObra\|useSalvarEtapasObra" src/ 2>/dev/null
```

Reportar arquivos encontrados. Para cada um, ler o snippet relevante.

### Step 4: Verificar audit_log pra qualquer ação relacionada a essa obra

```sql
SELECT id, tipo, alvo_id, data_hora, detalhes
FROM public.audit_log
WHERE alvo_id LIKE 'c5f6493a%'
   OR detalhes LIKE '%ramal%gama%'
   OR detalhes LIKE '%c5f6493a-5921-434c-93c5-f3a14cd2e428%'
ORDER BY data_hora DESC
LIMIT 30;
```

Se houve criação/edição de etapas pra essa obra, vai aparecer. Se vazio: **nunca tocou** em `etapas_obra` com esse `obra_id`.

### Step 5: Ler `EtapasPage` + form de etapas

```bash
cat src/modules/cadastros/EtapasPage.tsx 2>/dev/null | head -100
```

Identifique:
- Como o usuário cadastra uma etapa (manual? import?)
- Qual o campo `obra_id` no form
- Se há validação que esconde silenciosamente

### Step 6: Ler `ObrasPage.tsx`

```bash
cat src/pages/ObrasPage.tsx 2>/dev/null | head -100
```

Identifique:
- Tem alguma aba/seção "Etapas" no detalhe da obra?
- Se sim, pra onde os dados vão? (`etapas_obra` mesmo? outra tabela? só state local?)

### Step 7: Reportar achados

Com base nos steps 1-6, classificar em UM dos 4 cenários:

| Cenário | Indicação | Fix |
|---|---|---|
| **A. Dados nunca cadastrados** | Steps 1+2+4 confirmam: nada existe pra essa obra | Operacional — usuário precisa cadastrar via `EtapasPage` ou criar UX explícita |
| **B. Associação errada** | Step 2 acha etapas com nome "ramal"/"gama" mas `obra_id` diferente | Operacional — update do `obra_id` no DB OU re-cadastro |
| **C. Cadastrado em outra tabela/sem persistir** | Step 6 acha aba "Etapas" no ObrasPage que não chama `useAdicionarEtapa` | Bug de código — implementar persist correto |
| **D. Etapas soft-deletadas** | Step 1 mostra registros mas `deleted_at IS NOT NULL` | Restaurar ou re-cadastrar |

- [ ] **Step 8: Compartilhar diagnóstico com o usuário**

Antes de aplicar fix, registrar findings em comentário no commit message OU em arquivo temporário (`docs/superpowers/specs/2026-05-23-etapas-ramal-gama-findings.md`). Pedir confirmação do user antes de prosseguir pra Task RG.2.

> **STOP gate:** Não avançar pra Task RG.2 sem confirmar o cenário com o usuário. O fix depende crucialmente do diagnóstico correto.

---

## Task RG.2: Aplicar fix (conditional baseado no cenário)

### Cenário A — Dados nunca cadastrados

**Fix:** Operacional. Não tem código a mudar. Documentar pro usuário:

```markdown
A obra "003 - Recuperação do Ramal do Gama" não tem etapas cadastradas no banco.
Pra resolver, acesse:
  1. Menu "Cadastros" → "Etapas de Obra" (rota `/cadastros/etapas`)
  2. Clique "+ Nova etapa"
  3. Selecione obra "003 - Recuperação do Ramal do Gama"
  4. Preencha nome (ex: "Execução Geral"), unidade (ex: "km"), quantidade, valor unitário
  5. Salvar — repita pra cada etapa contratual
```

Commitar como `docs(combustivel): instrução cadastro etapas Ramal do Gama` em arquivo `docs/operacional/etapas-ramal-gama.md`.

### Cenário B — Associação errada (etapas existem mas em outro obra_id)

**Fix:** Migration SQL pra corrigir `obra_id`. Exemplo:

```sql
-- Substituir 'OBRA_ID_ERRADO' pelo ID descoberto no Step 2
UPDATE public.etapas_obra
SET obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428'
WHERE id IN ('ETAPA1_ID', 'ETAPA2_ID', ...);
```

Criar `supabase/migrations/20260523120000_fix_etapas_ramal_gama.sql` com o UPDATE específico aos IDs descobertos. Aplicar via MCP.

### Cenário C — Bug de código em ObrasPage

**Fix:** Adicionar persist correto no fluxo descoberto. Detalhar conforme onde foi achado:

- Se `ObrasPage` tem UI de etapas em state local sem persist: chamar `useAdicionarEtapa` (ou `useSalvarEtapasObra` se for batch) no submit
- Se há `ImportEtapasModal` quebrado: corrigir a chamada que falha silenciosamente

Implementação detalhada depende do código real. Após o fix, manual test: cadastrar 1 etapa pra Ramal do Gama via UI corrigida e ver que aparece no dropdown do `SaidaCombustivelForm`.

### Cenário D — Etapas soft-deletadas

**Fix:** Restaurar via SQL ou via UI (se houver tela de lixeira pra etapas):

```sql
UPDATE public.etapas_obra
SET deleted_at = NULL, deleted_by = NULL
WHERE obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428'
  AND deleted_at IS NOT NULL;
```

> **Aviso:** Se `etapas_obra` não tem coluna `deleted_at`, este cenário não se aplica (verificado em discovery — não tem).

- [ ] **Step 1: Aplicar fix do cenário identificado**

Executar conforme decisão da Task RG.1 Step 8.

- [ ] **Step 2: Confirmar dropdown popula**

Manual test:
1. Abrir `/combustivel` → aba Saídas → Nova Saída
2. Selecionar obra "003 - Recuperação do Ramal do Gama"
3. Confirmar que dropdown "Etapa" mostra ao menos 1 opção

- [ ] **Step 3: Commit**

```bash
git add <files>
git commit -m "fix(combustivel): etapas Ramal do Gama — <cenário aplicado>

Detalhes do diagnóstico em docs/superpowers/specs/2026-05-23-etapas-ramal-gama-findings.md."
```

---

## Task RG.3: Detectar outras obras com mesmo problema (preventivo)

### Step 1: Listar obras sem etapas

```sql
SELECT o.id, o.nome,
  (SELECT COUNT(*) FROM public.etapas_obra eo WHERE eo.obra_id = o.id) AS qtd_etapas,
  (SELECT COUNT(*) FROM public.saidas_combustivel s WHERE s.obra_id = o.id AND s.deleted_at IS NULL) AS qtd_saidas
FROM public.obras o
ORDER BY qtd_saidas DESC, o.nome;
```

Identifica obras que recebem saídas mas não têm etapas — futuras "Ramal do Gama".

### Step 2: Decisão preventiva (combinar com user)

Opções:
- **Não fazer nada**: cada obra sem etapas vai dar mesmo problema futuro. Aceitar como operacional
- **Adicionar etapa "Geral" automaticamente**: trigger pós-criação de obra cria 1 etapa default
- **Validation em SaidaCombustivelForm**: se obra escolhida não tem etapas, mostrar aviso amigável "Esta obra não tem etapas cadastradas. Cadastre em /cadastros/etapas antes de prosseguir"

> Recomendação: opção 3 (validation + aviso) — não automatiza dados sem confirmação mas melhora UX.

### Step 3: (Se opção 3 escolhida) implementar aviso no form

Modify `src/components/combustivel/SaidaCombustivelForm.tsx` — adicionar warning inline quando `obraId` selecionada e `etapasDaObra.length === 0`:

```tsx
{obraId && etapasDaObra.length === 0 && (
  <div className="text-xs text-[var(--color-warning)] mt-1">
    Esta obra não tem etapas cadastradas. Cadastre em <Link to="/cadastros/etapas" className="underline">Cadastros › Etapas</Link> antes de prosseguir.
  </div>
)}
```

- [ ] **Step 4: TypeScript + build**

```bash
npx tsc -b 2>&1 | tail -3
npm run build 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add src/components/combustivel/SaidaCombustivelForm.tsx
git commit -m "feat(combustivel): aviso quando obra escolhida não tem etapas

Preventivo pra futuros casos 'Ramal do Gama'. Form mostra warning
inline com link pra cadastros se a obra selecionada não tem etapas."
```

---

## Task RG.4: Final — push + (sem deploy específico se for só dados)

- [ ] **Step 1: Push**

```bash
git push origin fix/combustivel-etapas-ramal-gama
```

- [ ] **Step 2: Merge na main (se aprovado pelo user)**

```bash
git checkout main && git pull origin main
git merge --no-ff fix/combustivel-etapas-ramal-gama -m "Merge branch 'fix/combustivel-etapas-ramal-gama'

Investigação + fix do caso Ramal do Gama (etapas não apareciam no
form de saída). Cenário aplicado: <X>. Detalhes em
docs/superpowers/specs/2026-05-23-etapas-ramal-gama-findings.md."
git push origin main
```

- [ ] **Step 3: Deploy prod (se houve mudança de código)**

```bash
npx --yes vercel --prod 2>&1 | tail -3
```

Se foi só fix de dados, deploy não é necessário.

---

## Critérios de Aceitação

- ✅ Diagnóstico claro de qual cenário aplica (Task RG.1 Step 8)
- ✅ Fix aplicado conforme cenário (Task RG.2)
- ✅ Dropdown de etapas popula no form pra Ramal do Gama
- ✅ Outras obras sem etapas identificadas e (se opção 3) aviso implementado
- ✅ Build + tests verdes (se houve mudança de código)

## Out of scope

- ❌ Adicionar workflow de import em massa de etapas via Excel (escopo separado)
- ❌ Migrar `etapas_obra` pra ter `deleted_at` (mudança de schema fora deste plano)
- ❌ Bulk-fix de TODAS as obras sem etapas — usuário precisa decidir caso a caso
