import { useMemo, useRef, useState } from "react";
import { X, Upload, Check, AlertTriangle, FileSpreadsheet, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import type { CbuqCarga } from "../../types/activity";
import { generateId } from "../../utils/format";
import { downloadCbuqTemplate } from "../../utils/cbuqTemplate";
import { useAuth } from "../../../../contexts/AuthContext";

type FieldKey = "data" | "placa" | "hora" | "peso";

interface FieldConfig {
  key: FieldKey;
  label: string;
  required: boolean;
  keywords: string[];
}

const FIELDS: FieldConfig[] = [
  { key: "data", label: "Data", required: false, keywords: ["data", "dia", "date"] },
  { key: "placa", label: "Placa", required: true, keywords: ["placa", "veiculo", "veículo", "caminhao", "caminhão"] },
  { key: "hora", label: "Hora", required: false, keywords: ["hora", "hor", "horario", "time"] },
  { key: "peso", label: "Peso (t)", required: true, keywords: ["peso", "ton", "toneladas", "weight", "liquido", "líquido"] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function autoMapColumns(headers: string[]): Record<FieldKey, number | null> {
  const map: Record<FieldKey, number | null> = {
    data: null, placa: null, hora: null, peso: null,
  };
  const norms = headers.map(normalize);
  for (const field of FIELDS) {
    for (const kw of field.keywords) {
      const idx = norms.findIndex((h) => h.includes(kw));
      if (idx >= 0) {
        map[field.key] = idx;
        break;
      }
    }
  }
  return map;
}

/** Parse a Brazilian/numeric weight string or number to a float (tons). */
function parsePeso(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).trim().replace(/\s/g, "");
  // Accept "28,500", "28.500,75", "28500" (kg fallback), "28.5"
  const cleaned = s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  // If the value looks like kg (>= 1000), convert to tons
  return n >= 1000 ? n / 1000 : n;
}

/** Parse excel/csv date cell into ISO YYYY-MM-DD. */
function parseData(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  // xlsx numeric serial
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = raw * 86400 * 1000;
    const d = new Date(epoch.getTime() + ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const br = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const y = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

/** Parse time cell to HH:mm. */
function parseHora(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  // Excel fractional time (0.5 → 12:00)
  if (typeof raw === "number" && raw >= 0 && raw < 1) {
    const totalMin = Math.round(raw * 24 * 60);
    const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
    const mm = (totalMin % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const s = String(raw).trim();
  const m = s.match(/(\d{1,2})[:hH](\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return undefined;
}

interface CbuqImportModalProps {
  onImport: (cargas: CbuqCarga[]) => void;
  onClose: () => void;
}

export function CbuqImportModal({ onImport, onClose }: CbuqImportModalProps) {
  const { temAcao } = useAuth();
  const canImportPerm = temAcao("importar_cbuq_medicao");
  if (!canImportPerm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
        <div className="bg-[#14161e] border border-white/[0.08] rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-[#f1f5f9] mb-3">Você não tem permissão para importar CBUQ.</p>
          <button onClick={onClose} className="text-xs text-[#94a3b8] hover:text-[#f1f5f9]">Fechar</button>
        </div>
      </div>
    );
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number | null>>({
    data: null, placa: null, hora: null, peso: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let workbook: XLSX.WorkBook;
      if (ext === "csv") {
        const text = await file.text();
        workbook = XLSX.read(text, { type: "string" });
      } else {
        const buf = await file.arrayBuffer();
        workbook = XLSX.read(buf, { type: "array", cellDates: false });
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      if (!aoa.length) {
        setError("A planilha está vazia.");
        return;
      }
      // Encontra a linha de header (primeira linha com > 1 célula preenchida)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(8, aoa.length); i++) {
        const filled = aoa[i].filter((c) => c !== "" && c != null).length;
        if (filled >= 2) { headerIdx = i; break; }
      }
      const hdr = aoa[headerIdx].map((c) => String(c ?? "").trim());
      const body = aoa
        .slice(headerIdx + 1)
        .filter((r) => r.some((c) => c !== "" && c != null));
      setHeaders(hdr);
      setRows(body);
      setMapping(autoMapColumns(hdr));
    } catch (err) {
      console.error(err);
      setError("Não foi possível ler a planilha. Verifique se o arquivo é válido.");
    }
  };

  const preview = useMemo<CbuqCarga[]>(() => {
    if (!rows.length) return [];
    const out: CbuqCarga[] = [];
    for (const r of rows) {
      const placaRaw = mapping.placa != null ? r[mapping.placa] : "";
      const pesoRaw = mapping.peso != null ? r[mapping.peso] : 0;
      const dataRaw = mapping.data != null ? r[mapping.data] : undefined;
      const horaRaw = mapping.hora != null ? r[mapping.hora] : undefined;

      const placa = String(placaRaw ?? "").trim().toUpperCase();
      const peso = parsePeso(pesoRaw);
      if (!placa || peso <= 0) continue;

      out.push({
        id: generateId(),
        placa,
        pesoT: Math.round(peso * 1000) / 1000,
        data: parseData(dataRaw),
        hora: parseHora(horaRaw),
      });
    }
    return out;
  }, [rows, mapping]);

  const totalPeso = preview.reduce((s, c) => s + c.pesoT, 0);

  const canImport = preview.length > 0;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: "rgba(3,5,9,0.80)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" style={{ color: "#5aa7ff" }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Importar cargas de CBUQ
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md"
            style={{ color: "var(--text-muted)" }}
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            style={{
              padding: 12,
              borderRadius: "var(--r-md)",
              border: "1px dashed var(--border-subtle)",
              background: "var(--bg-sunken)",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md"
                style={{
                  background: "rgba(30,58,138,0.12)",
                  border: "1px solid rgba(30,58,138,0.45)",
                  color: "#5aa7ff",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Upload className="h-4 w-4" />
                {fileName || "Selecionar planilha (.xlsx, .csv)"}
              </button>
              <button
                type="button"
                onClick={() => downloadCbuqTemplate()}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
                title="Baixar modelo de planilha (.xlsx)"
              >
                <FileDown className="h-4 w-4" />
                Modelo
              </button>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
              Colunas esperadas: <strong>Data</strong> · <strong>Placa</strong> · <strong>Hora</strong> · <strong>Peso (t)</strong>
            </div>
          </div>

          {error && (
            <div
              className="flex items-start gap-2"
              style={{
                padding: 10,
                borderRadius: "var(--r-md)",
                border: "1px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.08)",
                color: "#fca5a5",
                fontSize: 12,
              }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Mapeamento de colunas */}
          {headers.length > 0 && (
            <div>
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>
                Mapeamento das colunas
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3, display: "block" }}>
                      {f.label}
                      {f.required && <span style={{ color: "#ef4444" }}> *</span>}
                    </label>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                        setMapping((prev) => ({ ...prev, [f.key]: v }));
                      }}
                      className="input"
                      style={{ fontSize: 11, padding: "5px 8px", width: "100%" }}
                    >
                      <option value="">— não mapear —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `(coluna ${i + 1})`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 6 }}
              >
                <span className="label-eyebrow">Prévia ({preview.length} cargas)</span>
                <span
                  className="font-mono"
                  style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}
                >
                  {totalPeso.toFixed(3).replace(".", ",")} t no total
                </span>
              </div>
              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ position: "sticky", top: 0, background: "rgba(13,16,23,0.9)" }}>
                      <th style={thStyle}>Data</th>
                      <th style={thStyle}>Placa</th>
                      <th style={thStyle}>Hora</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Peso (t)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 200).map((c) => (
                      <tr
                        key={c.id}
                        style={{ borderTop: "1px solid var(--border-hair)" }}
                      >
                        <td className="font-mono" style={tdStyle}>{c.data ?? "—"}</td>
                        <td className="font-mono" style={tdStyle}>{c.placa}</td>
                        <td className="font-mono" style={tdStyle}>{c.hora ?? "—"}</td>
                        <td
                          className="font-mono"
                          style={{ ...tdStyle, textAlign: "right", color: "var(--accent)" }}
                        >
                          {c.pesoT.toFixed(3).replace(".", ",")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2"
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-sunken)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canImport}
            onClick={() => onImport(preview)}
            className="btn"
            style={{
              padding: "8px 14px",
              fontSize: 12,
              background: canImport
                ? "linear-gradient(180deg, rgba(30,58,138,0.28), rgba(30,58,138,0.14))"
                : "transparent",
              border: "1px solid rgba(30,58,138,0.6)",
              color: canImport ? "#fff" : "var(--text-faint)",
              fontWeight: 600,
              cursor: canImport ? "pointer" : "not-allowed",
            }}
          >
            <Check className="h-4 w-4" />
            Importar {preview.length > 0 ? `${preview.length} cargas` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "left",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};
const tdStyle: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 11,
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
};
