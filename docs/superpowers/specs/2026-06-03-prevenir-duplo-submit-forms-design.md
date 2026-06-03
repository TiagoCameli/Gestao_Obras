# Prevenir duplo-submit / registro duplicado em todos os forms

**Data:** 2026-06-03
**Autor:** Tiago (via Léo)
**Status:** Aprovado para implementação

## Problema

Em todos os forms de criação/edição do app (frete, combustível, funcionário, compras,
frota, insumos, depósitos, manutenção, financeiro), ao clicar no botão de salvar
(ex.: "Registrar Frete"), o form/modal **continua aberto e o botão continua clicável**
até a gravação assíncrona terminar. Isso abre uma janela para **duplo clique**, que
dispara duas gravações e cria **registros duplicados**.

No caso do frete isso é crítico: frete duplicado vira **caixa duplicado e medição suja**.

### Causa raiz (confirmada no código)

No `FreteForm.tsx` (e na maioria dos forms), o `onValidSubmit` chama `onSubmit(payload)`
**sem `await`**:

```ts
// src/components/frete/FreteForm.tsx:158 (ANTES)
const onValidSubmit = useCallback((values: FreteFormValues) => {
  if (!canAct) return;
  const payload: Frete = { ... };
  onSubmit(payload);            // fire-and-forget, sem await
}, [...]);
```

Sem `await`, o react-hook-form (v7.76) nunca liga `formState.isSubmitting`. O botão só
checa `isValid` (validação de campo), nunca "está salvando":

```ts
// src/components/frete/FreteForm.tsx:646 (ANTES)
<Button type="submit" disabled={!isValid || !canAct}>
  {initial ? 'Salvar Alterações' : 'Registrar Frete'}
</Button>
```

Confirmação por busca em todo o `src/`: **nenhum** form destrutura `isSubmitting` hoje
(grep `formState` + `isSubmitting` retornou vazio).

O fechamento do modal já mora na página-mãe e, no caso do Frete, já está correto:
fecha só depois do `await mutateAsync` ter sucesso, e no `catch` mantém o form aberto
mostrando o erro (`src/pages/Frete.tsx`). O bug não está no fechar; está na **janela
em que o botão fica clicável**.

## Objetivo

Quando o usuário clica em salvar:
1. O botão **trava imediatamente** (vira "Salvando...", fica `disabled`), impossível
   clicar de novo. **Zero registro duplicado.**
2. **Sucesso** → o modal fecha + toast de confirmação.
3. **Falha** → o form **continua aberto** mostrando o erro, sem perder o que foi
   digitado. **Zero frete perdido.**

Comportamento "trava e fecha no sucesso" (decisão do Tiago), aplicado a **todos** os
forms de gravação do app de uma vez.

## Não-objetivos (YAGNI)

- **Não** refatorar os forms para um framework/abstração compartilhada de form. Hoje
  cada form é feito na mão; unificar isso é outra obra.
- **Não** mudar o comportamento de fechamento para "fechamento otimista" (fechar antes
  de salvar). Foi explicitamente descartado por risco de perder gravação com a net da
  obra instável.
- **Não** mexer em forms que não gravam registro: busca, login, e telas read-only.

## Abordagem

Três peças:

### 1. Componente compartilhado `SubmitButton`

Novo arquivo `src/components/ui/SubmitButton.tsx`. Embrulha o `Button` existente
(`src/components/ui/Button.tsx`). Sem mágica de context: o estado é passado explícito.

**API:**

```ts
interface SubmitButtonProps {
  loading: boolean;                 // tipicamente formState.isSubmitting
  disabled?: boolean;               // a regra que o form já calcula (!isValid, !canAct...)
  loadingLabel?: string;            // default "Salvando..."
  children: React.ReactNode;        // label normal, ex. "Registrar Frete"
  // demais props repassadas ao Button (variant, className, etc.)
}
```

**Comportamento:**
- `disabled` efetivo = `loading || disabled`.
- Quando `loading`: mostra spinner + `loadingLabel`.
- `type="submit"` por padrão.

