import { describe, it, expect } from "vitest";
import { groupCbuqRowsToActivities, groupTsRowsToActivities } from "./quickEntryGrouping";
import type { CbuqRow, TsRow } from "./quickEntryValidators";
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

const baseTs = (over: Partial<TsRow> = {}): TsRow => ({
  id: "r" + Math.random(),
  data: "21/05/2026",
  tipo: "TS",
  nomenclatura: "TS15/07",
  estaca: "380",
  fracao: "10",
  km: "620.5",
  lado: "D",
  comprimento: "26",
  largura: "4.8",
  espessura: "0.4",
  ...over,
});

describe("groupTsRowsToActivities", () => {
  it("TS + 2 drenos com mesma nomenclatura viram 1 Activity", () => {
    const rows = [
      baseTs(),
      baseTs({ tipo: "Dreno", comprimento: "30", largura: "0.6", espessura: "0.5" }),
      baseTs({ tipo: "Dreno", comprimento: "25", largura: "0.6", espessura: "0.5" }),
    ];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(1);
    expect(result[0].trocaSolo?.drenos).toHaveLength(2);
    expect(result[0].nomenclatura).toBe("TS15/07");
    expect(result[0].estaca).toBe("380");
    expect(result[0].lado).toBe("Direito");
    expect(result[0].trocaSolo?.categoria).toBe("rotineira");
  });

  it("2 nomenclaturas diferentes viram 2 Activities", () => {
    const rows = [baseTs({ nomenclatura: "TS15/07" }), baseTs({ nomenclatura: "TS16/07" })];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(2);
  });

  it("lado D vira 'Direito', E vira 'Esquerdo', PT vira 'Pista Toda'", () => {
    const r1 = groupTsRowsToActivities([baseTs({ lado: "D", nomenclatura: "A" })], obra, 1, "rotineira");
    const r2 = groupTsRowsToActivities([baseTs({ lado: "E", nomenclatura: "B" })], obra, 1, "rotineira");
    const r3 = groupTsRowsToActivities([baseTs({ lado: "PT", nomenclatura: "C" })], obra, 1, "rotineira");
    expect(r1[0].lado).toBe("Direito");
    expect(r2[0].lado).toBe("Esquerdo");
    expect(r3[0].lado).toBe("Pista Toda");
  });

  it("ignora linhas sem nomenclatura", () => {
    const rows = [baseTs(), baseTs({ nomenclatura: "" })];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(1);
  });

  it("grupo só com drenos (sem TS principal) é ignorado", () => {
    const rows = [baseTs({ tipo: "Dreno", nomenclatura: "X" })];
    const result = groupTsRowsToActivities(rows, obra, 1, "rotineira");
    expect(result).toHaveLength(0);
  });
});
