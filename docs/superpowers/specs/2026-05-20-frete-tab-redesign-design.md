# Design — Refatoração da aba Frete (lista, filtros, drawer, foto chegada)

**Data:** 2026-05-20
**Autor:** Tiago Cameli (brainstorm com Claude)
**Escopo:** módulo `Frete`, aba `fretes` (não toca outras 5 abas: dashboard, pagamentos, conta_corrente, pedidos, lixeira)
**Relação com audit:** fecha parcialmente Bloco 3 itens 3.3 (Tabs custom), 3.4 (Drawer custom), 3.6 (Tabela `.map`)

## Problema

Hoje, pra subir a foto de chegada de um frete, o usuário precisa:
1. Abrir `/frete?tab=fretes`
2. Clicar no row → abre `FreteDetalhesDrawer`
3. Ver mensagem "Use 'Editar' para anexar a foto"
4. Clicar Editar → abre `FreteForm` (form gigante de 624 LOC)
5. Rolar até o bloco "Foto da Chegada"
6. Subir foto, salvar form inteiro

São 4 cliques + scroll + salvar form completo só pra anexar 1 foto. Operador no campo desiste e a foto fica pendente.

Adicionalmente, a UI atual está datada vs o resto do app que está migrando pra shadcn (Bloco 3 do audit):
- Tabs custom (6 abas) usam spans + URL params
- Tabela usa `.map` direto sem sort/filter/paginação nativos
- Drawer custom (`src/components/ui/Drawer.tsx`)
- FilterBar funciona mas o visual destoa

## Solução: 2 fases

### Fase A — Botão de foto chegada no drawer (deploy primeiro)

Adicionar upload inline no bloco `Foto da Chegada` que já existe em `FreteDetalhesDrawer`. Sem mais nenhuma mudança visual. Resolve a dor real em 1 dia.

### Fase B — Redesign visual completo (depois da A validada)

- 6 abas da página → `Tabs` shadcn (Bloco 3.3)
- `FreteList` → `data-table1` com `@tanstack/react-table` e expand-row (Bloco 3.6)
- `FilterBar` v2 com quick-presets + componentes shadcn
- `FreteDetalhesDrawer` → `Sheet` shadcn (Bloco 3.4) — preserva Fase A intacta

---

## Fase A — Arquitetura

### Local da mudança

`src/components/frete/FreteDetalhesDrawer.tsx` linhas 152–181 (bloco "Foto da Chegada da Carga").

### UX por estado

**Estado vazio** (`!frete.fotoChegadaUrl`):
- O placeholder "dashed border" com texto "Use 'Editar' para anexar" é substituído por um `AnexosUploader` configurado pra 1 foto
- Botão visível: `📦 Tirar foto da chegada`
- Aceita drag-and-drop também

**Estado com foto** (`frete.fotoChegadaUrl` setado):
- Thumbnail (igual ao atual: aspect-video, clickable pra abrir em full)
- Botão pequeno ao lado: `↻ Substituir`
- Clicar Substituir → reseta o array do uploader → volta pro estado vazio

### Componentes envolvidos (reuso, sem novos)

| Onde | O que faz |
|---|---|
| `FreteDetalhesDrawer.tsx` | Renderiza `AnexosUploader` quando `canEdit`. Conecta o callback `onChangeFotos` com `useAtualizarFrete` |
| `AnexosUploader` (em `src/components/combustivel/`) | Câmera + GPS overlay + timestamp + MIME/size validation (já configurado pelo Bloco 1.5). `hideArquivos` ativado |
| `useAtualizarFrete` (em `src/hooks/useFretes.ts`) | `mutate({ id, fotoChegadaUrl: novaUrl, dataChegada: novaData })`. Já existe |
| `useToast` | Sucesso: "Foto da chegada registrada"; erro: mensagem do PG via `reportError` |
| `temAcao('editar_frete')` | Gate: só renderiza upload UI se usuário tem permissão |

### Comportamentos automáticos (mantém paridade com `FreteForm`)

- Foto subiu **AND** `dataChegada` estava vazio → seta `dataChegada` = `YYYY-MM-DD` de hoje
- Foto removida não auto-reseta `dataChegada` (usuário decide)
- Drawer fica aberto após upload — React Query invalida e o bloco re-renderiza

### Storage

- Bucket `abastecimento-fotos` (10MB cap + MIME allowlist via Bloco 1.5)
- Path `frete-chegada/<freteId>/<timestamp>-<filename>.jpg`
- Signed URL TTL: 1h (já reduzido no Bloco 1.5)

### Edge cases

- **Sem GPS** (permissão negada): upload prossegue sem stamp de coords, só horário
- **Offline**: `AnexosUploader` não tem fila offline; mostra erro. Operador retenta online
- **Upload falha** mid-flight: toast vermelho, foto não fica órfã (upload falha antes do `update`)
- **Sem permissão `editar_frete`**: bloco fica visível mas sem botão (texto "Sem foto registrada" sem CTA)

### Escopo de código

~120 LOC novas em `FreteDetalhesDrawer.tsx`. Sem novo arquivo.

---

## Fase B — Arquitetura

