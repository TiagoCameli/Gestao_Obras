import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import FilterCombobox from "../../../components/ui/FilterCombobox";
import { useAuth } from "../../../contexts/AuthContext";
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
  /** Display + edição manual (truncado pra 2 casas). NUNCA usar em cálculos. */
  horasStr: string;
  pctStr: string;
  /** Valor numérico canônico (full precision). Usado em totalHoras, validar e save.
   *  Setado por setHorasDaLinha (parseFloat do input) ou setPctDaLinha
   *  ((p/100) × baseHoras, sem arredondar). 0 = vazio/inválido. */
  horasNum: number;
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
    horasNum: 0,
    observacao: "",
  };
}

// ── Helpers de distribuição / arredondamento ─────────────────────────
/** Arredonda pra 2 casas decimais. */
function arred2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Distribui `total` em `n` partes iguais com 2 casas, ajustando o drift
 *  de arredondamento na ÚLTIMA parte pra garantir soma exata. */
function distribuirIgualmente(n: number, total: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [arred2(total)];
  const cada = arred2(total / n);
  const arr = new Array(n).fill(cada);
  const soma = arr.reduce((s, v) => s + v, 0);
  arr[n - 1] = arred2(arr[n - 1] + (total - soma));
  return arr;
}

/** Aplica `horas` à linha, recalculando pctStr e horasStr. */
function aplicarHoras(l: Linha, horas: number, baseHoras: number): Linha {
  const h = arred2(Math.max(0, horas));
  const pct = baseHoras > 0 ? (h / baseHoras) * 100 : 0;
  return {
    ...l,
    horasNum: h,
    horasStr: h > 0 ? h.toFixed(2) : "0.00",
    pctStr: baseHoras > 0 ? pct.toFixed(1) : "",
  };
}

/** Quando o usuário edita uma linha pra `novasHoras`, redistribui o
 *  restante (baseHoras - novasHoras) entre as outras linhas proporcionalmente
 *  ao valor atual delas. Se todas estão zeradas, divide igualmente. */
function compensarAposEdicao(
  linhas: Linha[],
  uidEditado: string,
  novasHoras: number,
  baseHoras: number,
): Linha[] {
  if (baseHoras <= 0 || linhas.length === 0) return linhas;
  // 1 linha → sempre vale baseHoras
  if (linhas.length === 1) {
    return linhas.map((l) => aplicarHoras(l, baseHoras, baseHoras));
  }
  // Cap em [0, baseHoras]
  const hEdit = Math.max(0, Math.min(arred2(novasHoras), baseHoras));
  const restante = arred2(Math.max(0, baseHoras - hEdit));

  const outras = linhas.filter((l) => l.uid !== uidEditado);
  const somaOutrasAtual = outras.reduce((s, l) => s + (l.horasNum || 0), 0);

  let novasOutras: number[];
  if (somaOutrasAtual <= 0.001) {
    novasOutras = distribuirIgualmente(outras.length, restante);
  } else {
    novasOutras = outras.map((l) =>
      arred2((l.horasNum / somaOutrasAtual) * restante),
    );
    const soma = novasOutras.reduce((s, v) => s + v, 0);
    novasOutras[novasOutras.length - 1] = arred2(
      novasOutras[novasOutras.length - 1] + (restante - soma),
    );
  }

  let idxOutra = 0;
  return linhas.map((l) => {
    if (l.uid === uidEditado) return aplicarHoras(l, hEdit, baseHoras);
    const h = novasOutras[idxOutra++];
    return aplicarHoras(l, h, baseHoras);
  });
}

