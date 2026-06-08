# Aba de Anomalias do módulo de Frete

Data: 2026-06-08

## Objetivo

Criar uma aba "Anomalias" no módulo de Frete, espelhando o padrão já existente na
aba de Anomalias do Combustível (`src/components/combustivel/v2/anomalias/`):
detecção pura client-side, lista com filtros laterais, drawer de detalhe e o
recurso de "marcar como verificada" persistido no banco.

A motivação veio de uma auditoria manual (08/06) que achou fretes da Britam com
`valor_material` lançado fora do preço do material (BGS a 108,63/112,35 sem pedido
que justificasse). A aba automatiza esse tipo de caça.

## Detectores

Função pura `detectAnomaliasFrete(input)` retorna `Anomalia[]` ordenado por
severidade (critical → warning → info) e data desc. Detecta sobre os **fretes do
período/obra filtrados** no topo da página; usa **todos os pedidos** (sem filtro)
como referência de preço, pra ficar estável.

Severidades reusam o conceito do combustível: `critical` / `warning` / `info`.

| ID | Nome | Severidade | Granularidade | Regra |
|----|------|-----------|---------------|-------|
| **F1** | Preço de material fora do padrão | warning | por frete | R$/t do material no frete (`valor_material / peso_toneladas`) não bate com NENHUM preço de pedido (`valor_unitario`) daquele material+fornecedor, com tolerância de R$0,10/t. Só dispara quando EXISTE pedido do material+fornecedor (senão é F2). |
| **F2** | Frete de material sem pedido | warning | por frete | O material+fornecedor do frete não tem nenhum pedido cadastrado. |
| **F3** | Saldo negativo na pedreira | warning | por material+fornecedor | Soma transportada (t) do material+fornecedor maior que a soma pedida (t). |
| **F4** | Frete duplicado | critical | por grupo | Mesma `nota_fiscal` (não vazia) em 2+ fretes, OU mesma combinação (placa + peso + material + data) em janela curta (≤ mesmo dia). |
| **F5** | Cadastro incompleto | warning se faltar peso ou valor_material; info nos demais | por frete | Frete sem nota fiscal, sem peso, sem valor de material, sem placa, ou com `origem` que não casa com nenhum fornecedor (via `findFornecedorByOrigem`). |
| **F6** | Frete sem chegada | info | por frete | `data_chegada` vazia há mais de **7 dias** da `data` de saída. |

Notas:
- F1 e F2 são complementares e mutuamente exclusivos por frete: sem pedido nenhum → F2; com pedido mas preço não bate → F1.
- O match de fornecedor a partir da `origem` (texto livre) usa o mesmo `findFornecedorByOrigem` do `FreteDashboard.tsx` (match exato, depois `includes` nos dois sentidos).
- O preço-padrão de F1 é o conjunto de `valor_unitario` distintos dos pedidos daquele material+fornecedor; o frete está OK se casar com qualquer um deles dentro da tolerância. Isso respeita variação de preço real no tempo (ex: Brita 4 a 128,40 em dez/2025 tinha pedido, então NÃO é anomalia).
- ID determinístico por anomalia (mesmo detector + mesmas notas → mesmo id), pra casar com a verificação. Ex: `F1-<freteId>`, `F4-<notaFiscal>` ou `F4-<freteIdA>_<freteIdB>`, `F3-<fornecedorId>-<insumoId>`.

## Arquitetura

Arquivos novos, isolados, espelhando o combustível:

- `src/components/frete/anomalias/detect.ts` — `detectAnomaliasFrete(input: DetectInput): Anomalia[]`. Toda a lógica F1–F6. Sem estado, memoizável no caller.
- `src/components/frete/anomalias/AnomaliasFreteTab.tsx` — a aba: header com total, sidebar de filtros (severidade + detector + busca + toggle "mostrar verificadas"), lista de cards clicáveis.
- `src/components/frete/anomalias/AnomaliaFreteDrawer.tsx` — drawer de detalhe: banner de severidade, descrição, ação sugerida, banner/botão de verificação, lista de fretes afetados, ação "abrir/editar o frete".
- `src/components/frete/anomalias/FretesAfetadosList.tsx` — lista compacta dos fretes envolvidos (reusada no drawer).
- `src/hooks/useAnomaliasFreteChecks.ts` — `useAnomaliasFreteChecks()` (query → `Map<anomaliaId, Check>`), `useMarcarAnomaliaFreteVerificada()`, `useDesfazerVerificacaoAnomaliaFrete()`.

