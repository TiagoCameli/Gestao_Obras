# Prevenir Duplo-Submit / Registro Duplicado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Travar o botão de salvar de todos os forms de gravação no momento do clique, fechar o modal só no sucesso e mantê-lo aberto mostrando o erro na falha — eliminando registros duplicados por duplo-clique.

**Architecture:** Um componente compartilhado `SubmitButton` que recebe `loading` explícito e auto-desabilita + mostra spinner. Em cada form, ligar o `loading` ao estado assíncrono real: `formState.isSubmitting` do react-hook-form (forms que delegam via prop `onSubmit`, tornando o handler `async` + `await`) OU `mutation.isPending` do TanStack Query (forms que chamam a mutation direto). O fechamento do modal continua nas páginas-mãe, fechando só após `await mutateAsync` com sucesso.

**Tech Stack:** React 18 + TypeScript, react-hook-form v7.76, @tanstack/react-query v5, Vitest 4 + @testing-library/react + user-event, Tailwind. Branch de trabalho: `fix/duplo-submit-forms`.

**Spec de referência:** `docs/superpowers/specs/2026-06-03-prevenir-duplo-submit-forms-design.md`

---

## Receita-padrão de transformação (aplicada em cada form)

> Esta receita é referenciada pelas tasks de módulo (3 a 11). O executor inspeciona
> cada arquivo e aplica o caso A **ou** o caso B. Em ambos, o botão de submit vira
> `SubmitButton` com `loading` ligado ao estado assíncrono real.

**Caso A — form delega a gravação via prop `onSubmit` (maioria):**

1. No tipo de props, garantir que `onSubmit` aceita Promise:
   ```ts
   // ANTES
   onSubmit: (data: X) => void;
   // DEPOIS
   onSubmit: (data: X) => void | Promise<void>;
   ```
2. Destrinchar `isSubmitting` do `formState`:
   ```ts
   // ANTES
   formState: { errors, isValid },
   // DEPOIS
   formState: { errors, isValid, isSubmitting },
   ```
3. Tornar `onValidSubmit` `async` e dar `await` no `onSubmit`:
   ```ts
   // ANTES
   const onValidSubmit = useCallback((values: X) => {
     ...
     onSubmit(payload);
   }, [...]);
   // DEPOIS
   const onValidSubmit = useCallback(async (values: X) => {
     ...
     await onSubmit(payload);
   }, [...]);
   ```
4. Trocar o botão de submit por `SubmitButton`, mantendo a regra de `disabled` existente:
   ```tsx
   // ANTES
   <Button type="submit" disabled={!isValid || !canAct}>Registrar Frete</Button>
   // DEPOIS
   <SubmitButton loading={isSubmitting} disabled={!isValid || !canAct}>Registrar Frete</SubmitButton>
   ```
5. Import: `import SubmitButton from '<caminho>/ui/SubmitButton';` (ajustar profundidade relativa). Manter o import de `Button` se ele ainda for usado pra "Cancelar".

**Caso B — form chama a mutation direto (sem prop `onSubmit`), ex.: alguns `*Modal.tsx`:**

1. Localizar a `useMutation` usada no submit (tem `.isPending`).
2. Trocar o botão por `SubmitButton` com `loading={minhaMutation.isPending}`:
   ```tsx
   <SubmitButton loading={salvarMutation.isPending} disabled={!isValid}>Salvar</SubmitButton>
   ```
3. Garantir que o submit usa `await mutateAsync(...)` dentro de `try/catch`, fecha o modal só no sucesso e no `catch` reporta o erro (não fecha). Se já estiver assim, só trocar o botão.

**Auditoria da página-mãe (Caso A):** onde o form é renderizado, o handler passado em
`onSubmit` deve ser `async`, dar `await mutation.mutateAsync(...)`, fechar o modal **só
no sucesso** (nunca em `finally`, nunca antes do `await`) e no `catch` manter aberto +
`reportError`. Modelo correto já existe em `src/pages/Frete.tsx` (`handleSubmit`).

