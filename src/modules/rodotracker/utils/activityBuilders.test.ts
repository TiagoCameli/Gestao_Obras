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
