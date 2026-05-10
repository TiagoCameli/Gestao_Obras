// FF.6 — Drawer read-only de detalhes do Frete.
// Tabs Detalhes / Histórico, KPIs, slot dedicado "Foto da Chegada",
// resolução de IDs (obra, insumo) e anexos.

import { useMemo, useState } from 'react';
import {
  Pencil, Trash2, Truck, MapPin, Calendar, Package, Weight, Route, Wallet,
  FileText, Paperclip, History, User, PackageCheck, ArrowRight,
} from 'lucide-react';
import type { Frete, Obra, Insumo } from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import HistoricoTimeline from '../combustivel/HistoricoTimeline';

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

export default function FreteDetalhesDrawer({
  frete, open, onClose, obras, insumos, onEdit, onDelete, canEdit = true, canDelete = true,
}: Props) {
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
  const [tab, setTab] = useState<'detalhes' | 'historico'>('detalhes');

  if (!frete) {
    return (
      <Drawer open={open} onClose={onClose} title="Frete" subtitle="Detalhes" width="lg">
        <div className="text-sm text-[var(--color-fg-muted)] italic">Frete não disponível.</div>
      </Drawer>
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
    <Drawer
      open={open}
      onClose={onClose}
      title={frete.notaFiscal ? `Frete NF ${frete.notaFiscal}` : 'Frete'}
      subtitle={`${fmtData(frete.data)} · ${frete.transportadora || 'sem transportadora'}`}
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

      {tab === 'historico' && (
        <HistoricoTimeline
          alvoId={frete.id}
          resolvers={{ obras: obrasMap, combustiveis: insumosMap }}
        />
      )}

      {tab === 'detalhes' && (
        <div className="space-y-5">
          {/* FF.6 — Bloco destacado: Foto da Chegada da Carga. Identifica
              visualmente que o frete foi entregue. Cor amber alinhada
              com escopo do módulo. */}
          <div className="rounded-xl border-2 border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <PackageCheck className="w-5 h-5 text-[var(--color-accent)]" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">Foto da Chegada da Carga</h3>
                <p className="text-xs text-[var(--color-fg-muted)]">
                  {frete.fotoChegadaUrl ? `Registrada${frete.dataChegada ? ` em ${fmtData(frete.dataChegada)}` : ''}.` : 'Pendente — carga ainda não foi confirmada na chegada.'}
                </p>
              </div>
            </div>
            {frete.fotoChegadaUrl ? (
              <a
                href={frete.fotoChegadaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-video rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
              >
                <img src={frete.fotoChegadaUrl} alt="Foto da chegada da carga" className="w-full h-full object-cover" loading="lazy" />
              </a>
            ) : (
              <div className="aspect-video rounded-lg border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center px-4">
                <Truck className="w-8 h-8 text-[var(--color-fg-muted)] mb-2" />
                <p className="text-sm text-[var(--color-fg-muted)]">Sem foto de chegada registrada.</p>
                <p className="text-xs text-[var(--color-fg-muted)] mt-1">Use "Editar" para anexar a foto da carga ao chegar no destino.</p>
              </div>
            )}
          </div>

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
            <Field icon={Calendar} label="Data de chegada" value={fmtData(frete.dataChegada)} />
            <Field icon={Truck} label="Transportadora" value={frete.transportadora} />
            <Field icon={User} label="Motorista" value={frete.motorista} />
            <Field icon={Truck} label="Placa da carreta" value={frete.placaCarreta} />
            <Field icon={Package} label="Material" value={materialLabel} />
            <Field icon={Wallet} label="R$ / TKM" value={`${fmtBRL(frete.valorTkm)} (TKM=${tkmCalc.toLocaleString('pt-BR')})`} />
            <Field icon={MapPin} label="Obra" value={obraLabel} />
            {frete.notaFiscal && <Field icon={FileText} label="Nota fiscal" value={frete.notaFiscal} />}
            {frete.notaFiscal2 && <Field icon={FileText} label="Nota fiscal 2" value={frete.notaFiscal2} />}
            {frete.criadoPor && <Field icon={User} label="Criado por" value={frete.criadoPor} />}
          </div>

          {frete.observacoes && (
            <Field icon={FileText} label="Observações" value={<p className="whitespace-pre-wrap">{frete.observacoes}</p>} />
          )}

          {frete.fotoUrls && frete.fotoUrls.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
                <Paperclip className="w-3 h-3" />
                Fotos ({frete.fotoUrls.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {frete.fotoUrls.map((url, i) => (
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
    </Drawer>
  );
}
