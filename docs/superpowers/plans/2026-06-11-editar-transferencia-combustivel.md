# Editar Transferência de Combustível — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar edição de transferências de combustível (form completo), espelhando o ciclo de edição que entrada e saída já têm.

**Architecture:** Quatro mudanças de frontend, zero migration. O banco já recalcula o FIFO no UPDATE da transferência (trigger `trg_fifo_recompute_transferencia`). Falta: (1) hook de update, (2) botão "Editar" na lista, (3) wiring de edição no container com senha, (4) verificação. Tudo gated na chave de ação já existente `editar_combustivel`.

**Tech Stack:** Vite + React + TypeScript, @tanstack/react-query, Supabase, Vitest (unit), shadcn DropdownMenu, react-hook-form + Zod.

**Spec:** `docs/superpowers/specs/2026-06-11-editar-transferencia-combustivel-design.md`

---

### Task 1: Hook `useAtualizarTransferenciaCombustivel`

Faz o UPDATE da linha com `.select()` e lança erro se 0 linhas voltarem (RLS rejeita em silêncio devolvendo sucesso com 0 linhas — lição do bug "salvar não faz nada"). Espelha `useSalvarFreteDashboardCards`. No `onSuccess` invalida `transferencias_combustivel`, `depositos` **e** `saidas_combustivel` (o recompute do banco reprecifica as saídas dos tanques afetados).

**Files:**
- Create: `src/hooks/useTransferenciasCombustivel.test.tsx`
- Modify: `src/hooks/useTransferenciasCombustivel.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useTransferenciasCombustivel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { TransferenciaCombustivel } from '../types';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ usuario: { nome: 'Tester' } }),
}));

import { useAtualizarTransferenciaCombustivel } from './useTransferenciasCombustivel';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as Mock;

/** Monta from().update().eq().select() resolvendo em `result`. */
function mockUpdateChain(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ update });
  return { update, eq, select };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const transf: TransferenciaCombustivel = {
  id: 'tcf-1',
  dataHora: '2026-06-01T08:00:00',
  depositoOrigemId: 'dep-a',
  depositoDestinoId: 'dep-b',
  quantidadeLitros: 500,
  valorTotal: 3250,
  observacoes: '',
} as TransferenciaCombustivel;

beforeEach(() => vi.clearAllMocks());

describe('useAtualizarTransferenciaCombustivel', () => {
  it('atualiza e resolve quando 1 linha é alterada', async () => {
    const { update, eq } = mockUpdateChain({ data: [{ id: 'tcf-1' }], error: null });
    const { result } = renderHook(() => useAtualizarTransferenciaCombustivel(), { wrapper });
    await expect(result.current.mutateAsync(transf)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'tcf-1');
  });

  it('rejeita quando o Supabase devolve erro', async () => {
    mockUpdateChain({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useAtualizarTransferenciaCombustivel(), { wrapper });
    await expect(result.current.mutateAsync(transf)).rejects.toBeTruthy();
  });

  it('lança erro quando 0 linhas (RLS rejeitou em silêncio)', async () => {
    mockUpdateChain({ data: [], error: null });
    const { result } = renderHook(() => useAtualizarTransferenciaCombustivel(), { wrapper });
    await expect(result.current.mutateAsync(transf)).rejects.toThrow(/permiss|linha/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/projects/Gestao_Obras && npx vitest run src/hooks/useTransferenciasCombustivel.test.tsx`
Expected: FAIL — `useAtualizarTransferenciaCombustivel` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/hooks/useTransferenciasCombustivel.ts`, adicione o export logo após `useAdicionarTransferenciaCombustivel` (antes do comentário `// F10 — Lixeira`):

```ts
export function useAtualizarTransferenciaCombustivel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferencia: TransferenciaCombustivel) => {
      const { data, error } = await supabase
        .from('transferencias_combustivel')
        .update(transferenciaCombustivelToDb(transferencia))
        .eq('id', transferencia.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Falha ao salvar: sem permissão ou nenhuma linha alterada.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
      // O recompute FIFO no banco reprecifica as saídas dos tanques afetados.
      qc.invalidateQueries({ queryKey: ['saidas_combustivel'] });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/projects/Gestao_Obras && npx vitest run src/hooks/useTransferenciasCombustivel.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/Gestao_Obras
git add src/hooks/useTransferenciasCombustivel.ts src/hooks/useTransferenciasCombustivel.test.tsx
git commit -m "feat(combustivel): hook useAtualizarTransferenciaCombustivel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Botão "Editar" na lista de transferências

Adiciona props `onEdit` + `canEdit` e um item "Editar" no dropdown de ações, acima do "Excluir". Espelha `EntradaListV2` (ícone `Pencil`, gate `if (!canEdit && !canDelete) return null`).

**Files:**
- Modify: `src/components/combustivel/TransferenciaListV2.tsx`

- [ ] **Step 1: Adicionar o ícone `Pencil` ao import do lucide-react**

Linha atual (≈ linha 13):

```tsx
import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, Trash2, ArrowRight } from 'lucide-react';
```

Troque por:

```tsx
import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, Pencil, Trash2, ArrowRight } from 'lucide-react';
```

- [ ] **Step 2: Adicionar `onEdit` e `canEdit` na interface `Props`**

No bloco `interface Props { ... }`, logo acima de `onDelete: (id: string) => void;`, adicione:

```tsx
  onEdit: (transferencia: TransferenciaCombustivel) => void;
