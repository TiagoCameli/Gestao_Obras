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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, AlertCircle, Calendar, FileText, User, Lock } from 'lucide-react';
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
import SubmitButton from '../ui/SubmitButton';
import Input from '../ui/Input';
import Select from '../ui/Select';
import SmartSelect from '../ui/SmartSelect';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { validarPedidoCompra } from '../../utils/comprasValidator';
import InsumoSelect from './InsumoSelect';
import {
  getTipoVisualInsumo,
  TIPO_VISUAL_LABEL,
  TIPO_VISUAL_ICON,
  TIPO_VISUAL_CHIP_CLASS,
  destinosPermitidos,
  destinoForcadoPorTipo,
  ehServico,
} from '../../utils/insumoTipoVisual';
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
  /** Notifica o pai quando o form fica sujo (usuário editou algo). */
  onDirtyChange?: (dirty: boolean) => void;
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
  onDirtyChange,
}: Props) {
  const { temAcao, usuario } = useAuth();
  const { showToast } = useToast();

  // B4: dirty tracking
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => {
    if (!dirty) { setDirty(true); onDirtyChange?.(true); }
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const podeCriarInsumo = temAcao('cadastrar_insumo_via_compra');
  const adicionarInsumoMut = useAdicionarInsumo();
  // useUploadAnexoCompras é importado por AnexoUploader internamente; aqui
  // só garantimos a interface fluindo. Caller faz o upload pós-save.
  void useUploadAnexoCompras;

  // ── Estado inicial ─────────────────────────────────────────────────────
  const [numero] = useState(initial?.numero || proximoNumero);
  const [data, setData] = useState(initial?.data || new Date().toISOString().slice(0, 10));
  // Solicitante é travado: sempre o usuário logado em pedidos novos,
  // ou o solicitante original ao editar (preserva histórico).
  const solicitante = initial?.solicitante || nomeUsuario || '';
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [urgencia, setUrgencia] = useState<UrgenciaPedidoCompra>(initial?.urgencia || 'normal');
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
    markDirty();
    setItens((prev) => [...prev, novoItemVazio()]);
  }, [markDirty]);

  const atualizarItem = useCallback(
    (id: string, patch: Partial<ItemPedidoCompra>) => {
      markDirty();
      setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [markDirty]
  );

  const removerItem = useCallback((id: string) => {
    markDirty();
    setItens((prev) => prev.filter((it) => it.id !== id));
  }, [markDirty]);

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
          valorEstimado: initial?.valorEstimado,
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
      observacoes, usuario, anexosPendentes, onSubmit, showToast,
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
            <Input type="date" value={data} onChange={(e) => { markDirty(); setData(e.target.value); }} className="pl-9" required />
          </div>
        </div>
        <div>
          <Label>Solicitante <span className="text-rose-500">*</span></Label>
          <div
            className="flex items-center gap-2 px-3 h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-fg)]"
            title="Preenchido automaticamente com o usuário logado"
          >
            <User className="w-3.5 h-3.5 text-[var(--color-fg-subtle)] shrink-0" />
            <span className="truncate flex-1">{solicitante || '—'}</span>
            <Lock className="w-3 h-3 text-[var(--color-fg-subtle)] shrink-0" />
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <Label>Obra</Label>
          <Select
            value={obraId}
            onChange={(e) => { markDirty(); setObraId(e.target.value); }}
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
                  onClick={() => { markDirty(); setUrgencia(u.value); }}
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
                  <th className="px-3 py-3 text-right font-semibold w-[110px]">Qtd</th>
                  <th className="px-3 py-3 text-left font-semibold w-[90px]">Un</th>
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
          onChange={(e) => { markDirty(); setDescricaoLivre(e.target.value); }}
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
          onChange={(e) => { markDirty(); setObservacoes(e.target.value); }}
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
        <SubmitButton loading={submitting} disabled={!podeSalvar}>
          {initial ? 'Salvar alterações' : 'Criar pedido'}
        </SubmitButton>
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
  const insumoSelecionado = insumos.find((i) => i.id === item.insumoId);
  const tipoVisual = getTipoVisualInsumo(insumoSelecionado);
  const tipoAtual: TipoItemCompra = item.tipo ?? 'material';
  // Label da categoria vinculada (busca em categorias passadas + fallback pro slug)
  const categoriaLabel = categorias.find((c) => c.value === item.categoria)?.label
    ?? (item.categoria ? item.categoria : 'Outros');
  // Destinos permitidos para o tipo deste item (regras: peça→almox, combustível→tanque, ...)
  const destinosOk = destinosPermitidos(tipoVisual);

  return (
    <tr className="hover:bg-[var(--color-surface-2)]/40 transition-colors">
      {/* Descrição com InsumoSelect (dropdown filtrável + cadastro rápido) */}
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
            // Item.tipo no domínio é só 'material' ou 'servico' (material engloba peça/combustível).
            const novoItemTipo: TipoItemCompra = ehServico(novoTipoVisual) ? 'servico' : 'material';
            const destinoForcado = destinoForcadoPorTipo(novoTipoVisual);
            // Se o destino atual já é permitido pra esse tipo, mantém; senão força (ou limpa).
            const destinosOkNovo = destinosPermitidos(novoTipoVisual);
            const destinoAtualOk = item.tipoDestino && destinosOkNovo.includes(item.tipoDestino);
            onChange({
              insumoId: patch.insumoId,
              descricao: patch.descricao,
              tipo: novoItemTipo,
              unidade: (patch.unidade as ItemPedidoCompra['unidade']) ?? item.unidade,
              categoria: patch.categoria ?? item.categoria,
              tipoDestino: destinoForcado ?? (destinoAtualOk ? item.tipoDestino : undefined),
            });
          }}
          onCreateNew={() => {
            if (podeCriarInsumo) onCadastrarInsumo();
          }}
          compact
        />
        {insumoSelecionado && (
          <div className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5 ml-2.5">
            ✓ <span className="text-emerald-600">vinculado</span> a {insumoSelecionado.nome}
          </div>
        )}
      </td>

      {/* TIPO — chip automático quando há insumo (Material/Peça/Combustível/Serviço/Outros) */}
      <td className="px-3 py-2 align-top">
        {insumoSelecionado ? (
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

      {/* CATEGORIA — chip automático quando há insumo; SmartSelect quando texto livre */}
      <td className="px-3 py-2 align-top">
        {insumoSelecionado ? (
          <span
            className="inline-flex items-center h-7 px-2 rounded-md text-[11.5px] font-medium bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)] capitalize"
            title="Categoria vinculada ao insumo"
          >
            {categoriaLabel}
          </span>
        ) : (
          <SmartSelect
            value={item.categoria}
            onChange={(e) => onChange({ categoria: e.target.value })}
            usePortal
            className="w-full px-2 py-1.5 text-sm text-left rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)] flex items-center"
          >
            <option value="outros">Outros</option>
            {categorias.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </SmartSelect>
        )}
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

      {/* UN — chip automático quando há insumo; SmartSelect quando texto livre */}
      <td className="px-3 py-2 align-top">
        {insumoSelecionado ? (
          <span
            className="inline-flex items-center justify-center h-7 px-2 min-w-[40px] rounded-md text-[11.5px] font-medium bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)] uppercase"
            title="Unidade vinculada ao insumo"
          >
            {item.unidade || insumoSelecionado.unidade}
          </span>
        ) : (
        <SmartSelect
          value={item.unidade}
          onChange={(e) => onChange({ unidade: e.target.value as ItemPedidoCompra['unidade'] })}
          usePortal
          className="w-full px-2 py-1.5 text-sm text-left rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)] flex items-center"
        >
          {unidadesOptions.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </SmartSelect>
        )}
      </td>

      {/* Destino sugerido (OPCIONAL — pode preencher pra adiantar a OC) */}
      <td className="px-3 py-2 align-top">
        <SmartSelect
          value={item.tipoDestino ?? ''}
          onChange={(e) => {
            const novo = e.target.value as TipoDestinoOC | '';
            // Limpa etapa se mudar pra destino que não usa etapa
            const limpaEtapa = novo !== 'obra_etapa' ? { etapaObraId: undefined } : {};
            onChange({ tipoDestino: novo || undefined, ...limpaEtapa });
          }}
          // Peça/Combustível: trava destino (sem dropdown)
          disabled={tipoVisual === 'peca' || tipoVisual === 'combustivel'}
          usePortal
          className="w-full px-2 py-1.5 text-sm text-left rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)] flex items-center"
        >
          <option value="">— deixar pra OC —</option>
          {destinosOk.includes('obra_etapa') && (
            <option value="obra_etapa">{DESTINO_PEDIDO_LABEL.obra_etapa}</option>
          )}
          {destinosOk.includes('obra_deposito') && (
            <option value="obra_deposito">{DESTINO_PEDIDO_LABEL.obra_deposito}</option>
          )}
          {destinosOk.includes('deposito_central') && (
            <option value="deposito_central">{DESTINO_PEDIDO_LABEL.deposito_central}</option>
          )}
          {destinosOk.includes('sede') && (
            <option value="sede">{DESTINO_PEDIDO_LABEL.sede}</option>
          )}
          {destinosOk.includes('manutencao_equipamento') && (
            <option value="manutencao_equipamento">{DESTINO_PEDIDO_LABEL.manutencao_equipamento}</option>
          )}
          {destinosOk.includes('tanque_combustivel') && (
            <option value="tanque_combustivel">{DESTINO_PEDIDO_LABEL.tanque_combustivel}</option>
          )}
        </SmartSelect>
        {(tipoVisual === 'peca' || tipoVisual === 'combustivel') && (
          <div className="mt-1 text-[10.5px] text-[var(--color-fg-subtle)] ml-1">
            {tipoVisual === 'peca'
              ? 'Peça vai sempre pro almoxarifado de peças.'
              : 'Combustível vai sempre pra um tanque.'}
          </div>
        )}
        {/* Quando destino = obra_etapa, mostra a etapa específica */}
        {item.tipoDestino === 'obra_etapa' && (
          obraDoPedidoId ? (
            <SmartSelect
              value={item.etapaObraId ?? ''}
              onChange={(e) => onChange({ etapaObraId: e.target.value || undefined })}
              usePortal
              className="w-full mt-1 px-2 py-1 text-[11.5px] text-left rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:border-[var(--color-accent)] flex items-center min-h-[24px]"
            >
              <option value="">— etapa —</option>
              {etapasDaObra.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </SmartSelect>
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
