import { Plus, X } from "lucide-react";
import type { Quantity } from "../../types/activity";
import { generateId } from "../../utils/format";

interface QuantityRowsProps {
  quantities: Quantity[];
  onChange: (quantities: Quantity[]) => void;
}

export function QuantityRows({ quantities, onChange }: QuantityRowsProps) {
  const update = (id: string, field: "name" | "value", val: string) => {
    onChange(quantities.map((q) => (q.id === id ? { ...q, [field]: val } : q)));
  };

  const add = () => {
    onChange([...quantities, { id: generateId(), name: "", value: "" }]);
  };

  const remove = (id: string) => {
    if (quantities.length <= 1) return;
    onChange(quantities.filter((q) => q.id !== id));
  };

  return (
    <div>
      <label className="block text-xs text-[#9198ad] uppercase tracking-wider mb-2">
        Quantitativos
      </label>
      <div className="space-y-2">
        {quantities.map((q) => (
          <div key={q.id} className="flex gap-2">
            <input
              placeholder="Descrição (ex: CBUQ)"
              value={q.name}
              onChange={(e) => update(q.id, "name", e.target.value)}
              className="flex-1 bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors"
            />
            <input
              placeholder="Valor (ex: 15.5 t)"
              value={q.value}
              onChange={(e) => update(q.id, "value", e.target.value)}
              className="w-32 bg-[#0f1117] border border-[#2e3345] rounded-lg px-3 py-2 text-sm font-mono text-[#e8eaf0] placeholder:text-[#5c6380] focus:outline-none focus:border-[#f59e0b] transition-colors"
            />
            <button
              type="button"
              onClick={() => remove(q.id)}
              disabled={quantities.length <= 1}
              className="p-2 rounded-lg text-[#5c6380] hover:text-[#ef4444] hover:bg-[#ef444420] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-1 text-xs text-[#f59e0b] hover:text-[#d97706] transition-colors"
      >
        <Plus className="h-3 w-3" /> Adicionar Quantitativo
      </button>
    </div>
  );
}
