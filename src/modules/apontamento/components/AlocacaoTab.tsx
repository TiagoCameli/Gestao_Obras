import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import {
  useAlocarFuncionarios,
  useCreateEquipe,
  useDeleteEquipe,
  useEquipesApont,
  useFuncionarios,
  useObrasApont,
  useUpdateEquipe,
} from "../hooks/useApontamentoData";
import type { Equipe, Funcionario, Obra } from "../types/funcionario";

export default function AlocacaoTab() {
  return <EquipesView />;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Equipes & alocação                                                     */
/* ────────────────────────────────────────────────────────────────────── */

function EquipesView() {
  const { data: obras = [] } = useObrasApont();
  const { data: equipes = [] } = useEquipesApont();
  const { data: funcionarios = [] } = useFuncionarios();

  const createEq = useCreateEquipe();
  const updateEq = useUpdateEquipe();
  const removeEq = useDeleteEquipe();
  const alocar = useAlocarFuncionarios();

  const [modalEq, setModalEq] = useState<{
    open: boolean;
    edit: Equipe | null;
  }>({ open: false, edit: null });
  const [deleteEqId, setDeleteEqId] = useState<string | null>(null);
  const [alocandoEquipe, setAlocandoEquipe] = useState<Equipe | null>(null);

  const obraNome = useMemo(
    () => Object.fromEntries(obras.map((o) => [o.id, o.nome])),
    [obras]
  );

  const funcsAtivos = useMemo(
    () => funcionarios.filter((f) => f.status === "ativo"),
    [funcionarios]
  );
  const funcsPorEquipe = useMemo(() => {
    const m: Record<string, Funcionario[]> = {};
    funcsAtivos.forEach((f) => {
      const k = f.equipeId ?? "_sem_equipe";
      (m[k] ??= []).push(f);
    });
    return m;
  }, [funcsAtivos]);

  const semEquipe = funcsPorEquipe._sem_equipe ?? [];

  if (obras.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
        Nenhuma obra encontrada. Cadastre suas obras no módulo{" "}
        <Link
          to="/medicao"
          className="text-[var(--color-accent)] underline underline-offset-2"
        >
          Medição
        </Link>{" "}
        antes de criar equipes.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Gerencie equipes por obra e aloque funcionários.
        </p>
        <Button onClick={() => setModalEq({ open: true, edit: null })}>
          Nova equipe
        </Button>
      </div>

      {/* Funcionários sem equipe */}
      {semEquipe.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
            Sem alocação ({semEquipe.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {semEquipe.map((f) => (
              <FuncBadge
                key={f.id}
                f={f}
                onMove={(equipeId) => {
                  const eq = equipes.find((e) => e.id === equipeId);
                  if (!eq) return;
                  alocar.mutate({
                    funcionarioIds: [f.id],
                    equipeId: eq.id,
                    obraId: eq.obraId,
                  });
                }}
                equipes={equipes}
                obraNome={obraNome}
              />
            ))}
          </div>
        </section>
      )}

      {/* Equipes */}
      {equipes.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
          Nenhuma equipe ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {equipes.map((eq) => {
            const membros = funcsPorEquipe[eq.id] ?? [];
            const encarregado = membros.find((m) => m.id === eq.encarregadoId);
            return (
              <section
                key={eq.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4"
              >
                <header className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-base font-semibold text-[var(--color-fg)]">
                      {eq.nome}
                    </h4>
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      Obra: {obraNome[eq.obraId] ?? "—"} · {membros.length}{" "}
                      {membros.length === 1 ? "membro" : "membros"}
                      {encarregado && ` · Encarregado: ${encarregado.nome}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setAlocandoEquipe(eq)}
                      className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-accent)]"
                    >
                      Alocar
                    </button>
                    <button
                      onClick={() => setModalEq({ open: true, edit: eq })}
                      className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteEqId(eq.id)}
                      className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-danger)]"
                    >
                      Excluir
                    </button>
                  </div>
                </header>

                {membros.length === 0 ? (
                  <p className="text-xs text-[var(--color-fg-subtle)] italic">
                    Sem membros. Clique em "Alocar".
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {membros.map((f) => (
                      <FuncBadge
                        key={f.id}
                        f={f}
                        isEncarregado={f.id === eq.encarregadoId}
                        onSetEncarregado={() =>
                          updateEq.mutate({ ...eq, encarregadoId: f.id })
                        }
                        onRemove={() =>
                          alocar.mutate({
                            funcionarioIds: [f.id],
                            equipeId: null,
                            obraId: null,
                            encarregadoId: null,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={modalEq.open}
        onClose={() => setModalEq({ open: false, edit: null })}
        title={modalEq.edit ? "Editar equipe" : "Nova equipe"}
      >
        <EquipeForm
          initial={modalEq.edit}
          obras={obras}
          onCancel={() => setModalEq({ open: false, edit: null })}
          onSubmit={async (e) => {
            if (modalEq.edit) {
              await updateEq.mutateAsync({ ...modalEq.edit, ...e });
            } else {
              await createEq.mutateAsync(e);
            }
            setModalEq({ open: false, edit: null });
          }}
        />
      </Modal>

      <Modal
        open={alocandoEquipe !== null}
        onClose={() => setAlocandoEquipe(null)}
        title={`Alocar funcionários — ${alocandoEquipe?.nome ?? ""}`}
        size="lg"
      >
        {alocandoEquipe && (
          <AlocacaoSelector
            equipe={alocandoEquipe}
            funcionarios={funcsAtivos}
            onCancel={() => setAlocandoEquipe(null)}
            onConfirm={async (ids) => {
              const previa = funcsAtivos
                .filter((f) => f.equipeId === alocandoEquipe.id)
                .map((f) => f.id);
              const setIds = new Set(ids);
              const removidos = previa.filter((id) => !setIds.has(id));
              const adicionados = ids.filter((id) => !previa.includes(id));
              if (removidos.length > 0) {
                await alocar.mutateAsync({
                  funcionarioIds: removidos,
                  equipeId: null,
                  obraId: null,
                  encarregadoId: null,
                });
              }
              if (adicionados.length > 0) {
                await alocar.mutateAsync({
                  funcionarioIds: adicionados,
                  equipeId: alocandoEquipe.id,
                  obraId: alocandoEquipe.obraId,
                });
              }
              setAlocandoEquipe(null);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteEqId !== null}
        onClose={() => setDeleteEqId(null)}
        onConfirm={async () => {
          if (deleteEqId) {
            await removeEq.mutateAsync(deleteEqId);
          }
          setDeleteEqId(null);
        }}
        title="Excluir equipe"
        message="Funcionários da equipe ficarão sem alocação. Confirma?"
      />
    </div>
  );
}

function EquipeForm({
  initial,
  obras,
  onSubmit,
  onCancel,
}: {
  initial: Equipe | null;
  obras: Obra[];
  onSubmit: (e: Omit<Equipe, "id" | "ativo">) => Promise<void>;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [obraId, setObraId] = useState(initial?.obraId ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nome.trim() || !obraId) return;
        setSaving(true);
        try {
          await onSubmit({
            nome: nome.trim(),
            obraId,
            encarregadoId: initial?.encarregadoId ?? null,
          });
        } catch (err) {
          alert(`Falha: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-4"
    >
      <Input
        label="Nome da equipe"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
        placeholder="Ex: Frente A — CBUQ"
      />
      <Select
        label="Obra"
        options={obras.map((o) => ({ value: o.id, label: o.nome }))}
        value={obraId}
        onChange={(e) => setObraId(e.target.value)}
        required
      />
      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function AlocacaoSelector({
  equipe,
  funcionarios,
  onConfirm,
  onCancel,
}: {
  equipe: Equipe;
  funcionarios: Funcionario[];
  onConfirm: (ids: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  // Disponíveis: sem equipe + os já dessa equipe (pra desmarcar)
  const disponiveis = useMemo(
    () =>
      funcionarios.filter(
        (f) => !f.equipeId || f.equipeId === equipe.id
      ),
    [funcionarios, equipe.id]
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(funcionarios.filter((f) => f.equipeId === equipe.id).map((f) => f.id))
  );
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? disponiveis.filter((f) => f.nome.toLowerCase().includes(q))
      : disponiveis;
  }, [disponiveis, filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <Input
        label="Filtrar"
        placeholder="Buscar por nome..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-[var(--color-border)]">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-fg-subtle)] text-center">
            Nenhum funcionário disponível.
          </p>
        ) : (
          filtered.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]/50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={() => toggle(f.id)}
                className="w-4 h-4"
              />
              <span className="font-medium text-[var(--color-fg)]">{f.nome}</span>
              <span className="text-xs text-[var(--color-fg-muted)] capitalize">
                {f.funcao}
              </span>
              {f.equipeId && f.equipeId !== equipe.id && (
                <span className="text-xs text-amber-400 ml-auto">
                  já em outra equipe
                </span>
              )}
            </label>
          ))
        )}
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-fg-muted)]">
          {selected.size} selecionado{selected.size === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm([...selected]);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando..." : "Confirmar alocação"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FuncBadge({
  f,
  isEncarregado,
  onSetEncarregado,
  onRemove,
  onMove,
  equipes,
  obraNome,
}: {
  f: Funcionario;
  isEncarregado?: boolean;
  onSetEncarregado?: () => void;
  onRemove?: () => void;
  onMove?: (equipeId: string) => void;
  equipes?: Equipe[];
  obraNome?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors " +
          (isEncarregado
            ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)] text-[var(--color-fg)]"
            : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-fg)]")
        }
      >
        {isEncarregado && <span title="Encarregado">★</span>}
        <span>{f.nome}</span>
        <span className="text-[var(--color-fg-subtle)] capitalize">
          {f.funcao}
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 right-0 min-w-[200px] bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 text-sm">
          {onSetEncarregado && !isEncarregado && (
            <button
              onClick={() => {
                onSetEncarregado();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-2)]"
            >
              Tornar encarregado
            </button>
          )}
          {onMove && equipes && (
            <div className="border-t border-[var(--color-border)] mt-1 pt-1">
              <p className="px-3 py-1 text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Mover para
              </p>
              {equipes.length === 0 ? (
                <p className="px-3 py-1 text-xs text-[var(--color-fg-subtle)]">
                  Nenhuma equipe
                </p>
              ) : (
                equipes.map((eq) => (
                  <button
                    key={eq.id}
                    onClick={() => {
                      onMove(eq.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--color-surface-2)] text-xs"
                  >
                    {eq.nome}{" "}
                    <span className="text-[var(--color-fg-subtle)]">
                      ({obraNome?.[eq.obraId] ?? "—"})
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
          {onRemove && (
            <button
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-2)] text-[var(--color-danger)] border-t border-[var(--color-border)]"
            >
              Remover da equipe
            </button>
          )}
        </div>
      )}
    </div>
  );
}
