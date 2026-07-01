// Task 2.4 — Caderno de serviços de manutenção.
//
// Lista em modo "caderno": máquina, data, tipo, custo total.
// Filtros: máquina, período e tipo. Sem status/prioridade.

import { useMemo, useState } from 'react';
import { useSearchParams, Navigate, useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, ClipboardList, Wrench, BarChart3, ClipboardCheck, CalendarClock, Package, HardHat, Droplets } from 'lucide-react';
import { useOrdensServico } from '../hooks/useOrdensServico';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useAuth } from '../contexts/AuthContext';
import type { TipoOS } from '../types';
import { TIPO_OS_LABEL } from '../types';
import Button from '../components/ui/Button';
import SmartSelect from '../components/ui/SmartSelect';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import NovaOSModal from '../components/manutencao/os/NovaOSModal';
import OSDetalhe from '../components/manutencao/os/OSDetalhe';
import DashboardManutencao from '../components/manutencao/DashboardManutencao';
import PlanosPreventivosPage from '../components/manutencao/PlanosPreventivosPage';
import PlanoDetalhePage from '../components/manutencao/planos/PlanoDetalhePage';
import AgendaPreventivasPage from '../components/manutencao/AgendaPreventivasPage';
import AlmoxarifadoPage from '../components/manutencao/AlmoxarifadoPage';
import ChecklistsPage from '../components/manutencao/ChecklistsPage';
import TiposOleoPage from '../components/manutencao/TiposOleoPage';
import MobileScanShortcut from '../components/MobileScanShortcut';

const TIPO_OPTS: { value: TipoOS | ''; label: string }[] = [
  { value: '', label: 'Todos tipos' },
  ...(Object.keys(TIPO_OS_LABEL) as TipoOS[]).map((k) => ({ value: k, label: TIPO_OS_LABEL[k] })),
];

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
  else if (pathname === '/manutencao/tipos-oleo') inner = <TiposOleoPage />;
  else if (params.id && pathname.startsWith('/manutencao/planos/')) inner = <PlanoDetalhePage />;
  else if (pathname === '/manutencao/planos') inner = <PlanosPreventivosPage />;
  else inner = <ServicosPage />;

  return (
    <div className="space-y-4">
      <MobileScanShortcut />
      <SubNav pathname={pathname} />
      {inner}
    </div>
  );
}

