/**
 * PedidoCompraListV2 — lista premium dos pedidos com filtros, badges e ações.
 *
 * Layout: tabela em desktop (≥sm) via ui/DataTable; cards empilhados em mobile.
 * Filtros: busca textual, status, urgência, obra, tipo, solicitante, período.
 * Ações por linha: Editar, Aprovar, Reprovar (modal motivo), Enviar p/ cotação,
 * Gerar OC, Histórico (drawer auditoria), Excluir.
 *
 * Onda 3.C — desktop table migrou pra DataTable. Mobile card view e
 * filtros próprios preservados.
 */
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  FileEdit, CheckCircle2, XCircle, Send, ShoppingCart,
  History, Trash2, Inbox, FileText, RotateCcw,
} from 'lucide-react';
import type { PedidoCompra, Obra, Cotacao, OrdemCompra, StatusPedidoCompra, UrgenciaPedidoCompra, TipoItemCompra } from '../../types';
import BadgeStatusCompra from './BadgeStatusCompra';
import HistoricoCompras from './HistoricoCompras';
import {
  FiltrosBarra, FilterPill, FilterDateRange, FilterMultiCheck,
} from './FiltrosCompras';
import { dentroDoPeriodo } from '../../utils/comprasFiltros';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

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

// Mantidas Tailwind hardcoded por enquanto (visual chips deliberados).
// Migrar pra tokens semânticos em Onda 8 (polish).
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