```

E logo acima de `canDelete?: boolean;`, adicione:

```tsx
  canEdit?: boolean;
```

- [ ] **Step 3: Desestruturar `onEdit` e `canEdit` na assinatura do componente**

No `export default function TransferenciaListV2({ ... })`, adicione `onEdit,` logo acima de `onDelete,`, e `canEdit = true,` logo acima de `canDelete = true,`.

- [ ] **Step 4: Renderizar o item "Editar" e abrir o dropdown também pra quem só edita**

No cell `id: 'actions'`, troque:

```tsx
        if (!canDelete) return null;
```

por:

```tsx
        if (!canEdit && !canDelete) return null;
```

E dentro do `<DropdownMenuContent align="end">`, **acima** do bloco `{canDelete && ( ... Excluir ... )}`, adicione:

```tsx
              {canEdit && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
```

- [ ] **Step 5: Atualizar o array de dependências do `useMemo` das colunas**

Na linha final do `useMemo` das colunas (`], [ch, depositosMap, insumosMap, canDelete, onDelete]);`), inclua `canEdit` e `onEdit`:

```tsx
  ], [ch, depositosMap, insumosMap, canEdit, canDelete, onEdit, onDelete]);
```

- [ ] **Step 6: Verificar tipos (sem chamador ainda → o erro esperado é no container, não aqui)**

Run: `cd ~/projects/Gestao_Obras && npx tsc --noEmit 2>&1 | grep -i "TransferenciaListV2\|FrotaCombustivelContainer" | head`
Expected: o único erro deve ser no `FrotaCombustivelContainer.tsx` reclamando que falta a prop `onEdit` em `<TransferenciaListV2>` (será resolvido na Task 3). Nenhum erro dentro de `TransferenciaListV2.tsx`.

- [ ] **Step 7: Commit**

```bash
cd ~/projects/Gestao_Obras
git add src/components/combustivel/TransferenciaListV2.tsx
git commit -m "feat(combustivel): item Editar no dropdown da lista de transferências

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wiring de edição no container

Liga tudo no `FrotaCombustivelContainer.tsx`: estado `editandoTransferencia`, hook de update, branch no submit, handler de abertura com senha (`pedirSenha`), props na lista e modal com título/initial condicionais. Espelha exatamente o que entrada já faz.

**Files:**
- Modify: `src/components/frota/combustivel/FrotaCombustivelContainer.tsx`

- [ ] **Step 1: Importar o hook de update**

Na linha de import dos hooks de transferência (a que importa `useAdicionarTransferenciaCombustivel`), inclua `useAtualizarTransferenciaCombustivel`. Ex.: se a linha for

```ts
import { useTransferenciasCombustivel, useAdicionarTransferenciaCombustivel, useExcluirTransferenciaCombustivel } from '../../../hooks/useTransferenciasCombustivel';
```

passe a importar também `useAtualizarTransferenciaCombustivel` no mesmo `{ }`.

- [ ] **Step 2: Instanciar o mutation e o estado de edição**

Logo após `const atualizarEntradaMut = useAtualizarEntradaCombustivel();` (≈ linha 199), adicione:

```ts
  const atualizarTransferenciaMut = useAtualizarTransferenciaCombustivel();
```

E junto dos outros `editando*` (após `const [editandoEntrada, setEditandoEntrada] = useState<EntradaCombustivel | null>(null);`, ≈ linha 218), adicione:

```ts
  const [editandoTransferencia, setEditandoTransferencia] = useState<TransferenciaCombustivel | null>(null);
```

- [ ] **Step 3: Ramificar o `handleSubmitTransferencia` e criar o `handleEditTransferencia`**

Substitua o `handleSubmitTransferencia` atual:

```ts
  const handleSubmitTransferencia = useCallback(
    async (data: TransferenciaCombustivel) => {
      await adicionarTransferenciaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      setModalTransferenciaOpen(false);
    },
    [adicionarTransferenciaMut, usuario]
  );
```

por:

