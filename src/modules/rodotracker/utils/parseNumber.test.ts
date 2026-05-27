import { describe, it, expect } from "vitest";
import { parseNumber } from "./parseNumber";

describe("parseNumber", () => {
  it("retorna 0 pra string vazia", () => {
    expect(parseNumber("")).toBe(0);
  });
  it("parseia inteiro", () => {
    expect(parseNumber("42")).toBe(42);
  });
  it("parseia decimal com vírgula (formato BR)", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
  });
  it("parseia decimal com ponto (formato US)", () => {
    expect(parseNumber("1234.56")).toBe(1234.56);
  });
  it("aceita number direto", () => {
    expect(parseNumber(42.5)).toBe(42.5);
  });
  it("retorna 0 pra texto não-numérico", () => {
    expect(parseNumber("abc")).toBe(0);
  });
});
