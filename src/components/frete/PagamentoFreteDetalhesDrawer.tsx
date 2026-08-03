// FF.6 — Drawer read-only de detalhes do Pagamento de Frete.
// Tabs Detalhes / Histórico, KPIs (Valor, R$/L quando combustível), campos,
// anexos (comprovantes).

import { useState } from 'react';
import {
  Pencil, Trash2, Wallet, Calendar, Truck, FileText, Paperclip, History,
  User, Droplet, CreditCard,
} from 'lucide-react';
import type { PagamentoFrete, MetodoPagamentoFrete } from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import HistoricoTimeline from '../combustivel/HistoricoTimeline';
import FotoGaleria from '../shared/FotoGaleria';
import ArquivosLista from '../shared/ArquivosLista';

interface Props {
  pagamento: PagamentoFrete | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (p: PagamentoFrete) => void;
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
function fmtMesReferencia(mes: string): string {
  if (!mes) return '—';
  const [ano, m] = mes.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(m, 10) - 1;
  return `${nomes[idx] ?? m}/${ano}`;
}
function metodoLabel(m: MetodoPagamentoFrete): string {
  switch (m) {
    case 'pix': return 'Pix';
    case 'boleto': return 'Boleto';
    case 'cheque': return 'Cheque';
    case 'dinheiro': return 'Dinheiro';
    case 'transferencia': return 'Transferência';
    case 'combustivel': return 'Combustível (abatimento)';
    default: return m;
  }
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

export default function PagamentoFreteDetalhesDrawer({
  pagamento, open, onClose, onEdit, onDelete, canEdit = true, canDelete = true,
}: Props) {
  const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');

  if (!pagamento) {
    return (
      <Drawer open={open} onClose={onClose} title="Pagamento de Frete" subtitle="Detalhes" width="lg">
        <div className="text-sm text-[var(--color-fg-muted)] italic">Pagamento não disponível.</div>
      </Drawer>
    );
  }

  const ehCombustivel = pagamento.metodo === 'combustivel';

  const footer = (
    <div className="flex justify-end gap-2">
      {canEdit && onEdit && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => { onEdit(pagamento); onClose(); }}
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
          onClick={() => { onDelete(pagamento.id); onClose(); }}
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
      title="Pagamento de Frete"
      subtitle={`${pagamento.transportadora} · ${fmtData(pagamento.data)}`}
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

      {tab === 'historico' && <HistoricoTimeline alvoId={pagamento.id} />}

      {tab === 'detalhes' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className={`grid ${ehCombustivel ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Wallet className="w-3 h-3" />
                Valor pago
              </div>
              <div className="text-lg font-bold tabular-nums mt-1">{fmtBRL(pagamento.valor)}</div>
            </div>
            {ehCombustivel && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                  <Droplet className="w-3 h-3" />
                  Litros de combustível
                </div>
                <div className="text-lg font-bold tabular-nums mt-1">
                  {pagamento.quantidadeCombustivel.toLocaleString('pt-BR')} L
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field icon={Calendar} label="Data" value={fmtData(pagamento.data)} />
            <Field icon={Calendar} label="Mês referência" value={fmtMesReferencia(pagamento.mesReferencia)} />
            <Field icon={Truck} label="Transportadora" value={pagamento.transportadora} />
            <Field icon={CreditCard} label="Método" value={metodoLabel(pagamento.metodo)} />
            <Field icon={User} label="Pago por" value={pagamento.pagoPor} />
            <Field icon={User} label="Responsável" value={pagamento.responsavel} />
            {pagamento.notaFiscal && <Field icon={FileText} label="Nota fiscal" value={pagamento.notaFiscal} />}
            {(pagamento.createdBy || pagamento.criadoPor) && (
              <Field
                icon={User}
                label="Lançado por"
                value={
                  <>
                    {pagamento.createdBy || pagamento.criadoPor}
                    {pagamento.createdAt && (
                      <span className="text-[var(--color-fg-muted)]"> · {new Date(pagamento.createdAt).toLocaleString('pt-BR')}</span>
                    )}
                  </>
                }
              />
            )}
            {pagamento.updatedBy && pagamento.updatedBy !== (pagamento.createdBy || pagamento.criadoPor) && (
              <Field
                icon={Pencil}
                label="Última alteração por"
                value={
                  <>
                    {pagamento.updatedBy}
                    {pagamento.updatedAt && (
                      <span className="text-[var(--color-fg-muted)]"> · {new Date(pagamento.updatedAt).toLocaleString('pt-BR')}</span>
                    )}
                  </>
                }
              />
            )}
          </div>

          {pagamento.observacoes && (
            <Field icon={FileText} label="Observações" value={<p className="whitespace-pre-wrap">{pagamento.observacoes}</p>} />
          )}

          {pagamento.fotoUrls && pagamento.fotoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Comprovantes ({pagamento.fotoUrls.length})
              </div>
              <FotoGaleria fotoUrls={pagamento.fotoUrls} canDelete={false} canDownload />
            </div>
          )}

          {pagamento.arquivoUrls && pagamento.arquivoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Arquivos ({pagamento.arquivoUrls.length})
              </div>
              <ArquivosLista arquivoUrls={pagamento.arquivoUrls} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
