/**
 * DepositoDetalheModal — visão detalhada de um depósito de material.
 *
 * Estrutura:
 *  - Header: nome + chips (tipo, ativo, central) + botões de ação
 *  - Tabs: Saldo (insumos com qtd e valor) | Movimentações (timeline)
 *  - 4 botões no header: Nova entrada · Nova saída · Nova transferência · Editar
 *
 * Os formulários de entrada/saída/transferência são despachados via callbacks
 * (callers controlam o modal correspondente — vão ser construídos na Fase D3/D4).
 */
import { useMemo, useState } from 'react';
import {
  Plus, Minus, ArrowRightLeft, FileEdit, Package, Clock, MapPin, User,
  AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Trash2,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useSaldosDeposito } from '../../hooks/useDepositosObras';
import { useEntradasMaterial } from '../../hooks/useEntradasMaterial';
import { useSaidasMaterial } from '../../hooks/useSaidasMaterial';
import { useTransferenciasMaterial } from '../../hooks/useTransferenciasMaterial';
import type {
  DepositoMaterial, EntradaMaterial, SaidaMaterial, TransferenciaMaterial,
  Insumo, Obra, Fornecedor,
} from '../../types';

interface Props {
  open: boolean;
  deposito: DepositoMaterial | null;
  obras: Obra[];
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  onClose: () => void;
  onEditar: (d: DepositoMaterial) => void;
  onExcluir?: (d: DepositoMaterial) => void;
  onNovaEntrada: (d: DepositoMaterial) => void;
  onNovaSaida: (d: DepositoMaterial) => void;
  onNovaTransferencia: (d: DepositoMaterial) => void;
  canEdit: boolean;
  canDelete?: boolean;
  canEntrada: boolean;
  canSaida: boolean;
  canTransferencia: boolean;
}

type Tab = 'saldo' | 'movs';

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtNum(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function fmtDataHora(s: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return s; }
}

export default function DepositoDetalheModal({
  open, deposito, obras, insumos, fornecedores,
  onClose, onEditar, onExcluir, onNovaEntrada, onNovaSaida, onNovaTransferencia,
  canEdit, canDelete = false, canEntrada, canSaida, canTransferencia,
}: Props) {
  const { temAcao } = useAuth();
  const podeVerSaldos = temAcao('ver_saldos');
  const [tab, setTab] = useState<Tab>('saldo');

  const depositoId = deposito?.id || '';
  const { data: saldos = [], isLoading: loadingSaldos } = useSaldosDeposito(depositoId);
  const { data: entradas = [] } = useEntradasMaterial();
  const { data: saidas = [] } = useSaidasMaterial();
  const { data: transferencias = [] } = useTransferenciasMaterial();

  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);

  if (!deposito) return null;

  const obrasVinculadas = (deposito.obrasIds ?? []).map((id) => obrasMap.get(id)).filter(Boolean) as string[];
  const ehAvulso = obrasVinculadas.length === 0;

  return (
    <Modal open={open} onClose={onClose} title={deposito.nome} size="xl">
      <div className="space-y-5">
        {/* Cabeçalho com info do depósito */}
        <header className="flex items-start justify-between gap-3 flex-wrap pb-4 border-b border-[var(--color-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {!deposito.ativo && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  inativo
                </span>
              )}
              {ehAvulso && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
                  central / avulso
                </span>
              )}
              {obrasVinculadas.map((nome) => (
                <span key={nome} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] border border-[var(--color-border)] truncate max-w-[160px]">
                  {nome}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--color-fg-muted)]">
              {deposito.responsavel && (
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {deposito.responsavel}</span>
              )}
              {deposito.endereco && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {deposito.endereco}</span>
              )}
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-wrap items-center gap-2">
            {canEntrada && (
              <Button size="sm" variant="secondary" onClick={() => onNovaEntrada(deposito)}>
                <Plus className="w-3.5 h-3.5" /> Entrada
              </Button>
            )}
            {canSaida && (
              <Button size="sm" variant="secondary" onClick={() => onNovaSaida(deposito)}>
                <Minus className="w-3.5 h-3.5" /> Saída
              </Button>
            )}
            {canTransferencia && (
              <Button size="sm" variant="secondary" onClick={() => onNovaTransferencia(deposito)}>
                <ArrowRightLeft className="w-3.5 h-3.5" /> Transferência
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEditar(deposito)}>
                <FileEdit className="w-3.5 h-3.5" /> Editar
              </Button>
            )}
            {canDelete && onExcluir && (
              <Button size="sm" variant="ghost" onClick={() => onExcluir(deposito)}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            )}
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-1 w-fit">
          <TabButton ativo={tab === 'saldo'} onClick={() => setTab('saldo')} label="Saldo" />
          <TabButton ativo={tab === 'movs'} onClick={() => setTab('movs')} label="Movimentações" />
        </div>

        {/* Conteúdo */}
        {tab === 'saldo' && podeVerSaldos && (
          <AbaSaldo
            saldos={saldos}
            insumosMap={insumosMap}
            loading={loadingSaldos}
          />
        )}
        {tab === 'saldo' && !podeVerSaldos && (
          <div className="text-center py-12 text-sm text-[var(--color-fg-muted)]">
            Você não tem permissão pra ver saldos deste depósito.
          </div>
        )}
        {tab === 'movs' && (
          <AbaMovimentacoes
            depositoId={depositoId}
            entradas={entradas}
            saidas={saidas}
            transferencias={transferencias}
            insumosMap={insumosMap}
            fornecedoresMap={fornecedoresMap}
          />
        )}
      </div>
    </Modal>
  );
}

