/**
 * PedidoCompraListV2 — lista premium dos pedidos com filtros, badges e ações.
 *
 * Layout: tabela em desktop (≥sm) e cards empilhados em mobile.
 * Filtros: busca textual, status, urgência, obra.
 * Ações por linha: Editar, Aprovar, Reprovar (modal motivo), Enviar p/ cotação,
 * Gerar OC, Histórico (drawer auditoria), Excluir.
 */
import { useMemo, useState } from 'react';
import {
  Search, FileEdit, CheckCircle2, XCircle, Send, ShoppingCart,
  History, Trash2, Inbox, FileText, RotateCcw,
} from 'lucide-react';
import type { PedidoCompra, Obra, Cotacao, OrdemCompra, StatusPedidoCompra, UrgenciaPedidoCompra, TipoItemCompra } from '../../types';
import BadgeStatusCompra from './BadgeStatusCompra';
import HistoricoCompras from './HistoricoCompras';
import {
  FiltrosBarra, FilterPill, FilterDateRange, FilterMultiCheck,
} from './FiltrosCompras';
import { dentroDoPeriodo } from '../../utils/comprasFiltros';

interface Props {
  pedidos: PedidoCompra[];
  obras: Obra[];
  cotacoes: Cotacao[];
  ordens: OrdemCompra[];
  busca: string;
  categorias: { value: string; label: string }[];
  onAprovar: (p: PedidoCompra) => void;
  onReprovar: (p: PedidoCompra) => void;
  onDesaprovar?: (p: PedidoCompra) => void;
  onExcluir: (p: PedidoCompra) => void;
  onEnviarCotacao: (p: PedidoCompra) => void;
  onGerarOC: (p: PedidoCompra) => void;
  onEditar?: (p: PedidoCompra) => void;
  /** Abre drawer de detalhes (visualização). */
  onVerDetalhes?: (p: PedidoCompra) => void;
  canApprove: boolean;
  canCreate: boolean;
}

const URGENCIA_LABEL: Record<UrgenciaPedidoCompra, string> = {
  baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica',
};

const URGENCIA_CHIP: Record<UrgenciaPedidoCompra, string> = {
  baixa:    'bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-500/10 dark:text-slate-200 dark:border-slate-500/30',
  normal:   'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/30',
  alta:     'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30',
  critica:  'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/10 dark:text-rose-100 dark:border-rose-500/30',
};

const STATUS_OPTIONS: { value: '' | StatusPedidoCompra; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'aprovado', label: 'Aprovados' },
  { value: 'reprovado', label: 'Reprovados' },
  { value: 'em_cotacao', label: 'Em cotação' },
  { value: 'cotado', label: 'Cotados' },
  { value: 'comprado', label: 'Comprados' },
  { value: 'cancelado', label: 'Cancelados' },
];

