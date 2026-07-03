# Editar e excluir serviço no Caderno de Serviços — design

**Data:** 2026-07-03
**App:** Gestão de Obras (Vite + React + TS + Supabase)
**Pedido do Tiago:** poder **editar** um serviço já lançado numa máquina e **apagar** um serviço inteiro. Hoje o caderno só deixa editar a descrição (inline) e remover peça/terceiro/óleo item a item; não dá pra mudar máquina/data/tipo/horímetro nem excluir o serviço.

## Decisões travadas (com o Tiago)
1. **Editar via modal** "Editar serviço" — reaproveita o form de registrar, pré-preenchido. Edita os 5 campos do cabeçalho: máquina, data, tipo, horímetro, descrição.
2. **Excluir com senha** — `ConfirmDialog` com `requirePassword` (re-autentica via `signInWithPassword`), por ser ação perigosa (`excluir_os` está em `ACOES_PERIGOSAS`).
3. **Botões só no detalhe** do serviço (`OSDetalhe`). Menu no card da lista fica pra depois se ele quiser.

## Descoberta-chave (o backend já está pronto e correto)
- `useAtualizarOS()` já grava **todos** os campos da OS via `ordemServicoToDb` (hoje só é usado pra salvar a descrição). Editar cabeçalho é 100% frontend.
- `useExcluirOS()` já existe e faz **soft delete** (`deleted_at` + `deleted_by`), recuperável. Já invalida `equipamentos` e `historico_status_equipamento`.
- `v_saldo_estoque` filtra `os.deleted_at IS NULL` nas CTEs `ospecas_agg` e `osoleos_agg` → apagar o serviço **estorna peça/óleo automaticamente**. Nenhum código extra de estorno.
- **Permissão:** as chaves `editar_os` e `excluir_os` já existem. Confirmado no banco que o Tiago (Administrador) tem as duas → **sem armadilha de backfill**, funciona pra ele na hora. Nenhuma chave nova.

## Editar — `EditarOSModal.tsx` (novo, espelho do `NovaOSModal`)
- Props: `os: OrdemServico`, `open`, `onClose`, `equipamentos`.
- Campos pré-preenchidos a partir da `os`: **máquina** (`equipamentoId`), **data** (derivada de `dataConclusao`), **tipo**, **horímetro** (`medicaoAbertura`), **descrição** (`solucaoAplicada`).
- Ao salvar: `useAtualizarOS.mutateAsync({ ...os, campos editados, updatedBy })`. Preserva todos os outros campos (peças/terceiros/óleos e custos são independentes do cabeçalho, calculados por trigger).
- **Data sem drift de fuso:** mesma convenção do criar (âncora meio-dia). Derivar o `yyyy-mm-dd` do input a partir das partes locais da data salva (não `.toISOString().slice(0,10)`, que pode pular um dia); ao salvar, `new Date(dataInput + 'T12:00:00').toISOString()` gravado em `dataInicioExecucao` e `dataConclusao`, idêntico ao `NovaOSModal`.
- Extrair a montagem do payload numa **função pura** `montarOSEditada(os, campos)` em `src/components/manutencao/os/editarOS.ts` (com `editarOS.test.ts` ao lado) pra testar sem render.
- Gated em `editar_os` (`temAcao`). Feedback de erro na caixa do form, igual ao `NovaOSModal`.

## `OSDetalhe.tsx` — botões no cabeçalho
- Botão **Editar** (ícone lápis) no header → abre `EditarOSModal`. Só aparece com `editar_os`.
- Botão **Excluir serviço** (ícone lixeira, estilo perigo) → abre `ConfirmDialog` (`requirePassword` default `true`) → no confirm chama `useExcluirOS({ id: os.id, deletedBy: usuario.nome })` → `navigate('/manutencao/os')`. Só aparece com `excluir_os`.
- A **edição inline da descrição** que já existe **fica** (serve quem só tem `editar_diagnostico_os`, permissão mais leve). Sem regressão. As duas rotas de editar descrição coexistem sem conflito.

## Hook — ajuste mínimo
- `useAtualizarOS`: adicionar invalidação defensiva de `['equipamentos']` no `onSuccess` (caso trocar de máquina dispare `tg_os_sync_equipamento_status`, preservado no drop). Barato, sem risco.
- Nenhum outro hook muda. `useExcluirOS` já invalida o necessário.

## O que NÃO precisa
- **Sem migration.** **Sem chave de permissão nova.** **Sem backfill.**
- Sem tela de restaurar serviço excluído (soft delete guarda o dado; recuperação é via banco se um dia precisar — fora de escopo).

## Compatibilidade / edge cases
- Trocar a máquina de um serviço já concluído: o relatório por máquina passa a contá-lo na nova máquina (comportamento esperado). Status é vestigial no caderno (`concluida`), o sync de status não deve reagir a troca de máquina; a invalidação defensiva cobre.
- Apagar serviço com peça/óleo com baixa: estoque volta sozinho (view). Peça/óleo sem depósito (lançados antes da baixa) não davam baixa, então nada a estornar.

## Fora de escopo (YAGNI)
- Menu editar/excluir no card da lista (`OSCard`).
- Editar peça/terceiro/óleo já lançado (hoje é remover+readicionar; segue assim).
- Lixeira/restaurar de serviços na UI.
- Editar campos que o caderno não captura (prioridade, medição de conclusão, paradas, garantia, anexos pós-criação).

## Testes
- **Unit (Vitest):** `montarOSEditada` — preserva campos não editados, sobrescreve os 5 editados, deriva a data sem pular dia (casos de fuso Acre UTC-5 e borda de meia-noite), grava data nos dois campos, seta `updatedBy`.
- **Manual (produção, com cleanup):** criar serviço de teste; editar máquina/data/tipo/horímetro/descrição e conferir que salvou e que peças/custos ficaram; apagar o serviço e conferir que sumiu da lista e que o estoque de uma peça consumida voltou; conferir que sem `excluir_os` o botão não aparece. Apagar dado de teste.

## Verificação de fechamento
`npx tsc -b`, `npx eslint` nos arquivos tocados, `npx vitest run` (fora as 12 falhas pré-existentes do `fifoCombustivel`), `npx vite build` limpos. Commit direto na `main` (padrão do app pra este projeto), push com ok do Tiago → deploy Vercel.
