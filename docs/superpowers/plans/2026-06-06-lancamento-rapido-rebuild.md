# Lançamento Rápido — Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o "Lançamento rápido" da Medição (grid shadcn quebrado) por um modal nativo no padrão do app, 1 Activity por vez, reusando os sub-forms `CbuqForm`/`TrocaSoloForm` e a matemática testada.

**Architecture:** Builders puros (`activityBuilders.ts`) montam 1 `Activity` a partir de cabeçalho + dados do sub-form, derivando lat/lng do KM via `latLngFromKm` e os quantitativos via `calcCbuq`/`calcTrocaSolo`. Um `QuickEntryModal` (no `Modal` nativo) tem 2 abas (CBUQ / Troca de Solo), cabeçalho com `Input`/`Select` e embute o sub-form correspondente, salvando com "Salvar e novo" / "Salvar e fechar". O grid shadcn e os utils de grid são apagados.

**Tech Stack:** React + TypeScript, Vite, Vitest + @testing-library/react, componentes `components/ui/*` (Modal/Input/Select/Button/SubmitButton), tokens CSS `var(--color-*)`.

**Spec:** `docs/superpowers/specs/2026-06-06-lancamento-rapido-rebuild-design.md`

---

## File Structure

- **Create** `src/modules/rodotracker/utils/activityBuilders.ts` — `buildCbuqActivity` / `buildTsActivity` (puros).
- **Create** `src/modules/rodotracker/utils/activityBuilders.test.ts` — testes dos builders (portados do grouping).
- **Create** `src/modules/rodotracker/components/Measurement/QuickEntryModal.tsx` — o novo modal.
- **Create** `src/modules/rodotracker/components/Measurement/QuickEntryModal.test.tsx` — RTL do fluxo de save (sub-forms mockados).
- **Modify** `src/components/ui/Modal.tsx` — props opcionais `overlayClassName` / `contentClassName` (passthrough de z-index).
- **Modify** `src/modules/rodotracker/components/Measurement/MeasurementView.tsx` — trocar `QuickEntrySheet` por `QuickEntryModal`.
- **Delete** `QuickEntrySheet.tsx`, `QuickEntryGridCbuq.tsx`, `QuickEntryGridTs.tsx`, `quickEntryCells.tsx`, `quickEntryValidators.ts`(+test), `quickEntryGrouping.ts`(+test), `tests/quick-entry.spec.ts`.

**Referência de tipos (já existentes, não criar):**
```ts
// src/modules/rodotracker/types/activity.ts
type LadoPista = "Direito" | "Esquerdo" | "Pista Toda";
interface CbuqCarga { id: string; data?: string; placa: string; hora?: string; pesoT: number; descricao?: string; }
interface CbuqData { medicaoNumber: number; cargas: CbuqCarga[]; contributions: Record<string, number>; }
interface TrocaSoloData {
  categoria: "passivo" | "rotineira"; medicaoNumber: number;
  comprimento: number; largura: number; espessura: number;
  capaAsfaltica?: { comprimento: number; largura: number; espessura: number };
  drenos: { comprimento: number; largura: number; espessura: number }[];
  contributions: Record<string, number>;
}
// Activity tem: id, lat, lng, latEnd?, lngEnd?, service, date, medicao:number|null,
//   km:string, kmEnd?, lado, areaRect, description, quantities, photoIds, photoFolders,
//   cbuq?, trocaSolo?, estaca?, fracao?, nomenclatura?, createdAt, updatedAt.
```

**Assinaturas reusadas (não alterar):**
```ts
latLngFromKm(km: number, obra: Pick<Obra,"centerLat"|"centerLng"|"kmInicial"|"routeGeoJson">): {lat:number;lng:number} | null
calcCbuq(cargas: CbuqCarga[]): { totalPesoT:number; totalVolumeM3:number; quantidades: Record<string,number> }
calcTrocaSolo(categoria, ts:{comprimento,largura,espessura}, drenos): { area:number; tipo; volDreno:number; quantidades: Record<string,number> }
parseKm(input: string): number | null      // "620","620,5","620+500" → número ou null
// format.ts: generateId(): string ; todayISO(): string
```

---

