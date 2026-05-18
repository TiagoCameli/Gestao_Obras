import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, X, AlertCircle, MapPin, Briefcase, Pencil } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import SmartSelect from "../../../components/ui/SmartSelect";
import Input from "../../../components/ui/Input";
import { useAuth } from "../../../contexts/AuthContext";
import { useObrasApont } from "../hooks/useApontamentoData";
import {
  atualizarHoraBatida,
  excluirBatida,
  getFotoPontoUrls,
  listRegistrosPontoRange,
  registrarBatida,
  type RegistroPonto,
} from "../utils/pontoApi";
import {
  listApontamentosServicoRange,
  listTodosServicos,
  listServicosDaObra,
  type ApontamentoServico,
  type Servico,
} from "../utils/apontamentoServicoApi";
import {
  aprovarFuncionarioDia,
  desaprovarFuncionarioDia,
  listAprovacoesRange,
  listFuncionariosParaAprovacao,
} from "../utils/aprovacaoApi";
import LancamentoServicoModal from "./LancamentoServicoModal";

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

  // B3.6 — Detecta offline para congelar mutações que dependem de rede ativa
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    function on() { setOnline(true); }
    function off() { setOnline(false); }
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Estado: mês exibido + dia selecionado + filtro obra
  const initialDate = new Date();
  const [view, setView] = useState({
    year: initialDate.getFullYear(),
    month: initialDate.getMonth(),
  });
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());
  const [obraId, setObraId] = useState<string>("");

  // MW1 — Aprovação em lote: ids selecionados no dia atual
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  // Limpa seleção ao trocar de dia
  useEffect(() => {
    setSelecionados(new Set());
  }, [selectedDay]);

  // B1.1 — Atalhos de teclado: cursor (índice do card em foco) + ajuda
  const [cursor, setCursor] = useState<number>(0);
  const [mostrarAjuda, setMostrarAjuda] = useState<boolean>(false);

  // B1.2 — Filtro "Ocultar aprovados"
  const [ocultarAprovados, setOcultarAprovados] = useState<boolean>(false);

  // B1.4 — Ids elegíveis para aprovação em lote (pendentes + sem bloqueio)
  // Calculados num único useMemo abaixo, depois de registrosPorFunc / apontPorFunc estarem prontos.
  // Primeira vez: mostrar mini-tutorial
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visto = localStorage.getItem('aprovacao_atalhos_visto');
    if (!visto) {
      setMostrarAjuda(true);
      localStorage.setItem('aprovacao_atalhos_visto', '1');
    }
  }, []);

  // Inline edit state
  const [editandoBatida, setEditandoBatida] = useState<RegistroPonto | null>(null);
  // UX1 — criar batida que ainda não foi feita direto da Aprovação
  const [criandoBatida, setCriandoBatida] = useState<{
    funcionarioId: string;
    funcionarioNome: string;
    data: string;
    tipoBatida: 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';
  } | null>(null);
  const [editandoServicoFunc, setEditandoServicoFunc] = useState<{
    funcionarioId: string;
    nome: string;
    iniciais: ApontamentoServico[];
  } | null>(null);

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

  // B1.4 — Elegíveis: têm entrada, saída final, e horas apontadas cobrem ponto.
  const idsElegiveis = useMemo<string[]>(() => {
    const out: string[] = [];
    const aprovados = aprovadosNoMesPorDia.get(selectedDay) ?? new Set<string>();
    const batters = battersPorDia.get(selectedDay) ?? new Set<string>();
    for (const f of funcionarios) {
      if (!batters.has(f.id)) continue;
      if (aprovados.has(f.id)) continue;
      const rs = (registrosPorFunc.get(f.id) ?? []).filter((r) => r.statusAprovacao !== 'rejeitado');
      const entrada = rs.find((r) => r.tipoBatida === 'entrada');
      const saidaFinal = rs.find((r) => r.tipoBatida === 'saida_final');
      const saidaAlmoco = rs.find((r) => r.tipoBatida === 'saida_almoco');
      const retornoAlmoco = rs.find((r) => r.tipoBatida === 'retorno_almoco');
      if (!entrada || !saidaFinal) continue;
      const aps = apontPorFunc.get(f.id) ?? [];
      const totalH = aps.reduce((s, a) => s + (a.horas ?? 0), 0);
      const ms = (a: RegistroPonto, b: RegistroPonto) =>
        new Date(b.hora).getTime() - new Date(a.hora).getTime();
      let horasPonto = 0;
      if (saidaAlmoco && retornoAlmoco) {
        horasPonto = (ms(entrada, saidaAlmoco) + ms(retornoAlmoco, saidaFinal)) / 3_600_000;
      } else {
        horasPonto = ms(entrada, saidaFinal) / 3_600_000;
      }
      if (horasPonto > 0 && totalH + 0.01 >= horasPonto) {
        out.push(f.id);
      }
    }
    return out;
  }, [funcionarios, aprovadosNoMesPorDia, battersPorDia, selectedDay, registrosPorFunc, apontPorFunc]);

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
  const funcionariosDoDiaTodos = useMemo(
    () => funcionarios.filter((f) => battersDoDia.has(f.id)),
    [funcionarios, battersDoDia]
  );
  // B1.2 — aplica filtro "ocultar aprovados"
  const funcionariosDoDia = useMemo(
    () => (ocultarAprovados ? funcionariosDoDiaTodos.filter((f) => !aprovadosDoDia.has(f.id)) : funcionariosDoDiaTodos),
    [funcionariosDoDiaTodos, ocultarAprovados, aprovadosDoDia]
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
  // - overdue:  pendente E mais de 7 dias atrás (atraso crítico)
  // - pending:  ninguém aprovado, mas houve batidas (≤ 7 dias)
  // - empty:    ninguém bateu ponto (sem marcador)
  // - future:   data futura
  function statusDoDia(
    day: number
  ): "approved" | "partial" | "overdue" | "pending" | "empty" | "future" {
    const iso = dayIso(view.year, view.month, day);
    const todayIsoStr = todayIso();
    if (iso > todayIsoStr) return "future";
    const batters = battersPorDia.get(iso);
    if (!batters || batters.size === 0) return "empty";
    const aprovados = aprovadosNoMesPorDia.get(iso) ?? new Set<string>();
    let aprovCount = 0;
    for (const id of batters) {
      if (aprovados.has(id)) aprovCount++;
    }
    if (aprovCount >= batters.size) return "approved";
    if (aprovCount > 0) return "partial";
    // Pendente: verifica se já passou de 7 dias do registro até hoje.
    const diffDias =
      (Date.parse(todayIsoStr) - Date.parse(iso)) / (1000 * 60 * 60 * 24);
    if (diffDias > 7) return "overdue";
    return "pending";
  }

  // B1.1 — Atalhos de teclado globais para a aba Aprovação
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignora se foco está em input/textarea/contentEditable
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
      // Ignora se algum modal está aberto
      if (editandoBatida || criandoBatida || editandoServicoFunc) return;

      const lista = funcionariosDoDia;
      if (lista.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, lista.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === '?') {
        setMostrarAjuda((v) => !v);
      } else if ((e.key === 'a' || e.key === 'A') && canAprovar) {
        const f = lista[cursor];
        if (!f) return;
        if (aprovadosDoDia.has(f.id)) return; // já aprovado
        e.preventDefault();
        aprovarM.mutate({ funcionarioId: f.id, data: selectedDay });
      } else if ((e.key === 'r' || e.key === 'R') && canAprovar) {
        const f = lista[cursor];
        if (!f) return;
        if (!aprovadosDoDia.has(f.id)) return; // só pode reverter aprovado
        e.preventDefault();
        desaprovarM.mutate({ funcionarioId: f.id, data: selectedDay });
      } else if ((e.key === 'e' || e.key === 'E') && canAprovar) {
        const f = lista[cursor];
        if (!f) return;
        e.preventDefault();
        setEditandoServicoFunc({
          funcionarioId: f.id,
          nome: f.nome,
          iniciais: apontPorFunc.get(f.id) ?? [],
        });
      } else if (e.key === 'Escape') {
        setMostrarAjuda(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, funcionariosDoDia, aprovadosDoDia, canAprovar, editandoBatida, criandoBatida, editandoServicoFunc]);

  // Mantém cursor dentro do range quando a lista muda
  useEffect(() => {
    if (cursor >= funcionariosDoDia.length) setCursor(Math.max(0, funcionariosDoDia.length - 1));
  }, [funcionariosDoDia.length, cursor]);

  return (
    <div className="space-y-5">
      {/* B3.6 — Banner offline */}
      {!online && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-[var(--color-warning-soft)] border-[var(--color-warning)]/30 text-[var(--color-warning-fg)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-warning)] animate-pulse" />
          <span className="text-xs font-medium">
            Offline — botões de aprovar/reverter desabilitados. Volte online para continuar.
          </span>
        </div>
      )}
      {/* Filtro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        <Field label="Obra">
          <SmartSelect
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            className={inputCls + ' text-left flex items-center'}
          >
            <option value="">Todas as obras</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </SmartSelect>
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
                          : status === "overdue"
                            ? "bg-purple-500/15 text-purple-300 hover:brightness-110"
                            : status === "future"
                              ? "text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-2)]"
                              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]")
                  }
                >
                  {d}
                  {!selected && (status === "approved" || status === "partial" || status === "pending" || status === "overdue") && (
                    <span
                      className={
                        "absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full " +
                        (status === "approved"
                          ? "bg-[var(--color-success)]"
                          : status === "partial"
                            ? "bg-[var(--color-warning)]"
                            : status === "overdue"
                              ? "bg-purple-500"
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
            <Legend color="rgb(168 85 247)" label="Atraso > 7d" />
          </div>
        </div>

        {/* Cards do dia */}
        <div>
          {/* PWA2 — Sticky header: mantém o dia + progresso visível ao rolar.
              `top-0` (mobile) / `lg:top-0` ativam sticky em todas as larguras. */}
          <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-3 bg-[var(--color-bg)]/90 backdrop-blur-sm border-b border-[var(--color-border)]">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-base font-semibold tracking-tight">
                Dia {fmtData(selectedDay)}
              </h3>
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                {/* B1.4 — Aprovar todos elegíveis */}
                {canAprovar && idsElegiveis.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Aprovar ${idsElegiveis.length} funcionário${idsElegiveis.length > 1 ? 's' : ''} elegíve${idsElegiveis.length > 1 ? 'is' : 'l'} de uma vez?`)) return;
                      for (const id of idsElegiveis) {
                        await aprovarM.mutateAsync({ funcionarioId: id, data: selectedDay });
                      }
                    }}
                    disabled={aprovarM.isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--color-success)] text-white hover:brightness-110 disabled:opacity-50 transition-all"
                    title={`${idsElegiveis.length} elegível${idsElegiveis.length > 1 ? 'eis' : ''} (com entrada/saída e horas batendo)`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {aprovarM.isPending ? 'Aprovando…' : `Aprovar ${idsElegiveis.length} elegíve${idsElegiveis.length > 1 ? 'is' : 'l'}`}
                  </button>
                )}
                {/* B1.2 — Switch ocultar aprovados */}
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
                  <input
                    type="checkbox"
                    checked={ocultarAprovados}
                    onChange={(e) => setOcultarAprovados(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  Ocultar aprovados
                </label>
                <span className="text-xs text-[var(--color-fg-muted)] tabular-nums shrink-0">
                  {Array.from(battersDoDia).filter((id) => aprovadosDoDia.has(id)).length} / {funcionariosDoDiaTodos.length}{" "}
                  aprovados
                </span>
              </div>
            </div>
            {/* Barra de progresso mini — sempre baseada no total do dia, não no filtrado */}
            {funcionariosDoDiaTodos.length > 0 && (
              <div className="mt-1.5 h-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-success)] transition-all"
                  style={{
                    width: `${
                      (Array.from(battersDoDia).filter((id) => aprovadosDoDia.has(id)).length /
                        funcionariosDoDiaTodos.length) *
                      100
                    }%`,
                  }}
                />
              </div>
            )}
          </div>

          {funcionariosDoDia.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-muted)]">
              Nenhum funcionário registrou ponto neste dia
              {obraId ? " (com o filtro de obra atual)" : ""}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {funcionariosDoDia.map((f, idx) => {
                const aprovado = aprovadosDoDia.has(f.id);
                const isFocused = idx === cursor;
                const rs = (registrosPorFunc.get(f.id) ?? []).filter(
                  (r) => r.statusAprovacao !== "rejeitado"
                );
                const aps = apontPorFunc.get(f.id) ?? [];
                const totalHoras = aps.reduce((s, a) => s + (a.horas ?? 0), 0);

                // ─── Regras pra aprovar ────────────────────────────────
                // 1. Tem que existir batida de ENTRADA.
                // 2. Tem que existir batida de SAÍDA FINAL.
                // 3. Soma de horas dos apontamentos por serviço >= horas
                //    trabalhadas calculadas pelo ponto (com 0.01h tol.).
                const entrada = rs.find((r) => r.tipoBatida === "entrada");
                const saidaAlmoco = rs.find((r) => r.tipoBatida === "saida_almoco");
                const retornoAlmoco = rs.find((r) => r.tipoBatida === "retorno_almoco");
                const saidaFinal = rs.find((r) => r.tipoBatida === "saida_final");
                let horasPonto = 0;
                if (entrada && saidaFinal) {
                  const ms = (a: RegistroPonto, b: RegistroPonto) =>
                    new Date(b.hora).getTime() - new Date(a.hora).getTime();
                  if (saidaAlmoco && retornoAlmoco) {
                    horasPonto =
                      (ms(entrada, saidaAlmoco) + ms(retornoAlmoco, saidaFinal)) /
                      3_600_000;
                  } else {
                    horasPonto = ms(entrada, saidaFinal) / 3_600_000;
                  }
                }
                const cobreHoras = horasPonto > 0 && totalHoras + 0.01 >= horasPonto;
                const motivosBloqueio: string[] = [];
                if (!entrada) motivosBloqueio.push("falta entrada");
                if (!saidaFinal) motivosBloqueio.push("falta saída final");
                if (entrada && saidaFinal && !cobreHoras)
                  motivosBloqueio.push(
                    `apontamento (${totalHoras.toFixed(1)} h) não cobre as ${horasPonto.toFixed(1)} h trabalhadas`
                  );
                const podeAprovar = motivosBloqueio.length === 0;

                return (
                  <article
                    key={f.id}
                    onClick={() => setCursor(idx)}
                    className={
                      "rounded-xl border p-4 transition-colors cursor-pointer " +
                      (aprovado
                        ? "border-[var(--color-success)]/40 bg-[var(--color-success-soft)]/30"
                        : "border-[var(--color-border)] bg-[var(--color-surface-1)]") +
                      (isFocused ? " ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]" : "")
                    }
                  >
                    <header className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex items-start gap-2">
                        {/* MW1 — checkbox de seleção para aprovação em lote */}
                        {canAprovar && !aprovado && podeAprovar && (
                          <input
                            type="checkbox"
                            checked={selecionados.has(f.id)}
                            onChange={(e) => {
                              const next = new Set(selecionados);
                              if (e.target.checked) next.add(f.id);
                              else next.delete(f.id);
                              setSelecionados(next);
                            }}
                            className="w-4 h-4 mt-0.5 shrink-0"
                            aria-label={`Selecionar ${f.nome} para aprovação em lote`}
                          />
                        )}
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
                            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 border disabled:opacity-50 disabled:cursor-not-allowed " +
                            (aprovado
                              ? "bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40"
                              : "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] border-transparent hover:brightness-110")
                          }
                          disabled={
                            aprovarM.isPending ||
                            desaprovarM.isPending ||
                            (!aprovado && !podeAprovar) ||
                            !online /* B3.6 — congela quando offline */
                          }
                          title={
                            !online
                              ? "Sem conexão — volte online para aprovar/reverter"
                              : !aprovado && !podeAprovar
                              ? `Não pode aprovar: ${motivosBloqueio.join(" · ")}`
                              : undefined
                          }
                        >
                          {aprovado ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                          {aprovado ? "Reverter" : "Aprovar"}
                        </button>
                      )}
                    </header>

                    {/* Aviso quando o card não pode ser aprovado ainda */}
                    {!aprovado && !podeAprovar && canAprovar && (
                      <div className="mb-3 rounded-md bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/30 px-2.5 py-1.5 text-[10px] text-[var(--color-warning-fg)] flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{motivosBloqueio.join(" · ")}</span>
                      </div>
                    )}

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
                          {(["entrada", "saida_final"] as const).map((tipo) => {
                            const r = rs.find((x) => x.tipoBatida === tipo);
                            const cell = (
                              <div
                                className={
                                  "px-2 py-1.5 rounded text-[11px] flex items-start justify-between gap-1 " +
                                  (r
                                    ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                                    : "bg-[var(--color-surface-2)]/50 text-[var(--color-fg-subtle)]")
                                }
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                                    {TIPO_BATIDA_LABEL[tipo]}
                                  </div>
                                  <div className="tabular-nums font-medium">
                                    {r ? fmtHora(r.hora) : "—"}
                                  </div>
                                </div>
                                {r && canAprovar && (
                                  <Pencil className="w-3 h-3 text-[var(--color-fg-subtle)] shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                            if (r && canAprovar) {
                              return (
                                <button
                                  key={tipo}
                                  type="button"
                                  onClick={() => setEditandoBatida(r)}
                                  className="text-left hover:brightness-125 transition-[filter]"
                                >
                                  {cell}
                                </button>
                              );
                            }
                            // UX1 — sem batida + permissão → permite criar
                            if (!r && canAprovar) {
                              return (
                                <button
                                  key={tipo}
                                  type="button"
                                  onClick={() =>
                                    setCriandoBatida({
                                      funcionarioId: f.id,
                                      funcionarioNome: f.nome,
                                      data: selectedDay,
                                      tipoBatida: tipo,
                                    })
                                  }
                                  className="text-left rounded text-[11px] px-2 py-1.5 border border-dashed border-[var(--color-border)] text-[var(--color-fg-subtle)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-soft)]/30 transition-colors"
                                >
                                  <div className="text-[9px] uppercase tracking-wider">
                                    {TIPO_BATIDA_LABEL[tipo]}
                                  </div>
                                  <div className="text-[10px]">+ Adicionar</div>
                                </button>
                              );
                            }
                            return <div key={tipo}>{cell}</div>;
                          })}
                        </div>
                      )}
                    </div>

                    {/* Foto + mapa de cada batida que tem GPS/foto */}
                    {rs.some((r) => r.foto || (r.latitude && r.longitude)) && (
                      <div className="mb-3 grid grid-cols-2 gap-1.5">
                        {rs
                          .filter((r) => r.foto || (r.latitude && r.longitude))
                          .map((r) => (
                            <FotoMapaThumb key={r.id} registro={r} />
                          ))}
                      </div>
                    )}

                    {/* B3.1 — Tempo trabalhado: hh:mm → hh:mm (Xh Ymin) */}
                    {entrada && saidaFinal && horasPonto > 0 && (
                      <div className="mb-3 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[var(--color-info-soft)]/40 border border-[var(--color-info)]/20">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
                          Tempo trabalhado
                        </span>
                        <span className="text-xs tabular-nums font-medium text-[var(--color-fg)]">
                          {fmtHora(entrada.hora)} → {fmtHora(saidaFinal.hora)}
                          <span className="text-[var(--color-fg-muted)] ml-1.5">
                            ({Math.floor(horasPonto)}h {Math.round((horasPonto % 1) * 60).toString().padStart(2, '0')}min)
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Apontamento por serviço */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold mb-1.5 flex items-center gap-1.5 justify-between">
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3" />
                          Apontamento por serviço
                        </span>
                        <span className="flex items-center gap-2 normal-case tracking-normal">
                          <span className="text-[var(--color-fg-muted)] tabular-nums">
                            {totalHoras.toFixed(1)} h
                          </span>
                          {canAprovar && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditandoServicoFunc({
                                  funcionarioId: f.id,
                                  nome: f.nome,
                                  iniciais: aps,
                                })
                              }
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-accent-fg)] hover:underline"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                              {aps.length === 0 ? "Lançar" : "Editar"}
                            </button>
                          )}
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

      {/* Modal: editar hora da batida + ver foto + mapa */}
      <EditarBatidaModal
        registro={editandoBatida}
        onClose={() => setEditandoBatida(null)}
        onSaved={() => {
          setEditandoBatida(null);
          qc.invalidateQueries({ queryKey: ["apont", "aprov-ponto"] });
          qc.invalidateQueries({ queryKey: ["apont", "aprov-ponto-mes"] });
        }}
      />

      {/* UX1 — Modal: criar batida faltante direto da Aprovação */}
      {criandoBatida && (
        <CriarBatidaModal
          info={criandoBatida}
          onClose={() => setCriandoBatida(null)}
          onSaved={() => {
            setCriandoBatida(null);
            qc.invalidateQueries({ queryKey: ["apont", "aprov-ponto"] });
            qc.invalidateQueries({ queryKey: ["apont", "aprov-ponto-mes"] });
          }}
        />
      )}

      {/* Modal: editar lançamento de serviço (reusa o LancamentoModal) */}
      {editandoServicoFunc && (
        <EditarServicoFuncWrapper
          funcionarioId={editandoServicoFunc.funcionarioId}
          nome={editandoServicoFunc.nome}
          data={selectedDay}
          iniciais={editandoServicoFunc.iniciais}
          obraId={obraId}
          horasDoFunc={
            // Calcula horas do ponto pra esse funcionário no dia (mesma lógica do calc)
            (() => {
              const rs = registrosPorFunc.get(editandoServicoFunc.funcionarioId) ?? [];
              const ok = rs.filter((r) => r.statusAprovacao !== "rejeitado");
              const get = (t: RegistroPonto["tipoBatida"]) =>
                ok.find((r) => r.tipoBatida === t);
              const entrada = get("entrada");
              if (!entrada) return 0;
              const sa = get("saida_almoco");
              const ra = get("retorno_almoco");
              const sf = get("saida_final");
              const ms = (a?: RegistroPonto, b?: RegistroPonto) =>
                a && b
                  ? new Date(b.hora).getTime() - new Date(a.hora).getTime()
                  : 0;
              if (sa && ra && sf)
                return (ms(entrada, sa) + ms(ra, sf)) / 3_600_000;
              if (sf) return ms(entrada, sf) / 3_600_000;
              return 0;
            })()
          }
          onClose={() => setEditandoServicoFunc(null)}
          onSaved={() => {
            setEditandoServicoFunc(null);
            qc.invalidateQueries({ queryKey: ["apont", "aprov-servico"] });
          }}
        />
      )}

      {/* B1.1 — Botão "?" fixo + painel de atalhos */}
      <button
        type="button"
        onClick={() => setMostrarAjuda(true)}
        aria-label="Mostrar atalhos de teclado"
        title="Atalhos de teclado (?)"
        className="hidden md:inline-flex fixed bottom-5 left-5 z-30 w-10 h-10 items-center justify-center rounded-full bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] shadow-[var(--shadow-md)]"
      >
        ?
      </button>
      {mostrarAjuda && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Atalhos de teclado"
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setMostrarAjuda(false)}
        >
          <div
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-6 max-w-md w-full shadow-[var(--shadow-xl)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold tracking-tight">Atalhos de teclado</h3>
              <button
                type="button"
                onClick={() => setMostrarAjuda(false)}
                aria-label="Fechar"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-2.5 text-sm">
              {[
                { k: "→", label: "Próximo funcionário" },
                { k: "←", label: "Funcionário anterior" },
                { k: "A", label: "Aprovar o card em foco" },
                { k: "R", label: "Reverter aprovação (se já aprovado)" },
                { k: "E", label: "Editar/lançar apontamento por serviço" },
                { k: "?", label: "Abrir/fechar esta ajuda" },
                { k: "Esc", label: "Fechar diálogos" },
              ].map((it) => (
                <div key={it.k} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-fg-muted)]">{it.label}</span>
                  <kbd className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-mono font-semibold">
                    {it.k}
                  </kbd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-[var(--color-fg-subtle)] mt-4 pt-3 border-t border-[var(--color-border)]">
              Dica: o card em foco fica destacado com borda colorida. Clique em qualquer card para movê-lo o foco.
            </p>
          </div>
        </div>
      )}

      {/* MW1 — Barra flutuante de aprovação em lote */}
      {canAprovar && selecionados.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-full shadow-[var(--shadow-xl)] pl-5 pr-2 py-2">
          <span className="text-sm font-medium text-[var(--color-fg)]">
            {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setSelecionados(new Set())}
            className="text-xs px-3 py-1.5 rounded-full text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={async () => {
              const ids = Array.from(selecionados);
              for (const id of ids) {
                await aprovarM.mutateAsync({ funcionarioId: id, data: selectedDay });
              }
              setSelecionados(new Set());
            }}
            disabled={aprovarM.isPending}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-[var(--color-success)] text-white hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <Check className="w-4 h-4" />
            {aprovarM.isPending ? 'Aprovando…' : `Aprovar ${selecionados.size}`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Foto + mini-mapa de uma batida ──────────────────────────────────── */
function FotoMapaThumb({ registro }: { registro: RegistroPonto }) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  // PWA3 — overlay de foto em tela cheia
  const [zoom, setZoom] = useState(false);
  // B3.2 — fallback quando foto falha ao carregar
  const [fotoErro, setFotoErro] = useState(false);

  useEffect(() => {
    if (!registro.foto) return;
    let alive = true;
    getFotoPontoUrls([registro.foto]).then((m) => {
      if (alive && registro.foto) setFotoUrl(m[registro.foto] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [registro.foto]);

  // PWA3 — fecha com ESC
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [zoom]);

  const hasGps = registro.latitude != null && registro.longitude != null;
  const tipoLabel = TIPO_BATIDA_LABEL[registro.tipoBatida] ?? registro.tipoBatida;

  return (
    <div className="rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-fg-subtle)] px-2 py-1 border-b border-[var(--color-border)]">
        {tipoLabel} · {fmtHora(registro.hora)}
      </div>
      <div className="grid grid-cols-2">
        {fotoUrl && !fotoErro ? (
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="block aspect-square bg-black focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            aria-label={`Ampliar foto da ${tipoLabel}`}
          >
            <img
              src={fotoUrl}
              alt={`Foto ${tipoLabel}`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setFotoErro(true)}
            />
          </button>
        ) : (
          /* B3.2 — Fallback colorido com ícone quando foto não carrega ou não existe */
          <div className="aspect-square flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-surface-3)] text-[var(--color-fg-subtle)]">
            <svg className="w-6 h-6 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span className="text-[9px]">{fotoErro ? "foto indisponível" : "sem foto"}</span>
          </div>
        )}
        {/* PWA3 — overlay de tela cheia */}
        {zoom && fotoUrl && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Foto da ${tipoLabel} em tela cheia`}
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
            onClick={() => setZoom(false)}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setZoom(false); }}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute top-4 left-4 text-white text-sm font-medium">
              {tipoLabel} · {fmtHora(registro.hora)}
            </div>
            <img
              src={fotoUrl}
              alt={`Foto ${tipoLabel} ampliada`}
              className="max-w-[95vw] max-h-[95vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        {hasGps ? (
          <a
            href={`https://www.google.com/maps?q=${registro.latitude},${registro.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-square relative"
            title="Abrir no Google Maps"
          >
            <iframe
              // t=k → camada de satélite. z=18 dá detalhe suficiente sem
              // sair do contexto.
              src={`https://www.google.com/maps?q=${registro.latitude},${registro.longitude}&z=18&t=k&output=embed`}
              className="w-full h-full pointer-events-none"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Local ${tipoLabel}`}
            />
            <span className="absolute inset-0" aria-hidden />
          </a>
        ) : (
          <div className="aspect-square flex items-center justify-center text-[10px] text-[var(--color-fg-subtle)]">
            sem GPS
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Editar hora de uma batida ───────────────────────────────────────── */
function EditarBatidaModal({
  registro,
  onClose,
  onSaved,
}: {
  registro: RegistroPonto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (registro) {
      const d = new Date(registro.hora);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setHora(`${hh}:${mm}`);
      setErro(null);
    }
  }, [registro]);

  if (!registro) return null;

  return (
    <Modal
      open={registro !== null}
      onClose={onClose}
      title={`Alterar hora — ${TIPO_BATIDA_LABEL[registro.tipoBatida]}`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!hora) return;
          setSaving(true);
          setErro(null);
          try {
            const novaIso = new Date(`${registro.data}T${hora}:00`).toISOString();
            await atualizarHoraBatida(registro.id, novaIso);
            onSaved();
          } catch (err) {
            setErro(err instanceof Error ? err.message : String(err));
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-4"
      >
        <Input
          label="Nova hora"
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          required
        />
        <p className="text-xs text-[var(--color-fg-subtle)]">
          Hora atual:{" "}
          {new Date(registro.hora).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          . A foto e o GPS originais são preservados.
        </p>
        {erro && (
          <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)] text-[var(--color-danger)] text-sm px-3 py-2">
            {erro}
          </div>
        )}
        <div className="flex justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
          {/* UX1 — Excluir a batida toda (não só editar hora) */}
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              if (!confirm(`Excluir definitivamente a batida "${TIPO_BATIDA_LABEL[registro.tipoBatida]}" de ${fmtHora(registro.hora)}? Esta ação não pode ser desfeita.`)) return;
              setSaving(true);
              setErro(null);
              try {
                await excluirBatida(registro.id);
                onSaved();
              } catch (err) {
                setErro(err instanceof Error ? err.message : String(err));
              } finally {
                setSaving(false);
              }
            }}
            className="!text-[var(--color-danger)] hover:!bg-[var(--color-danger-soft)]"
          >
            Excluir batida
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Wrapper p/ editar serviço de um único funcionário ──────────────── */
function EditarServicoFuncWrapper({
  funcionarioId,
  nome,
  data,
  iniciais,
  obraId,
  horasDoFunc,
  onClose,
  onSaved,
}: {
  funcionarioId: string;
  nome: string;
  data: string;
  iniciais: ApontamentoServico[];
  obraId: string;
  horasDoFunc: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Lista de serviços (itens de contrato) — obraId pra filtrar; se vazio,
  // pega todos do banco (limite 1000).
  const { data: servicos = [] } = useQuery({
    queryKey: ["apont", "servicos", obraId || "all"],
    queryFn: () => (obraId ? listServicosDaObra(obraId) : listTodosServicos()),
  });

  return (
    <LancamentoServicoModal
      open={true}
      funcionarioIds={[funcionarioId]}
      funcNome={{ [funcionarioId]: nome }}
      servicos={servicos as Servico[]}
      iniciais={iniciais}
      data={data}
      horasPorFunc={{ [funcionarioId]: horasDoFunc }}
      onClose={onClose}
      onSaved={onSaved}
    />
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

/* ─── UX1 — Criar batida faltante na Aprovação ───────────────────────── */
function CriarBatidaModal({
  info,
  onClose,
  onSaved,
}: {
  info: {
    funcionarioId: string;
    funcionarioNome: string;
    data: string;
    tipoBatida: 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [hora, setHora] = useState(() => {
    // Sugestão de hora padrão por tipo
    const padroes: Record<typeof info.tipoBatida, string> = {
      entrada: '06:00',
      saida_almoco: '12:00',
      retorno_almoco: '13:00',
      saida_final: '17:00',
    };
    return padroes[info.tipoBatida];
  });
  const [motivo, setMotivo] = useState('Lançamento retroativo pela aprovação');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adicionar ${TIPO_BATIDA_LABEL[info.tipoBatida]} — ${info.funcionarioNome}`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!hora || !motivo.trim()) return;
          setSaving(true);
          setErro(null);
          try {
            const horaIso = new Date(`${info.data}T${hora}:00`).toISOString();
            await registrarBatida({
              funcionarioId: info.funcionarioId,
              data: info.data,
              tipoBatida: info.tipoBatida,
              hora: horaIso,
              latitude: null,
              longitude: null,
              origem: 'manual',
              motivoManual: motivo.trim(),
              statusAprovacao: 'aprovado', // já criado dentro da Aprovação = aprovado
            });
            onSaved();
          } catch (err) {
            setErro(err instanceof Error ? err.message : String(err));
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-4"
      >
        <Input
          label="Hora"
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          required
        />
        <Input
          label="Justificativa"
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
        />
        <p className="text-xs text-[var(--color-fg-subtle)]">
          Batida criada com origem <b>manual</b>. Já entra como <b>aprovada</b> (você está
          criando a partir da Aprovação).
        </p>
        {erro && (
          <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)] text-[var(--color-danger)] text-sm px-3 py-2">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Adicionando…' : 'Adicionar batida'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
