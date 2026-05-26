// FF.7 — Aba Lixeira admin-only para o módulo Frete.
// Mostra registros soft-deleted das 3 entidades operacionais (Frete,
// Pagamento, Pedido) agrupados em sections collapsible. Cada item resume
// os dados-chave + autor da exclusão + data + botão "Restaurar"
// (UPDATE deleted_at = NULL).
//
// Sem hard delete por design — compliance/auditoria exige histórico.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Undo2, Truck, Wallet, ShoppingCart, Loader2 } from 'lucide-react';
import { useFretesDeletados, useRestaurarFrete } from '../../hooks/useFretes';
import { usePagamentosFreteDeletados, useRestaurarPagamentoFrete } from '../../hooks/usePagamentosFrete';
import { usePedidosMaterialDeletados, useRestaurarPedidoMaterial } from '../../hooks/usePedidosMaterial';
import type { Obra, Fornecedor, Insumo } from '../../types';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  obras: Obra[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
}

function fmtDataHoraBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtData(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}
function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function LixeiraFreteTab({ obras, fornecedores, insumos }: Props) {
  const { temAcao } = useAuth();
  const canVerLixeira = temAcao('ver_lixeira_frete');
  const canRestaurar = temAcao('restaurar_lixeira_frete');

  const fretesQ = useFretesDeletados();
  const pagamentosQ = usePagamentosFreteDeletados();
  const pedidosQ = usePedidosMaterialDeletados();

  const restaurarFrete = useRestaurarFrete();
  const restaurarPagamento = useRestaurarPagamentoFrete();
  const restaurarPedido = useRestaurarPedidoMaterial();
  const { showToast } = useToast();

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);

  const fretes = fretesQ.data ?? [];
  const pagamentos = pagamentosQ.data ?? [];
  const pedidos = pedidosQ.data ?? [];
  const total = fretes.length + pagamentos.length + pedidos.length;

  const isLoading = fretesQ.isLoading || pagamentosQ.isLoading || pedidosQ.isLoading;

  const [openFretes, setOpenFretes] = useState(true);
  const [openPagamentos, setOpenPagamentos] = useState(true);
  const [openPedidos, setOpenPedidos] = useState(true);

  // ConfirmDialog state — substitui window.confirm. Action diferida via onConfirm.
  const [restaurando, setRestaurando] = useState<{ tipo: 'frete' | 'pagamento' | 'pedido'; id: string } | null>(null);

  function handleRestaurar(tipo: 'frete' | 'pagamento' | 'pedido', id: string) {
    if (!canRestaurar) {
      showToast({ kind: 'error', message: 'Sem permissão para restaurar itens da lixeira.' });
      return;
    }
    setRestaurando({ tipo, id });
  }

  async function executeRestaurar() {
    if (!restaurando) return;
    const { tipo, id } = restaurando;
    try {
      if (tipo === 'frete') await restaurarFrete.mutateAsync(id);
      else if (tipo === 'pagamento') await restaurarPagamento.mutateAsync(id);
      else await restaurarPedido.mutateAsync(id);
      showToast({ kind: 'success', message: 'Registro restaurado.' });
    } catch (e) {
      console.error('[lixeira-frete] falha ao restaurar', e);
      showToast({ kind: 'error', message: 'Falha ao restaurar. Tente novamente.' });
    } finally {
      setRestaurando(null);
    }
  }

  if (!canVerLixeira) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para visualizar a lixeira de frete.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-fg-muted)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando lixeira...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Nenhum registro deletado encontrado. A lixeira está vazia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3">
        <p className="text-xs text-[var(--color-fg-muted)]">
          <strong>{total}</strong> registro{total !== 1 ? 's' : ''} na lixeira do módulo Frete.
          Registros deletados ficam preservados por compliance. Use "Restaurar"
          para reativar.
        </p>
      </div>

      {/* ── Fretes deletados ────────────────────────────────────────────── */}
      <Section
        icon={<Truck className="w-4 h-4" />}
        title={`Fretes (${fretes.length})`}
        open={openFretes}
        onToggle={() => setOpenFretes((v) => !v)}
      >
        {fretes.length === 0 ? (
          <EmptyRow label="Nenhum frete deletado." />
        ) : (
          fretes.map((f) => (
            <DeletedItem
              key={f.id}
              titulo={`${f.notaFiscal ? `NF ${f.notaFiscal} · ` : ''}${f.origem} → ${f.destino}`}
              subtitulo={`${fmtData(f.data)} · ${f.transportadora || '—'} · ${fmtBRL(f.valorTotal)} · ${insumosMap.get(f.insumoId) ?? '—'}${f.obraId ? ` · ${obrasMap.get(f.obraId) ?? ''}` : ''}`}
              deletadoEm={fmtDataHoraBR(f.deletedAt ?? null)}
              deletadoPor={f.deletedBy ?? '—'}
              onRestore={() => handleRestaurar('frete', f.id)}
            />
          ))
        )}
      </Section>

      {/* ── Pagamentos deletados ────────────────────────────────────────── */}
      <Section
        icon={<Wallet className="w-4 h-4" />}
        title={`Pagamentos (${pagamentos.length})`}
        open={openPagamentos}
        onToggle={() => setOpenPagamentos((v) => !v)}
      >
        {pagamentos.length === 0 ? (
          <EmptyRow label="Nenhum pagamento deletado." />
        ) : (
          pagamentos.map((p) => (
            <DeletedItem
              key={p.id}
              titulo={`${fmtBRL(p.valor)} · ${p.transportadora}`}
              subtitulo={`${fmtData(p.data)} · ${p.metodo}${p.notaFiscal ? ` · NF ${p.notaFiscal}` : ''}`}
              deletadoEm={fmtDataHoraBR(p.deletedAt ?? null)}
              deletadoPor={p.deletedBy ?? '—'}
              onRestore={() => handleRestaurar('pagamento', p.id)}
            />
          ))
        )}
      </Section>

      {/* ── Pedidos deletados ──────────────────────────────────────────── */}
      <Section
        icon={<ShoppingCart className="w-4 h-4" />}
        title={`Pedidos (${pedidos.length})`}
        open={openPedidos}
        onToggle={() => setOpenPedidos((v) => !v)}
      >
        {pedidos.length === 0 ? (
          <EmptyRow label="Nenhum pedido deletado." />
        ) : (
          pedidos.map((p) => {
            const valor = p.itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0);
            return (
              <DeletedItem
                key={p.id}
                titulo={`${fornecedoresMap.get(p.fornecedorId) ?? p.fornecedorId} · ${fmtBRL(valor)}`}
                subtitulo={`${fmtData(p.data)} · ${p.itens.length} ${p.itens.length === 1 ? 'item' : 'itens'}`}
                deletadoEm={fmtDataHoraBR(p.deletedAt ?? null)}
                deletadoPor={p.deletedBy ?? '—'}
                onRestore={() => handleRestaurar('pedido', p.id)}
              />
            );
          })
        )}
      </Section>

      <ConfirmDialog
        open={restaurando !== null}
        onClose={() => setRestaurando(null)}
        onConfirm={executeRestaurar}
        title="Restaurar registro"
        message="Restaurar este registro pra fora da lixeira?"
        requirePassword={false}
      />
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
function Section({ icon, title, open, onToggle, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--color-surface-2)] transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-[var(--color-fg-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-fg-muted)]" />}
        <span className="text-[var(--color-accent)]">{icon}</span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">{title}</span>
      </button>
      {open && <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">{children}</div>}
    </div>
  );
}

interface DeletedItemProps {
  titulo: string;
  subtitulo: string;
  deletadoEm: string;
  deletadoPor: string;
  onRestore: () => void;
}
function DeletedItem({ titulo, subtitulo, deletadoEm, deletadoPor, onRestore }: DeletedItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)]/40">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)] truncate">{titulo}</div>
        <div className="text-xs text-[var(--color-fg-muted)] truncate mt-0.5">{subtitulo}</div>
        <div className="text-[10px] text-[var(--color-fg-muted)] mt-1">
          Deletado em <span className="tabular-nums">{deletadoEm}</span> por <strong>{deletadoPor}</strong>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="text-xs inline-flex items-center gap-1.5 shrink-0"
        onClick={onRestore}
      >
        <Undo2 className="w-3.5 h-3.5" />
        Restaurar
      </Button>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-4 py-3 text-xs text-[var(--color-fg-muted)] italic">{label}</div>
  );
}
