import { useState, useCallback, useEffect } from "react";
import { PanelLeftOpen } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./rodotracker.css";
import type { Activity, Obra } from "./types/activity";
import { useActivities } from "./hooks/useActivities";
import { useFilters } from "./hooks/useFilters";
import { HomePage } from "./components/Home/HomePage";
import { MapView } from "./components/Map/MapView";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ActivityFormModal } from "./components/Modals/ActivityFormModal";
import { ActivityDetailModal } from "./components/Modals/ActivityDetailModal";
import { PlanningView } from "./components/Planning/PlanningView";
import { MeasurementView } from "./components/Measurement/MeasurementView";
import { useContractItems } from "./hooks/useContractItems";

function TrackerView({ obra, onBack }: { obra: Obra; onBack: () => void }) {
  const { activities, addActivity, updateActivity, deleteActivity } = useActivities(obra.id);
  const { items: contractItems, replaceAll: replaceContract } = useContractItems(obra.id);
  const {
    filters,
    setFilters,
    filtered,
    isActive: filtersActive,
    applyFilters,
    clearFilters,
    availableMedicoes,
  } = useFilters(activities);

  const [isAdding, setIsAdding] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [showMeasurement, setShowMeasurement] = useState(false);

  useEffect(() => {
    let raf = 0;
    const end = Date.now() + 400;
    const pump = () => {
      window.dispatchEvent(new Event("resize"));
      if (Date.now() < end) raf = requestAnimationFrame(pump);
    };
    pump();
    return () => cancelAnimationFrame(raf);
  }, [sidebarCollapsed]);
  const [tempMarker, setTempMarker] = useState<[number, number] | null>(null);
  const [showForm, setShowForm] = useState(false);
  // Picking = usuário está escolhendo uma coord NO MAPA enquanto o form está
  // aberto. Manter o form montado preserva o estado interno (pickTarget,
  // lat/lng já preenchidos, etc.) pra que múltiplos picks sequenciais
  // funcionem corretamente (ex: Marcar Início → pick → Marcar Fim → pick).
  const [isPicking, setIsPicking] = useState(false);
  const [formCoords, setFormCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [focusCoord, setFocusCoord] = useState<[number, number] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleNewActivity = useCallback(() => {
    setEditActivity(null);
    setShowForm(true);
    setFormCoords(null);
    setTempMarker(null);
    setIsAdding(false);
  }, []);

  const handlePickOnMap = useCallback(() => {
    // Não desmonta o form — apenas entra em modo de pick.
    // O modal se esconde visualmente via prop `isPicking`, preservando
    // todo o estado interno (coordenadas já inseridas, pickTarget, etc.).
    setIsPicking(true);
    setTempMarker(null);
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (isPicking) {
        setTempMarker([lat, lng]);
        setFormCoords({ lat, lng });
        setIsPicking(false);
        return;
      }
      if (!isAdding) return;
      setTempMarker([lat, lng]);
      setFormCoords({ lat, lng });
      setIsAdding(false);
      setShowForm(true);
    },
    [isAdding, isPicking]
  );

  const handleSave = useCallback(
    (activity: Activity) => {
      const existing = activities.find((a) => a.id === activity.id);

      // Apply delta to contract currentQty (Troca de Solo + CBUQ — códigos distintos)
      const oldContrib: Record<string, number> = {
        ...(existing?.trocaSolo?.contributions ?? {}),
        ...(existing?.cbuq?.contributions ?? {}),
      };
      const newContrib: Record<string, number> = {
        ...(activity.trocaSolo?.contributions ?? {}),
        ...(activity.cbuq?.contributions ?? {}),
      };
      const allCodes = new Set<string>([
        ...Object.keys(oldContrib),
        ...Object.keys(newContrib),
      ]);
      if (allCodes.size > 0 && contractItems.length > 0) {
        const updatedContract = contractItems.map((ci) => {
          const code = ci.code ?? "";
          if (!code || !allCodes.has(code)) return ci;
          const delta = (newContrib[code] ?? 0) - (oldContrib[code] ?? 0);
          if (delta === 0) return ci;
          return {
            ...ci,
            currentQty: Math.max(0, (ci.currentQty ?? 0) + delta),
            updatedAt: Date.now(),
          };
        });
        replaceContract(updatedContract);
      }

      if (existing) {
        updateActivity(activity);
      } else {
        addActivity(activity);
      }
      setShowForm(false);
      setFormCoords(null);
      setEditActivity(null);
      setTempMarker(null);
      setIsPicking(false);
    },
    [activities, addActivity, updateActivity, contractItems, replaceContract, obra.id]
  );

  const handleMoveActivity = useCallback(
    (id: string, lat: number, lng: number) => {
      const existing = activities.find((a) => a.id === id);
      if (!existing) return;
      updateActivity({ ...existing, lat, lng, updatedAt: Date.now() });
    },
    [activities, updateActivity]
  );

  const handleMoveAreaLabel = useCallback(
    (id: string, lat: number, lng: number) => {
      const existing = activities.find((a) => a.id === id);
      if (!existing?.areaRect) return;
      updateActivity({
        ...existing,
        areaRect: { ...existing.areaRect, totalLabelPos: [lat, lng] },
        updatedAt: Date.now(),
      });
    },
    [activities, updateActivity]
  );

  const handleMoveAreaCorners = useCallback(
    (id: string, corners: [number, number][]) => {
      const existing = activities.find((a) => a.id === id);
      if (!existing?.areaRect) return;
      updateActivity({
        ...existing,
        areaRect: { ...existing.areaRect, corners },
        updatedAt: Date.now(),
      });
    },
    [activities, updateActivity]
  );

  const handleSelectActivity = useCallback((activity: Activity) => {
    setDetailActivity(activity);
    setFocusCoord([activity.lat, activity.lng]);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      // Rollback TS + CBUQ contributions before deleting
      const target = activities.find((a) => a.id === id);
      const contrib: Record<string, number> = {
        ...(target?.trocaSolo?.contributions ?? {}),
        ...(target?.cbuq?.contributions ?? {}),
      };
      if (Object.keys(contrib).length > 0 && contractItems.length > 0) {
        const updated = contractItems.map((ci) => {
          const code = ci.code ?? "";
          const delta = code ? (contrib[code] ?? 0) : 0;
          if (delta === 0) return ci;
          return {
            ...ci,
            currentQty: Math.max(0, (ci.currentQty ?? 0) - delta),
            updatedAt: Date.now(),
          };
        });
        replaceContract(updated);
      }
      await deleteActivity(id);
      setDeleteConfirm(null);
      if (detailActivity?.id === id) setDetailActivity(null);
    },
    [activities, contractItems, replaceContract, deleteActivity, detailActivity]
  );

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setFormCoords(null);
    setEditActivity(null);
    setTempMarker(null);
    setIsAdding(false);
    setIsPicking(false);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#0f1117] overflow-hidden">
      <div
        className={`shrink-0 order-2 md:order-1 overflow-hidden ${
          sidebarCollapsed
            ? "w-full md:w-0 h-0 md:h-full"
            : "w-full md:w-[380px] h-[50vh] md:h-full"
        }`}
      >
        <Sidebar
          obra={obra}
          onBack={onBack}
          allActivities={activities}
          filteredActivities={filtered}
          contractItems={contractItems}
          filters={filters}
          onFiltersChange={setFilters}
          onApplyFilters={applyFilters}
          onClearFilters={clearFilters}
          filtersActive={filtersActive}
          availableMedicoes={availableMedicoes}
          onSelectActivity={handleSelectActivity}
          onDeleteActivity={(id) => setDeleteConfirm(id)}
          onNewActivity={handleNewActivity}
          onCollapse={() => setSidebarCollapsed(true)}
          onOpenPlanning={() => setShowPlanning(true)}
          onOpenMeasurement={() => setShowMeasurement(true)}
        />
      </div>

      <div className="flex-1 h-[50vh] md:h-full order-1 md:order-2 relative">
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute z-[1100] flex items-center gap-1.5 group"
            style={{
              top: 12, left: 12,
              padding: "8px 12px",
              background: "rgba(19, 23, 31, 0.82)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-md)",
              color: "var(--text-secondary)",
              backdropFilter: "blur(18px) saturate(140%)",
              WebkitBackdropFilter: "blur(18px) saturate(140%)",
              boxShadow: "var(--shadow-3)",
              transition: "all 0.2s var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent)";
              e.currentTarget.style.borderColor = "var(--accent-border)";
              e.currentTarget.style.boxShadow = "var(--shadow-3), 0 0 20px -6px var(--accent-glow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.boxShadow = "var(--shadow-3)";
            }}
            title="Expandir painel"
          >
            <PanelLeftOpen className="h-4 w-4" />
            <span
              className="hidden sm:inline"
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Atividades
            </span>
          </button>
        )}
        <MapView
          activities={filtered}
          isAdding={isAdding || isPicking}
          onMapClick={handleMapClick}
          onSelectActivity={handleSelectActivity}
          onMoveActivity={handleMoveActivity}
          onMoveAreaLabel={handleMoveAreaLabel}
          onMoveAreaCorners={handleMoveAreaCorners}
          tempMarker={tempMarker}
          focusCoord={focusCoord}
          selectedActivityId={detailActivity?.id ?? null}
          sidebarCollapsed={sidebarCollapsed}
          center={[obra.centerLat, obra.centerLng]}
          zoom={obra.zoom}
          obra={obra}
        />
      </div>

      {showForm && (
        <ActivityFormModal
          lat={formCoords?.lat ?? 0}
          lng={formCoords?.lng ?? 0}
          hasMapCoords={formCoords !== null}
          hidden={isPicking}
          obra={obra}
          editActivity={editActivity}
          activities={activities}
          onPickOnMap={handlePickOnMap}
          onSave={handleSave}
          onClose={handleCloseForm}
        />
      )}

      {showPlanning && (
        <PlanningView obra={obra} onClose={() => setShowPlanning(false)} />
      )}

      {showMeasurement && (
        <MeasurementView obra={obra} onClose={() => setShowMeasurement(false)} />
      )}

      {detailActivity && (
        <ActivityDetailModal
          activity={detailActivity}
          contractItems={contractItems}
          onEdit={() => {
            const act = detailActivity;
            setDetailActivity(null);
            setTimeout(() => {
              setEditActivity(act);
              setFormCoords({ lat: act.lat, lng: act.lng });
              setShowForm(true);
            }, 50);
          }}
          onClose={() => setDetailActivity(null)}
        />
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[3000] bg-black/60 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-[#181b23] border border-[#2e3345] rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#e8eaf0] mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-[#9198ad] mb-5">
              Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-[#1f2230] hover:bg-[#2e3345] text-[#9198ad] rounded-lg py-2.5 text-sm border border-[#2e3345] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RodoTrackerPage() {
  const [currentObra, setCurrentObra] = useState<Obra | null>(null);

  return (
    <div className="rodotracker-root">
      {!currentObra ? (
        <HomePage onOpenObra={setCurrentObra} />
      ) : (
        <TrackerView
          key={currentObra.id}
          obra={currentObra}
          onBack={() => setCurrentObra(null)}
        />
      )}
    </div>
  );
}
