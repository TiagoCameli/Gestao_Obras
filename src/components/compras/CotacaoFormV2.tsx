/**
 * CotacaoFormV2 — formulário premium para criar/editar cotação.
 *
 * Suporta 3 origens:
 *   1. Cotação em branco (sem pedido)
 *   2. Cotação a partir de pedido COM itens (carrega itens + descrição)
 *   3. Cotação a partir de pedido em texto livre (carrega só descrição, itens vazios)
 *
 * Estrutura visual:
 *   - Cabeçalho compacto (número, data, prazo, pedido vinculado, descrição curta)
 *   - Caixa de contexto (descrição livre do pedido, se existir)
 *   - Seção Itens (tabela editável com tipo/qtd/unidade)
 *   - Seção Fornecedores (cards com cadastro mínimo inline)
 *   - Seção Mapa Comparativo (preços + condições + checkboxes para gerar OC)
 *   - Footer: Cancelar / Salvar / Gerar OC dos selecionados
 *
 * Quando o portal recebe resposta de fornecedor, ela SOBRESCREVE os preços
 * manuais (decisão registrada em §14 do MODULO_COMPRAS.md).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, AlertCircle, Calendar, FileText, ShoppingCart, MessageCircle, X, UserPlus } from 'lucide-react';
import type {
  Cotacao,
  CotacaoFornecedor,
  ItemPedidoCompra,
  ItemPrecoCotacao,
  PedidoCompra,
  Fornecedor,
  Insumo,
  UnidadeMedida,
  TipoItemCompra,
  TipoDestinoOC,
  Obra,
  EtapaObra,
  Equipamento,
  DepositoMaterial,
  Deposito,
  OrdemServico,
} from '../../types';
import { useOrdensServico } from '../../hooks/useOrdensServico';
import {
  getTipoVisualInsumo,
  TIPO_VISUAL_LABEL,
  TIPO_VISUAL_ICON,
  TIPO_VISUAL_CHIP_CLASS,
  destinosPermitidos,
  destinoForcadoPorTipo,
  ehServico,
} from '../../utils/insumoTipoVisual';
import Button from '../ui/Button';
import SubmitButton from '../ui/SubmitButton';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import InsumoSelect from './InsumoSelect';
import InsumoQuickModal from './InsumoQuickModal';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCotacaoRespostas } from '../../hooks/useCotacaoLinksPublicos';

interface Props {
  initial: Cotacao | null;
  pedidosAprovados: PedidoCompra[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  unidades: UnidadeMedida[];
  categorias: { value: string; label: string }[];
  proximoNumero: string;
  pedidoPreSelecionado?: PedidoCompra | null;
  /** Obras cadastradas — usado para destinos obra_etapa */
  obras?: Obra[];
  /** Etapas de obra — usado para destinos obra_etapa */
  etapas?: EtapaObra[];
  /** Equipamentos — usado para destinos manutencao_equipamento */
  equipamentos?: Equipamento[];
  /** Depósitos de material/almoxarifados — usado para destinos com depósito */
  depositosMaterial?: DepositoMaterial[];
  /** Tanques de combustível — usado quando destino = tanque_combustivel */
  tanquesCombustivel?: Deposito[];
  onSubmit: (cotacao: Cotacao) => Promise<void>;
  onCancel: () => void;
  onCreateFornecedor: (nome: string) => Promise<string>;
  /** Notifica o pai quando o form fica sujo (usuário editou algo). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Geração de OC: callback recebe a cotação salva + fornecedor escolhido + ids de itens */
  onGerarOC?: (cotacao: Cotacao, fornecedorId: string, itemIds: string[]) => void;
  /** Abre o modal "Enviar para fornecedor" */
  onAbrirEnviar?: (cotacao: Cotacao) => void;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function novoItemVazio(): ItemPedidoCompra {
  return {
    id: genId(), descricao: '', categoria: 'outros', quantidade: 1, unidade: 'un',
    tipo: 'material',
  };
}

