// F5.A — Drawer read-only de detalhes da Saída.
//
// Abre quando user clica numa row da SaidaCombustivelList — preview rápido
// sem entrar em modo de edição. Mostra KPIs + todos campos resolvidos
// (equipamento, obra, tanque, etc) + fotos se houver. Footer com 2 ações:
//   - Editar: fecha drawer e abre modal de edição existente
//   - Excluir: dispara handler do container (já encadeia confirm + toast)
//
// Padrão deliberado: drawer é leitura, modal é escrita. Evita salvar
// acidentes em saídas que o user só queria conferir.

import { useMemo } from 'react';
import { Pencil, Trash2, Settings2, Truck, AlertCircle, Camera, Wallet, Droplet, Gauge, MapPin, Container, FileText, User, Calendar, Paperclip } from 'lucide-react';
import type {
  SaidaCombustivel,
  Obra,
  Deposito,
  Equipamento,
  Fornecedor,
  Insumo,
  OrigemCombustivel,
  EtapaObra,
} from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';

interface Props {
  saida: SaidaCombustivel | null;
  open: boolean;
  onClose: () => void;
  obras: Obra[];
  etapas: EtapaObra[];
  depositos: Deposito[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  /** Editar: fecha drawer + abre modal SaidaCombustivelForm. */
  onEdit?: (s: SaidaCombustivel) => void;
  /** Excluir: container já trata pedirSenha+confirm+toast. */
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const ORIGEM_LABEL: Record<OrigemCombustivel, string> = {
  tanque: 'Tanque',
  dinheiro: 'Dinheiro',
  requisicao: 'Requisição',
};

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtBRLDec4(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}
function fmtDataHora(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** F9 — Extrai nome do arquivo a partir da signed URL do Supabase Storage.
 *  Path inclui timestamp prefix "1234567890-" que removemos pra display. */
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
  className?: string;
}

function Field({ icon: Icon, label, value, className = '' }: FieldProps) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <Icon className="w-3.5 h-3.5 text-[var(--color-fg-muted)] shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
          {label}
        </div>
        <div className="text-sm text-[var(--color-fg)] mt-0.5 break-words">
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

export default function SaidaDetalhesDrawer({
  saida,
  open,
  onClose,
  obras,
  etapas,
  depositos,
  equipamentos,
  transportadoras,
  combustiveis,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: Props) {
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const etapasMap = useMemo(() => new Map(etapas.map((e) => [e.id, e.nome])), [etapas]);
  const tanquesMap = useMemo(() => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])), [depositos]);
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e])), [equipamentos]);
  const transpMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);
  const combustMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);

  if (!saida) {
    return (
      <Drawer open={open} onClose={onClose} title="Saída de combustível" subtitle="Detalhes" width="lg">
        <div className="text-sm text-[var(--color-fg-muted)] italic">
          Saída não disponível.
        </div>
      </Drawer>
    );
  }

  // Consumidor formatado
  let consumidorLabel: string;
  let consumidorIcon = Settings2;
  let consumidorWarning = false;
  if (saida.tipoConsumidor === 'equipamento_proprio') {
    if (saida.equipamentoId === 'desconhecido' || !saida.equipamentoId) {
      consumidorLabel = 'Sentinel — equipamento não identificado';
      consumidorIcon = AlertCircle;
      consumidorWarning = true;
    } else {
      const eq = equipMap.get(saida.equipamentoId);
      consumidorLabel = eq
        ? `${eq.codigoPatrimonio ? eq.codigoPatrimonio + ' · ' : ''}${eq.nome}`
        : `${saida.equipamentoId} (não encontrado)`;
    }
  } else {
    const transpNome = saida.transportadoraId ? transpMap.get(saida.transportadoraId) : null;
    const placa = (saida.placa || '').trim();
    consumidorIcon = Truck;
    consumidorLabel = [transpNome, placa ? `placa ${placa}` : null].filter(Boolean).join(' · ') || '—';
  }

  const rPorL = saida.litros > 0 ? saida.valorTotal / saida.litros : 0;

  const footer = (
    <div className="flex justify-end gap-2">
      {canEdit && onEdit && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onEdit(saida);
            onClose();
          }}
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
          onClick={() => {
            onDelete(saida.id);
            onClose();
          }}
          className="text-sm inline-flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </Button>
      )}
    </div>
  );

  const consumidorTipo = saida.tipoConsumidor === 'equipamento_proprio' ? 'Equipamento próprio' : 'Carreta terceirizada';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Saída de combustível"
      subtitle={fmtDataHora(saida.data)}
      width="lg"
      footer={footer}
    >
      <div className="space-y-5">
        {/* KPIs no topo: Litros · Valor · R$/L · Origem */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
              <Droplet className="w-3 h-3" />
              Litros
            </div>
            <div className="text-lg font-bold tabular-nums mt-1">
              {saida.litros.toLocaleString('pt-BR')} L
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
              <Wallet className="w-3 h-3" />
              Valor
            </div>
            <div className="text-lg font-bold tabular-nums mt-1">
              {fmtBRL(saida.valorTotal)}
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
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
              Origem
            </div>
            <div className="text-sm font-semibold mt-1.5">
              {ORIGEM_LABEL[saida.origem]}
            </div>
          </div>
        </div>

        {/* Sentinel banner — quando aplicável */}
        {consumidorWarning && (
          <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--color-warning-fg)]">
              <strong>Saída sem equipamento identificado.</strong> Atribua um
              equipamento via "Editar" ou pelo filtro "Apenas sem equipamento" na lista.
            </div>
          </div>
        )}

        {/* Grid de campos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <Field
            icon={Calendar}
            label="Data e hora"
            value={fmtDataHora(saida.data)}
          />
          <Field
            icon={consumidorIcon}
            label={consumidorTipo}
            value={
              <span className={consumidorWarning ? 'text-[var(--color-warning-fg)]' : ''}>
                {consumidorLabel}
              </span>
            }
          />
          <Field
            icon={MapPin}
            label="Obra"
            value={saida.obraId ? (obrasMap.get(saida.obraId) ?? saida.obraId) : '—'}
          />
          <Field
            icon={FileText}
            label="Etapa"
            value={saida.etapaId ? (etapasMap.get(saida.etapaId) ?? saida.etapaId) : '—'}
          />
          <Field
            icon={Container}
            label="Tanque"
            value={saida.tanqueId ? (tanquesMap.get(saida.tanqueId) ?? saida.tanqueId) : '—'}
          />
          <Field
            icon={Droplet}
            label="Combustível"
            value={combustMap.get(saida.tipoCombustivel) ?? saida.tipoCombustivel}
          />
          {saida.motorista && (
            <Field icon={User} label="Operador" value={saida.motorista} />
          )}
          {saida.createdBy && (
            <Field icon={User} label="Lançado por" value={saida.createdBy} />
          )}
        </div>

        {/* Observações — width full quando presentes */}
        {saida.observacoes && (
          <Field
            icon={FileText}
            label="Observações"
            value={<p className="whitespace-pre-wrap">{saida.observacoes}</p>}
          />
        )}

        {/* Fotos — grid responsivo */}
        {saida.fotoUrls && saida.fotoUrls.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
              <Camera className="w-3 h-3" />
              Fotos ({saida.fotoUrls.length})
            </div>
            <div className="grid grid-cols-3 gap-2">
              {saida.fotoUrls.map((url, i) => (
                <a
                  key={url + i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
                >
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* F9 — Arquivos (PDF, xlsx, docx) — lista clicável com nome legível */}
        {saida.arquivoUrls && saida.arquivoUrls.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold mb-2">
              <Paperclip className="w-3 h-3" />
              Arquivos ({saida.arquivoUrls.length})
            </div>
            <ul className="space-y-1.5">
              {saida.arquivoUrls.map((url, i) => (
                <li
                  key={url + i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <FileText aria-hidden className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
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
    </Drawer>
  );
}
