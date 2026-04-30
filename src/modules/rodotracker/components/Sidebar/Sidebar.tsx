import { useState } from "react";
import {
  Plus, Search, ArrowLeft, PanelLeftClose, ListFilter, ClipboardList, CalendarRange, Ruler,
} from "lucide-react";
import type { Activity, ContractItem, Filters, Obra } from "../../types/activity";
import { StatsBar } from "./StatsBar";
import { ActivityList } from "./ActivityList";
import { FilterPanel } from "./FilterPanel";

interface SidebarProps {
  obra: Obra;
  onBack: () => void;
  allActivities: Activity[];
  filteredActivities: Activity[];
  contractItems?: ContractItem[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  filtersActive: boolean;
  availableMedicoes: number[];
  onSelectActivity: (activity: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onNewActivity: () => void;
  onCollapse?: () => void;
  onOpenPlanning?: () => void;
  onOpenMeasurement?: () => void;
}

export function Sidebar({
  obra,
  onBack,
  allActivities,
  filteredActivities,
  contractItems,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  filtersActive,
  availableMedicoes,
  onSelectActivity,
  onDeleteActivity,
  onNewActivity,
  onCollapse,
  onOpenPlanning,
  onOpenMeasurement,
}: SidebarProps) {
  const [tab, setTab] = useState<"list" | "filters">("list");

  return (
    <div
      className="flex flex-col h-full relative"
      style={{
        background: "linear-gradient(180deg, var(--bg-raised) 0%, var(--bg-base) 100%)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Top amber edge glow */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, var(--accent-border) 20%, transparent 80%)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        className="shrink-0 relative px-4 sm:px-5 pt-4 pb-3 sm:pt-[18px] sm:pb-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {/* Pull-handle visual no mobile (indica que o painel é arrastável visualmente) */}
        <div
          className="md:hidden absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{ top: 6, width: 36, height: 4, background: "var(--border-strong, rgba(255,255,255,0.18))" }}
          aria-hidden
        />

        <button
          onClick={onBack}
          className="flex items-center gap-1.5 transition-colors"
          style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, fontWeight: 500, minHeight: 28 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Voltar às obras</span>
        </button>

        {onCollapse && (
          <button
            onClick={onCollapse}
            className="absolute rounded-lg flex items-center justify-center"
            style={{
              top: 12, right: 12,
              width: 40, height: 40,
              color: "var(--text-muted)",
              background: "transparent",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent)";
              e.currentTarget.style.background = "var(--accent-faint)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
            title="Minimizar painel"
            aria-label="Minimizar painel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-start gap-2" style={{ paddingRight: 32 }}>
          <h1
            className="flex-1"
            style={{
              fontSize: 16, fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
              lineHeight: 1.25,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {obra.name}
          </h1>
          {obra.lote && (
            <span
              className="font-mono shrink-0"
              style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: "0.06em",
                background: "linear-gradient(180deg, var(--accent-hover), var(--accent))",
                color: "var(--accent-ink)",
                borderRadius: 5,
                padding: "3px 6px",
                textTransform: "uppercase",
                boxShadow: "0 1px 0 rgba(255,255,255,0.25) inset, 0 4px 12px -3px var(--accent-glow)",
              }}
            >
              {obra.lote}
            </span>
          )}
        </div>
        <p
          className="font-mono"
          style={{
            fontSize: 10, color: "var(--text-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: 6,
            wordBreak: "break-word",
          }}
        >
          {[obra.rodovia, obra.trecho].filter(Boolean).join(" · ") || "Acompanhamento de Obra"}
        </p>
      </div>

      {/* Stats */}
      <StatsBar activities={allActivities} />

      {/* Tabs */}
      <div
        className="shrink-0 relative flex"
        style={{ borderBottom: "1px solid var(--border-subtle)", padding: "0 4px" }}
      >
        <TabButton
          active={tab === "list"}
          onClick={() => setTab("list")}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          label="Atividades"
        />
        <TabButton
          active={tab === "filters"}
          onClick={() => setTab("filters")}
          icon={<ListFilter className="h-3.5 w-3.5" />}
          label="Filtros"
          badge={filtersActive}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "list" ? (
          <ActivityList
            activities={filteredActivities}
            contractItems={contractItems}
            onSelect={onSelectActivity}
            onDelete={onDeleteActivity}
          />
        ) : (
          <FilterPanel
            filters={filters}
            onChange={onFiltersChange}
            onApply={onApplyFilters}
            onClear={onClearFilters}
            availableMedicoes={availableMedicoes}
          />
        )}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 relative"
        style={{
          padding: 14,
          borderTop: "1px solid var(--border-subtle)",
          background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.25))",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10 }}
        >
          <span className="flex items-center gap-1.5">
            <span className="font-mono" style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
              {filteredActivities.length.toString().padStart(2, "0")}
            </span>
            <span>atividade{filteredActivities.length !== 1 ? "s" : ""}</span>
          </span>
          {filtersActive && (
            <span
              className="flex items-center gap-1"
              style={{ color: "var(--accent)", fontWeight: 600 }}
            >
              <Search className="h-3 w-3" /> Filtros ativos
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewActivity}
            className="btn btn-primary shimmer-wrap flex-1"
            style={{ padding: "11px 16px" }}
          >
            <Plus className="h-4 w-4" />
            Nova atividade
          </button>
          {onOpenMeasurement && (
            <button
              onClick={onOpenMeasurement}
              className="btn btn-ghost"
              style={{ padding: "11px 12px" }}
              title="Medição (itens do contrato)"
            >
              <Ruler className="h-4 w-4" />
            </button>
          )}
          {onOpenPlanning && (
            <button
              onClick={onOpenPlanning}
              className="btn btn-ghost"
              style={{ padding: "11px 12px" }}
              title="Abrir planejamento (Gantt)"
            >
              <CalendarRange className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex-1 flex items-center justify-center gap-1.5"
      style={{
        padding: "12px 0",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: active ? "var(--accent)" : "var(--text-muted)",
        transition: "color 0.22s var(--ease-out)",
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = "var(--text-secondary)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = "var(--text-muted)";
      }}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span
          style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 6px var(--accent-glow)",
            marginLeft: 2,
          }}
        />
      )}
      {/* Active underline indicator with glow */}
      <span
        aria-hidden
        style={{
          position: "absolute", bottom: -1, left: "50%",
          width: active ? "60%" : "0%",
          height: 2,
          background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
          transform: "translateX(-50%)",
          transition: "width 0.3s var(--ease-spring)",
          borderRadius: 999,
          boxShadow: active ? "0 0 12px var(--accent-glow)" : "none",
        }}
      />
    </button>
  );
}