function formatarData(s: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

function formatarMoeda(v?: number): string {
  if (v == null) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PedidoCompraListV2({
  pedidos, obras, cotacoes, ordens, busca,
  onAprovar, onReprovar, onDesaprovar, onExcluir,
  onEnviarCotacao, onGerarOC, onEditar, onVerDetalhes,
  canApprove, canCreate,
}: Props) {
  const [statusFiltro, setStatusFiltro] = useState<'' | StatusPedidoCompra>('');
  const [obraFiltro, setObraFiltro] = useState<string>('');
  const [urgenciaFiltro, setUrgenciaFiltro] = useState<'' | UrgenciaPedidoCompra>('');
  const [tipoFiltro, setTipoFiltro] = useState<'' | TipoItemCompra>('');
  const [solicitantesFiltro, setSolicitantesFiltro] = useState<string[]>([]);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  // valor estimado removido do form de pedido — filtros descontinuados
  const [historicoAberto, setHistoricoAberto] = useState<PedidoCompra | null>(null);

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  // Lista única de solicitantes (de pedidos não deletados)
  const solicitantesOptions = useMemo(() => {
    const set = new Set<string>();
    pedidos.filter((p) => !p.deletadoEm).forEach((p) => p.solicitante && set.add(p.solicitante));
    return Array.from(set).sort().map((s) => ({ value: s, label: s }));
  }, [pedidos]);

  const limparFiltros = () => {
    setStatusFiltro(''); setObraFiltro(''); setUrgenciaFiltro(''); setTipoFiltro('');
    setSolicitantesFiltro([]); setDataDe(''); setDataAte('');
  };

  const filtrosAtivos =
    (statusFiltro ? 1 : 0) + (obraFiltro ? 1 : 0) + (urgenciaFiltro ? 1 : 0) +
    (tipoFiltro ? 1 : 0) + (solicitantesFiltro.length > 0 ? 1 : 0) +
    (dataDe || dataAte ? 1 : 0);

  // Pedidos visíveis (não deletados) filtrados
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pedidos
      .filter((p) => !p.deletadoEm)
      .filter((p) => !statusFiltro || p.status === statusFiltro)
      .filter((p) => !obraFiltro || p.obraId === obraFiltro)
      .filter((p) => !urgenciaFiltro || p.urgencia === urgenciaFiltro)
      .filter((p) => solicitantesFiltro.length === 0 || solicitantesFiltro.includes(p.solicitante))
      .filter((p) => dentroDoPeriodo(p.data, dataDe, dataAte))
      .filter((p) => {
        if (!tipoFiltro) return true;
        return p.itens.some((it) => (it.tipo ?? 'material') === tipoFiltro);
      })
      .filter((p) => {
        if (!q) return true;
        const obraNome = obrasMap.get(p.obraId) || '';
        return (
          p.numero.toLowerCase().includes(q)
          || p.solicitante.toLowerCase().includes(q)
          || obraNome.toLowerCase().includes(q)
          || (p.descricaoLivre || '').toLowerCase().includes(q)
          || p.itens.some((i) => i.descricao.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [pedidos, busca, statusFiltro, obraFiltro, urgenciaFiltro, tipoFiltro,
       solicitantesFiltro, dataDe, dataAte, obrasMap]);

  // Conta cotações e OCs por pedido (pra mostrar progresso)
  const ligacoesMap = useMemo(() => {
    const m = new Map<string, { qtdCotacoes: number; qtdOCs: number }>();
    for (const c of cotacoes) {
      if (!c.pedidoCompraId) continue;
      const cur = m.get(c.pedidoCompraId) ?? { qtdCotacoes: 0, qtdOCs: 0 };
      cur.qtdCotacoes++;
      m.set(c.pedidoCompraId, cur);
    }
    for (const o of ordens) {
      if (!o.pedidoCompraId) continue;
      const cur = m.get(o.pedidoCompraId) ?? { qtdCotacoes: 0, qtdOCs: 0 };
      cur.qtdOCs++;
      m.set(o.pedidoCompraId, cur);
    }
    return m;
  }, [cotacoes, ordens]);

  return (
    <>
      {/* Barra de filtros premium */}
      <FiltrosBarra totalAtivos={filtrosAtivos} total={filtrados.length} onLimpar={limparFiltros}>
        <FilterPill
          label="Status"
          value={statusFiltro}
          onChange={(v) => setStatusFiltro(v as '' | StatusPedidoCompra)}
          options={STATUS_OPTIONS}
        />
        <FilterPill
          label="Obra"
          value={obraFiltro}
          onChange={setObraFiltro}
          options={[{ value: '', label: 'Todas' }, ...obras.map((o) => ({ value: o.id, label: o.nome }))]}
        />
        <FilterPill
          label="Urgência"
          value={urgenciaFiltro}
          onChange={(v) => setUrgenciaFiltro(v as '' | UrgenciaPedidoCompra)}
          options={[
            { value: '', label: 'Todas' },
            { value: 'baixa', label: 'Baixa' },
            { value: 'normal', label: 'Normal' },
            { value: 'alta', label: 'Alta' },
            { value: 'critica', label: 'Crítica' },
          ]}
        />
        <FilterPill
          label="Tipo"
          value={tipoFiltro}
          onChange={(v) => setTipoFiltro(v as '' | TipoItemCompra)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'material', label: 'Material' },
            { value: 'servico', label: 'Serviço' },
          ]}
        />
        <FilterMultiCheck
          label="Solicitante"
          selected={solicitantesFiltro}
          onChange={setSolicitantesFiltro}
          options={solicitantesOptions}
        />
        <FilterDateRange label="Período" de={dataDe} ate={dataAte} onChange={(d, a) => { setDataDe(d); setDataAte(a); }} />
      </FiltrosBarra>

      {/* Tabela (≥sm) */}
      {filtrados.length === 0 ? (
        <EmptyState busca={busca} canCreate={canCreate} />
      ) : (
        <>
          <div className="hidden sm:block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)]/60 text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Número</th>
                  <th className="px-4 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-left font-semibold">Obra</th>
                  <th className="px-4 py-3 text-left font-semibold">Solicitante</th>
                  <th className="px-4 py-3 text-left font-semibold">Itens</th>
                  <th className="px-4 py-3 text-left font-semibold">Urgência</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtrados.map((p) => {
                  const ligacoes = ligacoesMap.get(p.id);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[var(--color-surface-2)]/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Ignora clique se foi em botão de ação (última coluna)
                        if ((e.target as HTMLElement).closest('button,a,[role="menu"]')) return;
                        onVerDetalhes?.(p);
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg)] whitespace-nowrap">
                        {p.numero}
                        {p.valorEstimado != null && (
                          <div className="text-[10px] text-[var(--color-fg-subtle)] font-sans mt-0.5">
                            ~ {formatarMoeda(p.valorEstimado)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-fg-muted)] whitespace-nowrap">
                        {formatarData(p.data)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-fg)]">
                        {obrasMap.get(p.obraId) || <span className="text-[var(--color-fg-subtle)] italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-fg)]">{p.solicitante}</td>
                      <td className="px-4 py-3">
                        <ResumoItens pedido={p} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 h-6 rounded-md border text-[11px] font-medium ${URGENCIA_CHIP[p.urgencia]}`}>
                          {URGENCIA_LABEL[p.urgencia]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <BadgeStatusCompra status={p.status} />
                        {ligacoes && (ligacoes.qtdCotacoes > 0 || ligacoes.qtdOCs > 0) && (
                          <div className="text-[10px] text-[var(--color-fg-subtle)] mt-1">
                            {ligacoes.qtdCotacoes > 0 && `${ligacoes.qtdCotacoes} cotação(ões)`}
                            {ligacoes.qtdCotacoes > 0 && ligacoes.qtdOCs > 0 && ' · '}
                            {ligacoes.qtdOCs > 0 && `${ligacoes.qtdOCs} OC(s)`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AcoesPedido
                          pedido={p}
                          canApprove={canApprove}
                          canCreate={canCreate}
                          onAprovar={() => onAprovar(p)}
                          onReprovar={() => onReprovar(p)}
                          onDesaprovar={onDesaprovar ? () => onDesaprovar(p) : undefined}
                          onEditar={onEditar ? () => onEditar(p) : undefined}
                          onExcluir={() => onExcluir(p)}
                          onEnviarCotacao={() => onEnviarCotacao(p)}
                          onGerarOC={() => onGerarOC(p)}
                          onHistorico={() => setHistoricoAberto(p)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="sm:hidden space-y-2">
            {filtrados.map((p) => (
              <PedidoCard
                key={p.id}
                pedido={p}
                obraNome={obrasMap.get(p.obraId)}
                canApprove={canApprove}
                canCreate={canCreate}
                onAprovar={() => onAprovar(p)}
                onReprovar={() => onReprovar(p)}
                onDesaprovar={onDesaprovar ? () => onDesaprovar(p) : undefined}
                onEditar={onEditar ? () => onEditar(p) : undefined}
                onExcluir={() => onExcluir(p)}
                onEnviarCotacao={() => onEnviarCotacao(p)}
                onGerarOC={() => onGerarOC(p)}
                onHistorico={() => setHistoricoAberto(p)}
              />
            ))}
          </div>
        </>
      )}

      {/* Drawer de histórico */}
      {historicoAberto && (
        <HistoricoCompras
          open={!!historicoAberto}
          onClose={() => setHistoricoAberto(null)}
          entidade="pedido"
          entidadeId={historicoAberto.id}
          numero={historicoAberto.numero}
        />
      )}
    </>
  );
}

// ─── auxiliares ──────────────────────────────────────────────────────────

function ResumoItens({ pedido }: { pedido: PedidoCompra }) {
  const qtd = pedido.itens.length;
  const temDescricao = !!pedido.descricaoLivre?.trim();
  if (qtd === 0 && !temDescricao) {
    return <span className="text-xs text-[var(--color-fg-subtle)] italic">vazio</span>;
  }
  if (qtd === 0 && temDescricao) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
        <FileText className="w-3 h-3" /> só descrição
      </span>
    );
  }
  return (
    <div className="text-xs text-[var(--color-fg)]">
      {qtd} {qtd === 1 ? 'item' : 'itens'}
      {temDescricao && (
        <span className="ml-1 text-[var(--color-fg-subtle)]">+ descrição</span>
      )}
      <div className="text-[10px] text-[var(--color-fg-subtle)] truncate max-w-[180px] mt-0.5">
        {pedido.itens.slice(0, 2).map((i) => i.descricao).join(' · ')}
        {pedido.itens.length > 2 && ` +${pedido.itens.length - 2}`}
      </div>
    </div>
  );
}

function AcoesPedido({
  pedido, canApprove, canCreate,
  onAprovar, onReprovar, onDesaprovar, onEditar, onExcluir,
  onEnviarCotacao, onGerarOC, onHistorico,
}: {
  pedido: PedidoCompra;
  canApprove: boolean;
  canCreate: boolean;
  onAprovar: () => void;
  onReprovar: () => void;
  onDesaprovar?: () => void;
  onEditar?: () => void;
  onExcluir: () => void;
  onEnviarCotacao: () => void;
  onGerarOC: () => void;
  onHistorico: () => void;
}) {
  const podeAprovar = canApprove && pedido.status === 'pendente';
  const podeReabrir = canApprove && pedido.status === 'aprovado' && !!onDesaprovar;
  const podeFluxoCompra = canCreate && (pedido.status === 'aprovado' || pedido.status === 'em_cotacao' || pedido.status === 'cotado');

  return (
    <div className="flex items-center justify-end gap-1">
      {podeAprovar && (
        <>
          <IconButton title="Aprovar" onClick={onAprovar} variant="success">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton title="Reprovar" onClick={onReprovar} variant="danger">
            <XCircle className="w-3.5 h-3.5" />
          </IconButton>
        </>
      )}
      {podeReabrir && (
        <IconButton title="Voltar para Pendente" onClick={onDesaprovar!}>
          <RotateCcw className="w-3.5 h-3.5" />
        </IconButton>
      )}
      {podeFluxoCompra && (
        <>
          <IconButton title="Enviar para cotação" onClick={onEnviarCotacao}>
            <Send className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton title="Gerar Ordem de Compra" onClick={onGerarOC}>
            <ShoppingCart className="w-3.5 h-3.5" />
          </IconButton>
        </>
      )}
      {/* Editar só aparece enquanto o pedido está PENDENTE. Uma vez aprovado
          (ou seguindo no fluxo), travar é a regra de negócio — pra editar é
          preciso primeiro clicar em "Voltar para Pendente" (ícone ao lado). */}
      {onEditar && pedido.status === 'pendente' && (
        <IconButton title="Editar" onClick={onEditar}>
          <FileEdit className="w-3.5 h-3.5" />
        </IconButton>
      )}
      <IconButton title="Histórico" onClick={onHistorico}>
        <History className="w-3.5 h-3.5" />
      </IconButton>
      {pedido.status !== 'comprado' && (
        <IconButton title="Excluir" onClick={onExcluir} variant="danger">
          <Trash2 className="w-3.5 h-3.5" />
        </IconButton>
      )}
    </div>
  );
}

function IconButton({
  title, onClick, children, variant = 'default',
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger';
}) {
  const cls = {
    default: 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]',
    success: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
    danger:  'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

function PedidoCard({
  pedido, obraNome, canApprove, canCreate,
  onAprovar, onReprovar, onDesaprovar, onEditar, onExcluir,
  onEnviarCotacao, onGerarOC, onHistorico,
}: {
  pedido: PedidoCompra;
  obraNome?: string;
  canApprove: boolean;
  canCreate: boolean;
  onAprovar: () => void;
  onReprovar: () => void;
  onDesaprovar?: () => void;
  onEditar?: () => void;
  onExcluir: () => void;
  onEnviarCotacao: () => void;
  onGerarOC: () => void;
  onHistorico: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-[var(--color-fg-muted)]">{pedido.numero}</div>
          <div className="text-sm font-semibold text-[var(--color-fg)] truncate">
            {obraNome || 'sem obra'}
          </div>
          <div className="text-xs text-[var(--color-fg-muted)]">
            {pedido.solicitante} · {formatarData(pedido.data)}
          </div>
        </div>
        <BadgeStatusCompra status={pedido.status} size="xs" />
      </div>
      <ResumoItens pedido={pedido} />
      <div className="flex items-center justify-end mt-2 -mr-1">
        <AcoesPedido
          pedido={pedido}
          canApprove={canApprove}
          canCreate={canCreate}
          onAprovar={onAprovar}
          onReprovar={onReprovar}
          onDesaprovar={onDesaprovar}
          onEditar={onEditar}
          onExcluir={onExcluir}
          onEnviarCotacao={onEnviarCotacao}
          onGerarOC={onGerarOC}
          onHistorico={onHistorico}
        />
      </div>
    </div>
  );
}

function EmptyState({ busca, canCreate }: { busca: string; canCreate: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] py-14 text-center">
      <Inbox className="w-8 h-8 mx-auto text-[var(--color-fg-subtle)] mb-2" />
      <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
        {busca ? 'Nenhum pedido encontrado' : 'Sem pedidos ainda'}
      </h3>
      <p className="text-xs text-[var(--color-fg-muted)] max-w-sm mx-auto">
        {busca
          ? 'Ajuste a busca ou os filtros para encontrar o pedido.'
          : canCreate
            ? 'Clique em "Novo Pedido" no topo da página para registrar a primeira solicitação.'
            : 'Quando alguém criar um pedido, ele aparecerá aqui.'}
      </p>
      <div className="sr-only">
        <Search /> {/* manter o ícone importado */}
      </div>
    </div>
  );
}
