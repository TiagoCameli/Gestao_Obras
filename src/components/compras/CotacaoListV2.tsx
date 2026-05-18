/**
 * CotacaoListV2 — lista premium das cotações, com filtros, badges e ações.
 *
 * Ações por linha: Editar (abre form com mapa), Enviar p/ fornecedor (modal),
 * Histórico (drawer auditoria), Excluir (soft delete).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  FileEdit, MessageCircle, History, Trash2, Inbox, Users, Package, RotateCcw,
} from 'lucide-react';
import type { Cotacao, Fornecedor, PedidoCompra, StatusCotacao } from '../../types';
import BadgeStatusCompra from './BadgeStatusCompra';
import HistoricoCompras from './HistoricoCompras';
import {
  FiltrosBarra, FilterPill, FilterDateRange, FilterMultiCheck,
} from './FiltrosCompras';
import { dentroDoPeriodo } from '../../utils/comprasFiltros';

interface Props {
  cotacoes: Cotacao[];
  fornecedores: Fornecedor[];
  pedidos: PedidoCompra[];
  busca: string;
  onEditar: (c: Cotacao) => void;
  onEnviar: (c: Cotacao) => void;
  onExcluir: (c: Cotacao) => void;
  /** Volta status para 'em_cotacao' (reabre cotação finalizada). */
  onReabrir?: (c: Cotacao) => void;
  /** Abre drawer de detalhes (visualização). */
  onVerDetalhes?: (c: Cotacao) => void;
  canEdit: boolean;
  canCreate: boolean;
}

const STATUS_OPTIONS: { value: '' | StatusCotacao; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'em_cotacao', label: 'Em cotação' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'cotado', label: 'Cotado' },
  { value: 'cancelada', label: 'Cancelada' },
];

