import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import {
  useEquipesApont,
  useFuncionarios,
  useObrasApont,
} from "../hooks/useApontamentoData";
import { listRegistrosDoDia, type RegistroPonto } from "../utils/pontoApi";
import FilterCombobox from "../../../components/ui/FilterCombobox";
import {
  excluirLancamentoDoDia,
  listApontamentosDoDia,
  listServicosDaObra,
  replaceApontamentosDoDia,
  type ApontamentoServico,
  type Servico,
  type TipoApontamento,
} from "../utils/apontamentoServicoApi";

const MOTIVOS_IMPRODUTIVO = [
  "Chuva",
  "Falta de material",
  "Quebra de equipamento",
  "Espera de frente de serviço",
  "Aguardando autorização",
  "Outros",
];

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calcula horas trabalhadas a partir das batidas aprovadas:
 *   (saida_almoco - entrada) + (saida_final - retorno_almoco)
 * Se não houver pausa, usa direto entrada → saida_final.
 * Se faltar saida_final, usa "agora" como referência (apenas para o dia de hoje).
 */
function calcHorasPonto(rs: RegistroPonto[]): number {
  const ok = rs.filter((r) => r.statusAprovacao !== "rejeitado");
  const get = (t: RegistroPonto["tipoBatida"]) =>
    ok.find((r) => r.tipoBatida === t);
  const entrada = get("entrada");
  if (!entrada) return 0;
  const saidaAlmoco = get("saida_almoco");
  const retorno = get("retorno_almoco");
  const saidaFinal = get("saida_final");

  const ms = (a?: RegistroPonto, b?: RegistroPonto) =>
    a && b ? new Date(b.hora).getTime() - new Date(a.hora).getTime() : 0;

  if (saidaAlmoco && retorno && saidaFinal) {
    return (ms(entrada, saidaAlmoco) + ms(retorno, saidaFinal)) / 3_600_000;
  }
  if (saidaFinal) {
    return ms(entrada, saidaFinal) / 3_600_000;
  }
  // dia em andamento: usa "agora" como saída provisória
  const agora = new Date();
  const fim = new Date(agora.toISOString());
  return (
    (fim.getTime() - new Date(entrada.hora).getTime()) / 3_600_000
  );
}

