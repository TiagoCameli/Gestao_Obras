import { useEffect, useState } from "react";
import { X, Save, Trash2 } from "lucide-react";
import type { PlanItem, ServiceType } from "../../types/activity";
import { SERVICE_TYPES, PLAN_STATUS_OPTIONS } from "../../types/activity";
import { serviceColors } from "../../utils/colors";
import { generateId, todayISO } from "../../utils/format";

interface PlanItemFormModalProps {
  obraId: string;
  editItem?: PlanItem | null;
  onSave: (item: PlanItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function PlanItemFormModal({
  obraId,
  editItem,
  onSave,
  onDelete,
  onClose,
}: PlanItemFormModalProps) {
  const [name, setName] = useState(editItem?.name ?? "");
  const [service, setService] = useState<ServiceType | "">(editItem?.service ?? "");
  const [startDate, setStartDate] = useState(editItem?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(editItem?.endDate ?? todayISO());
  const [progress, setProgress] = useState(editItem?.progress ?? 0);
  const [status, setStatus] = useState<PlanItem["status"]>(editItem?.status ?? "todo");
  const [notes, setNotes] = useState(editItem?.notes ?? "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (endDate < startDate) {
      alert("A data final não pode ser anterior à data inicial.");
      return;
    }
    const now = Date.now();
    onSave({
      id: editItem?.id ?? generateId(),
      obraId,
      name: name.trim(),
      service: service || undefined,
      startDate,
      endDate,
      progress,
      status,
      notes: notes.trim() || undefined,
      color: service ? serviceColors[service as ServiceType] : undefined,
      createdAt: editItem?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[3500] flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: "rgba(3,5,9,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto animate-slideUp"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.025), transparent 30%), var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-2xl)",
          boxShadow: "var(--shadow-4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between sticky top-0 z-10"
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "linear-gradient(180deg, rgba(24,29,40,0.95), rgba(24,29,40,0.82))",
            backdropFilter: "blur(12px)",
          }}
        >
          <div>
            <div className="label-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>
              {editItem ? "Edição" : "Novo"}
            </div>
            <h2
              style={{
                fontSize: 18, fontWeight: 700,
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
                lineHeight: 1.1,
              }}
            >
              {editItem ? "Editar planejamento" : "Nova atividade planejada"}
            </h2>
          </div>
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
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" style={{ padding: "22px 24px 24px" }}>
          <div>
            <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Nome da atividade
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Asfaltamento KM 620-640"
              required
              autoFocus
              className="input"
            />
          </div>

          <div>
            <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Tipo de serviço
            </label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value as ServiceType | "")}
              className="input"
              style={{ fontSize: 13 }}
            >
              <option value="">— Sem vínculo —</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {service && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div
                  style={{
                    width: 10, height: 10, borderRadius: "50%",
                    backgroundColor: serviceColors[service as ServiceType],
                    boxShadow: `0 0 8px ${serviceColors[service as ServiceType]}`,
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Cor da barra no cronograma
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
                Fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input font-mono"
              />
            </div>
          </div>

          <div>
            <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Status
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {PLAN_STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    style={{
                      fontSize: 10, fontWeight: 600,
                      padding: "8px 4px",
                      borderRadius: "var(--r-md)",
                      border: `1px solid ${active ? opt.color + "88" : "var(--border-subtle)"}`,
                      background: active ? `${opt.color}1a` : "var(--bg-sunken)",
                      color: active ? opt.color : "var(--text-muted)",
                      cursor: "pointer",
                      transition: "all 0.18s",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              className="label-eyebrow flex items-center justify-between"
              style={{ marginBottom: 6 }}
            >
              <span>Progresso</span>
              <span className="font-mono" style={{ color: "var(--accent)", fontSize: 11 }}>
                {progress}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value, 10))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>

          <div>
            <label className="label-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Observações
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes, riscos, dependências..."
              className="input"
              style={{ resize: "vertical", minHeight: 64 }}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            {editItem && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Excluir esta atividade do planejamento?")) {
                    onDelete(editItem.id);
                  }
                }}
                className="btn btn-ghost"
                style={{
                  color: "var(--danger)",
                  borderColor: "rgba(255, 90, 114, 0.3)",
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button type="submit" className="btn btn-primary shimmer-wrap flex-1">
              <Save className="h-4 w-4" />
              {editItem ? "Salvar alterações" : "Adicionar ao cronograma"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