function formatarData(s: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

export default function CotacaoListV2({
  cotacoes, fornecedores, pedidos, busca,
  onEditar, onEnviar, onExcluir, onReabrir, onVerDetalhes, canEdit, canCreate,
}: Props) {
  const [statusFiltro, setStatusFiltro] = useState<'' | StatusCotacao>('');
  const [vinculoFiltro, setVinculoFiltro] = useState<'' | 'com_pedido' | 'avulsa'>('');
  const [respostaFiltro, setRespostaFiltro] = useState<'' | 'todos' | 'algum' | 'nenhum'>('');
  const [prazoFiltro, setPrazoFiltro] = useState<'' | 'vence_3d' | 'vencida'>('');
  const [fornecedoresFiltro, setFornecedoresFiltro] = useState<string[]>([]);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState<Cotacao | null>(null);

  // Tempo atual reativo (atualiza 1×/min) — usado pelo filtro de prazo
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const pedidosMap = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);

  // Lista de fornecedores que aparecem em alguma cotação (para o multi-check)
  const fornecedoresOptions = useMemo(() => {
    const set = new Set<string>();
    cotacoes.filter((c) => !c.deletadoEm).forEach((c) =>
      c.fornecedores.forEach((cf) => cf.fornecedorId && set.add(cf.fornecedorId))
    );
    return Array.from(set)
      .map((id) => ({ value: id, label: fornecedoresMap.get(id)?.nome ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cotacoes, fornecedoresMap]);

  const limparFiltros = () => {
    setStatusFiltro(''); setVinculoFiltro(''); setRespostaFiltro(''); setPrazoFiltro('');
    setFornecedoresFiltro([]); setDataDe(''); setDataAte('');
  };

  const filtrosAtivos =
    (statusFiltro ? 1 : 0) + (vinculoFiltro ? 1 : 0) + (respostaFiltro ? 1 : 0) +
    (prazoFiltro ? 1 : 0) + (fornecedoresFiltro.length > 0 ? 1 : 0) +
    (dataDe || dataAte ? 1 : 0);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cotacoes
      .filter((c) => !c.deletadoEm)
      .filter((c) => !statusFiltro || c.status === statusFiltro)
      .filter((c) => {
        if (!vinculoFiltro) return true;
        if (vinculoFiltro === 'com_pedido') return !!c.pedidoCompraId;
        return !c.pedidoCompraId; // 'avulsa'
      })
      .filter((c) => {
        if (!respostaFiltro || c.fornecedores.length === 0) return !respostaFiltro;
        const respondidos = c.fornecedores.filter((cf) => cf.respondido).length;
        if (respostaFiltro === 'todos') return respondidos === c.fornecedores.length;
        if (respostaFiltro === 'algum') return respondidos > 0;
        if (respostaFiltro === 'nenhum') return respondidos === 0;
        return true;
      })
      .filter((c) => {
        if (!prazoFiltro || !c.prazoRespostaAt) return !prazoFiltro;
        const t = new Date(c.prazoRespostaAt).getTime();
        if (prazoFiltro === 'vencida') return t < agora;
        if (prazoFiltro === 'vence_3d') return t >= agora && t - agora <= 3 * 24 * 60 * 60 * 1000;
        return true;
      })
      .filter((c) => fornecedoresFiltro.length === 0 ||
        c.fornecedores.some((cf) => fornecedoresFiltro.includes(cf.fornecedorId)))
      .filter((c) => dentroDoPeriodo(c.data, dataDe, dataAte))
      .filter((c) => {
        if (!q) return true;
        const ped = pedidosMap.get(c.pedidoCompraId);
        return (
          c.numero.toLowerCase().includes(q)
          || (c.descricao || '').toLowerCase().includes(q)
          || (c.descricaoLivre || '').toLowerCase().includes(q)
          || (ped?.numero || '').toLowerCase().includes(q)
          || c.fornecedores.some((cf) => fornecedoresMap.get(cf.fornecedorId)?.nome.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [cotacoes, busca, statusFiltro, vinculoFiltro, respostaFiltro, prazoFiltro,
       fornecedoresFiltro, dataDe, dataAte, fornecedoresMap, pedidosMap, agora]);

  return (
    <>
      <FiltrosBarra totalAtivos={filtrosAtivos} total={filtradas.length} onLimpar={limparFiltros}>
        <FilterPill
          label="Status"
          value={statusFiltro}
          onChange={(v) => setStatusFiltro(v as '' | StatusCotacao)}
          options={STATUS_OPTIONS}
        />
        <FilterPill
          label="Vínculo"
          value={vinculoFiltro}
          onChange={(v) => setVinculoFiltro(v as '' | 'com_pedido' | 'avulsa')}
          options={[
            { value: '', label: 'Todos' },
            { value: 'com_pedido', label: 'Com pedido' },
            { value: 'avulsa', label: 'Avulsas' },
          ]}
        />
        <FilterPill
          label="Respostas"
          value={respostaFiltro}
          onChange={(v) => setRespostaFiltro(v as '' | 'todos' | 'algum' | 'nenhum')}
          options={[
            { value: '', label: 'Todas' },
            { value: 'todos', label: 'Todos responderam' },
            { value: 'algum', label: 'Algum respondeu' },
            { value: 'nenhum', label: 'Ninguém respondeu' },
          ]}
        />
        <FilterPill
          label="Prazo"
          value={prazoFiltro}
          onChange={(v) => setPrazoFiltro(v as '' | 'vence_3d' | 'vencida')}
          options={[
            { value: '', label: 'Todos' },
            { value: 'vence_3d', label: 'Vence em 3 dias' },
            { value: 'vencida', label: 'Já vencidas' },
          ]}
        />
        <FilterMultiCheck
          label="Fornecedores"
          selected={fornecedoresFiltro}
          onChange={setFornecedoresFiltro}
          options={fornecedoresOptions}
        />
        <FilterDateRange label="Período" de={dataDe} ate={dataAte} onChange={(d, a) => { setDataDe(d); setDataAte(a); }} />
      </FiltrosBarra>

      {filtradas.length === 0 ? (
        <EmptyState busca={busca} canCreate={canCreate} />
      ) : (
        <div className="hidden sm:block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)]/60 text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Número</th>
                <th className="px-4 py-3 text-left font-semibold">Data</th>
                <th className="px-4 py-3 text-left font-semibold">Pedido</th>
                <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                <th className="px-4 py-3 text-left font-semibold">Itens</th>
                <th className="px-4 py-3 text-left font-semibold">Fornecedores</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtradas.map((c) => {
                const respondidos = c.fornecedores.filter((cf) => cf.respondido).length;
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-[var(--color-surface-2)]/50 transition-colors cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button,a,[role="menu"]')) return;
                      onVerDetalhes?.(c);
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{c.numero}</td>
                    <td className="px-4 py-3 text-[var(--color-fg-muted)] whitespace-nowrap">{formatarData(c.data)}</td>
                    <td className="px-4 py-3">
                      {c.pedidoCompraId ? (
                        <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                          {pedidosMap.get(c.pedidoCompraId)?.numero ?? '—'}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-fg-subtle)] italic">avulsa</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="text-[var(--color-fg)] truncate">
                        {c.descricao || <span className="italic text-[var(--color-fg-subtle)]">sem descrição</span>}
                      </div>
                      {c.descricaoLivre && (
                        <div className="text-[10px] text-[var(--color-fg-subtle)] truncate mt-0.5">
                          {c.descricaoLivre}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
                        <Package className="w-3 h-3" /> {c.itensPedido.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Users className="w-3 h-3 text-[var(--color-fg-muted)]" />
                        <span className="text-[var(--color-fg)]">{c.fornecedores.length}</span>
                        {respondidos > 0 && (
                          <span className="text-[10px] text-emerald-600 ml-0.5">
                            ({respondidos} respondeu)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3"><BadgeStatusCompra status={c.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <IconButton title="Editar / Mapa comparativo" onClick={() => onEditar(c)}>
                            <FileEdit className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                        {canEdit && onReabrir && (c.status === 'cotado' || c.status === 'parcial') && (
                          <IconButton title="Reabrir cotação (voltar para Em cotação)" onClick={() => onReabrir(c)}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                        {c.fornecedores.length > 0 && (
                          <IconButton title="Enviar para fornecedores" onClick={() => onEnviar(c)}>
                            <MessageCircle className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                        <IconButton title="Histórico" onClick={() => setHistoricoAberto(c)}>
                          <History className="w-3.5 h-3.5" />
                        </IconButton>
                        {canEdit && (
                          <IconButton title="Excluir" onClick={() => onExcluir(c)} variant="danger">
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {historicoAberto && (
        <HistoricoCompras
          open={!!historicoAberto}
          onClose={() => setHistoricoAberto(null)}
          entidade="cotacao"
          entidadeId={historicoAberto.id}
          numero={historicoAberto.numero}
        />
      )}
    </>
  );
}

// (FilterPill antigo removido — agora vem de FiltrosCompras.tsx)

function IconButton({
  title, onClick, children, variant = 'default',
}: {
  title: string; onClick: () => void; children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  const cls = variant === 'danger'
    ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
    : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]';
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ busca, canCreate }: { busca: string; canCreate: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] py-14 text-center">
      <Inbox className="w-8 h-8 mx-auto text-[var(--color-fg-subtle)] mb-2" />
      <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
        {busca ? 'Nenhuma cotação encontrada' : 'Sem cotações ainda'}
      </h3>
      <p className="text-xs text-[var(--color-fg-muted)] max-w-sm mx-auto">
        {busca
          ? 'Ajuste a busca ou os filtros.'
          : canCreate
            ? 'Clique em "Nova Cotação" no topo da página, ou envie um pedido aprovado para cotação.'
            : 'Quando alguém criar uma cotação, ela aparecerá aqui.'}
      </p>
    </div>
  );
}
