# Cards de saldo configuráveis no dashboard de frete

**Data:** 2026-06-03
**Módulo:** Frete (`src/components/frete/FreteDashboard.tsx`)

## Problema

A seção "Saldos" do dashboard de frete renderiza cards chumbados no código, um por
fornecedor fixo (Areacre, Triunfo, Andrade, ETAM, EMT Transportes). Não há jeito de
escolher quais fornecedores aparecem sem editar o código e fazer deploy. O Tiago quer
selecionar, dentro do app, quais cards de saldo aparecem.

## Decisões (do brainstorming)

- **Universo:** qualquer fornecedor da tabela `fornecedores` pode virar card (não só
  `eh_transportadora`).
- **Alcance:** configuração **global** — todos no app veem o mesmo conjunto de cards
  (salvo no Supabase, não em localStorage por usuário).
- **Edição:** botão "Gerenciar cards" no próprio dashboard, no topo da seção de saldos.
- **Permissão:** qualquer um que vê o frete pode editar. Reutiliza a chave `ver_frete`.
  **Nenhuma chave de ação nova** → zero risco da armadilha de backfill de templates.
- **Fornecedor sem frete:** permitido. Entra como card **zerado**, sem bloqueio no
  seletor. Aviso discreto "(sem frete)" no seletor pra quem não tem `eh_transportadora`.
- **Ordenação:** ordem do array salvo. Seed mantém a ordem de hoje; card novo entra no
  fim. Reordenar arrastando fica pra uma onda futura.

## Arquitetura

### 1. Banco — tabela de config global

Migration nova (par `_fix.sql` / `_rollback.sql`, timestamp +100 no rollback):

```sql
CREATE TABLE public.frete_dashboard_cards_config (
  id          text PRIMARY KEY DEFAULT 'global',
  fornecedor_ids text[] NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_por text NOT NULL DEFAULT '',
  CONSTRAINT frete_dashboard_cards_config_singleton CHECK (id = 'global')
);
```

- Singleton: uma linha só, `id='global'`.
- **Seed** na própria migration, preservando a ordem atual:

```sql
INSERT INTO public.frete_dashboard_cards_config (id, fornecedor_ids)
SELECT 'global', ARRAY(
  SELECT f.id FROM (VALUES
    ('areacre', 1), ('transportadora triunfo', 2), ('andrade transporte', 3),
    ('etam construtora', 4), ('emt transportes', 5)
  ) AS ord(nome, pos)
  JOIN public.fornecedores f ON lower(trim(f.nome)) = ord.nome
  ORDER BY ord.pos
)
ON CONFLICT (id) DO NOTHING;
```

(Se algum nome não casar, simplesmente não entra no seed; o card pode ser adicionado
depois pelo seletor. A migration não falha.)

### 2. RLS — per-command, reaproveitando `ver_frete`

Seguindo o padrão do repo (`private.current_has_action(...)`):

- `ENABLE ROW LEVEL SECURITY`.
- SELECT: `private.current_has_action('ver_frete')`.
- UPDATE: `private.current_has_action('ver_frete')`.
- Sem INSERT/DELETE pela app (a linha singleton já existe via seed). Se preferir
  robustez, INSERT também gated em `ver_frete` com `WITH CHECK (id='global')`.

### 3. Camada de dados — hook `useFreteDashboardCards`

`src/hooks/useFreteDashboardCards.ts`:

- `useFreteDashboardCards()` — `useQuery`, key `['frete-dashboard-cards']`, lê a linha
  `global` e retorna `fornecedorIds: string[]`.
- `useSalvarFreteDashboardCards()` — `useMutation` que faz
  `UPDATE ... SET fornecedor_ids = $ids, updated_at = now(), updated_por = <funcionarioId>`
  com `.select()` e lança erro se 0 linhas (mesmo padrão defensivo do
  `useAtualizarFuncionario`, pra não ter "salvar silencioso"). Invalida a query no sucesso.

### 4. Render dinâmico dos cards

Em `FreteDashboard.tsx`:

