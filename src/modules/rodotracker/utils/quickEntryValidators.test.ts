import { describe, it, expect } from "vitest";
import { validateRowCbuq, validateRowTs, type CbuqRow, type TsRow } from "./quickEntryValidators";

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
