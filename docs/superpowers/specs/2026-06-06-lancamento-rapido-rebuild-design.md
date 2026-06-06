# Lançamento Rápido — Rebuild no padrão nativo do app

**Data:** 2026-06-06
**Módulo:** rodotracker / Medição
**Tipo:** Rebuild de UI (mantém lógica de cálculo testada)

## Problema

O "Lançamento rápido" da Medição (`QuickEntrySheet`) foi construído sobre um stack
estranho ao resto do app: shadcn `Dialog`/`Tabs`/`Select` + classes Tailwind com tokens
(`bg-popover`, `bg-muted`, `text-foreground`) que o projeto não define no padrão certo.
Resultado: o modal renderiza quebrado — linhas pretas, cabeçalho sem texto, grid ilegível.

O resto do app (frete, compras) usa o stack nativo: componentes `components/ui/*`
(`Modal`, `Input`, `Select`, `Button`, `SubmitButton`) + tokens `var(--color-*)` /
`var(--text-*)`, com react-hook-form + Zod. Por isso esses forms ficam limpos e consistentes.

Além disso, o paradigma atual (planilha de várias linhas, agrupada por chave em N Activities)
é confuso. Decisão do dono: **apagar a feature e refazer do zero** num form híbrido,
1 Activity por vez, no visual do app.

## Decisões (já validadas com o usuário)

1. **Refazer do zero**, jogando fora a camada de UI quebrada.
2. **Aproveitar a matemática testada** (cálculos e parsers), não reescrever.
3. **Paradigma híbrido:** cabeçalho de form (campos rotulados) + bloco repetível embaixo
   (cargas no CBUQ, drenos no TS). 1 "salvar" = 1 Activity.
4. **Fluxo "Salvar e novo":** ao salvar, limpa o cabeçalho, mantém a aba, mostra contador
   "N lançadas nesta sessão". Também tem "Salvar e fechar".
5. **Visual:** padrão nativo (igual frete), reusando os sub-forms `CbuqForm`/`TrocaSoloForm`
   que já existem e já são on-brand.

## A sacada do reuso

Já existem, em `src/modules/rodotracker/components/Form/`:

- **`CbuqForm.tsx`** — sub-form controlado (`data: CbuqData`, `onChange`) que gerencia a lista
  de cargas (add/remover, importar Excel via `CbuqImportModal`), mostra totais (cargas, peso,
  volume) e o preview dos quantitativos. Já estilizado com tokens nativos (`var(--text-muted)`,
  `.input`, `.btn`, `var(--bg-sunken)`), **sem shadcn**.
- **`TrocaSoloForm.tsx`** — sub-form controlado (`data: TrocaSoloData`, `onChange`) com categoria
  (rotineira/passivo), medidas da TS (comprimento/largura/espessura), drenos (add/remover) e
  preview de quantitativos. Mesmo padrão nativo.

O `ActivityFormModal` (form completo, com mapa e fotos) já consome os dois. O "Lançamento rápido"
passa a ser um **ActivityFormModal enxuto**: sem mapa (KM digitado → lat/lng derivado),
sem fotos/PDF, com "salvar e novo". Reusa os sub-forms; não recria grid nenhum.

## Arquitetura

### Apagar (UI shadcn / paradigma de grid)
- `src/modules/rodotracker/components/Measurement/QuickEntrySheet.tsx`
- `src/modules/rodotracker/components/Measurement/QuickEntryGridCbuq.tsx`
- `src/modules/rodotracker/components/Measurement/QuickEntryGridTs.tsx`
- `src/modules/rodotracker/components/Measurement/quickEntryCells.tsx`
- `src/modules/rodotracker/utils/quickEntryValidators.ts` (+ `.test.ts`)
- `src/modules/rodotracker/utils/quickEntryGrouping.ts` (+ `.test.ts`) — substituído pelos builders
- `tests/quick-entry.spec.ts` (E2E do grid antigo)

Verificado: nenhum arquivo fora da feature antiga importa `quickEntryGrouping`,
`quickEntryValidators` ou `quickEntryParsers`. Remoção é segura.

### Manter (lógica pura testada + sub-forms)
- `src/modules/rodotracker/utils/cbuqCalc.ts` — `calcCbuq(cargas)` → totais + `quantidades` (código→qtd)
- `src/modules/rodotracker/utils/trocaSoloCalc.ts` — `calcTrocaSolo(categoria, ts, drenos)` → área, tipo, `quantidades`
- `src/modules/rodotracker/utils/latLngFromKm.ts` — `latLngFromKm(km, obra)` → `{lat,lng} | null`
- `src/modules/rodotracker/utils/quickEntryParsers.ts` (+ `.test.ts`) — `parseData`, `parseTrecho`, `parseKm`
- `src/modules/rodotracker/components/Form/CbuqForm.tsx` — reuso direto
- `src/modules/rodotracker/components/Form/TrocaSoloForm.tsx` — reuso direto

### Criar
- **`src/modules/rodotracker/components/Measurement/QuickEntryModal.tsx`**
  Shell no `Modal` nativo (size `xl`). Duas abas: CBUQ e Troca de Solo (segmented control
  nativo, não shadcn Tabs). Cabeçalho de cada aba com `Input`/`Select`. Embute o sub-form
  correspondente. Rodapé com `Button` (Cancelar / Salvar e novo) + `SubmitButton`.
  Estado de sessão com contador de lançadas. Props: `open`, `onClose`, `obra`, `medicao`.

