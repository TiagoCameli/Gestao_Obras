import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Layers, Ruler } from "lucide-react";
import type { ContractItem, TrocaSoloData } from "../../types/activity";
import {
  calcTrocaSolo, LABELS, getCodeMap, type TsCategoria, type DrenoMedidas,
} from "../../utils/trocaSoloCalc";
import { normalizeCode } from "../../utils/contractTree";

const QTY_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

interface TrocaSoloFormProps {
  data: TrocaSoloData;
  onChange: (data: TrocaSoloData) => void;
  /** Itens do contrato da obra — usado para exibir a descrição real no preview. */
  contractItems?: ContractItem[];
}

export function TrocaSoloForm({ data, onChange, contractItems = [] }: TrocaSoloFormProps) {
  const temDreno = data.drenos.length > 0;

  const result = useMemo(
    () =>
      calcTrocaSolo(
        data.categoria,
        {
          comprimento: data.comprimento,
          largura: data.largura,
          espessura: data.espessura,
        },
        data.drenos
      ),
    [
      data.categoria,
      data.comprimento,
      data.largura,
      data.espessura,
      data.drenos,
    ]
  );

  const setCategoria = (categoria: TsCategoria) =>
    onChange({ ...data, categoria });
  const setField = (field: keyof TrocaSoloData, value: number) =>
    onChange({ ...data, [field]: value });

  const toggleDreno = (enable: boolean) => {
    if (enable && data.drenos.length === 0) {
      onChange({ ...data, drenos: [{ comprimento: 0, largura: 0, espessura: 0 }] });
    } else if (!enable) {
      onChange({ ...data, drenos: [] });
    }
  };

  const setDrenoCount = (n: number) => {
    const safe = Math.max(0, Math.floor(n));
    if (safe === data.drenos.length) return;
    if (safe < data.drenos.length) {
      onChange({ ...data, drenos: data.drenos.slice(0, safe) });
    } else {
      const more: DrenoMedidas[] = Array.from(
        { length: safe - data.drenos.length },
        () => ({ comprimento: 0, largura: 0, espessura: 0 })
      );
      onChange({ ...data, drenos: [...data.drenos, ...more] });
    }
  };

  const setDrenoField = (i: number, f: keyof DrenoMedidas, v: number) => {
    const next = data.drenos.map((d, idx) => (idx === i ? { ...d, [f]: v } : d));
    onChange({ ...data, drenos: next });
  };

  const contractNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const ci of contractItems) {
      if (!ci.code) continue;
      m.set(normalizeCode(ci.code), ci.name);
    }
    return m;
  }, [contractItems]);

  const catPalette =
    data.categoria === "passivo"
      ? { color: "var(--accent)", bg: "var(--accent-faint)", border: "var(--accent-border)" }
      : { color: "#c084fc", bg: "rgba(192,132,252,0.12)", border: "rgba(192,132,252,0.35)" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <Layers className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
        <span className="label-eyebrow">Memória de cálculo · Troca de Solo</span>
      </div>

      {/* Categoria */}
      <div style={{ marginBottom: 14 }}>
        <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
          Categoria contratual
        </label>
        <div className="flex gap-2">
          <CategoriaBtn
            active={data.categoria === "passivo"}
            onClick={() => setCategoria("passivo")}
            title="CONSERVAÇÃO CORRETIVA DE PASSIVO EXISTENTE"
            subtitle="Códigos 02.xx"
            tone="amber"
          />
          <CategoriaBtn
            active={data.categoria === "rotineira"}
            onClick={() => setCategoria("rotineira")}
            title="CONSERVAÇÃO CORRETIVA ROTINEIRA"
            subtitle="Códigos 03.xx"
            tone="purple"
          />
        </div>
      </div>

      {/* Medidas da TS */}
      <div style={{ marginBottom: 14 }}>
        <label className="label-eyebrow flex items-center gap-1.5" style={{ marginBottom: 6 }}>
          <Ruler className="h-3 w-3" />
          <span>Medidas da troca de solo (m) *</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <NumInput
            label="Comprimento"
            value={data.comprimento}
            onChange={(v) => setField("comprimento", v)}
          />
          <NumInput
            label="Largura"
            value={data.largura}
            onChange={(v) => setField("largura", v)}
          />
          <NumInput
            label="Espessura"
            value={data.espessura}
            onChange={(v) => setField("espessura", v)}
          />
        </div>
      </div>

      {/* Medidas da Capa Asfáltica */}
      <div style={{ marginBottom: 14 }}>
        <label className="label-eyebrow flex items-center gap-1.5" style={{ marginBottom: 6 }}>
          <Ruler className="h-3 w-3" />
          <span>Medidas da capa asfáltica (m) *</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <NumInput
            label="Comprimento"
            value={data.capaAsfaltica?.comprimento ?? 0}
            onChange={(v) =>
              onChange({
                ...data,
                capaAsfaltica: {
                  comprimento: v,
                  largura: data.capaAsfaltica?.largura ?? 0,
                  espessura: data.capaAsfaltica?.espessura ?? 0,
                },
              })
            }
          />
          <NumInput
            label="Largura"
            value={data.capaAsfaltica?.largura ?? 0}
            onChange={(v) =>
              onChange({
                ...data,
                capaAsfaltica: {
                  comprimento: data.capaAsfaltica?.comprimento ?? 0,
                  largura: v,
                  espessura: data.capaAsfaltica?.espessura ?? 0,
                },
              })
            }
          />
          <NumInput
            label="Espessura"
            value={data.capaAsfaltica?.espessura ?? 0}
            onChange={(v) =>
              onChange({
                ...data,
                capaAsfaltica: {
                  comprimento: data.capaAsfaltica?.comprimento ?? 0,
                  largura: data.capaAsfaltica?.largura ?? 0,
                  espessura: v,
                },
              })
            }
          />
        </div>
      </div>

      {/* Dreno toggle + list */}
      <div style={{ marginBottom: 14 }}>
        <label
          className="flex items-center gap-2"
          style={{ marginBottom: 8, fontSize: 12, color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={temDreno}
            onChange={(e) => toggleDreno(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          <span>Possui dreno associado?</span>
        </label>

        {temDreno && (
          <div
            style={{
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-md)",
              padding: 10,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span className="label-eyebrow" style={{ fontSize: 9 }}>
                Quantidade de drenos
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDrenoCount(data.drenos.length - 1)}
                  disabled={data.drenos.length <= 1}
                  className="btn-icon"
                  style={{ padding: 4 }}
                >
                  −
                </button>
                <span
                  className="font-mono"
                  style={{ fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: "center" }}
                >
                  {data.drenos.length}
                </span>
                <button
                  type="button"
                  onClick={() => setDrenoCount(data.drenos.length + 1)}
                  className="btn-icon"
                  style={{ padding: 4 }}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {data.drenos.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr 1fr 1fr auto",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <div
                    className="font-mono"
                    style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: "0 4px" }}
                  >
                    #{i + 1}
                  </div>
                  <NumInput
                    label="C (m)"
                    value={d.comprimento}
                    onChange={(v) => setDrenoField(i, "comprimento", v)}
                    compact
                  />
                  <NumInput
                    label="L (m)"
                    value={d.largura}
                    onChange={(v) => setDrenoField(i, "largura", v)}
                    compact
                  />
                  <NumInput
                    label="E (m)"
                    value={d.espessura}
                    onChange={(v) => setDrenoField(i, "espessura", v)}
                    compact
                  />
                  {data.drenos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange({
                          ...data,
                          drenos: data.drenos.filter((_, idx) => idx !== i),
                        });
                      }}
                      className="p-1 rounded-md"
                      style={{ color: "var(--text-faint)" }}
                      title="Remover dreno"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Classification summary */}
      {result.area > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: catPalette.bg,
            border: `1px solid ${catPalette.border}`,
            borderRadius: "var(--r-md)",
            marginBottom: 14,
          }}
        >
          <div className="font-mono" style={{ fontSize: 11, color: catPalette.color, fontWeight: 700 }}>
            {result.tipo}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Área {QTY_FMT.format(result.area)} m²
            {result.volDreno > 0 ? ` · Dreno ${QTY_FMT.format(result.volDreno)} m³` : ""}
          </div>
        </div>
      )}

      {/* Preview of generated quantities */}
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
                {buildPreviewRows(data.categoria, result.quantidades, contractNameByCode).map((r) => (
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
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function buildPreviewRows(
  categoria: TsCategoria,
  quantidades: Record<string, number>,
  contractNameByCode: Map<string, string>
): { code: string; label: string; qty: number }[] {
  const codeMap = getCodeMap();
  const rows: { code: string; label: string; qty: number; sortKey: string }[] = [];
  for (const [key, pair] of Object.entries(codeMap)) {
    const code = categoria === "passivo" ? pair.passivo : pair.rotineira;
    const qty = quantidades[code];
    if (!qty || qty <= 0) continue;
    const contractName = contractNameByCode.get(normalizeCode(code));
    rows.push({
      code,
      label: contractName ?? LABELS[key as keyof typeof LABELS] ?? key,
      qty,
      sortKey: code,
    });
  }
  // Natural sort by code
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

function CategoriaBtn({
  active, onClick, title, subtitle, tone,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  tone: "amber" | "purple";
}) {
  const toneColor =
    tone === "amber"
      ? { active: "var(--accent)", bg: "var(--accent-faint)", border: "var(--accent-border)" }
      : { active: "#c084fc", bg: "rgba(192,132,252,0.14)", border: "rgba(192,132,252,0.35)" };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1"
      style={{
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${active ? toneColor.border : "var(--border-subtle)"}`,
        background: active ? toneColor.bg : "var(--bg-sunken)",
        color: active ? toneColor.active : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 0.18s",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--text-muted)",
          marginTop: 4,
          fontFamily: "var(--font-mono)",
        }}
      >
        {subtitle}
      </div>
    </button>
  );
}

const DISPLAY_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function NumInput({
  label, value, onChange, compact = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  // Local draft string keeps commas, decimal points, and intermediate values
  // without being wiped by a number-only state on each keystroke.
  const [draft, setDraft] = useState(
    value === 0 ? "" : String(value).replace(".", ",")
  );

  useEffect(() => {
    if (!focused) {
      setDraft(value === 0 ? "" : String(value).replace(".", ","));
    }
  }, [value, focused]);

  const commit = () => {
    // Accept "1.234,56" or "1234,56" or "1234.56"
    const cleaned = draft
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const parsed = parseFloat(cleaned);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    // Cap to 4 decimal places
    onChange(Math.round(safe * 10000) / 10000);
    setFocused(false);
  };

  const display = focused
    ? draft
    : value === 0
    ? ""
    : DISPLAY_FMT.format(value);

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: compact ? 8.5 : 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 3,
        }}
      >
        {label}
      </label>
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
          // Allow digits, a single comma or dot, and minus sign
          const v = e.target.value.replace(/[^\d,.\-]/g, "");
          setDraft(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="0,00"
        className="input font-mono"
        style={{ fontSize: compact ? 12 : 13, padding: compact ? "6px 8px" : "8px 10px" }}
      />
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
