import { useMemo, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { TextCell } from "./quickEntryCells";
import type { CbuqRow } from "../../utils/quickEntryValidators";
import { validateRowCbuq } from "../../utils/quickEntryValidators";
import { parseTsv, distributePaste } from "../../utils/parseTsv";
import { parseNumber } from "../../utils/parseNumber";
import { generateId } from "../../utils/format";

export function makeEmptyCbuqRow(): CbuqRow {
  return { id: generateId(), data: "", trecho: "", placa: "", hora: "", peso: "", descricao: "" };
}

interface Props {
  rows: CbuqRow[];
  onRowsChange: (rows: CbuqRow[]) => void;
}

const COLS: { key: keyof CbuqRow; label: string; width: string }[] = [
  { key: "data", label: "Data", width: "110px" },
  { key: "trecho", label: "Trecho do dia (KM)", width: "160px" },
  { key: "placa", label: "Placa", width: "110px" },
  { key: "hora", label: "Hora", width: "80px" },
  { key: "peso", label: "Peso (t)", width: "90px" },
  { key: "descricao", label: "Descrição", width: "auto" },
];
const COL_KEYS = COLS.map((c) => c.key);

export function QuickEntryGridCbuq({ rows, onRowsChange }: Props) {
  // garante sempre uma linha em branco no final
  const displayRows = useMemo(() => {
    if (rows.length === 0 || hasAnyContent(rows[rows.length - 1])) {
      return [...rows, makeEmptyCbuqRow()];
    }
    return rows;
  }, [rows]);

  const errorsByRow = useMemo(() => {
    return displayRows.map((r) => (hasAnyContent(r) ? validateRowCbuq(r) : {}));
  }, [displayRows]);

  const setCell = useCallback(
    (rowIdx: number, key: keyof CbuqRow, value: string) => {
      const next = displayRows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r));
      onRowsChange(stripTrailingBlanks(next));
    },
    [displayRows, onRowsChange]
  );

  const removeRow = (rowIdx: number) => {
    const next = displayRows.filter((_, i) => i !== rowIdx);
    onRowsChange(stripTrailingBlanks(next));
  };

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTableCellElement>, rowIdx: number, colIdx: number) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
      e.preventDefault();
      const tsv = parseTsv(text);
      const next = distributePaste(displayRows, COL_KEYS, tsv, { row: rowIdx, col: colIdx }, makeEmptyCbuqRow);
      onRowsChange(stripTrailingBlanks(next));
    },
    [displayRows, onRowsChange]
  );

  const totalPeso = useMemo(
    () => displayRows.reduce((sum, r) => sum + (parseNumber(r.peso) || 0), 0),
    [displayRows]
  );

  return (
    <div className="border rounded-md overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-muted sticky top-0">
          <tr>
            {COLS.map((c) => (
              <th key={c.key} style={{ width: c.width }} className="text-left px-2 py-2 font-medium">
                {c.label}
              </th>
            ))}
            <th style={{ width: "40px" }}></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, rowIdx) => {
            const errs = errorsByRow[rowIdx];
            return (
              <tr key={row.id} className="border-t">
                {COLS.map((c, colIdx) => (
                  <td key={c.key} className="p-0" onPaste={(e) => onPaste(e, rowIdx, colIdx)}>
                    <TextCell
                      value={row[c.key]}
                      onChange={(v) => setCell(rowIdx, c.key, v)}
                      error={errs[c.key as string]}
                    />
                  </td>
                ))}
                <td className="p-0 text-center">
                  {hasAnyContent(row) && (
                    <button onClick={() => removeRow(rowIdx)} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-muted/50 border-t">
          <tr>
            <td colSpan={COLS.length + 1} className="px-2 py-2 text-sm text-muted-foreground">
              Σ peso = {totalPeso.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function hasAnyContent(r: CbuqRow): boolean {
  return Boolean(r.data || r.trecho || r.placa || r.hora || r.peso || r.descricao);
}

function stripTrailingBlanks(rows: CbuqRow[]): CbuqRow[] {
  let i = rows.length;
  while (i > 0 && !hasAnyContent(rows[i - 1])) i--;
  return rows.slice(0, i);
}
