import { useMemo, useRef } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import {
  Calendar, MapPin, Camera, ArrowRight, PersonStanding, X, Ruler, SquareDashed,
  Move, Check,
} from "lucide-react";
import type { Activity } from "../../types/activity";
import { getTotalPhotoCount } from "../../types/activity";
import { serviceColors } from "../../utils/colors";
import { formatDate } from "../../utils/format";
import { rectangleDimensions, formatMeters, formatArea } from "../../utils/geometry";

interface ActivityMarkerProps {
  activity: Activity;
  pinned?: boolean;
  selected?: boolean;
  editing?: boolean;
  displayCorners?: [number, number][] | null;
  /** Sobrescreve a posição do pin — usado p/ atividades CBUQ (midpoint do trecho). */
  positionOverride?: [number, number];
  onPin?: () => void;
  onClosePin?: () => void;
  onSelect: (activity: Activity) => void;
  onStreetView: (lat: number, lng: number) => void;
  onMove?: (id: string, lat: number, lng: number) => void;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}

function buildPinIcon(color: string, highlighted: boolean, hasPhoto: boolean): L.DivIcon {
  const highlightCls = highlighted ? " ap-pin-selected" : "";
  const photoBadge = hasPhoto ? '<div class="ap-pin-photo-badge"></div>' : "";
  const html = `
    <div class="ap-pin${highlightCls}" style="--ap-color:${color}">
      <div class="ap-pin-shadow"></div>
      <div class="ap-pin-ring"></div>
      <div class="ap-pin-body"></div>
      <div class="ap-pin-core"></div>
      ${photoBadge}
    </div>
  `;
  return L.divIcon({
    className: "",
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    tooltipAnchor: [0, -14],
  });
}

export function ActivityMarker({
  activity,
  pinned = false,
  selected = false,
  editing = false,
  displayCorners = null,
  positionOverride,
  onPin,
  onClosePin,
  onSelect,
  onStreetView,
  onMove,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: ActivityMarkerProps) {
  const color = serviceColors[activity.service];
  const photoCount = getTotalPhotoCount(activity);
  const title = activity.serviceName || activity.service;
  const highlighted = pinned || selected || editing;
  // Atividades com posição derivada (CBUQ midpoint) não podem ser arrastadas.
  const draggable = Boolean(onMove) && !editing && !positionOverride;
  const draggedRef = useRef(false);
  const effectiveCorners = displayCorners ?? activity.areaRect?.corners;
  const dims = effectiveCorners ? rectangleDimensions(effectiveCorners) : null;
  const hasArea = Boolean(activity.areaRect?.corners && activity.areaRect.corners.length >= 3);

  const icon = useMemo(
    () => buildPinIcon(color, highlighted, photoCount > 0),
    [color, highlighted, photoCount]
  );

  return (
    <Marker
      position={positionOverride ?? [activity.lat, activity.lng]}
      icon={icon}
      draggable={draggable}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e.originalEvent);
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          if (!pinned && onPin) onPin();
        },
        dragstart: () => {
          draggedRef.current = true;
          if (pinned && onClosePin) onClosePin();
        },
        dragend: (e) => {
          const m = e.target as L.Marker;
          const { lat, lng } = m.getLatLng();
          onMove?.(activity.id, lat, lng);
        },
        tooltipopen: (e) => {
          const el = e.tooltip.getElement();
          if (el) {
            el.style.setProperty("--tt-color", color);
            el.style.setProperty("--tt-color-dim", `${color}22`);
          }
        },
      }}
    >
      <Tooltip
        key={pinned ? "pinned" : "hover"}
        direction="top"
        offset={[0, -4]}
        opacity={1}
        className={`activity-tooltip${pinned ? " activity-tooltip-pinned" : ""}${editing ? " activity-tooltip-editing" : ""}`}
        permanent={pinned}
        sticky={!pinned}
        interactive
      >
        {pinned && (
          <button
            type="button"
            className="activity-tooltip-close"
            aria-label="Fechar"
            onClick={(e) => {
              e.stopPropagation();
              if (editing) onCancelEdit?.();
              onClosePin?.();
            }}
          >
            <X style={{ width: 11, height: 11 }} />
          </button>
        )}
        <div className="activity-tooltip-title" style={{ paddingRight: pinned ? 18 : 0 }}>
          {title}
        </div>
        {activity.serviceName && (
          <div className="activity-tooltip-subtitle">{activity.service}</div>
        )}
        <div className="activity-tooltip-meta">
          <span className="activity-tooltip-meta-item">
            <Calendar />
            <span>{formatDate(activity.date)}</span>
          </span>
          {activity.km && (
            <span className="activity-tooltip-meta-item">
              <MapPin />
              <span>{activity.km}</span>
            </span>
          )}
          {photoCount > 0 && (
            <span className="activity-tooltip-meta-item" style={{ color: "var(--success)" }}>
              <Camera />
              <span>{photoCount}</span>
            </span>
          )}
        </div>

        {dims && (
          <div className="activity-tooltip-dims">
            <span className="activity-tooltip-dims-label">
              <Ruler style={{ width: 10, height: 10 }} />
              Área
            </span>
            <span className="activity-tooltip-dims-value">
              <span className="activity-tooltip-dims-num">{formatMeters(dims.width)}</span>
              <span className="activity-tooltip-dims-op">×</span>
              <span className="activity-tooltip-dims-num">{formatMeters(dims.length)}</span>
            </span>
            <span className="activity-tooltip-dims-area">
              <SquareDashed style={{ width: 10, height: 10 }} />
              {formatArea(dims.area)}
            </span>
          </div>
        )}

        {/* Edit-area controls (only for pinned activities with an area) */}
        {pinned && hasArea && onStartEdit && (
          <div className="activity-tooltip-edit">
            {!editing ? (
              <button
                type="button"
                className="activity-tooltip-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit();
                }}
              >
                <Move style={{ width: 11, height: 11 }} />
                Alterar área de serviço
              </button>
            ) : (
              <div className="activity-tooltip-edit-row">
                <button
                  type="button"
                  className="activity-tooltip-edit-save"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveEdit?.();
                  }}
                >
                  <Check style={{ width: 11, height: 11 }} />
                  Salvar alterações
                </button>
                <button
                  type="button"
                  className="activity-tooltip-edit-cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelEdit?.();
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        <div className="activity-tooltip-actions">
          <span
            className="activity-tooltip-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(activity);
            }}
          >
            Ver detalhes <ArrowRight style={{ width: 10, height: 10 }} />
          </span>
          <span
            className="activity-tooltip-sv"
            onClick={(e) => {
              e.stopPropagation();
              onStreetView(activity.lat, activity.lng);
            }}
          >
            <PersonStanding style={{ width: 10, height: 10 }} />
            Street View
          </span>
        </div>
      </Tooltip>
    </Marker>
  );
}
