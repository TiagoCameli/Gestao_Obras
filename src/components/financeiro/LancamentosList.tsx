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
} from 'lucide-react';
import type {
  LancamentoFinanceiro,
  StatusLancamento,
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
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold w-[120px]">Nº</th>
                <th className="px-3 py-2.5 text-left font-semibold">Descrição / Fornecedor</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[110px]">Vencimento</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[120px]">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold w-[140px]">Valor / Pago</th>
                <th className="px-3 py-2.5 w-[140px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtrados.map((l) => {
                const fornecedor = l.fornecedorId ? fornecedoresMap.get(l.fornecedorId) : undefined;
                const cat = l.categoriaId ? categoriasMap.get(l.categoriaId) : undefined;
                const empresa = l.empresaPagadoraId ? empresasMap.get(l.empresaPagadoraId) : undefined;
                const pago = l.parcelas.reduce((s, p) => s + (p.valorPago ?? 0), 0);
                const venc = diasAteVencimento(l.dataVencimento);
                const vencido = l.status !== 'pago' && l.status !== 'cancelado' && venc < 0;
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
                      <td className="px-3 py-2.5 font-mono text-[12.5px] text-[var(--color-fg)]">
                        {l.numero}
                        {l.origem === 'oc' && <span className="ml-1 text-[10px] text-[var(--color-fg-subtle)]">(OC)</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[13px] text-[var(--color-fg)] truncate max-w-[420px]">{l.descricao || '—'}</div>
                        <div className="text-[11px] text-[var(--color-fg-muted)]">
                          {fornecedor?.nome ?? l.favorecidoNome ?? '—'}
                          {empresa && ` · ${empresa.nome}`}
                          {cat && ` · ${cat.nome}`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px]">
                        <div className="text-[var(--color-fg-muted)]">{fmtData(l.dataVencimento)}</div>
                        {vencido && (
                          <div className="text-[10.5px] text-rose-600 dark:text-rose-400">
                            {Math.abs(venc)} dia{Math.abs(venc) === 1 ? '' : 's'} vencido
                          </div>
                        )}
                        {!vencido && venc >= 0 && venc <= 7 && l.status !== 'pago' && (
                          <div className="text-[10.5px] text-amber-600 dark:text-amber-400">
                            Vence em {venc} dia{venc === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className={'inline-block px-2 py-0.5 rounded text-[10.5px] font-medium ' + STATUS_LABEL[l.status].cls}>
                            {STATUS_LABEL[l.status].label}
                          </span>
                          {l.fechado && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              title={`Fechado em ${l.fechadoEm ? new Date(l.fechadoEm).toLocaleString('pt-BR') : ''}${l.fechadoPor ? ' por ' + l.fechadoPor : ''}`}
                            >
                              <Lock className="w-2.5 h-2.5" /> Fechado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[12.5px]">
                        <div className="font-semibold text-[var(--color-fg)]">{fmtMoeda(l.valorTotal)}</div>
                        {pago > 0 && (
                          <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400">
                            Pago: {fmtMoeda(pago)}
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
