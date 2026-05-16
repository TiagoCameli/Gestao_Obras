/**
 * PedidoCompraFormV2 — formulário premium "página única empilhada".
 *
 * Modelo híbrido: aceita itens listados E/OU descrição livre (a validação
 * exige pelo menos um). Suporta anexos (foto pela câmera, drag-drop, ou
 * seleção tradicional). Cadastro de novo insumo direto da linha do item, com
 * dedup fuzzy.
 *
 * Estrutura visual:
 *   ┌───────────────────────────────────┐
 *   │  Cabeçalho (número/data/obra/...) │
 *   │  ───── Itens ─────                │
 *   │  ───── Descrição livre ─────      │
 *   │  ───── Anexos ─────               │
 *   │  [Cancelar]    [Salvar pedido]    │
 *   └───────────────────────────────────┘
 */
import { useCallback, useMemo, useState } from 'react';
import { Trash2, Plus, AlertCircle, Sparkles, Calendar, FileText } from 'lucide-react';
import type {
  PedidoCompra,
  ItemPedidoCompra,
  Obra,
  EtapaObra,
  Insumo,
  UnidadeMedida,
  UrgenciaPedidoCompra,
  TipoItemCompra,
  TipoDestinoOC,
} from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { validarPedidoCompra, buscarInsumosSimilares } from '../../utils/comprasValidator';
import AnexoUploader from './AnexoUploader';
import { useUploadAnexoCompras } from '../../hooks/useComprasAnexos';

interface Props {
  initial: PedidoCompra | null;
  obras: Obra[];
  /** Etapas — usadas no popover de "Destino sugerido" por item */
  etapas?: EtapaObra[];
  insumos: Insumo[];
  unidades: UnidadeMedida[];
  categorias: { value: string; label: string }[];
  proximoNumero: string;
  nomeUsuario?: string;
  onSubmit: (pedido: PedidoCompra, anexosPendentes: File[]) => Promise<void>;
  onCancel: () => void;
}

/** Labels curtos pros chips de destino dentro da tabela de itens */
const DESTINO_PEDIDO_LABEL: Record<TipoDestinoOC, string> = {
  obra_etapa: 'Obra/Etapa',
  obra_deposito: 'Depósito da obra',
  deposito_central: 'Depósito Central',
  sede: 'Sede',
  manutencao_equipamento: 'Manutenção',
  tanque_combustivel: 'Tanque',
};

