// Marco 5 / PR26 — Página de gestão de checklists no módulo Manutenção.
//
// Aba 'Não-conformidades': equipamentos com pendências em aberto (view).
// Aba 'Execuções recentes': histórico filtrável.
// Click em execução → modal de detalhe com respostas + fotos.

import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ClipboardList, ClipboardCheck, ExternalLink, Search, Filter,
} from 'lucide-react';
import { useChecklistsNaoConformidades } from '../../hooks/useChecklistNaoConformidades';
import { useChecklistExecucoes } from '../../hooks/useChecklists';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import type { ChecklistNaoConformidade } from '../../hooks/useChecklistNaoConformidades';
import type { StatusExecucaoChecklist } from '../../types';
import ChecklistDetalheModal from './checklists/ChecklistDetalheModal';

type Aba = 'nao_conformidades' | 'execucoes';

function fmtData(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_LABEL: Record<StatusExecucaoChecklist, string> = {
  concluido: 'Concluído',
  concluido_com_pendencias: 'Com pendências',
  bloqueado: 'Bloqueado',
};

export default function ChecklistsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const aba: Aba = (searchParams.get('aba') as Aba) ?? 'nao_conformidades';
  const [busca, setBusca] = useState('');
  const [filtroEquip, setFiltroEquip] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusExecucaoChecklist>('todos');
  const [execucaoSelecionada, setExecucaoSelecionada] = useState<string | null>(null);

  const setAba = (a: Aba) => {
    const next = new URLSearchParams(searchParams);
    next.set('aba', a);
    setSearchParams(next, { replace: true });
  };

  const { data: naoConformidades = [], isLoading: loadingNC } = useChecklistsNaoConformidades();
  const { data: execucoes = [], isLoading: loadingExec } = useChecklistExecucoes({ limit: 200 });
  const { data: equipamentos = [] } = useEquipamentos();

  const equipMap = useMemo(() => {
    const m = new Map<string, typeof equipamentos[number]>();
    for (const e of equipamentos) m.set(e.id, e);
    return m;
  }, [equipamentos]);

  const ncFiltradas = useMemo(() => {
    if (!busca) return naoConformidades;
    const q = busca.toLowerCase();
    return naoConformidades.filter((nc) => {
      const all = `${nc.codigoPatrimonio} ${nc.equipamentoNome} ${nc.operadorNome} ${nc.equipamentoTipo}`.toLowerCase();
      return all.includes(q);
    });
  }, [naoConformidades, busca]);

  const execucoesFiltradas = useMemo(() => {
    return execucoes.filter((e) => {
      if (filtroEquip && e.equipamentoId !== filtroEquip) return false;
      if (filtroStatus !== 'todos' && e.status !== filtroStatus) return false;
      if (busca) {
        const eq = equipMap.get(e.equipamentoId);
        const all = `${eq?.codigoPatrimonio ?? ''} ${eq?.nome ?? ''} ${e.operadorNome}`.toLowerCase();
        if (!all.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [execucoes, filtroEquip, filtroStatus, busca, equipMap]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-fg)] tracking-tight">
          Checklists pré-uso
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
          Inspeções diárias feitas pelos operadores no app mobile.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        <TabBtn
          ativo={aba === 'nao_conformidades'}
          onClick={() => setAba('nao_conformidades')}
          icon={AlertTriangle}
          label="Não-conformidades"
          badge={naoConformidades.length}
        />
        <TabBtn
          ativo={aba === 'execucoes'}
          onClick={() => setAba('execucoes')}
          icon={ClipboardList}
          label="Execuções recentes"
          badge={execucoes.length}
        />
      </div>

      {/* Busca/filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por equipamento, operador…"
            className="w-full h-[36px] rounded-lg pl-9 pr-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>
        {aba === 'execucoes' && (
          <>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'todos' | StatusExecucaoChecklist)}
              className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)]"
            >
              <option value="todos">Todos status</option>
              <option value="concluido">Concluído</option>
              <option value="concluido_com_pendencias">Com pendências</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
            <select
              value={filtroEquip}
              onChange={(e) => setFiltroEquip(e.target.value)}
              className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] max-w-[280px]"
            >
              <option value="">Todos equipamentos</option>
              {equipamentos
                .filter((e) => e.ativo !== false && e.id !== 'desconhecido')
                .map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.codigoPatrimonio ? `${eq.codigoPatrimonio} — ${eq.nome}` : eq.nome}
                  </option>
                ))}
            </select>
          </>
        )}
      </div>

      {/* Conteúdo da aba */}
      {aba === 'nao_conformidades' ? (
        loadingNC ? (
          <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando…</p>
        ) : ncFiltradas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
            <ClipboardCheck aria-hidden className="w-10 h-10 text-[var(--color-success-fg)] mx-auto mb-3" />
            <p className="text-sm font-medium text-[var(--color-fg)]">
              {naoConformidades.length === 0
                ? 'Nenhuma não-conformidade aberta'
                : 'Sem resultados para a busca'}
            </p>
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">
              {naoConformidades.length === 0
                ? 'Todos os equipamentos estão liberados para operação.'
                : 'Ajuste a busca para ver outros itens.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ncFiltradas.map((nc) => (
              <NCCard
                key={nc.execucaoId}
                nc={nc}
                onClick={() => setExecucaoSelecionada(nc.execucaoId)}
              />
            ))}
          </div>
        )
      ) : loadingExec ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando…</p>
      ) : execucoesFiltradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
          <Filter aria-hidden className="w-10 h-10 text-[var(--color-fg-subtle)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--color-fg)]">
            {execucoes.length === 0 ? 'Nenhuma execução ainda' : 'Sem resultados para os filtros'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {execucoesFiltradas.map((e) => {
            const eq = equipMap.get(e.equipamentoId);
            return (
              <div
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => setExecucaoSelecionada(e.id)}
                onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && setExecucaoSelecionada(e.id)}
                className={
                  'rounded-xl border p-3 cursor-pointer hover:border-[var(--color-border-strong)] transition-colors ' +
                  (e.status === 'bloqueado' ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]'
                    : e.status === 'concluido_com_pendencias' ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)]')
                }
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--color-fg)]">
                        {eq?.codigoPatrimonio ?? '—'} · {eq?.nome ?? 'Equipamento removido'}
                      </span>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="text-xs text-[var(--color-fg-muted)] mt-1">
                      Operador: {e.operadorNome || '—'}
                      {' · '}
                      {fmtData(e.concluidoEm)}
                      {e.medicaoAtual != null && ` · ${e.medicaoAtual.toLocaleString('pt-BR')} ${eq?.tipoMedicao === 'horimetro' ? 'h' : 'km'}`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {execucaoSelecionada && (
        <ChecklistDetalheModal
          open={!!execucaoSelecionada}
          onClose={() => setExecucaoSelecionada(null)}
          execucaoId={execucaoSelecionada}
        />
      )}
    </div>
  );
}

