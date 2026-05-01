import { useState, useEffect } from "react";
import {
  Plus, Route, FolderOpen, Activity, Pencil, Trash2, ArrowRight, Compass,
  Sparkles, Hash, Tag as TagIcon, FileSignature, Ruler,
} from "lucide-react";
import type { Obra } from "../../types/activity";
import { useObras } from "../../hooks/useObras";
import { countActivitiesByObra } from "../../utils/rodotrackerApi";
import { migrateLocalDataToSupabase } from "../../utils/migrateFromLocal";
import { ObraFormModal } from "./ObraFormModal";
import { Tag } from "../UI/Tag";

interface HomePageProps {
  onOpenObra: (obra: Obra) => void;
}

export function HomePage({ onOpenObra }: HomePageProps) {
  const { obras, addObra, updateObra, deleteObra } = useObras();
  const [showForm, setShowForm] = useState(false);
  const [editObra, setEditObra] = useState<Obra | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSave = (obra: Obra) => {
    if (editObra) updateObra(obra);
    else addObra(obra);
    setShowForm(false);
    setEditObra(null);
  };

  const handleEdit = (obra: Obra) => {
    setEditObra(obra);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteObra(id);
    setDeleteConfirm(null);
  };

  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    countActivitiesByObra().then((m) => {
      if (alive) setActivityCounts(m);
    });
    return () => {
      alive = false;
    };
  }, [obras.length]);

  const totalActivities = Object.values(activityCounts).reduce((s, n) => s + n, 0);
  const totalKm = obras.reduce((sum, o) => {
    if (o.kmInicial != null && o.kmFinal != null) return sum + Math.abs(o.kmFinal - o.kmInicial);
    return sum + (o.extensionKm ?? 0);
  }, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Ambient gradient orbs */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute pulse-glow"
          style={{
            top: -200, right: -150, width: 600, height: 600,
            background: "radial-gradient(circle, rgba(255,176,32,0.10) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: -250, left: -200, width: 700, height: 700,
            background: "radial-gradient(circle, rgba(90,167,255,0.04) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* ── Navbar ── */}
      <header className="anim-nav shrink-0 relative z-10 surface-glass" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
        <div
          className="flex items-center justify-between px-4 sm:px-8"
          style={{ height: 64, maxWidth: 1400, margin: "0 auto" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #ffc04a 0%, #ffb020 60%, #f08a00 100%)",
                boxShadow: "0 0 0 1px rgba(255,176,32,0.35), 0 8px 24px -6px rgba(255,176,32,0.45), 0 1px 0 rgba(255,255,255,0.25) inset",
              }}
            >
              <Route className="h-4 w-4" style={{ color: "var(--accent-ink)" }} />
            </div>
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
                Tre<span style={{ color: "var(--accent)" }}>chos</span>
              </span>
              <span className="label-eyebrow font-mono" style={{ fontSize: 9 }}>v2.8</span>
            </div>
          </div>

          <button
            onClick={() => { setEditObra(null); setShowForm(true); }}
            className="btn btn-primary shimmer-wrap"
            aria-label="Nova obra"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Obra</span>
          </button>
        </div>

        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, var(--accent-border) 30%, var(--border-default) 50%, var(--accent-border) 70%, transparent)",
          }}
        />
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div
          className="flex flex-col min-h-full px-4 sm:px-8 pt-6 sm:pt-10 pb-10 sm:pb-12"
          style={{ maxWidth: 1400, margin: "0 auto" }}
        >
          {/* Hero */}
          <div className="anim-stats" style={{ marginBottom: 28 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              <span className="label-eyebrow">Operations Dashboard</span>
            </div>
            <h1
              className="text-[22px] sm:text-[28px] md:text-[32px]"
              style={{
                fontWeight: 700, letterSpacing: "-0.03em",
                lineHeight: 1.1, color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Do <span style={{ color: "var(--accent)" }}>campo</span> à{" "}
              <span style={{ color: "var(--accent)" }}>medição</span>, num fluxo só.
            </h1>
            <p className="text-[13px] sm:text-sm" style={{ color: "var(--text-secondary)", maxWidth: 640, lineHeight: 1.55 }}>
              Planeje o Gantt da obra, registre atividades em campo com fotos e coordenadas,
              e veja os quantitativos do contrato se atualizarem em tempo real na medição vigente.
            </p>
          </div>

          {/* Stats row */}
          <div className="anim-stats grid gap-3 md:grid-cols-3" style={{ marginBottom: 40 }}>
            <StatCard
              icon={<FolderOpen className="h-4 w-4" />}
              accent="var(--accent)"
              value={obras.length}
              label="Obras"
              subtitle={obras.length === 1 ? "ativa" : "ativas"}
            />
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              accent="var(--info)"
              value={totalActivities}
              label="Atividades registradas"
              subtitle="acumuladas"
            />
            <StatCard
              icon={<Ruler className="h-4 w-4" />}
              accent="var(--success)"
              value={totalKm.toFixed(1)}
              label="Extensão total"
              subtitle="km em monitoramento"
              suffix=" km"
            />
          </div>

          {/* Botão de migração one-shot — só exibe se houver chaves locais */}
          <LocalMigrationBanner
            onDone={() => {
              // Força reload pra carregar dados novos do Supabase
              window.location.reload();
            }}
          />

          {/* Section header */}
          <div className="anim-section flex items-center gap-4" style={{ marginBottom: 18 }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 3, height: 16, borderRadius: 2, background: "var(--accent)", boxShadow: "0 0 10px var(--accent-glow)" }} />
              <h2 className="label-eyebrow" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--text-secondary)" }}>
                Minhas Obras
              </h2>
              <span className="font-mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                · {obras.length.toString().padStart(2, "0")}
              </span>
            </div>
            <div className="flex-1" style={{ height: 1, background: "var(--border-hair)" }} />
          </div>

          {/* Grid or empty */}
          {obras.length === 0 ? (
            <EmptyState onCreate={() => { setEditObra(null); setShowForm(true); }} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {obras.map((obra, i) => {
                const count = activityCounts[obra.id] ?? 0;
                const animClass = i < 3 ? `anim-card-${i + 1}` : "anim-content";
                return (
                  <ObraCard
                    key={obra.id}
                    obra={obra}
                    count={count}
                    animClass={animClass}
                    onOpen={() => onOpenObra(obra)}
                    onEdit={() => handleEdit(obra)}
                    onDelete={() => setDeleteConfirm(obra.id)}
                  />
                );
              })}

              {/* Add card */}
              <button
                onClick={() => { setEditObra(null); setShowForm(true); }}
                className="group relative flex flex-col items-center justify-center gap-3"
                style={{
                  border: "1px dashed var(--border-subtle)",
                  borderRadius: 14,
                  minHeight: 220,
                  transition: "all 0.22s var(--ease-out)",
                  background: "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-border)";
                  e.currentTarget.style.background = "var(--accent-faint)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 48, height: 48,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid var(--border-subtle)",
                    transition: "all 0.22s",
                  }}
                >
                  <Plus className="h-5 w-5 group-hover:text-[var(--accent)]" style={{ color: "var(--text-muted)", transition: "color 0.22s" }} />
                </div>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }} className="group-hover:text-[var(--text-primary)] transition-colors">
                  Cadastrar nova obra
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ObraFormModal
          editObra={editObra}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditObra(null); }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center p-4 animate-fadeIn"
          style={{ background: "rgba(3,5,9,0.78)", backdropFilter: "blur(8px)" }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="animate-slideUp w-full surface-raised"
            style={{ maxWidth: 400, padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-center mx-auto"
              style={{
                width: 44, height: 44, borderRadius: 12,
                background: "var(--danger-dim)",
                marginBottom: 16,
              }}
            >
              <Trash2 className="h-5 w-5" style={{ color: "var(--danger)" }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)", marginBottom: 8, textAlign: "center" }}>
              Excluir Obra
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.55, textAlign: "center" }}>
              Tem certeza? Todas as atividades e fotos desta obra serão excluídas permanentemente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost flex-1">
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="btn flex-1"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.12), transparent 45%), linear-gradient(180deg, #ff6a80, #ff3a54)",
                  color: "white",
                  border: "1px solid rgba(255,90,114,0.6)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.3) inset, 0 10px 24px -8px rgba(255,90,114,0.5)",
                }}
              >
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function StatCard({
  icon,
  accent,
  value,
  label,
  subtitle,
  suffix = "",
}: {
  icon: React.ReactNode;
  accent: string;
  value: number | string;
  label: string;
  subtitle?: string;
  suffix?: string;
}) {
  return (
    <div
      className="surface-raised relative overflow-hidden"
      style={{ padding: "18px 22px" }}
    >
      {/* Accent edge */}
      <div
        style={{
          position: "absolute", top: 0, left: 20, right: 20, height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0.35,
        }}
      />
      <div className="flex items-center gap-4">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 42, height: 42,
            borderRadius: 12,
            background: `${accent}14`,
            border: `1px solid ${accent}22`,
            color: accent,
          }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-mono anim-count"
            style={{
              fontSize: 26, fontWeight: 700, lineHeight: 1,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            {value}
            {suffix && <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginLeft: 2 }}>{suffix}</span>}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginTop: 5 }}>
            {label}
          </div>
          {subtitle && (
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ObraCard({
  obra, count, animClass, onOpen, onEdit, onDelete,
}: {
  obra: Obra;
  count: number;
  animClass: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const extension =
    obra.kmInicial != null && obra.kmFinal != null
      ? Math.abs(obra.kmFinal - obra.kmInicial)
      : obra.extensionKm;

  return (
    <div
      className={`${animClass} group relative cursor-pointer surface-raised edge-accent`}
      onClick={onOpen}
      style={{
        padding: 22,
        transition: "transform 0.22s var(--ease-out), box-shadow 0.22s, border-color 0.22s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "var(--shadow-3), 0 0 0 1px var(--border-default) inset, 0 0 40px -12px var(--accent-glow)";
        e.currentTarget.style.borderColor = "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-2)";
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      {/* Actions */}
      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-lg"
          style={{ color: "var(--text-faint)", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-faint)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.background = "transparent"; }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg"
          style={{ color: "var(--text-faint)", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "var(--danger-dim)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.background = "transparent"; }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Name */}
      <h3
        className="truncate"
        style={{
          fontSize: 16, fontWeight: 600,
          color: "var(--text-primary)",
          letterSpacing: "-0.01em",
          marginBottom: 4,
          paddingRight: 56,
        }}
      >
        {obra.name}
      </h3>
      {obra.tipoObra && (
        <p className="truncate" style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
          {obra.tipoObra}
        </p>
      )}
      {obra.trecho && (
        <p className="truncate" style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          {obra.trecho}
        </p>
      )}

      {/* KM range highlight row */}
      {obra.kmInicial != null && obra.kmFinal != null && (
        <div
          className="flex items-center gap-2 font-mono"
          style={{
            fontSize: 11,
            color: "var(--accent)",
            marginTop: 8, marginBottom: 14,
            padding: "6px 10px",
            borderRadius: 8,
            background: "var(--accent-faint)",
            border: "1px solid var(--accent-border)",
            width: "fit-content",
          }}
        >
          <Hash className="h-3 w-3" style={{ opacity: 0.7 }} />
          <span>KM {obra.kmInicial}</span>
          <ArrowRight className="h-3 w-3" style={{ opacity: 0.6 }} />
          <span>KM {obra.kmFinal}</span>
        </div>
      )}
      {!(obra.kmInicial != null && obra.kmFinal != null) && <div style={{ marginBottom: 14 }} />}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 18 }}>
        {obra.rodovia && <Tag label={obra.rodovia} color="#5aa7ff" size="xs" icon={<Route className="h-2.5 w-2.5" />} />}
        {obra.lote && <Tag label={obra.lote} color="#ffb020" size="xs" icon={<TagIcon className="h-2.5 w-2.5" />} />}
        {obra.contrato && <Tag label={obra.contrato} color="#c084fc" size="xs" icon={<FileSignature className="h-2.5 w-2.5" />} />}
        {extension != null && <Tag label={`${extension.toFixed(2)} km`} color="#2fd3a6" size="xs" icon={<Ruler className="h-2.5 w-2.5" />} />}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 14, borderTop: "1px solid var(--border-hair)" }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="font-mono"
            style={{
              fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
              padding: "2px 7px",
              background: "var(--bg-sunken)",
              borderRadius: 6,
              border: "1px solid var(--border-hair)",
            }}
          >
            {count}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            atividade{count !== 1 ? "s" : ""}
          </span>
        </div>
        <span
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", transition: "opacity 0.22s" }}
        >
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="anim-content flex-1 flex items-center justify-center" style={{ minHeight: 320 }}>
      <div className="text-center" style={{ maxWidth: 420 }}>
        <div className="relative mx-auto mb-7" style={{ width: 92, height: 92 }}>
          <div
            className="pulse-glow absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)" }}
          />
          <div
            className="absolute inset-2 flex items-center justify-center rounded-full"
            style={{
              background: "var(--accent-faint)",
              border: "1px solid var(--accent-border)",
              boxShadow: "0 0 30px -6px var(--accent-glow), 0 1px 0 rgba(255,255,255,0.05) inset",
            }}
          >
            <Compass className="h-10 w-10" style={{ color: "var(--accent)" }} />
          </div>
        </div>

        <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 10 }}>
          Nenhuma obra cadastrada
        </h3>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginBottom: 28 }}>
          Cadastre sua primeira obra para começar a registrar atividades e acompanhar o progresso no mapa.
        </p>
        <button onClick={onCreate} className="btn btn-primary shimmer-wrap" style={{ padding: "12px 22px", fontSize: 14 }}>
          <Plus className="h-4 w-4" />
          Cadastrar Primeira Obra
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── LocalMigrationBanner ─────────────────── */

