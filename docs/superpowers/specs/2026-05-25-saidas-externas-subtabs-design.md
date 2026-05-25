# Saídas: sub-tabs Todas / Internas / Externas

**Data:** 2026-05-25
**Módulo:** Combustível (`/combustivel`)
**Status:** Spec aprovada para implementação

## Problema

A aba "Saídas" do módulo Combustível hoje mostra todas as saídas misturadas (origem `tanque` interno, `tanque` externo, `dinheiro`, `requisicao`). Não há separação visual entre saídas internas (consumo do estoque próprio) e saídas externas (compras avulsas — tanque externo, dinheiro vivo, requisição em posto). O usuário precisa de uma visão focada nas saídas externas para auditoria de gastos avulsos, sem perder a visão consolidada atual.

## Objetivo

Subdividir a aba "Saídas" em três sub-tabs:

- **Todas** — comportamento atual (sem alteração).
- **Internas** — apenas `origem='tanque'` com depósito interno (`ehExterno=false`).
- **Externas** — `origem='dinheiro'` + `origem='requisicao'` + `origem='tanque'` com depósito externo (`ehExterno=true`), com filtro adicional de origem.

Filtro de origem (`dinheiro` / `requisicao` / `tanque_externo`) visível apenas quando a sub-tab Externas está ativa. Estado persistente na URL, consistente com o padrão do `FilterContext` v2 do módulo.

## Modelo de estado

Adicionar duas chaves ao `CombustivelFilterState`
(`src/components/combustivel/v2/filters/types.ts`):

```ts
/** Sub-divisão da aba Saídas. Aplica somente em subTab='saidas'.
 *  'todas' = sem filtro adicional (default).
 *  'internas' = origem='tanque' && deposito.ehExterno=false.
 *  'externas' = origem='dinheiro' || origem='requisicao' ||
 *               (origem='tanque' && deposito.ehExterno=true). */
saidasView: 'todas' | 'internas' | 'externas';

/** Subset opcional dentro de saidasView='externas'.
 *  Vazio (default) = todas as 3 origens externas.
 *  Ignorado quando saidasView !== 'externas'. */
origensExterna: Array<'dinheiro' | 'requisicao' | 'tanque_externo'>;
```

**Defaults:** `saidasView='todas'`, `origensExterna=[]`. Ambas mantêm o comportamento atual da aba.

**Setters novos no FilterContext** (`src/components/combustivel/v2/filters/FilterContext.tsx`):

```ts
setSaidasView: (v: 'todas' | 'internas' | 'externas') => void;
toggleOrigemExterna: (o: 'dinheiro' | 'requisicao' | 'tanque_externo') => void;
setOrigensExterna: (arr: Array<'dinheiro' | 'requisicao' | 'tanque_externo'>) => void;
```

## Serialização URL

Em `urlState.ts`:

- `saidasView` → param `sview`. Não serializa quando `'todas'` (default), pra manter URL limpa.
- `origensExterna` → param `sextorigens` (CSV). Não serializa quando vazio.

Exemplos:

```
?sview=externas
?sview=externas&sextorigens=dinheiro,requisicao
?sview=internas
```

`fromSearchParams`: parse defensivo — valores fora do enum caem no default. `hasActiveFilters` passa a considerar `saidasView !== 'todas'` e `origensExterna.length > 0` também.

## Lógica de filtragem

No `FrotaCombustivelContent`, estender a memo `saidasFiltradas`. Após os filtros globais existentes (período, obras, equipamentos etc.), aplicar:

```
1. Construir tanquesExternosSet = new Set<string>(
     depositosTodos.filter(d => d.ehExterno).map(d => d.id)
   )  // memoizado por depositosTodos

2. Se saidasView === 'internas':
     manter só s.origem === 'tanque' && s.tanqueId && !tanquesExternosSet.has(s.tanqueId)

3. Se saidasView === 'externas':
     baseExterna = s.origem === 'dinheiro'
       || s.origem === 'requisicao'
       || (s.origem === 'tanque' && s.tanqueId && tanquesExternosSet.has(s.tanqueId))
     se !baseExterna → exclui
     se origensExterna.length > 0:
       mapear cada s pra sua "origem externa" derivada:
         - origem='dinheiro'    → 'dinheiro'
         - origem='requisicao'  → 'requisicao'
         - origem='tanque' externo → 'tanque_externo'
       manter só quando origensExterna.includes(derivada)

4. saidasView === 'todas': sem passo extra (comportamento atual preservado)
```

A função `dentroPeriodo` e demais filtros globais continuam aplicados antes desse passo, sem alteração.

## UI

### Localização

Dentro do bloco `subTab === 'saidas'` em `FrotaCombustivelContainer.tsx`, acima da `<SaidaCombustivelListV2>` e abaixo do banner sentinel existente.

### Sub-tabs

Usar `Tabs`/`TabsList`/`TabsTrigger` do `src/components/shadcn/tabs.tsx` (já existe). Labels com count entre parênteses:

```
[ Todas (X) ] [ Internas (Y) ] [ Externas (Z) ]
```

Onde X/Y/Z são derivados de `saidasFiltradas` pré-passo `saidasView` (ou seja, o total já filtrado pelos filtros globais, antes de cortar por view). Isso requer dividir a memo em duas etapas:

