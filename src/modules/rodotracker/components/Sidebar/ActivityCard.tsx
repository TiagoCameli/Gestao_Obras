import { Trash2, Calendar, MapPin, Camera, FileText, Route } from "lucide-react";
import L from "leaflet";
import type { Activity, ContractItem } from "../../types/activity";
import { getTotalPhotoCount, isSegmentService } from "../../types/activity";
import { serviceColors } from "../../utils/colors";
import { formatDate } from "../../utils/format";
import { normalizeCode } from "../../utils/contractTree";
import { Tag } from "../UI/Tag";

interface ActivityCardProps {
  activity: Activity;
  contractItems?: ContractItem[];
  onClick: () => void;
  onDelete: () => void;
}

const BRL_FMT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});
const MEAS_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function ActivityCard({ activity, contractItems = [], onClick, onDelete }: ActivityCardProps) {
  const color = serviceColors[activity.service];
  const photoCount = getTotalPhotoCount(activity);
  const title = activity.serviceName || activity.service;

  const ts = activity.trocaSolo;
  const cbuq = activity.cbuq;
  const priceByCode = (() => {
    const m = new Map<string, number>();
    for (const ci of contractItems) {
      if (!ci.code) continue;
      m.set(normalizeCode(ci.code), ci.unitPrice || 0);
    }
    return m;
  })();
  const contribValue = (contrib: Record<string, number> | undefined) => {
    if (!contrib) return 0;
    let sum = 0;
    for (const [code, qty] of Object.entries(contrib)) {
      sum += (priceByCode.get(normalizeCode(code)) ?? 0) * qty;
    }
    return sum;
  };
  const tsTotal = contribValue(ts?.contributions);
  const cbuqTotal = contribValue(cbuq?.contributions);
  const cbuqPesoTotal = (cbuq?.cargas ?? []).reduce((s, c) => s + (c.pesoT || 0), 0);
  const cbuqVolumeTotal = cbuqPesoTotal / 2.3840021874474;

  const segmentExtLabel = (() => {
    if (!isSegmentService(activity.service)) return null;
    if (activity.latEnd == null || activity.lngEnd == null) return null;
    const a = L.latLng(activity.lat, activity.lng);
    const b = L.latLng(activity.latEnd, activity.lngEnd);
    const m = a.distanceTo(b);
    return m >= 1000
      ? `${(m / 1000).toFixed(2).replace(".", ",")} km`
      : `${m.toFixed(0)} m`;
  })();

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.008))",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-lg)",
        padding: "13px 14px 13px 18px",
        overflow: "hidden",
        transition: "transform 0.18s var(--ease-out), border-color 0.22s, box-shadow 0.22s, background 0.22s",
        isolation: "isolate",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateX(2px)";
        e.currentTarget.style.borderColor = "var(--border-default)";
        e.currentTarget.style.boxShadow = `0 6px 20px -8px ${color}33, var(--shadow-2)`;
        e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateX(0)";
        e.currentTarget.style.borderColor = "var(--border-subtle)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.008))";
      }}
    >
      {/* Left accent bar */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0, top: 8, bottom: 8, width: 3,
          background: `linear-gradient(180deg, ${color}, ${color}88)`,
          borderRadius: "0 2px 2px 0",
          boxShadow: `0 0 12px ${color}55`,
        }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2" style={{ marginBottom: 6 }}>
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.005em",
              lineHeight: 1.25,
            }}
          >
            {title}
          </div>
          {activity.serviceName && (
            <div
              className="truncate"
              style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1, letterSpacing: "0.02em" }}
            >
              {activity.service}
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-md"
          style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--danger)";
            e.currentTarget.style.background = "var(--danger-dim)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-faint)";
            e.currentTarget.style.background = "transparent";
          }}
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Meta row */}
      <div
        className="flex items-center gap-3"
        style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}
      >
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span className="font-mono">
            {isSegmentService(activity.service) && activity.dateEnd
              ? `${formatDate(activity.date)} → ${formatDate(activity.dateEnd)}`
              : formatDate(activity.date)}
          </span>
        </span>
        {activity.km && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
              {isSegmentService(activity.service) && activity.kmEnd
                ? `${activity.km} → ${activity.kmEnd}`
                : activity.km}
            </span>
          </span>
        )}
        {photoCount > 0 && (
          <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
            <Camera className="h-3 w-3" />
            <span className="font-mono">{photoCount}</span>
          </span>
        )}
        {(activity.pdfs?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#5aa7ff" }}>
            <FileText className="h-3 w-3" />
            <span className="font-mono">{activity.pdfs!.length}</span>
          </span>
        )}
        {segmentExtLabel && (
          <span className="flex items-center gap-1" style={{ color: "#5aa7ff" }}>
            <Route className="h-3 w-3" />
            <span className="font-mono">{segmentExtLabel}</span>
          </span>
        )}
      </div>

      {/* Tags */}
      {(activity.lado || activity.medicao !== null) && (
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 6 }}>
          {activity.lado && activity.lado !== "Pista Toda" && (
            <Tag label={`Lado ${activity.lado}`} color="#f97316" size="xs" variant="ghost" dot />
          )}
          {activity.lado === "Pista Toda" && (
            <Tag label="Pista Toda" color="#06b6d4" size="xs" variant="ghost" dot />
          )}
          {activity.medicao !== null && (
            <Tag label={`Med. ${activity.medicao}`} color="#c084fc" size="xs" variant="ghost" />
          )}
        </div>
      )}

      {/* CBUQ — cargas + peso + volume + valor total */}
      {cbuq && (cbuq.cargas ?? []).length > 0 ? (
        <div
          style={{
            paddingTop: 6,
            marginTop: 4,
            borderTop: "1px dashed var(--border-hair)",
          }}
        >
          <div
            className="grid gap-x-3 gap-y-0.5 font-mono"
            style={{
              gridTemplateColumns: "auto 1fr",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Cargas</span>
            <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>
              {(cbuq.cargas ?? []).length}
            </span>
            <span style={{ color: "var(--text-muted)" }}>Peso total</span>
            <span style={{ color: "#f59e0b", textAlign: "right", fontWeight: 600 }}>
              {MEAS_FMT.format(cbuqPesoTotal)} t
            </span>
            <span style={{ color: "var(--text-muted)" }}>Volume CBUQ</span>
            <span style={{ color: "#c084fc", textAlign: "right", fontWeight: 600 }}>
              {MEAS_FMT.format(cbuqVolumeTotal)} m³
            </span>
          </div>
          {cbuqTotal > 0 && (
            <div
              className="flex items-center justify-between"
              style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: "1px dashed var(--border-hair)",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Valor total
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}
              >
                {BRL_FMT.format(cbuqTotal)}
              </span>
            </div>
          )}
        </div>
      ) : isSegmentService(activity.service) ? (
        <div
          style={{
            paddingTop: 6,
            marginTop: 4,
            borderTop: "1px dashed var(--border-hair)",
            fontSize: 10,
            color: "var(--text-muted)",
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          Nenhuma carga registrada
        </div>
      ) : ts ? (
        <div
          style={{
            paddingTop: 6,
            marginTop: 4,
            borderTop: "1px dashed var(--border-hair)",
          }}
        >
          <div
            className="grid gap-x-3 gap-y-0.5 font-mono"
            style={{
              gridTemplateColumns: "auto 1fr",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Comprimento (m)</span>
            <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>
              {MEAS_FMT.format(ts.comprimento || 0)}
            </span>
            <span style={{ color: "var(--text-muted)" }}>Largura (m)</span>
            <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>
              {MEAS_FMT.format(ts.largura || 0)}
            </span>
            <span style={{ color: "var(--text-muted)" }}>Espessura (m)</span>
            <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>
              {MEAS_FMT.format(ts.espessura || 0)}
            </span>
            {ts.drenos.length > 0 && (
              <>
                <span style={{ color: "var(--text-muted)" }}>
                  Drenos ({ts.drenos.length})
                </span>
                <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>
                  {MEAS_FMT.format(
                    ts.drenos.reduce(
                      (s, d) =>
                        s + (d.comprimento || 0) * (d.largura || 0) * (d.espessura || 0),
                      0
                    )
                  )}{" "}
                  m³
                </span>
              </>
            )}
          </div>
          {tsTotal > 0 && (
            <div
              className="flex items-center justify-between"
              style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: "1px dashed var(--border-hair)",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Valor total
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}
              >
                {BRL_FMT.format(tsTotal)}
              </span>
            </div>
          )}
        </div>
      ) : (
        activity.quantities.length > 0 &&
        activity.quantities.some((q) => q.name && q.value) && (
          <div
            className="grid gap-x-3 gap-y-0.5 font-mono"
            style={{
              gridTemplateColumns: "auto 1fr",
              fontSize: 10,
              color: "var(--text-muted)",
              paddingTop: 6,
              marginTop: 4,
              borderTop: "1px dashed var(--border-hair)",
            }}
          >
            {activity.quantities
              .filter((q) => q.name && q.value)
              .slice(0, 3)
              .map((q) => (
                <span key={q.id} className="contents">
                  <span style={{ color: "var(--text-muted)" }}>{q.name}</span>
                  <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>
                    {q.value}
                  </span>
                </span>
              ))}
          </div>
        )
      )}
    </div>
  );
}
