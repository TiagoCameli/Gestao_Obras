import { useMemo, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { TextCell, SelectCell } from "./quickEntryCells";
import type { TsRow, CrossRowError } from "../../utils/quickEntryValidators";
import { validateRowTs, validateCrossRowTs } from "../../utils/quickEntryValidators";
import { parseTsv, distributePaste } from "../../utils/parseTsv";
import { parseNumber } from "../../utils/parseNumber";
import { generateId } from "../../utils/format";

export function makeEmptyTsRow(): TsRow {
  return {
    id: generateId(), data: "", tipo: "", nomenclatura: "",
    estaca: "", fracao: "", km: "", lado: "",
    comprimento: "", largura: "", espessura: "",
  };
}

interface Props {
  rows: TsRow[];
  onRowsChange: (rows: TsRow[]) => void;
  existingNomenclaturas: Set<string>;
}

const COLS: { key: keyof TsRow; label: string; width: string; type: "text" | "select" }[] = [
  { key: "data", label: "Data", width: "110px", type: "text" },
  { key: "tipo", label: "Tipo", width: "90px", type: "select" },
  { key: "nomenclatura", label: "Nomenclatura", width: "120px", type: "text" },
  { key: "estaca", label: "Estaca", width: "80px", type: "text" },
  { key: "fracao", label: "Fração", width: "80px", type: "text" },
  { key: "km", label: "KM", width: "100px", type: "text" },
  { key: "lado", label: "Lado", width: "80px", type: "select" },
  { key: "comprimento", label: "Compr (m)", width: "100px", type: "text" },
  { key: "largura", label: "Larg (m)", width: "90px", type: "text" },
  { key: "espessura", label: "Esp (m)", width: "90px", type: "text" },
];
const COL_KEYS = COLS.map((c) => c.key);

const TIPO_OPTIONS = [{ value: "TS", label: "TS" }, { value: "Dreno", label: "Dreno" }];
const LADO_OPTIONS = [
  { value: "D", label: "D" }, { value: "E", label: "E" }, { value: "PT", label: "PT" },
];

export function QuickEntryGridTs({ rows, onRowsChange, existingNomenclaturas }: Props) {
  const displayRows = useMemo(() => {
    if (rows.length === 0 || hasAnyContent(rows[rows.length - 1])) {
      return [...rows, makeEmptyTsRow()];
    }
    return rows;
  }, [rows]);

  const errorsByRow = useMemo(
    () => displayRows.map((r) => (hasAnyContent(r) ? validateRowTs(r) : {})),
    [displayRows]
  );
  const crossErrors: CrossRowError[] = useMemo(
    () => validateCrossRowTs(displayRows.filter(hasAnyContent), existingNomenclaturas),
    [displayRows, existingNomenclaturas]
  );
  const crossErrorByRowId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ce of crossErrors) {
      for (const id of ce.rowIds) map.set(id, ce.message);
    }
    return map;
  }, [crossErrors]);

  const setCell = useCallback(
    (rowIdx: number, key: keyof TsRow, value: string) => {
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
      const next = distributePaste(displayRows, COL_KEYS, tsv, { row: rowIdx, col: colIdx }, makeEmptyTsRow);
      onRowsChange(stripTrailingBlanks(next));
    },
    [displayRows, onRowsChange]
  );

  const totalAreaTs = useMemo(
    () => displayRows
      .filter((r) => r.tipo === "TS")
      .reduce((s, r) => s + parseNumber(r.comprimento) * parseNumber(r.largura), 0),
    [displayRows]
  );
  const totalComprimentoDrenos = useMemo(
    () => displayRows
      .filter((r) => r.tipo === "Dreno")
      .reduce((s, r) => s + parseNumber(r.comprimento), 0),
    [displayRows]
  );

  return (
    <div className="space-y-2">
      {crossErrors.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          <strong>Erros de agrupamento:</strong>
          <ul className="list-disc pl-5">
            {crossErrors.map((ce, i) => <li key={i}>{ce.message}</li>)}
          </ul>
        </div>
      )}
      <div className="border rounded-md overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-muted sticky top-0">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} style={{ width: c.width }} className="text-left px-2 py-2 font-medium">{c.label}</th>
              ))}
              <th style={{ width: "90px" }}>Área (m²)</th>
              <th style={{ width: "40px" }}></th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => {
              const errs = errorsByRow[rowIdx];
              const area = parseNumber(row.comprimento) * parseNumber(row.largura);
              const crossMsg = crossErrorByRowId.get(row.id);
              return (
                <tr key={row.id} className="border-t" title={crossMsg}>
                  {COLS.map((c, colIdx) => (
                    <td key={c.key} className="p-0" onPaste={(e) => onPaste(e, rowIdx, colIdx)}>
                      {c.type === "select" ? (
                        <SelectCell
                          value={row[c.key] as string}
                          onChange={(v) => setCell(rowIdx, c.key, v)}
                          options={c.key === "tipo" ? TIPO_OPTIONS : LADO_OPTIONS}
                          error={errs[c.key as string] || (crossMsg && c.key === "nomenclatura" ? crossMsg : undefined)}
                        />
                      ) : (
                        <TextCell
                          value={row[c.key] as string}
                          onChange={(v) => setCell(rowIdx, c.key, v)}
                          error={errs[c.key as string] || (crossMsg && c.key === "nomenclatura" ? crossMsg : undefined)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-2 text-right text-muted-foreground bg-muted/30">
                    {area > 0 ? area.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                  </td>
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
              <td colSpan={COLS.length + 2} className="px-2 py-2 text-sm text-muted-foreground">
                Σ área TS = {totalAreaTs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m² ·
                Σ comprimento drenos = {totalComprimentoDrenos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function hasAnyContent(r: TsRow): boolean {
  return Boolean(r.data || r.tipo || r.nomenclatura || r.estaca || r.fracao || r.km || r.lado || r.comprimento || r.largura || r.espessura);
}

function stripTrailingBlanks(rows: TsRow[]): TsRow[] {
  let i = rows.length;
  while (i > 0 && !hasAnyContent(rows[i - 1])) i--;
  return rows.slice(0, i);
}