**Se um `type="submit"` for de busca/filtro/login** (não grava registro de negócio):
pular, e anotar como exclusão no commit do módulo.

---

## Task 1: Componente `SubmitButton` + teste unitário

**Files:**
- Create: `src/components/ui/SubmitButton.tsx`
- Test: `src/components/ui/SubmitButton.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/ui/SubmitButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SubmitButton from './SubmitButton';

describe('SubmitButton', () => {
  it('mostra o label normal e fica habilitado quando não está carregando', () => {
    render(<SubmitButton loading={false}>Registrar Frete</SubmitButton>);
    const btn = screen.getByRole('button', { name: /registrar frete/i });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute('type', 'submit');
  });

  it('fica desabilitado e mostra "Salvando..." quando loading=true', () => {
    render(<SubmitButton loading>Registrar Frete</SubmitButton>);
    const btn = screen.getByRole('button', { name: /salvando/i });
    expect(btn).toBeDisabled();
  });

  it('respeita disabled recebido por prop quando não está carregando', () => {
    render(<SubmitButton loading={false} disabled>Salvar</SubmitButton>);
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
  });

  it('usa loadingLabel customizado', () => {
    render(<SubmitButton loading loadingLabel="Enviando...">Enviar</SubmitButton>);
    expect(screen.getByRole('button', { name: /enviando/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test -- src/components/ui/SubmitButton.test.tsx`
Expected: FAIL — "Cannot find module './SubmitButton'".

- [ ] **Step 3: Implementar o `SubmitButton`**

Create `src/components/ui/SubmitButton.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Button from './Button';
import Spinner from './Spinner';

interface SubmitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Estado assíncrono real: formState.isSubmitting (RHF) ou mutation.isPending (TanStack). */
  loading: boolean;
  /** Regra de disabled que o form já calcula (ex.: !isValid || !canAct). */
  disabled?: boolean;
  /** Texto enquanto salva. Default: "Salvando...". */
  loadingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
}

/**
 * Botão de submit à prova de duplo-clique. Quando `loading`, fica desabilitado e
 * mostra um spinner — impede segunda gravação enquanto a primeira está em voo.
 */
export default function SubmitButton({
  loading,
  disabled = false,
  loadingLabel = 'Salvando...',
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={loading || disabled} {...props}>
      {loading ? (
        <>
          <Spinner size="sm" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm run test -- src/components/ui/SubmitButton.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SubmitButton.tsx src/components/ui/SubmitButton.test.tsx
git commit -m "feat(ui): SubmitButton a prova de duplo-clique"
```

---

## Task 2: Módulo Frete (referência viva do padrão)

**Files:**
- Modify: `src/components/frete/FreteForm.tsx` (props L33, formState L115, onValidSubmit L158-185, botão L645)
- Modify: `src/components/frete/PagamentoFreteForm.tsx` (onValidSubmit L195, botão ~L563)
- Modify: `src/components/frete/PedidoMaterialForm.tsx` (onValidSubmit L98, botão)
- Modify: `src/components/frete/AjusteManualTransportadoraForm.tsx` (só padronizar botão p/ SubmitButton — já aguarda)
- Test: `src/components/frete/FreteForm.duplo-submit.test.tsx`
- Verify: `src/pages/Frete.tsx` (`handleSubmit` já fecha-no-sucesso — não mexer)

- [ ] **Step 1: Escrever o teste de regressão de duplo-submit (FreteForm)**

Create `src/components/frete/FreteForm.duplo-submit.test.tsx`:

