import { useState, useEffect, useCallback, useRef } from "react";
import { X, Save, MapPin, RotateCcw, RectangleHorizontal } from "lucide-react";
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Activity, ContractItem, Quantity, ServiceType, LadoPista, AreaRect, Obra, TrocaSoloData, CbuqData } from "../../types/activity";
import { SERVICE_TYPES, LADO_PISTA_OPTIONS, SERVICES_WITH_AREA, isSegmentService } from "../../types/activity";
import { calcTrocaSolo } from "../../utils/trocaSoloCalc";
import { calcCbuq } from "../../utils/cbuqCalc";
import { loadContractItems } from "../../utils/storage";
import { TrocaSoloForm } from "../Form/TrocaSoloForm";
import { CbuqForm } from "../Form/CbuqForm";
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
  const [pickTarget, setPickTarget] = useState<"start" | "end">("start");
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
  const [quantities, setQuantities] = useState<Quantity[]>(
    editActivity?.quantities?.length
      ? editActivity.quantities
      : [{ id: generateId(), name: "", value: "" }]
  );
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);

  const [autoKm, setAutoKm] = useState(false);

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
  const pickTargetRef = useRef<"start" | "end">(pickTarget);
  pickTargetRef.current = pickTarget;
  useEffect(() => {
    if (!hasMapCoords) return;
    if (pickTargetRef.current === "end") {
      setLatEnd(initialLat);
      setLngEnd(initialLng);
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

    if (lat === 0 && lng === 0) {
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

    // Save all photos to IndexedDB and build folder structure (recursivo)
    type PersistedFolder = {
      id: string;
      name: string;
      photoIds: string[];
      subfolders?: PersistedFolder[];
    };
    const allPhotoIds: string[] = [];
    const persistFolder = async (folder: FolderData): Promise<PersistedFolder> => {
      const photoIds: string[] = [];
      for (const p of folder.photos) {
        await savePhoto(p.id, p.data);
        photoIds.push(p.id);
        allPhotoIds.push(p.id);
      }
      const subfolders: PersistedFolder[] | undefined = folder.subfolders?.length
        ? await Promise.all(folder.subfolders.map(persistFolder))
        : undefined;
      return { id: folder.id, name: folder.name, photoIds, subfolders };
    };
    const photoFolders: PersistedFolder[] = [];
    for (const f of folders) {
      photoFolders.push(await persistFolder(f));
    }

    // Save PDFs and build metadata array
    const keptPdfIds = new Set(pdfs.map((p) => p.id));
    const previousPdfIds = editActivity?.pdfs?.map((p) => p.id) ?? [];
    const removedPdfIds = previousPdfIds.filter((id) => !keptPdfIds.has(id));
    if (removedPdfIds.length > 0) await deletePdfs(removedPdfIds);

    const pdfsMeta = [] as { id: string; name: string; size: number }[];
    for (const p of pdfs) {
      await savePdf(p.id, p.data);
      pdfsMeta.push({ id: p.id, name: p.name, size: p.size });
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

    const segment = isSegmentService(service);
    const activity: Activity = {
      id: editActivity?.id ?? generateId(),
      lat,
      lng,
      latEnd: segment ? latEnd : undefined,
      lngEnd: segment ? lngEnd : undefined,
      service,
      serviceName: serviceName.trim() || undefined,
      trocaSolo: tsData,
      cbuq: cbuqData,
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
      className="fixed inset-0 z-[2500] flex items-center justify-center p-4 animate-fadeIn"
      style={{
        background: "rgba(3,5,9,0.75)",
        backdropFilter: "blur(8px)",
        // Durante picks no mapa o overlay fica escondido (display:none) pra
        // permitir que o clique chegue até o mapa, mas o componente continua
        // montado preservando todo o estado do formulário.
        display: hidden ? "none" : undefined,
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[94vh] overflow-y-auto animate-slideUp"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.025), transparent 30%), var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-2xl)",
          boxShadow: "var(--shadow-4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between sticky top-0 z-10"
          style={{
            padding: "18px 28px",
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
          className="space-y-5"
          style={{ padding: "28px 32px" }}
        >
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

          {/* Localização — ponto único ou trecho (CBUQ) */}
          {isSegmentService(service) ? (
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

          {/* KM — simples ou intervalo (CBUQ) */}
          {isSegmentService(service) ? (
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
          )}

          {/* Lado da Pista — oculto em CBUQ (sempre "Pista Toda") */}
          {!isSegmentService(service) && (
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
            className="btn btn-primary shimmer-wrap w-full"
            style={{ padding: "12px 20px", fontSize: 14 }}
          >
            <Save className="h-4 w-4" />
            Salvar Atividade
          </button>
        </form>
      </div>
    </div>
  );
}