- **`src/modules/rodotracker/utils/activityBuilders.ts`** (+ `.test.ts`)
  Funções puras que montam UMA Activity a partir do cabeçalho + dados do sub-form:
  - `buildCbuqActivity(input, obra, medicao): Activity`
  - `buildTsActivity(input, obra, medicao): Activity`
  Derivam lat/lng do KM via `latLngFromKm`, chamam `calcCbuq`/`calcTrocaSolo` pra preencher
  `contributions`, e montam o objeto no mesmo shape que o `ActivityFormModal` produz
  (linhas 926-958 daquele arquivo são a referência). Portar as asserções relevantes do
  `quickEntryGrouping.test.ts` pra cá.

### Religar
- `src/modules/rodotracker/components/Measurement/MeasurementView.tsx`:
  trocar import `QuickEntrySheet` → `QuickEntryModal` (linha 24), manter `showQuickEntry`
  (linha 57), botão (linhas ~350-358) e renderização (linhas ~657-664).

## Detalhe dos campos por aba

### Aba CBUQ → Activity de "Correção de Defeito (CBUQ)"
Cabeçalho (form):
- **Data** (date) — obrigatório. Vira `Activity.date` e default da `data` de cada carga.
- **Trecho do dia** — KM inicial e KM final (dois inputs, parse via `parseTrecho`/`parseKm`).
  Viram `Activity.km` / `Activity.kmEnd`. lat/lng/latEnd/lngEnd via `latLngFromKm`.
- **Lado** (select: Direito / Esquerdo / Pista Toda).

Corpo: `<CbuqForm data={cbuqData} onChange={...} contractItems={...} />`
- Cada carga: placa, hora, peso (já no sub-form). A `data` da carga pré-preenche com a Data do cabeçalho.

Salvar: `buildCbuqActivity` agrega em 1 Activity com `cbuq: { cargas, contributions }`.

### Aba Troca de Solo → Activity de "Troca de Solo"
Cabeçalho (form):
- **Data** (date) — obrigatório.
- **KM** (input, `parseKm`) — ponto da TS. lat/lng via `latLngFromKm`.
- **Estaca**, **Fração** (texto, opcionais) → `Activity.estaca` / `Activity.fracao`.
- **Lado** (select).
- **Nomenclatura** (texto, obrigatório) → `Activity.nomenclatura`. Aviso (não bloqueio) se já
  existir uma Activity com a mesma nomenclatura nesta medição.

Corpo: `<TrocaSoloForm data={tsData} onChange={...} contractItems={...} />`
- Categoria (rotineira/passivo), medidas da TS, drenos — tudo já no sub-form.

Salvar: `buildTsActivity` monta 1 Activity com `trocaSolo: { categoria, medidas, drenos, contributions }`.

## Validação

Checagem leve no submit (estilo frete, erro inline vermelho + mensagem), sem schema pesado:
- CBUQ: Data válida; Trecho com KM inicial/final válidos e final > inicial; pelo menos 1 carga
  com placa preenchida e peso > 0.
- TS: Data válida; KM válido; Nomenclatura preenchida; medidas da TS > 0.
Os sub-forms já marcam campos inválidos internamente (placa vazia, peso ≤ 0); o modal só
bloqueia o submit e mostra um resumo de erro no topo.

## Fluxo de save

1. Validar. Se erro, mostrar resumo e abortar.
2. `buildXxxActivity(...)` → 1 Activity.
3. `await addActivity(activity)` (hook `useActivities`).
4. Sucesso: incrementar contador da sessão, limpar cabeçalho + sub-form da aba atual,
   manter aba e foco no primeiro campo.
   - "Salvar e novo": fica no modal pronto pro próximo.
   - "Salvar e fechar": fecha o modal.
5. Erro de persistência: mostrar mensagem, não limpar, permitir tentar de novo.

## Componentes e fronteiras

- `QuickEntryModal` — orquestra: abas, cabeçalho, embute sub-form, dispara save. Não sabe de cálculo.
- `CbuqForm` / `TrocaSoloForm` — donos do bloco repetível e do preview. Já existem, não mudam.
- `activityBuilders` — função pura: (cabeçalho + dados do sub-form + obra + medicao) → Activity. Testável isolado.
- `useActivities.addActivity` — persistência. Inalterado.

## Testes

- `activityBuilders.test.ts`: monta CBUQ e TS, confere `date/km/kmEnd/lado/estaca/fracao/nomenclatura`,
  lat/lng derivados, `cbuq.contributions` / `trocaSolo.contributions` batendo com `calcCbuq`/`calcTrocaSolo`,
  e fallback de KM fora da rota (centro da obra).
- `quickEntryParsers.test.ts`: mantido como está.
- E2E novo (opcional, fora do escopo mínimo): abrir modal, lançar 1 CBUQ, ver contador.

## Fora de escopo

- Mexer no `ActivityFormModal` (form completo com mapa) — fica como está.
- Migrar outros pontos do rodotracker que usam shadcn — não é desta tarefa.
- Importação em massa de planilha cobrindo vários dias — abandonada por decisão do dono
  (o `CbuqForm` ainda importa cargas de UMA atividade via `CbuqImportModal`).
