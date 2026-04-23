interface CoordinateInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}

export function CoordinateInput({ label, value, onChange }: CoordinateInputProps) {
  return (
    <div>
      <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type="number"
        step="0.000001"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] focus:outline-none focus:border-[#f59e0b] transition-colors"
      />
    </div>
  );
}
