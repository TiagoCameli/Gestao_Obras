import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useAuth } from "../../../contexts/AuthContext";
import {
  listRegistrosPontoRange,
  excluirBatida,
  type RegistroPonto,
  type FiltrosPonto,
} from "../utils/pontoApi";
import {
  listApontamentosServicoRange,
  listTodosServicos,
  excluirApontamentoServico,
  type ApontamentoServico,
  type FiltrosApontamentoServico,
  type Servico,
} from "../utils/apontamentoServicoApi";
import {
  useFuncionarios,
  useObrasApont,
  useEquipesApont,
} from "../hooks/useApontamentoData";

type SubTab = "ponto" | "servico";

const TIPO_BATIDA_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída almoço",
  retorno_almoco: "Retorno almoço",
  saida_final: "Saída final",
};

const STATUS_LABEL: Record<string, string> = {
  aprovada: "Aprovada",
  pendente_aprovacao: "Pendente",
  rejeitado: "Rejeitada",
};

const STATUS_BADGE: Record<string, string> = {
  aprovada: "bg-[var(--color-success-soft)] text-[var(--color-success-fg)]",
  pendente_aprovacao: "bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]",
  rejeitado: "bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtData(iso: string): string {
  // "YYYY-MM-DD" -> "DD/MM/YYYY"
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtHora(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function HistoricoTab() {
  const qc = useQueryClient();
  const { temAcao } = useAuth();
  const canDelete = temAcao("excluir_apontamentos") || temAcao("editar_apontamentos");

  const [sub, setSub] = useState<SubTab>("ponto");
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "ponto"; id: string; resumo: string }
    | { kind: "servico"; id: string; resumo: string }
    | null
  >(null);

  const deletePontoM = useMutation({
    mutationFn: (id: string) => excluirBatida(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apont", "hist", "ponto"] });
      qc.invalidateQueries({ queryKey: ["apont", "dash", "ponto"] });
    },
  });
  const deleteServM = useMutation({
    mutationFn: (id: string) => excluirApontamentoServico(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apont", "hist", "servico"] });
      qc.invalidateQueries({ queryKey: ["apont", "dash", "servico"] });
    },
  });

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "ponto") {
      await deletePontoM.mutateAsync(pendingDelete.id);
    } else {
      await deleteServM.mutateAsync(pendingDelete.id);
    }
    setPendingDelete(null);
  }

  const [dataInicio, setDataInicio] = useState(isoDaysAgo(29));
  const [dataFim, setDataFim] = useState(todayIso());
  const [obraId, setObraId] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [busca, setBusca] = useState("");

  const { data: obras = [] } = useObrasApont();
  const { data: equipes = [] } = useEquipesApont(undefined);
  const { data: funcionarios = [] } = useFuncionarios();
  const { data: servicos = [] } = useQuery({
    queryKey: ["apont", "servicos-todos"],
    queryFn: listTodosServicos,
    staleTime: 60_000,
  });

  const funcsById = useMemo(
    () => new Map(funcionarios.map((f) => [f.id, f])),
    [funcionarios]
  );
  const servicosById = useMemo(
    () => new Map((servicos as Servico[]).map((s) => [s.id, s])),
    [servicos]
  );

  const baseFilters = {
    dataInicio,
    dataFim,
    obraId: obraId || undefined,
    equipeId: equipeId || undefined,
    funcionarioId: funcionarioId || undefined,
  } as const;

  const { data: registros = [], isLoading: loadingPonto } = useQuery({
    queryKey: ["apont", "hist", "ponto", baseFilters],
    queryFn: () => listRegistrosPontoRange(baseFilters as FiltrosPonto),
    enabled: sub === "ponto",
  });
  const { data: apontamentos = [], isLoading: loadingServ } = useQuery({
    queryKey: ["apont", "hist", "servico", baseFilters],
    queryFn: () => listApontamentosServicoRange(baseFilters as FiltrosApontamentoServico),
    enabled: sub === "servico",
  });

  const registrosFiltrados = useMemo(() => {
    if (!busca) return registros;
    const q = busca.toLowerCase();
    return registros.filter((r) => {
      const f = funcsById.get(r.funcionarioId);
      return (
        (f?.nome ?? "").toLowerCase().includes(q) ||
        (f?.cpf ?? "").includes(q) ||
        TIPO_BATIDA_LABEL[r.tipoBatida]?.toLowerCase().includes(q)
      );
    });
  }, [registros, busca, funcsById]);

  const apontamentosFiltrados = useMemo(() => {
    if (!busca) return apontamentos;
    const q = busca.toLowerCase();
    return apontamentos.filter((a) => {
      const f = funcsById.get(a.funcionarioId);
      const s = a.servicoId ? servicosById.get(a.servicoId) : null;
      return (
        (f?.nome ?? "").toLowerCase().includes(q) ||
        (s?.nome ?? "").toLowerCase().includes(q) ||
        (a.motivoImprodutivo ?? "").toLowerCase().includes(q)
      );
    });
  }, [apontamentos, busca, funcsById, servicosById]);

  function exportCsv() {
    const lines: string[] = [];
    if (sub === "ponto") {
      lines.push("Data,Funcionario,CPF,Tipo,Hora,Status,Origem");
      for (const r of registrosFiltrados) {
        const f = funcsById.get(r.funcionarioId);
        lines.push([
          fmtData(r.data),
          escCsv(f?.nome ?? ""),
          f?.cpf ?? "",
          TIPO_BATIDA_LABEL[r.tipoBatida] ?? r.tipoBatida,
          fmtHora(r.hora),
          STATUS_LABEL[r.statusAprovacao] ?? r.statusAprovacao,
          r.origem,
        ].join(","));
      }
    } else {
      lines.push("Data,Funcionario,Servico,Tipo,Horas,Estaca Inicial,Estaca Final,Lado,Motivo improdutivo");
      for (const a of apontamentosFiltrados) {
        const f = funcsById.get(a.funcionarioId);
        const s = a.servicoId ? servicosById.get(a.servicoId) : null;
        lines.push([
          fmtData(a.data),
          escCsv(f?.nome ?? ""),
          escCsv(s?.nome ?? ""),
          a.tipo,
          a.horas?.toFixed(2) ?? "0",
          a.estacaInicial ?? "",
          a.estacaFinal ?? "",
          a.lado ?? "",
          escCsv(a.motivoImprodutivo ?? ""),
        ].join(","));
      }
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico_${sub}_${dataInicio}_a_${dataFim}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="inline-flex p-1 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border)]">
        <SubBtn active={sub === "ponto"} onClick={() => setSub("ponto")}>
          Registros de Ponto
        </SubBtn>
        <SubBtn active={sub === "servico"} onClick={() => setSub("servico")}>
          Apontamento por Serviço
        </SubBtn>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
        <Field label="Data início">
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Data fim">
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Obra">
          <select value={obraId} onChange={(e) => setObraId(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </Field>
        <Field label="Equipe">
          <select value={equipeId} onChange={(e) => setEquipeId(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </Field>
        <Field label="Funcionário">
          <select value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {funcionarios
              .filter((f) => !equipeId || f.equipeId === equipeId)
              .map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
          </select>
        </Field>
        <Field label="Buscar">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="nome, CPF, serviço..."
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-fg-subtle)]">
          {sub === "ponto" ? registrosFiltrados.length : apontamentosFiltrados.length}{" "}
          {sub === "ponto" ? "batida" : "lançamento"}
          {(sub === "ponto" ? registrosFiltrados.length : apontamentosFiltrados.length) !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-[var(--shadow-xs)]">
        {sub === "ponto" ? (
          <PontoTable
            registros={registrosFiltrados}
            funcsById={funcsById}
            isLoading={loadingPonto}
            canDelete={canDelete}
            onDelete={(r) => {
              const f = funcsById.get(r.funcionarioId);
              const tipo = TIPO_BATIDA_LABEL[r.tipoBatida] ?? r.tipoBatida;
              setPendingDelete({
                kind: "ponto",
                id: r.id,
                resumo: `${tipo} de ${f?.nome ?? "—"} em ${fmtData(r.data)} ${fmtHora(r.hora)}`,
              });
            }}
          />
        ) : (
          <ServicoTable
            apontamentos={apontamentosFiltrados}
            funcsById={funcsById}
            servicosById={servicosById}
            isLoading={loadingServ}
            canDelete={canDelete}
            onDelete={(a) => {
              const f = funcsById.get(a.funcionarioId);
              const s = a.servicoId ? servicosById.get(a.servicoId) : null;
              const desc = a.tipo === "produtivo" ? (s?.nome ?? "—") : (a.motivoImprodutivo ?? "Improdutivo");
              setPendingDelete({
                kind: "servico",
                id: a.id,
                resumo: `${desc} de ${f?.nome ?? "—"} em ${fmtData(a.data)} (${(a.horas ?? 0).toFixed(2)}h)`,
              });
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete?.kind === "ponto" ? "Excluir batida" : "Excluir apontamento"}
        message={
          pendingDelete
            ? `Deseja excluir: ${pendingDelete.resumo}? Esta ação não pode ser desfeita.`
            : ""
        }
      />
    </div>
  );
}

function PontoTable({
  registros,
  funcsById,
  isLoading,
  canDelete,
  onDelete,
}: {
  registros: RegistroPonto[];
  funcsById: Map<string, { nome: string; cpf: string }>;
  isLoading: boolean;
  canDelete: boolean;
  onDelete: (r: RegistroPonto) => void;
}) {
  if (isLoading) {
    return <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">Carregando…</div>;
  }
  if (registros.length === 0) {
    return <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">Nenhuma batida no período.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left font-medium">Data</th>
            <th className="px-4 py-3 text-left font-medium">Funcionário</th>
            <th className="px-4 py-3 text-left font-medium hidden md:table-cell">CPF</th>
            <th className="px-4 py-3 text-left font-medium">Tipo</th>
            <th className="px-4 py-3 text-left font-medium">Hora</th>
            <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Origem</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            {canDelete && <th className="px-4 py-3 text-right font-medium" style={{ width: 60 }}>Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {registros.map((r) => {
            const f = funcsById.get(r.funcionarioId);
            return (
              <tr key={r.id} className="hover:bg-[var(--color-surface-2)]/60 transition-colors">
                <td className="px-4 py-3 tabular-nums">{fmtData(r.data)}</td>
                <td className="px-4 py-3 font-medium">{f?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--color-fg-muted)] hidden md:table-cell">{f?.cpf ?? "—"}</td>
                <td className="px-4 py-3">{TIPO_BATIDA_LABEL[r.tipoBatida] ?? r.tipoBatida}</td>
                <td className="px-4 py-3 tabular-nums">{fmtHora(r.hora)}</td>
                <td className="px-4 py-3 text-[var(--color-fg-muted)] hidden md:table-cell capitalize">{r.origem}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.statusAprovacao] ?? ""}`}>
                    {STATUS_LABEL[r.statusAprovacao] ?? r.statusAprovacao}
                  </span>
                </td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      aria-label="Excluir batida"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ServicoTable({
  apontamentos,
  funcsById,
  servicosById,
  isLoading,
  canDelete,
  onDelete,
}: {
  apontamentos: ApontamentoServico[];
  funcsById: Map<string, { nome: string }>;
  servicosById: Map<string, Servico>;
  isLoading: boolean;
  canDelete: boolean;
  onDelete: (a: ApontamentoServico) => void;
}) {
  if (isLoading) {
    return <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">Carregando…</div>;
  }
  if (apontamentos.length === 0) {
    return <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">Nenhum apontamento no período.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left font-medium">Data</th>
            <th className="px-4 py-3 text-left font-medium">Funcionário</th>
            <th className="px-4 py-3 text-left font-medium">Tipo</th>
            <th className="px-4 py-3 text-left font-medium">Serviço / Motivo</th>
            <th className="px-4 py-3 text-right font-medium">Horas</th>
            <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Estaca</th>
            <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Lado</th>
            {canDelete && <th className="px-4 py-3 text-right font-medium" style={{ width: 60 }}>Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {apontamentos.map((a) => {
            const f = funcsById.get(a.funcionarioId);
            const s = a.servicoId ? servicosById.get(a.servicoId) : null;
            const tipoBadge =
              a.tipo === "produtivo"
                ? "bg-[var(--color-success-soft)] text-[var(--color-success-fg)]"
                : "bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]";
            return (
              <tr key={a.id} className="hover:bg-[var(--color-surface-2)]/60 transition-colors">
                <td className="px-4 py-3 tabular-nums">{fmtData(a.data)}</td>
                <td className="px-4 py-3 font-medium">{f?.nome ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${tipoBadge}`}>
                    {a.tipo}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {a.tipo === "produtivo"
                    ? (s?.nome ?? "—")
                    : <span className="text-[var(--color-warning-fg)]">{a.motivoImprodutivo ?? "Sem motivo"}</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{(a.horas ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-[var(--color-fg-muted)] hidden lg:table-cell">
                  {a.estacaInicial && a.estacaFinal
                    ? `${a.estacaInicial} → ${a.estacaFinal}`
                    : a.estacaInicial ?? "-"}
                </td>
                <td className="px-4 py-3 text-[var(--color-fg-muted)] hidden lg:table-cell capitalize">
                  {a.lado ?? "-"}
                </td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(a)}
                      aria-label="Excluir apontamento"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg px-3 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] " +
  "border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] " +
  "focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function SubBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors " +
        (active
          ? "bg-[var(--color-surface-1)] text-[var(--color-fg)] shadow-[var(--shadow-xs)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]")
      }
    >
      {children}
    </button>
  );
}

function escCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