```
saidasGloballyFiltered = aplica filtros globais
saidasFiltradas = saidasGloballyFiltered + passo saidasView/origensExterna
counts = { todas, internas, externas } derivado de saidasGloballyFiltered
```

### Segmented control de origem (visível só em Externas)

Aparece logo abaixo das sub-tabs, alinhado à esquerda. 3 toggles tipo "pill":

```
Origem: [ Dinheiro ] [ Requisição ] [ Tanque Externo ]
```

- Estado visual ligado quando `origensExterna.includes(o)`.
- Vazio = "todas" (todos os pills neutros). Clicar liga/desliga.
- Componente: pode usar `Button` com `variant` toggle existente ou pill custom (decisão de implementação — preferir o que já tem no projeto).

### Chips de filtro

`FilterChips.tsx` ganha:

- Chip "Saídas: Internas" / "Saídas: Externas" quando `saidasView !== 'todas'`. Removível (volta pra `'todas'`).
- Chip "Origem: Dinheiro" / "Origem: Requisição" / "Origem: Tanque Externo" pra cada valor em `origensExterna`. Removíveis individualmente.

Novos kinds no tipo `ChipKind`: `'saidas_view'`, `'origem_externa'`.

## Arquivos a tocar

1. **`src/components/combustivel/v2/filters/types.ts`** — adicionar `saidasView` e `origensExterna` ao `CombustivelFilterState`.
2. **`src/components/combustivel/v2/filters/urlState.ts`** — `fromSearchParams`/`toSearchParams`/`defaultFilterState`/`hasActiveFilters`.
3. **`src/components/combustivel/v2/filters/FilterContext.tsx`** — novos setters + tipos no `FilterContextValue` + `ChipKind` + handlers no `removeFilter`.
4. **`src/components/combustivel/v2/filters/FilterChips.tsx`** — renderização dos novos chips.
5. **`src/components/frota/combustivel/FrotaCombustivelContainer.tsx`** — Tabs shadcn + segmented control + lógica de filtragem em duas etapas.
6. (Opcional, decidir durante implementação) **`src/components/combustivel/v2/saidas/SaidasViewTabs.tsx`** — extrair Tabs + segmented control + counts num componente próprio se o container ficar grande demais. Aceitável manter inline se ficar <60 linhas.

## Edge cases

- **`AtribuirSentinelModal` / banner sentinel:** baseado em `apenasSentinel` + `mode='proprios'`. Independente de `saidasView`. Comportamento mantido.
- **Lixeira / Anomalias / SemSuprimento:** abas separadas, não tocam.
- **`SaidaDetalhesDrawer`:** sem mudança.
- **Exportar PDF / Relatórios:** consomem `todasSaidas`, não filtradas pela view. Mantido.
- **Switching de aba principal (Saídas → Entradas):** `saidasView` e `origensExterna` persistem na URL mas só têm efeito quando volta pra Saídas.
- **Switching de `mode` (próprios ↔ carretas):** `setMode` hoje limpa filtros específicos do mode anterior. `saidasView`/`origensExterna` são ortogonais ao mode → preservar entre switches.
- **`clearAll`:** reseta também `saidasView` e `origensExterna` pros defaults.

## Testing

### Unit

- `urlState.test.ts` (criar se não existir, ou estender):
  - parse de `?sview=externas&sextorigens=dinheiro,requisicao` → state correto.
  - parse de valores inválidos (`?sview=xyz`) → fallback `'todas'`.
  - round-trip: state → URLSearchParams → state preserva.
  - `hasActiveFilters` true quando `saidasView='externas'` mesmo sem outros filtros.
- Teste de filtragem (criar `saidasFilter.test.ts` ou similar) cobrindo a matriz:
  - `todas`: retorna todas as saídas globais.
  - `internas`: exclui dinheiro, requisicao, tanque externo. Inclui tanque interno.
  - `externas` sem `origensExterna`: inclui dinheiro + requisicao + tanque externo.
  - `externas` com `origensExterna=['dinheiro']`: só dinheiro.
  - `externas` com `origensExterna=['dinheiro','tanque_externo']`: dinheiro + tanque externo.

### Smoke manual

- Click sub-tab Internas → tabela atualiza, count bate.
- Click sub-tab Externas → segmented control aparece; sem nenhum pill ligado, mostra os 3 tipos.
- Liga "Dinheiro" → tabela filtra; chip aparece em FilterChips; URL ganha `sextorigens=dinheiro`.
- Copia URL, abre em nova aba → mesmo state.
- Click ✕ no chip "Saídas: Externas" → volta pra `todas`, segmented control some.
- `clearAll` → tudo volta pro default.

## Não está no escopo

- Filtro de pago/não-pago (decidido fora de escopo nesta iteração — pode ser adicionado depois).
- Filtro de fornecedor/posto pra requisição (saídas não têm campo de fornecedor estruturado).
- Faixa de valor unitário.
- Alterações em Visão Geral, Anomalias, Relatórios, Lixeira ou qualquer aba que não seja Saídas.
- Alterações no schema da tabela `saidas_combustivel`.

## Bloco 3 modernização aplicada

- **3.3** — usa `Tabs` shadcn (`src/components/shadcn/tabs.tsx`) pras sub-tabs internas, em vez de criar componente custom.
