/**
 * LancamentosList — Lista de lançamentos financeiros com filtros e
 * linhas expansíveis (mostra parcelas + ação "Registrar pagamento").
 *
 * Props.modo controla o filtro inicial:
 *   - 'todos'        → todos os status
 *   - 'contas_pagar' → só em_aberto / pago_parcial (filtro pré-aplicado)
 *
 * Cada linha expande pra mostrar parcelas. Cada parcela tem botão
 * "Pagar" (abre RegistrarPagamentoModal) ou "Estornar" (se já paga).
 */
import { useMemo, useState } from 'react';
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
  /** Callback pra abrir o form de edição com o lançamento. */
  onEditar?: (l: LancamentoFinanceiro) => void;
  /** Callback pra abrir o drawer de detalhes. Quando passado, clicar na
   *  linha abre detalhes em vez de expandir inline. */
  onVerDetalhes?: (l: LancamentoFinanceiro) => void;
}

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
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transf.',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Cr.',
  cartao_debito: 'Cartão Db.',
  cheque: 'Cheque',
  deposito: 'Depósito',
  outros: 'Outros',
};

const TIPO_DESTINO_SHORT: Record<TipoDestinoRateio, string> = {
  obra_etapa: 'Obra',
  obra_deposito: 'Obra',
  deposito_central: 'Almox.',
  sede: 'Sede',
  manutencao_equipamento: 'Manut.',
  tanque_combustivel: 'Comb.',
};

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