```tsx
/**
 * Regressão: clicar 2x rápido em "Registrar Frete" só pode gravar uma vez.
 * O botão trava (isSubmitting) enquanto o onSubmit assíncrono está em voo.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FreteForm from './FreteForm';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ temAcao: () => true }),
}));
vi.mock('../combustivel/AnexosUploader', () => ({ default: () => null }));

function preencherCampos() {
  // Helper preenche os campos obrigatórios mínimos do FreteForm.
  // (Ajustar aos campos reais: data, obra, origem, destino, transportadora,
  //  insumo, peso, km, valorTkm, motorista.) Ver FreteForm para labels.
}

describe('FreteForm — anti duplo-submit', () => {
  it('trava o botão durante a gravação e chama onSubmit uma vez só', async () => {
    const user = userEvent.setup();
    let resolver: () => void = () => {};
    const onSubmit = vi.fn(
      () => new Promise<void>((res) => { resolver = res; }),
    );

    render(<FreteForm onSubmit={onSubmit} onCancel={() => {}} localidades={[]} transportadoras={[]} insumos={[]} />);

    preencherCampos();

    const btn = screen.getByRole('button', { name: /registrar frete|salvando/i });
    // Se o form exigir campos, o teste pode precisar preenchê-los antes do botão habilitar.
    // O foco do teste: após o 1º clique válido, o botão fica disabled e onSubmit roda 1x.
    if (!(btn as HTMLButtonElement).disabled) {
      await user.click(btn);
      await user.click(btn); // segundo clique não deve disparar 2ª gravação
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled();
    }
    resolver();
  });
});
```

> Nota ao executor: as props exatas do `FreteForm` (`localidades`, `transportadoras`,
> `insumos`, etc.) e os campos obrigatórios devem ser lidos do componente. Se preencher
> todos os campos for custoso, o asserto central — `onSubmit` chamado 1x e botão
> "Salvando..." disabled após o 1º clique — é o que importa. Modelo de render/preenchimento:
> `src/components/frete/PagamentoFreteForm.test.tsx`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/components/frete/FreteForm.duplo-submit.test.tsx`
Expected: FAIL — hoje `onSubmit` não é awaited, botão não trava, segundo clique chama 2x.

- [ ] **Step 3: Aplicar a Receita-padrão (Caso A) no `FreteForm.tsx`**

3a. Props (L33):
```ts
// ANTES
  onSubmit: (data: Frete) => void;
// DEPOIS
  onSubmit: (data: Frete) => void | Promise<void>;
```

3b. formState (L115):
```ts
// ANTES
    formState: { errors, isValid },
// DEPOIS
    formState: { errors, isValid, isSubmitting },
```

3c. onValidSubmit (L158 e L184-185):
```ts
// ANTES
  const onValidSubmit = useCallback((values: FreteFormValues) => {
    if (!canAct) return;
    const payload: Frete = { ... };
    onSubmit(payload);
  }, [canAct, initial, fotosFrete, arquivoUrls, onSubmit]);
// DEPOIS
  const onValidSubmit = useCallback(async (values: FreteFormValues) => {
    if (!canAct) return;
    const payload: Frete = { ... };
    await onSubmit(payload);
  }, [canAct, initial, fotosFrete, arquivoUrls, onSubmit]);
```

3d. Botão (L645):
```tsx
// ANTES
        <Button type="submit" disabled={!isValid || !canAct}>
          {initial ? 'Salvar Alterações' : 'Registrar Frete'}
        </Button>
// DEPOIS
        <SubmitButton loading={isSubmitting} disabled={!isValid || !canAct}>
          {initial ? 'Salvar Alterações' : 'Registrar Frete'}
        </SubmitButton>
```

3e. Import (junto aos imports de UI no topo do arquivo):
```ts
import SubmitButton from '../ui/SubmitButton';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/components/frete/FreteForm.duplo-submit.test.tsx`
Expected: PASS.

- [ ] **Step 5: Aplicar a Receita-padrão nos outros 3 forms de frete**

`PagamentoFreteForm.tsx`, `PedidoMaterialForm.tsx`: aplicar Caso A (passos 1-5 da receita).
`AjusteManualTransportadoraForm.tsx`: já aguarda corretamente — apenas trocar o botão de
submit por `SubmitButton loading={<isSubmitting ou mutation.isPending existente>}` e
importar `SubmitButton`.

- [ ] **Step 6: Verificar a página-mãe**

Conferir `src/pages/Frete.tsx` `handleSubmit` (L272-289): já dá `await mutateAsync`, fecha
no sucesso, `catch` reporta. Nada a mudar. Conferir onde `PagamentoFreteForm`,
`PedidoMaterialForm` e `AjusteManualTransportadoraForm` são montados e garantir o mesmo padrão.

- [ ] **Step 7: Rodar toda a suíte de frete + build**

Run: `npm run test -- src/components/frete` e `npx tsc --noEmit`
Expected: testes de frete verdes; sem novos erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add src/components/frete src/components/ui/SubmitButton.tsx
git commit -m "fix(frete): trava submit e impede registro duplicado por duplo-clique"
```