- Generalizar a leitura de agregado: já existe `saldosFiltrados: Map<transportadoraId,
  {saldo, creditoFreteTotal, pagoFreteTotal, debitoCombustivelTotal}>` (linhas ~457-480).
  O `transportadoraId` é o `fornecedores.id`. Logo, pra qualquer fornecedor selecionado,
  `saldosFiltrados.get(fornecedor.id) ?? zeros`.
- Substituir os 5 `<SaldoCard>` chumbados (linhas ~1107-1153) por um `.map()` sobre
  `fornecedorIds` (na ordem do array) → pra cada id: acha o `Fornecedor` em
  `useFornecedores()`, pega o agregado, monta `linhas`:
  - `Crédito Frete: +<creditoFreteTotal>`
  - `Pago Frete: −<pagoFreteTotal>`
  - `Débito Combustível: −<debitoCombustivelTotal>` **só quando** `debitoCombustivelTotal > 0`
    (cobre Areacre/dona de tanque sem hardcode).
  - `titulo` = `fornecedor.nome`. `onClick` = `onVerContaCorrente` (mesmo de hoje).
- Fornecedor sem nenhum movimento → agregado zerado, card mostra R$ 0,00 (cor cinza, já
  tratado no `SaldoCard`).
- Extrair a montagem de `linhas` numa função pura testável,
  ex.: `montarLinhasSaldoCard(agg, fornecedor)`.

### 5. UI "Gerenciar cards"

- Botão no cabeçalho da seção de saldos (mesma faixa do título "Saldos").
- Abre o `FilterMultiSelect` **já existente** no arquivo (linhas ~17-100): opções = todos
  os fornecedores de `useFornecedores()` (`{value:id, label:nome}`), `selected` =
  `fornecedorIds` atuais.
  - Label de fornecedor sem `eh_transportadora`: sufixo discreto " (sem frete)".
- Ao mudar a seleção, chama `useSalvarFreteDashboardCards`. Ordem: mantém os já
  selecionados na ordem atual e **anexa os novos no fim** (não reordena o existente).
- Feedback de erro de salvar visível (não engolir falha de RLS).

## Componentes e responsabilidades

| Unidade | O que faz | Depende de |
|---|---|---|
| migration `frete_dashboard_cards_config` | tabela + RLS + seed | `fornecedores`, `private.current_has_action` |
| `useFreteDashboardCards` | lê/salva o array de ids | supabase, AuthContext (funcionarioId) |
| `montarLinhasSaldoCard` (pura) | agg + fornecedor → linhas do card | nada (pura) |
| seção de saldos no `FreteDashboard` | render dinâmico + botão gerenciar | hooks acima, `FilterMultiSelect`, `SaldoCard` |

## Tratamento de erro

- Salvar config: `.select()` + erro em 0 linhas (RLS), exibido na UI.
- Fornecedor referenciado no array mas inexistente em `fornecedores` (ex.: deletado):
  o `.map()` ignora ids que não casam (`if (!fornecedor) return null`), sem quebrar.
- Seed que não casa nome: linha entra com array parcial ou vazio, sem falhar a migration.

## Testes (Vitest)

- `useFreteDashboardCards`: lê o array; salva e invalida; erro em 0 linhas.
- `montarLinhasSaldoCard`: com débito combustível (mostra linha) e sem (omite); valores
  zerados pra fornecedor sem movimento.

## Fora de escopo (YAGNI)

- Reordenar cards arrastando.
- Preferência por usuário (é global de propósito).
- Tabela de junção / ordenação persistida fora do array.
- Chave de ação dedicada pra "gerenciar cards" (reutiliza `ver_frete`).

## Riscos / notas

- `transportadoraId` em `transportadora_movimentos` = `fornecedores.id`. Confirmar no
  schema durante a implementação (a fórmula de agregação já assume isso hoje).
- Migrations no repo estão dessincronizadas do remoto (drift conhecido). Aplicar via MCP
  com confirmação do Tiago e versionar o arquivo local no par fix/rollback.
