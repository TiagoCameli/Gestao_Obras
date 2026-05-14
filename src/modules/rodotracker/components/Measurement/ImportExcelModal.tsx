import { useEffect, useMemo, useRef, useState } from "react";
import { X, FileSpreadsheet, Upload, Check, ChevronDown, AlertTriangle, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import type { ContractItem } from "../../types/activity";
import { generateId } from "../../utils/format";
import { downloadContractTemplate } from "../../utils/contractTemplate";
import { useAuth } from "../../../../contexts/AuthContext";

type FieldKey = "type" | "code" | "name" | "unit" | "contractedQty" | "unitPrice" | "total";

interface FieldConfig {
  key: FieldKey;
  label: string;
  required: boolean;
  keywords: string[];
}

const FIELDS: FieldConfig[] = [
  { key: "type", label: "Tipo (Etapa / Subetapa / Item)", required: false, keywords: ["tipo", "nivel", "nível", "categ", "classe", "natur", "grupo", "t/i", "fase"] },
  { key: "code", label: "Código", required: false, keywords: ["código", "codigo", "cod", "sicro", "dnit", "ref"] },
  { key: "name", label: "Descrição", required: true, keywords: ["descri", "servi", "atividade", "nome", "objeto", "especifi"] },
  { key: "unit", label: "Unidade", required: false, keywords: ["unid", "und", "un", "medida"] },
  { key: "contractedQty", label: "Qtd. contratada", required: false, keywords: ["quant", "qtd", "qntd", "qtde", "contrat", "prevista"] },
  { key: "unitPrice", label: "Valor unitário", required: false, keywords: ["unit", "valor unit", "preço unit", "preco unit", "r$ unit", "custo unit"] },
  { key: "total", label: "R$ Total", required: false, keywords: ["total", "valor total", "r$ total", "subtotal", "preço total", "preco total"] },
];

type RowType = "etapa" | "subetapa" | "item" | "";

function parseRowType(raw: unknown): RowType {
  if (!raw) return "";
  const s = String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_\s]/g, "") // collapse spaces / hyphens / underscores
    .trim();
  if (!s) return "";
  // Disambiguate "sub*" words first so subetapa isn't swallowed by the etapa prefix
  if (s.startsWith("sub")) {
    if (s.startsWith("subitem") || s.startsWith("subitens")) return "item";
    // Any other sub* (subetapa / subetepa / subfase / subgrupo / subnivel…) → subetapa
    return "subetapa";
  }
  if (s.startsWith("etap") || s.startsWith("etep") || s === "1" || s === "e") return "etapa";
  if (s.startsWith("item") || s.startsWith("itens") || s === "2" || s === "i") return "item";
  return "";
}

interface ImportExcelModalProps {
  obraId: string;
  onCancel: () => void;
  onConfirm: (items: ContractItem[]) => void;
}

type Row = (string | number | null | undefined)[];

const QTY_FMT = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const CURRENCY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  // Brazilian format: 1.234,56 — strip thousand dots, swap decimal comma
  const cleaned = value
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove thousand separators
    .replace(",", ".");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectColumnMapping(headers: Row): Record<FieldKey, number | null> {
  const norm = headers.map((h) => normalizeHeader(h));
  const mapping: Record<FieldKey, number | null> = {
    type: null, code: null, name: null, unit: null, contractedQty: null, unitPrice: null, total: null,
  };
  for (const field of FIELDS) {
    let best: number | null = null;
    let bestScore = 0;
    norm.forEach((h, i) => {
      if (!h) return;
      let score = 0;
      for (const kw of field.keywords) {
        if (h.includes(normalizeHeader(kw))) score = Math.max(score, kw.length);
      }
      if (score > bestScore) { bestScore = score; best = i; }
    });
    mapping[field.key] = best;
  }
  return mapping;
}