const SUB_NAV_ITEMS: { to: string; label: string; icon: typeof BarChart3; perm: string }[] = [
  { to: '/manutencao/dashboard',     label: 'Dashboard',           icon: BarChart3,      perm: 'aba_manutencao_dashboard' },
  { to: '/manutencao/os',            label: 'Serviços',            icon: ClipboardList,  perm: 'aba_manutencao_os' },
  { to: '/manutencao/agenda',        label: 'Agenda preventiva',   icon: CalendarClock,  perm: 'aba_manutencao_agenda' },
  { to: '/manutencao/planos',        label: 'Planos preventivos',  icon: ClipboardCheck, perm: 'aba_manutencao_planos' },
  { to: '/manutencao/almoxarifado',  label: 'Almoxarifado',        icon: Package,        perm: 'aba_manutencao_almoxarifado' },
  { to: '/manutencao/checklists',    label: 'Checklists pré-uso',  icon: HardHat,        perm: 'aba_manutencao_checklists' },
  { to: '/manutencao/tipos-oleo',    label: 'Tipos de óleo',       icon: Droplets,       perm: 'gerenciar_tipos_oleo' },
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

function ServicosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroTipo = (searchParams.get('tipo') ?? '') as TipoOS | '';
  const filtroEquipamento = searchParams.get('equipamento') ?? '';
  const filtroDe = searchParams.get('de') ?? '';
  const filtroAte = searchParams.get('ate') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const { data: equipamentos = [] } = useEquipamentos();
  const { temAcao } = useAuth();
  const canCreate = temAcao('criar_os');

  const { data: servicos = [], isLoading } = useOrdensServico({
    tipo: filtroTipo || undefined,
    equipamentoId: filtroEquipamento || undefined,
    status: 'concluida',
  });

  const equipamentosPorId = useMemo(() => {
    const map = new Map<string, typeof equipamentos[number]>();
    for (const eq of equipamentos) map.set(eq.id, eq);
    return map;
  }, [equipamentos]);

  // Filtro de período (client-side sobre dataConclusao/dataAbertura).
  // Usa comparação de strings YYYY-MM-DD (mesmo padrão de PagamentoFreteList)
  // para evitar problemas de fuso horário com objetos Date.
  const servicosFiltrados = useMemo(() => {
    let result = servicos;
    if (filtroDe || filtroAte) {
      result = result.filter((s) => {
        const dataStr = (s.dataConclusao ?? s.dataAbertura ?? '').slice(0, 10);
        if (filtroDe && dataStr < filtroDe) return false;
        if (filtroAte && dataStr > filtroAte) return false;
        return true;
      });
    }
    return result;
  }, [servicos, filtroDe, filtroAte]);

  const totalPeriodo = useMemo(
    () => servicosFiltrados.reduce((acc, s) => acc + s.custoTotal, 0),
    [servicosFiltrados]
  );

  const [novoServicoOpen, setNovoServicoOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Caderno de Serviços"
        description="Registro de serviços de manutenção por equipamento."
        actions={canCreate && (
          <Button onClick={() => setNovoServicoOpen(true)}>
            <Plus aria-hidden className="w-4 h-4" />
            Registrar serviço
          </Button>
        )}
      />

      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex flex-wrap gap-2 items-center">
        <SmartSelect
          value={filtroEquipamento}
          onChange={(e) => setParam('equipamento', e.target.value)}
          wrapperClassName="relative"
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] max-w-[280px] flex items-center min-w-[200px] text-left"
        >
          <option value="">Todas as máquinas</option>
          {equipamentos
            .filter((e) => e.ativo !== false && e.id !== 'desconhecido')
            .map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.codigoPatrimonio ? `${eq.codigoPatrimonio} — ${eq.nome}` : eq.nome}
              </option>
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

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-[var(--color-fg-muted)]">De</label>
          <input
            type="date"
            value={filtroDe}
            onChange={(e) => setParam('de', e.target.value)}
            className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-[var(--color-fg-muted)]">Até</label>
          <input
            type="date"
            value={filtroAte}
            onChange={(e) => setParam('ate', e.target.value)}
            className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        {(filtroDe || filtroAte || filtroTipo || filtroEquipamento) && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setSearchParams({}, { replace: true });
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela / lista */}
      {isLoading ? (
        <LoadingState mode="list" count={5} />
      ) : servicosFiltrados.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum serviço encontrado"
          description={servicos.length === 0
            ? 'Comece registrando o primeiro serviço.'
            : 'Ajuste os filtros ou limpe o período.'}
          action={servicos.length === 0 && canCreate && (
            <Button onClick={() => setNovoServicoOpen(true)}>
              <Plus className="w-4 h-4" /> Registrar serviço
            </Button>
          )}
        />
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Máquina</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Data</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Tipo</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Custo total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {servicosFiltrados.map((svc) => {
                  const eq = equipamentosPorId.get(svc.equipamentoId);
                  const eqLabel = eq
                    ? (eq.codigoPatrimonio ? `${eq.codigoPatrimonio} — ${eq.nome}` : eq.nome)
                    : svc.equipamentoId;
                  const dataRef = svc.dataConclusao ?? svc.dataAbertura;
                  return (
                    <tr
                      key={svc.id}
                      className="hover:bg-[var(--color-surface-2)] cursor-pointer transition-colors"
                      onClick={() => navigate(`/manutencao/os/${svc.numero}`)}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--color-fg)] truncate max-w-[220px]">
                        {eqLabel}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-fg-muted)] whitespace-nowrap">
                        {fmtData(dataRef)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-fg-muted)]">
                        {TIPO_OS_LABEL[svc.tipo] ?? svc.tipo}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-fg)]">
                        {fmtBRL(svc.custoTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé com total do período */}
          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-[var(--color-fg-muted)]">
              {servicosFiltrados.length} {servicosFiltrados.length === 1 ? 'serviço' : 'serviços'}
            </span>
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-[var(--color-fg-muted)]" />
              <span className="text-xs text-[var(--color-fg-muted)]">Total do período:</span>
              <span className="font-semibold font-mono text-[var(--color-fg)]">{fmtBRL(totalPeriodo)}</span>
            </div>
          </div>
        </div>
      )}

      {novoServicoOpen && (
        <NovaOSModal
          open={novoServicoOpen}
          onClose={() => setNovoServicoOpen(false)}
          equipamentos={equipamentos}
        />
      )}
    </div>
  );
}