/** Resume os destinos do rateio em chips: "2 Obras · Manut. · Sede". */
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
    let arr = lancamentos.filter((l) => {
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
        const hay = [
          l.numero, l.descricao, fornec, l.favorecidoNome ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(buscaLower)) return false;
      }
      return true;
    });
    // Ordena por vencimento ascendente
    arr = arr.sort((a, b) => (a.dataVencimento || '').localeCompare(b.dataVencimento || ''));
    return arr;
  }, [lancamentos, modo, statusFiltro, fornecedorFiltro, empresaFiltro, categoriaFiltro, periodoIni, periodoFim, busca, fornecedoresMap]);

  // ── Totais ──────────────────────────────────────────────────────────
  const totalFiltrado = filtrados.reduce((s, l) => s + l.valorTotal, 0);
  const totalPagoFiltrado = filtrados.reduce(
    (s, l) => s + l.parcelas.reduce((ss, p) => ss + (p.valorPago ?? 0), 0),
    0,
  );
  const totalEmAberto = totalFiltrado - totalPagoFiltrado;

  // ── Confirmação de exclusão (pagamento/estorno ficam no drawer) ────
  const [excluirRef, setExcluirRef] = useState<LancamentoFinanceiro | null>(null);

  async function handleExcluirConfirm() {
    if (!excluirRef) return;
    try {
      await excluirMut.mutateAsync(excluirRef);
      showToast({ kind: 'success', message: `Lançamento ${excluirRef.numero} excluído.` });
      setExcluirRef(null);
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao excluir.',
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Banner do modo */}
      {modo === 'contas_pagar' && (
        <div className="px-3.5 py-2.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] text-[12px] text-amber-900 dark:text-amber-100 flex items-start gap-2">
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
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nº, descrição, fornecedor…"
            className="h-9 text-sm"
          />
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
      <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[var(--color-fg-muted)] px-1">
        <span>
          <strong className="text-[var(--color-fg)] font-semibold">{filtrados.length}</strong>{' '}
          {filtrados.length === 1 ? 'lançamento' : 'lançamentos'}
        </span>
        <span>Total: <strong className="text-[var(--color-fg)] font-semibold">{fmtMoeda(totalFiltrado)}</strong></span>
        <span>Pago: <strong className="text-emerald-700 dark:text-emerald-400">{fmtMoeda(totalPagoFiltrado)}</strong></span>
        <span>Em aberto: <strong className="text-amber-700 dark:text-amber-400">{fmtMoeda(totalEmAberto)}</strong></span>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-10 text-center">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-[var(--color-fg-subtle)]" />
          <p className="text-sm text-[var(--color-fg-muted)]">
            {modo === 'contas_pagar' ? 'Nenhuma conta a pagar.' : 'Nenhum lançamento encontrado com os filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[42%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Nº</th>
                <th className="px-3 py-2.5 text-left font-semibold">Descrição / Fornecedor</th>
                <th className="px-3 py-2.5 text-left font-semibold">Vencimento</th>
                <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor / Pago</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtrados.map((l) => {
                const fornecedor = l.fornecedorId ? fornecedoresMap.get(l.fornecedorId) : undefined;
                const cat = l.categoriaId ? categoriasMap.get(l.categoriaId) : undefined;
                const empresa = l.empresaPagadoraId ? empresasMap.get(l.empresaPagadoraId) : undefined;
                const pago = l.parcelas.reduce((s, p) => s + (p.valorPago ?? 0), 0);
                const emAberto = l.valorTotal - pago;
                const pctPago = l.valorTotal > 0 ? Math.round((pago / l.valorTotal) * 100) : 0;

                // ── Parcelas: contagem + próxima em aberto ────────────
                const totalParcelas = l.parcelas.length;
                const parcelasPagas = l.parcelas.filter((p) => p.status === 'pago').length;
                const proximaEmAberto = [...l.parcelas]
                  .filter((p) => p.status === 'em_aberto')
                  .sort((a, b) => (a.dataVencimento || '').localeCompare(b.dataVencimento || ''))[0];
                const dataReferencia = proximaEmAberto?.dataVencimento ?? l.dataVencimento;
                const venc = diasAteVencimento(dataReferencia);
                const vencido = l.status !== 'pago' && l.status !== 'cancelado' && venc < 0;

                // ── Origem ─────────────────────────────────────────────
                const origem = ORIGEM_LABEL[l.origem] ?? ORIGEM_LABEL.avulso;

                // ── Forma de pagamento label ──────────────────────────
                const formaPagto = l.formaPagamento
                  ? FORMA_PAGTO_LABEL[l.formaPagamento as FormaPagamentoLancamento] ?? l.formaPagamento
                  : null;

                // ── Destinos do rateio ─────────────────────────────────
                const destinos = resumirDestinos(l.rateios);

                // ── Anexos count ──────────────────────────────────────
                const anexosCount = l.anexosUrls?.length ?? 0;

                return (
                  <tr
                    key={l.id}
                    onClick={(e) => {
                      // Click na linha abre o drawer; ignora clicks em botões/links das ações
                      if ((e.target as HTMLElement).closest('button,a,[role="menu"]')) return;
                      onVerDetalhes?.(l);
                    }}
                    className={
                      'cursor-pointer hover:bg-[var(--color-surface-2)]/40 transition-colors ' +
                      (vencido ? 'bg-rose-50/30 dark:bg-rose-950/10 ' : '')
                    }
                  >
                      {/* ── Nº ──────────────────────────────────────── */}
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-mono text-[12.5px] text-[var(--color-fg)] leading-tight">{l.numero}</div>
                        <span className={'inline-block mt-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wide ' + origem.cls}>
                          {origem.label}
                        </span>
                      </td>

                      {/* ── Descrição / Fornecedor / Chips ──────────── */}
                      <td className="px-3 py-2.5 align-top min-w-0">
                        <div className="text-[13px] text-[var(--color-fg)] truncate font-medium" title={l.descricao || undefined}>
                          {l.descricao || '—'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] flex items-center gap-1.5 flex-wrap">
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
                        {/* Chips compactos: categoria · forma pagto · destinos · anexos */}
                        {(cat || formaPagto || destinos.length > 0 || anexosCount > 0) && (
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            {cat && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                                title={`Categoria: ${cat.nome}`}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {cat.nome}
                              </span>
                            )}
                            {formaPagto && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
                                title="Forma de pagamento"
                              >
                                <CreditCard className="w-2.5 h-2.5" />
                                {formaPagto}
                              </span>
                            )}
                            {destinos.map((d, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                                title="Destino do rateio"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                {d}
                              </span>
                            ))}
                            {anexosCount > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                                title={`${anexosCount} anexo${anexosCount > 1 ? 's' : ''}`}
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                {anexosCount}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* ── Vencimento ──────────────────────────────── */}
                      <td className="px-3 py-2.5 align-top text-[12.5px]">
                        <div className="text-[var(--color-fg)] font-medium">{fmtData(dataReferencia)}</div>
                        {totalParcelas > 1 && proximaEmAberto && (
                          <div className="text-[10.5px] text-[var(--color-fg-muted)] flex items-center gap-1 mt-0.5">
                            <Layers className="w-2.5 h-2.5" />
                            Parc. {proximaEmAberto.numero} de {totalParcelas}
                          </div>
                        )}
                        {vencido && (
                          <div className="text-[10.5px] font-medium text-rose-600 dark:text-rose-400 mt-0.5">
                            {Math.abs(venc)} dia{Math.abs(venc) === 1 ? '' : 's'} vencido
                          </div>
                        )}
                        {!vencido && venc >= 0 && venc <= 7 && l.status !== 'pago' && l.status !== 'cancelado' && (
                          <div className="text-[10.5px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                            {venc === 0 ? 'Vence hoje' : `Vence em ${venc} dia${venc === 1 ? '' : 's'}`}
                          </div>
                        )}
                        {!vencido && venc > 7 && l.status !== 'pago' && l.status !== 'cancelado' && (
                          <div className="text-[10.5px] text-[var(--color-fg-subtle)] mt-0.5">
                            em {venc} dias
                          </div>
                        )}
                      </td>

                      {/* ── Status + Progresso parcelas ─────────────── */}
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1">
                            <span className={'inline-block px-2 py-0.5 rounded text-[10.5px] font-medium ' + STATUS_LABEL[l.status].cls}>
                              {STATUS_LABEL[l.status].label}
                            </span>
                            {l.fechado && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                title={`Fechado em ${l.fechadoEm ? new Date(l.fechadoEm).toLocaleString('pt-BR') : ''}${l.fechadoPor ? ' por ' + l.fechadoPor : ''}`}
                              >
                                <Lock className="w-2.5 h-2.5" /> Fechado
                              </span>
                            )}
                          </div>
                          {totalParcelas > 0 && (
                            <div className="w-full max-w-[110px]">
                              <div className="text-[10px] text-[var(--color-fg-muted)] flex justify-between mb-0.5">
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
                      </td>

                      {/* ── Valor / Pago ─────────────────────────────── */}
                      <td className="px-3 py-2.5 align-top text-right tabular-nums text-[12.5px]">
                        <div className="font-semibold text-[var(--color-fg)]">{fmtMoeda(l.valorTotal)}</div>
                        {pago > 0 && (
                          <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Pago: {fmtMoeda(pago)}
                          </div>
                        )}
                        {emAberto > 0.01 && l.status !== 'cancelado' && (
                          <div className="text-[10.5px] text-amber-700 dark:text-amber-400">
                            {pago > 0 ? 'Saldo: ' : ''}{fmtMoeda(emAberto)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          {/* Editar: só aparece quando não está fechado */}
                          {podeEditar && onEditar && !l.fechado && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onEditar(l); }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                              title="Editar lançamento"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Fechar lançamento (trava edição) */}
                          {podeFechar && !l.fechado && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
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
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Reabrir: aparece quando fechado e tem permissão */}
                          {podeReabrir && l.fechado && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!window.confirm(`Reabrir lançamento ${l.numero}? Edição volta a ficar liberada.`)) return;
                                try {
                                  await reabrirMut.mutateAsync(l.id);
                                  showToast({ kind: 'success', message: `Lançamento ${l.numero} reaberto.` });
                                } catch (err) {
                                  showToast({ kind: 'error', message: err instanceof Error ? err.message : 'Erro.' });
                                }
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/15"
                              title="Reabrir lançamento (destrava edição)"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Excluir: bloqueado quando fechado */}
                          {podeExcluir && !l.fechado && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExcluirRef(l); }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15"
                              title="Excluir lançamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* Pagamento/estorno agora ficam no Drawer (pai abre via onVerDetalhes) */}

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
      <label className="block text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)] mb-1 flex items-center gap-1">
        {icon}{label}
      </label>
      {children}
    </div>
  );
}