/** Distribui baseHoras igualmente entre TODAS as linhas (add/remove). */
function distribuirEntreTodas(linhas: Linha[], baseHoras: number): Linha[] {
  if (baseHoras <= 0 || linhas.length === 0) return linhas;
  const horas = distribuirIgualmente(linhas.length, baseHoras);
  return linhas.map((l, i) => aplicarHoras(l, horas[i], baseHoras));
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
  const { temAcao } = useAuth();
  const canAct = editando ? temAcao("editar_apontamento_servico") : temAcao("lancar_apontamento_servico");

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
      const carregadas: Linha[] = iniciais.map((a) => {
        const pct = baseHoras > 0 ? (a.horas / baseHoras) * 100 : 0;
        return {
          uid: crypto.randomUUID(),
          servicoId: a.servicoId ?? "",
          tipo: a.tipo,
          motivo: a.motivoImprodutivo ?? "",
          horasStr: a.horas.toFixed(2),
          pctStr: pct.toFixed(1),
          horasNum: a.horas,
          observacao: a.observacao ?? "",
        };
      });
      // Se há apenas 1 linha existente, snap pra baseHoras (regra: 1 = 100%).
      if (carregadas.length === 1 && baseHoras > 0) {
        setLinhas([aplicarHoras(carregadas[0], baseHoras, baseHoras)]);
      } else {
        setLinhas(carregadas);
      }
    } else {
      // Novo lançamento: começa com 1 linha = 100% (todas as horas)
      const l = novaLinha();
      setLinhas(baseHoras > 0 ? [aplicarHoras(l, baseHoras, baseHoras)] : [l]);
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
    // Se input vazio/inválido, só atualiza o display sem redistribuir
    if (!Number.isFinite(h)) {
      patchLinha(uid, { horasStr, horasNum: 0, pctStr: "" });
      return;
    }
    setLinhas((prev) => compensarAposEdicao(prev, uid, h, baseHoras));
  }
  function setPctDaLinha(uid: string, pctStr: string) {
    const p = parseFloat(pctStr);
    if (!Number.isFinite(p) || baseHoras <= 0) {
      patchLinha(uid, { pctStr });
      return;
    }
    const h = (p / 100) * baseHoras;
    setLinhas((prev) => compensarAposEdicao(prev, uid, h, baseHoras));
  }

  function adicionarLinha() {
    setLinhas((prev) => distribuirEntreTodas([...prev, novaLinha()], baseHoras));
  }
  function removerLinha(uid: string) {
    setLinhas((prev) => {
      const restantes = prev.filter((p) => p.uid !== uid);
      return distribuirEntreTodas(restantes, baseHoras);
    });
  }

  const totalHoras = useMemo(
    () => linhas.reduce((acc, l) => acc + (l.horasNum || 0), 0),
    [linhas]
  );
  const totalPct = baseHoras > 0 ? (totalHoras / baseHoras) * 100 : 0;

  function validar(): string | null {
    const ativas = linhas.filter((l) => Number.isFinite(l.horasNum) && l.horasNum > 0);
    if (ativas.length === 0) return "Adicione pelo menos uma linha com horas > 0.";
    for (const l of ativas) {
      if (l.tipo === "produtivo" && !l.servicoId)
        return "Selecione um serviço em todas as linhas produtivas.";
      if (l.tipo === "improdutivo" && !l.motivo)
        return "Informe o motivo nas linhas improdutivas.";
    }
    const ids = ativas.filter((l) => l.servicoId).map((l) => l.servicoId);
    if (new Set(ids).size !== ids.length)
      return "Há serviços repetidos. Use uma linha por serviço.";

    for (const fid of funcionarioIds) {
      const ponto = horasPorFunc[fid] ?? 0;
      if (ponto <= 0) continue; // sem ponto registrado, pula a checagem
      if (totalHoras > ponto + 0.01) {
        return `${funcNome[fid] ?? fid}: total ${totalHoras.toFixed(
          2,
        )}h excede as ${ponto.toFixed(2)}h registradas no ponto.`;
      }
      if (totalHoras < ponto - 0.01) {
        return `${funcNome[fid] ?? fid}: total ${totalHoras.toFixed(
          2,
        )}h é menor que as ${ponto.toFixed(
          2,
        )}h registradas no ponto. A soma deve fechar.`;
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
          if (!canAct) {
            setErro("Sem permissão para esta ação.");
            return;
          }
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
              linhas: linhas
                .filter((l) => l.horasNum > 0)
                .map((l) => ({
                  servicoId: l.tipo === "produtivo" ? l.servicoId : null,
                  horas: l.horasNum,
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
                    onClick={() => removerLinha(l.uid)}
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
                  max={baseHoras > 0 ? baseHoras : undefined}
                  value={l.horasStr}
                  onChange={(e) => setHorasDaLinha(l.uid, e.target.value)}
                  placeholder="Ex: 4.0"
                  disabled={linhas.length === 1 && baseHoras > 0}
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
                  disabled={baseHoras <= 0 || (linhas.length === 1 && baseHoras > 0)}
                />
              </div>
              {linhas.length === 1 && baseHoras > 0 && (
                <p className="text-[11px] text-[var(--color-fg-subtle)] -mt-1">
                  Linha única: recebe automaticamente 100% das horas do ponto.
                  Adicione outro serviço pra dividir.
                </p>
              )}
              {linhas.length > 1 && baseHoras > 0 && (
                <p className="text-[11px] text-[var(--color-fg-subtle)] -mt-1">
                  Editar uma linha redistribui as horas restantes nas outras
                  proporcionalmente — a soma sempre fecha em {baseHoras.toFixed(2)}h.
                </p>
              )}

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
          onClick={adicionarLinha}
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
