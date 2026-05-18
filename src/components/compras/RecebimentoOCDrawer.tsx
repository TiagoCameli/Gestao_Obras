/**
 * RecebimentoOCDrawer — Drawer pra registrar recebimento (parcial ou total)
 * de uma Ordem de Compra.
 *
 * Cada linha da OC vira uma linha do formulário com:
 *   - descrição/qtd OC/qtd já recebida em remessas anteriores
 *   - input de qtd que está chegando AGORA (default = qtd pendente)
 *   - picker de destino físico (almoxarifado/tanque/depósito) — só aparece
 *     se a OC não pré-definiu, OU se o usuário quer mudar
 *   - lote + validade opcionais
 *   - observação por item
 *
 * Acima da tabela: data de recebimento + nota fiscal de entrega + obs geral.
 *
 * Ao confirmar, chama useConfirmarRecebimentoOC que orquestra toda a
 * persistência (recebimento + entradas + status da OC).
 *
 * Histórico de remessas anteriores aparece num accordion no topo, com link
 * pra ver cada uma.
 */
import { useState, useEffect } from 'react';
import {
  Truck, CheckCircle2, History,
  Calendar, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import type {
  OrdemCompra,
  DepositoMaterial,
  Deposito,
  Insumo,
  Fornecedor,
  ItemRecebimentoOC,
  RecebimentoOC,
} from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import { useToast } from '../ui/Toast';
import { useRecebimentosDaOC } from '../../hooks/useRecebimentosOC';
import { useConfirmarRecebimentoOC } from '../../hooks/useConfirmarRecebimentoOC';
import { getTipoVisualInsumo, TIPO_VISUAL_ICON, TIPO_VISUAL_LABEL, TIPO_VISUAL_CHIP_CLASS } from '../../utils/insumoTipoVisual';
import { formatDate } from '../../utils/formatters';

interface Props {
  open: boolean;
  onClose: () => void;
  oc: OrdemCompra | null;
  depositosMaterial: DepositoMaterial[];
  tanquesCombustivel: Deposito[];
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  onRecebido?: () => void;
}

/** Linha do form com estado mutável. */
interface LinhaForm {
  itemOrdemCompraId: string;
  descricao: string;
  qtdOC: number;
  qtdJaRecebida: number;
  qtdPendente: number;
  qtdAgora: string;
  depositoDestinoId: string;
  lote: string;
  validade: string;
  observacoes: string;
  /** Pré-resolvido do item da OC pra UX */
  ehServico: boolean;
  ehCombustivel: boolean;
  ehPeca: boolean;
  /** Se o item da OC já tinha destino fechado, herda e bloqueia */
  destinoHerdadoOC?: string;
}

export default function RecebimentoOCDrawer({
  open, onClose, oc, depositosMaterial, tanquesCombustivel, insumos, fornecedores, onRecebido,
}: Props) {
  const { showToast } = useToast();
  const { data: recebimentosAnteriores = [] } = useRecebimentosDaOC(oc?.id);
  const confirmar = useConfirmarRecebimentoOC();

  const [dataRecebimento, setDataRecebimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [notaFiscal, setNotaFiscal] = useState('');
  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [linhas, setLinhas] = useState<LinhaForm[]>([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  // ─── Monta linhas a partir da OC + remessas anteriores ──────────────
  //
  // ⚠ IMPORTANTE: dependências DEVEM ser valores estáveis (strings/numbers),
  // NÃO os arrays inteiros — o componente fica sempre montado em Compras.tsx
  // (só `open` controla visibilidade), e React Query gera arrays novos a cada
  // refetch/refresh. Se a dep array fosse `[oc, recebimentosAnteriores, insumos]`,
  // qualquer re-render do pai dispararia o effect, que chama setLinhas, que
  // dispara re-render, que dispara o effect → loop infinito ("Maximum update
  // depth exceeded"). Veja issue resolvida em 2026-05-17.
  //
  // Usamos `oc?.id` (string estável) e contagens (length) pra detectar mudanças
  // semânticas reais. Suficiente pra esse caso porque IDs de itens da OC e
  // recebimentos não mudam dentro de uma sessão do drawer.
  const ocId = oc?.id;
  const recebimentosKey = recebimentosAnteriores.length;
  useEffect(() => {
    if (!oc) {
      // Não chama setLinhas([]) à toa — só se já não estiver vazio. Sem essa
      // guarda, cada render gera um novo `[]` que React vê como mudança e
      // dispara o effect de novo.
      setLinhas((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    // Qtd já recebida por item (em remessas anteriores)
    const recebidoPorItem = new Map<string, number>();
    for (const r of recebimentosAnteriores) {
      for (const it of r.itens) {
        recebidoPorItem.set(
          it.itemOrdemCompraId,
          (recebidoPorItem.get(it.itemOrdemCompraId) ?? 0) + it.quantidadeRecebida,
        );
      }
    }

    const novasLinhas: LinhaForm[] = oc.itens.map((it) => {
      const insumo = it.insumoId ? insumos.find((i) => i.id === it.insumoId) : undefined;
      const tipoVisual = getTipoVisualInsumo(insumo);
      const ehServico = tipoVisual === 'servico';
      const ehCombustivel = tipoVisual === 'combustivel' || it.tipoDestino === 'tanque_combustivel';
      const ehPeca = tipoVisual === 'peca';
      const jaRecebido = recebidoPorItem.get(it.id) ?? 0;
      const pendente = Math.max(0, it.quantidade - jaRecebido);
      return {
        itemOrdemCompraId: it.id,
        descricao: it.descricao,
        qtdOC: it.quantidade,
        qtdJaRecebida: jaRecebido,
        qtdPendente: pendente,
        qtdAgora: ehServico ? '' : String(pendente),
        depositoDestinoId: it.depositoDestinoId ?? '',
        lote: '',
        validade: '',
        observacoes: '',
        ehServico,
        ehCombustivel,
        ehPeca,
        destinoHerdadoOC: it.depositoDestinoId,
      };
    });
    setLinhas(novasLinhas);
    setNotaFiscal('');
    setObservacoesGerais('');
    setDataRecebimento(new Date().toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocId, recebimentosKey]);

  // ─── Validação ──────────────────────────────────────────────────────
  const linhasComQtd = linhas.filter((l) => !l.ehServico && Number(l.qtdAgora) > 0);
  const proximoNumero = (recebimentosAnteriores[recebimentosAnteriores.length - 1]?.numeroRemessa ?? 0) + 1;

  function pickerDeposito(linha: LinhaForm, idx: number) {
    if (linha.ehServico) {
      return (
        <span className="text-[11px] text-[var(--color-fg-subtle)]">
          Serviço — sem destino físico
        </span>
      );
    }
    const opcoes = linha.ehCombustivel
      ? tanquesCombustivel.filter((t) => t.ativo)
      : linha.ehPeca
        ? depositosMaterial.filter((d) => d.ativo && d.ehAlmoxarifadoPecas)
        : depositosMaterial.filter((d) => d.ativo && !d.ehAlmoxarifadoPecas);

    return (
      <SmartSelect
        value={linha.depositoDestinoId}
        onChange={(e) => updateLinha(idx, { depositoDestinoId: e.target.value })}
        usePortal
        className="w-full px-2 py-1.5 text-[12px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] flex items-center min-h-[32px]"
      >
        <option value="">— escolha o {linha.ehCombustivel ? 'tanque' : linha.ehPeca ? 'almoxarifado' : 'depósito'} —</option>
        {opcoes.length === 0 ? (
          <option disabled>Nenhum cadastrado</option>
        ) : (
          opcoes.map((d) => {
            const icon = linha.ehCombustivel ? '⛽' : linha.ehPeca ? '🔧' : '📦';
            // @ts-expect-error união de tipos diferentes
            const nome = d.apelido || d.nome;
            return <option key={d.id} value={d.id}>{icon} {nome}</option>;
          })
        )}
      </SmartSelect>
    );
  }

  function updateLinha(idx: number, patch: Partial<LinhaForm>) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  // ─── Validação antes de salvar ──────────────────────────────────────
  function validar(): string | null {
    if (!oc) return 'OC inválida.';
    if (linhasComQtd.length === 0) {
      return 'Informe a quantidade recebida em pelo menos um item.';
    }
    for (const l of linhasComQtd) {
      const qtd = Number(l.qtdAgora);
      if (qtd > l.qtdPendente + 0.0001) {
        return `Item "${l.descricao}": qtd recebida (${qtd}) maior que pendente (${l.qtdPendente}).`;
      }
      if (!l.depositoDestinoId) {
        const ondeStr = l.ehCombustivel ? 'tanque' : l.ehPeca ? 'almoxarifado' : 'depósito';
        return `Item "${l.descricao}": selecione o ${ondeStr} onde está sendo recebido.`;
      }
    }
    return null;
  }

  async function handleConfirmar() {
    if (!oc) return;
    const erro = validar();
    if (erro) {
      showToast({ kind: 'error', message: erro });
      return;
    }
    const itensReceb: ItemRecebimentoOC[] = linhasComQtd.map((l) => ({
      id: `irec_${crypto.randomUUID()}`,
      itemOrdemCompraId: l.itemOrdemCompraId,
      quantidadeRecebida: Number(l.qtdAgora),
      depositoDestinoId: l.depositoDestinoId || undefined,
      lote: l.lote || undefined,
      validade: l.validade || undefined,
      observacoes: l.observacoes || undefined,
    }));

    const recebimento: RecebimentoOC = {
      id: `rec_${crypto.randomUUID()}`,
      ordemCompraId: oc.id,
      numeroRemessa: proximoNumero,
      dataRecebimento,
      notaFiscalEntrega: notaFiscal,
      observacoes: observacoesGerais,
      itens: itensReceb,
      recebidoPor: '', // preenchido pelo hook
      recebidoEm: '', // idem
    };

    try {
      const res = await confirmar.mutateAsync({
        recebimento,
        ordemCompra: oc,
        recebimentosAnteriores,
        insumos,
        tanques: tanquesCombustivel,
        fornecedores,
      });
      showToast({
        kind: 'success',
        message: res.tudoRecebido
          ? `OC ${oc.numero} totalmente recebida ✓`
          : `Remessa ${proximoNumero} registrada — OC continua aberta.`,
      });
      onRecebido?.();
      onClose();
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao confirmar recebimento.',
      });
    }
  }

  if (!oc) {
    return (
      <Drawer open={open} onClose={onClose} title="Receber OC" width="xl">
        <p className="text-sm text-[var(--color-fg-muted)]">Nenhuma OC selecionada.</p>
      </Drawer>
    );
  }

  // Totais úteis pro header
  const totalItens = linhas.reduce((s, l) => s + l.qtdOC, 0);
  const totalRecebidoAcumulado = linhas.reduce((s, l) => s + l.qtdJaRecebida, 0);
  const pctRecebido = totalItens === 0 ? 0 : Math.round((totalRecebidoAcumulado / totalItens) * 100);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Receber OC ${oc.numero}`}
      subtitle={`Remessa #${proximoNumero} · ${pctRecebido}% já recebido em remessas anteriores`}
      width="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11.5px] text-[var(--color-fg-muted)]">
            {linhasComQtd.length} {linhasComQtd.length === 1 ? 'item' : 'itens'} nesta remessa
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleConfirmar}
              disabled={confirmar.isPending || linhasComQtd.length === 0}
            >
              {confirmar.isPending ? 'Salvando…' : (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar recebimento
                </span>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Banner explicativo */}
        <div className="px-3.5 py-2.5 rounded-lg border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-500/[0.06] text-[12px] text-sky-900 dark:text-sky-100 leading-relaxed flex items-start gap-2">
          <Truck className="w-4 h-4 mt-[1px] shrink-0" />
          <span>
            Registre <strong>o que chegou agora</strong>. Você pode receber tudo de uma vez ou em
            várias remessas — quando o total bater com a OC, ela é marcada como{' '}
            <strong>recebida</strong> automaticamente. Cada item gera entrada no almoxarifado/tanque
            correspondente, atualizando o estoque na hora.
          </span>
        </div>

        {/* Histórico de remessas anteriores (accordion) */}
        {recebimentosAnteriores.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)]">
            <button
              type="button"
              onClick={() => setMostrarHistorico((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-fg)]">
                <History className="w-4 h-4" />
                Recebimentos anteriores ({recebimentosAnteriores.length})
              </span>
              {mostrarHistorico ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {mostrarHistorico && (
              <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {recebimentosAnteriores.map((r) => (
                  <div key={r.id} className="px-4 py-3 text-[12px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">Remessa #{r.numeroRemessa} · {formatDate(r.dataRecebimento)}</span>
                      <span className="text-[var(--color-fg-muted)]">por {r.recebidoPor}</span>
                    </div>
                    <div className="text-[var(--color-fg-muted)]">
                      {r.itens.length} {r.itens.length === 1 ? 'item' : 'itens'}
                      {r.notaFiscalEntrega ? ` · NF ${r.notaFiscalEntrega}` : ''}
                      {r.observacoes ? ` · ${r.observacoes}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cabeçalho da remessa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Data do recebimento
            </label>
            <Input
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Nota fiscal de entrega (opcional)
            </label>
            <Input
              value={notaFiscal}
              onChange={(e) => setNotaFiscal(e.target.value)}
              placeholder="Ex: NFe 12345"
            />
          </div>
        </div>

        {/* Tabela de itens */}
        <div>
          <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
            Itens recebidos
          </h3>
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Item</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-[80px]">OC</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-[80px]">Já receb.</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-[100px]">Recebendo</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-[200px]">Destino físico</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-[140px]">Lote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {linhas.map((linha, idx) => {
                  const insumo = oc.itens.find((it) => it.id === linha.itemOrdemCompraId);
                  const tipoVisual = getTipoVisualInsumo(
                    insumo?.insumoId ? insumos.find((i) => i.id === insumo.insumoId) : undefined
                  );
                  const completo = linha.qtdJaRecebida >= linha.qtdOC - 0.0001;
                  return (
                    <tr key={linha.itemOrdemCompraId} className={completo ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={
                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ' +
                              TIPO_VISUAL_CHIP_CLASS[tipoVisual]
                            }
                          >
                            {TIPO_VISUAL_ICON[tipoVisual]}{TIPO_VISUAL_LABEL[tipoVisual]}
                          </span>
                          <span className="font-medium text-[var(--color-fg)]">{linha.descricao}</span>
                          {completo && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Completo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right text-[var(--color-fg-muted)]">
                        {linha.qtdOC.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-[var(--color-fg-muted)]">
                        {linha.qtdJaRecebida.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        {linha.ehServico ? (
                          <span className="text-[11px] text-[var(--color-fg-subtle)]">—</span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            max={linha.qtdPendente}
                            step="any"
                            value={linha.qtdAgora}
                            onChange={(e) => updateLinha(idx, { qtdAgora: e.target.value })}
                            disabled={completo}
                            className="text-right h-8 text-[12px]"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {pickerDeposito(linha, idx)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {linha.ehServico ? (
                          <span className="text-[11px] text-[var(--color-fg-subtle)]">—</span>
                        ) : (
                          <Input
                            value={linha.lote}
                            onChange={(e) => updateLinha(idx, { lote: e.target.value })}
                            placeholder="opcional"
                            className="h-8 text-[12px]"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {linhas.every((l) => l.qtdJaRecebida >= l.qtdOC - 0.0001) && (
            <div className="mt-3 px-3.5 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/[0.06] text-[12px] text-emerald-900 dark:text-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-[1px] shrink-0" />
              <span>Esta OC já foi totalmente recebida em remessas anteriores. Nada a fazer aqui.</span>
            </div>
          )}
        </div>

        {/* Observações gerais */}
        <div>
          <label className="block text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5">
            Observações da remessa (opcional)
          </label>
          <textarea
            value={observacoesGerais}
            onChange={(e) => setObservacoesGerais(e.target.value)}
            rows={2}
            placeholder="Ex: motorista relatou avaria em 2 sacos; carga conferida pela equipe da obra…"
            className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </div>
    </Drawer>
  );
}