const PAGE_SIZE_KEY = 'pedidos-compra-list-page-size';

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
  const [historicoAberto, setHistoricoAberto] = useState<PedidoCompra | null>(null);

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

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
      });
    // sort removido — DataTable cuida via defaultSorting
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

  const columns = useMemo<ColumnDef<PedidoCompra>[]>(() => [
    {
      id: 'numero',
      header: 'Número',
      accessorKey: 'numero',
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-xs text-[var(--color-fg)] whitespace-nowrap">
            {row.original.numero}
          </span>
          {row.original.valorEstimado != null && (
            <div className="text-3xs text-[var(--color-fg-subtle)] font-sans mt-0.5">
              ~ {formatarMoeda(row.original.valorEstimado)}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'data',
      header: 'Data',
      accessorKey: 'data',
      cell: ({ row }) => (
        <span className="text-[var(--color-fg-muted)] whitespace-nowrap text-xs">
          {formatarData(row.original.data)}
        </span>
      ),
    },
    {
      id: 'obra',
      header: 'Obra',
      enableSorting: false,
      accessorFn: (p) => obrasMap.get(p.obraId) ?? '',
      cell: ({ row }) => obrasMap.get(row.original.obraId)
        ? <span className="text-[var(--color-fg)]">{obrasMap.get(row.original.obraId)}</span>
        : <span className="text-[var(--color-fg-subtle)] italic">—</span>,
    },
    {
      id: 'solicitante',
      header: 'Solicitante',
      accessorKey: 'solicitante',
      cell: ({ row }) => <span className="text-[var(--color-fg)]">{row.original.solicitante}</span>,
    },
    {
      id: 'itens',
      header: 'Itens',
      enableSorting: false,
      cell: ({ row }) => <ResumoItens pedido={row.original} />,
    },
    {
      id: 'urgencia',
      header: 'Urgência',
      accessorKey: 'urgencia',
      cell: ({ row }) => (
        <span className={`inline-flex items-center px-2 h-6 rounded-md border text-2xs font-medium ${URGENCIA_CHIP[row.original.urgencia]}`}>
          {URGENCIA_LABEL[row.original.urgencia]}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        const ligacoes = ligacoesMap.get(row.original.id);
        return (
          <div>
            <BadgeStatusCompra status={row.original.status} />
            {ligacoes && (ligacoes.qtdCotacoes > 0 || ligacoes.qtdOCs > 0) && (
              <div className="text-3xs text-[var(--color-fg-subtle)] mt-1">
                {ligacoes.qtdCotacoes > 0 && `${ligacoes.qtdCotacoes} cotação(ões)`}
                {ligacoes.qtdCotacoes > 0 && ligacoes.qtdOCs > 0 && ' · '}
                {ligacoes.qtdOCs > 0 && `${ligacoes.qtdOCs} OC(s)`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <AcoesPedido
            pedido={row.original}
            canApprove={canApprove}
            canCreate={canCreate}
            onAprovar={() => onAprovar(row.original)}
            onReprovar={() => onReprovar(row.original)}
            onDesaprovar={onDesaprovar ? () => onDesaprovar(row.original) : undefined}
            onEditar={onEditar ? () => onEditar(row.original) : undefined}
            onExcluir={() => onExcluir(row.original)}
            onEnviarCotacao={() => onEnviarCotacao(row.original)}
            onGerarOC={() => onGerarOC(row.original)}
            onHistorico={() => setHistoricoAberto(row.original)}
          />
        </div>
      ),
    },
  ], [obrasMap, ligacoesMap, canApprove, canCreate,
       onAprovar, onReprovar, onDesaprovar, onEditar, onExcluir, onEnviarCotacao, onGerarOC]);

  // Empty wrapper compartilhado (desktop + mobile). DataTable não é usado quando
  // não há dados pra evitar render duplicado da empty state.
  if (filtrados.length === 0) {
    return (
      <>
        <FiltrosBarra totalAtivos={filtrosAtivos} total={0} onLimpar={limparFiltros}>
          {/* filtros — repetidos abaixo */}
          <FilterPill label="Status" value={statusFiltro} onChange={(v) => setStatusFiltro(v as '' | StatusPedidoCompra)} options={STATUS_OPTIONS} />
          <FilterPill label="Obra" value={obraFiltro} onChange={setObraFiltro} options={[{ value: '', label: 'Todas' }, ...obras.map((o) => ({ value: o.id, label: o.nome }))]} />
          <FilterPill label="Urgência" value={urgenciaFiltro} onChange={(v) => setUrgenciaFiltro(v as '' | UrgenciaPedidoCompra)} options={[{ value: '', label: 'Todas' }, { value: 'baixa', label: 'Baixa' }, { value: 'normal', label: 'Normal' }, { value: 'alta', label: 'Alta' }, { value: 'critica', label: 'Crítica' }]} />
          <FilterPill label="Tipo" value={tipoFiltro} onChange={(v) => setTipoFiltro(v as '' | TipoItemCompra)} options={[{ value: '', label: 'Todos' }, { value: 'material', label: 'Material' }, { value: 'servico', label: 'Serviço' }]} />
          <FilterMultiCheck label="Solicitante" selected={solicitantesFiltro} onChange={setSolicitantesFiltro} options={solicitantesOptions} />
          <FilterDateRange label="Período" de={dataDe} ate={dataAte} onChange={(d, a) => { setDataDe(d); setDataAte(a); }} />
        </FiltrosBarra>
        <EmptyState
          icon={Inbox}
          title={busca ? 'Nenhum pedido encontrado' : 'Sem pedidos ainda'}
          description={busca
            ? 'Ajuste a busca ou os filtros para encontrar o pedido.'
            : canCreate
              ? 'Clique em "Novo Pedido" no topo da página para registrar a primeira solicitação.'
              : 'Quando alguém criar um pedido, ele aparecerá aqui.'}
          action={busca ? (
            <Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button>
          ) : undefined}
        />
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

  return (
    <>
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

      {/* Desktop: DataTable */}
      <div className="hidden sm:block">
        <DataTable<PedidoCompra>
          columns={columns}
          data={filtrados}
          getRowId={(row) => row.id}
          persistPageSizeKey={PAGE_SIZE_KEY}
          defaultSorting={[{ id: 'data', desc: true }]}
          onRowClick={onVerDetalhes}
          enableDensityToggle
          enableColumnVisibilityToggle
          itemLabel={{ singular: 'pedido', plural: 'pedidos' }}
        />
      </div>

      {/* Mobile: cards empilhados (preserva layout original < sm) */}
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
      <div className="text-3xs text-[var(--color-fg-subtle)] truncate max-w-[180px] mt-0.5">
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
    success: 'text-[var(--color-success-fg)] hover:bg-[var(--color-success-soft)]',
    danger:  'text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]',
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