Benefício: todo form futuro que usar `SubmitButton` já nasce protegido.

### 2. Fix de raiz, por form (padrão mecânico de 3 passos)

Para cada form de gravação:

1. **Destrinchar `isSubmitting`** do `formState` (hoje pegam só `isValid`).
2. **Tornar `onValidSubmit` `async` e `await onSubmit(payload)`.** Esse `await` é o que
   liga o `isSubmitting` durante toda a gravação. Forms cujo `onValidSubmit` já é `async`
   mas não dão `await` no `onSubmit` também precisam do `await`.
3. **Trocar o botão de submit** por `<SubmitButton loading={isSubmitting} disabled={...}>`,
   **mantendo** a regra de `disabled` que cada form já tem.

Exemplo (FreteForm, DEPOIS):

```ts
const { ..., formState: { errors, isValid, isSubmitting } } = useForm(...);

const onValidSubmit = useCallback(async (values: FreteFormValues) => {
  if (!canAct) return;
  const payload: Frete = { ... };
  await onSubmit(payload);
}, [...]);

<SubmitButton loading={isSubmitting} disabled={!isValid || !canAct}>
  {initial ? 'Salvar Alterações' : 'Registrar Frete'}
</SubmitButton>
```

### 3. Auditoria dos handlers das páginas-mãe ("fecha no sucesso")

O fechamento do modal mora na página, não no form. Para **cada** página/modal que
hospeda um form de gravação, garantir o padrão do Frete:

```ts
const handleSubmit = async (payload) => {
  try {
    await mutation.mutateAsync(payload);   // await obrigatório
    showToast({ kind: 'success', ... });
    setModalOpen(false);                   // fecha SÓ no sucesso
  } catch (err) {
    reportError(err, '...');               // mantém aberto + mostra erro
  }
};
```

Regras: fechar **só depois** do `await` com sucesso; **nunca** otimista; **nunca** em
`finally`. Se alguma página fechar cedo, corrigir junto.

### Garantia anti-duplo-clique

Com `await` ligando `isSubmitting`, o React re-renderiza e desabilita o botão antes de
um segundo clique humano ser possível (cliques reais têm dezenas de ms de intervalo). O
botão fica travado a gravação inteira. Mata o duplicado na origem, sem ref/guard extra.

## Escopo: inventário de forms

Forms de gravação a tratar (passo de 3 + auditoria da página-mãe). Lista derivada de
`grep type="submit"` em `src/`:

**Frete (3):**
- `src/components/frete/FreteForm.tsx`
- `src/components/frete/PagamentoFreteForm.tsx`
- `src/components/frete/PedidoMaterialForm.tsx`
- (`AjusteManualTransportadoraForm.tsx` já aguarda corretamente — só padronizar p/ SubmitButton)

**Combustível (3):**
- `src/components/combustivel/EntradaForm.tsx`
- `src/components/combustivel/SaidaCombustivelForm.tsx`
- `src/components/combustivel/TransferenciaForm.tsx`

**Compras (6):**
- `src/components/compras/CotacaoForm.tsx`, `CotacaoFormV2.tsx`
- `src/components/compras/OrdemCompraForm.tsx`, `OrdemCompraFormV2.tsx`
- `src/components/compras/PedidoCompraForm.tsx`, `PedidoCompraFormV2.tsx`
- `src/components/compras/InsumoQuickModal.tsx`

**Depósitos (4):**
- `src/components/depositos/DepositoMaterialForm.tsx`
- `src/components/depositos/EntradaMaterialForm.tsx`
- `src/components/depositos/SaidaMaterialForm.tsx`
- `src/components/depositos/TransferenciaMaterialForm.tsx`

**Insumos (3):**
- `src/components/insumos/EntradaMaterialForm.tsx`
- `src/components/insumos/SaidaMaterialForm.tsx`
- `src/components/insumos/TransferenciaMaterialForm.tsx`

