import { forwardRef } from "react";
import { cn } from "../../../../lib/utils";

interface CellInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  placeholder?: string;
  error?: string;
  warning?: boolean;
  readonly?: boolean;
  type?: "text" | "number" | "date" | "time";
  className?: string;
}

export const TextCell = forwardRef<HTMLInputElement, CellInputProps>(
  ({ value, onChange, onKeyDown, onFocus, placeholder, error, warning, readonly, type = "text", className }, ref) => (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      readOnly={readonly}
      title={error}
      className={cn(
        "h-9 w-full px-2 text-sm bg-transparent outline-none border",
        "border-transparent focus:border-primary",
        error && "border-red-500 bg-red-50",
        warning && !error && "border-amber-400 bg-amber-50",
        readonly && "bg-muted text-muted-foreground cursor-default",
        className
      )}
    />
  )
);
TextCell.displayName = "TextCell";

interface SelectCellProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
  onFocus?: () => void;
}

export function SelectCell({ value, onChange, options, error, onKeyDown, onFocus }: SelectCellProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      title={error}
      className={cn(
        "h-9 w-full px-2 text-sm bg-transparent outline-none border",
        "border-transparent focus:border-primary",
        error && "border-red-500 bg-red-50"
      )}
    >
      <option value=""></option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