/**
 * Só retorna true se houver **dados** no localStorage — obras, atividades,
 * plan items, contract items ou medicao. Ignora chaves de preferência de
 * UI como `rodotracker-sidebar-width`.
 */
function hasLocalRodotrackerData(): boolean {
  const DATA_PREFIXES = [
    "rodotracker-obras",
    "rodotracker-activities-",
    "rodotracker-plan-",
    "rodotracker-contract-",
    "rodotracker-medicao-current-",
  ];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (DATA_PREFIXES.some((p) => k === p || k.startsWith(p))) return true;
  }
  return false;
}

function LocalMigrationBanner({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(() => hasLocalRodotrackerData());
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string>("");

  if (!visible) return null;

  const run = async () => {
    setRunning(true);
    setMsg("Iniciando migração...");
    try {
      await migrateLocalDataToSupabase((m) => setMsg(m));
      setMsg("Sucesso! Limpando localStorage antigo...");
      // Remove só as chaves de DADOS — preserva preferências de UI como
      // `rodotracker-sidebar-width`.
      const DATA_PREFIXES = [
        "rodotracker-obras",
        "rodotracker-activities-",
        "rodotracker-plan-",
        "rodotracker-contract-",
        "rodotracker-medicao-current-",
      ];
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (DATA_PREFIXES.some((p) => k === p || k.startsWith(p))) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
      onDone();
    } catch (e) {
      console.error(e);
      setMsg("Erro: " + ((e as Error).message ?? String(e)));
      setRunning(false);
    }
  };

  return (
    <div
      className="anim-content"
      style={{
        marginBottom: 28,
        padding: 16,
        borderRadius: "var(--r-lg)",
        border: "1px solid rgba(90,167,255,0.35)",
        background: "linear-gradient(180deg, rgba(90,167,255,0.10), rgba(90,167,255,0.03))",
      }}
    >
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
        <div className="flex-1">
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            Dados locais detectados
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Você ainda tem obras/atividades/fotos salvos localmente neste navegador. Enviar tudo
            pro Supabase agora garante que os dados estejam no servidor e acessíveis em qualquer
            aparelho onde você logar.
          </div>
          {msg && (
            <div
              className="font-mono"
              style={{
                marginTop: 8, fontSize: 11, color: "var(--info)",
                background: "var(--bg-sunken)", padding: "6px 10px", borderRadius: 6,
                border: "1px solid var(--border-subtle)",
              }}
            >
              {msg}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!running && (
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "6px 10px" }}
            >
              Depois
            </button>
          )}
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="btn"
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: "linear-gradient(180deg, rgba(90,167,255,0.25), rgba(90,167,255,0.10))",
              border: "1px solid rgba(90,167,255,0.55)",
              color: "var(--info)",
              opacity: running ? 0.7 : 1,
              cursor: running ? "wait" : "pointer",
            }}
          >
            {running ? "Enviando..." : "Enviar pro Supabase"}
          </button>
        </div>
      </div>
    </div>
  );
}