**Frota (7):**
- `src/components/frota/EquipamentoFormFrota.tsx`
- `src/components/frota/StatusChangeMotivoModal.tsx`
- `src/components/frota/combustivel/EsvaziarTanqueModal.tsx`
- `src/components/frota/combustivel/TanqueForm.tsx`
- `src/components/frota/documentos/DocumentoFormModal.tsx`
- `src/components/frota/especificacoes/EspecificacoesFormModal.tsx`
- `src/components/frota/financeiro/FinanceiroFormModal.tsx`

**Manutenção (11):**
- `src/components/manutencao/almoxarifado/NovaEntradaModal.tsx`, `PecaFormModal.tsx`
- `src/components/manutencao/os/AdicionarMaoObraOSModal.tsx`, `AdicionarPecaOSModal.tsx`,
  `EditarDiagnosticoOSModal.tsx`, `MudarStatusOSModal.tsx`, `NovaOSModal.tsx`
- `src/components/manutencao/planos/AplicarPlanoModal.tsx`, `AtividadeFormModal.tsx`,
  `NovoPlanoModal.tsx`

**Funcionários (1) + apontamento (1):**
- `src/components/funcionarios/FuncionarioForm.tsx`
- `src/modules/apontamento/components/FuncionarioForm.tsx`

**Financeiro (2):**
- `src/components/financeiro/LancamentoFinanceiroForm.tsx`
- `src/components/financeiro/CategoriaFinanceiraQuickModal.tsx`

**Páginas mobile (3):**
- `src/pages/mobile/MAbrirOSPage.tsx`
- `src/pages/mobile/MMedicaoPage.tsx`
- `src/pages/mobile/MSaidaCombustivelPage.tsx`

### Exclusões (NÃO tratar)

- `src/pages/Login.tsx` — login, não grava registro de negócio (mas pode ganhar trava
  de duplo-submit depois se quiser; fora do escopo).
- `src/pages/Frete.tsx`, `src/pages/PortalCotacao.tsx` — `type="submit"` de
  busca/filtro/portal externo, não criam registro duplicável (confirmar caso a caso;
  se algum for gravação real, entra no escopo).

> Nota: cada arquivo deve ser inspecionado na implementação. Se um `type="submit"`
> listado for de busca/filtro, é pulado e registrado como exclusão no plano.

## Casos de borda

- **Form já com `onValidSubmit` async** (FuncionarioForm, LancamentoFinanceiroForm,
  apontamento/FuncionarioForm): mesmo assim hoje **não** dão `await` no `onSubmit` nem
  travam o botão. Aplicar passos 2 e 3.
- **Form cujo `onSubmit` do parent não retorna Promise:** o `await` é inofensivo (await
  em valor não-Promise resolve na hora), mas perde a trava. Na auditoria da página-mãe,
  garantir que o handler é `async` e dá `await mutateAsync`, pra a Promise propagar até
  o `isSubmitting`.
- **Modais que gravam direto (sem onSubmit do parent), chamando a mutation dentro do
  próprio componente:** travar o botão pela `mutation.isPending` (TanStack Query) OU pelo
  `isSubmitting`, o que existir. Padronizar via `SubmitButton loading={...}`.
- **Botões que não são submit de form** (ações soltas): fora do escopo deste spec.

## Testes (Vitest + Playwright já existem)

- **Unit `SubmitButton`:** quando `loading=true`, fica `disabled` e mostra "Salvando...";
  quando `loading=false`, renderiza o label normal e respeita `disabled` recebido.
- **Form representativo (FreteForm):** simular duplo-submit rápido e asseverar que
  `onSubmit` é chamado **uma única vez** / botão fica `disabled` durante a gravação.
- Rodar a suíte existente; não regredir. (Ciente da dívida pré-existente de 12 testes
  falhando em `fifoCombustivel.test.ts`, não relacionada.)

## Verificação / rollout

- `npm run build` + `tsc` sem novos erros.
- Suíte Vitest verde (fora a dívida pré-existente conhecida).
- Teste manual no Frete: clicar rápido 2x em "Registrar Frete" cria **um** registro.
- Como são muitos arquivos, a implementação vai por módulos (frete primeiro como
  referência viva do padrão, depois os demais), commitando por módulo pra revisão
  incremental.
