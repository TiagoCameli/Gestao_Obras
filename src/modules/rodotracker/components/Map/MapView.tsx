import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Marker, Polygon, useMapEvents, useMap } from "react-leaflet";
import L, { type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Maximize2, Minimize2 } from "lucide-react";
import type { Activity, Obra } from "../../types/activity";
import { getAllPhotoIds, isSegmentService } from "../../types/activity";
import { serviceColors } from "../../utils/colors";
import { usePhotoDB } from "../../hooks/usePhotoDB";
import { ActivityMarker } from "./ActivityMarker";
import { MapControls } from "./MapControls";
import { kmMarkersAlongRoute, sliceRouteBetween, midpointOfPath } from "../../utils/route";
import { rectangleDimensions, edgeDistance, formatMeters, formatArea } from "../../utils/geometry";

const SATELLITE_URL = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";
const STREET_URL = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

const startIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const endIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function kmMarkerIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;gap:4px;transform:translate(8px,-50%);pointer-events:none">
      <div style="width:2px;height:14px;background:#f59e0b;box-shadow:0 0 0 1px rgba(0,0,0,0.4)"></div>
      <div style="font:600 10px/1 ui-monospace,monospace;color:#f59e0b;background:rgba(15,17,23,0.85);padding:2px 5px;border-radius:4px;border:1px solid rgba(245,158,11,0.4);white-space:nowrap">${label}</div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

interface MapViewProps {
  activities: Activity[];
  isAdding: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onSelectActivity: (activity: Activity) => void;
  onMoveActivity?: (id: string, lat: number, lng: number) => void;
  onMoveAreaLabel?: (id: string, lat: number, lng: number) => void;
  onMoveAreaCorners?: (id: string, corners: [number, number][]) => void;
  tempMarker: [number, number] | null;
  focusCoord: [number, number] | null;
  selectedActivityId?: string | null;
  sidebarCollapsed?: boolean;
  center: [number, number];
  zoom: number;
  obra?: Obra;
}

function ClickHandler({
  isAdding,
  isStreetViewMode,
  onMapClick,
  onStreetViewClick,
  onBackgroundClick,
}: {
  isAdding: boolean;
  isStreetViewMode: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onStreetViewClick: (lat: number, lng: number) => void;
  onBackgroundClick?: () => void;
}) {
  useMapEvents({
    click(e) {
      if (isStreetViewMode) {
        onStreetViewClick(e.latlng.lat, e.latlng.lng);
      } else if (isAdding) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      } else {
        onBackgroundClick?.();
      }
    },
  });
  return null;
}

function FlyTo({ coord }: { coord: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coord) {
      map.flyTo(coord, 15, { duration: 1 });
    }
  }, [coord, map]);
  return null;
}

