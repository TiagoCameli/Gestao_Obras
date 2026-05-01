import { useState, useEffect, useCallback, useRef } from "react";
import { X, Save, MapPin, RotateCcw, RectangleHorizontal, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Activity, ContractItem, Quantity, ServiceType, LadoPista, AreaRect, Obra, TrocaSoloData, CbuqData, ConservaData } from "../../types/activity";
import { SERVICE_TYPES, LADO_PISTA_OPTIONS, SERVICES_WITH_AREA, isSegmentService, CONSERVA_CODE } from "../../types/activity";
import { calcTrocaSolo } from "../../utils/trocaSoloCalc";
import { calcCbuq } from "../../utils/cbuqCalc";
import { loadContractItems } from "../../utils/storage";
import { TrocaSoloForm } from "../Form/TrocaSoloForm";
import { CbuqForm } from "../Form/CbuqForm";
import FilterCombobox from "../../../../components/ui/FilterCombobox";
import { serviceColors } from "../../utils/colors";
import { generateId, todayISO } from "../../utils/format";
import { calcKmAlongRoute } from "../../utils/route";
import { usePhotoDB } from "../../hooks/usePhotoDB";
import { usePdfDB } from "../../hooks/usePdfDB";
import { CoordinateInput } from "../Form/CoordinateInput";
import { PhotoUpload, type FolderData } from "../Form/PhotoUpload";
import { PdfUpload, type PdfItem } from "../Form/PdfUpload";

const SATELLITE_URL = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";

/* ── Rectangle Drawing Sub-component ── */

function RectClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function FitToPoint({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (!didFit.current && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], 18);
      didFit.current = true;
    }
  }, [lat, lng, map]);
  return null;
}

const transparentIcon = L.divIcon({
  className: "",
  html: "",
  iconSize: [1, 1],
  iconAnchor: [0, 0],
});

function edgeDistance(a: [number, number], b: [number, number]): number {
  return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]));
}

