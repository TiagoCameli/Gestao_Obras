// F8.3 — Timeline visual do audit_log dum registro (saída/entrada/etc).
// Renderiza eventos do mais recente pro mais antigo, com ícone+cor por
// ação e diff humanizado pros UPDATE.
//
// Mapeamento de campos: chaves técnicas (ex: "valor_total") viram rótulos
// amigáveis ("Valor total"). Valores formatados conforme tipo conhecido
// (numéricos com fmtNum, FK resolvidos quando temos o map; senão raw).

import { useMemo } from 'react';
import { Plus, Pencil, Trash2, Undo2, AlertOctagon, Clock } from 'lucide-react';
import { useAuditLogPorAlvo, type AuditAction, type AuditEntry } from '../../hooks/useAuditLog';

interface Props {
  alvoId: string | null;
  /** Mapa opcional de campos técnicos → label humano. Override quando precisa. */
  fieldLabels?: Record<string, string>;
  /** Mapa opcional de id → nome (equipamentos, obras, tanques) pra resolver
   *  IDs em diff. Caller passa o que tem disponível. */
  resolvers?: {
    equipamentos?: Map<string, string>;
    obras?: Map<string, string>;
    tanques?: Map<string, string>;
    combustiveis?: Map<string, string>;
  };
}

const ACTION_META: Record<AuditAction, { icon: typeof Plus; color: string; bg: string; label: string }> = {
  create: { icon: Plus, color: 'text-[var(--color-success-fg)]', bg: 'bg-[var(--color-success-soft)]', label: 'Criou' },
  update: { icon: Pencil, color: 'text-[var(--color-accent-fg)]', bg: 'bg-[var(--color-accent-soft)]', label: 'Alterou' },
  delete: { icon: Trash2, color: 'text-[var(--color-danger-fg)]', bg: 'bg-[var(--color-danger-soft)]', label: 'Excluiu' },
  restore: { icon: Undo2, color: 'text-[var(--color-warning-fg)]', bg: 'bg-[var(--color-warning-soft)]', label: 'Restaurou' },
  hard_delete: { icon: AlertOctagon, color: 'text-[var(--color-danger-fg)]', bg: 'bg-[var(--color-danger-soft)]', label: 'Excluiu (hard)' },
};

/** Labels default pros campos mais comuns das tabelas Combustível. */
const DEFAULT_FIELD_LABELS: Record<string, string> = {
  data: 'Data',
  data_hora: 'Data e hora',
  litros: 'Litros',
  quantidade_litros: 'Litros',
  valor_total: 'Valor total',
  preco_unitario: 'Preço unitário',
  preco_combustivel: 'Preço combustível',
  preco_medio_tanque_snapshot: 'Preço médio (snapshot)',
  taxa_litro: 'Taxa por litro',
  origem: 'Origem',
  tipo_consumidor: 'Tipo de consumidor',
  equipamento_id: 'Equipamento',
  transportadora_id: 'Transportadora',
  placa: 'Placa',
  motorista: 'Motorista',
  obra_id: 'Obra',
  etapa_id: 'Etapa',
  tanque_id: 'Tanque',
  deposito_id: 'Tanque',
  deposito_origem_id: 'Tanque de origem',
  deposito_destino_id: 'Tanque de destino',
  tipo_combustivel: 'Combustível',
  fornecedor: 'Fornecedor',
  nota_fiscal: 'Nota fiscal',
  observacoes: 'Observações',
  pago: 'Pago',
  pago_em: 'Data do pagamento',
  foto_urls: 'Fotos',
  arquivo_urls: 'Arquivos',
  nome: 'Nome',
  apelido: 'Apelido',
  capacidade_litros: 'Capacidade',
  nivel_atual_litros: 'Nível atual',
  ativo: 'Ativo',
};