const GMAPS_KEY = "AIzaSyATt1Tv2dp1aczkp9LdRCa7BD_5HrudOHs";
const GMAPS_SRC = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&v=weekly&libraries=geometry`;

function loadGMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps?.StreetViewPanorama) { resolve(); return; }
    // Remove any previously loaded script (e.g. without key)
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((s) => s.remove());
    const script = document.createElement("script");
    script.src = GMAPS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

// Dim a hex color by appending alpha — used for CSS custom properties
function dimColor(hex: string, alphaHex: string): string {
  return hex.length === 7 ? `${hex}${alphaHex}` : hex;
}

// Compact SVG icons inlined for the Street View card
const ICON_CAL =
  '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"/></svg>';
const ICON_PIN =
  '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14.5s-5-4.5-5-8.5a5 5 0 1 1 10 0c0 4-5 8.5-5 8.5Z"/><circle cx="8" cy="6" r="1.8"/></svg>';
const ICON_CAM =
  '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5h1.5l1-1.5h6l1 1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 11.5v-4A1.5 1.5 0 0 1 2.5 6Z"/><circle cx="8" cy="10" r="2.4"/></svg>';
const ICON_CLOSE =
  '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
const ICON_RULER =
  '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="5.5" width="13" height="5" rx="1" transform="rotate(-18 8 8)"/><path d="M4.3 6.6l-.4 1.2M6.1 5.9l-.8 2.4M7.9 5.2l-.4 1.2M9.7 4.5l-.8 2.4M11.5 3.8l-.4 1.2"/></svg>';
const ICON_AREA =
  '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="11" height="11" rx="1" stroke-dasharray="2 2"/></svg>';

function buildLabelHtml(act: Activity, photoSrcs: string[], actId: string): string {
  const color = serviceColors[act.service];
  const date = act.date.split("-").reverse().join("/");
  const title = act.serviceName || act.service;
  const subtitle = act.serviceName ? act.service : "";
  const isLeft = act.lado === "Esquerdo";
  const hasPhotos = photoSrcs.length > 0;

  const styleVars = `--sv-color:${color};--sv-color-dim:${dimColor(color, "99")}`;

  const kmMeta = act.km
    ? `<span class="sv-meta-item">${ICON_PIN}<span>${act.km}</span></span>`
    : "";
  const dateMeta = `<span class="sv-meta-item">${ICON_CAL}<span>${date}</span></span>`;

  const pills: string[] = [];
  if (act.lado && act.lado !== "Pista Toda") pills.push(`<span class="sv-pill">Lado ${act.lado}</span>`);
  if (act.lado === "Pista Toda") pills.push(`<span class="sv-pill">Pista toda</span>`);
  if (act.medicao != null) pills.push(`<span class="sv-pill">Med. ${act.medicao}</span>`);

  const dims = act.areaRect?.corners ? rectangleDimensions(act.areaRect.corners) : null;
  const dimsHtml = dims
    ? `<div class="sv-dims">
         <span class="sv-dims-label">${ICON_RULER}Área</span>
         <span class="sv-dims-value">
           <span>${formatMeters(dims.width)}</span>
           <span class="sv-dims-op">×</span>
           <span>${formatMeters(dims.length)}</span>
         </span>
         <span class="sv-dims-area">${ICON_AREA}${formatArea(dims.area)}</span>
       </div>`
    : "";

  const toggleBtn = hasPhotos
    ? `<div class="sv-toggle sv-toggle-close" data-sv-toggle="${actId}">${ICON_CLOSE}<span>Fechar fotos</span></div>`
    : `<div class="sv-toggle" data-sv-toggle="${actId}">${ICON_CAM}<span>Ver fotos</span></div>`;

  const photosHtml = hasPhotos
    ? `<div class="sv-photos" style="${styleVars}">
         <div class="sv-photos-header">
           <span>Fotos</span>
           <span>${photoSrcs.length.toString().padStart(2, "0")}</span>
         </div>
         <div class="sv-photos-scroll">
           ${photoSrcs
             .map(
               (src, i) =>
                 `<img class="sv-thumb" src="${src}" data-sv-photo-id="${actId}" data-sv-photo-idx="${i}" alt="foto ${i + 1}" />`
             )
             .join("")}
         </div>
       </div>`
    : "";

  const closeBtn = `<button class="sv-close" data-sv-close="${actId}" aria-label="Fechar">${ICON_CLOSE}</button>`;

  const card = `
    <div class="sv-card" style="${styleVars}">
      ${closeBtn}
      <div class="sv-title" style="padding-right:16px">${title}</div>
      ${subtitle ? `<div class="sv-subtitle">${subtitle}</div>` : ""}
      <div class="sv-meta">${dateMeta}${kmMeta}</div>
      ${pills.length ? `<div class="sv-pills">${pills.join("")}</div>` : ""}
      ${dimsHtml}
      ${toggleBtn}
    </div>`;

  const stack = `
    <div class="sv-card-col" style="${styleVars};display:flex;flex-direction:column;align-items:center">
      ${card}
      <div class="sv-stem" style="${styleVars}"></div>
      <div class="sv-pin" style="${styleVars}">
        <div class="sv-pin-halo"></div>
        <div class="sv-pin-ring"></div>
        <div class="sv-pin-core"></div>
      </div>
    </div>`;

  if (!hasPhotos) {
    return `<div class="sv-root">${stack}</div>`;
  }

  return `
    <div class="sv-root">
      <div class="sv-row">
        ${isLeft ? photosHtml : ""}
        ${stack}
        ${!isLeft ? photosHtml : ""}
      </div>
    </div>`;
}

interface SegmentStreetViewData {
  activityId: string;
  positions: [number, number][];
  midpoint: [number, number];
}

function StreetViewPanel({
  lat,
  lng,
  activities,
  segmentData,
  onClose,
}: {
  lat: number;
  lng: number;
  activities: Activity[];
  segmentData?: SegmentStreetViewData[];
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[] | null>(null);
  const [viewerIdx, setViewerIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const delegatedCleanupRef = useRef<(() => void) | null>(null);
  const { getPhotos } = usePhotoDB();

  // Load photos for all activities, then create panorama
  useEffect(() => {
    let cancelled = false;

    // Gather all photo IDs
    const allIds: string[] = [];
    for (const act of activities) {
      allIds.push(...getAllPhotoIds(act));
    }

    // Load photos + Google Maps in parallel
    Promise.all([
      allIds.length > 0 ? getPhotos(allIds) : Promise.resolve({} as Record<string, string>),
      loadGMaps(),
    ]).then(([photoMap]) => {
      if (cancelled || !containerRef.current) return;

      const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
        position: { lat, lng },
        pov: { heading: 0, pitch: 0 },
        zoom: 1,
        addressControl: false,
        showRoadLabels: false,
        motionTracking: false,
        fullscreenControl: false,
      });
      panoRef.current = panorama;

      function makeIcon(color: string) {
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
  <ellipse cx="13" cy="31.5" rx="5" ry="1.4" fill="black" fill-opacity="0.5"/>
  <path d="M13 2 C 6.5 2 2 6.5 2 12 C 2 18 9 24 13 31 C 17 24 24 18 24 12 C 24 6.5 19.5 2 13 2 Z"
        fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="13" cy="12" r="4" fill="#ffffff" fill-opacity="0.88"/>
  <circle cx="13" cy="12" r="2.6" fill="${color}"/>
</svg>`;
        return {
          url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(26, 34),
          anchor: new google.maps.Point(13, 31),
        };
      }

      const markers: { marker: google.maps.Marker; color: string }[] = [];

      interface ActivityState {
        showingPhotos: boolean;
        infoWindow: google.maps.InfoWindow;
        htmlNoPhotos: string;
        htmlWithPhotos: string;
        actPhotoSrcs: string[];
        marker: google.maps.Marker;
      }
      const activityState = new Map<string, ActivityState>();
      // Track the currently-open InfoWindow so we can close it when another opens
      let activeInfoWindowId: string | null = null;

      function openInfoWindowFor(id: string) {
        if (activeInfoWindowId && activeInfoWindowId !== id) {
          const prev = activityState.get(activeInfoWindowId);
          if (prev) {
            prev.infoWindow.close();
            prev.showingPhotos = false;
            prev.infoWindow.setContent(prev.htmlNoPhotos);
          }
        }
        const s = activityState.get(id);
        if (!s) return;
        s.infoWindow.open({ map: panorama, anchor: s.marker });
        activeInfoWindowId = id;
      }

      function closeInfoWindowFor(id: string) {
        const s = activityState.get(id);
        if (!s) return;
        s.infoWindow.close();
        s.showingPhotos = false;
        s.infoWindow.setContent(s.htmlNoPhotos);
        if (activeInfoWindowId === id) activeInfoWindowId = null;
      }

      function makeAreaDotIcon(color: string) {
        // Soft radial-gradient point — bright core fading to transparent
        // Creates the illusion of a continuous glow rope along the border
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="45%" stop-color="${color}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="10" cy="10" r="10" fill="url(#g)"/>
  <circle cx="10" cy="10" r="3.2" fill="#ffffff" fill-opacity="0.92"/>
  <circle cx="10" cy="10" r="2.2" fill="${color}"/>
</svg>`;
        return {
          url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(20, 20),
          anchor: new google.maps.Point(10, 10),
        };
      }

      function makeCornerMarkerIcon(color: string) {
        // Larger square marker at each polygon corner for visual structure
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <defs>
    <radialGradient id="cg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.9"/>
      <stop offset="80%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="14" cy="14" r="14" fill="url(#cg)"/>
  <rect x="8" y="8" width="12" height="12" rx="2" fill="#ffffff" fill-opacity="0.15" stroke="#ffffff" stroke-width="2"/>
  <rect x="11" y="11" width="6" height="6" rx="1" fill="${color}"/>
</svg>`;
        return {
          url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14),
        };
      }

      const areaMarkers: google.maps.Marker[] = [];
      const segmentByActId = new Map<string, SegmentStreetViewData>();
      for (const s of segmentData ?? []) segmentByActId.set(s.activityId, s);

      for (const act of activities) {
        const color = serviceColors[act.service];
        const actPhotoIds = getAllPhotoIds(act);
        const actPhotoSrcs = actPhotoIds.map((id) => photoMap[id]).filter(Boolean);

        // Trecho CBUQ — pinta dots azuis ao longo da extensão no street view
        const seg = segmentByActId.get(act.id);
        if (seg && seg.positions.length >= 2) {
          const dotsPerMeter = 0.5; // ~1 marcador a cada 2 metros
          for (let i = 0; i < seg.positions.length - 1; i++) {
            const a = seg.positions[i];
            const b = seg.positions[i + 1];
            const latLngA = new google.maps.LatLng(a[0], a[1]);
            const latLngB = new google.maps.LatLng(b[0], b[1]);
            const segMeters = google.maps.geometry
              ? google.maps.geometry.spherical.computeDistanceBetween(latLngA, latLngB)
              : 0;
            // Fallback se a lib geometry não estiver carregada — distância planar escalada
            const meters =
              segMeters ||
              Math.hypot(b[0] - a[0], b[1] - a[1]) * 111_000;
            const n = Math.max(2, Math.ceil(meters * dotsPerMeter));
            for (let t = 0; t <= n; t++) {
              const f = t / n;
              const dotLat = a[0] + (b[0] - a[0]) * f;
              const dotLng = a[1] + (b[1] - a[1]) * f;
              areaMarkers.push(new google.maps.Marker({
                position: { lat: dotLat, lng: dotLng },
                map: panorama,
                icon: makeAreaDotIcon(color),
                clickable: false,
                zIndex: 0,
                optimized: false,
              }));
            }
          }
          // Marcador visível no ponto inicial e final
          areaMarkers.push(new google.maps.Marker({
            position: { lat: act.lat, lng: act.lng },
            map: panorama,
            icon: makeCornerMarkerIcon(color),
            clickable: false,
            zIndex: 1,
            optimized: false,
          }));
          areaMarkers.push(new google.maps.Marker({
            position: { lat: act.latEnd as number, lng: act.lngEnd as number },
            map: panorama,
            icon: makeCornerMarkerIcon(color),
            clickable: false,
            zIndex: 1,
            optimized: false,
          }));
        }

        // Render the service area: dense glow points along edges + distinct corner markers
        const corners = act.areaRect?.corners;
        if (corners && corners.length >= 3) {
          const pointsPerEdge = 20;
          for (let i = 0; i < corners.length; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % corners.length];
            // Skip t=0 (corner markers cover those) and include interpolation up to just before next corner
            for (let t = 1; t < pointsPerEdge; t++) {
              const f = t / pointsPerEdge;
              const lat = a[0] + (b[0] - a[0]) * f;
              const lng = a[1] + (b[1] - a[1]) * f;
              areaMarkers.push(new google.maps.Marker({
                position: { lat, lng },
                map: panorama,
                icon: makeAreaDotIcon(color),
                clickable: false,
                zIndex: 0,
                optimized: false,
              }));
            }
          }
          // Corner markers — anchor the shape visually
          for (const c of corners) {
            areaMarkers.push(new google.maps.Marker({
              position: { lat: c[0], lng: c[1] },
              map: panorama,
              icon: makeCornerMarkerIcon(color),
              clickable: false,
              zIndex: 1,
              optimized: false,
            }));
          }
        }

        const pinPos = seg
          ? { lat: seg.midpoint[0], lng: seg.midpoint[1] }
          : { lat: act.lat, lng: act.lng };
        const marker = new google.maps.Marker({
          position: pinPos,
          map: panorama,
          title: act.serviceName || act.service,
          icon: makeIcon(color),
          optimized: false,
          zIndex: 2,
        });

        const htmlNoPhotos = buildLabelHtml(act, [], act.id);
        const htmlWithPhotos = buildLabelHtml(act, actPhotoSrcs, act.id);

        const infoWindow = new google.maps.InfoWindow({
          content: htmlNoPhotos,
          maxWidth: actPhotoSrcs.length > 0 ? 650 : 300,
          disableAutoPan: false,
        });

        // Do NOT auto-open — user must click the marker to reveal the card.
        activityState.set(act.id, {
          showingPhotos: false,
          infoWindow,
          htmlNoPhotos,
          htmlWithPhotos,
          actPhotoSrcs,
          marker,
        });

        marker.addListener("click", () => {
          if (activeInfoWindowId === act.id) return; // already open, keep it
          openInfoWindowFor(act.id);
        });

        markers.push({ marker, color });
      }

      // Event delegation: survives InfoWindow DOM replacement via setContent.
      const delegatedClick = (e: Event) => {
        const target = e.target as HTMLElement;

        // Close button
        const closeBtn = target.closest("[data-sv-close]") as HTMLElement | null;
        if (closeBtn) {
          e.stopPropagation();
          const id = closeBtn.getAttribute("data-sv-close")!;
          closeInfoWindowFor(id);
          return;
        }

        // Ver fotos / Fechar fotos toggle
        const toggle = target.closest("[data-sv-toggle]") as HTMLElement | null;
        if (toggle) {
          const id = toggle.getAttribute("data-sv-toggle")!;
          const s = activityState.get(id);
          if (!s || s.actPhotoSrcs.length === 0) return;
          e.stopPropagation();
          s.showingPhotos = !s.showingPhotos;
          s.infoWindow.setContent(s.showingPhotos ? s.htmlWithPhotos : s.htmlNoPhotos);
          return;
        }

        // Thumbnail click → open full-screen viewer
        const photo = target.closest("[data-sv-photo-id]") as HTMLElement | null;
        if (photo) {
          e.stopPropagation();
          const id = photo.getAttribute("data-sv-photo-id")!;
          const idx = parseInt(photo.getAttribute("data-sv-photo-idx") ?? "0", 10);
          const s = activityState.get(id);
          if (s) {
            setViewerPhotos(s.actPhotoSrcs);
            setViewerIdx(idx);
          }
        }
      };
      document.addEventListener("click", delegatedClick);
      delegatedCleanupRef.current = () => {
        document.removeEventListener("click", delegatedClick);
      };


      setLoaded(true);
    });
    return () => {
      cancelled = true;
      delegatedCleanupRef.current?.();
      delegatedCleanupRef.current = null;
    };
  }, [lat, lng, activities, getPhotos]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewerPhotos) { setViewerPhotos(null); return; }
        if (fullscreen) { setFullscreen(false); return; }
        onClose();
      }
      if (viewerPhotos) {
        if (e.key === "ArrowLeft" && viewerIdx > 0) setViewerIdx(viewerIdx - 1);
        if (e.key === "ArrowRight" && viewerIdx < viewerPhotos.length - 1) setViewerIdx(viewerIdx + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, fullscreen, viewerPhotos, viewerIdx]);

  return (
    <div
      className={`${
        fullscreen
          ? "fixed inset-0 z-[5000]"
          : "absolute bottom-0 left-0 right-0 z-[1000]"
      } bg-[#0c0e14] animate-slideUp`}
      style={fullscreen ? {} : { height: "50%" }}
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-white/70">Street View</span>
          <span className="text-[10px] font-mono text-white/40">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>
        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            onClick={() => setFullscreen((f) => !f)}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-5">
          <span className="text-sm text-white/40">Carregando Street View...</span>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />

      {/* Fullscreen photo viewer */}
      {viewerPhotos && (
        <div
          className="fixed inset-0 z-[6000] bg-black/90 flex items-center justify-center animate-fadeIn"
          onClick={() => setViewerPhotos(null)}
        >
          <button
            onClick={() => setViewerPhotos(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
          >
            <X className="h-8 w-8" />
          </button>

          {viewerPhotos.length > 1 && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm font-mono z-10">
              {viewerIdx + 1} / {viewerPhotos.length}
            </div>
          )}

          {viewerIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setViewerIdx(viewerIdx - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded-full p-3 z-10"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            </button>
          )}

          {viewerIdx < viewerPhotos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setViewerIdx(viewerIdx + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded-full p-3 z-10"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
            </button>
          )}

          <img
            src={viewerPhotos[viewerIdx]}
            alt={`Foto ${viewerIdx + 1}`}
            className="max-w-[90%] max-h-[90%] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export function MapView({
  activities,
  isAdding,
  onMapClick,
  onSelectActivity,
  onMoveActivity,
  onMoveAreaLabel,
  onMoveAreaCorners,
  tempMarker,
  focusCoord,
  selectedActivityId = null,
  sidebarCollapsed = false,
  center,
  zoom,
  obra,
}: MapViewProps) {
  const [isSatellite, setIsSatellite] = useState(true);
  const [streetViewMode, setStreetViewMode] = useState(false);
  const [streetViewCoord, setStreetViewCoord] = useState<[number, number] | null>(null);
  const [, setStreetViewActivity] = useState<Activity | null>(null);
  const [pinnedActivityId, setPinnedActivityId] = useState<string | null>(null);
  // Explicit area-edit mode — handles only appear here; changes only persist on "Salvar".
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingCorners, setEditingCorners] = useState<[number, number][] | null>(null);

  // ── Live location tracking ────────────────────────────────────────────
  // O usuário liga/desliga via botão na MapControls. O watch é cancelado
  // SEMPRE que:
  //   • clica de novo no botão (toggle-off explícito)
  //   • o componente desmonta (mudou de obra, fechou o mapa, navegou pra
  //     outra rota do app — `RodoTrackerPage`/`MainLayout` desmontam
  //     `MapView`, e este `useEffect` limpa o watch)
  //   • a aba do navegador deixa de estar visível (visibilitychange)
  // Isso garante que o app só consome geolocalização enquanto a página
  // do mapa está EFETIVAMENTE em uso.
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const clearActiveWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const stopLocationWatch = useCallback(() => {
    clearActiveWatch();
    setIsTrackingLocation(false);
    setIsLocating(false);
    setUserLocation(null);
  }, [clearActiveWatch]);

  const toggleLocationTracking = useCallback(() => {
    if (isTrackingLocation || isLocating) {
      stopLocationWatch();
      return;
    }
    if (!navigator.geolocation) {
      alert("Geolocalização não está disponível neste navegador.");
      return;
    }
    // Garantia paranoica — se algum watch ficou pendurado, mata antes de abrir outro.
    clearActiveWatch();
    setIsLocating(true);
    let firstFix = true;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        if (firstFix) {
          firstFix = false;
          setIsLocating(false);
          setIsTrackingLocation(true);
          mapRef.current?.flyTo([latitude, longitude], Math.max(mapRef.current.getZoom(), 15));
        }
      },
      (err) => {
        console.error("geolocation error", err);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada. Habilite no navegador e tente de novo."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Localização indisponível no momento."
            : "Não foi possível obter sua localização.";
        alert(msg);
        stopLocationWatch();
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
    );
  }, [isTrackingLocation, isLocating, stopLocationWatch, clearActiveWatch]);

  // Cleanup forte: desmontou ou aba ficou invisível → mata o watch.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && watchIdRef.current != null) {
        // Aba escondida: para de consumir GPS imediatamente. O usuário
        // precisa reativar manualmente quando voltar.
        stopLocationWatch();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearActiveWatch();
    };
  }, [clearActiveWatch, stopLocationWatch]);

  // Atividades com trecho (CBUQ): polyline ao longo da rodovia + midpoint
  // exato (meio geodésico entre início e fim) para posicionar o pin.
  const segmentData = useMemo(() => {
    return activities
      .filter((a) => isSegmentService(a.service) && a.latEnd != null && a.lngEnd != null)
      .map((a) => {
        const slice =
          obra?.routeGeoJson && obra.routeGeoJson.length >= 2
            ? sliceRouteBetween(
                { lat: a.lat, lng: a.lng },
                { lat: a.latEnd as number, lng: a.lngEnd as number },
                obra.routeGeoJson
              )
            : [];
        const positions: [number, number][] =
          slice.length >= 2
            ? slice
            : [
                [a.lat, a.lng],
                [a.latEnd as number, a.lngEnd as number],
              ];
        // Meio da distância marcada = ponto a 50% do comprimento de arco
        // da polyline que o usuário enxerga (que pode ser curvada se o
        // routeGeoJson tem vários vértices). Fallback pra média dos
        // endpoints se, por algum motivo, midpointOfPath falhar.
        const arc = midpointOfPath(positions);
        const midpoint: [number, number] = arc
          ? [arc.lat, arc.lng]
          : [
              (a.lat + (a.latEnd as number)) / 2,
              (a.lng + (a.lngEnd as number)) / 2,
            ];
        return { activity: a, positions, midpoint };
      });
  }, [activities, obra?.routeGeoJson]);

  const segmentMidpointById = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const s of segmentData) m.set(s.activity.id, s.midpoint);
    return m;
  }, [segmentData]);

  /**
   * Atividades com `areaRect` (Troca de Solo, Remendo Profundo) têm o pin
   * **travado** no centroide da área — ele não pode ser arrastado sozinho,
   * só acompanha o retângulo. Aqui calculamos o centroide vigente de cada
   * uma. Enquanto a área está em modo de edição, o centroide vem dos
   * `editingCorners` (preview live); fora disso, dos corners persistidos.
   */
  const areaCentroidById = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const a of activities) {
      const corners =
        editingAreaId === a.id && editingCorners
          ? editingCorners
          : a.areaRect?.corners;
      if (!corners || corners.length < 3) continue;
      let sumLat = 0, sumLng = 0;
      for (const c of corners) { sumLat += c[0]; sumLng += c[1]; }
      m.set(a.id, [sumLat / corners.length, sumLng / corners.length]);
    }
    return m;
  }, [activities, editingAreaId, editingCorners]);

  const mapRef = useRef<LeafletMap | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Always point to the latest activities so drag handlers read fresh corners
  const activitiesRef = useRef<Activity[]>(activities);
  activitiesRef.current = activities;
  // Captures the snapshot of an activity's corners at the start of each area drag
  // so stale React closures can't overwrite persisted rotations mid-interaction.
  const dragBaseRef = useRef<{
    activityId: string;
    corners: [number, number][];
    centroid: [number, number];
  } | null>(null);

  const captureDragBase = useCallback((id: string, fromCorners?: [number, number][] | null) => {
    const c = fromCorners ??
      activitiesRef.current.find((x) => x.id === id)?.areaRect?.corners;
    if (!c || c.length !== 4) {
      dragBaseRef.current = null;
      return null;
    }
    const centroid: [number, number] = [
      (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4,
      (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4,
    ];
    dragBaseRef.current = { activityId: id, corners: c as [number, number][], centroid };
    return dragBaseRef.current;
  }, []);

  const startEditArea = useCallback((id: string) => {
    const current = activitiesRef.current.find((x) => x.id === id);
    const c = current?.areaRect?.corners;
    if (!c || c.length !== 4) return;
    setEditingAreaId(id);
    setEditingCorners(c.map((p) => [...p] as [number, number]));
  }, []);

  const saveEditArea = useCallback(() => {
    if (!editingAreaId || !editingCorners) {
      setEditingAreaId(null);
      setEditingCorners(null);
      return;
    }
    onMoveAreaCorners?.(editingAreaId, editingCorners);
    setEditingAreaId(null);
    setEditingCorners(null);
  }, [editingAreaId, editingCorners, onMoveAreaCorners]);

  const cancelEditArea = useCallback(() => {
    setEditingAreaId(null);
    setEditingCorners(null);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleLayer = useCallback(() => setIsSatellite((s) => !s), []);

  const centerMap = useCallback(() => {
    mapRef.current?.flyTo(center, zoom, { duration: 1 });
  }, [center, zoom]);

  const toggleStreetView = useCallback(() => {
    setStreetViewMode((s) => {
      if (s) {
        setStreetViewCoord(null);
        setStreetViewActivity(null);
      }
      return !s;
    });
  }, []);

  const handleStreetViewClick = useCallback((lat: number, lng: number) => {
    setStreetViewCoord([lat, lng]);
    setStreetViewActivity(null);
  }, []);

  const handleStreetViewFromActivity = useCallback((lat: number, lng: number) => {
    setStreetViewCoord([lat, lng]);
  }, []);

  const hasRoute = obra?.routeGeoJson && obra.routeGeoJson.length > 1;
  const hasStart = obra?.startLat != null && obra?.startLng != null;
  const hasEnd = obra?.endLat != null && obra?.endLng != null;

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        maxZoom={22}
        className="w-full h-full"
        ref={mapRef}
        zoomControl={false}
        style={{ background: "#0f1117" }}
      >
        <TileLayer
          url={isSatellite ? SATELLITE_URL : STREET_URL}
          maxNativeZoom={20}
          maxZoom={22}
        />
        <ClickHandler
          isAdding={isAdding}
          isStreetViewMode={streetViewMode}
          onMapClick={onMapClick}
          onStreetViewClick={handleStreetViewClick}
        />
        <FlyTo coord={focusCoord} />

        {/* Route of the obra */}
        {hasRoute && (
          <Polyline
            positions={obra!.routeGeoJson!}
            pathOptions={{
              color: "#f59e0b",
              weight: 4,
              opacity: 0.5,
              dashArray: "8 6",
            }}
          />
        )}
        {hasRoute &&
          (() => {
            const markers = kmMarkersAlongRoute(obra!.routeGeoJson!, 1);
            const kmIni = obra!.kmInicial;
            const kmFim = obra!.kmFinal;
            const hasRange = kmIni != null && kmFim != null;
            const ascending = hasRange ? kmFim! >= kmIni! : true;
            const totalKm = markers.length ? markers[markers.length - 1].km : 0;
            return markers.map((m, i) => {
              let label: string;
              if (hasRange && totalKm > 0) {
                const real = ascending
                  ? kmIni! + m.km
                  : kmIni! - m.km;
                label = `${Math.round(real)}`;
              } else {
                label = `${Math.round(m.km)}`;
              }
              return (
                <Marker
                  key={`km-${i}`}
                  position={[m.lat, m.lng]}
                  icon={kmMarkerIcon(label)}
                  interactive={false}
                />
              );
            });
          })()}
        {hasStart && (
          <Marker position={[obra!.startLat!, obra!.startLng!]} icon={startIcon} />
        )}
        {hasEnd && (
          <Marker position={[obra!.endLat!, obra!.endLng!]} icon={endIcon} />
        )}

        {/* Area polygons — draggable to translate only while in edit mode for that activity */}
        {activities.map((a) => {
          const corners =
            editingAreaId === a.id && editingCorners ? editingCorners : a.areaRect?.corners;
          if (!corners || corners.length < 3) return null;
          const isEditingThis = editingAreaId === a.id;
          return (
            <Polygon
              key={`poly-${a.id}`}
              positions={corners}
              pathOptions={{
                color: serviceColors[a.service],
                weight: isEditingThis ? 3 : 2,
                fillColor: serviceColors[a.service],
                fillOpacity: isEditingThis ? 0.28 : 0.2,
                dashArray: isEditingThis ? "6 4" : undefined,
                className: isEditingThis ? "area-polygon-editing" : "",
              }}
              eventHandlers={
                isEditingThis
                  ? {
                      mousedown: (e) => {
                        const map = mapRef.current;
                        if (!map) return;
                        const base = captureDragBase(a.id, editingCorners);
                        if (!base) return;
                        const baseCorners = base.corners;

                        L.DomEvent.stopPropagation(e.originalEvent);
                        L.DomEvent.preventDefault(e.originalEvent);
                        map.dragging.disable();

                        const startLatLng = e.latlng;

                        const onMove = (ev: L.LeafletMouseEvent) => {
                          const dLat = ev.latlng.lat - startLatLng.lat;
                          const dLng = ev.latlng.lng - startLatLng.lng;
                          const translated = baseCorners.map(
                            ([cLat, cLng]) => [cLat + dLat, cLng + dLng] as [number, number]
                          );
                          setEditingCorners(translated);
                        };

                        const onUp = () => {
                          map.off("mousemove", onMove);
                          map.off("mouseup", onUp);
                          map.dragging.enable();
                          dragBaseRef.current = null;
                        };

                        map.on("mousemove", onMove);
                        map.on("mouseup", onUp);
                      },
                    }
                  : undefined
              }
            />
          );
        })}

        {/* Area dimension labels + edit handles */}
        {activities.flatMap((a) => {
          const isPinned = pinnedActivityId === a.id;
          const isEditing = editingAreaId === a.id;
          if (!isPinned && !isEditing) return [];
          const corners =
            isEditing && editingCorners ? editingCorners : a.areaRect?.corners;
          if (!corners || corners.length !== 4) return [];
          const dims = rectangleDimensions(corners);
          if (!dims) return [];
          const color = serviceColors[a.service];

          const centroid: [number, number] = [
            (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4,
            (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4,
          ];

          const nodes: React.ReactNode[] = [];
          const EDGE_OFFSET_PX = 18;

          // Edge labels at each side midpoint, pushed outward from polygon center
          for (let i = 0; i < 4; i++) {
            const c1 = corners[i];
            const c2 = corners[(i + 1) % 4];
            const mid: [number, number] = [
              (c1[0] + c2[0]) / 2,
              (c1[1] + c2[1]) / 2,
            ];
            // Outward direction (centroid → midpoint) in screen coords:
            // east  = +x, north = -y (Y grows downward on screen)
            const dEast = mid[1] - centroid[1];
            const dNorth = mid[0] - centroid[0];
            const len = Math.hypot(dEast, dNorth) || 1;
            const ux = dEast / len;
            const uy = -dNorth / len;
            // iconAnchor is the pixel inside the icon aligned with lat/lng.
            // To move the visual content OUT by (ux, uy) * OFFSET pixels,
            // set anchor to the negative of that vector.
            const anchorX = -ux * EDGE_OFFSET_PX;
            const anchorY = -uy * EDGE_OFFSET_PX;

            const dist = edgeDistance(c1, c2);
            const icon = L.divIcon({
              className: "",
              html: `<div class="area-edge-pill">${formatMeters(dist)}</div>`,
              iconSize: [0, 0],
              iconAnchor: [anchorX, anchorY],
            });
            nodes.push(
              <Marker
                key={`edge-${a.id}-${i}`}
                position={mid}
                icon={icon}
                interactive={false}
                keyboard={false}
              />
            );
          }

          // Draggable handles — only in edit mode. Changes update editingCorners
          // (local state); nothing is persisted until the user clicks "Salvar".
          if (isEditing && onMoveAreaCorners) {
            const rotateFromBase = (lat: number, lng: number, handleIndex: number) => {
              const base = dragBaseRef.current;
              if (!base) return null;
              const { corners: bc, centroid: bcen } = base;
              const oldDLat = bc[handleIndex][0] - bcen[0];
              const oldDLng = bc[handleIndex][1] - bcen[1];
              const newDLat = lat - bcen[0];
              const newDLng = lng - bcen[1];
              const oldAngle = Math.atan2(oldDLat, oldDLng);
              const newAngle = Math.atan2(newDLat, newDLng);
              const delta = newAngle - oldAngle;
              const cosT = Math.cos(delta);
              const sinT = Math.sin(delta);
              return bc.map(([cLat, cLng]) => {
                const dLat = cLat - bcen[0];
                const dLng = cLng - bcen[1];
                return [
                  bcen[0] + dLat * cosT + dLng * sinT,
                  bcen[1] + dLng * cosT - dLat * sinT,
                ] as [number, number];
              });
            };
            const translateFromBase = (lat: number, lng: number) => {
              const base = dragBaseRef.current;
              if (!base) return null;
              const { corners: bc, centroid: bcen } = base;
              const dLat = lat - bcen[0];
              const dLng = lng - bcen[1];
              return bc.map(([cLat, cLng]) => [cLat + dLat, cLng + dLng]) as [number, number][];
            };

            // --- Corner handles: rotation around centroid ---
            for (let i = 0; i < 4; i++) {
              const handleIcon = L.divIcon({
                className: "",
                html: `<div class="area-corner-handle" style="--dim-color:${color}"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              });
              nodes.push(
                <Marker
                  key={`handle-${a.id}-${i}`}
                  position={corners[i]}
                  icon={handleIcon}
                  draggable
                  keyboard={false}
                  zIndexOffset={950}
                  eventHandlers={{
                    dragstart: () => { captureDragBase(a.id, editingCorners); },
                    drag: (e) => {
                      const m = e.target as L.Marker;
                      const { lat, lng } = m.getLatLng();
                      const next = rotateFromBase(lat, lng, i);
                      if (next) setEditingCorners(next);
                    },
                    dragend: () => {
                      dragBaseRef.current = null;
                    },
                  }}
                />
              );
            }

            // --- Center handle: translation ---
            // Visualmente deslocado pra CIMA do centroide (iconAnchor com y
            // fora da imagem) pra não sobrepor o pin da atividade que vive
            // no centroide. Continua ancorado geograficamente no centroide,
            // portanto o drag translada a área normalmente.
            const moveIcon = L.divIcon({
              className: "",
              html: `<div class="area-move-handle" style="--dim-color:${color}" title="Mover área">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 2v12M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3M5 11l3 3 3-3M5 5l3-3 3 3"/>
                </svg>
              </div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 50],
            });
            const liveCentroid: [number, number] = [
              (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4,
              (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4,
            ];
            nodes.push(
              <Marker
                key={`move-${a.id}`}
                position={liveCentroid}
                icon={moveIcon}
                draggable
                keyboard={false}
                zIndexOffset={960}
                eventHandlers={{
                  dragstart: () => { captureDragBase(a.id, editingCorners); },
                  drag: (e) => {
                    const m = e.target as L.Marker;
                    const { lat, lng } = m.getLatLng();
                    const next = translateFromBase(lat, lng);
                    if (next) setEditingCorners(next);
                  },
                  dragend: () => {
                    dragBaseRef.current = null;
                  },
                }}
              />
            );
          }

          // Total area at centroid (or user-chosen position) — draggable
          const savedPos = a.areaRect?.totalLabelPos;
          const areaLabelPos: [number, number] = savedPos ?? centroid;
          // When the label sits exactly on centroid (default), visually nudge it up so
          // it's not behind the activity pin. Once the user drags it, we render it at
          // the exact saved coordinate (no offset).
          const anchorY = savedPos ? 0 : 32;
          const areaIcon = L.divIcon({
            className: "",
            html: `<div class="area-total-pill area-total-pill-drag" style="--dim-color:${color}">${formatArea(dims.area)}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, anchorY],
          });
          const draggedRef = { current: false };
          nodes.push(
            <Marker
              key={`total-${a.id}`}
              position={areaLabelPos}
              icon={areaIcon}
              draggable={Boolean(onMoveAreaLabel)}
              keyboard={false}
              zIndexOffset={900}
              eventHandlers={{
                dragstart: () => {
                  draggedRef.current = true;
                },
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const { lat, lng } = m.getLatLng();
                  onMoveAreaLabel?.(a.id, lat, lng);
                  setTimeout(() => { draggedRef.current = false; }, 50);
                },
              }}
            />
          );

          return nodes;
        })}

        {/* CBUQ (segmento): polyline azul-escuro seguindo a rodovia */}
        {segmentData.map(({ activity: a, positions }) => {
          const color = serviceColors[a.service];
          const isSelected = selectedActivityId === a.id || pinnedActivityId === a.id;
          return (
            <Polyline
              key={`seg-${a.id}`}
              positions={positions}
              pathOptions={{
                color,
                weight: isSelected ? 8 : 6,
                opacity: isSelected ? 1 : 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
              eventHandlers={{
                click: () => onSelectActivity?.(a),
              }}
            />
          );
        })}

        {activities.map((a) => (
          <ActivityMarker
            key={a.id}
            activity={a}
            positionOverride={
              segmentMidpointById.get(a.id) ?? areaCentroidById.get(a.id)
            }
            pinned={pinnedActivityId === a.id}
            selected={selectedActivityId === a.id}
            editing={editingAreaId === a.id}
            displayCorners={editingAreaId === a.id ? editingCorners : null}
            onPin={() => setPinnedActivityId(a.id)}
            onClosePin={() => {
              setPinnedActivityId(null);
              cancelEditArea();
            }}
            onStartEdit={() => startEditArea(a.id)}
            onSaveEdit={saveEditArea}
            onCancelEdit={cancelEditArea}
            onSelect={onSelectActivity}
            onStreetView={handleStreetViewFromActivity}
            onMove={onMoveActivity}
          />
        ))}

        {/* Pontos extras — Sinalização: 1 pin adicional por local cadastrado. */}
        {activities.flatMap((a) =>
          (a.extraPoints ?? []).map((pt, idx) => (
            <ActivityMarker
              key={`${a.id}-extra-${idx}`}
              activity={a}
              positionOverride={pt}
              pinned={pinnedActivityId === a.id}
              selected={selectedActivityId === a.id}
              onPin={() => setPinnedActivityId(a.id)}
              onClosePin={() => setPinnedActivityId(null)}
              onSelect={onSelectActivity}
              onStreetView={handleStreetViewFromActivity}
            />
          ))
        )}

        {tempMarker && (
          <CircleMarker
            center={tempMarker}
            radius={10}
            pathOptions={{
              color: "#f59e0b",
              weight: 3,
              fillColor: "#f59e0b",
              fillOpacity: 0.4,
            }}
          />
        )}

        {/* Posição do usuário em tempo real — círculo de precisão (raio em
            metros, escala com o zoom) + ponto azul "Google Maps style" no
            centro. */}
        {userLocation && (
          <>
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={Math.max(20, Math.min(80, userLocation.accuracy / 4))}
              pathOptions={{
                color: "#3b82f6",
                weight: 1,
                opacity: 0.4,
                fillColor: "#3b82f6",
                fillOpacity: 0.12,
              }}
              interactive={false}
            />
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={7}
              pathOptions={{
                color: "#ffffff",
                weight: 2.5,
                fillColor: "#3b82f6",
                fillOpacity: 1,
              }}
              interactive={false}
            />
          </>
        )}
      </MapContainer>

      <MapControls
        isSatellite={isSatellite}
        isStreetViewMode={streetViewMode}
        isTrackingLocation={isTrackingLocation}
        isLocating={isLocating}
        onToggleLayer={toggleLayer}
        onCenter={centerMap}
        onToggleStreetView={toggleStreetView}
        onToggleLocation={toggleLocationTracking}
      />

      {/* Extension badge */}
      {(obra?.kmInicial != null && obra?.kmFinal != null
        ? Math.abs(obra.kmFinal - obra.kmInicial)
        : obra?.extensionKm) != null && (
        <div
          className="absolute z-[1000] flex items-center gap-2 font-mono"
          style={{
            top: sidebarCollapsed ? 60 : 12, left: 12,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--accent)",
            background: "rgba(19, 23, 31, 0.82)",
            border: "1px solid var(--accent-border)",
            borderRadius: "var(--r-md)",
            backdropFilter: "blur(16px) saturate(140%)",
            WebkitBackdropFilter: "blur(16px) saturate(140%)",
            boxShadow: "var(--shadow-2), 0 0 20px -6px var(--accent-glow)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 10px var(--accent)",
            }}
          />
          <span style={{ color: "var(--text-muted)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Extensão
          </span>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          {(obra!.kmInicial != null && obra!.kmFinal != null
            ? Math.abs(obra!.kmFinal - obra!.kmInicial)
            : obra!.extensionKm!
          ).toFixed(2)}
          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>km</span>
        </div>
      )}

      {/* Street View mode indicator */}
      {streetViewMode && !streetViewCoord && (
        <div
          className="absolute z-[1000] animate-pulse flex items-center gap-2"
          style={{
            bottom: 28, left: "50%", transform: "translateX(-50%)",
            padding: "10px 18px",
            fontSize: 13, fontWeight: 600,
            color: "var(--accent)",
            background: "rgba(19, 23, 31, 0.9)",
            border: "1px solid var(--accent-border)",
            borderRadius: 999,
            backdropFilter: "blur(16px) saturate(140%)",
            boxShadow: "var(--shadow-3), 0 0 24px -4px var(--accent-glow)",
          }}
        >
          <span>🚶</span>
          <span>Clique no mapa para abrir o Street View</span>
        </div>
      )}

      {isAdding && (
        <div
          className="absolute z-[1000] animate-pulse flex items-center gap-2"
          style={{
            bottom: 28, left: "50%", transform: "translateX(-50%)",
            padding: "10px 18px",
            fontSize: 13, fontWeight: 600,
            color: "var(--accent)",
            background: "rgba(19, 23, 31, 0.9)",
            border: "1px solid var(--accent-border)",
            borderRadius: 999,
            backdropFilter: "blur(16px) saturate(140%)",
            boxShadow: "var(--shadow-3), 0 0 24px -4px var(--accent-glow)",
          }}
        >
          <span>📍</span>
          <span>Clique no mapa para marcar a localização</span>
        </div>
      )}

      {/* Street View panel */}
      {streetViewCoord && (
        <StreetViewPanel
          lat={streetViewCoord[0]}
          lng={streetViewCoord[1]}
          activities={activities}
          segmentData={segmentData.map(({ activity, positions, midpoint }) => ({
            activityId: activity.id,
            positions,
            midpoint,
          }))}
          onClose={() => {
            setStreetViewCoord(null);
            setStreetViewActivity(null);
            setStreetViewMode(false);
          }}
        />
      )}
    </div>
  );
}
