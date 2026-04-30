import { useEffect, useState } from "react";
import { X, MapPin, Calendar, Hash, FileText, Layers, Camera, Pencil, FolderOpen, Folder, Download, ChevronDown, ChevronRight, Eye } from "lucide-react";
import type { Activity, ContractItem, PhotoFolder } from "../../types/activity";
import { getAllPhotoIds, collectPhotoIds, isSegmentService } from "../../types/activity";
import L from "leaflet";
import { serviceColors } from "../../utils/colors";
import { formatDate, formatCoord } from "../../utils/format";
import { normalizeCode } from "../../utils/contractTree";
import { calcTrocaSolo } from "../../utils/trocaSoloCalc";
import { usePhotoDB } from "../../hooks/usePhotoDB";
import { usePdfDB } from "../../hooks/usePdfDB";
import { PhotoViewer } from "./PhotoViewer";
import { Tag } from "../UI/Tag";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/pdf";
  const binary = atob(body);
  const len = binary.length;
  const ua = new Uint8Array(len);
  for (let i = 0; i < len; i++) ua[i] = binary.charCodeAt(i);
  return new Blob([ua], { type: mime });
}

function openPdfInTab(_name: string, dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadPdfFile(name: string, dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function downloadPhoto(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function downloadAllPhotos(photoMap: Record<string, string>, ids: string[], prefix: string) {
  ids.forEach((pid, i) => {
    if (photoMap[pid]) {
      setTimeout(() => {
        downloadPhoto(photoMap[pid], `${prefix}_foto_${i + 1}.jpg`);
      }, i * 200);
    }
  });
}

interface ActivityDetailModalProps {
  activity: Activity;
  contractItems?: ContractItem[];
  onEdit: () => void;
  onClose: () => void;
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

export function ActivityDetailModal({ activity, contractItems = [], onEdit, onClose }: ActivityDetailModalProps) {
  const { getPhotos } = usePhotoDB();
  const { getPdfs } = usePdfDB();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [pdfData, setPdfData] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerFolder, setViewerFolder] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => collectFolderIds(activity.photoFolders ?? [])
  );
  const color = serviceColors[activity.service];
  const pdfs = activity.pdfs ?? [];

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const allIds = getAllPhotoIds(activity);

  useEffect(() => {
    if (allIds.length > 0) {
      getPhotos(allIds).then(setPhotos);
    }
  }, [activity, getPhotos]);

  // Recolhe todas as pastas quando muda de atividade (inclui subpastas).
  useEffect(() => {
    setCollapsedFolders(collectFolderIds(activity.photoFolders ?? []));
  }, [activity.id, activity.photoFolders]);

  useEffect(() => {
    if (pdfs.length === 0) return;
    getPdfs(pdfs.map((p) => p.id)).then(setPdfData);
  }, [activity, getPdfs, pdfs.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && viewerIndex === null) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, viewerIndex]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      style={{ background: "rgba(3,5,9,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-y-auto animate-slideUp rounded-t-2xl sm:rounded-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.025), transparent 30%), var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between sticky top-0 z-10 px-4 sm:px-6 py-3 sm:py-[18px]"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background:
              "linear-gradient(180deg, rgba(24,29,40,0.95), rgba(24,29,40,0.82))",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="rounded-full shrink-0"
                style={{
                  width: 10, height: 10,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}`,
                }}
              />
              <h2
                className="truncate"
                style={{
                  fontSize: 17, fontWeight: 700,
                  letterSpacing: "-0.015em",
                  color: "var(--text-primary)",
                }}
              >
                {activity.serviceName || activity.service}
              </h2>
            </div>
            {activity.serviceName && (
              <div
                className="truncate"
                style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 18, letterSpacing: "0.02em" }}
              >
                {activity.service}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
              {activity.km && (
                <Tag
                  label={
                    isSegmentService(activity.service) && activity.kmEnd
                      ? `${activity.km} → ${activity.kmEnd}`
                      : activity.km
                  }
                  color="#5aa7ff"
                  size="sm"
                  dot
                />
              )}
              {activity.lado && (
                <Tag
                  label={activity.lado === "Pista Toda" ? "Pista Toda" : `Lado ${activity.lado}`}
                  color={activity.lado === "Pista Toda" ? "#06b6d4" : "#f97316"}
                  size="sm"
                  dot
                />
              )}
              {activity.medicao !== null && (
                <Tag label={`Medição ${activity.medicao}`} color="#c084fc" size="sm" />
              )}
              {isSegmentService(activity.service) &&
                activity.latEnd != null &&
                activity.lngEnd != null &&
                (() => {
                  const a = L.latLng(activity.lat, activity.lng);
                  const b = L.latLng(activity.latEnd, activity.lngEnd);
                  const m = a.distanceTo(b);
                  const label =
                    m >= 1000
                      ? `${(m / 1000).toFixed(2).replace(".", ",")} km`
                      : `${m.toFixed(0)} m`;
                  return <Tag label={`Extensão ${label}`} color="#5aa7ff" size="sm" />;
                })()}
              {activity.cbuq && (activity.cbuq.cargas ?? []).length > 0 && (
                <Tag
                  label={`${(activity.cbuq.cargas ?? []).length} ${(activity.cbuq.cargas ?? []).length === 1 ? "carga" : "cargas"}`}
                  color="#f59e0b"
                  size="sm"
                />
              )}
              {allIds.length > 0 && (
                <Tag label={`${allIds.length} foto${allIds.length !== 1 ? "s" : ""}`} color="#2fd3a6" size="sm" />
              )}
              {(activity.pdfs?.length ?? 0) > 0 && (
                <Tag label={`${activity.pdfs!.length} PDF${activity.pdfs!.length !== 1 ? "s" : ""}`} color="#5aa7ff" size="sm" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-2 rounded-lg"
              style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent)";
                e.currentTarget.style.background = "var(--accent-faint)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg"
              style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Informações */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-[#5c6380] mb-3 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Informações
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-[#9198ad]">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {isSegmentService(activity.service) && activity.dateEnd
                    ? `${formatDate(activity.date)} → ${formatDate(activity.dateEnd)}`
                    : formatDate(activity.date)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#9198ad]">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-mono">
                  {isSegmentService(activity.service) && activity.kmEnd
                    ? `${activity.km || "—"} → ${activity.kmEnd}`
                    : activity.km || "—"}
                </span>
              </div>
              {isSegmentService(activity.service) && activity.latEnd != null && activity.lngEnd != null ? (
                <>
                  <div className="col-span-2 flex items-center gap-2 text-[#9198ad]">
                    <MapPin className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
                    <span className="text-[10px] uppercase tracking-wider text-[#5c6380]">
                      Início
                    </span>
                    <span className="font-mono text-xs">
                      {formatCoord(activity.lat)}, {formatCoord(activity.lng)}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 text-[#9198ad]">
                    <MapPin className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />
                    <span className="text-[10px] uppercase tracking-wider text-[#5c6380]">
                      Fim
                    </span>
                    <span className="font-mono text-xs">
                      {formatCoord(activity.latEnd)}, {formatCoord(activity.lngEnd)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex items-center gap-2 text-[#9198ad]">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">
                    {formatCoord(activity.lat)}, {formatCoord(activity.lng)}
                  </span>
                </div>
              )}
            </div>
            {/* Extensão do trecho CBUQ */}
            {isSegmentService(activity.service) &&
              activity.latEnd != null &&
              activity.lngEnd != null &&
              (() => {
                const a = L.latLng(activity.lat, activity.lng);
                const b = L.latLng(activity.latEnd, activity.lngEnd);
                const meters = a.distanceTo(b);
                const label =
                  meters >= 1000
                    ? `${(meters / 1000).toFixed(2).replace(".", ",")} km`
                    : `${meters.toFixed(0)} m`;
                return (
                  <div className="mt-3 flex items-center gap-2 bg-[#0f1117] rounded-lg px-3 py-2 border border-[#2e3345]">
                    <span className="text-xs text-[#5c6380]">Extensão em linha reta:</span>
                    <span className="text-xs font-mono" style={{ color: "#5aa7ff" }}>
                      {label}
                    </span>
                  </div>
                );
              })()}
            {(activity.areaRect?.corners?.length ?? 0) >= 3 && (() => {
              const corners = activity.areaRect!.corners;
              const p0 = L.latLng(corners[0][0], corners[0][1]);
              let area = 0;
              for (let i = 1; i < corners.length - 1; i++) {
                const p1 = L.latLng(corners[i][0], corners[i][1]);
                const p2 = L.latLng(corners[i + 1][0], corners[i + 1][1]);
                const a = p0.distanceTo(p1);
                const b = p1.distanceTo(p2);
                const c = p2.distanceTo(p0);
                const s = (a + b + c) / 2;
                area += Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
              }
              area = Math.round(area * 10) / 10;
              const label = area > 1000 ? `${(area / 1000).toFixed(1)} mil m²` : `${area.toFixed(1)} m²`;
              return (
                <div className="mt-3 flex items-center gap-2 bg-[#0f1117] rounded-lg px-3 py-2 border border-[#2e3345]">
                  <span className="text-xs text-[#5c6380]">Área do serviço:</span>
                  <span className="text-xs font-mono text-[#f59e0b]">{label}</span>
                </div>
              );
            })()}
            {activity.description && (
              <p className="mt-3 text-sm text-[#9198ad] bg-[#0f1117] rounded-lg p-3 border border-[#2e3345]">
                {activity.description}
              </p>
            )}
          </section>

          {/* CBUQ — aviso quando ainda não há cargas registradas */}
          {isSegmentService(activity.service) &&
            (!activity.cbuq || (activity.cbuq.cargas ?? []).length === 0) && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[#5c6380] mb-3 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Correção de Defeito (CBUQ)
                </h3>
                <div
                  className="bg-[#0f1117] rounded-lg border border-dashed border-[#2e3345] p-4 text-center"
                >
                  <div className="text-sm text-[#9198ad]">
                    Nenhuma carga registrada ainda.
                  </div>
                  <div className="text-[11px] text-[#5c6380] mt-1">
                    Clique em <span className="text-[#f59e0b]">Editar atividade</span>{" "}
                    para adicionar as cargas de CBUQ manualmente ou importar via Excel.
                  </div>
                </div>
              </section>
            )}

          {/* CBUQ — resumo das cargas e valor total */}
          {activity.cbuq && (activity.cbuq.cargas ?? []).length > 0 && (() => {
            const cbuq = activity.cbuq;
            const totalPeso = cbuq.cargas.reduce((s, c) => s + (c.pesoT || 0), 0);
            const totalVolume = totalPeso / 2.3840021874474;
            const priceByCode = new Map<string, number>();
            for (const ci of contractItems) {
              if (!ci.code) continue;
              priceByCode.set(normalizeCode(ci.code), ci.unitPrice || 0);
            }
            let total = 0;
            for (const [code, qty] of Object.entries(cbuq.contributions ?? {})) {
              total += (priceByCode.get(normalizeCode(code)) ?? 0) * qty;
            }
            return (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[#5c6380] mb-3 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Correção de Defeito (CBUQ)
                </h3>
                <div className="bg-[#0f1117] rounded-lg border border-[#2e3345] overflow-hidden">
                  <div className="p-3 border-b border-[#2e3345]">
                    <div className="text-[10px] uppercase tracking-wider text-[#5c6380] mb-2">
                      Totais
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <MedBox label="Cargas" value={String(cbuq.cargas.length)} accent="#5aa7ff" />
                      <MedBox
                        label="Peso total"
                        value={`${MEAS_FMT.format(totalPeso)} t`}
                        accent="#f59e0b"
                      />
                      <MedBox
                        label="Volume CBUQ"
                        value={`${MEAS_FMT.format(totalVolume)} m³`}
                        accent="#c084fc"
                      />
                    </div>
                  </div>

                  <div className="p-3 border-b border-[#2e3345]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#5c6380]">
                        Cargas registradas
                      </span>
                      <span className="text-[10px] font-mono text-[#9198ad]">
                        Medição {cbuq.medicaoNumber}ª
                      </span>
                    </div>
                    <div
                      className="space-y-1"
                      style={{ maxHeight: 220, overflowY: "auto" }}
                    >
                      {cbuq.cargas.map((c, i) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 text-[11px] font-mono text-[#9198ad] bg-[#070a10] rounded-md px-2 py-1.5 border border-[#2e3345]"
                        >
                          <span className="text-[#5c6380] font-bold" style={{ minWidth: 24 }}>
                            #{i + 1}
                          </span>
                          <span style={{ minWidth: 78 }}>
                            {c.data ? formatDate(c.data) : "—"}
                          </span>
                          <span className="text-[#e8eaf0]" style={{ minWidth: 90 }}>
                            {c.placa}
                          </span>
                          <span style={{ minWidth: 50 }}>{c.hora ?? "—"}</span>
                          <span className="ml-auto text-[#f59e0b]">
                            {MEAS_FMT.format(c.pesoT)} t
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="px-3 py-2.5 flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-wider text-[#5c6380]">
                        Valor total do serviço
                      </span>
                      <span className="font-mono font-bold text-[#2fd3a6] text-sm">
                        {BRL_FMT.format(total)}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Troca de Solo — resumo das medidas, drenos e valor total */}
          {activity.trocaSolo && (() => {
            const ts = activity.trocaSolo;
            const area = (ts.comprimento || 0) * (ts.largura || 0);
            const volTS = area * (ts.espessura || 0);
            const volDreno = ts.drenos.reduce(
              (s, d) =>
                s + (d.comprimento || 0) * (d.largura || 0) * (d.espessura || 0),
              0
            );
            const priceByCode = new Map<string, number>();
            for (const ci of contractItems) {
              if (!ci.code) continue;
              priceByCode.set(normalizeCode(ci.code), ci.unitPrice || 0);
            }
            const priceFor = (code: string) =>
              priceByCode.get(normalizeCode(code)) ?? 0;
            // Separa as contribuições da TS (sem drenos) das que vieram dos drenos.
            const tsOnly = calcTrocaSolo(
              ts.categoria,
              {
                comprimento: ts.comprimento,
                largura: ts.largura,
                espessura: ts.espessura,
              },
              []
            ).quantidades;
            const all = ts.contributions ?? {};
            let valorTS = 0;
            let valorDreno = 0;
            const codes = new Set([
              ...Object.keys(all),
              ...Object.keys(tsOnly),
            ]);
            for (const code of codes) {
              const price = priceFor(code);
              if (!price) continue;
              const tsQty = tsOnly[code] ?? 0;
              const allQty = all[code] ?? 0;
              valorTS += tsQty * price;
              valorDreno += Math.max(0, allQty - tsQty) * price;
            }
            const total = valorTS + valorDreno;
            return (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[#5c6380] mb-3 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Troca de Solo
                </h3>
                <div className="bg-[#0f1117] rounded-lg border border-[#2e3345] overflow-hidden">
                  {/* Medidas da TS */}
                  <div className="p-3 border-b border-[#2e3345]">
                    <div className="text-[10px] uppercase tracking-wider text-[#5c6380] mb-2">
                      Medidas da troca de solo
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <MedBox label="Compr." value={`${MEAS_FMT.format(ts.comprimento || 0)} m`} />
                      <MedBox label="Largura" value={`${MEAS_FMT.format(ts.largura || 0)} m`} />
                      <MedBox label="Espessura" value={`${MEAS_FMT.format(ts.espessura || 0)} m`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <MedBox label="Área" value={`${MEAS_FMT.format(area)} m²`} accent="#f59e0b" />
                      <MedBox label="Volume" value={`${MEAS_FMT.format(volTS)} m³`} accent="#f59e0b" />
                    </div>
                  </div>

                  {/* Drenos */}
                  {ts.drenos.length > 0 && (
                    <div className="p-3 border-b border-[#2e3345]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#5c6380]">
                          Drenos associados
                        </span>
                        <span className="text-[10px] font-mono text-[#9198ad]">
                          {ts.drenos.length} {ts.drenos.length === 1 ? "dreno" : "drenos"}
                          {" · "}Vol. total {MEAS_FMT.format(volDreno)} m³
                        </span>
                      </div>
                      <div className="space-y-1">
                        {ts.drenos.map((d, i) => {
                          const v = (d.comprimento || 0) * (d.largura || 0) * (d.espessura || 0);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-3 text-[11px] font-mono text-[#9198ad] bg-[#070a10] rounded-md px-2 py-1.5 border border-[#2e3345]"
                            >
                              <span className="text-[#5c6380] font-bold">#{i + 1}</span>
                              <span>C {MEAS_FMT.format(d.comprimento || 0)} m</span>
                              <span className="text-[#2e3345]">·</span>
                              <span>L {MEAS_FMT.format(d.largura || 0)} m</span>
                              <span className="text-[#2e3345]">·</span>
                              <span>E {MEAS_FMT.format(d.espessura || 0)} m</span>
                              <span className="ml-auto text-[#e8eaf0]">
                                {MEAS_FMT.format(v)} m³
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Classificação */}
                  <div className="p-3 flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-[#5c6380]">Categoria</span>
                    <span
                      className="font-mono font-bold"
                      style={{
                        color: ts.categoria === "passivo" ? "#f59e0b" : "#c084fc",
                      }}
                    >
                      {ts.categoria === "passivo" ? "PASSIVO" : "ROTINEIRA"}
                    </span>
                    <span className="text-[#2e3345]">·</span>
                    <span className="font-mono text-[#5c6380]">Medição</span>
                    <span className="font-mono font-bold text-[#e8eaf0]">
                      {ts.medicaoNumber}ª
                    </span>
                  </div>

                  {/* Valores — TS, drenos e total */}
                  {total > 0 && (
                    <div
                      className="grid border-t border-[#2e3345]"
                      style={{
                        gridTemplateColumns: valorDreno > 0 ? "1fr 1fr 1fr" : "1fr 1fr",
                      }}
                    >
                      <ValBox
                        label="Valor Troca de Solo"
                        value={BRL_FMT.format(valorTS)}
                        color="#f59e0b"
                      />
                      {valorDreno > 0 && (
                        <ValBox
                          label="Valor dos drenos"
                          value={BRL_FMT.format(valorDreno)}
                          color="#5aa7ff"
                          borderLeft
                        />
                      )}
                      <ValBox
                        label="Valor total"
                        value={BRL_FMT.format(total)}
                        color="#2fd3a6"
                        borderLeft
                      />
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Quantitativos (legado — só se não for Troca de Solo) */}
          {!activity.trocaSolo &&
            activity.quantities.length > 0 &&
            activity.quantities.some((q) => q.name || q.value) && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[#5c6380] mb-3 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Quantitativos
                </h3>
                <div className="space-y-1.5">
                  {activity.quantities
                    .filter((q) => q.name || q.value)
                    .map((q) => (
                      <div
                        key={q.id}
                        className="flex justify-between items-center bg-[#0f1117] rounded-lg px-3 py-2 border border-[#2e3345]"
                      >
                        <span className="text-sm text-[#e8eaf0]">{q.name}</span>
                        <span className="text-sm font-mono text-[#f59e0b]">{q.value}</span>
                      </div>
                    ))}
                </div>
              </section>
            )}

          {/* Fotos por pasta (recursivo — suporta subpastas) */}
          {activity.photoFolders?.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-[#5c6380] flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Fotos
                </h3>
                <button
                  onClick={() => downloadAllPhotos(photos, allIds, activity.service.replace(/[^a-zA-Z0-9]/g, "_"))}
                  className="flex items-center gap-1 text-[10px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
                >
                  <Download className="h-3 w-3" /> Baixar todas
                </button>
              </div>
              <div className="space-y-3">
                {activity.photoFolders.map((folder) => (
                  <FolderSection
                    key={folder.id}
                    folder={folder}
                    depth={0}
                    photos={photos}
                    collapsedFolders={collapsedFolders}
                    onToggle={toggleFolder}
                    onOpenPhoto={(folderId, index) => {
                      setViewerFolder(folderId);
                      setViewerIndex(index);
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Legacy flat photos (backward compat) */}
          {(!activity.photoFolders || activity.photoFolders.length === 0) && activity.photoIds?.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-[#5c6380] flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Fotos
                </h3>
                <button
                  onClick={() => downloadAllPhotos(photos, activity.photoIds, activity.service.replace(/[^a-zA-Z0-9]/g, "_"))}
                  className="flex items-center gap-1 text-[10px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
                >
                  <Download className="h-3 w-3" /> Baixar todas
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {activity.photoIds.map((pid, i) => (
                  <div
                    key={pid}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity bg-[#0f1117]"
                    onClick={() => {
                      if (photos[pid]) {
                        setViewerFolder(null);
                        setViewerIndex(i);
                      }
                    }}
                  >
                    {photos[pid] ? (
                      <img src={photos[pid]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5c6380] text-xs">...</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {/* Documentos PDF */}
          {pdfs.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-[#5c6380] mb-3 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Documentos
                <span className="text-[#5c6380] normal-case tracking-normal">({pdfs.length})</span>
              </h3>
              <div className="space-y-1.5">
                {pdfs.map((pdf) => {
                  const data = pdfData[pdf.id];
                  return (
                    <div
                      key={pdf.id}
                      className="flex items-center gap-3"
                      style={{
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--r-md)",
                      }}
                    >
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 36, height: 36,
                          borderRadius: 8,
                          background: "rgba(255, 90, 114, 0.12)",
                          border: "1px solid rgba(255, 90, 114, 0.2)",
                          color: "#ff5a72",
                        }}
                      >
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate"
                          style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
                        >
                          {pdf.name}
                        </div>
                        <div
                          className="font-mono"
                          style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}
                        >
                          {formatSize(pdf.size)}
                          {!data && <span style={{ color: "var(--text-faint)", marginLeft: 8 }}>carregando…</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => data && openPdfInTab(pdf.name, data)}
                          disabled={!data}
                          className="p-2 rounded-md"
                          style={{
                            color: data ? "var(--info)" : "var(--text-faint)",
                            background: "transparent",
                            transition: "all 0.2s",
                            cursor: data ? "pointer" : "not-allowed",
                          }}
                          onMouseEnter={(e) => {
                            if (data) e.currentTarget.style.background = "var(--info-dim)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                          title="Abrir"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => data && downloadPdfFile(pdf.name, data)}
                          disabled={!data}
                          className="p-2 rounded-md"
                          style={{
                            color: data ? "var(--accent)" : "var(--text-faint)",
                            background: "transparent",
                            transition: "all 0.2s",
                            cursor: data ? "pointer" : "not-allowed",
                          }}
                          onMouseEnter={(e) => {
                            if (data) e.currentTarget.style.background = "var(--accent-faint)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                          title="Baixar"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Edit button footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-subtle)",
            background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.25))",
            position: "sticky",
            bottom: 0,
          }}
        >
          <button onClick={onEdit} className="btn btn-primary shimmer-wrap w-full">
            <Pencil className="h-4 w-4" />
            Editar atividade
          </button>
        </div>
      </div>

      {viewerIndex !== null && (() => {
        let pids: string[];
        if (viewerFolder && activity.photoFolders?.length) {
          const folder = findFolderById(activity.photoFolders, viewerFolder);
          pids = folder?.photoIds ?? [];
        } else {
          pids = activity.photoIds ?? [];
        }
        const photoList = pids.filter((pid) => photos[pid]).map((pid) => photos[pid]);
        return photoList.length > 0 ? (
          <PhotoViewer
            photos={photoList}
            index={viewerIndex}
            onChangeIndex={setViewerIndex}
            onClose={() => { setViewerIndex(null); setViewerFolder(null); }}
          />
        ) : null;
      })()}
    </div>
  );
}

function collectFolderIds(folders: PhotoFolder[]): Set<string> {
  const set = new Set<string>();
  const walk = (list: PhotoFolder[]) => {
    for (const f of list) {
      set.add(f.id);
      if (f.subfolders?.length) walk(f.subfolders);
    }
  };
  walk(folders);
  return set;
}

function findFolderById(
  folders: PhotoFolder[],
  id: string
): PhotoFolder | undefined {
  for (const f of folders) {
    if (f.id === id) return f;
    if (f.subfolders?.length) {
      const hit = findFolderById(f.subfolders, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

interface FolderSectionProps {
  folder: PhotoFolder;
  depth: number;
  photos: Record<string, string>;
  collapsedFolders: Set<string>;
  onToggle: (id: string) => void;
  onOpenPhoto: (folderId: string, index: number) => void;
}

function FolderSection({
  folder,
  depth,
  photos,
  collapsedFolders,
  onToggle,
  onOpenPhoto,
}: FolderSectionProps) {
  const collapsed = collapsedFolders.has(folder.id);
  const totalCount = collectPhotoIds(folder).length;
  const hasSubfolders = (folder.subfolders?.length ?? 0) > 0;

  return (
    <div
      className="bg-[#0f1117] rounded-lg border border-[#2e3345] overflow-hidden"
      style={{ marginLeft: depth === 0 ? 0 : 12 }}
    >
      <button
        type="button"
        onClick={() => onToggle(folder.id)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-[#161820] hover:bg-[#1a1d27] transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-[#5c6380]" />
        ) : (
          <ChevronDown className="h-3 w-3 text-[#5c6380]" />
        )}
        {collapsed ? (
          <Folder className="h-3 w-3 text-[#f59e0b]" />
        ) : (
          <FolderOpen className="h-3 w-3 text-[#f59e0b]" />
        )}
        <span className="text-[11px] font-semibold text-[#e8eaf0] flex-1 text-left truncate">
          {folder.name}
          {hasSubfolders && (
            <span className="ml-1 text-[9px] text-[#5c6380] font-normal">
              ({folder.subfolders!.length})
            </span>
          )}
        </span>
        <span className="text-[10px] text-[#5c6380] font-mono">{totalCount}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            const ids = collectPhotoIds(folder);
            downloadAllPhotos(photos, ids, folder.name.replace(/[^a-zA-Z0-9]/g, "_"));
          }}
          className="p-0.5 text-[#5c6380] hover:text-[#3b82f6] transition-colors cursor-pointer"
          title={`Baixar fotos de ${folder.name}`}
        >
          <Download className="h-3 w-3" />
        </span>
      </button>
      {!collapsed && (
        <div className="p-2 space-y-2">
          {/* Subpastas (recursivas) */}
          {(folder.subfolders ?? []).map((sub) => (
            <FolderSection
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              photos={photos}
              collapsedFolders={collapsedFolders}
              onToggle={onToggle}
              onOpenPhoto={onOpenPhoto}
            />
          ))}
          {/* Grid de fotos desta pasta */}
          {folder.photoIds.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {folder.photoIds.map((pid, i) => (
                <div
                  key={pid}
                  className="aspect-square rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity bg-[#181b23]"
                  onClick={() => {
                    if (photos[pid]) onOpenPhoto(folder.id, i);
                  }}
                >
                  {photos[pid] ? (
                    <img src={photos[pid]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#5c6380] text-xs">...</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MedBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#070a10] rounded-md border border-[#2e3345] px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-[#5c6380]">{label}</div>
      <div
        className="font-mono font-bold text-[13px]"
        style={{ color: accent ?? "#e8eaf0" }}
      >
        {value}
      </div>
    </div>
  );
}

function ValBox({
  label,
  value,
  color,
  borderLeft,
}: {
  label: string;
  value: string;
  color: string;
  borderLeft?: boolean;
}) {
  return (
    <div
      className="px-3 py-2.5"
      style={{
        borderLeft: borderLeft ? "1px solid #2e3345" : undefined,
      }}
    >
      <div className="text-[9px] uppercase tracking-wider text-[#5c6380]">
        {label}
      </div>
      <div className="font-mono font-bold text-[13px]" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
