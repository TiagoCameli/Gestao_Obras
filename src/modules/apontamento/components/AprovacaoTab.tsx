import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, X, AlertCircle, MapPin, Briefcase } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useObrasApont } from "../hooks/useApontamentoData";
import {
  listRegistrosPontoRange,
  type RegistroPonto,
} from "../utils/pontoApi";
import {
  listApontamentosServicoRange,
  listTodosServicos,
  type ApontamentoServico,
  type Servico,
} from "../utils/apontamentoServicoApi";
import {
  aprovarFuncionarioDia,
  desaprovarFuncionarioDia,
  listAprovacoesRange,
  listFuncionariosParaAprovacao,
} from "../utils/aprovacaoApi";

const TIPO_BATIDA_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída almoço",
  retorno_almoco: "Retorno almoço",
  saida_final: "Saída final",
};

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtHora(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface CalendarMonth {
  year: number;
  month: number; // 0..11
  firstDay: Date;
  daysInMonth: number;
}

function buildMonth(year: number, month: number): CalendarMonth {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { year, month, firstDay, daysInMonth };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function dayIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export default function AprovacaoTab() {
  const qc = useQueryClient();
  const { temAcao } = useAuth();
  const canAprovar = temAcao("aprovar_apontamento_rh");

  // Estado: mês exibido + dia selecionado + filtro obra
  const initialDate = new Date();
  const [view, setView] = useState({
    year: initialDate.getFullYear(),
    month: initialDate.getMonth(),
  });
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());
  const [obraId, setObraId] = useState<string>("");

  const { data: obras = [] } = useObrasApont();

  const cal = useMemo(() => buildMonth(view.year, view.month), [view]);

  const monthStart = dayIso(view.year, view.month, 1);
  const monthEnd = dayIso(view.year, view.month, cal.daysInMonth);

  // Aprovações do mês inteiro (para colorir o calendário)
  const { data: aprovacoesMes = [] } = useQuery({
    queryKey: ["apont", "aprovacoes", monthStart, monthEnd],
    queryFn: () => listAprovacoesRange(monthStart, monthEnd),
  });

  // Batidas do mês inteiro: usadas pra determinar quem bateu ponto em cada
  // dia. Cards e marcadores do calendário só consideram quem registrou.
  const { data: registrosMes = [] } = useQuery({
    queryKey: ["apont", "aprov-ponto-mes", monthStart, monthEnd],
    queryFn: () =>
      listRegistrosPontoRange({ dataInicio: monthStart, dataFim: monthEnd }),
  });

  // Funcionários (filtrados por obra, se aplicável)
  const { data: funcionarios = [] } = useQuery({
    queryKey: ["apont", "aprov-funcs", obraId],
    queryFn: () => listFuncionariosParaAprovacao(obraId || undefined),
  });

  // Para o dia selecionado: batidas + apontamentos
  const { data: registros = [] } = useQuery({
    queryKey: ["apont", "aprov-ponto", selectedDay],
    queryFn: () =>
      listRegistrosPontoRange({ dataInicio: selectedDay, dataFim: selectedDay }),
  });

  const { data: apontamentos = [] } = useQuery({
    queryKey: ["apont", "aprov-servico", selectedDay],
    queryFn: () =>
      listApontamentosServicoRange({
        dataInicio: selectedDay,
        dataFim: selectedDay,
      }),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ["apont", "servicos-todos"],
    queryFn: listTodosServicos,
    staleTime: 60_000,
  });

  // Maps
  const aprovadosNoMesPorDia = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of aprovacoesMes) {
      if (!m.has(a.data)) m.set(a.data, new Set());
      m.get(a.data)!.add(a.funcionarioId);
    }
    return m;
  }, [aprovacoesMes]);

  // Quem bateu ponto em cada dia do mês (set de funcionarioIds).
  const battersPorDia = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of registrosMes) {
      if (r.statusAprovacao === "rejeitado") continue;
      if (!m.has(r.data)) m.set(r.data, new Set());
      m.get(r.data)!.add(r.funcionarioId);
    }
    return m;
  }, [registrosMes]);

  const registrosPorFunc = useMemo(() => {
    const m = new Map<string, RegistroPonto[]>();
    for (const r of registros) {
      const arr = m.get(r.funcionarioId) ?? [];
      arr.push(r);
      m.set(r.funcionarioId, arr);
    }
    return m;
  }, [registros]);

  const apontPorFunc = useMemo(() => {
    const m = new Map<string, ApontamentoServico[]>();
    for (const a of apontamentos) {
      const arr = m.get(a.funcionarioId) ?? [];
      arr.push(a);
      m.set(a.funcionarioId, arr);
    }
    return m;
  }, [apontamentos]);

  const servicosById = useMemo(
    () => new Map((servicos as Servico[]).map((s) => [s.id, s])),
    [servicos]
  );

  // Mutations
  const aprovarM = useMutation({
    mutationFn: ({ funcionarioId, data }: { funcionarioId: string; data: string }) =>
      aprovarFuncionarioDia(funcionarioId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apont", "aprovacoes"] });
    },
  });
  const desaprovarM = useMutation({
    mutationFn: ({ funcionarioId, data }: { funcionarioId: string; data: string }) =>
      desaprovarFuncionarioDia(funcionarioId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apont", "aprovacoes"] });
    },
  });

  // Cards do dia: somente funcionários que registraram ponto nesse dia.
  // Quem não bateu ponto não aparece (= dia não-trabalhado, ausência etc.).
  const aprovadosDoDia = aprovadosNoMesPorDia.get(selectedDay) ?? new Set<string>();
  const battersDoDia = battersPorDia.get(selectedDay) ?? new Set<string>();
  const funcionariosDoDia = useMemo(
    () => funcionarios.filter((f) => battersDoDia.has(f.id)),
    [funcionarios, battersDoDia]
  );

  function changeMonth(delta: number) {
    setView((v) => {
      const nextMonth = v.month + delta;
      const nextYear = v.year + Math.floor(nextMonth / 12);
      const normalized = ((nextMonth % 12) + 12) % 12;
      return { year: nextYear, month: normalized };
    });
  }

  // Dias do calendário (com células vazias do offset inicial)
  const offsetStart = cal.firstDay.getDay(); // 0=Dom..6=Sab
  const dayCells: (number | null)[] = [];
  for (let i = 0; i < offsetStart; i++) dayCells.push(null);
  for (let d = 1; d <= cal.daysInMonth; d++) dayCells.push(d);

  // Coloração do calendário: considera somente quem bateu ponto no dia.
  // - approved: todos os que bateram estão aprovados
  // - partial:  alguns aprovados
  // - pending:  ninguém aprovado, mas houve batidas
  // - empty:    ninguém bateu ponto (sem marcador)
  // - future:   data futura
  function statusDoDia(day: number): "approved" | "partial" | "pending" | "empty" | "future" {
    const iso = dayIso(view.year, view.month, day);
    if (iso > todayIso()) return "future";
    const batters = battersPorDia.get(iso);
    if (!batters || batters.size === 0) return "empty";
    const aprovados = aprovadosNoMesPorDia.get(iso) ?? new Set<string>();
    let aprovCount = 0;
    for (const id of batters) {
      if (aprovados.has(id)) aprovCount++;
    }
    if (aprovCount >= batters.size) return "approved";
    if (aprovCount > 0) return "partial";
    return "pending";
  }

  return (
    <div className="space-y-5">
      {/* Filtro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        <Field label="Obra">
          <select
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            className={inputCls}
          >
            <option value="">Todas as obras</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </Field>
        <div className="text-xs text-[var(--color-fg-subtle)] md:text-right">
          {funcionarios.length}{" "}
          {funcionarios.length === 1 ? "funcionário ativo" : "funcionários ativos"}{" "}
          {obraId ? "nesta obra" : "no total"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* Calendário */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 shadow-[var(--shadow-xs)] h-fit">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold tracking-tight">
              {MONTH_NAMES[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEK_DAYS.map((w, i) => (
              <div
                key={i}
                className="text-[10px] uppercase font-semibold text-center text-[var(--color-fg-subtle)] tracking-wider py-1"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dayCells.map((d, idx) => {
              if (d === null) return <div key={`e${idx}`} />;
              const iso = dayIso(view.year, view.month, d);
              const status = statusDoDia(d);
              const selected = iso === selectedDay;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  className={
                    "relative aspect-square rounded-md text-xs font-medium tabular-nums transition-colors flex items-center justify-center " +
                    (selected
                      ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] shadow-sm"
                      : status === "approved"
                        ? "bg-[var(--color-success-soft)] text-[var(--color-success-fg)] hover:brightness-110"
                        : status === "partial"
                          ? "bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] hover:brightness-110"
                          : status === "future"
                            ? "text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-2)]"
                            : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]")
                  }
                >
                  {d}
                  {!selected && (status === "approved" || status === "partial" || status === "pending") && (
                    <span
                      className={
                        "absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full " +
                        (status === "approved"
                          ? "bg-[var(--color-success)]"
                          : status === "partial"
                            ? "bg-[var(--color-warning)]"
                            : "bg-[var(--color-danger)]")
                      }
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-fg-subtle)]">
            <Legend color="var(--color-success)" label="Aprovado" />
            <Legend color="var(--color-warning)" label="Parcial" />
            <Legend color="var(--color-danger)" label="Pendente" />
          </div>
        </div>

        {/* Cards do dia */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-base font-semibold tracking-tight">
              Dia {fmtData(selectedDay)}
            </h3>
            <span className="text-xs text-[var(--color-fg-subtle)]">
              {Array.from(battersDoDia).filter((id) => aprovadosDoDia.has(id)).length} de{" "}
              {funcionariosDoDia.length} aprovados
            </span>
          </div>

          {funcionariosDoDia.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-muted)]">
              Nenhum funcionário registrou ponto neste dia
              {obraId ? " (com o filtro de obra atual)" : ""}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {funcionariosDoDia.map((f) => {
                const aprovado = aprovadosDoDia.has(f.id);
                const rs = (registrosPorFunc.get(f.id) ?? []).filter(
                  (r) => r.statusAprovacao !== "rejeitado"
                );
                const aps = apontPorFunc.get(f.id) ?? [];
                const totalHoras = aps.reduce((s, a) => s + (a.horas ?? 0), 0);

                return (
                  <article
                    key={f.id}
                    className={
                      "rounded-xl border p-4 transition-colors " +
                      (aprovado
                        ? "border-[var(--color-success)]/40 bg-[var(--color-success-soft)]/30"
                        : "border-[var(--color-border)] bg-[var(--color-surface-1)]")
                    }
                  >
                    <header className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-[var(--color-fg)] truncate">
                          {f.nome}
                        </h4>
                        <span
                          className={
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold mt-1 " +
                            (aprovado
                              ? "bg-[var(--color-success-soft)] text-[var(--color-success-fg)]"
                              : "bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]")
                          }
                        >
                          {aprovado ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          {aprovado ? "Aprovado" : "Pendente"}
                        </span>
                      </div>
                      {canAprovar && (
                        <button
                          type="button"
                          onClick={() =>
                            aprovado
                              ? desaprovarM.mutate({
                                  funcionarioId: f.id,
                                  data: selectedDay,
                                })
                              : aprovarM.mutate({
                                  funcionarioId: f.id,
                                  data: selectedDay,
                                })
                          }
                          className={
                            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 border " +
                            (aprovado
                              ? "bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40"
                              : "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] border-transparent hover:brightness-110")
                          }
                          disabled={aprovarM.isPending || desaprovarM.isPending}
                        >
                          {aprovado ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                          {aprovado ? "Reverter" : "Aprovar"}
                        </button>
                      )}
                    </header>

                    {/* Registro de ponto */}
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        Registro de ponto
                      </p>
                      {rs.length === 0 ? (
                        <p className="text-xs text-[var(--color-fg-muted)] italic">
                          Sem batidas registradas.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["entrada", "saida_almoco", "retorno_almoco", "saida_final"] as const).map((tipo) => {
                            const r = rs.find((x) => x.tipoBatida === tipo);
                            return (
                              <div
                                key={tipo}
                                className={
                                  "px-2 py-1.5 rounded text-[11px] " +
                                  (r
                                    ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                                    : "bg-[var(--color-surface-2)]/50 text-[var(--color-fg-subtle)]")
                                }
                              >
                                <div className="text-[9px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                                  {TIPO_BATIDA_LABEL[tipo]}
                                </div>
                                <div className="tabular-nums font-medium">
                                  {r ? fmtHora(r.hora) : "—"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Apontamento por serviço */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold mb-1.5 flex items-center gap-1.5 justify-between">
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3" />
                          Apontamento por serviço
                        </span>
                        <span className="text-[var(--color-fg-muted)] tabular-nums normal-case tracking-normal">
                          {totalHoras.toFixed(1)} h
                        </span>
                      </p>
                      {aps.length === 0 ? (
                        <p className="text-xs text-[var(--color-fg-muted)] italic">
                          Sem apontamentos lançados.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {aps.map((a) => {
                            const s = a.servicoId
                              ? servicosById.get(a.servicoId)
                              : null;
                            const desc =
                              a.tipo === "produtivo"
                                ? s?.nome ?? "—"
                                : a.motivoImprodutivo ?? "Improdutivo";
                            return (
                              <li
                                key={a.id}
                                className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[var(--color-surface-2)] text-[11px]"
                              >
                                <span className="truncate flex items-center gap-1.5">
                                  <span
                                    className={
                                      "shrink-0 w-1.5 h-1.5 rounded-full " +
                                      (a.tipo === "produtivo"
                                        ? "bg-[var(--color-success)]"
                                        : "bg-[var(--color-warning)]")
                                    }
                                  />
                                  {desc}
                                </span>
                                <span className="text-[var(--color-fg-muted)] tabular-nums shrink-0">
                                  {(a.horas ?? 0).toFixed(2)} h
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg px-3 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] " +
  "border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] " +
  "focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
