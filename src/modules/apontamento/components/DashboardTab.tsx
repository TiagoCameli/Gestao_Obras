import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { listRegistrosPontoRange } from "../utils/pontoApi";
import {
  listApontamentosServicoRange,
  listTodosServicos,
  type Servico,
} from "../utils/apontamentoServicoApi";
import { useFuncionarios, useObrasApont, useEquipesApont } from "../hooks/useApontamentoData";
import SmartSelect from "../../../components/ui/SmartSelect";
import DataTable from "../../../components/ui/DataTable";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import {
  agregarHorasPorFuncionario,
  type LinhaFunc,
} from "../utils/dashboardHorasFuncionario";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function formatHoras(n: number): string {
  return n.toFixed(1).replace(".", ",");
}
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type Range = "7d" | "30d" | "mtd";

const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mtd", label: "Mês atual" },
];

function rangeBounds(r: Range): { dataInicio: string; dataFim: string } {
  const fim = todayIso();
  if (r === "7d") return { dataInicio: isoDaysAgo(6), dataFim: fim };
  if (r === "30d") return { dataInicio: isoDaysAgo(29), dataFim: fim };
  // mtd: primeiro dia do mês até hoje
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  return { dataInicio: first, dataFim: fim };
}

export default function DashboardTab() {
  const [range, setRange] = useState<Range>("7d");
  const [obraId, setObraId] = useState<string>("");
  const [equipeId, setEquipeId] = useState<string>("");

  const { dataInicio, dataFim } = rangeBounds(range);

  const { data: obras = [] } = useObrasApont();
  const { data: equipes = [] } = useEquipesApont(undefined);
  const { data: funcionarios = [] } = useFuncionarios();
  const { data: servicos = [] } = useQuery({
    queryKey: ["apont", "servicos-todos"],
    queryFn: listTodosServicos,
    staleTime: 60_000,
  });

  const filtros = { dataInicio, dataFim, obraId: obraId || undefined, equipeId: equipeId || undefined };

  // B2.2 — Auto-refresh do dashboard a cada 60s + tracking de última atualização
  const { data: registros = [], isLoading: loadingPonto, dataUpdatedAt: pontoAt, refetch: refetchPonto } = useQuery({
    queryKey: ["apont", "dash", "ponto", filtros],
    queryFn: () => listRegistrosPontoRange(filtros),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const { data: apontamentos = [], isLoading: loadingServ, dataUpdatedAt: servAt, refetch: refetchServ } = useQuery({
    queryKey: ["apont", "dash", "servico", filtros],
    queryFn: () => listApontamentosServicoRange(filtros),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  // Última atualização (qualquer das duas queries)
  const ultimaAtt = Math.max(pontoAt ?? 0, servAt ?? 0);
  const handleRefresh = () => {
    refetchPonto();
    refetchServ();
  };

  const isLoading = loadingPonto || loadingServ;

  // Look-ups
  const funcsById = useMemo(
    () => new Map(funcionarios.map((f) => [f.id, f])),
    [funcionarios]
  );
  const servicosById = useMemo(
    () => new Map((servicos as Servico[]).map((s) => [s.id, s])),
    [servicos]
  );
  const obrasById = useMemo(
    () => new Map(obras.map((o) => [o.id, o])),
    [obras]
  );

  // ─── KPIs ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const hoje = todayIso();
    const batidasHoje = registros.filter((r) => r.data === hoje).length;
    const presentesHoje = new Set(
      registros
        .filter((r) => r.data === hoje && r.tipoBatida === "entrada" && r.statusAprovacao !== "rejeitado")
        .map((r) => r.funcionarioId)
    ).size;
    const totalHoras = apontamentos.reduce((acc, a) => acc + (a.horas || 0), 0);
    const horasProd = apontamentos
      .filter((a) => a.tipo === "produtivo")
      .reduce((acc, a) => acc + (a.horas || 0), 0);
    const horasImprod = totalHoras - horasProd;
    const pendentes = registros.filter((r) => r.statusAprovacao === "pendente_aprovacao").length;
    const totalBatidas = registros.length;
    return { batidasHoje, presentesHoje, totalHoras, horasProd, horasImprod, pendentes, totalBatidas };
  }, [registros, apontamentos]);

  // ─── Série diária ───────────────────────────────────────────────────
  const seriePorDia = useMemo(() => {
    // monta um array de dias entre dataInicio e dataFim (inclusivo)
    const days: string[] = [];
    const start = new Date(dataInicio + "T00:00:00");
    const end = new Date(dataFim + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }
    const map = new Map<string, { batidas: number; horas: number }>();
    for (const d of days) map.set(d, { batidas: 0, horas: 0 });
    for (const r of registros) {
      const e = map.get(r.data);
      if (e) e.batidas++;
    }
    for (const a of apontamentos) {
      const e = map.get(a.data);
      if (e) e.horas += a.horas || 0;
    }
    return days.map((d) => ({
      dia: d.slice(8, 10) + "/" + d.slice(5, 7),
      data: d,
      batidas: map.get(d)?.batidas ?? 0,
      horas: +(map.get(d)?.horas ?? 0).toFixed(2),
    }));
  }, [registros, apontamentos, dataInicio, dataFim]);

  // ─── Top funcionários por horas ─────────────────────────────────────
  const topFuncionarios = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of apontamentos) {
      m.set(a.funcionarioId, (m.get(a.funcionarioId) ?? 0) + (a.horas || 0));
    }
    return Array.from(m.entries())
      .map(([fid, horas]) => ({
        nome: funcsById.get(fid)?.nome ?? "—",
        horas: +horas.toFixed(1),
      }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 10);
  }, [apontamentos, funcsById]);

  // ─── Distribuição produtivo vs improdutivo ──────────────────────────
  const distribProdutivo = useMemo(() => {
    return [
      { name: "Produtivo", value: +kpis.horasProd.toFixed(2) },
      { name: "Improdutivo", value: +kpis.horasImprod.toFixed(2) },
    ];
  }, [kpis]);

  // ─── Improdutivos por motivo ────────────────────────────────────────
  const improdPorMotivo = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of apontamentos) {
      if (a.tipo !== "improdutivo") continue;
      const motivo = a.motivoImprodutivo ?? "Sem motivo";
      m.set(motivo, (m.get(motivo) ?? 0) + (a.horas || 0));
    }
    return Array.from(m.entries())
      .map(([motivo, horas]) => ({ motivo, horas: +horas.toFixed(1) }))
      .sort((a, b) => b.horas - a.horas);
  }, [apontamentos]);

  // ─── Top serviços (produtivos) ──────────────────────────────────────
  const topServicos = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of apontamentos) {
      if (a.tipo !== "produtivo" || !a.servicoId) continue;
      m.set(a.servicoId, (m.get(a.servicoId) ?? 0) + (a.horas || 0));
    }
    return Array.from(m.entries())
      .map(([sid, horas]) => ({
        nome: servicosById.get(sid)?.nome ?? "—",
        horas: +horas.toFixed(1),
      }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 8);
  }, [apontamentos, servicosById]);

  // ─── Horas por funcionário (tabela detalhada) ───────────────────────
  const horasPorFuncionario = useMemo(
    () => agregarHorasPorFuncionario(apontamentos, funcsById, servicosById, obrasById),
    [apontamentos, funcsById, servicosById, obrasById]
  );

  const horasColumns: ColumnDef<LinhaFunc>[] = [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={row.getIsExpanded() ? "Recolher detalhes" : "Expandir detalhes"}
          aria-expanded={row.getIsExpanded()}
          onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
          className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <ChevronRight
            aria-hidden
            className={
              "w-4 h-4 text-[var(--color-fg-muted)] transition-transform " +
              (row.getIsExpanded() ? "rotate-90" : "")
            }
          />
        </button>
      ),
      size: 32,
      enableSorting: false,
    },
    {
      accessorKey: "funcionarioNome",
      header: "Funcionário",
      cell: ({ getValue }) => (
        <span className="font-medium text-[var(--color-fg)]">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "horasProd",
      header: () => <span className="block text-right">Horas</span>,
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{formatHoras(getValue() as number)}</span>
      ),
    },
    {
      accessorKey: "obrasCount",
      header: () => <span className="block text-right">Obras</span>,
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: "servicosCount",
      header: () => <span className="block text-right">Serviços</span>,
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{getValue() as number}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Período">
          <SmartSelect
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className={inputCls + ' text-left flex items-center'}
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </SmartSelect>
        </Field>
        <Field label="Obra">
          <SmartSelect
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            className={inputCls + ' text-left flex items-center'}
          >
            <option value="">Todas</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </SmartSelect>
        </Field>
        <Field label="Equipe">
          <SmartSelect
            value={equipeId}
            onChange={(e) => setEquipeId(e.target.value)}
            className={inputCls + ' text-left flex items-center'}
          >
            <option value="">Todas</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </SmartSelect>
        </Field>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-[var(--color-fg-subtle)]">
            {dataInicio} a {dataFim}
          </span>
          {/* B2.2 — Botão refresh + última atualização */}
          {ultimaAtt > 0 && (
            <span className="text-[10px] text-[var(--color-fg-subtle)] tabular-nums">
              ⟳ {new Date(ultimaAtt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Atualizar agora"
            title="Atualizar agora (auto-refresh a cada 60s)"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors"
          >
            <svg className={"w-3.5 h-3.5 " + (isLoading ? "animate-spin" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3" />
              <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3" />
              <polyline points="21 3 21 9 15 9" />
              <polyline points="3 21 3 15 9 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* KPIs — drill-down: clique abre a aba relacionada */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Batidas hoje" value={kpis.batidasHoje} hint="registros do dia" to="/apontamento?tab=ponto" />
        <Kpi label="Presentes hoje" value={kpis.presentesHoje} hint="entradas registradas" tone="success" to="/apontamento?tab=ponto" />
        <Kpi label="Pendentes" value={kpis.pendentes} hint="aguardando aprovação" tone={kpis.pendentes > 0 ? "warning" : "neutral"} to="/apontamento?tab=aprovacao" />
        <Kpi label="Total batidas" value={kpis.totalBatidas} hint="no período" to="/apontamento?tab=historico" />
        <Kpi label="Horas apontadas" value={kpis.totalHoras.toFixed(1)} hint="produtivas + improdutivas" to="/apontamento?tab=servico" />
        <Kpi
          label="% produtivo"
          value={kpis.totalHoras > 0 ? `${((kpis.horasProd / kpis.totalHoras) * 100).toFixed(0)}%` : "—"}
          hint={`${kpis.horasProd.toFixed(1)} h produtivas`}
          tone="success"
          to="/apontamento?tab=servico"
        />
      </div>

      {isLoading && (
        <div className="text-sm text-[var(--color-fg-subtle)]">Carregando dados do período…</div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Atividade diária" subtitle="Batidas registradas e horas apontadas por dia">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={seriePorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="dia" stroke="var(--color-fg-subtle)" fontSize={11} />
              <YAxis stroke="var(--color-fg-subtle)" fontSize={11} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--color-surface-2)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="batidas" name="Batidas" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="horas" name="Horas apontadas" fill="var(--color-info)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Produtivo × Improdutivo" subtitle="Distribuição de horas no período">
          {kpis.totalHoras === 0 ? (
            <EmptyChart>Sem horas apontadas no período.</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={distribProdutivo} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  <Cell fill="var(--color-accent)" />
                  <Cell fill="var(--color-warning)" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v ?? 0)} h`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top funcionários por horas" subtitle="10 com mais horas apontadas">
          {topFuncionarios.length === 0 ? (
            <EmptyChart>Sem apontamentos no período.</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, topFuncionarios.length * 26 + 40)}>
              <BarChart data={topFuncionarios} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" stroke="var(--color-fg-subtle)" fontSize={11} />
                <YAxis type="category" dataKey="nome" stroke="var(--color-fg-subtle)" fontSize={11} width={140} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v ?? 0)} h`} />
                <Bar dataKey="horas" name="Horas" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Improdutivos por motivo" subtitle="Horas perdidas por motivo">
          {improdPorMotivo.length === 0 ? (
            <EmptyChart>Sem horas improdutivas no período.</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, improdPorMotivo.length * 30 + 40)}>
              <BarChart data={improdPorMotivo} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" stroke="var(--color-fg-subtle)" fontSize={11} />
                <YAxis type="category" dataKey="motivo" stroke="var(--color-fg-subtle)" fontSize={11} width={150} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v ?? 0)} h`} />
                <Bar dataKey="horas" name="Horas" fill="var(--color-warning)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Top serviços" subtitle="Serviços com mais horas produtivas no período">
        {topServicos.length === 0 ? (
          <EmptyChart>Sem horas produtivas no período.</EmptyChart>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, topServicos.length * 30 + 40)}>
            <BarChart data={topServicos} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" stroke="var(--color-fg-subtle)" fontSize={11} />
              <YAxis type="category" dataKey="nome" stroke="var(--color-fg-subtle)" fontSize={11} width={200} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v ?? 0)} h`} />
              <Bar dataKey="horas" name="Horas" fill="var(--color-info)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ─── Tabela: Horas por funcionário (detalhado) ───────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-fg)]">
            Horas por funcionário (detalhado)
          </h2>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
            Clique no chevron pra ver obras e serviços.
          </p>
        </div>

        <DataTable<LinhaFunc>
          columns={horasColumns}
          data={horasPorFuncionario}
          isLoading={isLoading}
          defaultSorting={[{ id: "horasProd", desc: true }]}
          getRowId={(r) => r.funcionarioId}
          enableExpanding
          renderExpanded={(linha) => <HorasExpanded linha={linha} />}
          empty={{
            title: "Sem horas apontadas neste período",
            description: "Ajuste o intervalo no topo do dashboard ou aguarde novos apontamentos.",
          }}
          pageSize={25}
          persistPageSizeKey="apont-dash-horas-func-pagesize"
          renderFooter={(rows) => {
            const totalH = rows.reduce((acc, r) => acc + r.horasProd, 0);
            return (
              <span className="text-xs text-[var(--color-fg-muted)]">
                {rows.length} {rows.length === 1 ? "funcionário" : "funcionários"}
                {" · "}{formatHoras(totalH)} horas
              </span>
            );
          }}
        />
      </section>
    </div>
  );
}

function HorasExpanded({ linha }: { linha: LinhaFunc }) {
  return (
    <div className="px-4 py-3 bg-[var(--color-surface-2)]">
      <table className="w-full text-sm" role="region" aria-label={`Detalhes de ${linha.funcionarioNome}`}>
        <thead>
          <tr className="text-xs text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
            <th className="text-left py-2 font-medium">Obra</th>
            <th className="text-left py-2 font-medium">Serviço</th>
            <th className="text-right py-2 font-medium">Horas</th>
            <th className="text-right py-2 font-medium pr-2">%</th>
          </tr>
        </thead>
        <tbody>
          {linha.detalhes.map((d, i) => (
            <tr key={i} className="border-b border-[var(--color-border)]/40">
              <td className="py-1.5">{d.obraNome}</td>
              <td className="py-1.5">
                {d.servicoCodigo ? (
                  <>
                    <span className="font-mono text-xs text-[var(--color-fg-muted)] mr-2">
                      {d.servicoCodigo}
                    </span>
                    {d.servicoNome}
                  </>
                ) : (
                  d.servicoNome
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatHoras(d.horas)}</td>
              <td className="py-1.5 text-right tabular-nums pr-2">{d.percentual.toFixed(1)}%</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="pt-2" colSpan={2}>Total</td>
            <td className="pt-2 text-right tabular-nums">{formatHoras(linha.horasProd)}</td>
            <td className="pt-2 text-right tabular-nums pr-2">100,0%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const inputCls =
  "h-10 rounded-lg px-3 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] " +
  "border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] " +
  "focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50 min-w-[160px]";

const tooltipStyle: React.CSSProperties = {
  background: "var(--color-surface-1)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "var(--shadow-md)",
};

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

const TONE_CLS: Record<string, string> = {
  neutral: "text-[var(--color-fg)]",
  success: "text-[var(--color-success-fg)]",
  warning: "text-[var(--color-warning-fg)]",
  danger: "text-[var(--color-danger-fg)]",
};

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  to,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  /** Quando preenchido, o card vira link clicável (drill-down). */
  to?: string;
}) {
  const baseClass =
    "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 shadow-[var(--shadow-xs)]" +
    (to
      ? " block transition-all hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
      : "");
  const content = (
    <>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-semibold tracking-tight tabular-nums mt-1 ${TONE_CLS[tone]}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{hint}</p>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={baseClass} aria-label={`${label}: ${value}. Abrir detalhes.`}>
        {content}
      </Link>
    );
  }
  return <div className={baseClass}>{content}</div>;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--color-fg)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-sm text-[var(--color-fg-subtle)]">
      {children}
    </div>
  );
}

