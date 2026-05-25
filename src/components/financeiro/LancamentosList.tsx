/**
 * LancamentosList — Lista de lançamentos financeiros com filtros e ações
 * por linha (Editar, Fechar/Reabrir, Excluir).
 *
 * Props.modo controla o filtro inicial:
 *   - 'todos'        → todos os status
 *   - 'contas_pagar' → só em_aberto / pago_parcial (filtro pré-aplicado)
 *
 * Onda 3.D — desktop table migrou pra ui/DataTable. Filtros customizados
 * + banner contas_pagar + totalização + dialog de exclusão preservados.
 *
 * Regressão conhecida: linhas vencidas perdem o tint rosa de fundo
 * (DataTable não suporta className por row hoje). Indicador de vencimento
 * fica na coluna Vencimento via "X dias vencido" texto. Polish em Onda 8.
 */
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Trash2, Wallet, Calendar, Search, AlertCircle, Pencil, Lock, Unlock,
  Paperclip, Building2, Tag, CreditCard, Layers, MapPin,
} from 'lucide-react';
import type {
  LancamentoFinanceiro,
  StatusLancamento,
  FormaPagamentoLancamento,
  TipoDestinoRateio,
  Fornecedor,
  CategoriaFinanceira,
  Empresa,
} from '../../types';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import DataTable from '../ui/DataTable';
import { useToast } from '../ui/Toast';
import {
  useExcluirLancamentoFinanceiro,
  useFecharLancamentoFinanceiro,
  useReabrirLancamentoFinanceiro,
} from '../../hooks/useLancamentosFinanceiros';
import { useAuth } from '../../contexts/AuthContext';
import { dentroDoPeriodo } from '../../utils/comprasFiltros';

interface Props {
  lancamentos: LancamentoFinanceiro[];
  fornecedores: Fornecedor[];
  empresas: Empresa[];
  categorias: CategoriaFinanceira[];
  modo: 'todos' | 'contas_pagar';
  onEditar?: (l: LancamentoFinanceiro) => void;
  onVerDetalhes?: (l: LancamentoFinanceiro) => void;
}