```ts
  const handleSubmitTransferencia = useCallback(
    async (data: TransferenciaCombustivel) => {
      if (editandoTransferencia) {
        await atualizarTransferenciaMut.mutateAsync(data);
      } else {
        await adicionarTransferenciaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      }
      setModalTransferenciaOpen(false);
      setEditandoTransferencia(null);
    },
    [editandoTransferencia, atualizarTransferenciaMut, adicionarTransferenciaMut, usuario]
  );

  const handleEditTransferencia = useCallback((t: TransferenciaCombustivel) => {
    pedirSenha(() => {
      setEditandoTransferencia(t);
      setModalTransferenciaOpen(true);
    });
  }, []);
```

- [ ] **Step 4: Passar `onEdit` e `canEdit` pra lista**

No `<TransferenciaListV2 ... />` (≈ linha 925), logo acima de `canDelete={canDelete}` adicione as duas props:

```tsx
          onEdit={handleEditTransferencia}
          canEdit={canEdit}
```

- [ ] **Step 5: Modal com título e `initial` condicionais + limpar estado ao fechar**

No bloco `{/* Modal Transferencia */}`, troque:

```tsx
      <Modal
        open={modalTransferenciaOpen}
        onClose={() => setModalTransferenciaOpen(false)}
        title="Nova Transferência de Combustível"
      >
        <TransferenciaForm
          onSubmit={handleSubmitTransferencia}
          onCancel={() => setModalTransferenciaOpen(false)}
          depositos={depositosOperacionais}
```

por:

```tsx
      <Modal
        open={modalTransferenciaOpen}
        onClose={() => { setModalTransferenciaOpen(false); setEditandoTransferencia(null); }}
        title={editandoTransferencia ? 'Editar Transferência de Combustível' : 'Nova Transferência de Combustível'}
      >
        <TransferenciaForm
          initial={editandoTransferencia}
          onSubmit={handleSubmitTransferencia}
          onCancel={() => { setModalTransferenciaOpen(false); setEditandoTransferencia(null); }}
          depositos={depositosOperacionais}
```

- [ ] **Step 6: Zerar o estado de edição ao abrir "Nova Transferência"**

No botão de nova transferência (≈ linha 631), troque:

```tsx
            onClick={() => setModalTransferenciaOpen(true)}
```

por:

```tsx
            onClick={() => { setEditandoTransferencia(null); setModalTransferenciaOpen(true); }}
```

- [ ] **Step 7: tsc limpo**

Run: `cd ~/projects/Gestao_Obras && npx tsc --noEmit 2>&1 | grep -i "Transferencia\|FrotaCombustivel" | head`
Expected: nenhuma saída (sem erros nesses arquivos).

- [ ] **Step 8: Commit**

```bash
cd ~/projects/Gestao_Obras
git add src/components/frota/combustivel/FrotaCombustivelContainer.tsx
git commit -m "feat(combustivel): liga edição de transferência no container (com senha)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Verificação final (build, testes, smoke manual)

**Files:** nenhum (só verificação).

- [ ] **Step 1: Suite de testes do hook + build + tsc**

```bash
cd ~/projects/Gestao_Obras
npx vitest run src/hooks/useTransferenciasCombustivel.test.tsx
npx tsc --noEmit
npm run build
```
Expected: testes verdes, `tsc` sem erro, build conclui. (Os 12 testes pré-existentes de `fifoCombustivel.test.ts` podem continuar falhando — dívida conhecida, não relacionada.)

- [ ] **Step 2: Smoke manual no app (dev)**

```bash
cd ~/projects/Gestao_Obras && npm run dev
```
No módulo Frota → Combustível → aba Transferências, com usuário que tem `editar_combustivel`:
1. Abrir o menu de ações (⋮) de uma transferência → deve aparecer **Editar** acima de Excluir.
2. Clicar Editar → deve **pedir a senha** → abrir o form preenchido com os dados da transferência (título "Editar Transferência de Combustível").
3. Trocar o **Valor** e salvar → form fecha sem erro.
4. Conferir na lista que o valor mudou; abrir um tanque afetado e confirmar que a valoração (preço médio / FIFO das saídas) refletiu o novo valor (o recompute do banco roda no UPDATE).
5. Verificar que "Nova Transferência" continua abrindo o form vazio (estado de edição zerado).

Expected: todos os passos OK. Se o salvar não der feedback de erro quando deveria, confirmar que o `TransferenciaForm` exibe o erro lançado pelo hook (ele tem `useState` de `erro`; o `onSubmit` precisa ser aguardado no submit handler do form — mesmo padrão do FuncionarioForm/EntradaForm).

- [ ] **Step 3: Finalizar a branch**

Usar a skill `superpowers:finishing-a-development-branch` pra decidir merge/PR. Não fazer push sem o ok do Tiago (a main já está com commits pendentes de push).