function TabBtn({
  ativo, onClick, icon: Icon, label, badge,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-2 -mb-px border-b-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5 ' +
        (ativo
          ? 'border-[var(--color-accent)] text-[var(--color-fg)]'
          : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
      }
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge != null && badge > 0 && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] ml-0.5">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: StatusExecucaoChecklist }) {
  const cor =
    status === 'bloqueado' ? 'bg-[var(--color-danger)] text-white'
      : status === 'concluido_com_pendencias' ? 'bg-[var(--color-warning)] text-white'
      : 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]';
  return (
    <span className={'inline-block text-[11px] px-2 py-0.5 rounded-full ' + cor}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function NCCard({
  nc, onClick,
}: {
  nc: ChecklistNaoConformidade;
  onClick: () => void;
}) {
  const cor =
    nc.itensCriticos > 0 ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]'
      : 'border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className={'rounded-xl border p-3 cursor-pointer hover:border-[var(--color-border-strong)] transition-colors ' + cor}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/frota?patrimonio=${encodeURIComponent(nc.codigoPatrimonio)}`}
              className="text-sm font-semibold text-[var(--color-fg)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {nc.codigoPatrimonio} · {nc.equipamentoNome}
            </Link>
            <StatusBadge status={nc.status} />
            {nc.itensCriticos > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-danger)] text-white">
                <AlertTriangle className="w-3 h-3" /> {nc.itensCriticos} crítico{nc.itensCriticos > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            {nc.equipamentoTipo} · {nc.itensNao} item{nc.itensNao > 1 ? 'ns' : ''} marcado{nc.itensNao > 1 ? 's' : ''} como "Não"
            {' · '}{nc.operadorNome} · {fmtData(nc.concluidoEm)}
          </p>
        </div>
        {nc.osGeradaId ? (
          <Link
            to={`/manutencao/os/${nc.osGeradaId}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:bg-[var(--color-surface-3)]"
            onClick={(e) => e.stopPropagation()}
          >
            Ver OS <ExternalLink className="w-3 h-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
