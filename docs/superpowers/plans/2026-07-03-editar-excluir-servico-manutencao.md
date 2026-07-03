# Editar e excluir serviço no Caderno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps usam checkbox `- [ ]`.

**Goal:** Editar (máquina/data/tipo/horímetro/descrição) um serviço já lançado via modal, e excluir um serviço inteiro (soft delete, com senha), a partir do detalhe do serviço.

**Architecture:** 100% frontend. `useAtualizarOS` já grava todos os campos; `useExcluirOS` já faz soft delete; `v_saldo_estoque` já estorna peça/óleo via `deleted_at`. Chaves `editar_os`/`excluir_os` já existem e o Admin já as tem (sem backfill). Spec: `docs/superpowers/specs/2026-07-03-editar-excluir-servico-manutencao-design.md`.

## Global Constraints
- **Sem migration, sem chave de permissão nova, sem backfill.**
- Convenção de data idêntica ao `NovaOSModal` (âncora meio-dia, sem drift de fuso).
- Edição inline da descrição existente **fica** (não remover).
- `tsc -b`, `eslint` nos tocados, `vitest run` (fora as 12 falhas pré-existentes do `fifoCombustivel`), `vite build` limpos antes do fechamento.
- Commit direto na `main` (padrão do projeto); push com ok do Tiago.

---

## Task 1: Função pura de edição + testes (TDD)

**Files:** Create `src/components/manutencao/os/editarOS.ts` + `editarOS.test.ts`.

- [ ] **Step 1 (TDD, escrever teste primeiro):** `editarOS.test.ts` cobrindo:
  - `dataParaInput(iso)` → `yyyy-mm-dd` a partir das partes **locais** da data (não UTC), pra não pular dia. Casos: data às 12:00 local, borda perto de meia-noite, string nula → hoje.
  - `montarOSEditada(os, campos)`:
    - preserva todos os campos não editados da `os` (ex.: `custoTotal`, `numero`, peças não entram aqui, `garantiaAcionada`, etc.).
    - sobrescreve `equipamentoId`, `tipo`, `medicaoAbertura` (número ou null), `solucaoAplicada` (trim).
    - grava a data em **`dataInicioExecucao` e `dataConclusao`** via `new Date(dataInput + 'T12:00:00').toISOString()`.
    - seta `updatedBy` e `updatedAt`.
- [ ] **Step 2:** Implementar `editarOS.ts` até os testes passarem. `montarOSEditada(os: OrdemServico, campos: { equipamentoId; dataInput; tipo; medicaoAbertura: string; descricao: string; usuarioNome: string }): OrdemServico`.
- [ ] **Step 3:** `vitest run editarOS` verde + `tsc -b`. Commit.

---

## Task 2: `EditarOSModal.tsx` (novo, espelho do NovaOSModal)

**Files:** Create `src/components/manutencao/os/EditarOSModal.tsx`.

- [ ] **Step 1:** Props `{ open; onClose; os: OrdemServico; equipamentos: Equipamento[] }`. Estados pré-preenchidos da `os`: `equipamentoId`, `dataServico = dataParaInput(os.dataConclusao ?? os.dataInicioExecucao)`, `tipo`, `medicaoAbertura` (string, de `os.medicaoAbertura`), `descricao = os.solucaoAplicada`.
- [ ] **Step 2:** Mesma UI do `NovaOSModal` (FilterCombobox de máquina, Input date, Select tipo, Input horímetro, textarea descrição), título "Editar serviço", botão "Salvar alterações". Gate: `canEditar = temAcao('editar_os')`; se não, bloqueia submit com erro.
- [ ] **Step 3:** `handleSubmit`: `useAtualizarOS().mutateAsync(montarOSEditada(os, {...}))`; `onClose()` no sucesso; erro na caixa vermelha (padrão NovaOSModal). `podeSalvar = !!equipamentoId && !!tipo && !!descricao.trim()`.
- [ ] **Step 4:** `tsc -b` + eslint. Commit.

---

## Task 3: Wire no `OSDetalhe` + invalidação defensiva

**Files:** Modify `src/components/manutencao/os/OSDetalhe.tsx`, `src/hooks/useOrdensServico.ts`.

- [ ] **Step 1 (hook):** `useAtualizarOS.onSuccess` — adicionar `qc.invalidateQueries({ queryKey: ['equipamentos'] })` (defensivo, troca de máquina). Manter as invalidações atuais.
- [ ] **Step 2 (detalhe — botões no header):** ao lado do bloco do cabeçalho, dois botões:
  - **Editar** (`Pencil`, `variant="secondary"`) visível com `temAcao('editar_os')` → abre `EditarOSModal` (estado `editModalOpen`), passando `os` + `equipamentos`.
  - **Excluir serviço** (`Trash2`, estilo perigo) visível com `temAcao('excluir_os')` → abre `ConfirmDialog` (estado `confirmExcluirOpen`), **sem** `requirePassword={false}` (usa o default `true` = pede senha), title "Excluir serviço", message avisando que remove o serviço e estorna peças/óleos do estoque.
- [ ] **Step 3:** `onConfirm` do excluir → `useExcluirOS().mutateAsync({ id: os.id, deletedBy: usuario?.nome ?? '' })` → `navigate('/manutencao/os')`.
- [ ] **Step 4:** Import de `EditarOSModal`, `useExcluirOS`. `tsc -b` + eslint. Commit.

---

## Fechamento
- [ ] `tsc -b`, `eslint` nos tocados, `vitest run`, `vite build` limpos.
- [ ] Push main (ok do Tiago) → deploy Vercel.
- [ ] Teste manual em produção (com cleanup): criar serviço de teste; **editar** máquina/data/tipo/horímetro/descrição e conferir que salvou e que peças/custos ficaram; **excluir** e conferir que sumiu da lista, que o estoque de uma peça consumida voltou e que sem `excluir_os` o botão não aparece. Apagar dado de teste.
- [ ] Vault: `status.md` + `log.md`.

## Self-review (cobertura da spec)
Editar modal (5 campos, data sem drift, preserva o resto) → Tasks 1,2. Excluir com senha + soft delete + estorno automático → Task 3 (+ backend pronto). Invalidação defensiva de equipamentos → Task 3. Inline da descrição preservado → Task 3 (não toca). Sem migration/chave/backfill → confirmado no spec. Testes do payload → Task 1.