### A. Tabs da página → `Tabs` shadcn (Bloco 3.3)

Reescreve linhas 122–150 de `Frete.tsx`:

```tsx
<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
  <TabsList>
    {allowedTabs.includes('dashboard') && <TabsTrigger value="dashboard"><BarChart3/>Dashboard</TabsTrigger>}
    {/* ...etc... */}
  </TabsList>
  <TabsContent value="dashboard">{/* ... */}</TabsContent>
  {/* ...etc... */}
</Tabs>
```

Preserva:
- URL sync via `setSearchParams({ tab })`
- Filtro por permissão (`allowedTabs`)
- Ícones lucide-react atuais

Novo componente: `src/components/shadcn/tabs.tsx` via `npx shadcn add tabs`.

### B. `FilterBar` v2 com presets

Reescreve `src/components/frete/FilterBar.tsx` (177 LOC → ~280 LOC).

**Layout:**

```
┌─ Quick filters (chips clicáveis) ───────────────────┐
│ [Sem chegada] [Esta semana] [Mês passado]            │
│ [Top transportadora ▾]                                │
└─────────────────────────────────────────────────────┘
┌─ Search + filtros + popover avançados ──────────────┐
│ 🔍 [buscar...]  [Obra ▾] [Transp. ▾] [⚙ Mais ▾]    │
│                                                       │
│ Ativos: [Obra: Lote 9 ×] [Transp: Translog ×]       │
└─────────────────────────────────────────────────────┘
```

**Presets implementados** (4 total):

| Preset | Lógica |
|---|---|
| Sem chegada | `dataChegada IS NULL` |
| Esta semana | `data >= segunda-feira da semana atual` |
| Mês passado | `data` no intervalo `[mês-1 dia 1, mês atual dia 0]` |
| Top transportadora ▾ | Dropdown dinâmico com as 5 transportadoras com mais fretes nos últimos 90 dias |

> **Não incluso:** "Pendente pagamento" — removido a pedido do user.

Clicar num preset preenche os filtros base. **Conflito de presets de data** (ex.: clicar "Esta semana" com "Mês passado" já ativo): o novo preset **sobrescreve** o range de data anterior, sem confirmação. Filtros não-data (Obra, Transportadora, etc.) continuam ativos. Visual de "ativo" quando o estado bate.

**Novos shadcn em `src/components/shadcn/`:** `popover.tsx`, `command.tsx` (pra combobox). `button.tsx` se ainda não existir.

### C. `FreteList` v2 com `data-table1` + expand-row

Reescreve `src/components/frete/FreteList.tsx` (375 LOC → ~500 LOC) usando `@tanstack/react-table` (nova dep).

**Colunas visíveis (7):**

| Coluna | Sort | Renderização |
|---|---|---|
| Data | ✓ | stack: `15/05` em cima, `10:30` muted embaixo |
| Origem → Destino | ✓ | stack: origem bold, destino muted |
| Transportadora | ✓ | nome + motorista muted |
| Material | ✓ | nome do insumo |
| Peso | ✓ | `28 t` |
| Valor | ✓ | `R$ 4.250` |
| ▶/▼ | — | toggle expand |

**Linha expandida** (renderizada via `renderSubComponent` do react-table):

```
┌───────────────┬────────────────┬─────────────────┐
│ [Foto chegada │ Motorista: ... │ R$ / TKM: ...   │
│  thumb 100x70 │ Placa: ...     │ Data chegada... │
│  OU placeholder│ NF: ...        │ Pagamento ▾    │
│  com botão     │                │                 │
│  📷 tirar]    │                │                 │
└───────────────┴────────────────┴─────────────────┘
```

Quando vazio, o slot da foto chegada mostra o mesmo botão da Fase A (componente compartilhado `FreteFotoChegadaButton` extraído pra evitar duplicação).

**Sort:** client-side via `getSortedRowModel`. Estado persistido em URL (`?sort=data,desc`).
**Paginação:** client-side via `getPaginationRowModel`. 25/página default. Tamanho persiste em localStorage (`frete-list-page-size`).
**Densidade:** compact (8px padding) — preservar densidade visual do atual.

Edit/delete: dropdown menu `⋮` (shadcn `DropdownMenu`) na coluna mais à direita, em vez de botões inline.

### D. Drawer → `Sheet` shadcn (Bloco 3.4)

Reescreve `src/components/frete/FreteDetalhesDrawer.tsx` substituindo `<Drawer>` por `<Sheet>` + `<SheetContent>` + `<SheetHeader>` shadcn. Conteúdo interno fica idêntico:
- 2 sub-tabs (Detalhes, Histórico) — agora também usam `Tabs` shadcn
- KPI grid (4 cells)
- Foto chegada hero (com upload da Fase A preservado)
- Field grid
- Anexos (fotos extras + arquivos)

Width: `Sheet` shadcn não tem prop `size` — controlar via `className="w-full sm:max-w-[700px]"` no `SheetContent`. Largura final ~700px, igual ao `Drawer` atual.

Novo shadcn: `src/components/shadcn/sheet.tsx`.

### Componentes refatorados pra reuso