## Task 1: Builders puros de Activity (`activityBuilders.ts`)

**Files:**
- Create: `src/modules/rodotracker/utils/activityBuilders.ts`
- Test: `src/modules/rodotracker/utils/activityBuilders.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/modules/rodotracker/utils/activityBuilders.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCbuqActivity, buildTsActivity } from "./activityBuilders";
import type { CbuqCarga, Obra } from "../types/activity";

const obra = {
  centerLat: -10, centerLng: -55, kmInicial: 600,
  routeGeoJson: [[-10, -55], [-10, -54.7]] as [number, number][],
} as Obra;

const carga = (over: Partial<CbuqCarga> = {}): CbuqCarga => ({
  id: "c" + Math.random(), data: "2026-05-21", placa: "ABC1234",
  hora: "10:00", pesoT: 23.5, descricao: "", ...over,
});

describe("buildCbuqActivity", () => {
  it("monta 1 Activity de CBUQ com as cargas e o trecho do cabeçalho", () => {
    const act = buildCbuqActivity(
      { data: "2026-05-21", kmInicial: 620, kmFinal: 635,
        cargas: [carga(), carga({ placa: "DEF5678" })] },
      obra, 7, 1000,
    );
    expect(act.service).toBe("Correção de Defeito (CBUQ)");
    expect(act.medicao).toBe(7);
    expect(act.lado).toBe("Pista Toda");
    expect(act.km).toBe("620");
    expect(act.kmEnd).toBe("635");
    expect(act.cbuq?.cargas).toHaveLength(2);
    expect(act.cbuq?.medicaoNumber).toBe(7);
    // contributions vem do calcCbuq (não vazio pra peso > 0)
    expect(Object.keys(act.cbuq!.contributions).length).toBeGreaterThan(0);
    expect(act.createdAt).toBe(1000);
    expect(act.areaRect).toBeNull();
  });

  it("concatena descrições únicas das cargas em Activity.description", () => {
    const act = buildCbuqActivity(
      { data: "2026-05-21", kmInicial: 620, kmFinal: 635,
        cargas: [carga({ descricao: "Faixa C 12.5" }),
                 carga({ descricao: "Faixa C 12.5" }),
                 carga({ descricao: "Faixa B 19.0" })] },
      obra, 1, 1000,
    );
    expect(act.description).toBe("Faixa C 12.5\nFaixa B 19.0");
  });
});

describe("buildTsActivity", () => {
  it("monta 1 Activity de Troca de Solo com medidas, drenos e cabeçalho", () => {
    const act = buildTsActivity(
      { data: "2026-05-21", km: 620.5, estaca: "380", fracao: "10",
        lado: "Direito", nomenclatura: "TS15/07",
        ts: { categoria: "rotineira", comprimento: 26, largura: 4.8, espessura: 0.4,
              drenos: [{ comprimento: 30, largura: 0.6, espessura: 0.5 }] } },
      obra, 7, 1000,
    );
    expect(act.service).toBe("Troca de Solo");
    expect(act.medicao).toBe(7);
    expect(act.km).toBe("620.5");
    expect(act.lado).toBe("Direito");
    expect(act.estaca).toBe("380");
    expect(act.fracao).toBe("10");
    expect(act.nomenclatura).toBe("TS15/07");
    expect(act.trocaSolo?.categoria).toBe("rotineira");
    expect(act.trocaSolo?.drenos).toHaveLength(1);
    expect(act.trocaSolo?.medicaoNumber).toBe(7);
    expect(Object.keys(act.trocaSolo!.contributions).length).toBeGreaterThan(0);
    expect(act.areaRect).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar pra confirmar que falha**

Run: `npx vitest run src/modules/rodotracker/utils/activityBuilders.test.ts`
Expected: FAIL — `Failed to resolve import "./activityBuilders"` (arquivo não existe).

- [ ] **Step 3: Implementar o builder**

Create `src/modules/rodotracker/utils/activityBuilders.ts`:

```ts
import type { Activity, CbuqCarga, LadoPista, Obra, TrocaSoloData } from "../types/activity";
import { latLngFromKm } from "./latLngFromKm";
import { calcCbuq } from "./cbuqCalc";
import { calcTrocaSolo } from "./trocaSoloCalc";
import { generateId } from "./format";

