// FF.6 — Drawer read-only de detalhes do Frete.
// Tabs Detalhes / Histórico, KPIs, slot dedicado "Foto da Chegada",
// resolução de IDs (obra, insumo) e anexos.
// Fase A (2026-05): upload inline de até 8 fotos da chegada sem entrar
// em Editar. A 1ª foto = foto principal de chegada (fotoChegadaUrl),
// as demais = extras (fotoUrls). Remover a 1ª promove a 2ª automaticamente.

import { useMemo, useState } from 'react';
import {
  Pencil, Trash2, Truck, MapPin, Calendar, Package, Weight, Route, Wallet,
  FileText, Paperclip, History, User, ArrowRight,
} from 'lucide-react';
import type { Frete, Obra, Insumo } from '../../types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../shadcn/sheet';
import Button from '../ui/Button';
import HistoricoTimeline from '../combustivel/HistoricoTimeline';
import FreteFotoChegadaBlock from './FreteFotoChegadaBlock';
import { useAtualizarFrete } from '../../hooks/useFretes';
import { useToast } from '../ui/Toast';
import { fileNameFromUrl } from '../../utils/signedUrl';

interface Props {
  frete: Frete | null;
  open: boolean;
  onClose: () => void;
  obras: Obra[];
  insumos: Insumo[];
  onEdit?: (f: Frete) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): string {
  if (!iso) return '—';
  // Datas vêm como 'YYYY-MM-DD' (text). Tratamos local sem conversão de TZ.
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

export default function FreteDetalhesDrawer({
  frete, open, onClose, obras, insumos, onEdit, onDelete, canEdit = true, canDelete = true,
}: Props) {
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
  const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');
  const atualizarMutation = useAtualizarFrete();
  const { showToast } = useToast();

  const handleDataChegadaChange = (novaData: string) => {
    if (!frete) return;
    atualizarMutation.mutate(
      { ...frete, dataChegada: novaData },
      {
        onSuccess: () => showToast({ kind: 'success', message: 'Data de chegada atualizada.' }),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          showToast({ kind: 'error', message: `Falha ao salvar: ${msg}` });
        },
      },
    );
  };

  if (!frete) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="right"
          className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)]"
        >
          <SheetHeader>
            <SheetTitle>Frete</SheetTitle>
            <SheetDescription>Detalhes</SheetDescription>
          </SheetHeader>
          <div className="text-sm text-[var(--color-fg-muted)] italic mt-4">Frete não disponível.</div>
        </SheetContent>
      </Sheet>
    );
  }

  const tkmCalc = frete.kmRodados * frete.pesoToneladas; // tonelada-km
  const obraLabel = frete.obraId ? (obrasMap.get(frete.obraId) ?? frete.obraId) : '—';
  const materialLabel = insumosMap.get(frete.insumoId) ?? frete.insumoId;

  const footer = (
    <div className="flex justify-end gap-2">
      {canEdit && onEdit && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => { onEdit(frete); onClose(); }}
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
          onClick={() => { onDelete(frete.id); onClose(); }}
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
          <SheetTitle>{frete.notaFiscal ? `Frete NF ${frete.notaFiscal}` : 'Frete'}</SheetTitle>
          <SheetDescription>
            {`${fmtData(frete.data)} · ${frete.transportadora || 'sem transportadora'}`}
          </SheetDescription>
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
              alvoId={frete.id}
              resolvers={{ obras: obrasMap, combustiveis: insumosMap }}
            />
          )}

          {tab === 'detalhes' && (
            <div className="space-y-5">
          <FreteFotoChegadaBlock frete={frete} canEdit={canEdit} variant="card" />

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Weight className="w-3 h-3" />
                Peso
              </div>
              <div className="text-base font-bold tabular-nums mt-1">
                {frete.pesoToneladas.toLocaleString('pt-BR')} t
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Route className="w-3 h-3" />
                KM
              </div>
              <div className="text-base font-bold tabular-nums mt-1">
                {frete.kmRodados.toLocaleString('pt-BR')}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Wallet className="w-3 h-3" />
                Valor Frete
              </div>
              <div className="text-base font-bold tabular-nums mt-1">
                {fmtBRL(frete.valorTotal)}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
                <Package className="w-3 h-3" />
                Valor Material
              </div>
              <div className="text-base font-bold tabular-nums mt-1">
                {fmtBRL(frete.valorMaterial || 0)}
              </div>
            </div>
          </div>

          {/* Diagrama origem → destino */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <MapPin className="w-5 h-5 text-[var(--color-fg-muted)]" />
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">Origem</div>
              <div className="text-sm font-semibold text-center truncate w-full">{frete.origem || '—'}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <MapPin className="w-5 h-5 text-[var(--color-fg-muted)]" />
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">Destino</div>
              <div className="text-sm font-semibold text-center truncate w-full">{frete.destino || '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field icon={Calendar} label="Data de saída" value={fmtData(frete.data)} />
            <Field
              icon={Calendar}
              label="Data de chegada"
              value={canEdit ? (
                <input
                  type="date"
                  value={frete.dataChegada || ''}
                  onChange={(e) => handleDataChegadaChange(e.target.value)}
                  disabled={atualizarMutation.isPending}
                  className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
                />
              ) : (
                fmtData(frete.dataChegada)
              )}
            />
            <Field icon={Truck} label="Transportadora" value={frete.transportadora} />
            <Field icon={User} label="Motorista" value={frete.motorista} />
            <Field icon={Truck} label="Placa da carreta" value={frete.placaCarreta} />
            <Field icon={Package} label="Material" value={materialLabel} />
            <Field icon={Wallet} label="R$ / TKM" value={`${fmtBRL(frete.valorTkm)} (TKM=${tkmCalc.toLocaleString('pt-BR')})`} />
            {frete.valorMaterial && frete.pesoToneladas > 0 && (
              <Field
                icon={Package}
                label="Valor material (R$/t)"
                value={`${fmtBRL(frete.valorMaterial / frete.pesoToneladas)}/t`}
              />
            )}
            <Field icon={MapPin} label="Obra" value={obraLabel} />
            {frete.notaFiscal && <Field icon={FileText} label="Nota fiscal" value={frete.notaFiscal} />}
            {frete.notaFiscal2 && <Field icon={FileText} label="Nota fiscal 2" value={frete.notaFiscal2} />}
            {(frete.createdBy || frete.criadoPor) && (
              <Field
                icon={User}
                label="Criado por"
                value={
                  <>
                    {frete.createdBy || frete.criadoPor}
                    {frete.createdAt && (
                      <span className="text-[var(--color-fg-muted)]"> · {new Date(frete.createdAt).toLocaleString('pt-BR')}</span>
                    )}
                  </>
                }
              />
            )}
            {frete.updatedBy && frete.updatedBy !== (frete.createdBy || frete.criadoPor) && (
              <Field
                icon={Pencil}
                label="Última alteração por"
                value={
                  <>
                    {frete.updatedBy}
                    {frete.updatedAt && (
                      <span className="text-[var(--color-fg-muted)]"> · {new Date(frete.updatedAt).toLocaleString('pt-BR')}</span>
                    )}
                  </>
                }
              />
            )}
          </div>

          {frete.observacoes && (
            <Field icon={FileText} label="Observações" value={<p className="whitespace-pre-wrap">{frete.observacoes}</p>} />
          )}

          {frete.arquivoUrls && frete.arquivoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Arquivos ({frete.arquivoUrls.length})
              </div>
              <ul className="space-y-1.5">
                {frete.arquivoUrls.map((url, i) => (
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
