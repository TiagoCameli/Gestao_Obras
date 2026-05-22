// F8.5.2 — Drawer read-only de detalhes da Transferência entre tanques.

import { useMemo, useState } from 'react';
import { Trash2, Wallet, Droplet, Container, FileText, Calendar, Paperclip, History, ArrowRight } from 'lucide-react';
import type { TransferenciaCombustivel, Deposito } from '../../types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../shadcn/sheet';
import Button from '../ui/Button';
import HistoricoTimeline from './HistoricoTimeline';

interface Props {
  transferencia: TransferenciaCombustivel | null;
  open: boolean;
  onClose: () => void;
  depositos: Deposito[];
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDataHora(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fileNameFromUrl(url: string): string {
  const m = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
  if (!m) return url;
  const path = decodeURIComponent(m[1]);
  const last = path.split('/').pop() || path;
  return last.replace(/^\d+-/, '');
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

export default function TransferenciaDetalhesDrawer({
  transferencia,
  open,
  onClose,
  depositos,
  onDelete,
  canDelete = true,
}: Props) {
  const tanquesMap = useMemo(() => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])), [depositos]);
  const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');

  if (!transferencia) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="right"
          className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)]"
        >
          <SheetHeader>
            <SheetTitle>Transferência</SheetTitle>
            <SheetDescription>Detalhes</SheetDescription>
          </SheetHeader>
          <div className="text-sm text-[var(--color-fg-muted)] italic mt-4">Transferência não disponível.</div>
        </SheetContent>
      </Sheet>
    );
  }

  const origemLabel = tanquesMap.get(transferencia.depositoOrigemId) ?? '—';
  const destinoLabel = tanquesMap.get(transferencia.depositoDestinoId) ?? '—';

  const footer = canDelete && onDelete ? (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="danger"
        onClick={() => { onDelete(transferencia.id); onClose(); }}
        className="text-sm inline-flex items-center gap-1.5"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Excluir
      </Button>
    </div>
  ) : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Transferência</SheetTitle>
          <SheetDescription>{fmtDataHora(transferencia.dataHora)}</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
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

      {tab === 'historico' && (
        <HistoricoTimeline alvoId={transferencia.id} resolvers={{ tanques: tanquesMap }} />
      )}

      {tab === 'detalhes' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Droplet className="w-3 h-3" />
                Litros transferidos
              </div>
              <div className="text-lg font-bold tabular-nums mt-1">
                {transferencia.quantidadeLitros.toLocaleString('pt-BR')} L
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Wallet className="w-3 h-3" />
                Valor
              </div>
              <div className="text-lg font-bold tabular-nums mt-1">{fmtBRL(transferencia.valorTotal)}</div>
            </div>
          </div>

          {/* Diagrama origem → destino */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <Container className="w-5 h-5 text-[var(--color-fg-muted)]" />
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">Origem</div>
              <div className="text-sm font-semibold text-center truncate w-full">{origemLabel}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <Container className="w-5 h-5 text-[var(--color-fg-muted)]" />
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">Destino</div>
              <div className="text-sm font-semibold text-center truncate w-full">{destinoLabel}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field icon={Calendar} label="Data e hora" value={fmtDataHora(transferencia.dataHora)} />
            {transferencia.criadoPor && (
              <Field icon={FileText} label="Lançado por" value={transferencia.criadoPor} />
            )}
          </div>

          {transferencia.observacoes && (
            <Field icon={FileText} label="Observações" value={<p className="whitespace-pre-wrap">{transferencia.observacoes}</p>} />
          )}

          {transferencia.fotoUrls && transferencia.fotoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Fotos ({transferencia.fotoUrls.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {transferencia.fotoUrls.map((url, i) => (
                  <a
                    key={url + i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
                  >
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {transferencia.arquivoUrls && transferencia.arquivoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Arquivos ({transferencia.arquivoUrls.length})
              </div>
              <ul className="space-y-1.5">
                {transferencia.arquivoUrls.map((url, i) => (
                  <li
                    key={url + i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] truncate"
                      title={fileNameFromUrl(url)}
                    >
                      {fileNameFromUrl(url)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
        </div>

        <SheetFooter className="mt-6">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