---

## Task 3: Módulo Combustível

**Files:**
- Modify: `src/components/combustivel/EntradaForm.tsx`
- Modify: `src/components/combustivel/SaidaCombustivelForm.tsx`
- Modify: `src/components/combustivel/TransferenciaForm.tsx`
- Verify: páginas/modais que montam esses forms

- [ ] **Step 1: Aplicar Receita-padrão em cada form**

Para cada arquivo, inspecionar e aplicar Caso A (prop `onSubmit`) ou Caso B (mutation
direto), conforme a receita no topo. Import de `SubmitButton`: `'../ui/SubmitButton'`.
Lembrar de preservar regras de `disabled` específicas (ex.: `excedeLimite`,
`conflitoCombustivel` no `EntradaForm`).

- [ ] **Step 2: Auditar páginas-mãe**

Garantir fechar-no-sucesso conforme receita. Incluir `src/pages/mobile/MSaidaCombustivelPage.tsx`
se ele montar o form de saída.

- [ ] **Step 3: Build + testes**

Run: `npx tsc --noEmit` e `npm run test -- src/components/combustivel`
Expected: sem novos erros; testes existentes verdes.

- [ ] **Step 4: Commit**

```bash
git add src/components/combustivel src/pages/mobile/MSaidaCombustivelPage.tsx
git commit -m "fix(combustivel): trava submit dos forms (anti duplo-clique)"
```

---

## Task 4: Módulo Compras

**Files:**
- Modify: `src/components/compras/CotacaoForm.tsx`, `CotacaoFormV2.tsx`
- Modify: `src/components/compras/OrdemCompraForm.tsx`, `OrdemCompraFormV2.tsx`
- Modify: `src/components/compras/PedidoCompraForm.tsx`, `PedidoCompraFormV2.tsx`
- Modify: `src/components/compras/InsumoQuickModal.tsx`
- Verify: `src/pages/PortalCotacao.tsx` (confirmar se o submit é gravação ou portal externo; se for busca, anotar exclusão)

- [ ] **Step 1: Aplicar Receita-padrão em cada form** (Caso A ou B por arquivo). `InsumoQuickModal` provavelmente é Caso B (mutation direto).
- [ ] **Step 2: Auditar páginas-mãe** (fechar-no-sucesso).
- [ ] **Step 3: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/components/compras`.
- [ ] **Step 4: Commit**
```bash
git add src/components/compras
git commit -m "fix(compras): trava submit dos forms (anti duplo-clique)"
```

---

## Task 5: Módulo Depósitos

**Files:**
- Modify: `src/components/depositos/DepositoMaterialForm.tsx`
- Modify: `src/components/depositos/EntradaMaterialForm.tsx`
- Modify: `src/components/depositos/SaidaMaterialForm.tsx`
- Modify: `src/components/depositos/TransferenciaMaterialForm.tsx`

- [ ] **Step 1: Aplicar Receita-padrão** (Caso A ou B por arquivo).
- [ ] **Step 2: Auditar páginas-mãe.**
- [ ] **Step 3: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/components/depositos`.
- [ ] **Step 4: Commit**
```bash
git add src/components/depositos
git commit -m "fix(depositos): trava submit dos forms (anti duplo-clique)"
```

---

## Task 6: Módulo Insumos

**Files:**
- Modify: `src/components/insumos/EntradaMaterialForm.tsx`
- Modify: `src/components/insumos/SaidaMaterialForm.tsx`
- Modify: `src/components/insumos/TransferenciaMaterialForm.tsx`

