/**
 * OrdemCompraListV2 — lista premium de OCs com:
 *   - Filtros (status, destino, mês, fornecedor)
 *   - Badges de status (incluindo lançamento financeiro pendente)
 *   - Ações inline: Editar · Aprovar (se pendente e tem permissão) ·
 *     Gerar lançamento (se aprovada e financeiro pendente) · PDF · Histórico · Excluir
 */
import { useMemo, useState } from 'react';
import {
  FileEdit, CheckCircle2, Banknote, FileDown, History, Trash2, Inbox,
  Building2, Warehouse, Briefcase, Wrench,
} from 'lucide-react';
import type {
  OrdemCompra, Obra, EtapaObra, Fornecedor, TipoDestinoOC, StatusOrdemCompra, StatusLancamentoFinanceiro,
} from '../../types';
import BadgeStatusCompra from './BadgeStatusCompra';
import HistoricoCompras from './HistoricoCompras';
import { useAuth } from '../../contexts/AuthContext';
import { gerarPdfOrdemCompra } from '../../utils/comprasPdf';
import {
  FiltrosBarra, FilterPill, FilterDateRange, FilterValueRange, FilterMultiCheck,
} from './FiltrosCompras';
import { dentroDoPeriodo } from '../../utils/comprasFiltros';

interface Props {
  ordens: OrdemCompra[];
  obras: Obra[];
  etapas: EtapaObra[];
  fornecedores: Fornecedor[];
  busca: string;
  onEditar: (oc: OrdemCompra) => void;
  onAprovar: (oc: OrdemCompra) => void;
  onGerarLancamento: (oc: OrdemCompra) => void;
  onExcluir: (oc: OrdemCompra) => void;
  canEdit: boolean;
  canCreate: boolean;
}

const DESTINO_LABEL: Record<TipoDestinoOC, { label: string; Icon: typeof Building2 }> = {
  obra_etapa:             { label: 'Obra/Etapa',     Icon: Building2 },
  obra_deposito:          { label: 'Obra/Depósito',  Icon: Warehouse },
  deposito_central:       { label: 'Dep. Central',   Icon: Warehouse },
  sede:                   { label: 'Sede',           Icon: Briefcase },
  manutencao_equipamento: { label: 'Manutenção',     Icon: Wrench },
};

const STATUS_OPTIONS: { value: '' | StatusOrdemCompra; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'emitida', label: 'Emitidas (aguard. aprovação)' },
  { value: 'aprovada', label: 'Aprovadas' },
  { value: 'entregue', label: 'Entregues' },
  { value: 'recebida', label: 'Recebidas' },
  { value: 'cancelada', label: 'Canceladas' },
];