export function ImportExcelModal({ obraId, onCancel, onConfirm }: ImportExcelModalProps) {
  const { temAcao } = useAuth();
  const canImport = temAcao("importar_contrato_medicao");
  if (!canImport) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
        <div className="bg-[#14161e] border border-white/[0.08] rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-[#f1f5f9] mb-3">Sem permissão para importar contrato.</p>
          <button onClick={onCancel} className="text-xs text-[#94a3b8] hover:text-[#f1f5f9]">Fechar</button>
        </div>
      </div>
    );
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [allSheetRows, setAllSheetRows] = useState<Record<string, Row[]>>({});
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Record<FieldKey, number | null>>({
    type: null, code: null, name: null, unit: null, contractedQty: null, unitPrice: null, total: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const currentRows: Row[] = selectedSheet ? allSheetRows[selectedSheet] ?? [] : [];

  const headers: Row = currentRows[headerRow] ?? [];
  const dataRows: Row[] = currentRows.slice(headerRow + 1);
  const numColumns = headers.length;

  const preview = useMemo(() => {
    // 1. Parse each data row according to the mapping
    const parsed = dataRows.map((r) => ({
      type: mapping.type != null ? parseRowType(r[mapping.type]) : ("" as RowType),
      code: mapping.code != null ? String(r[mapping.code] ?? "").trim() : "",
      name: mapping.name != null ? String(r[mapping.name] ?? "").trim() : "",
      unit: mapping.unit != null ? String(r[mapping.unit] ?? "").trim() : "",
      contractedQty: mapping.contractedQty != null ? parseNumber(r[mapping.contractedQty]) : 0,
      unitPrice: mapping.unitPrice != null ? parseNumber(r[mapping.unitPrice]) : 0,
      total: mapping.total != null ? parseNumber(r[mapping.total]) : 0,
    }));

    // 2. Keep rows with meaningful content (name, code, unit, qty, price, or total).
    const filled = parsed.filter(
      (r) =>
        r.name.length > 0 ||
        r.code.length > 0 ||
        r.unit.length > 0 ||
        r.contractedQty > 0 ||
        r.unitPrice > 0 ||
        r.total > 0
    );

    // 3. Fill in the type when missing — infer from the presence of values.
    //    Items carry qty/price/total; rows without measurable values are etapas.
    const withType = filled.map((r) => {
      if (r.type === "etapa" || r.type === "item") return r;
      const hasValue =
        r.contractedQty > 0 ||
        r.unitPrice > 0 ||
        r.total > 0 ||
        r.unit.length > 0;
      return { ...r, type: (hasValue ? "item" : "etapa") as RowType };
    });

    // 3b. Reconcile total with qty × unitPrice when the spreadsheet provides
    // an explicit total — items carry the total exactly. If the computed
    // qty × unitPrice drifts from total by more than 1 cent, adjust unitPrice
    // to restore the original total. Etapa rows ignore their total since
    // their value is recomputed from children.
    const reconciled = withType.map((r) => {
      if (r.type !== "item") return r;
      if (r.total <= 0) return r;
      const computed = r.contractedQty * r.unitPrice;
      if (Math.abs(computed - r.total) < 0.005) return r; // already matches
      if (r.contractedQty > 0) {
        return { ...r, unitPrice: r.total / r.contractedQty };
      }
      // No qty → treat as lump sum with qty = 1
      return { ...r, contractedQty: 1, unitPrice: r.total };
    });

    // 4. Auto-generate hierarchical codes for rows without one — walk top-down.
    //    Uses counters reset by each level change so codes nest correctly.
    //    Also deduplicates repeated codes: a second row with the same code
    //    becomes a child ("02.02" duplicate → "02.02.01") so etapa totals
    //    aren't inflated by accidental duplicates.
    let etapaIdx = 0;
    let subetapaIdx = 0;
    let itemIdx = 0;
    const seen = new Set<string>();
    const pickChildCode = (base: string) => {
      let n = 1;
      while (seen.has(`${base}.${n}`)) n += 1;
      return `${base}.${n}`;
    };

    return reconciled.map((r) => {
      let code = r.code;
      if (code) {
        if (seen.has(code)) {
          // Duplicate → treat as sub of itself so totals stay correct
          code = pickChildCode(code);
        }
        // Refresh counters based on the (possibly new) code
        const parts = code.split(".").filter(Boolean).map((p) => parseInt(p, 10));
        if (Number.isFinite(parts[0])) etapaIdx = parts[0];
        subetapaIdx = Number.isFinite(parts[1]) ? parts[1] : 0;
        itemIdx = Number.isFinite(parts[2]) ? parts[2] : 0;
      } else if (r.type === "etapa") {
        etapaIdx += 1;
        subetapaIdx = 0;
        itemIdx = 0;
        code = `${etapaIdx}`;
      } else if (r.type === "subetapa") {
        if (etapaIdx === 0) etapaIdx = 1;
        subetapaIdx += 1;
        itemIdx = 0;
        code = `${etapaIdx}.${subetapaIdx}`;
      } else {
        // item (default)
        if (etapaIdx === 0) etapaIdx = 1;
        if (subetapaIdx > 0) {
          itemIdx += 1;
          code = `${etapaIdx}.${subetapaIdx}.${itemIdx}`;
        } else {
          itemIdx += 1;
          code = `${etapaIdx}.${itemIdx}`;
        }
      }
      // Guarantee final uniqueness even among generated codes
      while (seen.has(code)) {
        code = pickChildCode(code);
      }
      seen.add(code);
      return { ...r, code };
    });
  }, [dataRows, mapping]);

  const missingRequired = FIELDS.filter((f) => f.required && mapping[f.key] == null);
  const canConfirm = missingRequired.length === 0 && preview.length > 0;

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      // CSV and delimited text files parse more reliably as text than as
      // raw bytes (SheetJS's binary detection can misread BOM + UTF-8 CSV).
      const isCsv = /\.csv$/i.test(file.name) || file.type.includes("csv");
      const wb = isCsv
        ? XLSX.read(await file.text(), { type: "string", cellDates: false })
        : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const names = wb.SheetNames;
      if (names.length === 0) {
        setError("Arquivo sem planilhas.");
        return;
      }
      const sheets: Record<string, Row[]> = {};
      for (const n of names) {
        sheets[n] = XLSX.utils.sheet_to_json<Row>(wb.Sheets[n], {
          header: 1,
          raw: true,
          defval: null,
          blankrows: false,
        }) as Row[];
      }
      setSheetNames(names);
      setAllSheetRows(sheets);
      setSelectedSheet(names[0]);
      setHeaderRow(0);
    } catch (err) {
      console.error(err);
      setError(
        "Erro ao ler o arquivo. Tente salvar novamente no Excel como .xlsx e repita."
      );
    }
  };

  // Re-detect mapping whenever headers change
  useEffect(() => {
    if (headers.length > 0) {
      setMapping(detectColumnMapping(headers));
    }
  }, [selectedSheet, headerRow, headers.length]);

  const handleConfirm = () => {
    const now = Date.now();
    const items: ContractItem[] = preview.map((r, idx) => {
      const safeName = r.name || (r.code ? `Item ${r.code}` : `Linha ${idx + 1}`);
      const type: "etapa" | "subetapa" | "item" =
        r.type === "etapa" ? "etapa" : r.type === "subetapa" ? "subetapa" : "item";
      const isAgg = type === "etapa" || type === "subetapa";
      return {
        id: generateId(),
        obraId,
        code: r.code || undefined,
        name: safeName,
        // Aggregators never carry unit/qty/price — their total comes from children.
        unit: isAgg ? "" : r.unit || "",
        contractedQty: isAgg ? 0 : r.contractedQty,
        unitPrice: isAgg ? 0 : r.unitPrice,
        type,
        createdAt: now,
        updatedAt: now,
      };
    });
    onConfirm(items);
  };

  const estimatedTotal = useMemo(
    () => preview.reduce((sum, r) => sum + r.contractedQty * r.unitPrice, 0),
    [preview]
  );

  return (
    <div
      className="fixed inset-0 z-[3500] flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: "rgba(3,5,9,0.8)", backdropFilter: "blur(10px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-hidden animate-slideUp flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.025), transparent 30%), var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-2xl)",
          boxShadow: "var(--shadow-4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "linear-gradient(180deg, rgba(24,29,40,0.95), rgba(24,29,40,0.82))",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: "linear-gradient(135deg, #2fd3a6, #22b590)",
                boxShadow: "0 0 0 1px rgba(47,211,166,0.5), 0 6px 18px -4px rgba(47,211,166,0.4)",
              }}
            >
              <FileSpreadsheet className="h-4 w-4" style={{ color: "#032a1e" }} />
            </div>
            <div>
              <div className="label-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>
                Importar contrato
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.015em" }}>
                Arquivo Excel / CSV
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto" style={{ padding: 24 }}>
          {!selectedSheet ? (
            <>
              <DropZone
                onSelectFile={handleFile}
                fileInputRef={fileInputRef}
                fileName={fileName}
              />
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Não tem um arquivo?
                </span>
                <button
                  type="button"
                  onClick={() => downloadContractTemplate()}
                  className="btn btn-ghost"
                  style={{ padding: "7px 14px", fontSize: 12 }}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Baixar modelo em branco
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              {/* File + sheet picker */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: "rgba(47,211,166,0.14)",
                      color: "var(--success)",
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="truncate"
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
                    >
                      {fileName}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {dataRows.length} linhas · {numColumns} colunas
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedSheet("");
                    setFileName("");
                    setAllSheetRows({});
                    setSheetNames([]);
                    setError(null);
                  }}
                  className="btn btn-ghost"
                  style={{ padding: "7px 12px", fontSize: 12 }}
                >
                  Escolher outro
                </button>
              </div>

              {/* Sheet + header row controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                    Planilha
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="input"
                      style={{ paddingRight: 32, appearance: "none" }}
                    >
                      {sheetNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <ChevronDown
                      className="h-4 w-4"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                    Linha do cabeçalho
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, currentRows.length)}
                    value={headerRow + 1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setHeaderRow(Math.max(0, (Number.isFinite(v) ? v : 1) - 1));
                    }}
                    className="input font-mono"
                  />
                </div>
              </div>

              {/* Column mapping */}
              <div>
                <label className="label-eyebrow" style={{ display: "block", marginBottom: 8 }}>
                  Mapeamento de colunas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FIELDS.map((field) => (
                    <ColumnMapper
                      key={field.key}
                      field={field}
                      headers={headers}
                      value={mapping[field.key]}
                      onChange={(v) => setMapping((m) => ({ ...m, [field.key]: v }))}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 8 }}
                >
                  <label className="label-eyebrow">
                    Pré-visualização · {preview.length} {preview.length === 1 ? "item" : "itens"}
                  </label>
                  {estimatedTotal > 0 && (
                    <span
                      className="font-mono"
                      style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}
                    >
                      Total: {CURRENCY.format(estimatedTotal)}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    background: "var(--bg-sunken)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--r-md)",
                    maxHeight: 260,
                    overflow: "auto",
                  }}
                >
                  {preview.length === 0 ? (
                    <div
                      style={{
                        padding: 20, textAlign: "center",
                        fontSize: 13, color: "var(--text-muted)",
                      }}
                    >
                      Nenhum item válido encontrado. Ajuste o mapeamento ou a linha de cabeçalho.
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr
                          style={{
                            position: "sticky", top: 0,
                            background: "rgba(13,16,23,0.95)",
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          <Th>Tipo</Th>
                          <Th>Código</Th>
                          <Th>Descrição</Th>
                          <Th>Unid.</Th>
                          <Th align="right">Qtd.</Th>
                          <Th align="right">R$ Unit.</Th>
                          <Th align="right">R$ Total</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 200).map((r, i) => (
                          <tr
                            key={i}
                            style={{ borderTop: "1px solid var(--border-hair)" }}
                          >
                            <Td>
                              {r.type ? (
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    padding: "2px 7px",
                                    borderRadius: 999,
                                    color:
                                      r.type === "etapa"
                                        ? "var(--accent)"
                                        : r.type === "subetapa"
                                        ? "#c084fc"
                                        : r.type === "item"
                                        ? "var(--info)"
                                        : "var(--success)",
                                    background:
                                      r.type === "etapa"
                                        ? "var(--accent-faint)"
                                        : r.type === "subetapa"
                                        ? "rgba(192,132,252,0.15)"
                                        : r.type === "item"
                                        ? "var(--info-dim)"
                                        : "var(--success-dim)",
                                  }}
                                >
                                  {r.type}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-faint)" }}>—</span>
                              )}
                            </Td>
                            <Td mono>{r.code || "—"}</Td>
                            <Td>{r.name}</Td>
                            <Td mono>{r.unit || "—"}</Td>
                            <Td mono align="right">{r.contractedQty > 0 ? QTY_FMT.format(r.contractedQty) : "—"}</Td>
                            <Td mono align="right">{r.unitPrice > 0 ? CURRENCY.format(r.unitPrice) : "—"}</Td>
                            <Td mono align="right" accent={r.contractedQty * r.unitPrice > 0}>
                              {r.contractedQty * r.unitPrice > 0
                                ? CURRENCY.format(r.contractedQty * r.unitPrice)
                                : "—"}
                            </Td>
                          </tr>
                        ))}
                        {preview.length > 200 && (
                          <tr>
                            <Td>{" "}</Td>
                            <Td>
                              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                                +{preview.length - 200} linhas ocultas (serão importadas)
                              </span>
                            </Td>
                            <Td>{" "}</Td><Td>{" "}</Td><Td>{" "}</Td><Td>{" "}</Td><Td>{" "}</Td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {missingRequired.length > 0 && (
                <div
                  className="flex items-center gap-2"
                  style={{
                    padding: "10px 14px",
                    background: "rgba(255, 176, 32, 0.08)",
                    border: "1px solid rgba(255, 176, 32, 0.25)",
                    borderRadius: "var(--r-md)",
                    color: "var(--accent)",
                    fontSize: 12,
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Mapeie as colunas obrigatórias: {missingRequired.map((f) => f.label).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "var(--danger-dim)",
                border: "1px solid rgba(255,90,114,0.3)",
                borderRadius: "var(--r-md)",
                color: "var(--danger)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-end gap-2"
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-subtle)",
            background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.3))",
          }}
        >
          <button onClick={onCancel} className="btn btn-ghost" style={{ fontSize: 13 }}>
            Cancelar
          </button>
          <button
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="btn btn-primary shimmer-wrap"
            style={{ fontSize: 13, opacity: canConfirm ? 1 : 0.5, pointerEvents: canConfirm ? "auto" : "none" }}
          >
            <Check className="h-4 w-4" />
            Importar {preview.length} {preview.length === 1 ? "item" : "itens"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DropZone({
  onSelectFile, fileInputRef, fileName,
}: {
  onSelectFile: (f: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  fileName: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files[0]) onSelectFile(e.dataTransfer.files[0]);
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      style={{
        borderRadius: "var(--r-lg)",
        border: `2px dashed ${isDragging ? "var(--success)" : "var(--border-subtle)"}`,
        background: isDragging ? "rgba(47,211,166,0.05)" : "rgba(255,255,255,0.012)",
        padding: "60px 24px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = "var(--success)";
          e.currentTarget.style.background = "rgba(47,211,166,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = "var(--border-subtle)";
          e.currentTarget.style.background = "rgba(255,255,255,0.012)";
        }
      }}
    >
      <div
        className="pulse-glow flex items-center justify-center mx-auto"
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(47,211,166,0.12)",
          border: "1px solid rgba(47,211,166,0.3)",
          marginBottom: 16,
        }}
      >
        <Upload className="h-7 w-7" style={{ color: "var(--success)" }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
        Arraste um arquivo Excel aqui
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
        ou clique para escolher — aceita <span className="font-mono">.xlsx</span>, <span className="font-mono">.xls</span>, <span className="font-mono">.csv</span>
      </div>
      {fileName && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }} className="font-mono">
          {fileName}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.[0]) onSelectFile(e.target.files[0]);
        }}
      />
    </div>
  );
}

function ColumnMapper({
  field, headers, value, onChange,
}: {
  field: FieldConfig;
  headers: Row;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label
        className="flex items-center gap-1"
        style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}
      >
        {field.label}
        {field.required && <span style={{ color: "var(--danger)" }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
          className="input"
          style={{ fontSize: 12, paddingRight: 32, appearance: "none" }}
        >
          <option value="">— Não mapear —</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {String(h ?? "").trim() || `Coluna ${i + 1}`}
            </option>
          ))}
        </select>
        <ChevronDown
          className="h-3.5 w-3.5"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
        />
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "8px 12px",
        textAlign: align,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children, mono = false, align = "left", accent = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
  align?: "left" | "right";
  accent?: boolean;
}) {
  return (
    <td
      className={mono ? "font-mono" : ""}
      style={{
        padding: "7px 12px",
        fontSize: 12,
        textAlign: align,
        color: accent ? "var(--success)" : "var(--text-primary)",
        fontWeight: accent ? 700 : 500,
      }}
    >
      {children}
    </td>
  );
}
