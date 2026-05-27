import { describe, it, expect } from "vitest";
import { parseKm } from "./quickEntryParsers";

describe("parseKm", () => {
  it("inteiro", () => expect(parseKm("620")).toBe(620));
  it("decimal com ponto", () => expect(parseKm("620.5")).toBe(620.5));
  it("decimal com vírgula", () => expect(parseKm("620,5")).toBe(620.5));
  it("estaca+fração 620+500", () => expect(parseKm("620+500")).toBe(620.5));
  it("estaca+fração 620+250", () => expect(parseKm("620+250")).toBe(620.25));
  it("estaca+fração 620+000", () => expect(parseKm("620+000")).toBe(620));
  it("texto não-numérico → null", () => expect(parseKm("abc")).toBeNull());
  it("vazio → null", () => expect(parseKm("")).toBeNull());
  it("trim espaços", () => expect(parseKm("  620  ")).toBe(620));
});

import { parseTrecho } from "./quickEntryParsers";

describe("parseTrecho", () => {
  it("hífen", () => expect(parseTrecho("620-635")).toEqual({ kmInicial: 620, kmFinal: 635 }));
  it("en-dash", () => expect(parseTrecho("620–635")).toEqual({ kmInicial: 620, kmFinal: 635 }));
  it("decimais com vírgula", () => expect(parseTrecho("620,1-635,5")).toEqual({ kmInicial: 620.1, kmFinal: 635.5 }));
  it("formato 'KM 620 a 635'", () => expect(parseTrecho("KM 620 a 635")).toEqual({ kmInicial: 620, kmFinal: 635 }));
  it("kmFinal ≤ kmInicial → null", () => expect(parseTrecho("635-620")).toBeNull());
  it("um número só → null", () => expect(parseTrecho("620")).toBeNull());
  it("vazio → null", () => expect(parseTrecho("")).toBeNull());
});

import { parseData } from "./quickEntryParsers";

describe("parseData", () => {
  it("dd/mm/aaaa", () => expect(parseData("21/05/2026")).toBe("2026-05-21"));
  it("dd-mm-aaaa", () => expect(parseData("21-05-2026")).toBe("2026-05-21"));
  it("aaaa-mm-dd (ISO já)", () => expect(parseData("2026-05-21")).toBe("2026-05-21"));
  it("um dígito de dia/mês", () => expect(parseData("3/5/2026")).toBe("2026-05-03"));
  it("trim espaços", () => expect(parseData("  21/05/2026  ")).toBe("2026-05-21"));
  it("texto inválido → null", () => expect(parseData("21 de maio")).toBeNull());
  it("vazio → null", () => expect(parseData("")).toBeNull());
  it("data inexistente (32/05) → null", () => expect(parseData("32/05/2026")).toBeNull());
  it("mês inválido → null", () => expect(parseData("21/13/2026")).toBeNull());
});