function fmtDataHoraBR(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtValor(
  field: string,
  value: unknown,
  resolvers?: Props['resolvers'],
): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  const s = String(value);
  // Tenta resolver IDs quando tem resolver disponível
  if (field === 'equipamento_id' && resolvers?.equipamentos?.has(s)) return resolvers.equipamentos.get(s)!;
  if (field === 'obra_id' && resolvers?.obras?.has(s)) return resolvers.obras.get(s)!;
  if (
    (field === 'tanque_id' || field === 'deposito_id' || field === 'deposito_origem_id' || field === 'deposito_destino_id')
    && resolvers?.tanques?.has(s)
  ) return resolvers.tanques.get(s)!;
  if (field === 'tipo_combustivel' && resolvers?.combustiveis?.has(s)) return resolvers.combustiveis.get(s)!;
  // Datas: formata se ISO
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s)) return fmtDataHoraBR(s);
  return s;
}

export default function HistoricoTimeline({ alvoId, fieldLabels, resolvers }: Props) {
  const { data: entries = [], isLoading, isError } = useAuditLogPorAlvo(alvoId);

  const labels = useMemo(() => ({ ...DEFAULT_FIELD_LABELS, ...(fieldLabels ?? {}) }), [fieldLabels]);

  if (!alvoId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)] py-4">
        <Clock className="w-3.5 h-3.5 animate-pulse" />
        Carregando histórico...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-xs text-[var(--color-danger-fg)] py-4">
        Falha ao carregar histórico.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-xs text-[var(--color-fg-muted)] italic py-4">
        Sem histórico registrado.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <TimelineItem key={e.id} entry={e} labels={labels} resolvers={resolvers} />
      ))}
    </ol>
  );
}

interface ItemProps {
  entry: AuditEntry;
  labels: Record<string, string>;
  resolvers?: Props['resolvers'];
}

function TimelineItem({ entry, labels, resolvers }: ItemProps) {
  const meta = ACTION_META[entry.action];
  const Icon = meta.icon;

  // diff humanizado: lista cada campo alterado em UPDATE
  const diffEntries = useMemo(() => {
    if (entry.action !== 'update') return [];
    return Object.entries(entry.diff)
      .filter(([key]) => !['updated_at', 'updated_by', 'created_at', 'created_by'].includes(key))
      .map(([key, val]) => {
        const v = val as { old?: unknown; new?: unknown } | unknown;
        if (v && typeof v === 'object' && 'old' in v && 'new' in v) {
          return {
            field: labels[key] ?? key,
            old: fmtValor(key, (v as { old: unknown }).old, resolvers),
            new: fmtValor(key, (v as { new: unknown }).new, resolvers),
          };
        }
        return { field: labels[key] ?? key, old: '—', new: fmtValor(key, v, resolvers) };
      });
  }, [entry, labels, resolvers]);

  return (
    <li className="flex items-start gap-2.5">
      <div
        className={`shrink-0 w-7 h-7 rounded-full ${meta.bg} flex items-center justify-center mt-0.5`}
      >
        <Icon className={`w-3.5 h-3.5 ${meta.color}`} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-semibold">{meta.label}</span>{' '}
          <span className="text-[var(--color-fg-muted)]">por</span>{' '}
          <span className="font-medium">{entry.funcionarioId}</span>
        </div>
        <div className="text-[11px] text-[var(--color-fg-muted)] tabular-nums">
          {fmtDataHoraBR(entry.dataHora)}
        </div>
        {entry.action === 'update' && diffEntries.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {diffEntries.map((d, i) => (
              <li
                key={i}
                className="text-[11px] text-[var(--color-fg)] flex items-center gap-1.5 flex-wrap"
              >
                <span className="text-[var(--color-fg-muted)]">{d.field}:</span>
                <span className="line-through text-[var(--color-fg-subtle)] truncate max-w-[180px]" title={d.old}>
                  {d.old}
                </span>
                <span className="text-[var(--color-fg-muted)]">→</span>
                <span className="font-medium truncate max-w-[180px]" title={d.new}>
                  {d.new}
                </span>
              </li>
            ))}
          </ul>
        )}
        {entry.action === 'delete' && (
          <div className="text-[11px] text-[var(--color-fg-muted)] italic mt-1">
            Registro removido (soft delete) — pode ser restaurado.
          </div>
        )}
        {entry.action === 'restore' && (
          <div className="text-[11px] text-[var(--color-fg-muted)] italic mt-1">
            Registro restaurado da exclusão.
          </div>
        )}
      </div>
    </li>
  );
}
