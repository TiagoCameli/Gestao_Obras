// F8.5.1 — Drawer read-only de detalhes da Entrada de combustível.
// Mesmo padrão do SaidaDetalhesDrawer: tabs Detalhes / Histórico,
// KPIs + campos resolvidos + anexos + ações Editar/Excluir.

import { useMemo, useState } from 'react';
import { Pencil, Trash2, Wallet, Droplet, Gauge, Container, FileText, Calendar, Paperclip, History } from 'lucide-react';
import type { EntradaCombustivel, Deposito, Insumo, Fornecedor } from '../../types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../shadcn/sheet';
import Button from '../ui/Button';
import HistoricoTimeline from './HistoricoTimeline';
import { fmtDataHora } from './v2/shared/formatters';

interface Props {
  entrada: EntradaCombustivel | null;
  open: boolean;
  onClose: () => void;
  depositos: Deposito[];
  combustiveis: Insumo[];
  fornecedores: Fornecedor[];
  onEdit?: (e: EntradaCombustivel) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtBRLDec4(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
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
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
          {label}
        </div>
        <div className="text-sm text-[var(--color-fg)] mt-0.5 break-words">{value || '—'}</div>
      </div>
    </div>
  );
}

export default function EntradaDetalhesDrawer({
  entrada,
  open,
  onClose,
  depositos,
  combustiveis,
  fornecedores,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: Props) {
  const tanquesMap = useMemo(() => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])), [depositos]);
  const combustMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);

  const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');

  if (!entrada) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="right"
          className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)]"
        >
          <SheetHeader>
            <SheetTitle>Entrada de combustível</SheetTitle>
            <SheetDescription>Detalhes</SheetDescription>
          </SheetHeader>
          <div className="text-sm text-[var(--color-fg-muted)] italic mt-4">Entrada não disponível.</div>
        </SheetContent>
      </Sheet>
    );
  }

  const rPorL = entrada.quantidadeLitros > 0 ? entrada.valorTotal / entrada.quantidadeLitros : 0;
  // Fornecedor pode estar como nome livre OU id resolvido (pós-trigger #27)
  const fornecedorLabel = fornecedoresMap.get(entrada.fornecedor) ?? entrada.fornecedor;

  const footer = (
    <div className="flex justify-end gap-2">
      {canEdit && onEdit && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => { onEdit(entrada); onClose(); }}
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
          onClick={() => { onDelete(entrada.id); onClose(); }}
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
          <SheetTitle>Entrada de combustível</SheetTitle>
          <SheetDescription>{fmtDataHora(entrada.dataHora)}</SheetDescription>
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
        <HistoricoTimeline
          alvoId={entrada.id}
          resolvers={{ tanques: tanquesMap, combustiveis: combustMap }}
        />
      )}

      {tab === 'detalhes' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Droplet className="w-3 h-3" />
                Litros
              </div>
              <div className="text-lg font-bold tabular-nums mt-1">
                {entrada.quantidadeLitros.toLocaleString('pt-BR')} L
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Wallet className="w-3 h-3" />
                Valor
              </div>
              <div className="text-lg font-bold tabular-nums mt-1">
                {fmtBRL(entrada.valorTotal)}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Gauge className="w-3 h-3" />
                R$/L
              </div>
              <div className="text-lg font-bold tabular-nums mt-1">
                {rPorL > 0 ? fmtBRLDec4(rPorL) : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field icon={Calendar} label="Data e hora" value={fmtDataHora(entrada.dataHora)} />
            <Field icon={Container} label="Tanque" value={tanquesMap.get(entrada.depositoId) ?? entrada.depositoId} />
            <Field icon={Droplet} label="Combustível" value={combustMap.get(entrada.tipoCombustivel) ?? entrada.tipoCombustivel} />
            <Field icon={FileText} label="Fornecedor" value={fornecedorLabel} />
            {entrada.notaFiscal && <Field icon={FileText} label="Nota fiscal" value={entrada.notaFiscal} />}
            {entrada.criadoPor && <Field icon={FileText} label="Lançado por" value={entrada.criadoPor} />}
          </div>

          {entrada.observacoes && (
            <Field icon={FileText} label="Observações" value={<p className="whitespace-pre-wrap">{entrada.observacoes}</p>} />
          )}

          {entrada.fotoUrls && entrada.fotoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Fotos ({entrada.fotoUrls.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {entrada.fotoUrls.map((url, i) => (
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

          {entrada.arquivoUrls && entrada.arquivoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Arquivos ({entrada.arquivoUrls.length})
              </div>
              <ul className="space-y-1.5">
                {entrada.arquivoUrls.map((url, i) => (
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
