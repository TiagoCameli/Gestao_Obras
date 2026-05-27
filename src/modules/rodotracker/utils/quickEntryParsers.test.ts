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
