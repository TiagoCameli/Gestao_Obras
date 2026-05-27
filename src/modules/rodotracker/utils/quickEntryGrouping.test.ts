import { describe, it, expect } from "vitest";
import { groupCbuqRowsToActivities } from "./quickEntryGrouping";
import type { CbuqRow } from "./quickEntryValidators";
import type { Obra } from "../types/activity";

const obra = {
  centerLat: -10, centerLng: -55, kmInicial: 600,
  routeGeoJson: [[-10, -55], [-10, -54.7]] as [number, number][],
} as Obra;

const baseRow = (over: Partial<CbuqRow> = {}): CbuqRow => ({
  id: "r" + Math.random(),
  data: "21/05/2026",
  trecho: "620-635",
  placa: "ABC1234",
  hora: "10:00",
  peso: "23.5",
  descricao: "",
  ...over,
});

describe("groupCbuqRowsToActivities", () => {
  it("3 linhas no mesmo dia+trecho viram 1 Activity com 3 cargas", () => {
    const rows = [baseRow(), baseRow({ placa: "DEF5678" }), baseRow({ placa: "GHI9012" })];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(1);
    expect(result[0].cbuq?.cargas).toHaveLength(3);
    expect(result[0].service).toBe("Correção de Defeito (CBUQ)");
    expect(result[0].medicao).toBe(1);
    expect(result[0].lado).toBe("Pista Toda");
    expect(result[0].km).toBe("620");
    expect(result[0].kmEnd).toBe("635");
  });

  it("linhas em 2 dias diferentes viram 2 Activities", () => {
    const rows = [
      baseRow({ data: "21/05/2026" }),
      baseRow({ data: "22/05/2026" }),
    ];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(2);
  });

  it("mesmo dia, trechos diferentes viram 2 Activities", () => {
    const rows = [
      baseRow({ trecho: "620-635" }),
      baseRow({ trecho: "640-650" }),
    ];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(2);
  });

  it("descrições únicas das cargas concatenam na Activity.description", () => {
    const rows = [
      baseRow({ descricao: "Faixa C 12.5" }),
      baseRow({ placa: "DEF5678", descricao: "Faixa C 12.5" }),
      baseRow({ placa: "GHI9012", descricao: "Faixa B 19.0" }),
    ];
    const [act] = groupCbuqRowsToActivities(rows, obra, 1);
    expect(act.description).toBe("Faixa C 12.5\nFaixa B 19.0");
  });

  it("ignora linhas vazias (sem data)", () => {
    const rows = [baseRow(), baseRow({ data: "", trecho: "", placa: "", peso: "" })];
    const result = groupCbuqRowsToActivities(rows, obra, 1);
    expect(result).toHaveLength(1);
    expect(result[0].cbuq?.cargas).toHaveLength(1);
  });
});
