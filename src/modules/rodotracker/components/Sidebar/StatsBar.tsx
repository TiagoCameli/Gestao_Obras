import { ClipboardList, Layers, Camera } from "lucide-react";
import type { Activity } from "../../types/activity";
import { getTotalPhotoCount } from "../../types/activity";

interface StatsBarProps {
  activities: Activity[];
}

export function StatsBar({ activities }: StatsBarProps) {
  const totalPhotos = activities.reduce((sum, a) => sum + getTotalPhotoCount(a), 0);
  const uniqueServices = new Set(activities.map((a) => a.service)).size;

  return (
    <div
      className="flex items-stretch shrink-0"
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <StatCell icon={<ClipboardList className="h-3 w-3" />} value={activities.length} label="Registros" accent="var(--accent)" />
      <Divider />
      <StatCell icon={<Layers className="h-3 w-3" />} value={uniqueServices} label="Serviços" accent="var(--info)" />
      <Divider />
      <StatCell icon={<Camera className="h-3 w-3" />} value={totalPhotos} label="Fotos" accent="var(--success)" />
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{ width: 1, alignSelf: "stretch", background: "var(--border-hair)", margin: "4px 0" }}
    />
  );
}

function StatCell({
  icon, value, label, accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center anim-count">
      <div
        className="flex items-center gap-1.5 font-mono"
        style={{
          fontSize: 17, fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        <span style={{ color: accent, opacity: 0.7 }}>{icon}</span>
        <span>{value}</span>
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginTop: 5,
        }}
      >
        {label}
      </div>
    </div>
  );
}
