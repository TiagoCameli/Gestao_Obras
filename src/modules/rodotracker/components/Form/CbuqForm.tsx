import { useMemo, useState } from "react";
import { Plus, Trash2, Truck, FileSpreadsheet } from "lucide-react";
import type { CbuqCarga, CbuqData, ContractItem } from "../../types/activity";
import { calcCbuq, CBUQ_LABELS, getCbuqCodeMap } from "../../utils/cbuqCalc";
import { normalizeCode } from "../../utils/contractTree";
import { generateId, todayISO } from "../../utils/format";
import { CbuqImportModal } from "./CbuqImportModal";

const QTY_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const WEIGHT_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

interface CbuqFormProps {
  data: CbuqData;
  onChange: (data: CbuqData) => void;
  contractItems?: ContractItem[];
}

export function CbuqForm({ data, onChange, contractItems = [] }: CbuqFormProps) {
  const [showImport, setShowImport] = useState(false);

  const result = useMemo(() => calcCbuq((data.cargas ?? [])), [(data.cargas ?? [])]);

  const contractNameByCode = useMemo(() => {
    const m = new Map<string, number | string>();
    for (const ci of contractItems) {
      if (!ci.code) continue;
      m.set(normalizeCode(ci.code), ci.name);
    }
    return m as unknown as Map<string, string>;
  }, [contractItems]);

  const setCarga = (id: string, patch: Partial<CbuqCarga>) => {
    onChange({
      ...data,
      cargas: (data.cargas ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const addCarga = () => {
    const now = todayISO();
    const nova: CbuqCarga = {
      id: generateId(),
      data: now,
      placa: "",
      hora: "",
      pesoT: 0,
    };
    onChange({ ...data, cargas: [...(data.cargas ?? []), nova] });
  };

  const removeCarga = (id: string) => {
    onChange({ ...data, cargas: (data.cargas ?? []).filter((c) => c.id !== id) });
  };

  const importCargas = (novas: CbuqCarga[]) => {
    onChange({ ...data, cargas: [...(data.cargas ?? []), ...novas] });
    setShowImport(false);
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <div className="flex items-center gap-2">
          <Truck className="h-3.5 w-3.5" style={{ color: "#1e3a8a" }} />
          <span className="label-eyebrow">
            Cargas de CBUQ · Memória de cálculo
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="btn btn-ghost"
            style={{ padding: "6px 10px", fontSize: 11 }}
            title="Importar cargas via Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Importar
          </button>
          <button
            type="button"
            onClick={addCarga}
            className="btn"
            style={{
              padding: "6px 10px",
              fontSize: 11,
              background: "linear-gradient(180deg, rgba(30,58,138,0.22), rgba(30,58,138,0.08))",
              border: "1px solid rgba(30,58,138,0.45)",
              color: "#5aa7ff",
              fontWeight: 600,
            }}
            title="Adicionar uma carga"
          >
            <Plus className="h-3.5 w-3.5" />
            Carga
          </button>
        </div>
      </div>

      {/* Lista de cargas */}
      {(data.cargas ?? []).length > 0 ? (
        <div
          style={{
            background: "var(--bg-sunken)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: "auto 96px 112px 80px 120px auto",
              gap: 0,
              padding: "8px 10px",
              background: "rgba(13,16,23,0.8)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-hair)",
            }}
          >
            <span>#</span>
            <span>Data</span>
            <span>Placa *</span>
            <span>Hora</span>
            <span style={{ textAlign: "right" }}>Peso (t) *</span>
            <span />
          </div>
          {(data.cargas ?? []).map((c, i) => (
            <div
              key={c.id}
              className="grid"
              style={{
                gridTemplateColumns: "auto 96px 112px 80px 120px auto",
                gap: 6,
                padding: "6px 10px",
                alignItems: "center",
                borderTop: i === 0 ? "none" : "1px solid var(--border-hair)",
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  minWidth: 20,
                }}
              >
                {i + 1}
              </span>
              <input
                type="date"
                value={c.data ?? ""}
                onChange={(e) => setCarga(c.id, { data: e.target.value || undefined })}
                className="input font-mono"
                style={{ padding: "4px 6px", fontSize: 11 }}
              />
              <input
                type="text"
                placeholder="ABC1D23"
                value={c.placa}
                onChange={(e) => setCarga(c.id, { placa: e.target.value.toUpperCase() })}
                className="input font-mono"
                style={{
                  padding: "4px 6px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  ...(c.placa.trim() === "" ? { borderColor: "rgba(239,68,68,0.35)" } : {}),
                }}
              />
              <input
                type="time"
                value={c.hora ?? ""}
                onChange={(e) => setCarga(c.id, { hora: e.target.value || undefined })}
                className="input font-mono"
                style={{ padding: "4px 6px", fontSize: 11 }}
              />
              <PesoInput
                value={c.pesoT}
                onChange={(v) => setCarga(c.id, { pesoT: v })}
                invalid={c.pesoT <= 0}
              />
              <button
                type="button"
                onClick={() => removeCarga(c.id)}
                className="p-1 rounded-md"
                style={{ color: "var(--text-faint)" }}
                title="Remover carga"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "16px 12px",
            border: "1px dashed var(--border-subtle)",
            borderRadius: "var(--r-md)",
            textAlign: "center",
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 10,
          }}
        >
          Nenhuma carga registrada. Use <strong style={{ color: "#5aa7ff" }}>+ Carga</strong>{" "}
          ou <strong style={{ color: "#5aa7ff" }}>Importar</strong>.
        </div>
      )}

      {/* Totais */}
      {(data.cargas ?? []).length > 0 && (
        <div
          className="grid grid-cols-3 gap-2"
          style={{ marginBottom: 12 }}
        >
          <TotalBox
            label="Cargas"
            value={String((data.cargas ?? []).length)}
            accent="#5aa7ff"
          />
          <TotalBox
            label="Peso total"
            value={`${WEIGHT_FMT.format(result.totalPesoT)} t`}
            accent="#f59e0b"
          />
          <TotalBox
            label="Volume"
            value={`${WEIGHT_FMT.format(result.totalVolumeM3)} m³`}
            accent="#c084fc"
          />
        </div>
      )}

      {/* Preview dos quantitativos */}
      {Object.keys(result.quantidades).length > 0 && (
        <div>
          <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
            Quantitativos a lançar na medição
          </label>
          <div
            style={{
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-md)",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr
                  style={{
                    position: "sticky", top: 0,
                    background: "rgba(13,16,23,0.9)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <th style={thStyle}>Código</th>
                  <th style={thStyle}>Descrição</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Qtd</th>
                </tr>
              </thead>
              <tbody>
                {buildPreviewRows(result.quantidades, contractNameByCode).map((r) => (
                  <tr key={r.code} style={{ borderTop: "1px solid var(--border-hair)" }}>
                    <td className="font-mono" style={tdCode}>{r.code}</td>
                    <td style={tdDesc}>{r.label}</td>
                    <td className="font-mono" style={tdQty}>
                      {QTY_FMT.format(r.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              marginTop: 6,
              fontStyle: "italic",
            }}
          >
            Estes quantitativos serão somados à {data.medicaoNumber}ª medição do
            contrato quando a atividade for salva.
          </div>
        </div>
      )}

      {showImport && (
        <CbuqImportModal
          onImport={importCargas}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

function buildPreviewRows(
  quantidades: Record<string, number>,
  contractNameByCode: Map<string, string>
): { code: string; label: string; qty: number }[] {
  const codeMap = getCbuqCodeMap();
  const rows: { code: string; label: string; qty: number; sortKey: string }[] = [];
  for (const [key, code] of Object.entries(codeMap)) {
    const qty = quantidades[code];
    if (!qty || qty <= 0) continue;
    const contractName = contractNameByCode.get(normalizeCode(code));
    rows.push({
      code,
      label: contractName ?? CBUQ_LABELS[key as keyof typeof CBUQ_LABELS] ?? key,
      qty,
      sortKey: code,
    });
  }
  rows.sort((a, b) => {
    const pa = a.sortKey.split(".").map((p) => parseInt(p, 10));
    const pb = b.sortKey.split(".").map((p) => parseInt(p, 10));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = Number.isFinite(pa[i]) ? pa[i] : -1;
      const db = Number.isFinite(pb[i]) ? pb[i] : -1;
      if (da !== db) return da - db;
    }
    return 0;
  });
  return rows.map(({ sortKey: _s, ...rest }) => rest);
}

function TotalBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-sunken)",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        className="font-mono"
        style={{ fontSize: 14, fontWeight: 700, color: accent }}
      >
        {value}
      </div>
    </div>
  );
}

const DISPLAY_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function PesoInput({
  value,
  onChange,
  invalid,
}: {
  value: number;
  onChange: (v: number) => void;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(
    value === 0 ? "" : String(value).replace(".", ",")
  );

  const commit = () => {
    const cleaned = draft
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const parsed = parseFloat(cleaned);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    onChange(Math.round(safe * 1000) / 1000);
    setFocused(false);
  };

  const display = focused ? draft : value === 0 ? "" : DISPLAY_FMT.format(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value === 0 ? "" : String(value).replace(".", ","));
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d,.\-]/g, "");
        setDraft(v);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder="0,000"
      className="input font-mono"
      style={{
        padding: "4px 6px",
        fontSize: 11,
        textAlign: "right",
        ...(invalid ? { borderColor: "rgba(239,68,68,0.35)" } : {}),
      }}
    />
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
const tdCode: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 11,
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
};
const tdDesc: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 11,
  color: "var(--text-primary)",
};
const tdQty: React.CSSProperties = {
  padding: "5px 10px",
  textAlign: "right",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--success)",
  whiteSpace: "nowrap",
};