Tipos de severidade e estilos (badges, cores) reusam as mesmas variáveis CSS do
combustível (`--color-danger/warning/info` + `-soft/-fg`). Se houver um módulo de
estilos de severidade compartilhável no combustível, extrair/reusar; senão,
replicar o mapa `SEVERITY_STYLES` localmente.

### Entrada da detecção

```ts
interface DetectInput {
  fretesNoPeriodo: Frete[];          // filtrados por período + obra (filtro do topo)
  pedidos: PedidoMaterial[];         // TODOS (referência de preço/quantidade)
  fornecedores: Fornecedor[];        // pra findFornecedorByOrigem + nome
  insumoNome: Map<string,string>;    // id → nome legível
  hoje: string;                      // data de referência pra F6 (passada de fora, não Date.now interno)
}
```

## Dados / persistência

Verificação ("marcar como verificada"):

- **Tabela nova** `public.anomalias_frete_checks`:
  - `id text primary key` (id determinístico da anomalia)
  - `checked_at timestamptz not null default now()`
  - `checked_by text` (nome do usuário)
  - `motivo text` (opcional)
  - colunas de audit padrão se o projeto usa.
- **RLS:** gated na ação **`ver_frete`** já existente (SELECT/INSERT/DELETE pra quem
  tem `private.current_has_action('ver_frete')`). **Sem chave de ação nova, sem
  migration de backfill** — evita a armadilha de permissão documentada no projeto.
- Migration versionada em par `_fix.sql` / `_rollback.sql` (timestamp +100 no rollback),
  aplicada via MCP, com arquivos locais sincronizados.

Fluxo: marcar → upsert idempotente; desfazer → delete. Toggle "mostrar verificadas"
(default OFF) esconde as verificadas e exclui dos contadores.

## UX

- Aba **"Anomalias"** na página de Frete (`src/pages/Frete.tsx`), ao lado das abas
  atuais (Fretes, Pedidos de Material, Dashboard). Badge com a contagem de anomalias
  não-verificadas.
- Visibilidade da aba: ação `ver_frete` (mesma das demais abas de frete).
- Layout igual ao combustível: sidebar (filtro de severidade com contadores, filtro
  de detector F1–F6 com contadores, busca por texto, toggle "mostrar verificadas",
  limpar filtros) + lista principal de `AnomaliaRow` clicáveis que abrem o drawer.
- Detecção respeita o filtro global de período/obra já existente na página de Frete.
- Empty states: "sem anomalias no período" (verde) e "nenhuma bate com os filtros".

## Testes

- `src/components/frete/anomalias/detect.test.ts` (Vitest) cobrindo os 6 detectores:
  - F1: frete a 108,63 com pedidos só a 106,73 dispara; frete a 128,40 com pedido a 128,40 NÃO dispara; tolerância de R$0,10.
  - F2: frete de material+fornecedor sem pedido dispara; e nesse caso F1 não dispara pro mesmo frete.
  - F3: transportado > pedido por material+fornecedor dispara; igual/menor não.
  - F4: nota fiscal repetida; placa+peso+material+data repetidos.
  - F5: cada campo faltando; origem que não casa com fornecedor.
  - F6: data_chegada vazia há >7 dias dispara; ≤7 dias ou já chegou não.
- Build limpo + typecheck.

## Fora de escopo (v1)

- Chave de permissão dedicada `aba_frete_anomalias` (reusa `ver_frete`; pode vir depois com backfill correto).
- Pré-filtro de severidade vindo de KPI de outra aba (o combustível tem; aqui fica pra depois).
- Ações inline de corrigir o `valor_material` direto do drawer (por ora a ação é abrir/editar o frete no form existente).
