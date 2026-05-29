// F8.5.3 — Drawer read-only de detalhes do Tanque (Depósito).

import { useState } from 'react';
import { Pencil, Trash2, Container, Droplet, Gauge, FileText, Paperclip, History, Building2 } from 'lucide-react';
import type { Deposito } from '../../../types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../../shadcn/sheet';
import Button from '../../ui/Button';
import HistoricoTimeline from '../../combustivel/HistoricoTimeline';
import FotoGaleria from '../../shared/FotoGaleria';

interface Props {
  tanque: Deposito | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (d: Deposito) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
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

export default function TanqueDetalhesDrawer({
  tanque,
  open,
  onClose,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: Props) {
  const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');

  if (!tanque) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="right"
          className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)]"
        >
          <SheetHeader>
            <SheetTitle>Tanque</SheetTitle>
            <SheetDescription>Detalhes</SheetDescription>
          </SheetHeader>
          <div className="text-sm text-[var(--color-fg-muted)] italic mt-4">Tanque não disponível.</div>
        </SheetContent>
      </Sheet>
    );
  }

  const pct = tanque.capacidadeLitros > 0
    ? Math.min(100, (tanque.nivelAtualLitros / tanque.capacidadeLitros) * 100)
    : 0;
  const pctColor = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';

  const footer = (
    <div className="flex justify-end gap-2">
      {canEdit && onEdit && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => { onEdit(tanque); onClose(); }}
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
          onClick={() => { onDelete(tanque.id); onClose(); }}
          className="text-sm inline-flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </Button>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{tanque.nome}</SheetTitle>
          <SheetDescription>{tanque.apelido || (tanque.ehExterno ? 'Tanque externo' : 'Tanque interno')}</SheetDescription>
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

      {tab === 'historico' && <HistoricoTimeline alvoId={tanque.id} />}

      {tab === 'detalhes' && (
        <div className="space-y-5">
          {/* Status do nível com barra de progresso */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-semibold text-[var(--color-fg)]">Nível atual</span>
              <span className="text-xs text-[var(--color-fg-muted)] tabular-nums">{pct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-[var(--color-surface-2)] rounded-full h-3 overflow-hidden">
              <div className={`h-3 rounded-full transition-all ${pctColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-[var(--color-fg-muted)] mt-1.5 tabular-nums">
              <span>{tanque.nivelAtualLitros.toLocaleString('pt-BR')} L</span>
              <span>{tanque.capacidadeLitros.toLocaleString('pt-BR')} L</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field icon={Container} label="Nome" value={tanque.nome} />
            {tanque.apelido && <Field icon={Container} label="Apelido" value={tanque.apelido} />}
            <Field icon={Droplet} label="Capacidade" value={`${tanque.capacidadeLitros.toLocaleString('pt-BR')} L`} />
            <Field icon={Gauge} label="Nível atual" value={`${tanque.nivelAtualLitros.toLocaleString('pt-BR')} L`} />
            <Field
              icon={Building2}
              label="Tipo"
              value={tanque.ehExterno ? 'Externo (terceirizado)' : 'Interno (EMT)'}
            />
            <Field
              icon={FileText}
              label="Status"
              value={tanque.ativo ? 'Ativo' : 'Inativo'}
            />
            {tanque.criadoPor && (
              <Field icon={FileText} label="Cadastrado por" value={tanque.criadoPor} />
            )}
          </div>

          {tanque.fotoUrls && tanque.fotoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Fotos ({tanque.fotoUrls.length})
              </div>
              <FotoGaleria fotoUrls={tanque.fotoUrls} canDelete={false} canDownload />
            </div>
          )}

          {tanque.arquivoUrls && tanque.arquivoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Arquivos ({tanque.arquivoUrls.length})
              </div>
              <ul className="space-y-1.5">
                {tanque.arquivoUrls.map((url, i) => (
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
