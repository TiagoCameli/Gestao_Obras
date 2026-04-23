import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "icon";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  shimmer?: boolean;
  active?: boolean;
  iconOnly?: boolean;
  children?: ReactNode;
}

const sizeMap: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-[13px]",
  lg: "px-5 py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  shimmer = false,
  active = false,
  iconOnly = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn-icon",
    variant !== "icon" && !iconOnly ? sizeMap[size] : "",
    shimmer ? "shimmer-wrap" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={cls}
      data-active={active || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
