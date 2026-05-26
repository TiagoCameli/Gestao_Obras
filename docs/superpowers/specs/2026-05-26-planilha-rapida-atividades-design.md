# Planilha rápida de lançamento de atividades — RodoTracker

**Data:** 2026-05-26
**Módulo:** `src/modules/rodotracker/`
**Contexto da obra-piloto:** Manutenção BR-364 Lote 09

## Problema

O fluxo atual de criar uma `Activity` em `ActivityFormModal.tsx` (1732 linhas) é rico
demais para lançamento em massa: mapa Leaflet, fotos, PDFs, formas específicas por
serviço. Para preencher uma medição inteira de Correção de Defeito (CBUQ) ou Troca
de Solo a partir das planilhas físicas do operacional, esse fluxo é lento — cada
linha vira 6–10 cliques.

Falta um caminho que reproduza a UX de planilha (uma linha = uma entrada, paste do
Excel, navegação por Tab/Enter) e que respeite a estrutura de agregação em medições
já existente.

## Solução

Novo componente `QuickEntrySheet.tsx` em
`src/modules/rodotracker/components/Measurement/`, aberto por botão
**"Lançamento rápido"** na `MeasurementView`. Modal (Dialog shadcn) com **Tabs**:

- **CBUQ** — uma linha por carga de caminhão.
- **Troca de Solo / Drenos** — uma linha por trecho (TS principal ou dreno
  associado).

A medição-alvo é a `currentMedicao` da `MeasurementView`, passada como prop e
exibida no header do modal ("Lançando na 6ª Medição").

## Modelo de agregação (linhas → Activities)

A planilha é "flat" mas o salvar agrupa linhas em `Activity`s conforme regras
abaixo. Activities criadas têm `medicao = currentMedicao`.

### CBUQ
Chave de agrupamento: **`(data, trechoNormalizado)`**.

- Cada linha vira um item em `cbuq.cargas[]` da Activity correspondente.
- 1 Activity por par `(data, trecho)` — várias placas no mesmo dia/trecho
  acumulam cargas na mesma Activity.
- `service: "Correção de Defeito (CBUQ)"`
- `km` / `kmEnd` parseados do trecho (`"620-635"` → `"620"` / `"635"`)
- `lat`/`lng` e `latEnd`/`lngEnd` derivados via `calcKmAlongRoute(obra.routeGeoJson, km)`
- `lado: "Pista Toda"` (fixo)
- `description` da Activity = concat das descrições únicas das cargas do dia
  (`\n` como separador, dedup); cada `cargas[i].descricao` mantém seu texto
  original.
- `cbuq.contributions = calcCbuq(cargas)` (função existente)

### Troca de Solo / Drenos
Chave de agrupamento: **`nomenclatura`** (ex: `"TS15/07"`).

- 1 Activity por nomenclatura.
- Exatamente **1 linha** com mesma nomenclatura tem `Tipo = TS` — é o trecho
  principal. Suas medidas vão pra `trocaSolo.{comprimento, largura, espessura}`.
- Linhas com `Tipo = Dreno` e mesma nomenclatura entram em
  `trocaSolo.drenos: []` na ordem em que aparecem na planilha.
- `service: "Troca de Solo"`
- `date`, `km`, `lado`, `estaca`, `fracao`, `nomenclatura` vêm da linha TS.
- `lat`/`lng` via `calcKmAlongRoute(obra.routeGeoJson, km)`.
- `trocaSolo.categoria` vem de seletor no header da aba (default `"rotineira"`).
- `trocaSolo.contributions = calcTrocaSolo(...)` (função existente).

**Defaults seguros** para campos não preenchidos pela planilha (todas as
Activities criadas): `quantities: []`, `photoIds: []`, `photoFolders: []`,
`pdfs: undefined`, `areaRect: null`, `extraPoints: undefined`,
`createdAt/updatedAt: Date.now()`.

## Schema (Supabase)

Migração em par fix+rollback no workflow padrão (`supabase/migrations/`):

```sql
-- fix
ALTER TABLE activities
  ADD COLUMN estaca text NULL,
  ADD COLUMN fracao text NULL,
  ADD COLUMN nomenclatura text NULL;

CREATE INDEX idx_activities_nomenclatura
  ON activities (obra_id, medicao, nomenclatura)
  WHERE nomenclatura IS NOT NULL;
```

```sql
-- rollback
DROP INDEX IF EXISTS idx_activities_nomenclatura;
ALTER TABLE activities
  DROP COLUMN IF EXISTS nomenclatura,
  DROP COLUMN IF EXISTS fracao,
  DROP COLUMN IF EXISTS estaca;
```

