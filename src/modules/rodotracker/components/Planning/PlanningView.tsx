import { useMemo, useState, useRef, useEffect } from "react";
import {
  X, Plus, CalendarRange, Sparkles, ChevronLeft, ChevronRight, Maximize2,
} from "lucide-react";
import type { Obra, PlanItem } from "../../types/activity";
import { PLAN_STATUS_OPTIONS } from "../../types/activity";
import { serviceColors } from "../../utils/colors";
import { formatDate } from "../../utils/format";
import { usePlanItems } from "../../hooks/usePlanItems";
import { PlanItemFormModal } from "./PlanItemFormModal";

interface PlanningViewProps {
  obra: Obra;
  onClose: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH_DEFAULT = 28; // pixels per day
const TASK_COL_WIDTH = 240;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 56;

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).toUpperCase();
}

function computeRange(items: PlanItem[]): { start: Date; end: Date } {
  if (items.length === 0) {
    const today = new Date();
    const start = startOfMonth(today);
    const end = endOfMonth(addDays(today, 60));
    return { start, end };
  }
  const starts = items.map((i) => parseDate(i.startDate).getTime());
  const ends = items.map((i) => parseDate(i.endDate).getTime());
  const minStart = new Date(Math.min(...starts));
  const maxEnd = new Date(Math.max(...ends));
  return {
    start: startOfMonth(addDays(minStart, -7)),
    end: endOfMonth(addDays(maxEnd, 14)),
  };
}