// Chips e cores hardcoded por enquanto (visual deliberado, Onda 8 polish).
const STATUS_LABEL: Record<StatusLancamento, { label: string; cls: string }> = {
  em_aberto:    { label: 'Em aberto',    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
  pago_parcial: { label: 'Parcial',      cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200' },
  pago:         { label: 'Pago',         cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  cancelado:    { label: 'Cancelado',    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const ORIGEM_LABEL: Record<string, { label: string; cls: string }> = {
  oc:     { label: 'OC',     cls: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200' },
  avulso: { label: 'Avulso', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  folha:  { label: 'Folha',  cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' },
  frete:  { label: 'Frete',  cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200' },
};

const FORMA_PAGTO_LABEL: Record<string, string> = {
  pix: 'PIX', boleto: 'Boleto', transferencia: 'Transf.', dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Cr.', cartao_debito: 'Cartão Db.', cheque: 'Cheque',
  deposito: 'Depósito', outros: 'Outros',
};

const TIPO_DESTINO_SHORT: Record<TipoDestinoRateio, string> = {
  obra_etapa: 'Obra', obra_deposito: 'Obra',
  deposito_central: 'Almox.', sede: 'Sede',
  manutencao_equipamento: 'Manut.', tanque_combustivel: 'Comb.',
};

const PAGE_SIZE_KEY = 'lancamentos-list-page-size';

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(s: string): string {
  if (!s) return '—';
  try { return new Date(s + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}
function diasAteVencimento(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataIso + 'T00:00');
  return Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function resumirDestinos(rateios: { tipoDestino: TipoDestinoRateio }[]): string[] {
  if (rateios.length === 0) return [];
  const counts: Partial<Record<string, number>> = {};
  for (const r of rateios) {
    const key = TIPO_DESTINO_SHORT[r.tipoDestino] ?? r.tipoDestino;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).map(([key, count]) =>
    (count ?? 1) > 1 ? `${count} ${key}` : key,
  );
}

export default function LancamentosList({
  lancamentos, fornecedores, empresas, categorias, modo, onEditar, onVerDetalhes,
}: Props) {
  const { showToast } = useToast();
  const { temAcao } = useAuth();
  const excluirMut = useExcluirLancamentoFinanceiro();
  const fecharMut = useFecharLancamentoFinanceiro();
  const reabrirMut = useReabrirLancamentoFinanceiro();
  const podeEditar = temAcao('editar_lancamento_financeiro');
  const podeFechar = temAcao('fechar_lancamento_financeiro');
  const podeReabrir = temAcao('reabrir_lancamento_financeiro');
  const podeExcluir = temAcao('excluir_lancamento_financeiro');

  // ── Filtros ─────────────────────────────────────────────────────────
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'' | StatusLancamento>(modo === 'contas_pagar' ? 'em_aberto' : '');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('');
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [periodoIni, setPeriodoIni] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');

  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const empresasMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const filtrados = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (modo === 'contas_pagar' && (l.status === 'pago' || l.status === 'cancelado')) return false;
      if (statusFiltro && l.status !== statusFiltro) return false;
      if (fornecedorFiltro && l.fornecedorId !== fornecedorFiltro) return false;
      if (empresaFiltro && l.empresaPagadoraId !== empresaFiltro) return false;
      if (categoriaFiltro && l.categoriaId !== categoriaFiltro) return false;
      if (periodoIni || periodoFim) {
        if (!dentroDoPeriodo(l.dataVencimento, periodoIni, periodoFim)) return false;
      }
      if (buscaLower) {
        const fornec = l.fornecedorId ? fornecedoresMap.get(l.fornecedorId)?.nome ?? '' : '';
        const hay = [l.numero, l.descricao, fornec, l.favorecidoNome ?? ''].join(' ').toLowerCase();
        if (!hay.includes(buscaLower)) return false;
      }
      return true;
    });
    // sort removido — DataTable cuida via defaultSorting (vencimento asc)
  }, [lancamentos, modo, statusFiltro, fornecedorFiltro, empresaFiltro, categoriaFiltro, periodoIni, periodoFim, busca, fornecedoresMap]);

  // ── Totais ──────────────────────────────────────────────────────────
  const totalFiltrado = filtrados.reduce((s, l) => s + l.valorTotal, 0);
  const totalPagoFiltrado = filtrados.reduce(
    (s, l) => s + l.parcelas.reduce((ss, p) => ss + (p.valorPago ?? 0), 0),
    0,
  );
  const totalEmAberto = totalFiltrado - totalPagoFiltrado;

  // ── Confirmação de exclusão ──────────────────────────────────────────
  const [excluirRef, setExcluirRef] = useState<LancamentoFinanceiro | null>(null);

  async function handleExcluirConfirm() {
    if (!excluirRef) return;
    try {
      await excluirMut.mutateAsync(excluirRef);
      showToast({ kind: 'success', message: `Lançamento ${excluirRef.numero} excluído.` });
      setExcluirRef(null);
    } catch (err) {
      showToast({ kind: 'error', message: err instanceof Error ? err.message : 'Erro ao excluir.' });
    }
  }

  const columns = useMemo<ColumnDef<LancamentoFinanceiro>[]>(() => [
    {
      id: 'numero',
      header: 'Nº',
      accessorKey: 'numero',
      size: 80,
      cell: ({ row }) => {
        const origem = ORIGEM_LABEL[row.original.origem] ?? ORIGEM_LABEL.avulso;
        return (
          <div className="align-top">
            <div className="font-mono text-xs text-[var(--color-fg)] leading-tight">{row.original.numero}</div>
            <span className={'inline-block mt-1 px-1.5 py-0.5 rounded text-3xs font-semibold uppercase tracking-wide ' + origem.cls}>
              {origem.label}
            </span>
          </div>
        );
      },
    },
    {
      id: 'descricao',
      header: 'Descrição / Fornecedor',
      enableSorting: false,
      accessorFn: (l) => l.descricao,
      cell: ({ row }) => {
        const l = row.original;
        const fornecedor = l.fornecedorId ? fornecedoresMap.get(l.fornecedorId) : undefined;
        const cat = l.categoriaId ? categoriasMap.get(l.categoriaId) : undefined;
        const empresa = l.empresaPagadoraId ? empresasMap.get(l.empresaPagadoraId) : undefined;
        const formaPagto = l.formaPagamento
          ? FORMA_PAGTO_LABEL[l.formaPagamento as FormaPagamentoLancamento] ?? l.formaPagamento
          : null;
        const destinos = resumirDestinos(l.rateios);
        const anexosCount = l.anexosUrls?.length ?? 0;
        return (
          <div className="min-w-0">
            <div className="text-sm text-[var(--color-fg)] truncate font-medium" title={l.descricao || undefined}>
              {l.descricao || '—'}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-fg-muted)] flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3 opacity-70" />
                {fornecedor?.nome ?? l.favorecidoNome ?? '—'}
              </span>
              {empresa && (
                <span className="inline-flex items-center gap-1">
                  <span className="opacity-50">·</span>
                  {empresa.nome}
                </span>
              )}
            </div>
            {(cat || formaPagto || destinos.length > 0 || anexosCount > 0) && (
              <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                {cat && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-3xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" title={`Categoria: ${cat.nome}`}>
                    <Tag className="w-2.5 h-2.5" />
                    {cat.nome}
                  </span>
                )}
                {formaPagto && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-3xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200" title="Forma de pagamento">
                    <CreditCard className="w-2.5 h-2.5" />
                    {formaPagto}
                  </span>
                )}
                {destinos.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-3xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" title="Destino do rateio">
                    <MapPin className="w-2.5 h-2.5" />
                    {d}
                  </span>
                ))}
                {anexosCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-3xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" title={`${anexosCount} anexo${anexosCount > 1 ? 's' : ''}`}>
                    <Paperclip className="w-2.5 h-2.5" />
                    {anexosCount}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'vencimento',
      header: 'Vencimento',
      accessorKey: 'dataVencimento',
      size: 140,
      cell: ({ row }) => {
        const l = row.original;
        const totalParcelas = l.parcelas.length;
        const proximaEmAberto = [...l.parcelas]
          .filter((p) => p.status === 'em_aberto')
          .sort((a, b) => (a.dataVencimento || '').localeCompare(b.dataVencimento || ''))[0];
        const dataReferencia = proximaEmAberto?.dataVencimento ?? l.dataVencimento;
        const venc = diasAteVencimento(dataReferencia);
        const vencido = l.status !== 'pago' && l.status !== 'cancelado' && venc < 0;
        return (
          <div className="text-xs align-top">
            <div className="text-[var(--color-fg)] font-medium">{fmtData(dataReferencia)}</div>
            {totalParcelas > 1 && proximaEmAberto && (
              <div className="text-3xs text-[var(--color-fg-muted)] flex items-center gap-1 mt-0.5">
                <Layers className="w-2.5 h-2.5" />
                Parc. {proximaEmAberto.numero} de {totalParcelas}
              </div>
            )}
            {vencido && (
              <div className="text-3xs font-medium text-[var(--color-danger)] dark:text-rose-400 mt-0.5">
                {Math.abs(venc)} dia{Math.abs(venc) === 1 ? '' : 's'} vencido
              </div>
            )}
            {!vencido && venc >= 0 && venc <= 7 && l.status !== 'pago' && l.status !== 'cancelado' && (
              <div className="text-3xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                {venc === 0 ? 'Vence hoje' : `Vence em ${venc} dia${venc === 1 ? '' : 's'}`}
              </div>
            )}
            {!vencido && venc > 7 && l.status !== 'pago' && l.status !== 'cancelado' && (
              <div className="text-3xs text-[var(--color-fg-subtle)] mt-0.5">em {venc} dias</div>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      size: 160,
      cell: ({ row }) => {
        const l = row.original;
        const totalParcelas = l.parcelas.length;
        const parcelasPagas = l.parcelas.filter((p) => p.status === 'pago').length;
        const pago = l.parcelas.reduce((s, p) => s + (p.valorPago ?? 0), 0);
        const pctPago = l.valorTotal > 0 ? Math.round((pago / l.valorTotal) * 100) : 0;
        return (
          <div className="flex flex-col gap-1 items-start align-top">
            <div className="flex items-center gap-1">
              <span className={'inline-block px-2 py-0.5 rounded text-2xs font-medium ' + STATUS_LABEL[l.status].cls}>
                {STATUS_LABEL[l.status].label}
              </span>
              {l.fechado && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-3xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  title={`Fechado em ${l.fechadoEm ? new Date(l.fechadoEm).toLocaleString('pt-BR') : ''}${l.fechadoPor ? ' por ' + l.fechadoPor : ''}`}
                >
                  <Lock className="w-2.5 h-2.5" /> Fechado
                </span>
              )}
            </div>
            {totalParcelas > 0 && (
              <div className="w-full max-w-[110px]">
                <div className="text-3xs text-[var(--color-fg-muted)] flex justify-between mb-0.5">
                  <span>{parcelasPagas}/{totalParcelas} pagas</span>
                  {pctPago > 0 && pctPago < 100 && <span className="tabular-nums">{pctPago}%</span>}
                </div>
                <div className="h-1 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className={'h-full rounded-full transition-all ' + (
                      pctPago >= 100 ? 'bg-emerald-500' :
                      pctPago > 0 ? 'bg-sky-500' :
                      'bg-transparent'
                    )}
                    style={{ width: `${pctPago}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'valor',
      header: 'Valor / Pago',
      accessorKey: 'valorTotal',
      size: 130,
      cell: ({ row }) => {
        const l = row.original;
        const pago = l.parcelas.reduce((s, p) => s + (p.valorPago ?? 0), 0);
        const emAberto = l.valorTotal - pago;
        return (
          <div className="text-right tabular-nums text-xs align-top">
            <div className="font-semibold text-[var(--color-fg)] text-sm">{fmtMoeda(l.valorTotal)}</div>
            {pago > 0 && (
              <div className="text-3xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                Pago: {fmtMoeda(pago)}
              </div>
            )}
            {emAberto > 0.01 && l.status !== 'cancelado' && (
              <div className="text-3xs text-amber-700 dark:text-amber-400">
                {pago > 0 ? 'Saldo: ' : ''}{fmtMoeda(emAberto)}
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
      size: 110,
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div className="text-right" onClick={(e) => e.stopPropagation()}>
            <div className="inline-flex items-center gap-0.5">
              {podeEditar && onEditar && !l.fechado && (
                <button
                  type="button"
                  onClick={() => onEditar(l)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                  title="Editar lançamento"
                  aria-label="Editar lançamento"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {podeFechar && !l.fechado && (
                <button
                  type="button"
                  onClick={async () => {
                    // TODO(Onda 7.C): substituir window.confirm por ConfirmDialog
                    if (!window.confirm(`Fechar lançamento ${l.numero}? Depois de fechado, valores, parcelas e rateio não podem mais ser editados. Pagamentos seguem permitidos.`)) return;
                    try {
                      await fecharMut.mutateAsync(l.id);
                      showToast({ kind: 'success', message: `Lançamento ${l.numero} fechado.` });
                    } catch (err) {
                      showToast({ kind: 'error', message: err instanceof Error ? err.message : 'Erro.' });
                    }
                  }}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-fg-muted)] hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/15"
                  title="Fechar lançamento (trava edição)"
                  aria-label="Fechar lançamento"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
              )}
              {podeReabrir && l.fechado && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Reabrir lançamento ${l.numero}? Edição volta a ficar liberada.`)) return;
                    try {
                      await reabrirMut.mutateAsync(l.id);
                      showToast({ kind: 'success', message: `Lançamento ${l.numero} reaberto.` });
                    } catch (err) {
                      showToast({ kind: 'error', message: err instanceof Error ? err.message : 'Erro.' });
                    }
                  }}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-success-fg)] hover:bg-[var(--color-success-soft)]"
                  title="Reabrir lançamento (destrava edição)"
                  aria-label="Reabrir lançamento"
                >
                  <Unlock className="w-3.5 h-3.5" />
                </button>
              )}
              {podeExcluir && !l.fechado && (
                <button
                  type="button"
                  onClick={() => setExcluirRef(l)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  title="Excluir lançamento"
                  aria-label="Excluir lançamento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      },
    },
  ], [fornecedoresMap, empresasMap, categoriasMap, podeEditar, podeFechar, podeReabrir, podeExcluir,
       onEditar, fecharMut, reabrirMut, showToast]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Banner do modo */}
      {modo === 'contas_pagar' && (
        <div className="px-3.5 py-2.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] text-xs text-amber-900 dark:text-amber-100 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-[1px] shrink-0" />
          <span>
            <strong>Contas a Pagar</strong> — só lançamentos em aberto ou parcialmente pagos.
            Para ver lançamentos já quitados ou cancelados, vá em <strong>Lançamentos</strong>.
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FilterField label="Buscar" icon={<Search className="w-3 h-3" />}>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nº, descrição, fornecedor…" className="h-9 text-sm" />
        </FilterField>
        {modo === 'todos' && (
          <FilterField label="Status">
            <SmartSelect
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as '' | StatusLancamento)}
              className="w-full h-9 px-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-left flex items-center"
            >
              <option value="">Todos</option>
              <option value="em_aberto">Em aberto</option>
              <option value="pago_parcial">Parcial</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </SmartSelect>
          </FilterField>
        )}
        <FilterField label="Fornecedor">
          <SmartSelect
            value={fornecedorFiltro}
            onChange={(e) => setFornecedorFiltro(e.target.value)}
            className="w-full h-9 px-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-left flex items-center"
          >
            <option value="">Todos</option>
            {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
          </SmartSelect>
        </FilterField>
        <FilterField label="Empresa">
          <SmartSelect
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="w-full h-9 px-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-left flex items-center"
          >
            <option value="">Todas</option>
            {empresas.map((e) => (<option key={e.id} value={e.id}>{e.nome}</option>))}
          </SmartSelect>
        </FilterField>
        <FilterField label="Categoria">
          <SmartSelect
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="w-full h-9 px-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-left flex items-center"
          >
            <option value="">Todas</option>
            {categorias.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </SmartSelect>
        </FilterField>
        <FilterField label="Vencimento de" icon={<Calendar className="w-3 h-3" />}>
          <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} className="h-9 text-sm" />
        </FilterField>
        <FilterField label="Até">
          <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="h-9 text-sm" />
        </FilterField>
      </div>

      {/* Totais */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-fg-muted)] px-1">
        <span>
          <strong className="text-[var(--color-fg)] font-semibold tabular-nums">{filtrados.length}</strong>{' '}
          {filtrados.length === 1 ? 'lançamento' : 'lançamentos'}
        </span>
        <span>Total: <strong className="text-[var(--color-fg)] font-semibold tabular-nums">{fmtMoeda(totalFiltrado)}</strong></span>
        <span>Pago: <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">{fmtMoeda(totalPagoFiltrado)}</strong></span>
        <span>Em aberto: <strong className="text-amber-700 dark:text-amber-400 tabular-nums">{fmtMoeda(totalEmAberto)}</strong></span>
      </div>

      <DataTable<LancamentoFinanceiro>
        columns={columns}
        data={filtrados}
        getRowId={(row) => row.id}
        persistPageSizeKey={PAGE_SIZE_KEY}
        defaultSorting={[{ id: 'vencimento', desc: false }]}
        onRowClick={onVerDetalhes}
        enableDensityToggle
        enableColumnVisibilityToggle
        itemLabel={{ singular: 'lançamento', plural: 'lançamentos' }}
        empty={{
          icon: Wallet,
          title: modo === 'contas_pagar' ? 'Nenhuma conta a pagar' : 'Nenhum lançamento encontrado',
          description: modo === 'contas_pagar'
            ? 'Quando houver lançamentos em aberto ou parciais, eles aparecerão aqui.'
            : 'Ajuste os filtros ou registre um novo lançamento financeiro.',
        }}
      />

      {/* Confirmação exclusão */}
      <ConfirmDialog
        open={excluirRef !== null}
        onClose={() => setExcluirRef(null)}
        title={`Excluir lançamento ${excluirRef?.numero ?? ''}`}
        message={
          excluirRef?.parcelas.some((p) => p.status === 'pago')
            ? `O lançamento ${excluirRef.numero} tem parcelas já pagas. A exclusão também apaga os pagamentos associados (em cascata). Tem certeza?`
            : `Excluir o lançamento ${excluirRef?.numero ?? ''}? Esta ação é soft-delete e pode ser revertida via banco.`
        }
        requirePassword={false}
        onConfirm={handleExcluirConfirm}
      />
    </div>
  );
}

function FilterField({
  label, icon, children,
}: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-2xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-1 flex items-center gap-1">
        {icon}{label}
      </label>
      {children}
    </div>
  );
}
