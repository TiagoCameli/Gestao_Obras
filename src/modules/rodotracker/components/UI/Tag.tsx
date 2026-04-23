import type { ReactNode } from "react";

type Variant = "ghost" | "filled" | "outline";
type Size = "xs" | "sm";

interface TagProps {
  label: string;
  color?: string;
  variant?: Variant;
  size?: Size;
  dot?: boolean;
  icon?: ReactNode;
  mono?: boolean;
  className?: string;
}

const sizeMap: Record<Size, { padding: string; fontSize: number; height: number }> = {
  xs: { padding: "2px 8px", fontSize: 10, height: 20 },
  sm: { padding: "3px 10px", fontSize: 11, height: 22 },
};

export function Tag({
  label,
  color = "#9aa3b2",
  variant = "ghost",
  size = "sm",
  dot = false,
  icon,
  mono = true,
  className = "",
}: TagProps) {
  const s = sizeMap[size];
  const styles: React.CSSProperties =
    variant === "filled"
      ? {
          background: color,
          color: "#0a0d14",
          border: `1px solid ${color}`,
          boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 0 0 1px ${color}33`,
        }
      : variant === "outline"
      ? {
          background: "transparent",
          color: color,
          border: `1px solid ${color}66`,
        }
      : {
          background: `${color}14`,
          color: color,
          border: `1px solid ${color}22`,
          backdropFilter: "blur(4px)",
        };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${mono ? "font-mono" : ""} ${className}`}
      style={{
        ...styles,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        letterSpacing: "0.01em",
        lineHeight: 1,
        height: s.height,
        whiteSpace: "nowrap",
        transition: "background 0.22s, border-color 0.22s, color 0.22s",
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: variant === "filled" ? "#0a0d14" : color,
            boxShadow: variant === "filled" ? "none" : `0 0 6px ${color}`,
            flexShrink: 0,
          }}
        />
      )}
      {icon}
      {label}
    </span>
  );
}