export function PlanningView({ obra, onClose }: PlanningViewProps) {
  const { items, addItem, updateItem, deleteItem } = usePlanItems(obra.id);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<PlanItem | null>(null);
  const [dayWidth, setDayWidth] = useState(DAY_WIDTH_DEFAULT);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => computeRange(items), [items]);
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const timelineWidth = totalDays * dayWidth;

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [items]
  );

  const months = useMemo(() => {
    const out: { start: number; width: number; label: string }[] = [];
    let cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      const monthStart = startOfMonth(cursor);
      const monthEnd = endOfMonth(cursor);
      const effectiveStart = monthStart < rangeStart ? rangeStart : monthStart;
      const effectiveEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;
      const startOffset = daysBetween(rangeStart, effectiveStart);
      const width = (daysBetween(effectiveStart, effectiveEnd) + 1) * dayWidth;
      out.push({
        start: startOffset * dayWidth,
        width,
        label: formatMonth(cursor),
      });
      cursor = addDays(endOfMonth(cursor), 1);
    }
    return out;
  }, [rangeStart, rangeEnd, dayWidth]);

  // Day grid (weekends highlighted)
  const dayTicks = useMemo(() => {
    const out: { x: number; dayOfWeek: number; isToday: boolean; dayOfMonth: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i);
      out.push({
        x: i * dayWidth,
        dayOfWeek: d.getDay(),
        isToday: d.getTime() === today.getTime(),
        dayOfMonth: d.getDate(),
      });
    }
    return out;
  }, [rangeStart, totalDays, dayWidth]);

  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = daysBetween(rangeStart, today);
    if (diff < 0 || diff >= totalDays) return null;
    return diff * dayWidth;
  }, [rangeStart, totalDays, dayWidth]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showForm) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, showForm]);

  // Center today on first render when possible
  useEffect(() => {
    if (todayOffset == null || !timelineScrollRef.current) return;
    const el = timelineScrollRef.current;
    el.scrollLeft = Math.max(0, todayOffset - el.clientWidth * 0.3);
  }, [todayOffset]);

  const handleBarClick = (item: PlanItem) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleNewClick = () => {
    setEditItem(null);
    setShowForm(true);
  };

  const handleSave = (item: PlanItem) => {
    if (items.some((i) => i.id === item.id)) {
      updateItem(item);
    } else {
      addItem(item);
    }
    setShowForm(false);
    setEditItem(null);
  };

  const handleDelete = (id: string) => {
    deleteItem(id);
    setShowForm(false);
    setEditItem(null);
  };

  return (
    <div
      className="fixed inset-0 z-[3000] flex flex-col animate-fadeIn"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          padding: "14px 22px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "linear-gradient(180deg, rgba(24,29,40,0.9), rgba(13,16,23,0.9))",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 36, height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent-hover), var(--accent))",
              boxShadow: "0 0 0 1px var(--accent-border), 0 6px 18px -4px var(--accent-glow)",
            }}
          >
            <CalendarRange className="h-4 w-4" style={{ color: "var(--accent-ink)" }} />
          </div>
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
              <Sparkles className="h-3 w-3" style={{ color: "var(--accent)" }} />
              <span className="label-eyebrow" style={{ fontSize: 10 }}>Planejamento</span>
            </div>
            <h1
              style={{
                fontSize: 16, fontWeight: 700,
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              {obra.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-md)",
              padding: 2,
            }}
          >
            <button
              onClick={() => setDayWidth((w) => Math.max(12, w - 4))}
              className="btn-icon"
              style={{ padding: 6 }}
              title="Reduzir zoom"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="label-eyebrow font-mono" style={{ padding: "0 8px", fontSize: 9 }}>
              {dayWidth}px/dia
            </span>
            <button
              onClick={() => setDayWidth((w) => Math.min(64, w + 4))}
              className="btn-icon"
              style={{ padding: 6 }}
              title="Aumentar zoom"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              if (todayOffset != null && timelineScrollRef.current) {
                timelineScrollRef.current.scrollTo({
                  left: Math.max(0, todayOffset - timelineScrollRef.current.clientWidth * 0.3),
                  behavior: "smooth",
                });
              }
            }}
            className="btn btn-ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            Hoje
          </button>
          <button onClick={handleNewClick} className="btn btn-primary shimmer-wrap" style={{ padding: "9px 16px", fontSize: 13 }}>
            <Plus className="h-4 w-4" />
            Nova atividade
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body: task list + Gantt */}
      {sortedItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center" style={{ maxWidth: 420 }}>
            <div
              className="flex items-center justify-center mx-auto pulse-glow"
              style={{
                width: 72, height: 72,
                borderRadius: "50%",
                background: "var(--accent-faint)",
                border: "1px solid var(--accent-border)",
                marginBottom: 18,
              }}
            >
              <CalendarRange className="h-8 w-8" style={{ color: "var(--accent)" }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Cronograma vazio
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 22 }}>
              Adicione atividades planejadas com data de início e fim. O Gantt vai construir automaticamente a linha do tempo.
            </p>
            <button onClick={handleNewClick} className="btn btn-primary shimmer-wrap" style={{ padding: "10px 20px", fontSize: 13 }}>
              <Plus className="h-4 w-4" />
              Primeira atividade
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Task list (fixed left column) */}
          <div
            className="shrink-0 flex flex-col"
            style={{
              width: TASK_COL_WIDTH,
              borderRight: "1px solid var(--border-subtle)",
              background: "rgba(255,255,255,0.015)",
            }}
          >
            <div
              className="shrink-0 flex items-center"
              style={{
                height: HEADER_HEIGHT,
                padding: "0 14px",
                borderBottom: "1px solid var(--border-subtle)",
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                background: "rgba(13,16,23,0.5)",
              }}
            >
              Atividade
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedItems.map((item) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  onClick={() => handleBarClick(item)}
                />
              ))}
            </div>
          </div>

          {/* Gantt timeline (scrollable right area) */}
          <div className="flex-1 overflow-auto" ref={timelineScrollRef}>
            <div style={{ width: timelineWidth, minWidth: "100%" }}>
              {/* Timeline header */}
              <div
                className="sticky top-0 z-10"
                style={{
                  height: HEADER_HEIGHT,
                  background: "rgba(13,16,23,0.95)",
                  backdropFilter: "blur(10px)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {/* Month labels */}
                <div style={{ height: 28, position: "relative" }}>
                  {months.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: m.start, width: m.width,
                        top: 0, height: 28,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.1em",
                        color: "var(--text-secondary)",
                        borderRight: "1px solid var(--border-hair)",
                      }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* Day ticks */}
                <div style={{ height: 28, position: "relative", borderTop: "1px solid var(--border-hair)" }}>
                  {dayTicks.map((d, i) => {
                    if (dayWidth < 22 && d.dayOfWeek !== 1) return null; // show only Mondays when zoomed out
                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: d.x, width: dayWidth,
                          top: 0, height: 28,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          fontWeight: d.isToday ? 700 : 500,
                          color: d.isToday
                            ? "var(--accent)"
                            : d.dayOfWeek === 0 || d.dayOfWeek === 6
                            ? "var(--text-faint)"
                            : "var(--text-muted)",
                          borderLeft: i === 0 ? "none" : "1px solid var(--border-hair)",
                        }}
                      >
                        {d.dayOfMonth}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows */}
              <div style={{ position: "relative" }}>
                {/* Weekend backgrounds */}
                {dayTicks.map(
                  (d, i) =>
                    (d.dayOfWeek === 0 || d.dayOfWeek === 6) && (
                      <div
                        key={`w-${i}`}
                        style={{
                          position: "absolute",
                          left: d.x, width: dayWidth,
                          top: 0, bottom: 0,
                          background: "rgba(255,255,255,0.02)",
                          pointerEvents: "none",
                        }}
                      />
                    )
                )}
                {/* Today line */}
                {todayOffset != null && (
                  <div
                    style={{
                      position: "absolute",
                      left: todayOffset + dayWidth / 2, top: 0, bottom: 0,
                      width: 0,
                      borderLeft: "2px dashed var(--accent)",
                      zIndex: 3,
                      boxShadow: "0 0 14px var(--accent-glow)",
                      pointerEvents: "none",
                    }}
                  />
                )}

                {sortedItems.map((item) => (
                  <GanttRow
                    key={item.id}
                    item={item}
                    rangeStart={rangeStart}
                    dayWidth={dayWidth}
                    onClick={() => handleBarClick(item)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <PlanItemFormModal
          obraId={obra.id}
          editItem={editItem}
          onSave={handleSave}
          onDelete={editItem ? handleDelete : undefined}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

function TaskRow({ item, onClick }: { item: PlanItem; onClick: () => void }) {
  const color = item.color ?? (item.service ? serviceColors[item.service] : "var(--accent)");
  const statusOpt = PLAN_STATUS_OPTIONS.find((o) => o.value === item.status);
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        width: "100%",
        height: ROW_HEIGHT,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: "1px solid var(--border-hair)",
        background: "transparent",
        cursor: "pointer",
        transition: "background 0.18s",
        textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div
        style={{
          width: 3, alignSelf: "stretch", margin: "8px 0",
          background: color,
          borderRadius: 2,
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="truncate"
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}
        >
          {item.name}
        </div>
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}
        >
          <span className="font-mono">{formatDate(item.startDate)} — {formatDate(item.endDate)}</span>
          {statusOpt && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 999,
                background: `${statusOpt.color}20`,
                color: statusOpt.color,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {statusOpt.label}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function GanttRow({
  item, rangeStart, dayWidth, onClick,
}: {
  item: PlanItem;
  rangeStart: Date;
  dayWidth: number;
  onClick: () => void;
}) {
  const color = item.color ?? (item.service ? serviceColors[item.service] : "#ffb020");
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);
  const offset = daysBetween(rangeStart, start) * dayWidth;
  const width = Math.max(dayWidth, (daysBetween(start, end) + 1) * dayWidth);
  const progressW = Math.max(0, Math.min(100, item.progress)) / 100 * width;
  const statusOpt = PLAN_STATUS_OPTIONS.find((o) => o.value === item.status);

  return (
    <div
      style={{
        position: "relative",
        height: ROW_HEIGHT,
        borderBottom: "1px solid var(--border-hair)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        title={`${item.name} · ${formatDate(item.startDate)} → ${formatDate(item.endDate)}`}
        style={{
          position: "absolute",
          left: offset, top: 8,
          width, height: ROW_HEIGHT - 16,
          borderRadius: 8,
          background: `linear-gradient(180deg, ${color}cc, ${color}99)`,
          border: `1px solid ${color}`,
          boxShadow: `0 2px 10px -2px ${color}55, 0 1px 0 rgba(255,255,255,0.18) inset`,
          cursor: "pointer",
          overflow: "hidden",
          padding: 0,
          transition: "transform 0.18s var(--ease-spring), box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = `0 4px 14px -2px ${color}77, 0 0 0 1px ${color}, 0 1px 0 rgba(255,255,255,0.2) inset`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = `0 2px 10px -2px ${color}55, 0 1px 0 rgba(255,255,255,0.18) inset`;
        }}
      >
        {/* Progress fill */}
        {item.progress > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0, width: progressW,
              background: "linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.08))",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Label */}
        <div
          style={{
            position: "relative",
            display: "flex", alignItems: "center",
            height: "100%",
            padding: "0 10px",
            gap: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {statusOpt && item.status !== "todo" && (
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: statusOpt.color,
                boxShadow: `0 0 6px ${statusOpt.color}`,
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontSize: 11, fontWeight: 700,
              color: "#0a0d14",
              letterSpacing: "-0.005em",
              textShadow: "0 1px 0 rgba(255,255,255,0.3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
            }}
          >
            {item.name}
          </span>
          {item.progress > 0 && (
            <span
              className="font-mono"
              style={{
                fontSize: 10, fontWeight: 700,
                color: "#0a0d14",
                opacity: 0.75,
                flexShrink: 0,
              }}
            >
              {item.progress}%
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

// Suppress unused-import lint (icon only imported for future toolbar button)
void Maximize2;