export default function CotacaoFormV2({
  initial, pedidosAprovados, fornecedores, insumos, unidades, categorias,
  proximoNumero, pedidoPreSelecionado,
  obras = [], etapas = [], equipamentos = [], depositosMaterial = [], tanquesCombustivel = [],
  onSubmit, onCancel, onCreateFornecedor, onGerarOC, onAbrirEnviar, onDirtyChange,
}: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();

  // Carrega OS disponíveis (abertas, em execução, etc.) para o picker de manutenção
  const { data: osList = [] } = useOrdensServico({
    status: ['rascunho', 'aberta', 'aguardando_pecas', 'em_execucao', 'aguardando_aprovacao'],
  });
  const osDisponiveis = useMemo(
    () => osList.filter((os) =>
      ['rascunho', 'aberta', 'aguardando_pecas', 'em_execucao', 'aguardando_aprovacao'].includes(os.status)
    ),
    [osList]
  );

  const [numero] = useState(initial?.numero || proximoNumero);
  const [data, setData] = useState(initial?.data || new Date().toISOString().slice(0, 10));
  const [prazoData, setPrazoData] = useState(
    initial?.prazoRespostaAt ? initial.prazoRespostaAt.slice(0, 10) : ''
  );
  const [descricao, setDescricao] = useState(initial?.descricao || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [pedidoVinculadoId, setPedidoVinculadoId] = useState<string>(
    initial?.pedidoCompraId || pedidoPreSelecionado?.id || ''
  );
  const [descricaoLivre, setDescricaoLivre] = useState(
    initial?.descricaoLivre || pedidoPreSelecionado?.descricaoLivre || ''
  );
  const [itens, setItens] = useState<ItemPedidoCompra[]>(
    initial?.itensPedido && initial.itensPedido.length > 0
      ? initial.itensPedido
      : pedidoPreSelecionado?.itens || []
  );
  const [cotFornecedores, setCotFornecedores] = useState<CotacaoFornecedor[]>(
    initial?.fornecedores || []
  );
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Cadastro rápido de insumo: qual item está esperando criação? + nome inicial
  const [insumoModalItemId, setInsumoModalItemId] = useState<string | null>(null);
  const [insumoModalNomeInicial, setInsumoModalNomeInicial] = useState('');

  // B4: dirty tracking — marca como sujo na primeira interação do usuário
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => {
    if (!dirty) {
      setDirty(true);
      onDirtyChange?.(true);
    }
  }, [dirty, onDirtyChange]);
  // Limpa dirty ao desmontar (caso ainda esteja true)
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Quando muda o pedido vinculado, carrega itens e descrição.
  // B5: auto-vincula itens cujo nome bate EXATO com algum insumo cadastrado
  // (case-insensitive, trim). Isso evita perder a referência ao catálogo
  // quando o pedido foi feito com texto livre que coincide com insumo existente.
  useEffect(() => {
    if (initial) return; // não sobrescrever cotação que já existe
    if (!pedidoVinculadoId) return;
    const pedido = pedidosAprovados.find((p) => p.id === pedidoVinculadoId);
    if (!pedido) return;
    if (pedido.itens.length > 0) {
      const insumosPorNome = new Map(
        insumos
          .filter((i) => i.ativo !== false)
          .map((i) => [i.nome.trim().toLowerCase(), i] as const)
      );
      setItens(pedido.itens.map((it) => {
        const copia = { ...it };
        if (!copia.insumoId && copia.descricao) {
          const match = insumosPorNome.get(copia.descricao.trim().toLowerCase());
          if (match) {
            copia.insumoId = match.id;
            copia.descricao = match.nome; // normaliza com a grafia do catálogo
            copia.unidade = (match.unidade as typeof copia.unidade) ?? copia.unidade;
            copia.categoria = match.categoria ?? copia.categoria;
            // Peça → destino travado em manutenção
            if (match.usadoEmManutencao) {
              copia.tipoDestino = 'manutencao_equipamento';
            }
          }
        }
        return copia;
      }));
    }
    if (pedido.descricaoLivre) {
      setDescricaoLivre(pedido.descricaoLivre);
    }
  }, [pedidoVinculadoId, initial, pedidosAprovados, insumos]);

  // ── Respostas dos fornecedores via portal — SOBRESCREVE preços manuais ─
  const { data: respostas = [] } = useCotacaoRespostas(initial?.id || '');
  useEffect(() => {
    if (!respostas.length) return;
    setCotFornecedores((prev) =>
      prev.map((cf) => {
        const resp = respostas.find((r) => r.fornecedorId === cf.fornecedorId);
        if (!resp) return cf;
        // Para cada item, se houve resposta com precoUnitario > 0, sobrescreve
        const novosItensPrecos: ItemPrecoCotacao[] = cf.itensPrecos.map((ip) => {
          const r = resp.itensResposta.find((ri) => ri.itemPedidoId === ip.itemPedidoId);
          if (r && r.precoUnitario > 0) {
            return { itemPedidoId: ip.itemPedidoId, precoUnitario: r.precoUnitario, marca: r.marca };
          }
          return ip;
        });
        return {
          ...cf,
          itensPrecos: novosItensPrecos,
          condicaoPagamento: resp.condicaoPagamento || cf.condicaoPagamento,
          prazoEntrega: resp.prazoEntrega || cf.prazoEntrega,
          respondido: true,
          total: novosItensPrecos.reduce((sum, ip) => {
            const item = itens.find((i) => i.id === ip.itemPedidoId);
            return sum + (ip.precoUnitario * (item?.quantidade ?? 0));
          }, 0),
        };
      })
    );
  }, [respostas, itens]);

  // ── Itens helpers ──────────────────────────────────────────────────────
  const adicionarItem = useCallback(() => {
    markDirty();
    const novo = novoItemVazio();
    setItens((prev) => [...prev, novo]);
    // Garante linha pra todos os fornecedores
    setCotFornecedores((prev) =>
      prev.map((cf) => ({
        ...cf,
        itensPrecos: [...cf.itensPrecos, { itemPedidoId: novo.id, precoUnitario: 0 }],
      }))
    );
  }, [markDirty]);

  const atualizarItem = useCallback((id: string, patch: Partial<ItemPedidoCompra>) => {
    markDirty();
    setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, [markDirty]);

  const removerItem = useCallback((id: string) => {
    markDirty();
    setItens((prev) => prev.filter((it) => it.id !== id));
    setCotFornecedores((prev) =>
      prev.map((cf) => ({ ...cf, itensPrecos: cf.itensPrecos.filter((ip) => ip.itemPedidoId !== id) }))
    );
  }, [markDirty]);

  // ── Fornecedores helpers ───────────────────────────────────────────────
  const adicionarFornecedor = useCallback((fornecedorId: string) => {
    if (cotFornecedores.find((cf) => cf.fornecedorId === fornecedorId)) {
      showToast({ kind: 'info', message: 'Fornecedor já adicionado.' });
      return;
    }
    markDirty();
    const novo: CotacaoFornecedor = {
      id: genId(),
      fornecedorId,
      itensPrecos: itens.map((it) => ({ itemPedidoId: it.id, precoUnitario: 0 })),
      condicaoPagamento: '',
      prazoEntrega: '',
      total: 0,
      respondido: false,
      vencedor: false,
    };
    setCotFornecedores((prev) => [...prev, novo]);
  }, [cotFornecedores, itens, showToast, markDirty]);

  const removerFornecedor = useCallback((cfId: string) => {
    markDirty();
    setCotFornecedores((prev) => prev.filter((cf) => cf.id !== cfId));
  }, [markDirty]);

  const atualizarPrecoItem = useCallback(
    (cfId: string, itemId: string, precoUnitario: number, marca?: string) => {
      markDirty();
      setCotFornecedores((prev) =>
        prev.map((cf) => {
          if (cf.id !== cfId) return cf;
          const itensPrecos = cf.itensPrecos.map((ip) =>
            ip.itemPedidoId === itemId
              ? { ...ip, precoUnitario, marca: marca !== undefined ? marca : ip.marca }
              : ip
          );
          const total = itensPrecos.reduce((sum, ip) => {
            const item = itens.find((i) => i.id === ip.itemPedidoId);
            return sum + ip.precoUnitario * (item?.quantidade ?? 0);
          }, 0);
          return { ...cf, itensPrecos, total };
        })
      );
    },
    [itens, markDirty]
  );

  const atualizarCampoFornecedor = useCallback(
    (cfId: string, patch: Partial<CotacaoFornecedor>) => {
      markDirty();
      setCotFornecedores((prev) => prev.map((cf) => (cf.id === cfId ? { ...cf, ...patch } : cf)));
    }, [markDirty]
  );

  // ── Submit ─────────────────────────────────────────────────────────────
  const construirCotacao = useCallback((): Cotacao => ({
    id: initial?.id || genId(),
    numero,
    descricao,
    data,
    pedidoCompraId: pedidoVinculadoId,
    prazoResposta: prazoData,
    prazoRespostaAt: prazoData ? new Date(prazoData + 'T23:59:59').toISOString() : undefined,
    descricaoLivre,
    status: initial?.status || 'em_cotacao',
    fornecedores: cotFornecedores,
    itensPedido: itens,
    observacoes,
    criadoPor: initial?.criadoPor || usuario?.nome || '',
    atualizadoPor: usuario?.nome || '',
  }), [initial, numero, descricao, data, pedidoVinculadoId, prazoData, descricaoLivre,
       cotFornecedores, itens, observacoes, usuario]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      if (itens.length === 0 && !descricaoLivre.trim()) {
        const msg = 'Adicione ao menos um item OU preencha a descrição.';
        setErro(msg);
        showToast({ kind: 'error', message: msg });
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit(construirCotacao());
      } catch (err) {
        setErro((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [itens, descricaoLivre, construirCotacao, onSubmit, showToast]
  );

  // ── Mapa comparativo: seleção pra gerar OC ─────────────────────────────
  const [fornecedorEscolhido, setFornecedorEscolhido] = useState<string | null>(null);
  const [itensEscolhidos, setItensEscolhidos] = useState<Set<string>>(new Set());

  const toggleItem = (itemId: string) => {
    setItensEscolhidos((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const handleGerarOC = () => {
    if (!fornecedorEscolhido || itensEscolhidos.size === 0 || !onGerarOC) return;
    onGerarOC(construirCotacao(), fornecedorEscolhido, Array.from(itensEscolhidos));
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const unidadesOptions = unidades.length > 0
    ? unidades.map((u) => ({ value: u.sigla, label: u.nome }))
    : [
        { value: 'un', label: 'un' },{ value: 'kg', label: 'kg' },{ value: 'm', label: 'm' },
        { value: 'm2', label: 'm²' },{ value: 'm3', label: 'm³' },{ value: 'lt', label: 'L' },
        { value: 'sc', label: 'sc' },{ value: 'pc', label: 'pç' },{ value: 'cx', label: 'cx' },
        { value: 'rl', label: 'rl' },{ value: 'tb', label: 'tb' }, { value: 'vb', label: 'verba' },
      ];

  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <header className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label>Número</Label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-mono text-[var(--color-fg)]">
            <FileText className="w-3.5 h-3.5 text-[var(--color-fg-subtle)]" />
            {numero}
          </div>
        </div>
        <div>
          <Label>Data</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-subtle)] pointer-events-none" />
            <Input type="date" value={data} onChange={(e) => { markDirty(); setData(e.target.value); }} className="pl-9" required />
          </div>
        </div>
        <div>
          <Label>Prazo de resposta (opcional)</Label>
          <Input type="date" value={prazoData} onChange={(e) => { markDirty(); setPrazoData(e.target.value); }} />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <Label>Pedido vinculado (opcional)</Label>
          <SmartSelect
            value={pedidoVinculadoId}
            onChange={(e) => { markDirty(); setPedidoVinculadoId(e.target.value); }}
            className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-left text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] flex items-center"
          >
            <option value="">— sem vínculo (cotação avulsa) —</option>
            {pedidosAprovados.map((p) => (
              <option key={p.id} value={p.id}>{p.numero} — {p.solicitante}</option>
            ))}
          </SmartSelect>
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição curta</Label>
          <Input
            value={descricao}
            onChange={(e) => { markDirty(); setDescricao(e.target.value); }}
            placeholder="Ex.: Compra de cimento e areia para BR-364"
          />
        </div>
      </header>

      {/* Contexto: descrição livre herdada */}
      {descricaoLivre && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-4 h-4 mt-0.5 text-[var(--color-fg-subtle)] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-1">
                Contexto do pedido
              </div>
              <textarea
                value={descricaoLivre}
                onChange={(e) => { markDirty(); setDescricaoLivre(e.target.value); }}
                rows={3}
                className="w-full bg-transparent text-sm text-[var(--color-fg)] focus:outline-none resize-y"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Seção Itens ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Itens a cotar"
          subtitulo={itens.length === 0 ? 'Adicione manualmente ou cole do pedido vinculado' : undefined}
          actionLabel="Adicionar item"
          onAction={adicionarItem}
        />
        {itens.length > 0 && (
          <div className="mb-3 px-3.5 py-2.5 rounded-lg border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-500/[0.06] text-[12px] text-sky-900 dark:text-sky-100 leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-[1px] shrink-0" />
            <span>
              <strong className="font-semibold">Dica:</strong> o tanque, almoxarifado ou depósito específico é{' '}
              <strong>opcional</strong> aqui — você (ou quem receber a OC) define no{' '}
              <strong>recebimento do material</strong>. Só serviços de manutenção precisam de OS já na cotação,
              e itens com destino "obra (etapa)" precisam da etapa.
            </span>
          </div>
        )}
        {itens.length === 0 ? (
          <button
            type="button"
            onClick={adicionarItem}
            className="w-full py-6 rounded-xl border border-dashed border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors text-sm flex flex-col items-center gap-1.5"
          >
            <Plus className="w-5 h-5" /> Adicionar primeiro item
          </button>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Descrição</th>
                  <th className="px-3 py-3 text-left font-semibold w-[110px]">Tipo</th>
                  <th className="px-3 py-3 text-right font-semibold w-[110px]">Qtd</th>
                  <th className="px-3 py-3 text-left font-semibold w-[90px]">Un</th>
                  <th className="px-3 py-3 text-left font-semibold w-[180px]">Destino</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {itens.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    insumos={insumos}
                    unidadesOptions={unidadesOptions}
                    obras={obras}
                    etapas={etapas}
                    equipamentos={equipamentos}
                    depositosMaterial={depositosMaterial}
                    tanquesCombustivel={tanquesCombustivel}
                    osDisponiveis={osDisponiveis}
                    onChange={(patch) => atualizarItem(item.id, patch)}
                    onRemove={() => removerItem(item.id)}
                    onAbrirCadastroInsumo={(nome) => {
                      setInsumoModalNomeInicial(nome);
                      setInsumoModalItemId(item.id);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Seção Fornecedores ────────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Fornecedores"
          subtitulo="Adicione todos que vão cotar (sem limite). Você pode cadastrar inline."
        />
        <FornecedorPicker
          fornecedores={fornecedores}
          jaSelecionados={cotFornecedores.map((cf) => cf.fornecedorId)}
          onSelect={adicionarFornecedor}
          onCreateInline={async (nome) => {
            const id = await onCreateFornecedor(nome);
            adicionarFornecedor(id);
            showToast({ kind: 'success', message: `Fornecedor "${nome}" cadastrado.` });
          }}
        />
        {cotFornecedores.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cotFornecedores.map((cf) => {
              const f = fornecedoresMap.get(cf.fornecedorId);
              return (
                <div
                  key={cf.id}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] text-sm"
                >
                  <span>{f?.nome ?? '?'}</span>
                  {cf.respondido && (
                    <span className="text-[10px] text-emerald-600 font-medium">✓</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removerFornecedor(cf.id)}
                    className="w-5 h-5 inline-flex items-center justify-center rounded-full text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    aria-label="Remover"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Mapa Comparativo ──────────────────────────────────────────── */}
      {cotFornecedores.length > 0 && itens.length > 0 && (
        <section>
          <SectionHeader
            titulo="Mapa comparativo"
            subtitulo="Preencha os preços por fornecedor. Selecione fornecedor + itens no fim para gerar OC."
          />
          <MapaComparativo
            itens={itens}
            cotFornecedores={cotFornecedores}
            fornecedoresMap={fornecedoresMap}
            fornecedorEscolhido={fornecedorEscolhido}
            itensEscolhidos={itensEscolhidos}
            onChangeFornecedorEscolhido={setFornecedorEscolhido}
            onToggleItem={toggleItem}
            onAtualizarPreco={atualizarPrecoItem}
            onAtualizarCampo={atualizarCampoFornecedor}
          />
          {fornecedorEscolhido && itensEscolhidos.size > 0 && onGerarOC && (
            <div className="mt-3 flex justify-end">
              <Button type="button" onClick={handleGerarOC}>
                <ShoppingCart className="w-4 h-4" />
                Gerar OC ({itensEscolhidos.size} {itensEscolhidos.size === 1 ? 'item' : 'itens'})
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Observações */}
      <section>
        <Label>Observações internas</Label>
        <textarea
          value={observacoes}
          onChange={(e) => { markDirty(); setObservacoes(e.target.value); }}
          rows={2}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </section>

      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-900 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        {initial && onAbrirEnviar && cotFornecedores.length > 0 && (
          <Button type="button" variant="secondary" onClick={() => onAbrirEnviar(construirCotacao())}>
            <MessageCircle className="w-4 h-4" /> Enviar para fornecedores
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <SubmitButton loading={submitting}>
          {initial ? 'Salvar alterações' : 'Criar cotação'}
        </SubmitButton>
      </div>
    </form>

    {/* Cadastro rápido de insumo a partir da tabela de itens */}
    <InsumoQuickModal
      open={insumoModalItemId !== null}
      onClose={() => {
        setInsumoModalItemId(null);
        setInsumoModalNomeInicial('');
      }}
      nomeInicial={insumoModalNomeInicial}
      categorias={categorias}
      tipoInsumo="material"
      onCriado={(novoInsumo) => {
        if (!insumoModalItemId) return;
        atualizarItem(insumoModalItemId, {
          descricao: novoInsumo.nome,
          unidade: novoInsumo.unidade as ItemPedidoCompra['unidade'],
          categoria: novoInsumo.categoria,
          insumoId: novoInsumo.id,
        });
      }}
    />
    </>
  );
}

// ─────────────────────────── auxiliares ──────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function SectionHeader({
  titulo, subtitulo, actionLabel, onAction,
}: { titulo: string; subtitulo?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] tracking-tight">{titulo}</h3>
        {subtitulo && <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5">{subtitulo}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function ItemRow({
  item, insumos, unidadesOptions, obras, etapas, equipamentos, depositosMaterial,
  tanquesCombustivel, osDisponiveis, onChange, onRemove, onAbrirCadastroInsumo,
}: {
  item: ItemPedidoCompra;
  insumos: Insumo[];
  unidadesOptions: { value: string; label: string }[];
  obras: Obra[];
  etapas: EtapaObra[];
  equipamentos: Equipamento[];
  depositosMaterial: DepositoMaterial[];
  tanquesCombustivel: Deposito[];
  osDisponiveis: OrdemServico[];
  onChange: (patch: Partial<ItemPedidoCompra>) => void;
  onRemove: () => void;
  onAbrirCadastroInsumo: (nomeInicial: string) => void;
}) {
  const insumoVinculado = item.insumoId
    ? insumos.find((i) => i.id === item.insumoId)
    : undefined;
  const tipoVisual = getTipoVisualInsumo(insumoVinculado);
  const ehPeca = tipoVisual === 'peca';
  const ehCombustivel = tipoVisual === 'combustivel';
  const tipoAtual: TipoItemCompra = item.tipo ?? 'material';
  const destino = item.tipoDestino;
  const destinosOk = destinosPermitidos(tipoVisual);

  // Conjuntos de opções derivadas do destino atual
  const etapasDaObra = useMemo(
    () => (item.obraId ? etapas.filter((e) => e.obraId === item.obraId) : etapas),
    [etapas, item.obraId]
  );
  const depositosFiltrados = useMemo(() => {
    const ativos = depositosMaterial.filter((d) => d.ativo !== false);
    if (destino === 'manutencao_equipamento') {
      // Almoxarifados de peças
      return ativos.filter((d) => d.ehAlmoxarifadoPecas === true);
    }
    if (destino === 'deposito_central') {
      // Depósitos sem obra vinculada (centrais)
      return ativos.filter((d) => !d.ehAlmoxarifadoPecas && (!d.obrasIds || d.obrasIds.length === 0));
    }
    if (destino === 'obra_deposito') {
      // Depósitos com obras vinculadas
      return ativos.filter((d) => !d.ehAlmoxarifadoPecas && d.obrasIds && d.obrasIds.length > 0);
    }
    if (destino === 'tanque_combustivel') {
      // Tanques são entidade separada (Deposito), retorna lista vazia aqui — usa tanquesCombustivel no JSX
      return [];
    }
    return ativos;
  }, [depositosMaterial, destino]);
  const tanquesAtivos = useMemo(
    () => tanquesCombustivel.filter((t) => t.ativo !== false),
    [tanquesCombustivel],
  );
  return (
    <tr className="hover:bg-[var(--color-surface-2)]/40 transition-colors">
      {/* DESCRIÇÃO — dropdown com busca + cadastro rápido */}
      <td className="px-3 py-2 align-top relative">
        <InsumoSelect
          insumos={insumos}
          insumoId={item.insumoId}
          descricao={item.descricao}
          onChange={(patch) => {
            const novoInsumo = patch.insumoId
              ? insumos.find((i) => i.id === patch.insumoId)
              : undefined;
            const novoTipoVisual = getTipoVisualInsumo(novoInsumo);
            // Item.tipo no domínio é só 'material' ou 'servico' — peça/combustível também são "material".
            const novoItemTipo: TipoItemCompra = ehServico(novoTipoVisual) ? 'servico' : 'material';
            const destinoForcado = destinoForcadoPorTipo(novoTipoVisual);
            const destinosOkNovo = destinosPermitidos(novoTipoVisual);
            const destinoAtualOk = item.tipoDestino && destinosOkNovo.includes(item.tipoDestino);
            const destinoFinal = destinoForcado ?? (destinoAtualOk ? item.tipoDestino : undefined);
            // Limpa campos vinculados quando muda o destino
            const limpaObra = destinoFinal !== 'obra_etapa' && destinoFinal !== 'obra_deposito';
            onChange({
              insumoId: patch.insumoId,
              descricao: patch.descricao,
              tipo: novoItemTipo,
              unidade: (patch.unidade as ItemPedidoCompra['unidade']) ?? item.unidade,
              categoria: patch.categoria ?? item.categoria,
              tipoDestino: destinoFinal,
              depositoDestinoId: undefined, // sempre limpa — usuário re-escolhe
              etapaObraId: destinoFinal === 'obra_etapa' ? item.etapaObraId : undefined,
              obraId: limpaObra ? undefined : item.obraId,
            });
          }}
          onCreateNew={(nome) => onAbrirCadastroInsumo(nome)}
          compact
        />
      </td>

      {/* TIPO — chip automático quando há insumo; toggle simples quando texto livre */}
      <td className="px-3 py-2 align-top">
        {insumoVinculado ? (
          <span
            className={`inline-flex items-center h-7 px-2 rounded-md text-[11.5px] font-medium border ${TIPO_VISUAL_CHIP_CLASS[tipoVisual]}`}
            title={`Tipo do insumo: ${TIPO_VISUAL_LABEL[tipoVisual]}`}
          >
            {TIPO_VISUAL_ICON[tipoVisual]}{TIPO_VISUAL_LABEL[tipoVisual]}
          </span>
        ) : (
          <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden" role="group" aria-label="Tipo do item">
            <button
              type="button"
              onClick={() => onChange({ tipo: 'material' })}
              className={
                'px-2 h-7 text-[11.5px] font-medium transition-colors ' +
                (tipoAtual === 'material'
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'bg-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]')
              }
            >
              Material
            </button>
            <button
              type="button"
              onClick={() => onChange({ tipo: 'servico', insumoId: undefined })}
              className={
                'px-2 h-7 text-[11.5px] font-medium border-l border-[var(--color-border)] transition-colors ' +
                (tipoAtual === 'servico'
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'bg-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]')
              }
            >
              Serviço
            </button>
          </div>
        )}
      </td>

      {/* QTD */}
      <td className="px-3 py-2 align-top">
        <input
          type="number"
          step="any"
          min="0"
          value={item.quantidade}
          onChange={(e) => onChange({ quantidade: Number(e.target.value) })}
          className="w-full px-2.5 py-1.5 text-sm text-right rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />
      </td>

      {/* UN — chip automático quando há insumo; SmartSelect quando texto livre */}
      <td className="px-3 py-2 align-top">
        {insumoVinculado ? (
          <span className="inline-flex items-center justify-center h-7 px-2 min-w-[40px] rounded-md text-[11.5px] font-medium bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)] uppercase">
            {item.unidade || insumoVinculado.unidade}
          </span>
        ) : (
          <SmartSelect
            value={item.unidade}
            onChange={(e) => onChange({ unidade: e.target.value as ItemPedidoCompra['unidade'] })}
            usePortal
            className="w-full px-2 py-1.5 text-sm text-left rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)] flex items-center min-h-[32px]"
          >
            <option value="">—</option>
            {unidadesOptions.map((u) => (<option key={u.value} value={u.value}>{u.label}</option>))}
          </SmartSelect>
        )}
      </td>

      {/* DESTINO — peça/combustível travados; outros filtrados por destinos permitidos */}
      <td className="px-3 py-2 align-top">
        <div className="space-y-1.5">
          {ehPeca || ehCombustivel ? (
            // Peça e Combustível: destino travado (sem dropdown), mostra chip read-only.
            <div
              className={
                'w-full px-2.5 py-1.5 text-sm rounded-md border flex items-center gap-1.5 min-h-[32px] ' +
                (ehPeca
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800'
                  : 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-800')
              }
              title={ehPeca ? 'Peça vai sempre pro almoxarifado de peças' : 'Combustível vai sempre pra um tanque'}
            >
              <span className="text-xs">{ehPeca ? '🔧' : '⛽'}</span>
              <span className="font-medium text-[12.5px]">
                {ehPeca ? 'Almoxarifado de peças' : 'Tanque de combustível'}
              </span>
            </div>
          ) : (
            <SmartSelect
              value={destino ?? ''}
              onChange={(e) => {
                const novo = e.target.value as TipoDestinoOC | '';
                onChange({
                  tipoDestino: novo || undefined,
                  // Quando muda destino, limpa campos vinculados que não fazem sentido
                  etapaObraId: novo === 'obra_etapa' ? item.etapaObraId : undefined,
                  depositoDestinoId: ['obra_deposito', 'deposito_central', 'manutencao_equipamento', 'tanque_combustivel'].includes(novo)
                    ? item.depositoDestinoId : undefined,
                  osId: novo === 'manutencao_equipamento' ? item.osId : undefined,
                  equipamentoId: novo === 'manutencao_equipamento' ? item.equipamentoId : undefined,
                  obraId: ['obra_etapa', 'obra_deposito'].includes(novo) ? item.obraId : undefined,
                });
              }}
              usePortal
              className="w-full px-2 py-1.5 text-sm text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] focus:outline-none focus:border-[var(--color-accent)] flex items-center min-h-[32px]"
            >
              <option value="">— selecione —</option>
              {destinosOk.includes('obra_etapa') && (
                <option value="obra_etapa">{DESTINO_PEDIDO_LABEL_COTACAO.obra_etapa}</option>
              )}
              {destinosOk.includes('obra_deposito') && (
                <option value="obra_deposito">{DESTINO_PEDIDO_LABEL_COTACAO.obra_deposito}</option>
              )}
              {destinosOk.includes('deposito_central') && (
                <option value="deposito_central">{DESTINO_PEDIDO_LABEL_COTACAO.deposito_central}</option>
              )}
              {destinosOk.includes('sede') && (
                <option value="sede">{DESTINO_PEDIDO_LABEL_COTACAO.sede}</option>
              )}
              {destinosOk.includes('manutencao_equipamento') && (
                <option value="manutencao_equipamento">{DESTINO_PEDIDO_LABEL_COTACAO.manutencao_equipamento}</option>
              )}
              {destinosOk.includes('tanque_combustivel') && (
                <option value="tanque_combustivel">{DESTINO_PEDIDO_LABEL_COTACAO.tanque_combustivel}</option>
              )}
            </SmartSelect>
          )}

          {/* Sub-campos condicionais por destino */}
          {(destino === 'obra_etapa' || destino === 'obra_deposito') && (
            <SmartSelect
              value={item.obraId ?? ''}
              onChange={(e) => onChange({ obraId: e.target.value || undefined, etapaObraId: undefined, depositoDestinoId: undefined })}
              usePortal
              className="w-full px-2 py-1 text-[11.5px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] flex items-center min-h-[28px]"
            >
              <option value="">— escolha a obra —</option>
              {obras.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
            </SmartSelect>
          )}
          {destino === 'obra_etapa' && item.obraId && (
            <SmartSelect
              value={item.etapaObraId ?? ''}
              onChange={(e) => onChange({ etapaObraId: e.target.value || undefined })}
              usePortal
              className="w-full px-2 py-1 text-[11.5px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] flex items-center min-h-[28px]"
            >
              <option value="">— escolha a etapa —</option>
              {etapasDaObra.map((et) => (<option key={et.id} value={et.id}>{et.nome}</option>))}
            </SmartSelect>
          )}

          {destino === 'tanque_combustivel' && (
            <SmartSelect
              value={item.depositoDestinoId ?? ''}
              onChange={(e) => onChange({ depositoDestinoId: e.target.value || undefined })}
              usePortal
              title="Opcional — você pode definir o tanque específico só no recebimento da OC"
              className="w-full px-2 py-1 text-[11.5px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] flex items-center min-h-[28px]"
            >
              <option value="">— tanque (opcional, define no recebimento) —</option>
              {tanquesAtivos.length === 0 ? (
                <option disabled>Nenhum tanque cadastrado</option>
              ) : (
                tanquesAtivos.map((t) => (
                  <option key={t.id} value={t.id}>⛽ {t.nome}</option>
                ))
              )}
            </SmartSelect>
          )}

          {(destino === 'obra_deposito' || destino === 'deposito_central') && (
            <SmartSelect
              value={item.depositoDestinoId ?? ''}
              onChange={(e) => onChange({ depositoDestinoId: e.target.value || undefined })}
              usePortal
              title="Opcional — você pode definir o depósito específico só no recebimento da OC"
              className="w-full px-2 py-1 text-[11.5px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] flex items-center min-h-[28px]"
            >
              <option value="">— depósito (opcional, define no recebimento) —</option>
              {depositosFiltrados.length === 0 ? (
                <option disabled>Nenhum depósito cadastrado</option>
              ) : (
                depositosFiltrados.map((d) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))
              )}
            </SmartSelect>
          )}

          {destino === 'manutencao_equipamento' && (
            <>
              {/* OS aberta (obrigatório se for serviço; opcional pra peças que vão pro almox) */}
              <SmartSelect
                value={item.osId ?? ''}
                onChange={(e) => {
                  const osNova = e.target.value || undefined;
                  // Ao escolher OS, herda o equipamento dela automaticamente
                  const osObj = osNova ? osDisponiveis.find((o) => o.id === osNova) : undefined;
                  onChange({
                    osId: osNova,
                    equipamentoId: osObj?.equipamentoId ?? item.equipamentoId,
                  });
                }}
                usePortal
              className="w-full px-2 py-1 text-[11.5px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] flex items-center min-h-[28px]"
              >
                <option value="">
                  {tipoAtual === 'servico'
                    ? '— OS (obrigatória) —'
                    : '— OS (opcional) —'}
                </option>
                {osDisponiveis.length === 0 ? (
                  <option disabled>Nenhuma OS aberta</option>
                ) : (
                  osDisponiveis.map((os) => {
                    const eq = equipamentos.find((e) => e.id === os.equipamentoId);
                    const codigo = eq?.codigoPatrimonio || '';
                    const nomeEq = eq?.modelo || eq?.tipo || '';
                    const eqLabel = codigo && nomeEq ? `${codigo} ${nomeEq}` : (codigo || nomeEq || 'sem equipamento');
                    return (
                      <option key={os.id} value={os.id}>
                        {os.numero} — {eqLabel}
                      </option>
                    );
                  })
                )}
              </SmartSelect>

              {/* Almoxarifado de peças — opcional na cotação; define no recebimento. */}
              {tipoAtual === 'material' && (
                <SmartSelect
                  value={item.depositoDestinoId ?? ''}
                  onChange={(e) => onChange({ depositoDestinoId: e.target.value || undefined })}
                  usePortal
                  title="Opcional — você pode definir o almoxarifado específico só no recebimento da OC"
                  className="w-full px-2 py-1 text-[11.5px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] flex items-center min-h-[28px]"
                >
                  <option value="">— almoxarifado (opcional, define no recebimento) —</option>
                  {depositosFiltrados.length === 0 ? (
                    <option disabled>Nenhum almoxarifado de peças cadastrado</option>
                  ) : (
                    depositosFiltrados.map((d) => (
                      <option key={d.id} value={d.id}>🔧 {d.nome}</option>
                    ))
                  )}
                </SmartSelect>
              )}
            </>
          )}
        </div>
      </td>

      {/* REMOVER */}
      <td className="px-2 py-2 align-top text-center">
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 transition-colors"
          aria-label="Remover"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// Labels curtos pros chips de destino na linha da cotação (inline na ItemRow)
const DESTINO_PEDIDO_LABEL_COTACAO: Record<TipoDestinoOC, string> = {
  obra_etapa: 'Obra/Etapa',
  obra_deposito: 'Depósito da obra',
  deposito_central: 'Depósito Central',
  sede: 'Sede',
  manutencao_equipamento: 'Manutenção',
  tanque_combustivel: 'Tanque',
};

// ─── FornecedorPicker (busca + cadastro inline) ──────────────────────────
function FornecedorPicker({
  fornecedores, jaSelecionados, onSelect, onCreateInline,
}: {
  fornecedores: Fornecedor[];
  jaSelecionados: string[];
  onSelect: (id: string) => void;
  onCreateInline: (nome: string) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return fornecedores
      .filter((f) => f.ativo !== false)
      .filter((f) => !jaSelecionados.includes(f.id))
      .filter((f) => !q || f.nome.toLowerCase().includes(q))
      .slice(0, 8);
  }, [fornecedores, jaSelecionados, busca]);

  const ehNovo = busca.trim().length >= 2 &&
    !fornecedores.find((f) => f.nome.toLowerCase().trim() === busca.toLowerCase().trim());

  const criar = async () => {
    setCriando(true);
    try {
      await onCreateInline(busca.trim());
      setBusca('');
      setAberto(false);
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-subtle)] pointer-events-none" />
        <input
          type="text"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
          placeholder="Buscar fornecedor ou digitar nome novo…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
        />
      </div>

      {aberto && (filtrados.length > 0 || ehNovo) && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg max-h-64 overflow-auto">
          {filtrados.map((f) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={() => { onSelect(f.id); setBusca(''); setAberto(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] flex items-center justify-between"
            >
              <span>{f.nome}</span>
              {f.cnpj && <span className="text-[10px] text-[var(--color-fg-subtle)]">{f.cnpj}</span>}
            </button>
          ))}
          {ehNovo && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); criar(); }}
              disabled={criando}
              className="w-full text-left px-3 py-2 text-sm border-t border-[var(--color-border)] bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 text-emerald-800 flex items-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {criando ? 'Cadastrando…' : `Cadastrar "${busca.trim()}" como novo fornecedor`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mapa Comparativo ────────────────────────────────────────────────────
function MapaComparativo({
  itens, cotFornecedores, fornecedoresMap,
  fornecedorEscolhido, itensEscolhidos,
  onChangeFornecedorEscolhido, onToggleItem,
  onAtualizarPreco, onAtualizarCampo,
}: {
  itens: ItemPedidoCompra[];
  cotFornecedores: CotacaoFornecedor[];
  fornecedoresMap: Map<string, Fornecedor>;
  fornecedorEscolhido: string | null;
  itensEscolhidos: Set<string>;
  onChangeFornecedorEscolhido: (id: string | null) => void;
  onToggleItem: (id: string) => void;
  onAtualizarPreco: (cfId: string, itemId: string, preco: number, marca?: string) => void;
  onAtualizarCampo: (cfId: string, patch: Partial<CotacaoFornecedor>) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
      <table className="text-sm w-full">
        <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">
          <tr>
            <th className="px-3 py-2 text-left font-semibold sticky left-0 bg-[var(--color-surface-2)] z-10 w-72">
              Item
            </th>
            <th className="px-2 py-2 text-center w-10">✓</th>
            {cotFornecedores.map((cf) => {
              const f = fornecedoresMap.get(cf.fornecedorId);
              const escolhido = fornecedorEscolhido === cf.fornecedorId;
              return (
                <th
                  key={cf.id}
                  className={
                    'px-3 py-2 text-left font-semibold min-w-[170px] ' +
                    (escolhido ? 'bg-[var(--color-accent)]/10' : '')
                  }
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="fornec_oc"
                      checked={escolhido}
                      onChange={() => onChangeFornecedorEscolhido(escolhido ? null : cf.fornecedorId)}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="truncate">{f?.nome ?? '?'}</span>
                    {cf.respondido && <span className="text-emerald-600">✓</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {itens.map((item) => {
            const escolhido = itensEscolhidos.has(item.id);
            return (
              <tr key={item.id} className={escolhido ? 'bg-[var(--color-accent)]/5' : ''}>
                <td className="px-3 py-2 sticky left-0 bg-[var(--color-surface-1)] z-10">
                  <div className="text-[var(--color-fg)]">{item.descricao || <span className="italic text-[var(--color-fg-subtle)]">sem descrição</span>}</div>
                  <div className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">
                    {item.quantidade} {item.unidade} · {item.tipo === 'servico' ? 'Serviço' : 'Material'}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={escolhido}
                    onChange={() => onToggleItem(item.id)}
                    className="accent-[var(--color-accent)]"
                  />
                </td>
                {cotFornecedores.map((cf) => {
                  const ip = cf.itensPrecos.find((x) => x.itemPedidoId === item.id);
                  return (
                    <td key={cf.id} className="px-3 py-2">
                      {/* Wrapper relativo pra ancorar o prefixo "R$" dentro do input.
                          O padding-left dá espaço pro símbolo não sobrepor o número. */}
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--color-fg-subtle)] pointer-events-none select-none">
                          R$
                        </span>
                        <input
                          type="number" step="0.01" min="0"
                          value={ip?.precoUnitario ?? 0}
                          onChange={(e) => onAtualizarPreco(cf.id, item.id, Number(e.target.value), ip?.marca)}
                          className="w-full pl-8 pr-2 py-1 text-sm text-right rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="marca"
                        value={ip?.marca ?? ''}
                        onChange={(e) => onAtualizarPreco(cf.id, item.id, ip?.precoUnitario ?? 0, e.target.value)}
                        className="w-full px-2 py-1 text-[11px] mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* Linha condição de pagamento + prazo */}
          <tr className="bg-[var(--color-surface-2)]/30">
            <td className="px-3 py-2 sticky left-0 bg-[var(--color-surface-2)]/30 z-10 text-xs font-semibold text-[var(--color-fg-muted)]">
              Condição / Prazo
            </td>
            <td></td>
            {cotFornecedores.map((cf) => (
              <td key={cf.id} className="px-3 py-2">
                <input
                  type="text"
                  placeholder="ex: 30/60d"
                  value={cf.condicaoPagamento}
                  onChange={(e) => onAtualizarCampo(cf.id, { condicaoPagamento: e.target.value })}
                  className="w-full px-2 py-1 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
                <input
                  type="text"
                  placeholder="prazo entrega"
                  value={cf.prazoEntrega}
                  onChange={(e) => onAtualizarCampo(cf.id, { prazoEntrega: e.target.value })}
                  className="w-full px-2 py-1 text-xs mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </td>
            ))}
          </tr>

          {/* Total */}
          <tr className="bg-[var(--color-surface-2)] font-semibold">
            <td className="px-3 py-2 sticky left-0 bg-[var(--color-surface-2)] z-10 text-sm">Total</td>
            <td></td>
            {cotFornecedores.map((cf) => (
              <td key={cf.id} className="px-3 py-2 text-right tabular-nums text-sm text-[var(--color-fg)]">
                {cf.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
