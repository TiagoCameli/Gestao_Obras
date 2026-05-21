// Marco 2 / PR10 — Página principal de Manutenção.
//
// Por enquanto só lista de Ordens de Serviço em /manutencao/os
// (e /manutencao redireciona pra /manutencao/os).
// Marcos futuros: dashboard, agenda, planos, almoxarifado, relatórios.

import { useMemo, useState } from 'react';
import { useSearchParams, Navigate, useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, ClipboardList, AlertTriangle, Clock, Wrench, BarChart3, ClipboardCheck, CalendarClock, Package, HardHat } from 'lucide-react';
import { useOrdensServico } from '../hooks/useOrdensServico';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useAuth } from '../contexts/AuthContext';
import type { StatusOS, TipoOS, PrioridadeOS } from '../types';
import { STATUS_OS_LABEL, TIPO_OS_LABEL, PRIORIDADE_OS_LABEL } from '../types';
import Button from '../components/ui/Button';
import SmartSelect from '../components/ui/SmartSelect';
import OSCard from '../components/manutencao/os/OSCard';
import NovaOSModal from '../components/manutencao/os/NovaOSModal';
import OSDetalhe from '../components/manutencao/os/OSDetalhe';
import DashboardManutencao from '../components/manutencao/DashboardManutencao';
import PlanosPreventivosPage from '../components/manutencao/PlanosPreventivosPage';
import PlanoDetalhePage from '../components/manutencao/planos/PlanoDetalhePage';
import AgendaPreventivasPage from '../components/manutencao/AgendaPreventivasPage';
import AlmoxarifadoPage from '../components/manutencao/AlmoxarifadoPage';
import ChecklistsPage from '../components/manutencao/ChecklistsPage';

const STATUS_OPTS: { value: StatusOS | 'todas' | 'abertas'; label: string }[] = [
  { value: 'abertas', label: 'Abertas' },
  { value: 'todas', label: 'Todas' },
  ...(Object.keys(STATUS_OS_LABEL) as StatusOS[]).map((k) => ({
    value: k,
    label: STATUS_OS_LABEL[k],
  })),
];

const TIPO_OPTS: { value: TipoOS | ''; label: string }[] = [
  { value: '', label: 'Todos tipos' },
  ...(Object.keys(TIPO_OS_LABEL) as TipoOS[]).map((k) => ({ value: k, label: TIPO_OS_LABEL[k] })),
];

const PRIORIDADE_OPTS: { value: PrioridadeOS | ''; label: string }[] = [
  { value: '', label: 'Todas prioridades' },
  ...(Object.keys(PRIORIDADE_OS_LABEL) as PrioridadeOS[]).map((k) => ({
    value: k, label: PRIORIDADE_OS_LABEL[k],
  })),
];

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ManutencaoPage() {
  const { pathname } = useLocation();
  const params = useParams<{ numero?: string; id?: string }>();
  // /manutencao → redireciona pra /manutencao/dashboard
  if (pathname === '/manutencao') {
    return <Navigate to="/manutencao/dashboard" replace />;
  }
  // /manutencao/os/:numero → detalhe (sem sub-nav)
  if (params.numero) {
    return <OSDetalhe />;
  }
  // /manutencao/planos/:id → detalhe do plano (com sub-nav)
  let inner: React.ReactNode;
  if (pathname === '/manutencao/dashboard') inner = <DashboardManutencao />;
  else if (pathname === '/manutencao/agenda') inner = <AgendaPreventivasPage />;
  else if (pathname === '/manutencao/almoxarifado') inner = <AlmoxarifadoPage />;
  else if (pathname === '/manutencao/checklists') inner = <ChecklistsPage />;
  else if (params.id && pathname.startsWith('/manutencao/planos/')) inner = <PlanoDetalhePage />;
  else if (pathname === '/manutencao/planos') inner = <PlanosPreventivosPage />;
  else inner = <OrdensServicoPage />;

  return (
    <div className="space-y-4">
      <SubNav pathname={pathname} />
      {inner}
    </div>
  );
}

