import type { HTMLAttributes, ReactNode } from "react";

type Variant = "flat" | "raised" | "glass" | "sunken";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  interactive?: boolean;
  edgeAccent?: boolean;
  children?: ReactNode;
}

const base: Record<Variant, string> = {
  flat: "surface",
  raised: "surface-raised",
  glass: "surface-glass",
  sunken: "surface-sunken",
};

export function Surface({
  variant = "flat",
  interactive = false,
  edgeAccent = false,
  className = "",
  children,
  ...rest
}: SurfaceProps) {
  const classes = [
    base[variant],
    edgeAccent ? "edge-accent" : "",
    interactive ? "cursor-pointer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
