import { describe, it, expect } from "vitest";
import {
  validateRowCbuq,
  validateRowTs,
  validateCrossRowTs,
  type CbuqRow,
  type TsRow,
} from "./quickEntryValidators";

const validCbuq: CbuqRow = {
  id: "1",
  data: "21/05/2026",
  trecho: "620-635",
  placa: "ABC1234",
  hora: "10:00",
  peso: "23.5",
  descricao: "",
};

const validTs: TsRow = {
  id: "1",
  data: "21/05/2026",
  tipo: "TS",
  nomenclatura: "TS15/07",
  estaca: "380",
  fracao: "10",
  km: "621.38",
  lado: "D",
  comprimento: "26",
  largura: "4.8",
  espessura: "0.4",
};

describe("validateRowCbuq", () => {
  it("linha válida não tem erros", () => {
    expect(validateRowCbuq(validCbuq)).toEqual({});
  });
  it("data vazia gera erro em data", () => {
    expect(validateRowCbuq({ ...validCbuq, data: "" })).toHaveProperty("data");
  });
  it("trecho inválido gera erro em trecho", () => {
    expect(validateRowCbuq({ ...validCbuq, trecho: "xyz" })).toHaveProperty("trecho");
  });
  it("placa vazia gera erro em placa", () => {
    expect(validateRowCbuq({ ...validCbuq, placa: "" })).toHaveProperty("placa");
  });
  it("peso zero gera erro em peso", () => {
    expect(validateRowCbuq({ ...validCbuq, peso: "0" })).toHaveProperty("peso");
  });
});

describe("validateRowTs", () => {
  it("linha válida não tem erros", () => {
    expect(validateRowTs(validTs)).toEqual({});
  });
  it("nomenclatura vazia gera erro em nomenclatura", () => {
    expect(validateRowTs({ ...validTs, nomenclatura: "" })).toHaveProperty("nomenclatura");
  });
  it("km inválido gera erro em km", () => {
    expect(validateRowTs({ ...validTs, km: "abc" })).toHaveProperty("km");
  });
  it("comprimento zero gera erro em comprimento", () => {
    expect(validateRowTs({ ...validTs, comprimento: "0" })).toHaveProperty("comprimento");
  });
  it("dreno também valida medidas > 0", () => {
    const dreno: TsRow = { ...validTs, tipo: "Dreno", largura: "0" };
    expect(validateRowTs(dreno)).toHaveProperty("largura");
  });
});

describe("validateCrossRowTs", () => {
  const baseTs = (id: string, nomenclatura: string, tipo: "TS" | "Dreno"): TsRow => ({
    id, data: "21/05/2026", tipo, nomenclatura,
    estaca: "", fracao: "", km: "620", lado: "D",
    comprimento: "10", largura: "1", espessura: "0.3",
  });

  it("1 TS + 2 drenos com mesma nomenclatura: ok", () => {
    const rows = [
      baseTs("1", "TS15/07", "TS"),
      baseTs("2", "TS15/07", "Dreno"),
      baseTs("3", "TS15/07", "Dreno"),
    ];
    expect(validateCrossRowTs(rows, new Set())).toEqual([]);
  });

  it("2 TS com mesma nomenclatura: erro", () => {
    const rows = [
      baseTs("1", "TS15/07", "TS"),
      baseTs("2", "TS15/07", "TS"),
    ];
    const errors = validateCrossRowTs(rows, new Set());
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/duas?.*TS/i);
  });

  it("só drenos sem TS principal: erro", () => {
    const rows = [
      baseTs("1", "TS15/07", "Dreno"),
      baseTs("2", "TS15/07", "Dreno"),
    ];
    const errors = validateCrossRowTs(rows, new Set());
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/principal/i);
  });

  it("nomenclatura conflita com existente na medição: erro", () => {
    const rows = [baseTs("1", "TS15/07", "TS")];
    const errors = validateCrossRowTs(rows, new Set(["TS15/07"]));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/j[áa].*existe/i);
  });

  it("ignora linhas sem nomenclatura (vazias)", () => {
    const rows = [baseTs("1", "", "TS")];
    expect(validateCrossRowTs(rows, new Set())).toEqual([]);
  });
});
