// Marco 2 / PR13 — Dashboard de Manutenção.
//
// Página com KPIs agregados, tops, curva de custo e alertas de óleos. Read-only.
// Task 3.3: removidos widgets de preventivas/planos; adicionado OleosVencendoPanel.
// Task 3.3 (complement): widgets de custo por máquina e por tipo de serviço.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, AlertTriangle, Clock, Wrench, TrendingUp,
  Activity, BarChart3, DollarSign, Package, HardHat, FileDown, Layers,
} from 'lucide-react';
import Button from '../ui/Button';
import { exportarRelatorioMensalPdf, exportarRelatorioAnualPdf } from '../../utils/manutencaoPdfExport';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useDashboardManutencao } from '../../hooks/useDashboardManutencao';
import { useSaldoEstoqueTotal } from '../../hooks/useSaldoEstoque';
import { useCustoPecasEquipamento } from '../../hooks/useCustoPecasEquipamento';
import { useChecklistsNaoConformidades } from '../../hooks/useChecklistNaoConformidades';
import OleosVencendoPanel from './OleosVencendoPanel';
import { TIPO_OS_LABEL } from '../../types';
import type { TipoOS } from '../../types';

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtMes(s: string): string {
  // '2026-05' → 'mai/26'
  const [a, m] = s.split('-');
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${meses[parseInt(m, 10) - 1]}/${a.slice(2)}`;
}

const CORES_TIPOS = [
  '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ec4899',
  '#84cc16', '#06b6d4', '#a855f7', '#ef4444', '#3b82f6', '#eab308',
];

export default function DashboardManutencao() {
  const navigate = useNavigate();
  const { data: equipamentos = [] } = useEquipamentos();
  const { data: dash, isLoading } = useDashboardManutencao(equipamentos);
  const { data: saldosEstoque = [] } = useSaldoEstoqueTotal({ apenasManutencao: true });
  const { data: topPorPecas = [] } = useCustoPecasEquipamento(10);
  const { data: naoConformidades = [] } = useChecklistsNaoConformidades();

  const checklistsMetricas = useMemo(() => {
    let bloqueados = 0;
    let comPendencias = 0;
    let totalCriticos = 0;
    for (const nc of naoConformidades) {
      if (nc.status === 'bloqueado') bloqueados++;
      else if (nc.status === 'concluido_com_pendencias') comPendencias++;
      totalCriticos += nc.itensCriticos;
    }
    return { total: naoConformidades.length, bloqueados, comPendencias, totalCriticos };
  }, [naoConformidades]);

  const pecasMetricas = useMemo(() => {
    let zeradas = 0, abaixoMin = 0;
    for (const s of saldosEstoque) {
      if (s.statusEstoque === 'zerada') zeradas++;
      else if (s.statusEstoque === 'abaixo_minimo') abaixoMin++;
    }
    return { criticas: zeradas + abaixoMin, zeradas, abaixoMin, total: saldosEstoque.length };
  }, [saldosEstoque]);

  // ── Custo por máquina (concluídas no ano, top 8) ─────────────────
  const custoPorMaquina = useMemo(() => {
    if (!dash) return [];
    const anoAtual = new Date().getFullYear();
    const concluidas = dash.ordens.filter(
      (o) => o.status === 'concluida' && o.dataConclusao &&
        new Date(o.dataConclusao).getFullYear() === anoAtual,
    );
    const map = new Map<string, { total: number; numOS: number }>();
    for (const o of concluidas) {
      const v = map.get(o.equipamentoId) ?? { total: 0, numOS: 0 };
      v.total += o.custoTotal;
      v.numOS += 1;
      map.set(o.equipamentoId, v);
    }
    const equipMap = new Map(equipamentos.map((e) => [e.id, e]));
    return Array.from(map.entries())
      .map(([eqId, v]) => {
        const eq = equipMap.get(eqId);
        return {
          equipamentoId: eqId,
          equipamentoNome: eq
            ? eq.codigoPatrimonio ? `${eq.codigoPatrimonio} · ${eq.nome}` : eq.nome
            : eqId,
          custoTotal: v.total,
          numOS: v.numOS,
        };
      })
      .filter((it) => it.custoTotal > 0)
      .sort((a, b) => b.custoTotal - a.custoTotal)
      .slice(0, 8);
  }, [dash, equipamentos]);

  // ── Custo por tipo de serviço (concluídas no ano) ─────────────────
  const custoPorTipo = useMemo(() => {
    if (!dash) return [];
    const anoAtual = new Date().getFullYear();
    const concluidas = dash.ordens.filter(
      (o) => o.status === 'concluida' && o.dataConclusao &&
        new Date(o.dataConclusao).getFullYear() === anoAtual,
    );
    const map = new Map<TipoOS, { total: number; numOS: number }>();
    for (const o of concluidas) {
      const v = map.get(o.tipo) ?? { total: 0, numOS: 0 };
      v.total += o.custoTotal;
      v.numOS += 1;
      map.set(o.tipo, v);
    }
    return Array.from(map.entries())
      .map(([tipo, v]) => ({
        tipo,
        label: TIPO_OS_LABEL[tipo] ?? tipo,
        custoTotal: v.total,
        numOS: v.numOS,
      }))
      .filter((it) => it.custoTotal > 0)
      .sort((a, b) => b.custoTotal - a.custoTotal);
  }, [dash]);

  // Seletores de export (mês e ano)
  const hoje = new Date();
  const mesDefault = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const [mesExport, setMesExport] = useState(mesDefault);
  const [anoExport, setAnoExport] = useState(hoje.getFullYear());
  const [exportando, setExportando] = useState<'idle' | 'mensal' | 'anual'>('idle');

  if (isLoading || !dash) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-fg-muted)]">Carregando dashboard…</p>
      </div>
    );
  }

  const { kpis, topPorCusto, topPorIndisponibilidade, custoMensalPorTipo } = dash;
  const semDados = kpis.osAbertas + kpis.osAbertas === 0
    && custoMensalPorTipo.every((m) => Object.keys(m).filter((k) => k !== 'mes').every((k) => Number(m[k]) === 0));

  // Tipos com dado pra renderizar linhas do gráfico
  const tiposGrafico = Array.from(new Set(
    custoMensalPorTipo.flatMap((row) =>
      Object.keys(row).filter((k) => k !== 'mes' && Number(row[k]) > 0)
    )
  ));

  async function handleExportarMensal() {
    if (exportando !== 'idle' || !dash) return;
    setExportando('mensal');
    try {
      exportarRelatorioMensalPdf({
        mes: mesExport,
        ordens: dash.ordens,
        equipamentos,
        proximasPreventivas: [],
        naoConformidades,
      });
    } finally {
      setExportando('idle');
    }
  }

  async function handleExportarAnual() {
    if (exportando !== 'idle' || !dash) return;
    setExportando('anual');
    try {
      // Para comparação, filtra ordens do ano anterior dentro do mesmo dataset
      const ordensAnoAnterior = dash.ordens.filter((o) => {
        if (!o.dataConclusao) return false;
        return new Date(o.dataConclusao).getFullYear() === anoExport - 1;
      });
      exportarRelatorioAnualPdf({
        ano: anoExport,
        ordens: dash.ordens,
        equipamentos,
        ordensAnoAnterior,
      });
    } finally {
      setExportando('idle');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-fg)] tracking-tight">
            Dashboard de Manutenção
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
            Visão consolidada de OS, custos, disponibilidade e alertas de óleo da frota.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5">
            <input
              type="month"
              value={mesExport}
              onChange={(e) => setMesExport(e.target.value)}
              className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)]"
            />
            <Button onClick={handleExportarMensal} disabled={exportando !== 'idle'} variant="secondary">
              <FileDown className="w-4 h-4" />
              {exportando === 'mensal' ? 'Gerando…' : 'Mensal'}
            </Button>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <input
              type="number"
              min="2020"
              max="2099"
              value={anoExport}
              onChange={(e) => setAnoExport(parseInt(e.target.value, 10) || hoje.getFullYear())}
              className="h-[36px] w-[88px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)]"
            />
            <Button onClick={handleExportarAnual} disabled={exportando !== 'idle'}>
              <FileDown className="w-4 h-4" />
              {exportando === 'anual' ? 'Gerando…' : 'Anual'}
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KPI
          label="OS abertas"
          valor={kpis.osAbertas}
          icon={ClipboardList}
          cor="bg-[var(--color-info-soft)] text-[var(--color-info-fg)]"
          onClick={() => navigate('/manutencao/os?status=')}
        />
        <KPI
          label="Críticas"
          valor={kpis.osCriticas}
          icon={AlertTriangle}
          cor="bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]"
          onClick={() => navigate('/manutencao/os?prio=critica')}
        />
        <KPI
          label="Atrasadas"
          valor={kpis.osAtrasadas}
          icon={Clock}
          cor="bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]"
        />
        <KPI
          label="MTTR"
          valor={kpis.mttrHoras != null ? `${kpis.mttrHoras.toFixed(1)} h` : '—'}
          legenda="médio (concluídas)"
          icon={Activity}
          cor="bg-[var(--color-surface-2)] text-[var(--color-fg)]"
        />
        <KPI
          label="Custo do mês"
          valor={fmtBRL(kpis.custoMes)}
          legenda={`${kpis.osConcluidasMes} concluída(s)`}
          icon={DollarSign}
          cor="bg-[var(--color-surface-2)] text-[var(--color-fg)]"
        />
        <KPI
          label="Custo do ano"
          valor={fmtBRL(kpis.custoAno)}
          icon={TrendingUp}
          cor="bg-[var(--color-surface-2)] text-[var(--color-fg)]"
        />
        <KPI
          label="% corretivo"
          valor={kpis.custoAno > 0 ? `${kpis.percCorretivoAno.toFixed(0)}%` : '—'}
          legenda="do custo anual"
          icon={Wrench}
          cor={kpis.percCorretivoAno > 50
            ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]'
            : kpis.percCorretivoAno > 30
              ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]'
              : 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]'}
        />
        <KPI
          label="Não-conformidades"
          valor={checklistsMetricas.total}
          legenda={checklistsMetricas.bloqueados > 0
            ? `${checklistsMetricas.bloqueados} bloqueado(s) · ${checklistsMetricas.totalCriticos} crítico(s)`
            : checklistsMetricas.comPendencias > 0 ? `${checklistsMetricas.comPendencias} com pendências`
            : 'todos os checklists OK'}
          icon={HardHat}
          cor={checklistsMetricas.bloqueados > 0
            ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]'
            : checklistsMetricas.total > 0
              ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]'
              : 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]'}
          onClick={() => navigate('/manutencao/checklists?aba=nao_conformidades')}
        />
        <KPI
          label="Peças críticas"
          valor={pecasMetricas.criticas}
          legenda={pecasMetricas.total > 0
            ? `${pecasMetricas.zeradas} zeradas · ${pecasMetricas.abaixoMin} abaixo do mínimo`
            : 'cadastre peças no almoxarifado'}
          icon={Package}
          cor={pecasMetricas.criticas > 0
            ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]'
            : 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]'}
          onClick={() => navigate('/manutencao/almoxarifado?status=criticos')}
        />
      </section>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
          <BarChart3 aria-hidden className="w-10 h-10 text-[var(--color-fg-subtle)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--color-fg)]">Sem dados consolidados ainda</p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            Conforme OS forem concluídas, os indicadores começam a popular esta tela.
          </p>
        </div>
      ) : (
        <>
          {/* Curva de custo por tipo (12m) */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">
              Custo de manutenção por tipo · últimos 12 meses
            </h3>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={custoMensalPorTipo} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tickFormatter={fmtMes} stroke="var(--color-fg-muted)" fontSize={11} />
                  <YAxis tickFormatter={(v) => fmtBRL(v as number)} stroke="var(--color-fg-muted)" fontSize={11} />
                  <Tooltip
                    formatter={((value: number | string | undefined) => fmtBRL(Number(value ?? 0))) as never}
                    labelFormatter={((label: unknown) => fmtMes(String(label ?? ''))) as never}
                    contentStyle={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {tiposGrafico.map((tipo, i) => (
                    <Line
                      key={tipo}
                      type="monotone"
                      dataKey={tipo}
                      stroke={CORES_TIPOS[i % CORES_TIPOS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Top equipamentos */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TopList
              titulo="Top 10 por custo · ano"
              icon={DollarSign}
              items={topPorCusto}
              valor={(it) => fmtBRL(it.custoTotal)}
              legenda={(it) => `${it.numOS} OS · ${it.tipo}`}
            />
            <TopList
              titulo="Top 10 por indisponibilidade"
              icon={Clock}
              items={topPorIndisponibilidade}
              valor={(it) => `${it.horasParado.toFixed(1)} h`}
              legenda={(it) => `${it.numOS} parada(s) · ${it.tipo}`}
              vazio="Nenhum equipamento com parada registrada."
            />
          </section>

          {/* Top por gasto em peças (rolling 12m) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TopList
              titulo="Top 10 por gasto em peças · 12 meses"
              icon={Package}
              items={topPorPecas
                .filter((p) => p.custoTotal12m > 0)
                .map((p) => ({
                  equipamentoId: p.equipamentoId,
                  equipamentoNome: p.codigoPatrimonio
                    ? `${p.codigoPatrimonio} · ${p.equipamentoNome}`
                    : p.equipamentoNome,
                  tipo: p.equipamentoTipo,
                  custoTotal12m: p.custoTotal12m,
                  numOs: p.numOs,
                  numPecas: p.numPecas,
                }))}
              valor={(it) => fmtBRL(it.custoTotal12m)}
              legenda={(it) => `${it.numOs} OS · ${it.numPecas} peças · ${it.tipo}`}
              vazio="Nenhum consumo de peças registrado nos últimos 12 meses."
            />
          </section>

          {/* Custo por máquina e por tipo de serviço (ano corrente) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Custo por máquina */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2 flex items-center gap-1.5">
                <DollarSign aria-hidden className="w-3.5 h-3.5" />
                Custo por máquina · ano
              </h3>
              {custoPorMaquina.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center text-sm text-[var(--color-fg-muted)]">
                  Nenhum serviço concluído com custo registrado este ano.
                </div>
              ) : (
                <ul className="space-y-1">
                  {custoPorMaquina.map((it, i) => (
                    <li
                      key={it.equipamentoId}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-mono text-[var(--color-fg-subtle)] w-5 text-right">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--color-fg)] truncate">{it.equipamentoNome}</p>
                          <p className="text-xs text-[var(--color-fg-muted)] truncate">{it.numOS} OS</p>
                        </div>
                      </div>
                      <strong className="text-sm font-mono shrink-0">{fmtBRL(it.custoTotal)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Custo por tipo de serviço */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2 flex items-center gap-1.5">
                <Layers aria-hidden className="w-3.5 h-3.5" />
                Custo por tipo de serviço · ano
              </h3>
              {custoPorTipo.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center text-sm text-[var(--color-fg-muted)]">
                  Nenhum serviço concluído com custo registrado este ano.
                </div>
              ) : (
                <ul className="space-y-1">
                  {custoPorTipo.map((it, i) => (
                    <li
                      key={it.tipo}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-mono text-[var(--color-fg-subtle)] w-5 text-right">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--color-fg)] truncate">{it.label}</p>
                          <p className="text-xs text-[var(--color-fg-muted)] truncate">{it.numOS} OS</p>
                        </div>
                      </div>
                      <strong className="text-sm font-mono shrink-0">{fmtBRL(it.custoTotal)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Alertas de óleos vencendo */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <OleosVencendoPanel compacto />
          </section>
        </>
      )}
    </div>
  );
}

function KPI({
  label, valor, legenda, icon: Icon, cor, onClick,
}: {
  label: string;
  valor: string | number;
  legenda?: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  cor: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex items-center gap-3 ' +
        (onClick ? 'hover:bg-[var(--color-surface-2)] transition-colors text-left' : '')
      }
    >
      <div className={'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ' + cor}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
          {label}
        </div>
        <div className="text-lg font-semibold text-[var(--color-fg)] truncate">
          {valor}
        </div>
        {legenda && (
          <div className="text-[11px] text-[var(--color-fg-subtle)] truncate">{legenda}</div>
        )}
      </div>
    </Tag>
  );
}

function TopList<T extends { equipamentoId: string; equipamentoNome: string }>({
  titulo, icon: Icon, items, valor, legenda, vazio,
}: {
  titulo: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  items: T[];
  valor: (it: T) => string;
  legenda: (it: T) => string;
  vazio?: string;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2 flex items-center gap-1.5">
        <Icon aria-hidden className="w-3.5 h-3.5" />
        {titulo}
      </h3>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center text-sm text-[var(--color-fg-muted)]">
          {vazio ?? 'Sem dados.'}
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li
              key={it.equipamentoId}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-mono text-[var(--color-fg-subtle)] w-5 text-right">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-fg)] truncate">{it.equipamentoNome}</p>
                  <p className="text-xs text-[var(--color-fg-muted)] truncate">{legenda(it)}</p>
                </div>
              </div>
              <strong className="text-sm font-mono shrink-0">{valor(it)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
