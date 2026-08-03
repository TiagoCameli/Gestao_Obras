// FF.6 — Drawer read-only de detalhes do Pedido de Material.
// Tabs Detalhes / Histórico, KPI valor total, lista de itens com subtotais,
// resolução de fornecedor/insumos e anexos.

import { useMemo, useState } from 'react';
import {
  Pencil, Trash2, Calendar, Building2, Wallet, FileText, Paperclip, History,
  User, Package, ShoppingCart,
} from 'lucide-react';
import type { PedidoMaterial, Fornecedor, Insumo } from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import HistoricoTimeline from '../combustivel/HistoricoTimeline';
import FotoGaleria from '../shared/FotoGaleria';
import ArquivosLista from '../shared/ArquivosLista';

interface Props {
  pedido: PedidoMaterial | null;
  open: boolean;
  onClose: () => void;
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  onEdit?: (p: PedidoMaterial) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}
interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}
function Field({ icon: Icon, label, value }: FieldProps) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-[var(--color-fg-muted)] shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">{label}</div>
        <div className="text-sm text-[var(--color-fg)] mt-0.5 break-words">{value || '—'}</div>
      </div>
    </div>
  );
}

export default function PedidoMaterialDetalhesDrawer({
  pedido, open, onClose, fornecedores, insumos, onEdit, onDelete, canEdit = true, canDelete = true,
}: Props) {
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
  const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');

  if (!pedido) {
    return (
      <Drawer open={open} onClose={onClose} title="Pedido de Material" subtitle="Detalhes" width="lg">
        <div className="text-sm text-[var(--color-fg-muted)] italic">Pedido não disponível.</div>
      </Drawer>
    );
  }

  const valorTotal = pedido.itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0);
  const fornecedorLabel = fornecedoresMap.get(pedido.fornecedorId) ?? pedido.fornecedorId;

  const footer = (
    <div className="flex justify-end gap-2">
      {canEdit && onEdit && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => { onEdit(pedido); onClose(); }}
          className="text-sm inline-flex items-center gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Button>
      )}
      {canDelete && onDelete && (
        <Button
          type="button"
          variant="danger"
          onClick={() => { onDelete(pedido.id); onClose(); }}
          className="text-sm inline-flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </Button>
      )}
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Pedido de Material"
      subtitle={`${fornecedorLabel} · ${fmtData(pedido.data)}`}
      width="lg"
      footer={footer}
    >
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setTab('detalhes')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'detalhes'
              ? 'text-[var(--color-fg)] border-[var(--color-accent)]'
              : 'text-[var(--color-fg-muted)] border-transparent hover:text-[var(--color-fg)]'
          }`}
        >
          Detalhes
        </button>
        <button
          type="button"
          onClick={() => setTab('historico')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'historico'
              ? 'text-[var(--color-fg)] border-[var(--color-accent)]'
              : 'text-[var(--color-fg-muted)] border-transparent hover:text-[var(--color-fg)]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Histórico
        </button>
      </div>

      {tab === 'historico' && <HistoricoTimeline alvoId={pedido.id} />}

      {tab === 'detalhes' && (
        <div className="space-y-5">
          {/* KPI valor total */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
              <Wallet className="w-3 h-3" />
              Valor total do pedido
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmtBRL(valorTotal)}</div>
            <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              {pedido.itens.length} {pedido.itens.length === 1 ? 'item' : 'itens'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field icon={Calendar} label="Data" value={fmtData(pedido.data)} />
            <Field icon={Building2} label="Fornecedor" value={fornecedorLabel} />
            {(pedido.createdBy || pedido.criadoPor) && (
              <Field
                icon={User}
                label="Criado por"
                value={
                  <>
                    {pedido.createdBy || pedido.criadoPor}
                    {pedido.createdAt && (
                      <span className="text-[var(--color-fg-muted)]"> · {new Date(pedido.createdAt).toLocaleString('pt-BR')}</span>
                    )}
                  </>
                }
              />
            )}
            {pedido.updatedBy && pedido.updatedBy !== (pedido.createdBy || pedido.criadoPor) && (
              <Field
                icon={Pencil}
                label="Última alteração por"
                value={
                  <>
                    {pedido.updatedBy}
                    {pedido.updatedAt && (
                      <span className="text-[var(--color-fg-muted)]"> · {new Date(pedido.updatedAt).toLocaleString('pt-BR')}</span>
                    )}
                  </>
                }
              />
            )}
          </div>

          {/* Itens do pedido */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
              <ShoppingCart className="w-3 h-3" />
              Itens ({pedido.itens.length})
            </div>
            <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)]/40 text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase font-semibold">Material</th>
                    <th className="text-right px-3 py-2 text-xs uppercase font-semibold">Qtd.</th>
                    <th className="text-right px-3 py-2 text-xs uppercase font-semibold">Unitário</th>
                    <th className="text-right px-3 py-2 text-xs uppercase font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {pedido.itens.map((it, i) => {
                    const sub = it.quantidade * it.valorUnitario;
                    return (
                      <tr key={`${it.insumoId}-${i}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-[var(--color-fg-muted)] shrink-0" />
                            {insumosMap.get(it.insumoId) ?? it.insumoId}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.quantidade.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(it.valorUnitario)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtBRL(sub)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {pedido.observacoes && (
            <Field icon={FileText} label="Observações" value={<p className="whitespace-pre-wrap">{pedido.observacoes}</p>} />
          )}

          {pedido.fotoUrls && pedido.fotoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Fotos ({pedido.fotoUrls.length})
              </div>
              <FotoGaleria fotoUrls={pedido.fotoUrls} canDelete={false} canDownload />
            </div>
          )}

          {pedido.arquivoUrls && pedido.arquivoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Arquivos ({pedido.arquivoUrls.length})
              </div>
              <ArquivosLista arquivoUrls={pedido.arquivoUrls} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