const SUB_NAV_ITEMS: { to: string; label: string; icon: typeof BarChart3; perm: string }[] = [
  { to: '/manutencao/dashboard',     label: 'Dashboard',           icon: BarChart3,      perm: 'aba_manutencao_dashboard' },
  { to: '/manutencao/os',            label: 'Ordens de Serviço',   icon: ClipboardList,  perm: 'aba_manutencao_os' },
  { to: '/manutencao/agenda',        label: 'Agenda preventiva',   icon: CalendarClock,  perm: 'aba_manutencao_agenda' },
  { to: '/manutencao/planos',        label: 'Planos preventivos',  icon: ClipboardCheck, perm: 'aba_manutencao_planos' },
  { to: '/manutencao/almoxarifado',  label: 'Almoxarifado',        icon: Package,        perm: 'aba_manutencao_almoxarifado' },
  { to: '/manutencao/checklists',    label: 'Checklists pré-uso',  icon: HardHat,        perm: 'aba_manutencao_checklists' },
];

function SubNav({ pathname }: { pathname: string }) {
  const { temAcao } = useAuth();
  return (
    <nav className="flex gap-1 border-b border-[var(--color-border)]">
      {SUB_NAV_ITEMS.filter((i) => temAcao(i.perm)).map((item) => {
        const ativo = pathname === item.to || pathname.startsWith(item.to + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={
              'px-3 py-2 -mb-px border-b-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5 ' +
              (ativo
                ? 'border-[var(--color-accent)] text-[var(--color-fg)]'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
            }
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function OrdensServicoPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroStatus = (searchParams.get('status') ?? 'abertas') as StatusOS | 'todas' | 'abertas';
  const filtroTipo = (searchParams.get('tipo') ?? '') as TipoOS | '';
  const filtroPrioridade = (searchParams.get('prio') ?? '') as PrioridadeOS | '';
  const filtroEquipamento = searchParams.get('equipamento') ?? '';
  const filtroBusca = searchParams.get('busca') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const { data: equipamentos = [] } = useEquipamentos();
  const { temAcao } = useAuth();
  const canCreate = temAcao('criar_os');

  const { data: ordens = [], isLoading } = useOrdensServico({
    abertas: filtroStatus === 'abertas',
    status: filtroStatus !== 'abertas' ? filtroStatus : undefined,
    tipo: filtroTipo || undefined,
    prioridade: filtroPrioridade || undefined,
    equipamentoId: filtroEquipamento || undefined,
  });

  const equipamentosPorId = useMemo(() => {
    const map = new Map<string, typeof equipamentos[number]>();
    for (const eq of equipamentos) map.set(eq.id, eq);
    return map;
  }, [equipamentos]);

  // Filtro de busca (client-side) por numero, defeito, ou equipamento
  const ordensFiltradas = useMemo(() => {
    if (!filtroBusca) return ordens;
    const q = filtroBusca.toLowerCase();
    return ordens.filter((os) => {
      const eq = equipamentosPorId.get(os.equipamentoId);
      const eqStr = eq ? `${eq.codigoPatrimonio} ${eq.nome}`.toLowerCase() : '';
      return os.numero.toLowerCase().includes(q)
        || os.defeitoReportado.toLowerCase().includes(q)
        || eqStr.includes(q);
    });
  }, [ordens, filtroBusca, equipamentosPorId]);

  // KPIs (calculados sobre ordens carregadas — depende dos filtros, exceto o de busca)
  const kpis = useMemo(() => {
    const abertas = ordens.filter((o) => !['concluida', 'cancelada'].includes(o.status));
    const criticas = abertas.filter((o) => o.prioridade === 'critica');
    const atrasadas = abertas.filter((o) => {
      if (!o.prazoAtendimento) return false;
      return new Date(o.prazoAtendimento) < new Date();
    });
    const custoMes = ordens
      .filter((o) => o.status === 'concluida' && o.dataConclusao
        && new Date(o.dataConclusao).getMonth() === new Date().getMonth()
        && new Date(o.dataConclusao).getFullYear() === new Date().getFullYear())
      .reduce((s, o) => s + o.custoTotal, 0);
    return { abertas: abertas.length, criticas: criticas.length, atrasadas: atrasadas.length, custoMes };
  }, [ordens]);

  const [novaOSOpen, setNovaOSOpen] = useState(false);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-fg)] tracking-tight">
            Ordens de Serviço
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
            Manutenção preventiva, corretiva, preditiva e melhorias da frota.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setNovaOSOpen(true)}>
            <Plus aria-hidden className="w-4 h-4" />
            Nova OS
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI
          label="OS abertas"
          valor={kpis.abertas}
          icon={ClipboardList}
          cor="bg-[var(--color-info-soft)] text-[var(--color-info-fg)]"
        />
        <KPI
          label="Críticas"
          valor={kpis.criticas}
          icon={AlertTriangle}
          cor="bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]"
        />
        <KPI
          label="Atrasadas"
          valor={kpis.atrasadas}
          icon={Clock}
          cor="bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]"
        />
        <KPI
          label="Custo do mês"
          valor={fmtBRL(kpis.custoMes)}
          icon={Wrench}
          cor="bg-[var(--color-surface-2)] text-[var(--color-fg)]"
        />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={filtroBusca}
          onChange={(e) => setParam('busca', e.target.value)}
          placeholder="Buscar por número, defeito ou equipamento…"
          className="flex-1 min-w-[200px] h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <SmartSelect
          value={filtroStatus}
          onChange={(e) => setParam('status', e.target.value === 'abertas' ? '' : e.target.value)}
          wrapperClassName="relative"
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] flex items-center min-w-[140px] text-left"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </SmartSelect>
        <SmartSelect
          value={filtroTipo}
          onChange={(e) => setParam('tipo', e.target.value)}
          wrapperClassName="relative"
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] flex items-center min-w-[140px] text-left"
        >
          {TIPO_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </SmartSelect>
        <SmartSelect
          value={filtroPrioridade}
          onChange={(e) => setParam('prio', e.target.value)}
          wrapperClassName="relative"
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] flex items-center min-w-[140px] text-left"
        >
          {PRIORIDADE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </SmartSelect>
        <SmartSelect
          value={filtroEquipamento}
          onChange={(e) => setParam('equipamento', e.target.value)}
          wrapperClassName="relative"
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] max-w-[280px] flex items-center min-w-[200px] text-left"
        >
          <option value="">Todos equipamentos</option>
          {equipamentos
            .filter((e) => e.ativo !== false && e.id !== 'desconhecido')
            .map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.codigoPatrimonio ? `${eq.codigoPatrimonio} — ${eq.nome}` : eq.nome}
              </option>
            ))}
        </SmartSelect>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando OS…</p>
      ) : ordensFiltradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
          <ClipboardList aria-hidden className="w-8 h-8 text-[var(--color-fg-subtle)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-fg)]">Nenhuma OS encontrada</p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1 mb-4">
            {ordens.length === 0
              ? 'Comece criando a primeira ordem de serviço.'
              : 'Ajuste os filtros ou limpe a busca.'}
          </p>
          {ordens.length === 0 && (
            <Button onClick={() => setNovaOSOpen(true)} className="mx-auto">
              <Plus className="w-4 h-4" /> Nova OS
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-fg-muted)]">
            {ordensFiltradas.length} {ordensFiltradas.length === 1 ? 'OS' : 'OSs'}
          </p>
          {ordensFiltradas.map((os) => (
            <OSCard
              key={os.id}
              os={os}
              equipamento={equipamentosPorId.get(os.equipamentoId)}
              onClick={() => navigate(`/manutencao/os/${os.numero}`)}
            />
          ))}
        </div>
      )}

      {novaOSOpen && (
        <NovaOSModal
          open={novaOSOpen}
          onClose={() => setNovaOSOpen(false)}
          equipamentos={equipamentos}
        />
      )}
    </div>
  );
}

function KPI({
  label, valor, icon: Icon, cor,
}: {
  label: string;
  valor: string | number;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  cor: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex items-center gap-3">
      <div className={'w-10 h-10 rounded-lg flex items-center justify-center ' + cor}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
          {label}
        </div>
        <div className="text-lg font-semibold text-[var(--color-fg)] truncate">
          {valor}
        </div>
      </div>
    </div>
  );
}