- **`FreteFotoChegadaButton`** (novo, em `src/components/frete/`): encapsula o upload inline. Usado em 2 lugares: drawer (Fase A) e expand-row da tabela (Fase B). Props: `frete`, `canEdit`, `onUploaded`.

### Deps novas

- `npx shadcn add tabs sheet popover command dropdown-menu` → 5 componentes em `src/components/shadcn/`
- `npm install @tanstack/react-table` (peerDep `react ^19` ok)

### Escopo de código

~700 LOC modificadas + 5 arquivos novos em `src/components/shadcn/` + 1 novo (`FreteFotoChegadaButton`).

---

## Data flow + estado

Sem mudanças no modelo de dados ou no banco:
- `fotoChegadaUrl?: string | null` continua singular
- Outras fotos extras continuam em `fotoUrls?: string[]`
- `dataChegada?: string` formato `YYYY-MM-DD` mantido

React Query keys preservados:
- `['fretes']` invalidado por `useAtualizarFrete`
- Drawer re-renderiza automaticamente após upload

---

## Testes

### Playwright E2E (novos)

Cada spec segue o padrão dos 3 existentes (`tests/_fixtures.ts` + `test.skip(!hasCredentials())`):

| Spec | Fase | Asserções |
|---|---|---|
| `tests/frete-foto-chegada.spec.ts` | A | login → `/frete?tab=fretes` → clica row → drawer abre → estado vazio mostra botão → upload mock → drawer atualiza com thumbnail + `dataChegada` preenchida |
| `tests/frete-list.spec.ts` | B | tabela renderiza, sort por coluna, paginação muda, expand-row mostra foto + detalhes |
| `tests/frete-filtros.spec.ts` | B | search filtra, combobox filtra, presets aplicam (sem chegada, esta semana, mês passado, top transp.), chips removem |
| `tests/frete-drawer.spec.ts` | B | Sheet abre/fecha, sub-tabs Detalhes/Histórico alternam, edit/delete funcionam |

### Unit tests (vitest)

- `FilterBar` lógica de preset: dado estado X de filtros, retorna se preset Y está "ativo"
- Helpers de data: "esta semana", "mês passado" (bounds corretos em borda de semana/mês/ano)

---

## Security review

`/security-review` antes de cada commit das 2 fases. Pontos a auditar:

**Fase A:**
- Upload usa `AnexosUploader` existente (MIME/size validation já garantido pelo Bloco 1.5)
- Sem nova superfície de ataque
- Esperado: `NO_FINDINGS`

**Fase B:**
- Migração puramente visual + paginação client-side
- Sem mudança em RLS, RPC, storage policies
- Esperado: `NO_FINDINGS`

---

## Rollout

**Fase A** (deploy primeiro, ~1 dia):
1. Branch `feat/frete-foto-chegada-drawer`
2. Edit `FreteDetalhesDrawer.tsx`
3. Test E2E `frete-foto-chegada.spec.ts`
4. `npm run build && npm test`
5. `/security-review`
6. Commit → preview deploy → validar no preview → promover prod → push

**Fase B** (depois da Fase A validada em prod por alguns dias, ~1 semana):
1. Branch `feat/frete-redesign-bloco3`
2. `npx shadcn add tabs sheet popover command dropdown-menu`
3. `npm install @tanstack/react-table`
4. Migrar tabs (A) — testar todas as 6 abas
5. Reescrever `FilterBar` v2 (B)
6. Reescrever `FreteList` com data-table1 (C) — extrair `FreteFotoChegadaButton`
7. Migrar drawer pra Sheet (D) — preservar Fase A intacta
8. 3 specs Playwright novos
9. `npm run build && npm test`
10. `/security-review`
11. Commit → preview → validar visualmente → promover → push

---

## Riscos

| Risco | Mitigação |
|---|---|
| Fase B quebra Fase A (Sheet "perde" o botão de foto) | Spec exige que Sheet preserve o bloco "Foto da Chegada" intacto. Test E2E Fase A roda como regressão no PR da Fase B |
| `Sheet` shadcn anima diferente, UX percebida muda | Usuário aprova preview antes de promover |
| URL sync `?tab=` quebra na migração de tabs | Test E2E cobrindo persistência em cada aba |
| 380 fretes na tabela com expand-row degrada perf no sort client-side | Vitest pra ordenação; benchmark manual. Se >1s, migrar pra `manualSorting` (fora de escopo) |
| Botão "tirar foto" na linha expandida duplica lógica do drawer | Extrair `FreteFotoChegadaButton` reutilizável |

---

## Out of scope (não vou fazer)

- ❌ `FreteForm.tsx` (form de edição continua exatamente igual)
- ❌ Outras 5 abas de Frete (dashboard, pagamentos, conta_corrente, pedidos, lixeira)
- ❌ `HistoricoTimeline` (componente compartilhado, fora de escopo)
- ❌ Refator de `useFretes` ou outros hooks de dados
- ❌ Mudança de schema no banco
- ❌ Preset "Pendente pagamento" (excluído a pedido)
- ❌ Migração de outros módulos pra shadcn (Bloco 3 itens 3.1, 3.2, 3.5 continuam abertos)