// ─── auxiliares ──────────────────────────────────────────────────────────

function TabButton({ ativo, onClick, label }: { ativo: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' +
        (ativo
          ? 'bg-[var(--color-surface-1)] text-[var(--color-fg)] shadow-[var(--shadow-xs)]'
          : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
      }
    >
      {label}
    </button>
  );
}

// ─── Aba Saldo ───────────────────────────────────────────────────────────
function AbaSaldo({
  saldos, insumosMap, loading,
}: {
  saldos: { insumoId: string; saldo: number; valorTotalEntradas: number; ultimaMovimentacao?: string }[];
  insumosMap: Map<string, Insumo>;
  loading: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [mostraZerados, setMostraZerados] = useState(false);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return saldos
      .map((s) => ({
        ...s,
        insumo: insumosMap.get(s.insumoId),
      }))
      .filter((r) => mostraZerados || r.saldo > 0)
      .filter((r) => !q || (r.insumo?.nome.toLowerCase().includes(q) ?? false))
      .sort((a, b) => (a.insumo?.nome ?? '').localeCompare(b.insumo?.nome ?? ''));
  }, [saldos, insumosMap, busca, mostraZerados]);

  const totais = useMemo(() => ({
    qtdInsumos: linhas.filter((r) => r.saldo > 0).length,
    valorTotal: linhas.reduce((s, r) => s + r.valorTotalEntradas, 0),
    abaixoMin: linhas.filter((r) => r.insumo?.estoqueMinimo != null && r.saldo < (r.insumo.estoqueMinimo ?? 0)).length,
  }), [linhas]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* KPIs em linha */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Kpi label="Insumos com saldo" value={totais.qtdInsumos.toString()} />
        <Kpi label="Valor estimado" value={fmtMoeda(totais.valorTotal)} />
        <Kpi label="Abaixo do mínimo" value={totais.abaixoMin.toString()} accent={totais.abaixoMin > 0 ? 'amber' : 'slate'} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar insumos…"
          className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] flex-1 min-w-[200px]"
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={mostraZerados}
            onChange={(e) => setMostraZerados(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Incluir zerados
        </label>
      </div>

      {/* Tabela de saldos */}
      {linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
          <Package className="w-8 h-8 mx-auto text-[var(--color-fg-subtle)] mb-2 opacity-60" />
          <p className="text-sm text-[var(--color-fg-muted)]">
            {busca ? 'Nenhum insumo combina com o filtro.' : 'Sem saldo neste depósito.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Insumo</th>
                <th className="px-3 py-2 text-right font-semibold w-24">Saldo</th>
                <th className="px-3 py-2 text-left font-semibold w-16">Un</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Valor</th>
                <th className="px-3 py-2 text-left font-semibold w-32">Status</th>
                <th className="px-3 py-2 text-left font-semibold w-32">Última mov.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {linhas.map((r) => {
                const min = r.insumo?.estoqueMinimo;
                const max = r.insumo?.estoqueMaximo;
                const abaixoMin = min != null && r.saldo < min;
                const acimaMax = max != null && r.saldo > max;
                return (
                  <tr key={r.insumoId} className={'hover:bg-[var(--color-surface-2)]/50 ' + (abaixoMin ? 'bg-amber-50/30 dark:bg-amber-950/10' : '')}>
                    <td className="px-3 py-2 text-[var(--color-fg)]">
                      {r.insumo?.nome ?? r.insumoId}
                    </td>
                    <td className={'px-3 py-2 text-right tabular-nums font-semibold ' + (r.saldo === 0 ? 'text-[var(--color-fg-subtle)]' : 'text-[var(--color-fg)]')}>
                      {fmtNum(r.saldo)}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-fg-muted)]">{r.insumo?.unidade ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-[var(--color-fg-muted)]">{fmtMoeda(r.valorTotalEntradas)}</td>
                    <td className="px-3 py-2">
                      {abaixoMin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-2.5 h-2.5" /> abaixo mín ({fmtNum(min!)})
                        </span>
                      ) : acimaMax ? (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          acima máx ({fmtNum(max!)})
                        </span>
                      ) : min != null || max != null ? (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ok
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-fg-subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-[var(--color-fg-subtle)]">
                      {r.ultimaMovimentacao ? fmtDataHora(r.ultimaMovimentacao) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Aba Movimentações ───────────────────────────────────────────────────
type Mov =
  | { kind: 'entrada'; mov: EntradaMaterial; data: string }
  | { kind: 'saida'; mov: SaidaMaterial; data: string }
  | { kind: 'transf_in'; mov: TransferenciaMaterial; data: string }
  | { kind: 'transf_out'; mov: TransferenciaMaterial; data: string };

function AbaMovimentacoes({
  depositoId, entradas, saidas, transferencias, insumosMap, fornecedoresMap,
}: {
  depositoId: string;
  entradas: EntradaMaterial[];
  saidas: SaidaMaterial[];
  transferencias: TransferenciaMaterial[];
  insumosMap: Map<string, Insumo>;
  fornecedoresMap: Map<string, string>;
}) {
  const [filtro, setFiltro] = useState<'todas' | 'entradas' | 'saidas' | 'transf'>('todas');
  const [limit, setLimit] = useState(50);

  const movs = useMemo<Mov[]>(() => {
    const list: Mov[] = [];
    for (const e of entradas) {
      if (e.depositoMaterialId !== depositoId || e.deletadoEm) continue;
      list.push({ kind: 'entrada', mov: e, data: e.dataHora });
    }
    for (const s of saidas) {
      if (s.depositoMaterialId !== depositoId || s.deletadoEm) continue;
      list.push({ kind: 'saida', mov: s, data: s.dataHora });
    }
    for (const t of transferencias) {
      if (t.deletadoEm) continue;
      if (t.depositoOrigemId === depositoId) list.push({ kind: 'transf_out', mov: t, data: t.dataHora });
      if (t.depositoDestinoId === depositoId) list.push({ kind: 'transf_in', mov: t, data: t.dataHora });
    }
    return list
      .filter((m) => {
        if (filtro === 'todas') return true;
        if (filtro === 'entradas') return m.kind === 'entrada';
        if (filtro === 'saidas') return m.kind === 'saida';
        return m.kind === 'transf_in' || m.kind === 'transf_out';
      })
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [depositoId, entradas, saidas, transferencias, filtro]);

  const visiveis = movs.slice(0, limit);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <FilterTab ativo={filtro === 'todas'} onClick={() => setFiltro('todas')} label="Todas" count={movs.length} />
        <FilterTab ativo={filtro === 'entradas'} onClick={() => setFiltro('entradas')} label="Entradas" />
        <FilterTab ativo={filtro === 'saidas'} onClick={() => setFiltro('saidas')} label="Saídas" />
        <FilterTab ativo={filtro === 'transf'} onClick={() => setFiltro('transf')} label="Transferências" />
      </div>

      {movs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
          <Clock className="w-8 h-8 mx-auto text-[var(--color-fg-subtle)] mb-2 opacity-60" />
          <p className="text-sm text-[var(--color-fg-muted)]">Sem movimentações ainda neste depósito.</p>
        </div>
      ) : (
        <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-3 pl-6">
          {visiveis.map((m, idx) => (
            <MovimentacaoItem key={`${m.kind}-${m.mov.id}-${idx}`} mov={m} insumosMap={insumosMap} fornecedoresMap={fornecedoresMap} />
          ))}
          {movs.length > limit && (
            <li className="text-center pt-2">
              <button
                type="button"
                onClick={() => setLimit(limit + 50)}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                <ChevronDown className="w-3 h-3" /> Carregar mais ({movs.length - limit} restantes)
              </button>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

function FilterTab({ ativo, onClick, label, count }: { ativo: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-2.5 h-7 rounded-md text-xs font-medium border transition-colors ' +
        (ativo
          ? 'bg-[var(--color-accent)]/10 text-[var(--color-fg)] border-[var(--color-accent)]/30'
          : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]')
      }
    >
      {label}{count !== undefined && <span className="ml-1 opacity-60">({count})</span>}
    </button>
  );
}

function MovimentacaoItem({
  mov, insumosMap, fornecedoresMap,
}: {
  mov: Mov;
  insumosMap: Map<string, Insumo>;
  fornecedoresMap: Map<string, string>;
}) {
  const info = useMemo(() => {
    if (mov.kind === 'entrada') {
      const e = mov.mov;
      return {
        Icon: ArrowDown,
        cor: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200',
        titulo: 'Entrada',
        insumoId: e.insumoId,
        qtd: e.quantidade,
        valor: e.valorTotal,
        detalhe: e.fornecedorId ? `de ${fornecedoresMap.get(e.fornecedorId) ?? 'fornecedor'}` : '',
        nf: e.notaFiscal,
        obs: e.observacoes,
        autor: e.criadoPor,
      };
    }
    if (mov.kind === 'saida') {
      const s = mov.mov;
      const ehPerda = s.tipoSaida === 'perda';
      return {
        Icon: ArrowUp,
        cor: ehPerda
          ? 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200'
          : 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200',
        titulo: ehPerda ? `Perda${s.motivoPerda ? ` (${s.motivoPerda})` : ''}` : 'Saída (consumo)',
        insumoId: s.insumoId,
        qtd: -s.quantidade,
        valor: s.valorTotal,
        detalhe: s.alocacoes?.length ? `${s.alocacoes.length} etapa(s)` : '',
        obs: s.observacoes,
        autor: s.criadoPor,
      };
    }
    const t = mov.mov;
    if (mov.kind === 'transf_out') {
      return {
        Icon: ArrowRightLeft,
        cor: 'text-violet-700 bg-violet-50 dark:bg-violet-950/40 border-violet-200',
        titulo: 'Transferência (saída)',
        insumoId: t.insumoId,
        qtd: -t.quantidade,
        valor: t.valorTotal,
        detalhe: '→ outro depósito',
        obs: t.observacoes,
        autor: t.criadoPor,
      };
    }
    return {
      Icon: ArrowRightLeft,
      cor: 'text-violet-700 bg-violet-50 dark:bg-violet-950/40 border-violet-200',
      titulo: 'Transferência (entrada)',
      insumoId: t.insumoId,
      qtd: t.quantidade,
      valor: t.valorTotal,
      detalhe: '← outro depósito',
      obs: t.observacoes,
      autor: t.criadoPor,
    };
  }, [mov, fornecedoresMap]);

  const Icon = info.Icon;
  const insumo = insumosMap.get(info.insumoId);

  return (
    <li className="relative">
      <span className={`absolute -left-[33px] top-0 w-6 h-6 rounded-full inline-flex items-center justify-center border ${info.cor}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="text-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-medium text-[var(--color-fg)]">
            {info.titulo}
            <span className="ml-1.5 text-[var(--color-fg-muted)] font-normal">·</span>
            <span className="ml-1.5 font-normal">{insumo?.nome ?? info.insumoId}</span>
          </div>
          <span className={'text-sm font-semibold tabular-nums ' + (info.qtd >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
            {info.qtd >= 0 ? '+' : ''}{fmtNum(info.qtd)} {insumo?.unidade ?? ''}
          </span>
        </div>
        <div className="text-xs text-[var(--color-fg-subtle)] mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{fmtDataHora(mov.data)}</span>
          {info.autor && <><span>·</span><span>por {info.autor}</span></>}
          {info.detalhe && <><span>·</span><span>{info.detalhe}</span></>}
          {info.valor > 0 && <><span>·</span><span>{fmtMoeda(info.valor)}</span></>}
          {'nf' in info && info.nf && <><span>·</span><span>NF {info.nf}</span></>}
        </div>
        {info.obs && (
          <div className="text-xs text-[var(--color-fg-muted)] mt-1 italic border-l-2 border-[var(--color-border)] pl-2">
            {info.obs}
          </div>
        )}
      </div>
    </li>
  );
}

function Kpi({ label, value, accent = 'slate' }: { label: string; value: string; accent?: 'slate' | 'amber' }) {
  const cores = accent === 'amber'
    ? 'border-amber-200 bg-amber-50/40 dark:bg-amber-950/20'
    : 'border-[var(--color-border)] bg-[var(--color-surface-1)]';
  return (
    <div className={`rounded-lg border ${cores} p-3`}>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">{label}</div>
      <div className="text-lg font-bold text-[var(--color-fg)] tabular-nums">{value}</div>
    </div>
  );
}