- [ ] **Step 1: Aplicar Receita-padrão** (Caso A ou B por arquivo).
- [ ] **Step 2: Auditar páginas-mãe.**
- [ ] **Step 3: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/components/insumos`.
- [ ] **Step 4: Commit**
```bash
git add src/components/insumos
git commit -m "fix(insumos): trava submit dos forms (anti duplo-clique)"
```

---

## Task 7: Módulo Frota

**Files:**
- Modify: `src/components/frota/EquipamentoFormFrota.tsx`
- Modify: `src/components/frota/StatusChangeMotivoModal.tsx`
- Modify: `src/components/frota/combustivel/EsvaziarTanqueModal.tsx`
- Modify: `src/components/frota/combustivel/TanqueForm.tsx`
- Modify: `src/components/frota/documentos/DocumentoFormModal.tsx`
- Modify: `src/components/frota/especificacoes/EspecificacoesFormModal.tsx`
- Modify: `src/components/frota/financeiro/FinanceiroFormModal.tsx`

- [ ] **Step 1: Aplicar Receita-padrão** — os vários `*Modal.tsx` tendem a ser Caso B (mutation direto). Ajustar profundidade do import de `SubmitButton` (`'../../ui/SubmitButton'` nos subdiretórios).
- [ ] **Step 2: Auditar fechamento dos modais** (fechar-no-sucesso, manter aberto no erro).
- [ ] **Step 3: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/components/frota`.
- [ ] **Step 4: Commit**
```bash
git add src/components/frota
git commit -m "fix(frota): trava submit dos forms/modais (anti duplo-clique)"
```

---

## Task 8: Módulo Manutenção

**Files:**
- Modify: `src/components/manutencao/almoxarifado/NovaEntradaModal.tsx`, `PecaFormModal.tsx`
- Modify: `src/components/manutencao/os/AdicionarMaoObraOSModal.tsx`, `AdicionarPecaOSModal.tsx`, `EditarDiagnosticoOSModal.tsx`, `MudarStatusOSModal.tsx`, `NovaOSModal.tsx`
- Modify: `src/components/manutencao/planos/AplicarPlanoModal.tsx`, `AtividadeFormModal.tsx`, `NovoPlanoModal.tsx`

- [ ] **Step 1: Aplicar Receita-padrão** — em sua maioria `*Modal.tsx` Caso B (mutation direto → `loading={mutation.isPending}`). Import `'../../ui/SubmitButton'`.
- [ ] **Step 2: Auditar fechamento dos modais.**
- [ ] **Step 3: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/components/manutencao`.
- [ ] **Step 4: Commit**
```bash
git add src/components/manutencao
git commit -m "fix(manutencao): trava submit dos modais (anti duplo-clique)"
```

---

## Task 9: Funcionários + Apontamento

**Files:**
- Modify: `src/components/funcionarios/FuncionarioForm.tsx` (onValidSubmit já é `async` em L261 — garantir `await onSubmit` + botão SubmitButton)
- Modify: `src/modules/apontamento/components/FuncionarioForm.tsx` (onValidSubmit já é `async` em L191 — idem)

- [ ] **Step 1: Aplicar Receita-padrão (Caso A).** Atenção: estes já têm `onValidSubmit` async, mas hoje **não** dão `await onSubmit` nem travam o botão. Acrescentar o `await`, destrinchar `isSubmitting`, trocar o botão. Import de `SubmitButton`: ajustar profundidade (`'../ui/SubmitButton'` em funcionarios; em `src/modules/apontamento/components/` calcular o caminho relativo correto até `src/components/ui/SubmitButton`).
- [ ] **Step 2: Auditar páginas-mãe** (lembrar do fix histórico do "salvar silencioso": `useAtualizarFuncionario` já lança erro em 0 linhas — a Promise rejeita e o `isSubmitting` desliga corretamente).
- [ ] **Step 3: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/components/funcionarios src/modules/apontamento`.
- [ ] **Step 4: Commit**
```bash
git add src/components/funcionarios src/modules/apontamento
git commit -m "fix(funcionarios): trava submit dos forms (anti duplo-clique)"
```