const URGENCIAS: { value: UrgenciaPedidoCompra; label: string; chip: string }[] = [
  { value: 'baixa',    label: 'Baixa',    chip: 'bg-slate-50 dark:bg-slate-900 border-slate-300 text-slate-700 dark:text-slate-300' },
  { value: 'normal',   label: 'Normal',   chip: 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-700 dark:text-blue-300' },
  { value: 'alta',     label: 'Alta',     chip: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-300' },
  { value: 'critica',  label: 'Crítica',  chip: 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-700 dark:text-rose-300' },
];

function genItemId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function novoItemVazio(): ItemPedidoCompra {
  return {
    id: genItemId(),
    descricao: '',
    categoria: 'outros',
    quantidade: 1,
    unidade: 'un',
    tipo: 'material',
    insumoId: undefined,
    criarNaBase: false,
  };
}

export default function PedidoCompraFormV2({
  initial,
  obras,
  etapas = [],
  insumos,
  unidades,
  categorias,
  proximoNumero,
  nomeUsuario,
  onSubmit,
  onCancel,
}: Props) {
  const { temAcao, usuario } = useAuth();
  const { showToast } = useToast();
  const podeCriarInsumo = temAcao('cadastrar_insumo_via_compra');
  const adicionarInsumoMut = useAdicionarInsumo();
  // useUploadAnexoCompras é importado por AnexoUploader internamente; aqui
  // só garantimos a interface fluindo. Caller faz o upload pós-save.
  void useUploadAnexoCompras;

  // ── Estado inicial ─────────────────────────────────────────────────────
  const [numero] = useState(initial?.numero || proximoNumero);
  const [data, setData] = useState(initial?.data || new Date().toISOString().slice(0, 10));
  const [solicitante, setSolicitante] = useState(initial?.solicitante || nomeUsuario || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [urgencia, setUrgencia] = useState<UrgenciaPedidoCompra>(initial?.urgencia || 'normal');
  const [valorEstimado, setValorEstimado] = useState<string>(
    initial?.valorEstimado != null ? String(initial.valorEstimado) : ''
  );
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [descricaoLivre, setDescricaoLivre] = useState(initial?.descricaoLivre || '');
  const [itens, setItens] = useState<ItemPedidoCompra[]>(
    initial?.itens && initial.itens.length > 0
      ? initial.itens.map((i) => ({
          ...i,
          tipo: i.tipo ?? 'material',
        }))
      : []
  );
  const [anexosPendentes, setAnexosPendentes] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ── Itens helpers ──────────────────────────────────────────────────────
  const adicionarItem = useCallback(() => {
    setItens((prev) => [...prev, novoItemVazio()]);
  }, []);

  const atualizarItem = useCallback(
    (id: string, patch: Partial<ItemPedidoCompra>) => {
      setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    []
  );

  const removerItem = useCallback((id: string) => {
    setItens((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // ── Cadastrar insumo ad-hoc ────────────────────────────────────────────
  const cadastrarInsumoNovo = useCallback(
    async (item: ItemPedidoCompra): Promise<string | null> => {
      const nome = item.descricao.trim();
      if (!nome) {
        showToast({ kind: 'error', message: 'Descrição vazia — preencha antes de cadastrar.' });
        return null;
      }
      if (!item.unidade) {
        showToast({ kind: 'error', message: 'Selecione a unidade antes de cadastrar.' });
        return null;
      }
      try {
        const id = genItemId();
        await adicionarInsumoMut.mutateAsync({
          id,
          nome,
          tipo: item.tipo === 'servico' ? 'servico' : 'material',
          unidade: item.unidade,
          descricao: '',
          ativo: true,
          criadoPor: usuario?.nome || '',
          categoria: item.categoria,
        });
        showToast({ kind: 'success', message: `"${nome}" cadastrado na base.` });
        atualizarItem(item.id, { insumoId: id, criarNaBase: false });
        return id;
      } catch (e) {
        showToast({ kind: 'error', message: 'Falha ao cadastrar insumo: ' + (e as Error).message });
        return null;
      }
    },
    [adicionarInsumoMut, usuario, showToast, atualizarItem]
  );

  // ── Validação prévia (botão fica enabled?) ─────────────────────────────
  const validacao = useMemo(() => validarPedidoCompra({ itens, descricaoLivre, solicitante }), [itens, descricaoLivre, solicitante]);
  const podeSalvar = validacao.ok && !!solicitante.trim();

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      const v = validarPedidoCompra({ itens, descricaoLivre, solicitante });
      if (!v.ok) {
        setErro(v.erro);
        showToast({ kind: 'error', message: v.erro });
        return;
      }

      setSubmitting(true);
      try {
        const itensLimpos = itens
          .filter((i) => i.descricao.trim().length > 0)
          .map((i) => ({
            ...i,
            descricao: i.descricao.trim(),
            quantidade: Math.max(0, Number(i.quantidade || 0)),
          }));

        const pedido: PedidoCompra = {
          id: initial?.id || genItemId(),
          numero,
          data,
          obraId,
          solicitante: solicitante.trim(),
          urgencia,
          status: initial?.status || 'pendente',
          observacoes: observacoes.trim(),
          descricaoLivre: descricaoLivre.trim(),
          valorEstimado: valorEstimado ? Number(valorEstimado) : undefined,
          itens: itensLimpos,
          criadoPor: initial?.criadoPor || usuario?.nome || '',
          atualizadoPor: usuario?.nome || '',
          // Auditoria preservada
          aprovadoPor: initial?.aprovadoPor,
          aprovadoEm: initial?.aprovadoEm,
          reprovadoPor: initial?.reprovadoPor,
          reprovadoEm: initial?.reprovadoEm,
          motivoReprovacao: initial?.motivoReprovacao,
        };

        await onSubmit(pedido, anexosPendentes);
      } catch (err) {
        setErro((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      itens, descricaoLivre, solicitante, initial, numero, data, obraId, urgencia,
      observacoes, valorEstimado, usuario, anexosPendentes, onSubmit, showToast,
    ]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  const obrasOptions = obras.map((o) => ({ value: o.id, label: o.nome }));
  const unidadesOptions = unidades.length > 0
    ? unidades.map((u) => ({ value: u.sigla, label: u.nome }))
    : [
        { value: 'un', label: 'un' },{ value: 'kg', label: 'kg' },{ value: 'm', label: 'm' },
        { value: 'm2', label: 'm²' },{ value: 'm3', label: 'm³' },{ value: 'lt', label: 'L' },
        { value: 'sc', label: 'sc' },{ value: 'pc', label: 'pç' },{ value: 'cx', label: 'cx' },
        { value: 'rl', label: 'rl' },{ value: 'tb', label: 'tb' },
        { value: 'vb', label: 'verba' },{ value: 'h', label: 'hora' },{ value: 'd', label: 'diária' },
      ];

  return (
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
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="pl-9" required />
          </div>
        </div>
        <div>
          <Label>Solicitante <span className="text-rose-500">*</span></Label>
          <Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} required placeholder="Nome de quem está pedindo" />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <Label>Obra</Label>
          <Select
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            options={[{ value: '', label: '— sem obra específica —' }, ...obrasOptions]}
          />
        </div>
        <div>
          <Label>Urgência</Label>
          <div className="flex flex-wrap gap-1.5">
            {URGENCIAS.map((u) => {
              const ativo = urgencia === u.value;
              return (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgencia(u.value)}
                  className={
                    'px-3 h-[40px] rounded-lg border text-xs font-medium transition-all ' +
                    (ativo
                      ? `${u.chip} ring-2 ring-offset-1 ring-offset-[var(--color-surface-1)] ring-current`
                      : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]')
                  }
                >
                  {u.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Valor estimado (opcional)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={valorEstimado}
            onChange={(e) => setValorEstimado(e.target.value)}
            placeholder="R$ 0,00"
          />
        </div>
      </header>

      {/* ── Seção Itens ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Itens"
          subtitulo="Liste materiais e/ou serviços (opcional se preencher a descrição)"
          actionLabel="Adicionar item"
          onAction={adicionarItem}
        />

        {itens.length === 0 ? (
          <EmptyItens onAdd={adicionarItem} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Descrição</th>
                  <th className="px-3 py-3 text-left font-semibold w-28">Tipo</th>
                  <th className="px-3 py-3 text-left font-semibold w-32">Categoria</th>
                  <th className="px-3 py-3 text-right font-semibold w-24">Qtd</th>
                  <th className="px-3 py-3 text-left font-semibold w-20">Un</th>
                  <th className="px-3 py-3 text-left font-semibold w-44">Destino sugerido</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {itens.map((item) => (
                  <ItemPedidoRow
                    key={item.id}
                    item={item}
                    insumos={insumos}
                    unidadesOptions={unidadesOptions}
                    categorias={categorias}
                    etapasDaObra={etapas.filter((e) => e.obraId === obraId)}
                    obraDoPedidoId={obraId}
                    podeCriarInsumo={podeCriarInsumo}
                    onChange={(patch) => atualizarItem(item.id, patch)}
                    onRemove={() => removerItem(item.id)}
                    onCadastrarInsumo={() => cadastrarInsumoNovo(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Seção Descrição livre ─────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Descrição livre"
          subtitulo="Use quando o pedido for difícil de listar como itens (ex.: 'preciso fazer reparo no km 38, urgente')"
        />
        <textarea
          value={descricaoLivre}
          onChange={(e) => setDescricaoLivre(e.target.value)}
          rows={4}
          placeholder="Descreva o que precisa ser comprado…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </section>

      {/* ── Seção Anexos ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Anexos"
          subtitulo="Fotos do local, especificações, orçamentos, modelos…"
        />
        <AnexoUploader
          entidade="pedido"
          entidadeId={initial?.id || ''}
          enviadoPor={usuario?.nome || ''}
          pendentes={anexosPendentes}
          onPendingChange={setAnexosPendentes}
        />
      </section>

      {/* ── Observações livres ────────────────────────────────────────── */}
      <section>
        <Label>Observações internas</Label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          placeholder="Notas para Compras (não vai para o fornecedor)…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </section>

      {/* ── Erros + footer ────────────────────────────────────────────── */}
      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-900 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!podeSalvar || submitting}>
          {submitting ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar pedido'}
        </Button>
      </div>
    </form>
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
}: {
  titulo: string;
  subtitulo?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
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

function EmptyItens({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full py-8 rounded-xl border border-dashed border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors text-sm flex flex-col items-center gap-1.5"
    >
      <Plus className="w-5 h-5" />
      Adicionar item ao pedido
      <span className="text-xs text-[var(--color-fg-subtle)]">ou descreva em texto livre abaixo</span>
    </button>
  );
}

// ─── Linha do item (com autocomplete e dedup) ────────────────────────────
function ItemPedidoRow({
  item, insumos, unidadesOptions, categorias, etapasDaObra, obraDoPedidoId, podeCriarInsumo,
  onChange, onRemove, onCadastrarInsumo,
}: {
  item: ItemPedidoCompra;
  insumos: Insumo[];
  unidadesOptions: { value: string; label: string }[];
  categorias: { value: string; label: string }[];
  etapasDaObra: EtapaObra[];
  obraDoPedidoId: string;
  podeCriarInsumo: boolean;
  onChange: (patch: Partial<ItemPedidoCompra>) => void;
  onRemove: () => void;
  onCadastrarInsumo: () => Promise<string | null>;
}) {
  const [aberto, setAberto] = useState(false);

  // Sugestões de insumos parecidos
  const sugestoes = useMemo(() => {
    if (item.descricao.trim().length < 2) return [];
    return buscarInsumosSimilares(item.descricao, insumos, 5);
  }, [item.descricao, insumos]);

  const insumoSelecionado = insumos.find((i) => i.id === item.insumoId);
  const ehItemNovo = !item.insumoId && item.descricao.trim().length >= 2 && sugestoes.length === 0;
  const temDuplicataExata = useMemo(() => {
    if (!item.descricao.trim() || item.insumoId) return null;
    const t = item.descricao.trim().toLowerCase();
    return insumos.find((i) => i.nome.trim().toLowerCase() === t) ?? null;
  }, [item.descricao, item.insumoId, insumos]);

  return (
    <tr className="hover:bg-[var(--color-surface-2)]/40 transition-colors">
      {/* Descrição com autocomplete */}
      <td className="px-3 py-2 align-top relative">
        <input
          type="text"
          value={item.descricao}
          onChange={(e) => {
            onChange({ descricao: e.target.value, insumoId: undefined });
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar ou digitar novo…"
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />

        {insumoSelecionado && (
          <div className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5 ml-2.5">
            ✓ <span className="text-emerald-600">vinculado</span> a {insumoSelecionado.nome}
          </div>
        )}

        {temDuplicataExata && !insumoSelecionado && (
          <button
            type="button"
            onClick={() => onChange({ insumoId: temDuplicataExata.id, unidade: (temDuplicataExata.unidade as ItemPedidoCompra['unidade']) ?? item.unidade })}
            className="text-[11px] mt-0.5 ml-2.5 text-amber-700 hover:underline"
          >
            ⚠ Já existe na base — vincular a "{temDuplicataExata.nome}"
          </button>
        )}

        {/* Dropdown de sugestões */}
        {aberto && (sugestoes.length > 0 || (ehItemNovo && podeCriarInsumo)) && (
          <div className="absolute z-30 left-2 right-2 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg max-h-56 overflow-auto">
            {sugestoes.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={() => {
                  const ins = insumos.find((i) => i.id === s.id);
                  onChange({
                    insumoId: s.id,
                    descricao: s.nome,
                    unidade: (ins?.unidade as ItemPedidoCompra['unidade']) ?? item.unidade,
                    categoria: ins?.categoria ?? item.categoria,
                  });
                  setAberto(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] flex items-center justify-between gap-2"
              >
                <span className="truncate">{s.nome}</span>
                <span className="text-[10px] text-[var(--color-fg-subtle)]">
                  {Math.round(s.similaridade * 100)}% match
                </span>
              </button>
            ))}
            {ehItemNovo && podeCriarInsumo && (
              <button
                type="button"
                onMouseDown={() => onCadastrarInsumo()}
                className="w-full text-left px-3 py-2 text-sm border-t border-[var(--color-border)] bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Cadastrar "{item.descricao.trim()}" como novo insumo
              </button>
            )}
          </div>
        )}
      </td>

      {/* Tipo */}
      <td className="px-3 py-2 align-top">
        <select
          value={item.tipo ?? 'material'}
          onChange={(e) => onChange({ tipo: e.target.value as TipoItemCompra })}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        >
          <option value="material">Material</option>
          <option value="servico">Serviço</option>
        </select>
      </td>

      {/* Categoria */}
      <td className="px-3 py-2 align-top">
        <select
          value={item.categoria}
          onChange={(e) => onChange({ categoria: e.target.value })}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        >
          <option value="outros">Outros</option>
          {categorias.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </td>

      {/* Quantidade */}
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

      {/* Unidade */}
      <td className="px-3 py-2 align-top">
        <select
          value={item.unidade}
          onChange={(e) => onChange({ unidade: e.target.value as ItemPedidoCompra['unidade'] })}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        >
          {unidadesOptions.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </td>

      {/* Destino sugerido (OPCIONAL — pode preencher pra adiantar a OC) */}
      <td className="px-3 py-2 align-top">
        <select
          value={item.tipoDestino ?? ''}
          onChange={(e) => {
            const novo = e.target.value as TipoDestinoOC | '';
            // Limpa etapa se mudar pra destino que não usa etapa
            const limpaEtapa = novo !== 'obra_etapa' ? { etapaObraId: undefined } : {};
            onChange({ tipoDestino: novo || undefined, ...limpaEtapa });
          }}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        >
          <option value="">— deixar pra OC —</option>
          <option value="obra_etapa">{DESTINO_PEDIDO_LABEL.obra_etapa}</option>
          <option value="obra_deposito">{DESTINO_PEDIDO_LABEL.obra_deposito}</option>
          <option value="deposito_central">{DESTINO_PEDIDO_LABEL.deposito_central}</option>
          <option value="sede">{DESTINO_PEDIDO_LABEL.sede}</option>
          <option value="manutencao_equipamento">{DESTINO_PEDIDO_LABEL.manutencao_equipamento}</option>
          <option value="tanque_combustivel">{DESTINO_PEDIDO_LABEL.tanque_combustivel}</option>
        </select>
        {/* Quando destino = obra_etapa, mostra a etapa específica */}
        {item.tipoDestino === 'obra_etapa' && (
          obraDoPedidoId ? (
            <select
              value={item.etapaObraId ?? ''}
              onChange={(e) => onChange({ etapaObraId: e.target.value || undefined })}
              className="w-full mt-1 px-2 py-1 text-[11.5px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">— etapa —</option>
              {etapasDaObra.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          ) : (
            <div className="mt-1 text-[10.5px] text-amber-700 dark:text-amber-300 ml-1">
              Defina a obra do pedido pra escolher a etapa.
            </div>
          )
        )}
      </td>

      {/* Remover */}
      <td className="px-2 py-2 align-top text-center">
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors"
          aria-label="Remover item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