Sem migração no JSONB. O tipo `CbuqCarga` em
`src/modules/rodotracker/types/activity.ts` ganha:
```ts
export interface CbuqCarga {
  id: string;
  data?: string;
  placa: string;
  hora?: string;
  pesoT: number;
  descricao?: string;  // NOVO
}
```

E `Activity` ganha `estaca?: string`, `fracao?: string`, `nomenclatura?: string`.
Mappers `rowToActivity` / `activityToRow` em
`src/modules/rodotracker/utils/rodotrackerApi.ts` ganham as 3 linhas
correspondentes.

**Backfill:** nenhum. Colunas nullable, registros antigos ficam com NULL.

## UI

### Geral
- `Dialog` shadcn em tela cheia em mobile, modal centralizado em desktop.
- `Tabs` shadcn (CBUQ / TS-Drenos). Estado das duas planilhas vive no
  `QuickEntrySheet`; trocar de aba preserva linhas não salvas.
- Header mostra: nome da obra, medição-alvo, contadores por aba ("X linhas
  pendentes • Y Activities serão criadas").
- Footer: botão **"Salvar tudo"** (primary) à direita, "Cancelar" à esquerda.
  Botão "Salvar tudo" mostra spinner durante save.

### Aba CBUQ

Header da aba: texto explicativo "Cada linha = 1 carga. Linhas com mesma
**Data** + mesmo **Trecho do dia** viram 1 Activity de CBUQ."

| # | Coluna | Tipo input | Largura | Obrigatório |
|---|---|---|---|---|
| 1 | Data | máscara dd/mm/aaaa | 110px | ✅ |
| 2 | Trecho do dia (KM ini–fim) | text, parseia `"620-635"` / `"620,1–635,5"` | 140px | ✅ |
| 3 | Placa | text uppercase, autocomplete de placas já vistas na obra | 100px | ✅ |
| 4 | Hora | HH:mm | 80px | — |
| 5 | Peso (t) | numérico (aceita vírgula) | 90px | ✅, >0 |
| 6 | Descrição | text (textarea expandido ao focar) | flex | — |
| 7 | — | botão lixeira | 32px | — |

- **Linha always-empty** no fim: digitar nela cria nova linha vazia (padrão de
  planilha).
- **Auto-preenchimento de "Trecho do dia"**: ao digitar/colar várias linhas com
  a mesma data, da 2ª em diante mostra placeholder cinza com o valor da 1ª
  (herda mas pode sobrescrever digitando).
- Footer da aba: peso total das cargas pendentes (`Σ peso = 312,4 t`).

### Aba TS / Drenos

Header da aba:
- Texto explicativo "Cada linha = 1 trecho (TS ou Dreno). Linhas com mesma
  **Nomenclatura** viram 1 Activity (TS principal + drenos associados)."
- Seletor **Categoria** (`rotineira` / `passivo`) — aplica a todas as TS
  criadas neste save.

| # | Coluna | Tipo input | Largura | Obrigatório |
|---|---|---|---|---|
| 1 | Data | dd/mm/aaaa | 110px | ✅ |
| 2 | Tipo | select: TS / Dreno | 80px | ✅ |
| 3 | Nomenclatura | text (ex: `TS15/07`) | 110px | ✅ |
| 4 | Estaca | text | 70px | — |
| 5 | Fração | text | 70px | — |
| 6 | KM | numérico | 90px | ✅ |
| 7 | Lado | select: D (Direito) / E (Esquerdo) / PT (Pista Toda) | 70px | ✅ |
| 8 | Comprimento (m) | numérico | 100px | ✅, >0 |
| 9 | Largura (m) | numérico | 90px | ✅, >0 |
| 10 | Espessura (m) | numérico | 95px | ✅, >0 |
| 11 | Área (m²) | calculado (compr × larg), readonly cinza | 80px | — |
| 12 | — | botão lixeira | 32px | — |

- **Auto-preenchimento ao mudar Tipo=Dreno**: Data, Nomenclatura, KM, Lado
  herdam (placeholder cinza) da última linha TS digitada com a mesma
  nomenclatura.
- Footer: `Σ área TS = 1.247 m²` • `Σ comprimento drenos = 312 m`.

### Atalhos de teclado (ambas as abas)

- `Tab` → próxima célula da mesma linha; última célula → 1ª célula da próxima
  linha (cria se não existir).
- `Shift+Tab` → célula anterior.
- `Enter` → célula abaixo (mesma coluna).
- `↑↓←→` → navegam células.
- `Ctrl/Cmd+V` em qualquer célula cola TSV do clipboard, distribui pelas
  colunas a partir da célula focada. Cria linhas adicionais se necessário.
- `Ctrl/Cmd+D` → copia valor da célula de cima (Excel-like).
- `Delete` / `Backspace` numa célula focada limpa o valor.

### Estados de célula

- normal (branco)
- foco (borda azul shadcn `primary`)
- warning amarelo (valor não parseado pelo paste — não bloqueia, user pode
  editar manualmente)
- erro vermelho (validação bloqueante, tooltip mostra a mensagem)
- readonly cinza (Área calculada)

## Validações

### Locais (por linha) — bloqueiam salvar
- Data obrigatória em todas as linhas com qualquer outro campo preenchido.
- KM no formato válido (`parseKm` aceita `"620"`, `"620.5"`, `"620,5"`,
  `"620+500"`).
- Placa CBUQ obrigatória (não-vazia, mín. 6 chars).
- Comprimento / Largura / Espessura / Peso > 0.

### Cross-row — bloqueiam salvar
- TS: exatamente 1 linha com `Tipo=TS` por nomenclatura. Zero TS = erro
  ("nomenclatura X não tem trecho TS principal"). Duas ou mais TS com mesma
  nomenclatura = erro.
- TS: nomenclatura não pode conflitar com Activity já existente na mesma
  medição (`erro: "nomenclatura X já existe — use o formulário rico pra
  editar"`). Lookup feito antes de salvar via query no Supabase.

### Visual
- Marca célula em vermelho, mostra tooltip com mensagem.
- Scrolla pra primeira linha com erro.
- Bloqueia chamada à API.

## Parsers

Implementados em `src/modules/rodotracker/utils/quickEntryParsers.ts`:

- `parseKm(s: string): number | null` — aceita `"620"`, `"620.5"`, `"620,5"`,
  `"620+500"` (`620+500 = 620.5`).
- `parseTrecho(s: string): {kmInicial: number, kmFinal: number} | null` —
  aceita `"620-635"`, `"620–635"` (en-dash), `"620,1-635,5"`, `"KM 620 a 635"`.
  Erro se `kmFinal <= kmInicial`.
- `parseData(s: string): string | null` — aceita `dd/mm/aaaa`, `dd-mm-aaaa`,
  `aaaa-mm-dd`. Normaliza pra ISO `yyyy-mm-dd`. Wall-clock, sem TZ.
- `parsePeso(s: string): number | null` — reusa `parseNumber` extraído de
  `ImportExcelModal.tsx` pra `utils/parseNumber.ts` compartilhado.

## Paste (TSV do clipboard)

Handler `onPaste` no container da grade:

1. Lê `clipboardData.getData("text/plain")`.
2. Split por `\n` → linhas; cada linha split por `\t` → células.
3. Distribui a partir da célula focada: célula(r, c) recebe paste[0][0],
   célula(r, c+1) recebe paste[0][1], etc.
4. Cria linhas adicionais se o paste for maior que as linhas em branco
   disponíveis.
5. Conversão por tipo de coluna (data → `parseData`, KM → `parseKm`, peso →
   `parsePeso`). Se conversão falhar, mantém o texto cru e marca a célula em
   amarelo (warning, não bloqueia).

## Save (pipeline em 4 fases)

**Fase 1 — Validação local** (antes de qualquer chamada à API): roda
validadores por linha e cross-row. Erro → marca células, scrolla, não chama
API.

**Fase 2 — Agrupamento em Activities**: ver seção "Modelo de agregação" acima.

**Fase 3 — Batch upsert**: chama `addActivity(activity)` do hook `useActivities`
em sequência (não paralelo — evita race em contadores de medição). Mostra
progress bar no rodapé ("salvando 3 / 12..."). Se uma falhar, para a fila,
mantém o que salvou, marca a linha que falhou em vermelho com erro do servidor.

**Fase 4 — Pós-save**: toast (`"12 Activities criadas (4 CBUQ, 8 TS) — 47
cargas, 18 drenos."`). Limpa todas as linhas. Fecha o modal (ou mantém aberto
se houver opt-in "continuar lançando"). MeasurementView recarrega agregados via
`reconcileCurrentQty` (hook existente).

**Reversão de falha parcial**: sem rollback automático. Activities salvas
ficam; user vê quais entraram e quais não, e re-tenta as que falharam.

## Confirmação ao fechar

Se há ≥1 linha com qualquer campo preenchido, `AlertDialog` shadcn pede
confirmação: "Você tem lançamentos não salvos. Descartar?". Cancelar fecha
o alerta sem fechar o modal; Confirmar fecha tudo e descarta.

## Performance

Grade até ~200 linhas em memória sem virtualização (suficiente para uma
medição típica). Acima disso, adiciona `@tanstack/react-virtual` (já no
projeto, em uso em outras tabelas).

## Testes

### Vitest (unitários)
- `parseKm`, `parseTrecho`, `parseData`, `parsePeso` — casos válidos e
  inválidos.
- Agrupamento CBUQ por `(data, trecho)`: 5 linhas em 2 dias = 2 Activities.
- Agrupamento TS por nomenclatura: TS + 3 drenos = 1 Activity com
  `drenos.length === 3`.
- Validador cross-row: 2 TS com mesma nomenclatura → erro.
- Validador cross-row: 0 TS, só drenos com mesma nomenclatura → erro.

### Playwright (E2E)
Em `tests/`:
- Abrir Lançamento rápido na MeasurementView, paste de 10 linhas CBUQ, salvar,
  verificar que 2 Activities foram criadas (assumindo 2 dias) e que
  contribuições aparecem no contrato.
- Mesmo cenário pra TS com 1 trecho + 2 drenos.

### Smoke manual
Lançar 1 dia CBUQ + 1 TS na obra BR-364 Lote 09, conferir que aparecem no mapa
(lat/lng derivados do KM) e no agregado da medição.

## Dependências do projeto reutilizadas

- `@tanstack/react-table` (já no projeto)
- shadcn: `Dialog`, `Tabs`, `Button`, `Input`, `Select`, `ScrollArea`,
  `AlertDialog`
- `calcKmAlongRoute` (`src/modules/rodotracker/utils/route.ts`)
- `useActivities` (`src/modules/rodotracker/hooks/useActivities.ts`)
- `calcCbuq` (`src/modules/rodotracker/utils/cbuqCalc.ts`)
- `calcTrocaSolo` (`src/modules/rodotracker/utils/trocaSoloCalc.ts`)
- `reconcileCurrentQty` (`src/modules/rodotracker/utils/reconcileMedicoes.ts`)
- `parseNumber` (extraído de `ImportExcelModal.tsx` pra utils compartilhado)

## Arquivos a criar/alterar

**Novos:**
- `src/modules/rodotracker/components/Measurement/QuickEntrySheet.tsx`
- `src/modules/rodotracker/components/Measurement/QuickEntryGridCbuq.tsx`
- `src/modules/rodotracker/components/Measurement/QuickEntryGridTs.tsx`
- `src/modules/rodotracker/utils/quickEntryParsers.ts`
- `src/modules/rodotracker/utils/quickEntryGrouping.ts` (lógica das fases 2 e 3
  do save)
- `src/modules/rodotracker/utils/parseNumber.ts` (extraído de
  `ImportExcelModal.tsx`)
- `supabase/migrations/<timestamp>_activities_estaca_fracao_nomenclatura.sql`
- `supabase/migrations/<timestamp>_activities_estaca_fracao_nomenclatura_rollback.sql`
- testes Vitest em `tests/` pra parsers e agrupamento
- teste Playwright em `tests/` pro fluxo E2E

**Alterados:**
- `src/modules/rodotracker/types/activity.ts` — `CbuqCarga.descricao?`,
  `Activity.estaca?`, `Activity.fracao?`, `Activity.nomenclatura?`
- `src/modules/rodotracker/utils/rodotrackerApi.ts` — mappers ganham as 3
  colunas novas
- `src/modules/rodotracker/components/Measurement/MeasurementView.tsx` — botão
  "Lançamento rápido" + estado de abertura do modal
- `src/modules/rodotracker/components/Home/HomePage.tsx` — bump da versão no
  logo (regra do projeto: sempre que tocar em `src/modules/rodotracker/`)

## Fora do escopo

- Edição de Activities existentes pela planilha (modo "add only" por
  definição — edição rica continua em `ActivityFormModal`).
- Upload de fotos/PDFs pelo fluxo da planilha.
- Outros serviços além de CBUQ e TS/Drenos (Sinalização, Conserva, Tapa-Buraco,
  etc.) — podem entrar em iterações futuras se necessário.
- Auto-save por linha ou debounced (decisão consciente: batch só no botão
  "Salvar tudo" pra UX previsível tipo Excel).
- Rollback automático em falha parcial do save.