type ObraGeo = Pick<Obra, "centerLat" | "centerLng" | "kmInicial" | "routeGeoJson">;

export interface CbuqActivityInput {
  data: string;        // ISO yyyy-mm-dd
  kmInicial: number;
  kmFinal: number;
  cargas: CbuqCarga[];
}

export interface TsActivityInput {
  data: string;        // ISO yyyy-mm-dd
  km: number;
  estaca?: string;
  fracao?: string;
  lado: LadoPista;
  nomenclatura: string;
  ts: Pick<TrocaSoloData, "categoria" | "comprimento" | "largura" | "espessura" | "drenos" | "capaAsfaltica">;
}

/** Monta 1 Activity de CBUQ (Correção de Defeito) a partir do cabeçalho + cargas. */
export function buildCbuqActivity(
  input: CbuqActivityInput,
  obra: ObraGeo,
  medicao: number,
  now: number = Date.now(),
): Activity {
  const startPt = latLngFromKm(input.kmInicial, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
  const endPt = latLngFromKm(input.kmFinal, obra) ?? startPt;
  const uniqueDescricoes = Array.from(
    new Set(input.cargas.map((c) => (c.descricao ?? "").trim()).filter(Boolean)),
  );
  const cargas = input.cargas.map((c) => ({
    ...c,
    placa: c.placa.trim().toUpperCase(),
    data: c.data || input.data,
  }));
  return {
    id: generateId(),
    lat: startPt.lat,
    lng: startPt.lng,
    latEnd: endPt.lat,
    lngEnd: endPt.lng,
    service: "Correção de Defeito (CBUQ)",
    date: input.data,
    medicao,
    km: String(input.kmInicial),
    kmEnd: String(input.kmFinal),
    lado: "Pista Toda",
    areaRect: null,
    description: uniqueDescricoes.join("\n"),
    quantities: [],
    photoIds: [],
    photoFolders: [],
    cbuq: {
      medicaoNumber: medicao,
      cargas,
      contributions: calcCbuq(cargas).quantidades,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Monta 1 Activity de Troca de Solo a partir do cabeçalho + medidas/drenos. */
export function buildTsActivity(
  input: TsActivityInput,
  obra: ObraGeo,
  medicao: number,
  now: number = Date.now(),
): Activity {
  const pt = latLngFromKm(input.km, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
  const tsMedidas = {
    comprimento: input.ts.comprimento,
    largura: input.ts.largura,
    espessura: input.ts.espessura,
  };
  const trocaSolo: TrocaSoloData = {
    categoria: input.ts.categoria,
    medicaoNumber: medicao,
    comprimento: tsMedidas.comprimento,
    largura: tsMedidas.largura,
    espessura: tsMedidas.espessura,
    capaAsfaltica: input.ts.capaAsfaltica,
    drenos: input.ts.drenos,
    contributions: calcTrocaSolo(input.ts.categoria, tsMedidas, input.ts.drenos).quantidades,
  };
  return {
    id: generateId(),
    lat: pt.lat,
    lng: pt.lng,
    service: "Troca de Solo",
    date: input.data,
    medicao,
    km: String(input.km),
    lado: input.lado,
    areaRect: null,
    description: "",
    quantities: [],
    photoIds: [],
    photoFolders: [],
    trocaSolo,
    estaca: input.estaca?.trim() || undefined,
    fracao: input.fracao?.trim() || undefined,
    nomenclatura: input.nomenclatura.trim(),
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Rodar pra confirmar que passa**

Run: `npx vitest run src/modules/rodotracker/utils/activityBuilders.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/utils/activityBuilders.ts src/modules/rodotracker/utils/activityBuilders.test.ts
git commit -m "feat(rodotracker): builders puros de Activity pro lancamento rapido"
```

---

## Task 2: Passthrough de z-index no `Modal`

Motivo: o `Modal` nativo envolve o shadcn `Dialog` em z-50. Aberto de dentro do `MeasurementView` (z-3000), ele sumiria atrás. Adicionar props opcionais pra subir overlay+conteúdo acima de 3000. O `DialogContent` já aceita `overlayClassName` (commit anterior).

**Files:**
- Modify: `src/components/ui/Modal.tsx`

- [ ] **Step 1: Adicionar as props na interface**

Em `src/components/ui/Modal.tsx`, dentro de `interface ModalProps`, depois de `onClosePending?: () => void;`, adicionar:

```ts
  /** Classe extra no conteúdo do dialog (ex.: z-index quando aninhado em overlay alto). */
  contentClassName?: string;
  /** Classe extra no overlay do dialog (par do contentClassName pro backdrop subir junto). */
  overlayClassName?: string;
```

- [ ] **Step 2: Receber e repassar as props**

Na assinatura da função `Modal({ ... })`, adicionar `contentClassName` e `overlayClassName` aos parâmetros desestruturados (depois de `onClosePending,`).

Trocar o `<DialogContent ...>` (o atributo `className={ ... }`) por:

```tsx
      <DialogContent
        overlayClassName={overlayClassName}
        className={
          'p-0 gap-0 max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto ' +
          'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'border border-[var(--color-border)] sm:rounded-2xl ' +
          'shadow-[var(--shadow-xl)] elevate-top ' +
          'w-full ' + sizeClasses[size] +
          (contentClassName ? ' ' + contentClassName : '')
        }
      >
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc -b`
Expected: sem erros novos (passthrough opcional, 48 callsites inalterados).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Modal.tsx
git commit -m "feat(ui): Modal aceita overlayClassName/contentClassName (z-index aninhado)"
```

---

## Task 3: `QuickEntryModal` (componente novo)

**Files:**
- Create: `src/modules/rodotracker/components/Measurement/QuickEntryModal.tsx`
- Test: `src/modules/rodotracker/components/Measurement/QuickEntryModal.test.tsx`

- [ ] **Step 1: Escrever o teste RTL que falha**

Os sub-forms `CbuqForm`/`TrocaSoloForm` são mockados (têm vida própria); o teste foca na lógica do modal: cabeçalho + montagem + save + contador. O mock do `CbuqForm` expõe um botão que injeta 1 carga válida via `onChange`.

Create `src/modules/rodotracker/components/Measurement/QuickEntryModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QuickEntryModal } from "./QuickEntryModal";
import type { Obra } from "../../types/activity";

const addActivity = vi.fn(() => Promise.resolve());

vi.mock("../../hooks/useActivities", () => ({
  useActivities: () => ({ activities: [], addActivity, updateActivity: vi.fn(), deleteActivity: vi.fn() }),
}));
vi.mock("../../hooks/useContractItems", () => ({
  useContractItems: () => ({ items: [], addItems: vi.fn(), replaceAll: vi.fn() }),
}));
vi.mock("../../../../contexts/AuthContext", () => ({
  useAuth: () => ({ temAcao: () => true }),
}));
// Mock dos sub-forms: expõem um botão que injeta dados válidos via onChange.
vi.mock("../Form/CbuqForm", () => ({
  CbuqForm: ({ data, onChange }: any) => (
    <button type="button" onClick={() =>
      onChange({ ...data, cargas: [{ id: "c1", data: "", placa: "ABC1234", hora: "10:00", pesoT: 23.5 }] })
    }>add-carga-mock</button>
  ),
}));
vi.mock("../Form/TrocaSoloForm", () => ({
  TrocaSoloForm: ({ data, onChange }: any) => (
    <button type="button" onClick={() =>
      onChange({ ...data, comprimento: 26, largura: 4.8, espessura: 0.4 })
    }>fill-ts-mock</button>
  ),
}));

const obra = { id: "obra-1", name: "Obra Teste", centerLat: -10, centerLng: -55,
  kmInicial: 600, routeGeoJson: [[-10,-55],[-10,-54.7]] } as unknown as Obra;

beforeEach(() => addActivity.mockClear());

function setup() {
  return render(<QuickEntryModal open onClose={() => {}} obra={obra} medicao={7} />);
}

describe("QuickEntryModal — CBUQ", () => {
  it("salva 1 Activity de CBUQ e incrementa o contador (Salvar e novo)", async () => {
    const user = userEvent.setup();
    setup();
    fireEvent.change(screen.getByLabelText(/^Data/i), { target: { value: "2026-05-21" } });
    await user.type(screen.getByLabelText(/KM inicial/i), "620");
    await user.type(screen.getByLabelText(/KM final/i), "635");
    await user.click(screen.getByText("add-carga-mock"));
    await user.click(screen.getByRole("button", { name: /Salvar e novo/i }));
    await waitFor(() => expect(addActivity).toHaveBeenCalledTimes(1));
    const arg = addActivity.mock.calls[0][0];
    expect(arg.service).toBe("Correção de Defeito (CBUQ)");
    expect(arg.km).toBe("620");
    expect(screen.getByText(/1 lançada/i)).toBeInTheDocument();
  });

  it("bloqueia o save sem trecho válido", async () => {
    const user = userEvent.setup();
    setup();
    fireEvent.change(screen.getByLabelText(/^Data/i), { target: { value: "2026-05-21" } });
    await user.click(screen.getByText("add-carga-mock"));
    await user.click(screen.getByRole("button", { name: /Salvar e novo/i }));
    expect(addActivity).not.toHaveBeenCalled();
    expect(screen.getByText(/trecho|KM/i)).toBeInTheDocument();
  });
});

describe("QuickEntryModal — Troca de Solo", () => {
  it("salva 1 Activity de TS pela aba Troca de Solo", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /Troca de Solo/i }));
    fireEvent.change(screen.getByLabelText(/^Data/i), { target: { value: "2026-05-21" } });
    await user.type(screen.getByLabelText(/^KM/i), "620,5");
    await user.type(screen.getByLabelText(/Nomenclatura/i), "TS15/07");
    await user.click(screen.getByText("fill-ts-mock"));
    await user.click(screen.getByRole("button", { name: /Salvar e novo/i }));
    await waitFor(() => expect(addActivity).toHaveBeenCalledTimes(1));
    expect(addActivity.mock.calls[0][0].service).toBe("Troca de Solo");
  });
});
```

- [ ] **Step 2: Rodar pra confirmar que falha**

Run: `npx vitest run src/modules/rodotracker/components/Measurement/QuickEntryModal.test.tsx`
Expected: FAIL — `Failed to resolve import "./QuickEntryModal"`.

- [ ] **Step 3: Implementar o `QuickEntryModal`**

Create `src/modules/rodotracker/components/Measurement/QuickEntryModal.tsx`:

```tsx
import { useMemo, useState } from "react";
import Modal from "../../../../components/ui/Modal";
import Input from "../../../../components/ui/Input";
import Select from "../../../../components/ui/Select";
import Button from "../../../../components/ui/Button";
import SubmitButton from "../../../../components/ui/SubmitButton";
import { CbuqForm } from "../Form/CbuqForm";
import { TrocaSoloForm } from "../Form/TrocaSoloForm";
import { useActivities } from "../../hooks/useActivities";
import { useContractItems } from "../../hooks/useContractItems";
import { buildCbuqActivity, buildTsActivity } from "../../utils/activityBuilders";
import { parseKm } from "../../utils/quickEntryParsers";
import type { CbuqData, LadoPista, Obra, TrocaSoloData } from "../../types/activity";

interface Props {
  open: boolean;
  onClose: () => void;
  obra: Obra;
  medicao: number;
}

type Tab = "cbuq" | "ts";

const LADO_OPTIONS = [
  { value: "Pista Toda", label: "Pista Toda" },
  { value: "Direito", label: "Direito" },
  { value: "Esquerdo", label: "Esquerdo" },
];

const emptyCbuq = (medicao: number): CbuqData => ({ medicaoNumber: medicao, cargas: [], contributions: {} });
const emptyTs = (medicao: number): TrocaSoloData => ({
  categoria: "rotineira", medicaoNumber: medicao,
  comprimento: 0, largura: 0, espessura: 0, drenos: [], contributions: {},
});

export function QuickEntryModal({ open, onClose, obra, medicao }: Props) {
  const { activities, addActivity } = useActivities(obra.id);
  const { items: contractItems } = useContractItems(obra.id);

  const [tab, setTab] = useState<Tab>("cbuq");
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cabeçalho CBUQ
  const [cData, setCData] = useState("");
  const [cKmIni, setCKmIni] = useState("");
  const [cKmFim, setCKmFim] = useState("");
  const [cbuqData, setCbuqData] = useState<CbuqData>(() => emptyCbuq(medicao));

  // Cabeçalho TS
  const [tData, setTData] = useState("");
  const [tKm, setTKm] = useState("");
  const [tEstaca, setTEstaca] = useState("");
  const [tFracao, setTFracao] = useState("");
  const [tLado, setTLado] = useState<LadoPista>("Pista Toda");
  const [tNomenclatura, setTNomenclatura] = useState("");
  const [tsData, setTsData] = useState<TrocaSoloData>(() => emptyTs(medicao));

  const nomenclaturasExistentes = useMemo(() => {
    const s = new Set<string>();
    for (const a of activities) {
      if (a.medicao === medicao && a.nomenclatura) s.add(a.nomenclatura.trim());
    }
    return s;
  }, [activities, medicao]);

  const nomenclaturaDup = tNomenclatura.trim().length > 0 && nomenclaturasExistentes.has(tNomenclatura.trim());

  const resetCbuq = () => { setCData(""); setCKmIni(""); setCKmFim(""); setCbuqData(emptyCbuq(medicao)); };
  const resetTs = () => {
    setTData(""); setTKm(""); setTEstaca(""); setTFracao("");
    setTLado("Pista Toda"); setTNomenclatura(""); setTsData(emptyTs(medicao));
  };

  const handleClose = () => {
    if (saving) return;
    resetCbuq(); resetTs(); setError(null); setSavedCount(0); setTab("cbuq");
    onClose();
  };

  async function save(close: boolean) {
    if (saving) return;
    setError(null);

    if (tab === "cbuq") {
      const kmIni = parseKm(cKmIni);
      const kmFim = parseKm(cKmFim);
      if (!cData) return setError("Informe a data.");
      if (kmIni == null || kmFim == null) return setError("Informe o trecho com KM inicial e final válidos.");
      if (kmFim <= kmIni) return setError("O KM final precisa ser maior que o inicial.");
      const cargas = cbuqData.cargas;
      if (cargas.length === 0) return setError("Adicione pelo menos uma carga.");
      for (let i = 0; i < cargas.length; i++) {
        if (!cargas[i].placa.trim()) return setError(`A carga #${i + 1} precisa de placa.`);
        if (cargas[i].pesoT <= 0) return setError(`A carga #${i + 1} precisa de peso maior que zero.`);
      }
      const activity = buildCbuqActivity({ data: cData, kmInicial: kmIni, kmFinal: kmFim, cargas }, obra, medicao);
      setSaving(true);
      try {
        await addActivity(activity);
      } catch (e) {
        setSaving(false);
        return setError(`Falha ao salvar: ${(e as Error).message}`);
      }
      setSaving(false);
      setSavedCount((n) => n + 1);
      if (close) return handleClose();
      resetCbuq();
      return;
    }

    // tab === "ts"
    const km = parseKm(tKm);
    if (!tData) return setError("Informe a data.");
    if (km == null) return setError("Informe um KM válido.");
    if (!tNomenclatura.trim()) return setError("Informe a nomenclatura.");
    const { comprimento, largura, espessura } = tsData;
    if (comprimento <= 0 || largura <= 0 || espessura <= 0) {
      return setError("Preencha comprimento, largura e espessura da troca de solo.");
    }
    const activity = buildTsActivity(
      { data: tData, km, estaca: tEstaca, fracao: tFracao, lado: tLado,
        nomenclatura: tNomenclatura, ts: tsData },
      obra, medicao,
    );
    setSaving(true);
    try {
      await addActivity(activity);
    } catch (e) {
      setSaving(false);
      return setError(`Falha ao salvar: ${(e as Error).message}`);
    }
    setSaving(false);
    setSavedCount((n) => n + 1);
    if (close) return handleClose();
    resetTs();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Lançamento rápido — ${obra.name} · ${medicao}ª Medição`}
      size="xl"
      overlayClassName="z-[3600]"
      contentClassName="z-[3600]"
    >
      {/* Abas */}
      <div className="flex gap-1 mb-4" role="tablist">
        {(["cbuq", "ts"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setError(null); }}
            className={
              "px-3 py-1.5 text-sm rounded-lg border transition-colors " +
              (tab === t
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                : "bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)]")
            }
          >
            {t === "cbuq" ? "CBUQ" : "Troca de Solo"}
          </button>
        ))}
        {savedCount > 0 && (
          <span className="ml-auto self-center text-xs text-[var(--color-fg-muted)]">
            {savedCount} {savedCount === 1 ? "lançada" : "lançadas"} nesta sessão
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {tab === "cbuq" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Data" type="date" required value={cData} onChange={(e) => setCData(e.target.value)} />
            <Input label="KM inicial" placeholder="620" value={cKmIni} onChange={(e) => setCKmIni(e.target.value)} />
            <Input label="KM final" placeholder="635" value={cKmFim} onChange={(e) => setCKmFim(e.target.value)} />
          </div>
          <CbuqForm data={cbuqData} onChange={setCbuqData} contractItems={contractItems} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Data" type="date" required value={tData} onChange={(e) => setTData(e.target.value)} />
            <Input label="KM" placeholder="620+500" value={tKm} onChange={(e) => setTKm(e.target.value)} />
            <Select label="Lado" options={LADO_OPTIONS} value={tLado}
              onChange={(e) => setTLado(e.target.value as LadoPista)} />
            <Input label="Estaca" value={tEstaca} onChange={(e) => setTEstaca(e.target.value)} />
            <Input label="Fração" value={tFracao} onChange={(e) => setTFracao(e.target.value)} />
            <Input label="Nomenclatura" required placeholder="TS15/07"
              value={tNomenclatura} onChange={(e) => setTNomenclatura(e.target.value)} />
          </div>
          {nomenclaturaDup && (
            <div className="text-xs text-[var(--color-warning,#f59e0b)]">
              Já existe uma atividade com essa nomenclatura nesta medição. Você ainda pode salvar.
            </div>
          )}
          <TrocaSoloForm data={tsData} onChange={setTsData} contractItems={contractItems} />
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button type="button" variant="secondary" onClick={() => void save(false)} disabled={saving}>
          Salvar e novo
        </Button>
        <SubmitButton loading={saving} onClick={() => void save(true)}>Salvar e fechar</SubmitButton>
      </div>
    </Modal>
  );
}
```

Nota: o teste do passo 1 usa `getByLabelText(/^KM/i)` na aba TS (casa "KM") e `/KM inicial/`,`/KM final/` no CBUQ; os labels acima batem. `SubmitButton` é `type="submit"` por padrão mas aqui não há `<form>`, então o `onClick` dispara o save (sem submit de form).

- [ ] **Step 4: Rodar pra confirmar que passa**

Run: `npx vitest run src/modules/rodotracker/components/Measurement/QuickEntryModal.test.tsx`
Expected: PASS (3 testes). Se algum `getByLabelText` reclamar de ambiguidade, ajustar o regex do label no teste (ex.: `/^Data$/i`), não a fonte.

- [ ] **Step 5: Commit**

```bash
git add src/modules/rodotracker/components/Measurement/QuickEntryModal.tsx src/modules/rodotracker/components/Measurement/QuickEntryModal.test.tsx
git commit -m "feat(rodotracker): QuickEntryModal nativo (CBUQ + TS, salvar e novo)"
```

---

## Task 4: Religar o `MeasurementView` e apagar a feature antiga

**Files:**
- Modify: `src/modules/rodotracker/components/Measurement/MeasurementView.tsx`
- Delete: 8 arquivos da UI/grid antiga.

- [ ] **Step 1: Trocar o import e o render no `MeasurementView`**

Em `src/modules/rodotracker/components/Measurement/MeasurementView.tsx`:

Linha 24, trocar:
```tsx
import { QuickEntrySheet } from "./QuickEntrySheet";
```
por:
```tsx
import { QuickEntryModal } from "./QuickEntryModal";
```

No bloco de render (≈ linhas 657-664), trocar:
```tsx
      {showQuickEntry && (
        <QuickEntrySheet
          open={showQuickEntry}
          onClose={() => setShowQuickEntry(false)}
          obra={obra}
          medicao={currentMedicao}
        />
      )}
```
por:
```tsx
      {showQuickEntry && (
        <QuickEntryModal
          open={showQuickEntry}
          onClose={() => setShowQuickEntry(false)}
          obra={obra}
          medicao={currentMedicao}
        />
      )}
```
(Manter `showQuickEntry`/`setShowQuickEntry` na linha 57 e o botão "Lançamento rápido" nas linhas ~350-358 como estão.)

- [ ] **Step 2: Apagar os arquivos da feature antiga**

```bash
git rm \
  src/modules/rodotracker/components/Measurement/QuickEntrySheet.tsx \
  src/modules/rodotracker/components/Measurement/QuickEntryGridCbuq.tsx \
  src/modules/rodotracker/components/Measurement/QuickEntryGridTs.tsx \
  src/modules/rodotracker/components/Measurement/quickEntryCells.tsx \
  src/modules/rodotracker/utils/quickEntryValidators.ts \
  src/modules/rodotracker/utils/quickEntryValidators.test.ts \
  src/modules/rodotracker/utils/quickEntryGrouping.ts \
  src/modules/rodotracker/utils/quickEntryGrouping.test.ts \
  tests/quick-entry.spec.ts
```

- [ ] **Step 3: Verificar que nada quebrou no typecheck**

Run: `npx tsc -b`
Expected: sem erros. (`quickEntryParsers.ts` continua existindo — `parseKm` é usado pelo modal e pelo builder.)

Se aparecer erro de import órfão (algo ainda importando um arquivo apagado), corrigir o import. Já foi verificado que nada fora da feature importava grouping/validators.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(rodotracker): troca QuickEntrySheet pelo QuickEntryModal e remove o grid shadcn"
```

---

## Task 5: Verificação final

**Files:** nenhum (só rodar).

- [ ] **Step 1: Suíte de testes do módulo**

Run: `npx vitest run src/modules/rodotracker`
Expected: PASS. Em especial `activityBuilders.test.ts`, `QuickEntryModal.test.tsx` e `quickEntryParsers.test.ts`. Nenhum teste referenciando `quickEntryGrouping`/`quickEntryValidators` (foram apagados junto).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: build conclui sem erro.

- [ ] **Step 3: Verificação manual (anotar resultado)**

Rodar `npm run dev`, abrir Medição de uma obra, clicar em "Lançamento rápido". Conferir:
- Modal abre POR CIMA do MeasurementView (não atrás), no visual do app (igual frete).
- Aba CBUQ: preencher Data + Trecho, adicionar carga(s), "Salvar e novo" cria a atividade, contador sobe, form limpa.
- Aba Troca de Solo: Data + KM + Nomenclatura + medidas, "Salvar e novo" funciona.
- "Salvar e fechar" salva e fecha. "Cancelar" fecha sem salvar.

- [ ] **Step 4: Commit final (se houver ajustes do passo 3)**

```bash
git add -A
git commit -m "fix(rodotracker): ajustes finais do QuickEntryModal apos verificacao manual"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** apagar UI antiga (Task 4) ✓; manter calc/parsers/sub-forms (Tasks 1/3 reusam) ✓; híbrido cabeçalho+sub-form (Task 3) ✓; salvar-e-novo + contador (Task 3) ✓; builders puros testados (Task 1) ✓; validação leve inline (Task 3 `save()`) ✓; nomenclatura duplicada = aviso não-bloqueante (Task 3) ✓; religar MeasurementView (Task 4) ✓; z-index acima do MeasurementView (Task 2 + uso no Task 3) ✓.
- **Placeholders:** nenhum — todo passo de código tem o código real.
- **Consistência de tipos:** `CbuqActivityInput`/`TsActivityInput` definidos no Task 1 e usados no Task 3; `buildCbuqActivity`/`buildTsActivity` com a mesma assinatura `(input, obra, medicao, now?)`; props `overlayClassName`/`contentClassName` definidas no Task 2 e usadas no Task 3; `parseKm` (mantido) usado no Task 3.
- **Fora do escopo confirmado:** ActivityFormModal, migração shadcn do resto do rodotracker, import de planilha multi-dia.
