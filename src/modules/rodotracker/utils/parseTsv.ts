export function parseTsv(input: string): string[][] {
  const normalized = String(input ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  // Strip a single trailing empty line (common when copy includes a final newline).
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => line.split("\t"));
}

export interface CellPos {
  row: number;
  col: number;
}

/**
 * Cola TSV `paste` numa lista de linhas (rows) a partir da célula focada
 * (anchor). Retorna NOVA lista (não muta). Cria linhas extras se paste excede
 * — usando `makeEmptyRow` (caller deve passar quando precisar de novas linhas).
 */
export function distributePaste<TRow extends Record<string, unknown>, TKey extends keyof TRow>(
  rows: TRow[],
  cols: TKey[],
  paste: string[][],
  anchor: CellPos,
  makeEmptyRow: () => TRow = () => ({} as TRow)
): TRow[] {
  const out = rows.map((r) => ({ ...r }));
  for (let i = 0; i < paste.length; i++) {
    const targetRowIdx = anchor.row + i;
    while (out.length <= targetRowIdx) {
      out.push(makeEmptyRow());
    }
    const targetRow = out[targetRowIdx];
    for (let j = 0; j < paste[i].length; j++) {
      const targetColIdx = anchor.col + j;
      if (targetColIdx >= cols.length) break;
      const colKey = cols[targetColIdx];
      (targetRow as Record<string, unknown>)[colKey as string] = paste[i][j];
    }
  }
  return out;
}
