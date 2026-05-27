import { describe, it, expect } from "vitest";
import { parseTsv, distributePaste } from "./parseTsv";

describe("parseTsv", () => {
  it("uma linha, três células", () => {
    expect(parseTsv("a\tb\tc")).toEqual([["a", "b", "c"]]);
  });
  it("duas linhas com \\n", () => {
    expect(parseTsv("a\tb\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("CRLF (Windows)", () => {
    expect(parseTsv("a\tb\r\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("strip linha final vazia", () => {
    expect(parseTsv("a\tb\n")).toEqual([["a", "b"]]);
  });
});

describe("distributePaste", () => {
  type Row = { c0: string; c1: string; c2: string };
  const cols: (keyof Row)[] = ["c0", "c1", "c2"];

  it("distribui a partir de (0,0)", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a", "b"]], { row: 0, col: 0 });
    expect(result[0]).toEqual({ c0: "a", c1: "b", c2: "" });
  });

  it("distribui a partir de (0,1)", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a", "b"]], { row: 0, col: 1 });
    expect(result[0]).toEqual({ c0: "", c1: "a", c2: "b" });
  });

  it("cria linhas adicionais se paste excede linhas existentes", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a"], ["b"], ["c"]], { row: 0, col: 0 }, () => ({ c0: "", c1: "", c2: "" }));
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ c0: "c", c1: "", c2: "" });
  });

  it("ignora células que extrapolam o número de colunas", () => {
    const rows: Row[] = [{ c0: "", c1: "", c2: "" }];
    const result = distributePaste(rows, cols, [["a", "b", "c", "d"]], { row: 0, col: 0 });
    expect(result[0]).toEqual({ c0: "a", c1: "b", c2: "c" });
  });
});
