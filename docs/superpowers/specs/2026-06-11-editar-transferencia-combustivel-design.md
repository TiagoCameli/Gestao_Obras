# Edição de transferência de combustível

Data: 2026-06-11

## Objetivo

Habilitar a edição de transferências de combustível no módulo de Combustível.
Hoje a transferência só pode ser **criada** e **excluída**: a lista
(`TransferenciaListV2`) expõe apenas "Excluir" e o hook
(`useTransferenciasCombustivel`) tem `adicionar`, `deletar`, `restaurar` e
`excluir`, mas **não tem `atualizar`**. Entrada e saída já têm o ciclo completo
(incluindo edição); a transferência ficou pela metade.

Motivação concreta: uma transferência entrou com o valor (preço do combustível)
errado e não há como corrigir pela tela. Como a transferência é um lote FIFO no
tanque destino (`fonteTipo: 'transferencia'` em `fifoCombustivel.ts` e somada em
`precoMedioTanque.ts`), o valor errado contamina a valoração das saídas para
frente.

## Achado que destrava o trabalho (backend já pronto)

A migration `20260528220000_combustivel_fifo_autoritativo_fix.sql` já criou o
trigger:

```sql
CREATE TRIGGER trg_fifo_recompute_transferencia
  AFTER INSERT OR UPDATE OR DELETE ON public.transferencias_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_recompute_fifo_transferencia();
```

A função recalcula o FIFO dos **dois** tanques afetados (origem e destino) em
qualquer UPDATE. Ou seja: assim que o frontend conseguir fazer o UPDATE da linha,
o banco reprecifica as saídas dos tanques sozinho. **Não há migration nem
mudança de schema neste trabalho.** A peça que falta é só o frontend de edição.

## Escopo

Edição via **form completo** (decisão do Tiago, 2026-06-11): abre o
`TransferenciaForm` com todos os campos editáveis (data/hora, tanque origem,
tanque destino, litros, valor total, observações, anexos), exatamente como
entrada e saída já fazem. O form já aceita a prop `initial`, então não precisa
de mudança nele.

Fora de escopo: edição "só do valor", mudança de schema, mudança no trigger de
recompute, refator de FIFO.

## Arquitetura

Quatro mudanças de frontend, espelhando o padrão de **entrada**
(`useAtualizarEntradaCombustivel` + `editandoEntrada`):

### 1. Hook `useAtualizarTransferenciaCombustivel`
Arquivo: `src/hooks/useTransferenciasCombustivel.ts` (novo export).

Espelha `useAtualizarEntradaCombustivel`:
- `mutationFn`: `supabase.from('transferencias_combustivel').update(transferenciaCombustivelToDb(t)).eq('id', t.id).select()`.
- Lança erro se `error` **ou** se `data` voltar com 0 linhas (RLS rejeitando o
  UPDATE devolve sucesso com 0 linhas, conforme a lição do bug "salvar não faz
  nada" — `status.md`). A mensagem deve ser clara o suficiente pro form exibir.
- `onSuccess`: invalida `['transferencias_combustivel']`, `['depositos']` **e**
  `['saidas_combustivel']`. A invalidação das saídas é essencial: o recompute no
  banco reprecifica as saídas dos tanques afetados, e a tela precisa recarregar
  os valores novos.

### 2. Botão "Editar" na lista
Arquivo: `src/components/combustivel/TransferenciaListV2.tsx`.

- Nova prop `onEdit: (transferencia: TransferenciaCombustivel) => void`.
- Novo `DropdownMenuItem` "Editar" acima do "Excluir", com
  `e.stopPropagation()` igual ao "Excluir" (a linha tem `onSelect` que abre o
  drawer de detalhes; o stopPropagation evita o conflito).
- Gate de exibição: mesmo critério de permissão usado hoje pro "Excluir"
  (`canDelete`/equivalente de combustível). Sem chave de ação nova.

### 3. Estado e wiring no container
Arquivo: `src/components/frota/combustivel/FrotaCombustivelContainer.tsx`.

- `const [editandoTransferencia, setEditandoTransferencia] = useState<TransferenciaCombustivel | null>(null)`.
- `const atualizarTransferenciaMut = useAtualizarTransferenciaCombustivel()`.
- `handleSubmitTransferencia` passa a ramificar: se `editandoTransferencia` →
  `atualizarTransferenciaMut.mutateAsync(...)`, senão → adicionar (fluxo atual).
  Limpa `setEditandoTransferencia(null)` no fim, igual entrada/saída.
- Handler de abertura da edição: `setEditandoTransferencia(t); setModalTransferenciaOpen(true)`,
  passado como `onEdit` pra `TransferenciaListV2`.
- Botão "Nova Transferência" zera `setEditandoTransferencia(null)` antes de abrir
  (igual entrada/saída).
- Modal: `initial={editandoTransferencia}`, título condicional
  `editandoTransferencia ? 'Editar Transferência' : 'Nova Transferência'`,
  e `onClose`/`onCancel` zeram `setEditandoTransferencia(null)`.

### 4. Permissão / senha
Mantém o padrão do módulo, sem nada novo:
- Exibição do botão "Editar" gated em `canEdit = temAcao('editar_combustivel')`
  (chave **já existente**, usada por entrada/saída/tanque). Sem chave de ação
  nova → sem armadilha de backfill de templates de cargo.
- **Editar pede senha** (`pedirSenha`), exatamente como `handleEditEntrada` e
  `handleEditSaida` fazem hoje: o handler envolve `setEditando... + abrir modal`
  dentro de `pedirSenha(() => { ... })`.
- **Excluir** continua pedindo senha (`pedirSenha`), sem mudança.

## O que NÃO muda
- `transferenciaCombustivelSchema` — já valida todos os campos.
- `TransferenciaForm` — já aceita `initial`.
- Banco / migrations / trigger de recompute — já existem e disparam no UPDATE.

## Testes
- Unit do hook `useAtualizarTransferenciaCombustivel` (Vitest), espelhando o
  teste do update de saída/`useFuncionarios.test.tsx`:
  - caso sucesso: chama `.update().eq().select()`, resolve, invalida as 3 queries.
  - caso erro Supabase: rejeita com o erro.
  - caso 0 linhas (RLS): rejeita com erro claro (não resolve em silêncio).
- `tsc` e build limpos.
- (Não há lógica pura nova além do hook; sem novos testes de util.)

## Risco residual
O recompute FIFO roda sobre todas as saídas dos tanques afetados. O `status.md`
registra que isso é pesado no tanque Meloza Colorado (~727 saídas), com latência
de alguns segundos por operação. Editar uma transferência desse tanque terá a
mesma latência que já existe ao mexer numa saída dele. Aceitável; é
comportamento de banco pré-existente, não introduzido por este trabalho.

Ver também: `status.md` (vault, projeto gestao-obras) — seções "FIFO
autoritativo" e "Bug do salvar não faz nada".