function formatEdge(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(1)} m`;
}

function parseEdgeInput(val: string): number | null {
  const cleaned = val.replace(",", ".").replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Move corner B so that the distance from A to B equals newMeters,
 * keeping the same direction from A to B.
 */
function resizeEdge(
  a: [number, number],
  b: [number, number],
  newMeters: number
): [number, number] {
  const currentDist = edgeDistance(a, b);
  if (currentDist === 0) return b;
  const scale = newMeters / currentDist;
  return [
    a[0] + (b[0] - a[0]) * scale,
    a[1] + (b[1] - a[1]) * scale,
  ];
}

function EditableEdgeLabel({
  edgeIndex,
  cornerA,
  cornerB,
  manualValue,
  onResize,
}: {
  edgeIndex: number;
  cornerA: [number, number];
  cornerB: [number, number];
  manualValue?: number;
  onResize: (edgeIndex: number, newMeters: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const dist = manualValue ?? edgeDistance(cornerA, cornerB);
  const [inputVal, setInputVal] = useState("");
  const midLat = (cornerA[0] + cornerB[0]) / 2;
  const midLng = (cornerA[1] + cornerB[1]) / 2;

  const startEdit = () => {
    setInputVal(dist.toFixed(1));
    setEditing(true);
  };

  const commit = () => {
    const newDist = parseEdgeInput(inputVal);
    if (newDist !== null) {
      onResize(edgeIndex, newDist);
    }
    setEditing(false);
  };

  return (
    <Marker position={[midLat, midLng]} icon={transparentIcon}>
      <Tooltip
        direction="center"
        permanent
        interactive
        className="edge-label"
      >
        {editing ? (
          <div
            className="edge-label-edit"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={commit}
              autoFocus
              className="edge-input"
            />
            <span className="edge-unit">m</span>
          </div>
        ) : (
          <span onClick={startEdit} style={{ cursor: "pointer" }}>
            {formatEdge(dist)}
          </span>
        )}
      </Tooltip>
    </Marker>
  );
}

function makeCornerIcon(fillColor: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${fillColor};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);cursor:grab"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const originCoordIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:18px;height:18px">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(255,255,255,0.25);animation:pulse 2s infinite"></div>
    <div style="position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #0f1117;box-shadow:0 0 0 2px rgba(255,255,255,0.6),0 2px 6px rgba(0,0,0,0.5)"></div>
  </div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function DraggableCorner({
  position,
  index,
  icon,
  onDrag,
}: {
  position: [number, number];
  index: number;
  icon: L.DivIcon;
  onDrag: (index: number, lat: number, lng: number) => void;
}) {
  return (
    <Marker
      position={position}
      icon={icon}
      draggable
      eventHandlers={{
        dragend(e) {
          const latlng = e.target.getLatLng();
          onDrag(index, latlng.lat, latlng.lng);
        },
      }}
    />
  );
}

function AreaRectPicker({
  lat, lng, areaRect, onChange, color, otherActivities = [],
}: {
  lat: number;
  lng: number;
  areaRect: AreaRect | null;
  onChange: (rect: AreaRect | null) => void;
  color: string;
  otherActivities?: Activity[];
}) {
  const [corners, setCorners] = useState<[number, number][]>(
    areaRect?.corners ?? []
  );
  // Manual edge overrides: when user types a value, store it here for accurate area calc
  const [manualEdges, setManualEdges] = useState<Record<number, number>>({});

  const cornerIcon = useRef(makeCornerIcon(color)).current;

  const handleClick = useCallback((cLat: number, cLng: number) => {
    setCorners((prev) => {
      if (prev.length >= 4) return prev;
      const next = [...prev, [cLat, cLng] as [number, number]];
      if (next.length === 4) {
        onChange({ corners: next });
      } else {
        onChange(null);
      }
      return next;
    });
  }, [onChange]);

  const handleDrag = useCallback((index: number, cLat: number, cLng: number) => {
    setManualEdges({});
    setCorners((prev) => {
      const next = [...prev];
      next[index] = [cLat, cLng];
      if (next.length === 4) {
        onChange({ corners: next });
      }
      return next;
    });
  }, [onChange]);

  const handleEdgeResize = useCallback((edgeIndex: number, newMeters: number) => {
    // Also set the opposite edge's manual value
    const oppositeIndex = (edgeIndex + 2) % 4;
    setManualEdges((prev) => ({ ...prev, [edgeIndex]: newMeters, [oppositeIndex]: newMeters }));
    setCorners((prev) => {
      if (prev.length < 4) return prev;
      const next = [...prev];
      // Resize the clicked edge
      const aIdx = edgeIndex;
      const bIdx = (edgeIndex + 1) % 4;
      next[bIdx] = resizeEdge(next[aIdx], next[bIdx], newMeters);
      // Also resize the opposite edge to match
      const oaIdx = (edgeIndex + 2) % 4;
      const obIdx = (edgeIndex + 3) % 4;
      next[obIdx] = resizeEdge(next[oaIdx], next[obIdx], newMeters);
      onChange({ corners: next });
      return next;
    });
  }, [onChange]);

  const reset = () => {
    setCorners([]);
    setManualEdges({});
    onChange(null);
  };

  const count = corners.length;
  const done = count >= 4;

  const areaM2 = done ? (() => {
    const sides: number[] = [];
    for (let i = 0; i < 4; i++) {
      sides.push(manualEdges[i] ?? edgeDistance(corners[i], corners[(i + 1) % 4]));
    }
    // Average of opposite sides × average of other opposite sides
    const w = (sides[0] + sides[2]) / 2;
    const h = (sides[1] + sides[3]) / 2;
    return Math.round(w * h * 10) / 10;
  })() : null;

  const stepLabels = [
    "1º canto",
    "2º canto",
    "3º canto",
    "4º canto (último)",
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-[#9198ad] uppercase tracking-wider flex items-center gap-1.5">
          <RectangleHorizontal className="h-3.5 w-3.5" />
          Área do Serviço
        </label>
        {corners.length > 0 && (
          <button type="button" onClick={reset} className="flex items-center gap-1 text-[10px] text-[#9198ad] hover:text-[#f59e0b] transition-colors">
            <RotateCcw className="h-3 w-3" /> Redefinir
          </button>
        )}
      </div>

      {/* Instruction */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-1.5 text-[11px]"
        style={{
          background: done ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
          border: "1px solid",
          borderColor: done ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
          borderBottom: "none",
        }}
      >
        {!done && (
          <span className="text-[#94a3b8]">
            Clique no <span className="font-semibold text-[#f59e0b]">{stepLabels[count]}</span>
            <span className="text-[#5c6380] ml-1.5">({count}/4)</span>
          </span>
        )}
        {done && areaM2 !== null && (
          <span className="text-[#94a3b8]">
            Área: <span className="font-mono font-bold text-[#22c55e]">{areaM2 > 1000 ? `${(areaM2 / 1000).toFixed(1)} mil` : areaM2.toFixed(1)} m²</span>
            <span className="text-[#5c6380] ml-2">Arraste os pontos para ajustar</span>
          </span>
        )}
      </div>

      {/* Mini map */}
      <div className="rounded-b-lg overflow-hidden border border-[#2e3345] border-t-0" style={{ height: 240 }}>
        <MapContainer
          center={lat !== 0 ? [lat, lng] : [-13.5, -59.5]}
          zoom={18}
          maxZoom={22}
          className="w-full h-full"
          zoomControl={true}
          style={{ background: "#0f1117" }}
        >
          <TileLayer url={SATELLITE_URL} maxNativeZoom={20} maxZoom={22} />
          <FitToPoint lat={lat} lng={lng} />
          {!done && <RectClickHandler onClick={handleClick} />}

          {/* Other activities' service areas (to avoid overlap) */}
          {otherActivities.map((act) => {
            const otherColor = serviceColors[act.service];
            return (
              <Polygon
                key={`other-${act.id}`}
                positions={act.areaRect!.corners}
                pathOptions={{
                  color: otherColor,
                  weight: 1.5,
                  opacity: 0.7,
                  fillColor: otherColor,
                  fillOpacity: 0.15,
                  dashArray: "4 3",
                }}
              >
                <Tooltip direction="top" sticky opacity={0.9}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    {act.serviceName || act.service}
                  </div>
                  {act.km && (
                    <div style={{ fontSize: 10, opacity: 0.7 }}>{act.km}</div>
                  )}
                </Tooltip>
              </Polygon>
            );
          })}

          {/* Coordinate marked when registering the activity */}
          {lat !== 0 && lng !== 0 && (
            <Marker
              position={[lat, lng]}
              icon={originCoordIcon}
              interactive={false}
              zIndexOffset={-500}
            />
          )}

          {/* Draggable corner markers */}
          {corners.map((c, i) => (
            <DraggableCorner
              key={i}
              position={c}
              index={i}
              icon={cornerIcon}
              onDrag={handleDrag}
            />
          ))}

          {/* Polygon */}
          {corners.length >= 3 && (
            <Polygon
              positions={corners}
              pathOptions={{
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.25,
                dashArray: done ? undefined : "6 4",
              }}
            />
          )}

          {/* Editable edge dimension labels */}
          {corners.length >= 2 && corners.map((c, i) => {
            const next = corners[(i + 1) % corners.length];
            if (i >= corners.length - 1 && corners.length < 4) return null;
            return (
              <EditableEdgeLabel
                key={`edge-${i}`}
                edgeIndex={i}
                cornerA={c}
                cornerB={next}
                manualValue={manualEdges[i]}
                onResize={handleEdgeResize}
              />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

interface ActivityFormModalProps {
  lat: number;
  lng: number;
  hasMapCoords: boolean;
  /** Se true, o modal fica invisível (mas MONTADO) — usado durante picks no mapa. */
  hidden?: boolean;
  obra?: Obra;
  editActivity?: Activity | null;
  activities?: Activity[];
  onPickOnMap: () => void;
  onSave: (activity: Activity) => void;
  onClose: () => void;
}

export function ActivityFormModal({
  lat: initialLat,
  lng: initialLng,
  hasMapCoords,
  hidden = false,
  obra,
  editActivity,
  activities = [],
  onPickOnMap,
  onSave,
  onClose,
}: ActivityFormModalProps) {
  const { savePhoto, getPhotos } = usePhotoDB();
  const { savePdf, getPdfs, deletePdfs } = usePdfDB();

  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [latEnd, setLatEnd] = useState<number>(editActivity?.latEnd ?? 0);
  const [lngEnd, setLngEnd] = useState<number>(editActivity?.lngEnd ?? 0);
  const [service, setService] = useState<ServiceType>(editActivity?.service ?? SERVICE_TYPES[0]);
  const [serviceName, setServiceName] = useState(editActivity?.serviceName ?? "");
  const [date, setDate] = useState(editActivity?.date ?? todayISO());
  const [dateEnd, setDateEnd] = useState<string>(editActivity?.dateEnd ?? "");
  const [pickTarget, setPickTarget] = useState<"start" | "end" | "extra">("start");
  const [extraPoints, setExtraPoints] = useState<[number, number][]>(
    editActivity?.extraPoints ?? []
  );
  const [medicao, setMedicao] = useState<string>(
    editActivity?.medicao !== null && editActivity?.medicao !== undefined
      ? String(editActivity.medicao)
      : ""
  );
  const [km, setKm] = useState(editActivity?.km ?? "");
  const [kmEnd, setKmEnd] = useState<string>(editActivity?.kmEnd ?? "");
  const [lado, setLado] = useState<LadoPista>(editActivity?.lado ?? "Pista Toda");
  const [areaRect, setAreaRect] = useState<AreaRect | null>(editActivity?.areaRect ?? null);
  const [description, setDescription] = useState(editActivity?.description ?? "");
  const [trocaSolo, setTrocaSolo] = useState<TrocaSoloData>(
    editActivity?.trocaSolo ?? {
      categoria: "passivo",
      medicaoNumber: 1,
      comprimento: 0,
      largura: 0,
      espessura: 0,
      drenos: [],
      contributions: {},
    }
  );
  const [cbuq, setCbuq] = useState<CbuqData>(() => {
    const stored = editActivity?.cbuq;
    if (!stored) {
      return { medicaoNumber: 1, cargas: [], contributions: {} };
    }
    return {
      medicaoNumber: stored.medicaoNumber ?? 1,
      cargas: Array.isArray(stored.cargas) ? stored.cargas : [],
      contributions: stored.contributions ?? {},
    };
  });
  // Linhas de quantitativos para Sinalização Vertical: cada linha tem o
  // codigo do item de contrato + qtd inserida pelo operador.
  type SinalLinha = { uid: string; code: string; qtyStr: string };
  const [sinalLinhas, setSinalLinhas] = useState<SinalLinha[]>(() => {
    const stored = editActivity?.sinalizacaoVertical?.contributions;
    if (!stored || Object.keys(stored).length === 0) {
      return [{ uid: generateId(), code: "", qtyStr: "" }];
    }
    return Object.entries(stored).map(([code, qty]) => ({
      uid: generateId(),
      code,
      qtyStr: String(qty),
    }));
  });
  // Conserva: única qtd, sempre lançada no item 01.01 do contrato.
  const [conservaQtyStr, setConservaQtyStr] = useState<string>(() => {
    const q = editActivity?.conserva?.quantidade;
    return q !== undefined && q !== null ? String(q) : "";
  });
  const [quantities, setQuantities] = useState<Quantity[]>(
    editActivity?.quantities?.length
      ? editActivity.quantities
      : [{ id: generateId(), name: "", value: "" }]
  );
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);

  const [autoKm, setAutoKm] = useState(false);
  /** Impede double-submit enquanto os uploads/queries de fotos e Supabase rodam. */
  const [isSaving, setIsSaving] = useState(false);
  /** Erro detalhado do último save (mostrado num painel selecionável dentro do modal). */
  const [saveError, setSaveError] = useState<{
    title: string;
    message: string;
    raw: string;
  } | null>(null);

  const [contractItems, setContractItems] = useState<ContractItem[]>([]);
  useEffect(() => {
    let alive = true;
    if (!obra) {
      setContractItems([]);
      return;
    }
    loadContractItems(obra.id).then((list) => {
      if (alive) setContractItems(list);
    });
    return () => {
      alive = false;
    };
  }, [obra]);

  // Keep trocaSolo.medicaoNumber in sync with the form's "Nº Medição" field,
  // so the preview footer ("Xª medição") reflects whatever the user typed.
  useEffect(() => {
    const n = medicao ? parseInt(medicao, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return;
    setTrocaSolo((prev) => (prev.medicaoNumber === n ? prev : { ...prev, medicaoNumber: n }));
    setCbuq((prev) => (prev.medicaoNumber === n ? prev : { ...prev, medicaoNumber: n }));
  }, [medicao]);

  // Pre-fill default quantities for services that always use the same measurements.
  useEffect(() => {
    if (editActivity) return;
    const defaults: Record<string, string[]> = {
      "Troca de Solo": ["Comprimento (m)", "Largura (m)", "Profundidade (m)"],
    };
    const names = defaults[service];
    if (!names) return;
    setQuantities((prev) => {
      const isEmpty = prev.every((q) => !q.name && !q.value);
      if (!isEmpty) return prev;
      return names.map((name) => ({ id: generateId(), name, value: "" }));
    });
  }, [service, editActivity]);

  // Atualiza coords quando vem de um map-pick. Usa uma ref pra ler o
  // `pickTarget` corrente SEM re-disparar o efeito quando o usuário só
  // alterna entre os botões de pick. O efeito só roda quando as coords
  // (initialLat/initialLng) realmente mudam, ou seja, depois de um pick.
  const pickTargetRef = useRef<"start" | "end" | "extra">(pickTarget);
  pickTargetRef.current = pickTarget;
  useEffect(() => {
    if (!hasMapCoords) return;
    if (pickTargetRef.current === "end") {
      setLatEnd(initialLat);
      setLngEnd(initialLng);
    } else if (pickTargetRef.current === "extra") {
      setExtraPoints((prev) => [...prev, [initialLat, initialLng]]);
      // Volta o alvo padrão pra que próximos picks (ou drag do pin
      // principal) não dupliquem como extra.
      setPickTarget("start");
    } else {
      setLat(initialLat);
      setLng(initialLng);
    }
  }, [initialLat, initialLng, hasMapCoords]);

  // Auto-calculate KM along the route when START coordinates change
  useEffect(() => {
    if (editActivity) return;
    if (lat === 0 && lng === 0) return;
    if (!obra?.routeGeoJson || obra.routeGeoJson.length < 2) return;

    const result = calcKmAlongRoute(lat, lng, obra.routeGeoJson);
    if (result) {
      setKm(`km ${result.km.toFixed(1).replace(".", "+")}`);
      setAutoKm(true);
    }
  }, [lat, lng, obra, editActivity]);

  // Auto-calcula KM final quando a coordenada final muda (apenas CBUQ)
  useEffect(() => {
    if (editActivity) return;
    if (!isSegmentService(service)) return;
    if (latEnd === 0 && lngEnd === 0) return;
    if (!obra?.routeGeoJson || obra.routeGeoJson.length < 2) return;

    const result = calcKmAlongRoute(latEnd, lngEnd, obra.routeGeoJson);
    if (result) {
      setKmEnd(`km ${result.km.toFixed(1).replace(".", "+")}`);
    }
  }, [latEnd, lngEnd, obra, editActivity, service]);

  // CBUQ sempre força "Pista Toda"
  useEffect(() => {
    if (isSegmentService(service) && lado !== "Pista Toda") {
      setLado("Pista Toda");
    }
  }, [service, lado]);

  // Load existing photos when editing (recursive — preserva subpastas)
  useEffect(() => {
    if (!editActivity) return;

    type PfLike = {
      photoIds: string[];
      subfolders?: PfLike[];
    };
    const collectIds = (pf: PfLike): string[] => {
      const ids = [...(pf.photoIds ?? [])];
      for (const sub of pf.subfolders ?? []) {
        ids.push(...collectIds(sub));
      }
      return ids;
    };

    const allIds: string[] = [];
    for (const f of editActivity.photoFolders ?? []) {
      allIds.push(...collectIds(f));
    }
    const legacyIds =
      !editActivity.photoFolders?.length ? editActivity.photoIds ?? [] : [];
    allIds.push(...legacyIds);

    if (allIds.length === 0) return;

    getPhotos(allIds).then((map) => {
      const hydrate = (
        pf: NonNullable<typeof editActivity.photoFolders>[number]
      ): FolderData => ({
        id: pf.id,
        name: pf.name,
        photos: (pf.photoIds ?? [])
          .filter((pid) => map[pid])
          .map((pid) => ({ id: pid, data: map[pid] })),
        subfolders: pf.subfolders?.length ? pf.subfolders.map(hydrate) : undefined,
      });

      const hydratedFolders: FolderData[] = [];
      for (const f of editActivity.photoFolders ?? []) {
        hydratedFolders.push(hydrate(f));
      }
      if (legacyIds.length > 0) {
        hydratedFolders.push({
          id: generateId(),
          name: "Geral",
          photos: legacyIds
            .filter((pid) => map[pid])
            .map((pid) => ({ id: pid, data: map[pid] })),
        });
      }
      setFolders(hydratedFolders);
    });
  }, [editActivity, getPhotos]);

  // Load existing PDFs when editing
  useEffect(() => {
    if (!editActivity?.pdfs?.length) return;
    const meta = editActivity.pdfs;
    const ids = meta.map((p) => p.id);
    getPdfs(ids).then((map) => {
      setPdfs(
        meta
          .filter((p) => map[p.id])
          .map((p) => ({ id: p.id, name: p.name, size: p.size, data: map[p.id] }))
      );
    });
  }, [editActivity, getPdfs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return; // guarda contra double-click / Enter duplo

    // Conserva não tem localização exata — pular validação de coords.
    if (service !== "Conserva" && lat === 0 && lng === 0) {
      alert("Informe as coordenadas iniciais ou marque a localização no mapa.");
      return;
    }

    if (isSegmentService(service) && (latEnd === 0 && lngEnd === 0)) {
      alert("Informe também as coordenadas do ponto final do trecho.");
      return;
    }

    // Validate CBUQ cargas
    if (isSegmentService(service)) {
      for (let i = 0; i < cbuq.cargas.length; i++) {
        const c = cbuq.cargas[i];
        if (!c.placa.trim()) {
          alert(`A carga #${i + 1} precisa ter uma placa.`);
          return;
        }
        if (c.pesoT <= 0) {
          alert(`A carga #${i + 1} precisa ter um peso maior que zero (em toneladas).`);
          return;
        }
      }
    }

    // Validate Troca de Solo measurements
    if (service === "Troca de Solo") {
      const { comprimento, largura, espessura, drenos } = trocaSolo;
      if (comprimento <= 0 || largura <= 0 || espessura <= 0) {
        alert(
          "Preencha o comprimento, largura e espessura da troca de solo (em metros)."
        );
        return;
      }
      for (let i = 0; i < drenos.length; i++) {
        const d = drenos[i];
        if (d.comprimento <= 0 || d.largura <= 0 || d.espessura <= 0) {
          alert(
            `Preencha o comprimento, largura e espessura do dreno #${i + 1} (em metros).`
          );
          return;
        }
      }
    }

    setSaveError(null);
    setIsSaving(true);
    type PersistedFolder = {
      id: string;
      name: string;
      photoIds: string[];
      subfolders?: PersistedFolder[];
    };
    const allPhotoIds: string[] = [];
    const photoFolders: PersistedFolder[] = [];
    const pdfsMeta = [] as { id: string; name: string; size: number }[];
    try {
      // Mídia já persistida volta como signed URL (https://...) na hidratação;
      // só precisa subir o que ainda é dataURL base64 (foto/PDF novos).
      const isNewMedia = (data: string | undefined) =>
        typeof data === "string" && data.startsWith("data:");

      // Uploads em paralelo — fotos, subpastas e PDFs disparam juntos.
      const persistFolder = async (folder: FolderData): Promise<PersistedFolder> => {
        const photoIds: string[] = [];
        await Promise.all(
          folder.photos.map(async (p) => {
            if (isNewMedia(p.data)) {
              try {
                await savePhoto(p.id, p.data);
              } catch (err) {
                console.error("Falha no upload da foto", p.id, err);
                throw err;
              }
            }
            photoIds.push(p.id);
            allPhotoIds.push(p.id);
          })
        );
        const subfolders: PersistedFolder[] | undefined = folder.subfolders?.length
          ? await Promise.all(folder.subfolders.map(persistFolder))
          : undefined;
        return { id: folder.id, name: folder.name, photoIds, subfolders };
      };
      const persistedAll = await Promise.all(folders.map(persistFolder));
      photoFolders.push(...persistedAll);

      // PDFs: deleta removidos + sobe novos, tudo em paralelo.
      const keptPdfIds = new Set(pdfs.map((p) => p.id));
      const previousPdfIds = editActivity?.pdfs?.map((p) => p.id) ?? [];
      const removedPdfIds = previousPdfIds.filter((id) => !keptPdfIds.has(id));
      await Promise.all([
        removedPdfIds.length > 0 ? deletePdfs(removedPdfIds) : Promise.resolve(),
        ...pdfs.map(async (p) => {
          if (isNewMedia(p.data)) {
            try {
              await savePdf(p.id, p.data);
            } catch (err) {
              console.error("Falha no upload do PDF", p.id, err);
              throw err;
            }
          }
          pdfsMeta.push({ id: p.id, name: p.name, size: p.size });
        }),
      ]);
    } catch (e) {
      console.error("Falha ao salvar mídia:", e);
      setIsSaving(false);
      // Extrai o máximo de info possível: mensagem, status code, statusCode do supabase, error name.
      const errAny = e as { message?: string; status?: number; statusCode?: number; name?: string; error?: string };
      const message =
        errAny?.message ||
        errAny?.error ||
        (e instanceof Error ? e.message : String(e)) ||
        "Erro desconhecido";
      const statusBits = [
        errAny?.status ? `HTTP ${errAny.status}` : null,
        errAny?.statusCode ? `code ${errAny.statusCode}` : null,
        errAny?.name && errAny.name !== "Error" ? errAny.name : null,
      ].filter(Boolean).join(" · ");
      let raw: string;
      try {
        raw = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
      } catch {
        raw = String(e);
      }
      setSaveError({
        title: "Falha ao salvar fotos/PDFs",
        message: statusBits ? `${message}\n\n${statusBits}` : message,
        raw,
      });
      return;
    }

    const now = Date.now();

    // Compute CBUQ contributions (quantities fed into the contract)
    let cbuqData: CbuqData | undefined;
    if (isSegmentService(service)) {
      const result = calcCbuq(cbuq.cargas);
      const medNum = medicao ? parseInt(medicao, 10) : NaN;
      cbuqData = {
        ...cbuq,
        medicaoNumber:
          Number.isFinite(medNum) && medNum > 0 ? medNum : cbuq.medicaoNumber,
        contributions: result.quantidades,
      };
    }

    // Compute Troca de Solo contributions (quantities fed into the contract)
    let tsData: TrocaSoloData | undefined;
    if (service === "Troca de Solo") {
      const result = calcTrocaSolo(
        trocaSolo.categoria,
        {
          comprimento: trocaSolo.comprimento,
          largura: trocaSolo.largura,
          espessura: trocaSolo.espessura,
        },
        trocaSolo.drenos
      );
      const medNum = medicao ? parseInt(medicao, 10) : NaN;
      tsData = {
        ...trocaSolo,
        medicaoNumber:
          Number.isFinite(medNum) && medNum > 0
            ? medNum
            : trocaSolo.medicaoNumber,
        contributions: result.quantidades,
      };
    }

    // Compute Sinalização Vertical contributions
    let sinalData: Activity["sinalizacaoVertical"] | undefined;
    if (service === "Sinalização") {
      const contributions: Record<string, number> = {};
      for (const l of sinalLinhas) {
        if (!l.code) continue;
        const q = parseFloat(l.qtyStr);
        if (!Number.isFinite(q) || q <= 0) continue;
        contributions[l.code] = (contributions[l.code] ?? 0) + q;
      }
      const medNum = medicao ? parseInt(medicao, 10) : NaN;
      sinalData = {
        medicaoNumber: Number.isFinite(medNum) && medNum > 0 ? medNum : 1,
        contributions,
      };
    }

    // Compute Conserva contributions — sempre amarrado ao item 01.01.
    let conservaData: ConservaData | undefined;
    if (service === "Conserva") {
      const q = parseFloat(conservaQtyStr);
      const qty = Number.isFinite(q) && q > 0 ? q : 0;
      const medNum = medicao ? parseInt(medicao, 10) : NaN;
      conservaData = {
        medicaoNumber: Number.isFinite(medNum) && medNum > 0 ? medNum : 1,
        quantidade: qty,
        contributions: qty > 0 ? { [CONSERVA_CODE]: qty } : {},
      };
    }

    const segment = isSegmentService(service);
    // Conserva não tem ponto fixo — usa o centro da obra como representativo
    // pra satisfazer NOT NULL na coluna lat/lng. O marker fica oculto no mapa.
    const isConserva = service === "Conserva";
    const finalLat = isConserva && (lat === 0 || !Number.isFinite(lat)) ? (obra?.centerLat ?? 0) : lat;
    const finalLng = isConserva && (lng === 0 || !Number.isFinite(lng)) ? (obra?.centerLng ?? 0) : lng;

    const activity: Activity = {
      id: editActivity?.id ?? generateId(),
      lat: finalLat,
      lng: finalLng,
      latEnd: segment ? latEnd : undefined,
      lngEnd: segment ? lngEnd : undefined,
      service,
      serviceName: serviceName.trim() || undefined,
      trocaSolo: tsData,
      cbuq: cbuqData,
      sinalizacaoVertical: sinalData,
      conserva: conservaData,
      extraPoints:
        service === "Sinalização" && extraPoints.length > 0
          ? extraPoints
          : undefined,
      date,
      dateEnd: segment ? dateEnd || undefined : undefined,
      medicao: medicao ? parseInt(medicao, 10) : null,
      km,
      kmEnd: segment ? kmEnd || undefined : undefined,
      lado: segment ? "Pista Toda" : lado,
      areaRect: SERVICES_WITH_AREA.includes(service) ? areaRect : null,
      description,
      quantities: quantities.filter((q) => q.name || q.value),
      photoIds: allPhotoIds,
      photoFolders,
      pdfs: pdfsMeta,
      createdAt: editActivity?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(activity);
  };

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      style={{
        background: "rgba(3,5,9,0.75)",
        backdropFilter: "blur(8px)",
        // Durante picks no mapa o overlay fica escondido (display:none) pra
        // permitir que o clique chegue até o mapa, mas o componente continua
        // montado preservando todo o estado do formulário.
        display: hidden ? "none" : undefined,
      }}
      // Fechamento apenas pelo botão "X" / "Salvar" — clicar fora NÃO fecha
      // mais (evita perda acidental do form enquanto o usuário preenche).
    >
      <div
        className="w-full max-w-5xl max-h-[96vh] sm:max-h-[94vh] overflow-y-auto animate-slideUp rounded-t-2xl sm:rounded-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.025), transparent 30%), var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-4)",
        }}
      >
        <div
          className="flex items-center justify-between sticky top-0 z-10 px-4 sm:px-7 py-3 sm:py-[18px]"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background:
              "linear-gradient(180deg, rgba(24,29,40,0.95), rgba(24,29,40,0.8))",
            backdropFilter: "blur(12px)",
          }}
        >
          <div>
            <div className="label-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>
              {editActivity ? "Edição" : "Registro"}
            </div>
            <h2
              style={{
                fontSize: 18, fontWeight: 700,
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
                lineHeight: 1.1,
              }}
            >
              {editActivity ? "Editar atividade" : "Nova atividade"}
            </h2>
          </div>
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

        <form
          onSubmit={handleSubmit}
          className="space-y-4 sm:space-y-5 px-4 sm:px-8 py-5 sm:py-7"
        >
          {saveError && (
            <div
              role="alert"
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(217, 45, 32, 0.10)",
                border: "1px solid rgba(217, 45, 32, 0.35)",
                color: "#fda29b",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    {saveError.title}
                  </div>
                  <pre
                    style={{
                      fontSize: 12,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "var(--font-mono, ui-monospace)",
                      margin: 0,
                      userSelect: "text",
                    }}
                  >
                    {saveError.message}
                  </pre>
                  <details style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>
                    <summary style={{ cursor: "pointer" }}>Detalhes técnicos</summary>
                    <pre
                      style={{
                        marginTop: 6,
                        padding: 8,
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: 6,
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        userSelect: "text",
                        maxHeight: 200,
                        overflow: "auto",
                      }}
                    >
                      {saveError.raw}
                    </pre>
                  </details>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${saveError.title}\n${saveError.message}\n\n${saveError.raw}`);
                    }}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.06)",
                      color: "#fda29b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                    }}
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveError(null)}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "transparent",
                      color: "#fda29b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Serviço — PRIMEIRA pergunta */}
          <div>
            <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
              Tipo de Serviço
            </label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value as ServiceType)}
              className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] focus:outline-none focus:border-[#f59e0b] transition-colors"
            >
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="mt-1 flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: serviceColors[service] }}
              />
              <span className="text-[10px] text-[#5c6380]">
                {isSegmentService(service)
                  ? "Atividade com trecho — início e fim ao longo da rodovia"
                  : "Cor do marcador"}
              </span>
            </div>
          </div>

          {/* Localização — ponto único ou trecho (CBUQ); oculta para Conserva */}
          {service !== "Conserva" && (isSegmentService(service) ? (
            <div>
              <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-2">
                Trecho do serviço
              </label>

              {/* Início */}
              <div
                style={{
                  padding: 12,
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--border-subtle)",
                  background: "rgba(59,130,246,0.05)",
                  marginBottom: 10,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  <span className="text-[10px] uppercase tracking-wider text-[#9198ad] font-semibold">
                    Ponto inicial
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CoordinateInput label="Latitude" value={lat} onChange={setLat} />
                  <CoordinateInput label="Longitude" value={lng} onChange={setLng} />
                </div>
                <button
                  type="button"
                  onClick={() => { setPickTarget("start"); onPickOnMap(); }}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1f2230] hover:bg-[#2a2d3d] border border-[#2e3345] hover:border-[#22c55e] rounded-lg py-2 text-xs text-[#9198ad] hover:text-[#22c55e] transition-all"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Marcar Início no Mapa
                </button>
              </div>

              {/* Fim */}
              <div
                style={{
                  padding: 12,
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--border-subtle)",
                  background: "rgba(239,68,68,0.05)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                  <span className="text-[10px] uppercase tracking-wider text-[#9198ad] font-semibold">
                    Ponto final
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CoordinateInput label="Latitude" value={latEnd} onChange={setLatEnd} />
                  <CoordinateInput label="Longitude" value={lngEnd} onChange={setLngEnd} />
                </div>
                <button
                  type="button"
                  onClick={() => { setPickTarget("end"); onPickOnMap(); }}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1f2230] hover:bg-[#2a2d3d] border border-[#2e3345] hover:border-[#ef4444] rounded-lg py-2 text-xs text-[#9198ad] hover:text-[#ef4444] transition-all"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Marcar Fim no Mapa
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-2">
                Localização
              </label>

              {/* Coordenadas manuais */}
              <div className="grid grid-cols-2 gap-3">
                <CoordinateInput label="Latitude" value={lat} onChange={setLat} />
                <CoordinateInput label="Longitude" value={lng} onChange={setLng} />
              </div>

              {/* Separador + botão mapa */}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-px bg-[#2e3345]" />
                <span className="text-[10px] text-[#5c6380] uppercase">ou</span>
                <div className="flex-1 h-px bg-[#2e3345]" />
              </div>

              <button
                type="button"
                onClick={() => { setPickTarget("start"); onPickOnMap(); }}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-[#1f2230] hover:bg-[#2a2d3d] border border-[#2e3345] hover:border-[#f59e0b] rounded-lg py-2.5 text-sm text-[#9198ad] hover:text-[#f59e0b] transition-all"
              >
                <MapPin className="h-4 w-4" />
                Marcar no Mapa
              </button>

              {hasMapCoords && lat !== 0 && lng !== 0 && (
                <div className="mt-2 flex items-center gap-2 text-[10px] text-[#22c55e]">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  Localização marcada no mapa
                </div>
              )}
            </div>
          ))}

          {/* Aviso para Conserva — sem localização exata */}
          {service === "Conserva" && (
            <div className="rounded-xl border border-[#84cc16]/25 bg-[#84cc16]/[0.04] p-4">
              <h3 className="text-sm font-semibold tracking-tight text-[#bef264]">
                Atividade contínua
              </h3>
              <p className="text-[11px] text-[#9198ad] mt-1">
                Conserva é executada o mês inteiro nas bordas da pista, sem
                localização exata. Não aparece como pin no mapa — entra
                apenas na medição via item <span className="font-mono">{CONSERVA_CODE}</span>.
              </p>
            </div>
          )}

          {/* Locais extras — exclusivo Sinalização (várias placas no mesmo registro) */}
          {service === "Sinalização" && (
            <div className="rounded-xl border border-[#eab308]/25 bg-[#eab308]/[0.04] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-[#fde68a]">
                    Locais marcados
                  </h3>
                  <p className="text-[11px] text-[#9198ad] mt-0.5">
                    Use o pin principal acima para o 1º local. Adicione outros
                    locais abaixo — cada um vira um pin no mapa nesta atividade.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPickTarget("extra"); onPickOnMap(); }}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-[#eab308]/40 text-[#fde68a] hover:bg-[#eab308]/10 transition-colors"
                >
                  + Adicionar local no mapa
                </button>
              </div>

              {extraPoints.length === 0 ? (
                <p className="text-[11px] text-[#5c6380] italic">
                  Nenhum local extra adicionado.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {extraPoints.map((pt, idx) => (
                    <li
                      key={`${idx}-${pt[0]}-${pt[1]}`}
                      className="flex items-center justify-between gap-3 text-xs bg-[#0f1117] border border-[#2e3345] rounded-md px-3 py-2"
                    >
                      <span className="font-mono text-[#e8eaf0] tabular-nums">
                        #{idx + 2} · {pt[0].toFixed(6)}, {pt[1].toFixed(6)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExtraPoints((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[#f97066] hover:underline text-[11px]"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Nome do Serviço (opcional) */}
          <div>
            <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
              Nome do Serviço <span className="text-[#5c6380] normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="ex: Remendo trecho crítico KM 645"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors"
            />
          </div>

          {/* Data — simples (ponto) ou intervalo (CBUQ) */}
          {isSegmentService(service) ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
                  Data final
                </label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
                  Nº Medição
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="—"
                  value={medicao}
                  onChange={(e) => setMedicao(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
                  Nº Medição
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="—"
                  value={medicao}
                  onChange={(e) => setMedicao(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
            </div>
          )}

          {/* KM — simples ou intervalo (CBUQ); oculto em Conserva */}
          {service !== "Conserva" && (isSegmentService(service) ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
                  KM inicial
                </label>
                <input
                  type="text"
                  placeholder="ex: km 142+300"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
                  KM final
                </label>
                <input
                  type="text"
                  placeholder="ex: km 142+800"
                  value={kmEnd}
                  onChange={(e) => setKmEnd(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-[#9198ad] uppercase tracking-wider">
                  KM / Estaca
                </label>
                {autoKm && (
                  <span className="text-[10px] text-[#22c55e] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] inline-block" />
                    Calculado automaticamente
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="ex: km 142+300"
                value={km}
                onChange={(e) => { setKm(e.target.value); setAutoKm(false); }}
                className={`w-full bg-[#0f1117] border rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors ${autoKm ? "border-[#22c55e]/30" : "border-[#2e3345]"}`}
              />
            </div>
          ))}

          {/* Lado da Pista — oculto em CBUQ (sempre "Pista Toda") e Conserva */}
          {!isSegmentService(service) && service !== "Conserva" && (
            <div>
              <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-2">
                Lado da Pista
              </label>
              <div className="flex gap-2">
                {LADO_PISTA_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLado(option)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      lado === option
                        ? "bg-[#f59e0b] text-[#0f1117] border-[#f59e0b]"
                        : "bg-[#0f1117] text-[#9198ad] border-[#2e3345] hover:border-[#5c6380]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Área do Serviço (retângulo no mapa) */}
          {SERVICES_WITH_AREA.includes(service) && (
            <AreaRectPicker
              lat={lat}
              lng={lng}
              areaRect={areaRect}
              onChange={setAreaRect}
              color={serviceColors[service]}
              otherActivities={activities.filter(
                (a) => a.id !== editActivity?.id && (a.areaRect?.corners?.length ?? 0) >= 3
              )}
            />
          )}

          {/* Memória de cálculo — exclusivo Troca de Solo */}
          {service === "Troca de Solo" && (
            <TrocaSoloForm data={trocaSolo} onChange={setTrocaSolo} contractItems={contractItems} />
          )}

          {/* Cargas de CBUQ — exclusivo Correção de Defeito (CBUQ) */}
          {isSegmentService(service) && (
            <CbuqForm data={cbuq} onChange={setCbuq} contractItems={contractItems} />
          )}

          {/* Quantitativos — exclusivo Sinalização */}
          {service === "Sinalização" && (
            <div
              className="rounded-xl border p-4"
              style={{
                background: "rgba(168,85,247,0.04)",
                borderColor: "rgba(168,85,247,0.25)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight" style={{ color: "#fde68a" }}>
                    Quantitativos
                  </h3>
                  <p className="text-[11px] text-[#9198ad] mt-0.5">
                    Vincule itens do contrato com as quantidades a creditar nesta atividade.
                    O valor entra na medição <span className="font-mono">{medicao || "—"}</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSinalLinhas((prev) => [
                      ...prev,
                      { uid: generateId(), code: "", qtyStr: "" },
                    ])
                  }
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-[#eab308]/40 text-[#fde68a] hover:bg-[#eab308]/10 transition-colors"
                >
                  + Adicionar item
                </button>
              </div>

              <div className="space-y-2">
                {sinalLinhas.map((l, idx) => {
                  const opts = contractItems
                    .filter((ci) => ci.code && ci.code.trim().startsWith("03.15."))
                    .map((ci) => ({
                      value: ci.code as string,
                      label: `${ci.code} — ${ci.name}${ci.unit ? ` (${ci.unit})` : ""}`,
                    }));
                  const selected = contractItems.find((ci) => ci.code === l.code);
                  return (
                    <div
                      key={l.uid}
                      className="rounded-lg border border-[#2e3345] bg-[#0f1117] p-3 grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-end"
                    >
                      <div>
                        <label className="block text-[10px] text-[#9198ad] uppercase tracking-wider mb-1">
                          Item de contrato #{idx + 1}
                        </label>
                        <FilterCombobox
                          value={l.code}
                          onChange={(v) =>
                            setSinalLinhas((prev) =>
                              prev.map((x) =>
                                x.uid === l.uid ? { ...x, code: v } : x
                              )
                            )
                          }
                          options={opts}
                          placeholder={
                            opts.length === 0
                              ? "Nenhum item 03.15.x no contrato"
                              : "Buscar item 03.15.x..."
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#9198ad] uppercase tracking-wider mb-1">
                          Quantidade {selected?.unit ? `(${selected.unit})` : ""}
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={l.qtyStr}
                          onChange={(e) =>
                            setSinalLinhas((prev) =>
                              prev.map((x) =>
                                x.uid === l.uid ? { ...x, qtyStr: e.target.value } : x
                              )
                            )
                          }
                          placeholder="0"
                          className="w-full bg-[#0f1117] border border-[#2e3345] rounded-md px-3 py-2 text-sm text-[#e8eaf0] focus:outline-none focus:border-[#eab308] transition-colors tabular-nums"
                        />
                      </div>
                      {sinalLinhas.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSinalLinhas((prev) => prev.filter((x) => x.uid !== l.uid))
                          }
                          className="text-xs text-[#f97066] hover:underline self-end pb-2"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total preview */}
              {(() => {
                const totals = sinalLinhas.reduce<{
                  count: number;
                  valor: number;
                }>(
                  (acc, l) => {
                    const q = parseFloat(l.qtyStr);
                    if (!l.code || !Number.isFinite(q) || q <= 0) return acc;
                    const ci = contractItems.find((c) => c.code === l.code);
                    acc.count += 1;
                    acc.valor += q * (ci?.unitPrice ?? 0);
                    return acc;
                  },
                  { count: 0, valor: 0 }
                );
                return (
                  <div className="mt-3 pt-3 border-t border-[#2e3345] flex items-center justify-between text-xs">
                    <span className="text-[#9198ad]">
                      {totals.count}{" "}
                      {totals.count === 1 ? "linha válida" : "linhas válidas"}
                    </span>
                    <span className="font-mono text-[#fde68a]">
                      Valor a creditar:{" "}
                      {totals.valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Quantitativo — exclusivo Conserva (item 01.01) */}
          {service === "Conserva" && (() => {
            const item = contractItems.find(
              (ci) => ci.code && ci.code.trim() === CONSERVA_CODE
            );
            const q = parseFloat(conservaQtyStr);
            const qty = Number.isFinite(q) && q > 0 ? q : 0;
            const valor = qty * (item?.unitPrice ?? 0);
            return (
              <div className="rounded-xl border border-[#84cc16]/25 bg-[#84cc16]/[0.04] p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold tracking-tight text-[#bef264]">
                    Quantitativo — item {CONSERVA_CODE}
                  </h3>
                  <p className="text-[11px] text-[#9198ad] mt-0.5">
                    {item
                      ? `${item.name}${item.unit ? ` (${item.unit})` : ""}`
                      : `Item ${CONSERVA_CODE} não encontrado no contrato.`}
                    {" "}Entra na medição <span className="font-mono">{medicao || "—"}</span>.
                  </p>
                </div>
                <div className="rounded-lg border border-[#2e3345] bg-[#0f1117] p-3 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3 items-end">
                  <div>
                    <label className="block text-[10px] text-[#9198ad] uppercase tracking-wider mb-1">
                      Quantidade {item?.unit ? `(${item.unit})` : ""}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={conservaQtyStr}
                      onChange={(e) => setConservaQtyStr(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0f1117] border border-[#2e3345] rounded-md px-3 py-2 text-sm text-[#e8eaf0] focus:outline-none focus:border-[#84cc16] transition-colors tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9198ad] uppercase tracking-wider mb-1">
                      Valor a creditar
                    </div>
                    <div
                      className="font-mono tabular-nums text-right text-base font-semibold"
                      style={{ color: valor > 0 ? "#bef264" : "#5c6380" }}
                    >
                      {valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Descrição */}
          <div>
            <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              placeholder="Detalhes da atividade..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors resize-none"
            />
          </div>

          {/* Fotos */}
          <PhotoUpload folders={folders} onChange={setFolders} />

          {/* Documentos PDF */}
          <PdfUpload pdfs={pdfs} onChange={setPdfs} />

          {/* Submit */}
          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary shimmer-wrap w-full"
            style={{
              padding: "12px 20px",
              fontSize: 14,
              cursor: isSaving ? "wait" : "pointer",
              opacity: isSaving ? 0.75 : 1,
            }}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Salvando..." : "Salvar Atividade"}
          </button>
        </form>
      </div>
    </div>
  );
}
