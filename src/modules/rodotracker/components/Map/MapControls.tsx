import { Satellite, Map, Crosshair, PersonStanding } from "lucide-react";

interface MapControlsProps {
  isSatellite: boolean;
  isStreetViewMode: boolean;
  onToggleLayer: () => void;
  onCenter: () => void;
  onToggleStreetView: () => void;
}

export function MapControls({
  isSatellite,
  isStreetViewMode,
  onToggleLayer,
  onCenter,
  onToggleStreetView,
}: MapControlsProps) {
  return (
    <div
      className="absolute z-[1000] flex flex-col"
      style={{
        top: 12, right: 12,
        padding: 4,
        background: "rgba(19, 23, 31, 0.82)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-md)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        boxShadow: "var(--shadow-3)",
        gap: 2,
      }}
    >
      <MapBtn
        onClick={onToggleLayer}
        title={isSatellite ? "Mudar para mapa de rua" : "Mudar para satélite"}
      >
        {isSatellite ? <Map className="h-4 w-4" /> : <Satellite className="h-4 w-4" />}
      </MapBtn>

      <div style={{ height: 1, background: "var(--border-hair)", margin: "2px 4px" }} />

      <MapBtn onClick={onCenter} title="Centralizar na obra">
        <Crosshair className="h-4 w-4" />
      </MapBtn>

      <MapBtn
        onClick={onToggleStreetView}
        title="Street View"
        active={isStreetViewMode}
      >
        <PersonStanding className="h-4 w-4" />
      </MapBtn>
    </div>
  );
}

function MapBtn({
  onClick, title, active = false, children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center"
      style={{
        width: 34, height: 34,
        borderRadius: "var(--r-sm)",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        background: active ? "var(--accent-faint)" : "transparent",
        border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
        transition: "all 0.2s var(--ease-out)",
        boxShadow: active ? "0 0 12px var(--accent-glow), inset 0 0 0 1px var(--accent-border)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {children}
    </button>
  );
}
