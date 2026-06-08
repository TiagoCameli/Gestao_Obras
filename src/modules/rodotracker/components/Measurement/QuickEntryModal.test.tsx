import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
    expect(screen.getByText(/Informe o trecho/i)).toBeInTheDocument();
  });
});

describe("QuickEntryModal — Troca de Solo", () => {
  it("salva 1 Activity de TS pela aba Troca de Solo", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("tab", { name: /Troca de Solo/i }));
    fireEvent.change(screen.getByLabelText(/^Data/i), { target: { value: "2026-05-21" } });
    await user.type(screen.getByLabelText(/^KM/i), "620,5");
    await user.type(screen.getByLabelText(/Nomenclatura/i), "TS15/07");
    await user.click(screen.getByText("fill-ts-mock"));
    await user.click(screen.getByRole("button", { name: /Salvar e novo/i }));
    await waitFor(() => expect(addActivity).toHaveBeenCalledTimes(1));
    expect(addActivity.mock.calls[0][0].service).toBe("Troca de Solo");
  });
});
