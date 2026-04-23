import { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, RotateCcw, MapPin, Flag, Ruler } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Obra, TipoObra } from "../../types/activity";
import { TIPO_OBRA_OPTIONS, TIPOS_COM_KM } from "../../types/activity";
import { generateId } from "../../utils/format";

// Custom marker icons
const startIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const SATELLITE_URL = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";

interface ObraFormModalProps {
  editObra?: Obra | null;
  onSave: (obra: Obra) => void;
  onClose: () => void;
}

// Fetch route from OSRM
async function fetchRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<{ coordinates: [number, number][]; distanceKm: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    // OSRM returns [lng, lat], convert to [lat, lng]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]]
    );
    const distanceKm = route.distance / 1000;
    return { coordinates, distanceKm };
  } catch {
    return null;
  }
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [bounds, map]);
  return null;
}

export function ObraFormModal({ editObra, onSave, onClose }: ObraFormModalProps) {
  const [name, setName] = useState(editObra?.name ?? "");
  const [tipoObra, setTipoObra] = useState<TipoObra>(editObra?.tipoObra ?? "Manutenção de Rodovia");
  const [rodovia, setRodovia] = useState(editObra?.rodovia ?? "");
  const [lote, setLote] = useState(editObra?.lote ?? "");
  const [trecho, setTrecho] = useState(editObra?.trecho ?? "");
  const [contrato, setContrato] = useState(editObra?.contrato ?? "");
  const [kmInicial, setKmInicial] = useState<string>(editObra?.kmInicial != null ? String(editObra.kmInicial) : "");
  const [kmFinal, setKmFinal] = useState<string>(editObra?.kmFinal != null ? String(editObra.kmFinal) : "");

  const showKmFields = TIPOS_COM_KM.includes(tipoObra);
  const totalKm = kmInicial && kmFinal ? Math.abs(parseFloat(kmFinal) - parseFloat(kmInicial)) : null;

  const [startPoint, setStartPoint] = useState<[number, number] | null>(
    editObra?.startLat != null && editObra?.startLng != null
      ? [editObra.startLat, editObra.startLng]
      : null
  );
  const [endPoint, setEndPoint] = useState<[number, number] | null>(
    editObra?.endLat != null && editObra?.endLng != null
      ? [editObra.endLat, editObra.endLng]
      : null
  );
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(
    editObra?.routeGeoJson ?? null
  );
  const [extensionKm, setExtensionKm] = useState<number | null>(editObra?.extensionKm ?? null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  // Calculate bounds for fitting
  const fitBounds = useCallback((): L.LatLngBoundsExpression | null => {
    if (startPoint && endPoint) {
      return L.latLngBounds([startPoint, endPoint]);
    }
    return null;
  }, [startPoint, endPoint]);

  // Fetch route when both points are set
  useEffect(() => {
    if (!startPoint || !endPoint) {
      setRouteCoords(null);
      setExtensionKm(null);
      return;
    }
    setLoadingRoute(true);
    fetchRoute(startPoint[0], startPoint[1], endPoint[0], endPoint[1]).then((result) => {
      setLoadingRoute(false);
      if (result) {
        setRouteCoords(result.coordinates);
        setExtensionKm(Math.round(result.distanceKm * 100) / 100);
      } else {
        // Fallback: straight line
        setRouteCoords([startPoint, endPoint]);
        const d = L.latLng(startPoint).distanceTo(L.latLng(endPoint)) / 1000;
        setExtensionKm(Math.round(d * 100) / 100);
      }
    });
  }, [startPoint, endPoint]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!startPoint) {
        setStartPoint([lat, lng]);
      } else if (!endPoint) {
        setEndPoint([lat, lng]);
      }
    },
    [startPoint, endPoint]
  );

  const resetPoints = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteCoords(null);
    setExtensionKm(null);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Calculate center from route or points or fallback
    let centerLat = -13.5;
    let centerLng = -59.5;
    let zoom = 9;

    if (startPoint && endPoint) {
      centerLat = (startPoint[0] + endPoint[0]) / 2;
      centerLng = (startPoint[1] + endPoint[1]) / 2;
      // Estimate zoom based on distance
      const dist = L.latLng(startPoint).distanceTo(L.latLng(endPoint)) / 1000;
      if (dist > 200) zoom = 7;
      else if (dist > 100) zoom = 8;
      else if (dist > 50) zoom = 9;
      else if (dist > 20) zoom = 10;
      else zoom = 12;
    }

    const now = Date.now();
    onSave({
      id: editObra?.id ?? generateId(),
      name: name.trim(),
      tipoObra,
      rodovia: rodovia.trim(),
      lote: lote.trim(),
      trecho: trecho.trim(),
      contrato: contrato.trim(),
      kmInicial: showKmFields && kmInicial ? parseFloat(kmInicial) : null,
      kmFinal: showKmFields && kmFinal ? parseFloat(kmFinal) : null,
      centerLat,
      centerLng,
      zoom,
      startLat: startPoint?.[0] ?? null,
      startLng: startPoint?.[1] ?? null,
      endLat: endPoint?.[0] ?? null,
      endLng: endPoint?.[1] ?? null,
      routeGeoJson: routeCoords,
      extensionKm,
      createdAt: editObra?.createdAt ?? now,
      updatedAt: now,
    });
  };

  const mapStep = !startPoint ? "start" : !endPoint ? "end" : "done";

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-[#14161e] border border-white/[0.08] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-[#f1f5f9]">
            {editObra ? "Editar Obra" : "Nova Obra"}
          </h2>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#f1f5f9] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Row 1: Nome */}
          <div>
            <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">
              Nome da Obra *
            </label>
            <input
              type="text"
              placeholder="ex: Manutenção Rodoviária Lote 09"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#f1f5f9] placeholder:text-[#4a5568] focus:outline-none focus:border-[#f59e0b] transition-colors"
            />
          </div>

          {/* Tipo de Obra */}
          <div>
            <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">
              Tipo de Obra
            </label>
            <select
              value={tipoObra}
              onChange={(e) => setTipoObra(e.target.value as TipoObra)}
              className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#f59e0b] transition-colors"
            >
              {TIPO_OBRA_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* KM Inicial / Final (condicional) */}
          {showKmFields && (
            <div>
              <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">
                Extensão por KM
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#64748b] mb-1">KM Inicial</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="ex: 100"
                    value={kmInicial}
                    onChange={(e) => setKmInicial(e.target.value)}
                    className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2 text-xs font-mono text-[#f1f5f9] placeholder:text-[#4a5568] focus:outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#64748b] mb-1">KM Final</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="ex: 250"
                    value={kmFinal}
                    onChange={(e) => setKmFinal(e.target.value)}
                    className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2 text-xs font-mono text-[#f1f5f9] placeholder:text-[#4a5568] focus:outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#64748b] mb-1">Total</label>
                  <div className="bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2 text-xs font-mono text-[#f59e0b]">
                    {totalKm !== null ? `${totalKm.toFixed(1)} km` : "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Row 2: Rodovia + Lote + Contrato */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">Rodovia</label>
              <input
                type="text"
                placeholder="ex: BR-364"
                value={rodovia}
                onChange={(e) => setRodovia(e.target.value)}
                className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#f1f5f9] placeholder:text-[#4a5568] focus:outline-none focus:border-[#f59e0b] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">Lote</label>
              <input
                type="text"
                placeholder="ex: Lote 09"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#f1f5f9] placeholder:text-[#4a5568] focus:outline-none focus:border-[#f59e0b] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">Contrato</label>
              <input
                type="text"
                placeholder="ex: TT-001/2025"
                value={contrato}
                onChange={(e) => setContrato(e.target.value)}
                className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#f1f5f9] placeholder:text-[#4a5568] focus:outline-none focus:border-[#f59e0b] transition-colors"
              />
            </div>
          </div>

          {/* Trecho */}
          <div>
            <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">Trecho</label>
            <input
              type="text"
              placeholder="ex: Comodoro/MT — Vilhena/RO"
              value={trecho}
              onChange={(e) => setTrecho(e.target.value)}
              className="w-full bg-[#0c0e14] border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#f1f5f9] placeholder:text-[#4a5568] focus:outline-none focus:border-[#f59e0b] transition-colors"
            />
          </div>

          {/* Map section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold">
                Extensão da Obra (selecione no mapa)
              </label>
              {(startPoint || endPoint) && (
                <button
                  type="button"
                  onClick={resetPoints}
                  className="flex items-center gap-1 text-[11px] text-[#94a3b8] hover:text-[#f59e0b] transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Redefinir
                </button>
              )}
            </div>

            {/* Instruction bar */}
            <div
              className="flex items-center gap-2 rounded-t-[10px] px-3 py-2"
              style={{
                background: mapStep === "done" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                border: "1px solid",
                borderColor: mapStep === "done" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                borderBottom: "none",
              }}
            >
              {mapStep === "start" && (
                <>
                  <MapPin className="h-3.5 w-3.5 text-[#22c55e]" />
                  <span className="text-xs text-[#94a3b8]">
                    <span className="font-semibold text-[#22c55e]">1.</span> Clique no mapa para marcar o <span className="font-semibold text-[#22c55e]">ponto inicial</span>
                  </span>
                </>
              )}
              {mapStep === "end" && (
                <>
                  <Flag className="h-3.5 w-3.5 text-[#ef4444]" />
                  <span className="text-xs text-[#94a3b8]">
                    <span className="font-semibold text-[#ef4444]">2.</span> Clique para marcar o <span className="font-semibold text-[#ef4444]">ponto final</span>
                  </span>
                </>
              )}
              {mapStep === "done" && (
                <>
                  <Ruler className="h-3.5 w-3.5 text-[#22c55e]" />
                  <span className="text-xs text-[#94a3b8]">
                    Extensão total: <span className="font-mono font-bold text-[#22c55e]">{loadingRoute ? "calculando..." : `${extensionKm} km`}</span>
                  </span>
                </>
              )}
            </div>

            {/* Map */}
            <div className="rounded-b-[10px] overflow-hidden border border-white/[0.08] border-t-0" style={{ height: 320 }}>
              <MapContainer
                center={startPoint ?? [-13.5, -59.5]}
                zoom={editObra?.zoom ?? 6}
                maxZoom={22}
                className="w-full h-full"
                ref={mapRef}
                zoomControl={true}
                style={{ background: "#0c0e14" }}
              >
                <TileLayer
                  url={SATELLITE_URL}
                  maxNativeZoom={20}
                  maxZoom={22}
                />
                <ClickHandler onClick={handleMapClick} />
                <FitBounds bounds={fitBounds()} />

                {startPoint && (
                  <Marker position={startPoint} icon={startIcon} />
                )}
                {endPoint && (
                  <Marker position={endPoint} icon={endIcon} />
                )}
                {routeCoords && routeCoords.length > 1 && (
                  <Polyline
                    positions={routeCoords}
                    pathOptions={{
                      color: "#f59e0b",
                      weight: 4,
                      opacity: 0.9,
                      dashArray: undefined,
                    }}
                  />
                )}
              </MapContainer>
            </div>

            {/* Coordinates display */}
            {(startPoint || endPoint) && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                {startPoint && (
                  <div className="flex items-center gap-2 bg-[#0c0e14] rounded-lg px-3 py-2 border border-white/[0.06]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] shrink-0" />
                    <span className="text-[10px] font-mono text-[#94a3b8] truncate">
                      {startPoint[0].toFixed(5)}, {startPoint[1].toFixed(5)}
                    </span>
                  </div>
                )}
                {endPoint && (
                  <div className="flex items-center gap-2 bg-[#0c0e14] rounded-lg px-3 py-2 border border-white/[0.06]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shrink-0" />
                    <span className="text-[10px] font-mono text-[#94a3b8] truncate">
                      {endPoint[0].toFixed(5)}, {endPoint[1].toFixed(5)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 font-semibold rounded-[10px] py-3 transition-all active:scale-[0.98]"
            style={{
              background: "#f59e0b",
              color: "#000",
              fontSize: 14,
              boxShadow: "0 0 20px rgba(245,158,11,0.2)",
            }}
          >
            <Save className="h-4 w-4" />
            {editObra ? "Salvar Alterações" : "Cadastrar Obra"}
          </button>
        </form>
      </div>
    </div>
  );
}
