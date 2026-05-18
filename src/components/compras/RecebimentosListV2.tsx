/**
 * RecebimentosListV2 — Lista global de recebimentos (remessas) de OCs.
 *
 * Cada linha é uma remessa: OC origem + nº remessa + data + NF + qtd + quem
 * recebeu. Clique na linha expande pra mostrar os itens recebidos.
 *
 * Filtros: período (data), busca por número de OC/NF, fornecedor.
 */
import { useMemo, useState } from 'react';
import { Truck, Package, ChevronDown, ChevronUp, Calendar, Trash2 } from 'lucide-react';
import type {
  RecebimentoOC,
  OrdemCompra,
  Fornecedor,
  Insumo,
  DepositoMaterial,
  Deposito,
} from '../../types';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import { formatDate } from '../../utils/formatters';
import { dentroDoPeriodo } from '../../utils/comprasFiltros';
import { useExcluirRecebimentoOC } from '../../hooks/useExcluirRecebimentoOC';
import { useToast } from '../ui/Toast';

interface Props {
  recebimentos: RecebimentoOC[];
  ordens: OrdemCompra[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  depositosMaterial: DepositoMaterial[];
  tanquesCombustivel: Deposito[];
}

interface FiltroDatas {
  inicio: string;
  fim: string;
}

export default function RecebimentosListV2({
  recebimentos, ordens, fornecedores, insumos, depositosMaterial, tanquesCombustivel,
}: Props) {
  const [busca, setBusca] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [datas, setDatas] = useState<FiltroDatas>({ inicio: '', fim: '' });
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  // Confirmação de exclusão (mantém qual remessa o usuário pediu pra excluir)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<RecebimentoOC | null>(null);
  const excluirMut = useExcluirRecebimentoOC();
  const { showToast } = useToast();

  const ocsMap = useMemo(() => new Map(ordens.map((o) => [o.id, o])), [ordens]);
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const depositosMap = useMemo(
    () => new Map<string, string>([
      ...depositosMaterial.map((d) => [d.id, d.nome] as [string, string]),
      ...tanquesCombustivel.map((t) => [t.id, t.apelido || t.nome] as [string, string]),
    ]),
    [depositosMaterial, tanquesCombustivel]
  );

  const filtrados = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return recebimentos
      .filter((r) => {
        const oc = ocsMap.get(r.ordemCompraId);
        // período
        if (datas.inicio || datas.fim) {
          if (!dentroDoPeriodo(r.dataRecebimento, datas.inicio, datas.fim)) return false;
        }
        // fornecedor
        if (filtroFornecedor && oc?.fornecedorId !== filtroFornecedor) return false;
        // busca: OC número, NF
        if (buscaLower) {
          const hayOC = oc?.numero?.toLowerCase().includes(buscaLower) ?? false;
          const hayNF = (r.notaFiscalEntrega || '').toLowerCase().includes(buscaLower);
          const hayRecebedor = r.recebidoPor.toLowerCase().includes(buscaLower);
          if (!hayOC && !hayNF && !hayRecebedor) return false;
        }
        return true;
      })
      .sort((a, b) => (b.recebidoEm || '').localeCompare(a.recebidoEm || ''));
  }, [recebimentos, ocsMap, datas, filtroFornecedor, busca]);

  function toggleExpandir(id: string) {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] mb-1">
            Buscar
          </label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="OC, NF ou quem recebeu…"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <label className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] mb-1">
            Fornecedor
          </label>
          <SmartSelect
            value={filtroFornecedor}
            onChange={(e) => setFiltroFornecedor(e.target.value)}
            className="w-full h-9 px-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-left flex items-center"
          >
            <option value="">Todos</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </SmartSelect>
        </div>
        <div>
          <label className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> De
          </label>
          <Input
            type="date"
            value={datas.inicio}
            onChange={(e) => setDatas((d) => ({ ...d, inicio: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <label className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Até
          </label>
          <Input
            type="date"
            value={datas.fim}
            onChange={(e) => setDatas((d) => ({ ...d, fim: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Totais rápidos */}
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--color-fg-muted)] px-1">
        <span>
          <strong className="text-[var(--color-fg)] font-semibold">{filtrados.length}</strong>{' '}
          {filtrados.length === 1 ? 'remessa' : 'remessas'}
        </span>
        <span>
          <strong className="text-[var(--color-fg)] font-semibold">
            {filtrados.reduce((s, r) => s + r.itens.reduce((ss, it) => ss + it.quantidadeRecebida, 0), 0).toLocaleString('pt-BR')}
          </strong>{' '}
          unidades recebidas
        </span>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-10 text-center">
          <Truck className="w-10 h-10 mx-auto mb-3 text-[var(--color-fg-subtle)]" />
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhuma remessa registrada ainda.
          </p>
          <p className="text-[11.5px] text-[var(--color-fg-subtle)] mt-1">
            Abra uma Ordem de Compra aprovada e use o botão 📦 Receber pra registrar a primeira.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold w-10"></th>
                <th className="px-3 py-2.5 text-left font-semibold">OC / Fornecedor</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[100px]">Remessa</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[110px]">Data</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[130px]">NF entrega</th>
                <th className="px-3 py-2.5 text-right font-semibold w-[100px]">Itens · Qtd</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[140px]">Recebido por</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtrados.map((r) => {
                const oc = ocsMap.get(r.ordemCompraId);
                const fornecedor = oc ? fornecedoresMap.get(oc.fornecedorId) : undefined;
                const expandido = expandidos.has(r.id);
                const totalQtd = r.itens.reduce((s, it) => s + it.quantidadeRecebida, 0);
                return (
                  <>
                    <tr
                      key={r.id}
                      className="hover:bg-[var(--color-surface-2)]/40 cursor-pointer transition-colors"
                      onClick={() => toggleExpandir(r.id)}
                    >
                      <td className="px-3 py-2.5 text-[var(--color-fg-muted)]">
                        {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-[var(--color-fg)] font-mono text-[12.5px]">
                          {oc?.numero ?? '—'}
                        </div>
                        <div className="text-[11px] text-[var(--color-fg-muted)] truncate max-w-[260px]">
                          {fornecedor?.nome ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-[var(--color-fg)]">
                        #{r.numeroRemessa}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-[var(--color-fg-muted)]">
                        {formatDate(r.dataRecebimento)}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-[var(--color-fg-muted)]">
                        {r.notaFiscalEntrega || <span className="text-[var(--color-fg-subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums">
                        <div className="text-[var(--color-fg)]">{r.itens.length} {r.itens.length === 1 ? 'item' : 'itens'}</div>
                        <div className="text-[11px] text-[var(--color-fg-muted)]">{totalQtd.toLocaleString('pt-BR')} un.</div>
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-[var(--color-fg-muted)] truncate max-w-[140px]">
                        {r.recebidoPor || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmandoExclusao(r);
                          }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 transition-colors"
                          title="Excluir esta remessa (só se ainda não houve consumo)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {expandido && (
                      <tr key={`${r.id}-detail`} className="bg-[var(--color-surface-2)]/30">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="space-y-2">
                            {r.observacoes && (
                              <p className="text-[11.5px] italic text-[var(--color-fg-muted)]">
                                <Package className="w-3 h-3 inline mr-1" />
                                {r.observacoes}
                              </p>
                            )}
                            <table className="w-full text-[11.5px]">
                              <thead className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                                <tr>
                                  <th className="text-left py-1 font-medium">Item</th>
                                  <th className="text-right py-1 font-medium w-20">Qtd</th>
                                  <th className="text-left py-1 font-medium w-[180px]">Destino</th>
                                  <th className="text-left py-1 font-medium w-24">Lote</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--color-border)]/50">
                                {r.itens.map((it) => {
                                  const itemOC = oc?.itens.find((x) => x.id === it.itemOrdemCompraId);
                                  const insumo = itemOC?.insumoId ? insumosMap.get(itemOC.insumoId) : undefined;
                                  return (
                                    <tr key={it.id}>
                                      <td className="py-1 text-[var(--color-fg)]">
                                        {insumo?.nome || itemOC?.descricao || '—'}
                                      </td>
                                      <td className="py-1 text-right tabular-nums text-[var(--color-fg)]">
                                        {it.quantidadeRecebida.toLocaleString('pt-BR')}
                                        <span className="text-[var(--color-fg-subtle)] ml-1 text-[10px]">{itemOC?.unidade}</span>
                                      </td>
                                      <td className="py-1 text-[var(--color-fg-muted)]">
                                        {it.depositoDestinoId
                                          ? depositosMap.get(it.depositoDestinoId) || it.depositoDestinoId
                                          : <span className="text-[var(--color-fg-subtle)]">—</span>}
                                      </td>
                                      <td className="py-1 text-[var(--color-fg-muted)]">
                                        {it.lote || <span className="text-[var(--color-fg-subtle)]">—</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmação de exclusão — só prossegue se o saldo permitir (validação
          no hook). Sem senha porque a regra de saldo já protege o estoque. */}
      <ConfirmDialog
        open={confirmandoExclusao !== null}
        onClose={() => setConfirmandoExclusao(null)}
        title={`Excluir remessa #${confirmandoExclusao?.numeroRemessa ?? ''}`}
        message={
          `Tem certeza que quer excluir a remessa #${confirmandoExclusao?.numeroRemessa ?? ''}? ` +
          `Esta ação só vai funcionar se NENHUM dos materiais recebidos foi consumido/transferido ainda — ` +
          `o sistema valida o saldo antes de excluir, e se ficar negativo, bloqueia a operação. ` +
          `As entradas geradas no estoque também serão revertidas.`
        }
        requirePassword={false}
        onConfirm={async () => {
          if (!confirmandoExclusao) return;
          const oc = ocsMap.get(confirmandoExclusao.ordemCompraId);
          if (!oc) {
            showToast({ kind: 'error', message: 'OC origem não encontrada.' });
            setConfirmandoExclusao(null);
            return;
          }
          const outras = recebimentos.filter(
            (r) => r.ordemCompraId === confirmandoExclusao.ordemCompraId && r.id !== confirmandoExclusao.id,
          );
          try {
            await excluirMut.mutateAsync({
              recebimento: confirmandoExclusao,
              ordemCompra: oc,
              outrasRemessas: outras,
              insumos,
            });
            showToast({
              kind: 'success',
              message: `Remessa #${confirmandoExclusao.numeroRemessa} excluída.`,
            });
            setConfirmandoExclusao(null);
          } catch (err) {
            showToast({
              kind: 'error',
              message: err instanceof Error ? err.message : 'Erro ao excluir remessa.',
            });
            // mantém o dialog aberto pra usuário ver a mensagem detalhada
          }
        }}
      />
    </div>
  );
}
