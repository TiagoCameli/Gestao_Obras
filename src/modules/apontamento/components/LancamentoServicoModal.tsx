import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import FilterCombobox from "../../../components/ui/FilterCombobox";
import {
  replaceApontamentosDoDia,
  type ApontamentoServico,
  type Servico,
  type TipoApontamento,
} from "../utils/apontamentoServicoApi";

export const MOTIVOS_IMPRODUTIVO = [
  "Chuva",
  "Falta de material",
  "Quebra de equipamento",
  "Espera de frente de serviço",
  "Aguardando autorização",
  "Outros",
];

interface Linha {
  uid: string;
  servicoId: string;
  tipo: TipoApontamento;
  motivo: string;
  horasStr: string;
  pctStr: string;
  observacao: string;
}

function novaLinha(servicoId = ""): Linha {
  return {
    uid: crypto.randomUUID(),
    servicoId,
    tipo: "produtivo",
    motivo: "",
    horasStr: "",
    pctStr: "",
    observacao: "",
  };
}

interface Props {
  open: boolean;
  funcionarioIds: string[];
  funcNome: Record<string, string>;
  servicos: Servico[];
  iniciais: ApontamentoServico[];
  data: string;
  horasPorFunc: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

export default function LancamentoServicoModal({
  open,
  funcionarioIds,
  funcNome,
  servicos,
  iniciais,
  data,
  horasPorFunc,
  onClose,
  onSaved,
}: Props) {
  const editando = iniciais.length > 0;

  const baseHoras = useMemo(() => {
    if (funcionarioIds.length === 0) return 0;
    return Math.min(...funcionarioIds.map((id) => horasPorFunc[id] ?? 0));
  }, [funcionarioIds, horasPorFunc]);

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (iniciais.length > 0) {
      setLinhas(
        iniciais.map((a) => {
          const pct = baseHoras > 0 ? (a.horas / baseHoras) * 100 : 0;
          return {
            uid: crypto.randomUUID(),
            servicoId: a.servicoId ?? "",
            tipo: a.tipo,
            motivo: a.motivoImprodutivo ?? "",
            horasStr: a.horas.toFixed(2),
            pctStr: pct.toFixed(1),
            observacao: a.observacao ?? "",
          };
        })
      );
    } else {
      setLinhas([novaLinha()]);
    }
    setErro(null);
  }, [open, iniciais, baseHoras]);

  function patchLinha(uid: string, patch: Partial<Linha>) {
    setLinhas((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l))
    );
  }

  function setHorasDaLinha(uid: string, horasStr: string) {
    const h = parseFloat(horasStr);
    const pct =
      baseHoras > 0 && Number.isFinite(h) ? (h / baseHoras) * 100 : NaN;
    patchLinha(uid, {
      horasStr,
      pctStr: Number.isFinite(pct) ? pct.toFixed(1) : "",
    });
  }
  function setPctDaLinha(uid: string, pctStr: string) {
    const p = parseFloat(pctStr);
    const h = Number.isFinite(p) && baseHoras > 0 ? (p / 100) * baseHoras : NaN;
    patchLinha(uid, {
      pctStr,
      horasStr: Number.isFinite(h) ? h.toFixed(2) : "",
    });
  }

  const totalHoras = useMemo(
    () =>
      linhas.reduce(
        (acc, l) =>
          acc + (Number.isFinite(parseFloat(l.horasStr)) ? parseFloat(l.horasStr) : 0),
        0
      ),
    [linhas]
  );
  const totalPct = baseHoras > 0 ? (totalHoras / baseHoras) * 100 : 0;

  function validar(): string | null {
    if (linhas.length === 0) return "Adicione pelo menos uma linha.";
    for (const l of linhas) {
      const h = parseFloat(l.horasStr);
      if (!Number.isFinite(h) || h <= 0)
        return "Informe horas (> 0) em todas as linhas.";
      if (l.tipo === "produtivo" && !l.servicoId)
        return "Selecione um serviço em todas as linhas produtivas.";
      if (l.tipo === "improdutivo" && !l.motivo)
        return "Informe o motivo nas linhas improdutivas.";
    }
    const ids = linhas.filter((l) => l.servicoId).map((l) => l.servicoId);
    if (new Set(ids).size !== ids.length)
      return "Há serviços repetidos. Use uma linha por serviço.";

    for (const fid of funcionarioIds) {
      const ponto = horasPorFunc[fid] ?? 0;
      if (totalHoras > ponto + 0.001) {
        return `${funcNome[fid] ?? fid}: total ${totalHoras.toFixed(
          2
        )}h excede as ${ponto.toFixed(2)}h registradas no ponto.`;
      }
    }
    return null;
  }

  const servicoOpts = servicos.map((s) => ({
    value: s.id,
    label: `${s.codigo ? s.codigo + " — " : ""}${s.nome}${
      s.unidade ? ` (${s.unidade})` : ""
    }`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editando
          ? `Editar lançamento — ${
              funcionarioIds.length === 1
                ? funcNome[funcionarioIds[0]] ?? "—"
                : `${funcionarioIds.length} funcionários`
            }`
          : `Lançar serviço — ${funcionarioIds.length} ${
              funcionarioIds.length === 1 ? "funcionário" : "funcionários"
            }`
      }
      size="lg"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const err = validar();
          if (err) {
            setErro(err);
            return;
          }
          setSaving(true);
          try {
            await replaceApontamentosDoDia({
              funcionarioIds,
              data,
              linhas: linhas.map((l) => ({
                servicoId: l.tipo === "produtivo" ? l.servicoId : null,
                horas: parseFloat(l.horasStr),
                tipo: l.tipo,
                motivoImprodutivo: l.motivo || null,
                observacao: l.observacao || null,
              })),
            });
            onSaved();
          } catch (err2) {
            setErro(
              "Falha: " + (err2 instanceof Error ? err2.message : String(err2))
            );
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-4"
      >
        {funcionarioIds.length > 1 && (
          <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-fg-muted)]">
            Aplicado a:{" "}
            <span className="text-[var(--color-fg)]">
              {funcionarioIds.map((id) => funcNome[id] ?? id).join(", ")}
            </span>
            <div className="mt-1 text-[var(--color-fg-subtle)]">
              Base de horas (menor entre os selecionados):{" "}
              <span className="font-mono text-[var(--color-fg-muted)]">
                {baseHoras.toFixed(2)}h
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {linhas.map((l, idx) => (
            <div
              key={l.uid}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-fg-muted)]">
                  Serviço #{idx + 1}
                </span>
                {linhas.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLinhas((prev) => prev.filter((p) => p.uid !== l.uid))
                    }
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
                    Tipo
                  </label>
                  <Select
                    label=""
                    options={[
                      { value: "produtivo", label: "Produtivo" },
                      { value: "improdutivo", label: "Improdutivo" },
                    ]}
                    value={l.tipo}
                    onChange={(e) =>
                      patchLinha(l.uid, {
                        tipo: e.target.value as TipoApontamento,
                      })
                    }
                  />
                </div>
              </div>

              {l.tipo === "produtivo" ? (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
                    Serviço (item de contrato){" "}
                    <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <FilterCombobox
                    value={l.servicoId}
                    onChange={(v) => patchLinha(l.uid, { servicoId: v })}
                    options={servicoOpts}
                    placeholder={
                      servicos.length === 0
                        ? "Nenhum item nesta obra"
                        : "Buscar item de contrato..."
                    }
                  />
                </div>
              ) : (
                <Select
                  label="Motivo"
                  options={MOTIVOS_IMPRODUTIVO.map((m) => ({
                    value: m,
                    label: m,
                  }))}
                  value={l.motivo}
                  onChange={(e) => patchLinha(l.uid, { motivo: e.target.value })}
                  required
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Horas"
                  type="number"
                  step="any"
                  min="0"
                  value={l.horasStr}
                  onChange={(e) => setHorasDaLinha(l.uid, e.target.value)}
                  placeholder="Ex: 4.0"
                />
                <Input
                  label="% do dia"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={l.pctStr}
                  onChange={(e) => setPctDaLinha(l.uid, e.target.value)}
                  placeholder={baseHoras > 0 ? "Ex: 50" : "—"}
                  disabled={baseHoras <= 0}
                />
              </div>

              <Input
                label="Observação"
                value={l.observacao}
                onChange={(e) =>
                  patchLinha(l.uid, { observacao: e.target.value })
                }
                placeholder="opcional"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLinhas((prev) => [...prev, novaLinha()])}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          + Adicionar outro serviço
        </button>

        <div className="flex items-center justify-between text-sm border-t border-[var(--color-border)] pt-3">
          <span className="text-[var(--color-fg-muted)]">Total</span>
          <span className="font-mono">
            {totalHoras.toFixed(2)}h
            {baseHoras > 0 && (
              <span className="text-[var(--color-fg-subtle)] ml-2">
                ({totalPct.toFixed(1)}%)
              </span>
            )}
            {baseHoras > 0 && (
              <span className="text-[var(--color-fg-subtle)] ml-2">
                / {baseHoras.toFixed(2)}h
              </span>
            )}
          </span>
        </div>

        {erro && (
          <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)] text-[var(--color-danger)] text-sm px-3 py-2">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : editando ? "Salvar" : "Lançar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