---

## Task 10: Módulo Financeiro

**Files:**
- Modify: `src/components/financeiro/LancamentoFinanceiroForm.tsx` (onValidSubmit já `async` em L328 — garantir `await onSubmit` + SubmitButton)
- Modify: `src/components/financeiro/CategoriaFinanceiraQuickModal.tsx` (provável Caso B)

- [ ] **Step 1: Aplicar Receita-padrão** (Caso A no Lancamento, Caso B no QuickModal).
- [ ] **Step 2: Auditar páginas-mãe.**
- [ ] **Step 3: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/components/financeiro`.
- [ ] **Step 4: Commit**
```bash
git add src/components/financeiro
git commit -m "fix(financeiro): trava submit dos forms (anti duplo-clique)"
```

---

## Task 11: Páginas Mobile

**Files:**
- Modify: `src/pages/mobile/MAbrirOSPage.tsx`
- Modify: `src/pages/mobile/MMedicaoPage.tsx`
- Modify: `src/pages/mobile/MSaidaCombustivelPage.tsx` (se ainda não tratada na Task 3)

- [ ] **Step 1: Inspecionar cada página.** Estas são páginas (não forms-prop), então o submit normalmente chama a mutation direto → **Caso B**: `loading={mutation.isPending}`, fechar/navegar só no sucesso, erro mantém na tela. Import de `SubmitButton`: `'../../components/ui/SubmitButton'`.
- [ ] **Step 2: Build + testes** — `npx tsc --noEmit` e `npm run test -- src/pages/mobile`.
- [ ] **Step 3: Commit**
```bash
git add src/pages/mobile
git commit -m "fix(mobile): trava submit das paginas de gravacao (anti duplo-clique)"
```

---

## Task 12: Varredura final + verificação

**Files:** nenhum (verificação).

- [ ] **Step 1: Confirmar que nenhum form de gravação ficou pra trás**

Run:
```bash
cd ~/projects/Gestao_Obras
grep -rln 'type="submit"' src | while read f; do grep -L 'SubmitButton' "$f"; done
```
Expected: a saída só pode conter arquivos legitimamente excluídos (Login, busca/filtro,
portal). Para cada um que sobrar, confirmar que NÃO grava registro de negócio. Anotar a
lista de exclusões.

- [ ] **Step 2: Build completo**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Suíte de testes completa**

Run: `npm run test -- --run`
Expected: verde, exceto os 12 testes pré-existentes de `src/utils/fifoCombustivel.test.ts`
(dívida conhecida, não relacionada). Nenhuma NOVA falha.

- [ ] **Step 4: Teste manual no app (frete)**

Subir o app (`npm run dev`), abrir "Registrar Frete", preencher e clicar rápido 2x no
botão. Esperado: botão vira "Salvando..." e trava; cria **um** frete; modal fecha no
sucesso. Forçar um erro (ex.: offline) e confirmar que o modal **continua aberto** com
mensagem de erro e os dados preservados.

- [ ] **Step 5: Commit final (se a varredura exigiu ajustes) e atualizar o vault**

Atualizar `vault/projects/gestao-obras/status.md` com a nota do fix (anti duplo-submit
global, SubmitButton compartilhado, padrão fechar-no-sucesso) e logar em `vault/log.md`.

---

## Notas de execução

- **Dívida pré-existente:** 12 testes de `src/utils/fifoCombustivel.test.ts` já falham
  antes deste trabalho. Não são deste escopo; não tentar consertar aqui.
- **Caminho do import** de `SubmitButton` muda com a profundidade do arquivo. Conferir
  caso a caso (`../ui/...`, `../../ui/...`, `../../components/ui/...`).
- **Forms `*FormV2`:** existem versões V1 e V2 em compras. Tratar ambas — não assumir que
  só a V2 está em uso sem confirmar nas rotas/páginas.
- **Commits por módulo** facilitam a revisão incremental do Tiago e o rollback granular.
