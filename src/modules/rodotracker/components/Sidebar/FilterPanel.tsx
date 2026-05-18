import { CalendarRange, Layers, Hash, Ruler } from "lucide-react";
import type { Filters, ServiceType } from "../../types/activity";
import { SERVICE_TYPES } from "../../types/activity";
import SmartSelect from "../../../../components/ui/SmartSelect";

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onApply: () => void;
  onClear: () => void;
  availableMedicoes: number[];
}

const fieldLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 6,
};

export function FilterPanel({
  filters,
  onChange,
  onApply,
  onClear,
  availableMedicoes,
}: FilterPanelProps) {
  const update = (field: keyof Filters, value: string | number | null) => {
    onChange({ ...filters, [field]: value });
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Período */}
      <div>
        <label style={fieldLabel}>
          <CalendarRange className="h-3 w-3" />
          <span>Período</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filters.dateStart}
            onChange={(e) => update("dateStart", e.target.value)}
            className="input font-mono"
            style={{ fontSize: 12 }}
          />
          <input
            type="date"
            value={filters.dateEnd}
            onChange={(e) => update("dateEnd", e.target.value)}
            className="input font-mono"
            style={{ fontSize: 12 }}
          />
        </div>
      </div>

      {/* Serviço */}
      <div>
        <label style={fieldLabel}>
          <Layers className="h-3 w-3" />
          <span>Tipo de Serviço</span>
        </label>
        <SmartSelect
          value={filters.service}
          onChange={(e) => update("service", e.target.value as ServiceType | "")}
          className="input text-left flex items-center"
          style={{ fontSize: 12 }}
        >
          <option value="">Todos</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SmartSelect>
      </div>

      {/* Medição */}
      <div>
        <label style={fieldLabel}>
          <Hash className="h-3 w-3" />
          <span>Medição</span>
        </label>
        <SmartSelect
          value={filters.medicao ?? ""}
          onChange={(e) =>
            update("medicao", e.target.value ? parseInt(e.target.value, 10) : null)
          }
          className="input text-left flex items-center"
          style={{ fontSize: 12 }}
        >
          <option value="">Todas</option>
          {availableMedicoes.map((m) => (
            <option key={m} value={m}>
              Medição {m}
            </option>
          ))}
        </SmartSelect>
      </div>

      {/* KM range */}
      <div>
        <label style={fieldLabel}>
          <Ruler className="h-3 w-3" />
          <span>Faixa de KM</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="KM ínicio"
            value={filters.kmStart}
            onChange={(e) => update("kmStart", e.target.value)}
            className="input font-mono"
            style={{ fontSize: 12 }}
          />
          <input
            type="number"
            placeholder="KM fim"
            value={filters.kmEnd}
            onChange={(e) => update("kmEnd", e.target.value)}
            className="input font-mono"
            style={{ fontSize: 12 }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={onApply} className="btn btn-primary shimmer-wrap flex-1" style={{ padding: "9px 14px", fontSize: 12 }}>
          Aplicar filtros
        </button>
        <button onClick={onClear} className="btn btn-ghost" style={{ padding: "9px 14px", fontSize: 12 }}>
          Limpar
        </button>
      </div>
    </div>
  );
}