function formatarData(s: string): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OrdemCompraListV2({
  ordens, obras, etapas: _etapas, fornecedores, busca,
  onEditar, onAprovar, onGerarLancamento, onExcluir, canEdit, canCreate,
}: Props) {
  void _etapas;
  const { temAcao } = useAuth();
  const podeAprovar = temAcao('aprovar_ordem_compra');

  const [statusFiltro, setStatusFiltro] = useState<'' | StatusOrdemCompra>('');
  const [destinoFiltro, setDestinoFiltro] = useState<'' | TipoDestinoOC>('');
  const [aprovacaoFiltro, setAprovacaoFiltro] = useState<'' | 'aprovada' | 'pendente_aprovacao'>('');
  const [financeiroFiltro, setFinanceiroFiltro] = useState<'' | StatusLancamentoFinanceiro>('');
  const [obrasFiltro, setObrasFiltro] = useState<string[]>([]);
  const [fornecedoresFiltro, setFornecedoresFiltro] = useState<string[]>([]);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState<OrdemCompra | null>(null);

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);

  // Opções de obras/fornecedores que aparecem em alguma OC
  const obrasOptions = useMemo(() => {
    const set = new Set<string>();
    ordens.filter((o) => !o.deletadoEm).forEach((o) => o.obraId && set.add(o.obraId));
    return Array.from(set)
      .map((id) => ({ value: id, label: obrasMap.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ordens, obrasMap]);
  const fornecedoresOptions = useMemo(() => {
    const set = new Set<string>();
    ordens.filter((o) => !o.deletadoEm).forEach((o) => o.fornecedorId && set.add(o.fornecedorId));
    return Array.from(set)
      .map((id) => ({ value: id, label: fornecedoresMap.get(id)?.nome ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ordens, fornecedoresMap]);

  const limparFiltros = () => {
    setStatusFiltro(''); setDestinoFiltro(''); setAprovacaoFiltro(''); setFinanceiroFiltro('');
    setObrasFiltro([]); setFornecedoresFiltro([]);
    setDataDe(''); setDataAte(''); setValorMin(''); setValorMax('');
  };

  const filtrosAtivos =
    (statusFiltro ? 1 : 0) + (destinoFiltro ? 1 : 0) + (aprovacaoFiltro ? 1 : 0) +
    (financeiroFiltro ? 1 : 0) + (obrasFiltro.length > 0 ? 1 : 0) +
    (fornecedoresFiltro.length > 0 ? 1 : 0) +
    (dataDe || dataAte ? 1 : 0) + (valorMin || valorMax ? 1 : 0);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const min = valorMin ? Number(valorMin) : undefined;
    const max = valorMax ? Number(valorMax) : undefined;
    return ordens
      .filter((o) => !o.deletadoEm)
      .filter((o) => !statusFiltro || o.status === statusFiltro)
      .filter((o) => !destinoFiltro || o.tipoDestino === destinoFiltro)
      .filter((o) => {
        if (!aprovacaoFiltro) return true;
        if (aprovacaoFiltro === 'aprovada') return o.aprovada;
        return !o.aprovada;
      })
      .filter((o) => !financeiroFiltro || (o.lancamentoFinanceiroStatus ?? 'nao_aplicavel') === financeiroFiltro)
      .filter((o) => obrasFiltro.length === 0 || obrasFiltro.includes(o.obraId))
      .filter((o) => fornecedoresFiltro.length === 0 || fornecedoresFiltro.includes(o.fornecedorId))
      .filter((o) => dentroDoPeriodo(o.dataCriacao, dataDe, dataAte))
      .filter((o) => {
        if (min === undefined && max === undefined) return true;
        if (min !== undefined && o.totalGeral < min) return false;
        if (max !== undefined && o.totalGeral > max) return false;
        return true;
      })
      .filter((o) => {
        if (!q) return true;
        return (
          o.numero.toLowerCase().includes(q)
          || (fornecedoresMap.get(o.fornecedorId)?.nome.toLowerCase().includes(q) ?? false)
          || (obrasMap.get(o.obraId)?.toLowerCase().includes(q) ?? false)
          || (o.observacoes || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.dataCriacao || '').localeCompare(a.dataCriacao || ''));
  }, [ordens, busca, statusFiltro, destinoFiltro, aprovacaoFiltro, financeiroFiltro,
       obrasFiltro, fornecedoresFiltro, dataDe, dataAte, valorMin, valorMax,
       fornecedoresMap, obrasMap]);

  const handlePdf = async (oc: OrdemCompra) => {
    const f = fornecedoresMap.get(oc.fornecedorId);
    const o = obras.find((x) => x.id === oc.obraId);
    await gerarPdfOrdemCompra(oc, f, o);
  };

  return (
    <>
      <FiltrosBarra totalAtivos={filtrosAtivos} total={filtradas.length} onLimpar={limparFiltros}>
        <FilterPill
          label="Status"
          value={statusFiltro}
          onChange={(v) => setStatusFiltro(v as '' | StatusOrdemCompra)}
          options={STATUS_OPTIONS}
        />
        <FilterPill
          label="Aprovação"
          value={aprovacaoFiltro}
          onChange={(v) => setAprovacaoFiltro(v as '' | 'aprovada' | 'pendente_aprovacao')}
          options={[
            { value: '', label: 'Todas' },
            { value: 'aprovada', label: 'Aprovadas' },
            { value: 'pendente_aprovacao', label: 'Aguard. aprovação' },
          ]}
        />
        <FilterPill
          label="Destino"
          value={destinoFiltro}
          onChange={(v) => setDestinoFiltro(v as '' | TipoDestinoOC)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'obra_etapa', label: 'Obra/Etapa' },
            { value: 'obra_deposito', label: 'Obra/Depósito' },
            { value: 'deposito_central', label: 'Dep. Central' },
            { value: 'sede', label: 'Sede' },
            { value: 'manutencao_equipamento', label: 'Manutenção' },
          ]}
        />
        <FilterPill
          label="Financeiro"
          value={financeiroFiltro}
          onChange={(v) => setFinanceiroFiltro(v as '' | StatusLancamentoFinanceiro)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'pendente', label: '🟠 Pendente' },
            { value: 'lancada', label: '✓ Lançada' },
            { value: 'nao_aplicavel', label: 'N/A' },
            { value: 'cancelada', label: 'Cancelada' },
          ]}
        />
        <FilterMultiCheck label="Obra" selected={obrasFiltro} onChange={setObrasFiltro} options={obrasOptions} />
        <FilterMultiCheck label="Fornecedores" selected={fornecedoresFiltro} onChange={setFornecedoresFiltro} options={fornecedoresOptions} />
        <FilterDateRange label="Período" de={dataDe} ate={dataAte} onChange={(d, a) => { setDataDe(d); setDataAte(a); }} />
        <FilterValueRange label="Valor total" min={valorMin} max={valorMax} onChange={(mn, mx) => { setValorMin(mn); setValorMax(mx); }} />
      </FiltrosBarra>

      {filtradas.length === 0 ? (
        <EmptyState busca={busca} canCreate={canCreate} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xs)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Número</th>
                <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                <th className="px-4 py-2.5 text-left font-semibold">Fornecedor</th>
                <th className="px-4 py-2.5 text-left font-semibold">Destino</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtradas.map((oc) => {
                const fornecedor = fornecedoresMap.get(oc.fornecedorId);
                const destinoInfo = oc.tipoDestino ? DESTINO_LABEL[oc.tipoDestino] : null;
                const DestIcon = destinoInfo?.Icon;
                const lancFin = oc.lancamentoFinanceiroStatus ?? 'nao_aplicavel';
                return (
                  <tr key={oc.id} className="hover:bg-[var(--color-surface-2)]/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{oc.numero}</td>
                    <td className="px-4 py-3 text-[var(--color-fg-muted)] whitespace-nowrap">{formatarData(oc.dataCriacao)}</td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--color-fg)] truncate max-w-[200px]">{fornecedor?.nome ?? '—'}</div>
                      {oc.empresaFaturamento && (
                        <div className="text-[10px] text-[var(--color-fg-subtle)]">Fat: {oc.empresaFaturamento}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {destinoInfo ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          {DestIcon && <DestIcon className="w-3.5 h-3.5 text-[var(--color-fg-muted)]" />}
                          <span className="text-[var(--color-fg)]">{destinoInfo.label}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-fg-subtle)] italic">não definido</span>
                      )}
                      {oc.obraId && (
                        <div className="text-[10px] text-[var(--color-fg-subtle)] truncate max-w-[140px]">
                          {obrasMap.get(oc.obraId)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-fg)] whitespace-nowrap font-medium">
                      {fmtMoeda(oc.totalGeral)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <BadgeStatusCompra status={oc.status} />
                        {lancFin === 'pendente' && (
                          <span className="inline-flex items-center gap-1 px-2 h-5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300">
                            🟠 Aguard. financeiro
                          </span>
                        )}
                        {lancFin === 'lancada' && (
                          <span className="inline-flex items-center gap-1 px-2 h-5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300">
                            ✓ Financeiro lançado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Aprovar OC: só pra quem tem permissão e a OC ainda não foi aprovada */}
                        {podeAprovar && !oc.aprovada && (
                          <IconButton title="Aprovar OC" onClick={() => onAprovar(oc)} variant="success">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                        {/* Gerar lançamento financeiro: só quando aprovada e pendente */}
                        {oc.aprovada && lancFin === 'pendente' && (
                          <IconButton title="Gerar lançamento financeiro" onClick={() => onGerarLancamento(oc)} variant="warning">
                            <Banknote className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                        <IconButton title="PDF" onClick={() => handlePdf(oc)}>
                          <FileDown className="w-3.5 h-3.5" />
                        </IconButton>
                        {canEdit && (
                          <IconButton title="Editar" onClick={() => onEditar(oc)}>
                            <FileEdit className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                        <IconButton title="Histórico" onClick={() => setHistoricoAberto(oc)}>
                          <History className="w-3.5 h-3.5" />
                        </IconButton>
                        {canEdit && !oc.entradaGerada && lancFin !== 'lancada' && (
                          <IconButton title="Excluir" onClick={() => onExcluir(oc)} variant="danger">
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
          entidade="oc"
          entidadeId={historicoAberto.id}
          numero={historicoAberto.numero}
        />
      )}
    </>
  );
}

// ─── auxiliares ──────────────────────────────────────────────────────────

// (FilterPill antigo removido — agora vem de FiltrosCompras.tsx)

function IconButton({
  title, onClick, children, variant = 'default',
}: {
  title: string; onClick: () => void; children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const cls = {
    default: 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]',
    success: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
    warning: 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40',
    danger:  'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40',
  }[variant];
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
        {busca ? 'Nenhuma OC encontrada' : 'Sem ordens de compra ainda'}
      </h3>
      <p className="text-xs text-[var(--color-fg-muted)] max-w-sm mx-auto">
        {busca
          ? 'Ajuste a busca ou os filtros.'
          : canCreate
            ? 'Crie uma OC direto, ou gere a partir de uma cotação aprovada.'
            : 'Quando alguém criar uma OC, ela aparecerá aqui.'}
      </p>
    </div>
  );
}