export default function ApontamentoServicoTab() {
  const qc = useQueryClient();
  const { data: obras = [] } = useObrasApont();
  const [obraId, setObraId] = useState<string>("");
  const { data: equipes = [] } = useEquipesApont(obraId || undefined);
  const [equipeId, setEquipeId] = useState<string>("");
  const [data, setData] = useState<string>(hojeIso());

  const { data: funcionarios = [] } = useFuncionarios();
  const funcsDaEquipe = useMemo(
    () =>
      funcionarios.filter(
        (f) => f.equipeId === equipeId && f.status === "ativo"
      ),
    [funcionarios, equipeId]
  );
  const funcIds = funcsDaEquipe.map((f) => f.id);

  const { data: servicos = [] } = useQuery({
    queryKey: ["apont", "servicos-contrato", obraId] as const,
    queryFn: () => listServicosDaObra(obraId),
    enabled: !!obraId,
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["apont", "registros", equipeId, data] as const,
    queryFn: () => listRegistrosDoDia(equipeId, data),
    enabled: !!equipeId && !!data,
  });

  const apontKey = ["apont", "apontamentos-servico", equipeId, data] as const;
  const { data: apontamentos = [] } = useQuery({
    queryKey: apontKey,
    queryFn: () => listApontamentosDoDia(funcIds, data),
    enabled: !!equipeId && !!data && funcIds.length > 0,
  });

  // Funcionários que tiveram pelo menos uma batida no dia (não rejeitada)
  const horasPorFunc = useMemo(() => {
    const m: Record<string, number> = {};
    funcsDaEquipe.forEach((f) => {
      const rs = registros.filter((r) => r.funcionarioId === f.id);
      m[f.id] = calcHorasPonto(rs);
    });
    return m;
  }, [funcsDaEquipe, registros]);

  const apropriadasPorFunc = useMemo(() => {
    const m: Record<string, number> = {};
    apontamentos.forEach((a) => {
      m[a.funcionarioId] = (m[a.funcionarioId] ?? 0) + a.horas;
    });
    return m;
  }, [apontamentos]);

  const funcsComPonto = useMemo(
    () => funcsDaEquipe.filter((f) => (horasPorFunc[f.id] ?? 0) > 0),
    [funcsDaEquipe, horasPorFunc]
  );

  // Seleção
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selecionados.size === funcsComPonto.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(funcsComPonto.map((f) => f.id)));
    }
  }

  // Modal de lançamento (1 lançamento por pessoa por dia, com N linhas)
  const [modal, setModal] = useState<{
    open: boolean;
    funcionarioIds: string[];
    iniciais: ApontamentoServico[]; // linhas pré-existentes (edit)
  }>({ open: false, funcionarioIds: [], iniciais: [] });

  // Excluir lançamento inteiro do dia
  const [excluindoFuncId, setExcluindoFuncId] = useState<string | null>(null);

  // agrupa lançamentos por funcionário pra histórico e edição
  const lancamentosPorFunc = useMemo(() => {
    const m: Record<string, ApontamentoServico[]> = {};
    apontamentos.forEach((a) => {
      (m[a.funcionarioId] ??= []).push(a);
    });
    return m;
  }, [apontamentos]);

  function abrirLancamento(funcIds: string[]) {
    if (funcIds.length === 1) {
      const ja = lancamentosPorFunc[funcIds[0]] ?? [];
      setModal({ open: true, funcionarioIds: funcIds, iniciais: ja });
    } else {
      // bulk: ignora pré-existentes (substitui todo mundo pelo novo conjunto)
      setModal({ open: true, funcionarioIds: funcIds, iniciais: [] });
    }
  }

  const servicoNome = useMemo(
    () =>
      Object.fromEntries(
        servicos.map((s) => [
          s.id,
          s.codigo ? `${s.codigo} — ${s.nome}` : s.nome,
        ])
      ),
    [servicos]
  );
  const funcNome = useMemo(
    () => Object.fromEntries(funcsDaEquipe.map((f) => [f.id, f.nome])),
    [funcsDaEquipe]
  );

  if (obras.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-fg-subtle)]">
        Cadastre obras no módulo Medição antes de apropriar serviços.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Obra"
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          value={obraId}
          onChange={(e) => {
            setObraId(e.target.value);
            setEquipeId("");
            setSelecionados(new Set());
          }}
        />
        <Select
          label="Equipe"
          options={equipes.map((eq) => ({ value: eq.id, label: eq.nome }))}
          value={equipeId}
          onChange={(e) => {
            setEquipeId(e.target.value);
            setSelecionados(new Set());
          }}
          disabled={!obraId}
        />
        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(e) => {
            setData(e.target.value);
            setSelecionados(new Set());
          }}
        />
      </div>

      {!equipeId ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
          Selecione obra e equipe.
        </p>
      ) : funcsComPonto.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
          Nenhum funcionário desta equipe tem ponto registrado em {data}.
        </p>
      ) : (
        <>
          {/* Tabela de funcionários do dia */}
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                <tr className="text-left">
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selecionados.size === funcsComPonto.length &&
                        funcsComPonto.length > 0
                      }
                      onChange={toggleAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Funcionário</th>
                  <th className="px-3 py-2.5 font-medium text-right">Ponto</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Apropriado
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Pendente
                  </th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {funcsComPonto.map((f) => {
                  const horasPonto = horasPorFunc[f.id] ?? 0;
                  const horasApr = apropriadasPorFunc[f.id] ?? 0;
                  const pendente = +(horasPonto - horasApr).toFixed(2);
                  const status: "ok" | "pendente" | "excedido" =
                    horasApr > horasPonto + 0.001
                      ? "excedido"
                      : pendente > 0.05
                      ? "pendente"
                      : "ok";
                  return (
                    <tr
                      key={f.id}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/40"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selecionados.has(f.id)}
                          onChange={() => toggleSel(f.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{f.nome}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {horasPonto.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {horasApr.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {pendente > 0 ? `${pendente.toFixed(2)}h` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => abrirLancamento([f.id])}
                          className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-accent)]"
                        >
                          {(lancamentosPorFunc[f.id]?.length ?? 0) > 0
                            ? "Editar"
                            : "+ Lançar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selecionados.size > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => abrirLancamento([...selecionados])}>
                Lançar serviço para {selecionados.size}{" "}
                {selecionados.size === 1 ? "selecionado" : "selecionados"}
              </Button>
            </div>
          )}

          {/* Histórico do dia (1 lançamento por pessoa, várias linhas) */}
          <section className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Lançamentos do dia
            </h3>
            {Object.keys(lancamentosPorFunc).length === 0 ? (
              <p className="text-sm text-[var(--color-fg-subtle)] italic">
                Nenhum lançamento ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(lancamentosPorFunc).map(([fid, linhas]) => {
                  const total = linhas.reduce((acc, l) => acc + l.horas, 0);
                  return (
                    <div
                      key={fid}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3"
                    >
                      <header className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-[var(--color-fg)]">
                            {funcNome[fid] ?? "—"}
                          </div>
                          <div className="text-xs text-[var(--color-fg-subtle)]">
                            {linhas.length}{" "}
                            {linhas.length === 1 ? "linha" : "linhas"} · total{" "}
                            <span className="font-mono">
                              {total.toFixed(2)}h
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => abrirLancamento([fid])}
                            className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
                          >
                            ✎ Editar
                          </button>
                          <button
                            onClick={() => setExcluindoFuncId(fid)}
                            className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
                          >
                            ✕ Excluir
                          </button>
                        </div>
                      </header>
                      <ul className="divide-y divide-[var(--color-border)] text-sm">
                        {linhas.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center gap-2 py-1.5"
                          >
                            <span
                              className={
                                "px-1.5 py-0.5 rounded text-[10px] font-medium " +
                                (l.tipo === "produtivo"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-amber-500/20 text-amber-300")
                              }
                            >
                              {l.tipo}
                            </span>
                            <span className="text-[var(--color-fg-muted)] truncate">
                              {l.tipo === "improdutivo"
                                ? l.motivoImprodutivo ?? "—"
                                : l.servicoId
                                ? servicoNome[l.servicoId] ?? "—"
                                : "—"}
                            </span>
                            <span className="ml-auto font-mono text-xs text-[var(--color-fg-muted)]">
                              {l.horas.toFixed(2)}h
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <LancamentoModal
        open={modal.open}
        funcionarioIds={modal.funcionarioIds}
        funcNome={funcNome}
        servicos={servicos}
        iniciais={modal.iniciais}
        data={data}
        horasPorFunc={horasPorFunc}
        onClose={() =>
          setModal({ open: false, funcionarioIds: [], iniciais: [] })
        }
        onSaved={() => {
          qc.invalidateQueries({ queryKey: apontKey });
          setSelecionados(new Set());
          setModal({ open: false, funcionarioIds: [], iniciais: [] });
        }}
      />

      <ConfirmDialog
        open={excluindoFuncId !== null}
        onClose={() => setExcluindoFuncId(null)}
        onConfirm={async () => {
          if (excluindoFuncId)
            await excluirLancamentoDoDia(excluindoFuncId, data);
          qc.invalidateQueries({ queryKey: apontKey });
          setExcluindoFuncId(null);
        }}
        title="Excluir lançamento do dia"
        message={
          excluindoFuncId
            ? `Excluir todas as linhas lançadas para ${
                funcNome[excluindoFuncId] ?? "este funcionário"
              } em ${data}?`
            : ""
        }
      />
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "ok" | "pendente" | "excedido";
}) {
  const map = {
    ok: { label: "✅ completo", cls: "bg-emerald-500/15 text-emerald-400" },
    pendente: { label: "⚠️ pendente", cls: "bg-amber-500/15 text-amber-400" },
    excedido: { label: "❌ excedido", cls: "bg-rose-500/15 text-rose-400" },
  } as const;
  const v = map[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

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

function LancamentoModal({
  open,
  funcionarioIds,
  funcNome,
  servicos,
  iniciais,
  data,
  horasPorFunc,
  onClose,
  onSaved,
}: {
  open: boolean;
  funcionarioIds: string[];
  funcNome: Record<string, string>;
  servicos: Servico[];
  iniciais: ApontamentoServico[];
  data: string;
  horasPorFunc: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = iniciais.length > 0;

  // Base = menor "horas do ponto" entre os selecionados (pra cálculo do %)
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
        (acc, l) => acc + (Number.isFinite(parseFloat(l.horasStr)) ? parseFloat(l.horasStr) : 0),
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
    // Não pode duplicar mesmo serviço na mesma submissão (evita inserção redundante)
    const ids = linhas.filter((l) => l.servicoId).map((l) => l.servicoId);
    if (new Set(ids).size !== ids.length)
      return "Há serviços repetidos. Use uma linha por serviço.";

    // O lançamento substitui tudo: basta o total <= horas do ponto de cada um.
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
              "Falha: " +
                (err2 instanceof Error ? err2.message : String(err2))
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
