// F10 — Aba Lixeira admin-only.
//
// Mostra registros soft-deleted das 4 entidades operacionais do Combustível,
// agrupados em sections collapsible. Cada item resume os dados-chave +
// autor da exclusão + data + botão "Restaurar" (UPDATE deleted_at = NULL).
//
// Sem hard delete por design — compliance contábil/DNIT exige histórico.
// Pra purga manual, admin usa SQL direto no DB (fora do escopo da UI).

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Undo2, Droplet, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Container, Loader2 } from 'lucide-react';
import { useToast } from '../../../ui/Toast';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import {
  useSaidasCombustivelDeletadas,
  useRestaurarSaidaCombustivel,
} from '../../../../hooks/useSaidasCombustivel';
import {
  useEntradasCombustivelDeletadas,
  useRestaurarEntradaCombustivel,
} from '../../../../hooks/useEntradasCombustivel';
import {
  useTransferenciasCombustivelDeletadas,
  useRestaurarTransferenciaCombustivel,
} from '../../../../hooks/useTransferenciasCombustivel';
import {
  useDepositosDeletados,
  useRestaurarDeposito,
} from '../../../../hooks/useDepositos';
import type { Equipamento, Obra, Deposito } from '../../../../types';
import Button from '../../../ui/Button';
import EmptyState from '../shared/EmptyState';
import { useAuth } from '../../../../contexts/AuthContext';

interface Props {
  equipamentos: Equipamento[];
  obras: Obra[];
  /** Tanques ativos pra resolver nomes em saídas/entradas/transferências deletadas. */
  depositos: Deposito[];
}

function fmtDataHoraBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function LixeiraTab({ equipamentos, obras, depositos }: Props) {
  const { temAcao } = useAuth();
  const canVerLixeira = temAcao('ver_lixeira_combustivel');
  const canRestaurar = temAcao('restaurar_lixeira_combustivel');
  const { showToast } = useToast();
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const saidasQ = useSaidasCombustivelDeletadas();
  const entradasQ = useEntradasCombustivelDeletadas();
  const transfersQ = useTransferenciasCombustivelDeletadas();
  const tanquesQ = useDepositosDeletados();

  const restaurarSaida = useRestaurarSaidaCombustivel();
  const restaurarEntrada = useRestaurarEntradaCombustivel();
  const restaurarTransf = useRestaurarTransferenciaCombustivel();
  const restaurarTanque = useRestaurarDeposito();

  const equipMap = useMemo(
    () => new Map(equipamentos.map((e) => [e.id, e.codigoPatrimonio ? `${e.codigoPatrimonio} · ${e.nome}` : e.nome])),
    [equipamentos],
  );
  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const tanqueMap = useMemo(
    () => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])),
    [depositos],
  );

  const saidas = saidasQ.data ?? [];
  const entradas = entradasQ.data ?? [];
  const transfers = transfersQ.data ?? [];
  const tanques = tanquesQ.data ?? [];
  const totalDeletados = saidas.length + entradas.length + transfers.length + tanques.length;

  const isLoading = saidasQ.isLoading || entradasQ.isLoading || transfersQ.isLoading || tanquesQ.isLoading;

  function handleRestaurar(
    tipo: 'saida' | 'entrada' | 'transferencia' | 'tanque',
    id: string,
  ) {
    if (!canRestaurar) {
      showToast({ kind: 'error', message: 'Sem permissão para restaurar itens da lixeira.' });
      return;
    }
    setConfirmState({
      open: true,
      title: 'Restaurar registro',
      message: 'Restaurar este registro?',
      onConfirm: async () => {
        setConfirmState(null);
        try {
          if (tipo === 'saida') await restaurarSaida.mutateAsync(id);
          else if (tipo === 'entrada') await restaurarEntrada.mutateAsync(id);
          else if (tipo === 'transferencia') await restaurarTransf.mutateAsync(id);
          else await restaurarTanque.mutateAsync(id);
          showToast({ kind: 'success', message: 'Registro restaurado.' });
        } catch (e) {
          console.error('[lixeira] falha ao restaurar', e);
          showToast({ kind: 'error', message: 'Falha ao restaurar. Tente novamente.' });
        }
      },
    });
  }

  if (!canVerLixeira) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para visualizar a lixeira de combustível.
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

  return (
    <div className="space-y-4">
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
          requirePassword={false}
        />
      )}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-fg)]">Lixeira</h2>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Registros excluídos preservados pra auditoria. Click em <strong>Restaurar</strong> pra reativar.
          {totalDeletados > 0 && (
            <span className="ml-2 text-xs">
              · <strong>{totalDeletados}</strong> registro{totalDeletados !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {totalDeletados === 0 ? (
        <EmptyState
          title="Lixeira vazia"
          description="Nenhum registro excluído. Quando alguém excluir uma saída, entrada, transferência ou tanque, ele aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {saidas.length > 0 && (
            <Section
              title="Saídas excluídas"
              icon={ArrowUpFromLine}
              count={saidas.length}
              defaultOpen
            >
              <ul className="divide-y divide-[var(--color-border)]">
                {saidas.map((s) => {
                  const equip = s.equipamentoId ? equipMap.get(s.equipamentoId) : null;
                  const obra = s.obraId ? obraMap.get(s.obraId) : null;
                  const tanque = s.tanqueId ? tanqueMap.get(s.tanqueId) : null;
                  return (
                    <DeletedItem
                      key={s.id}
                      title={`${s.litros.toLocaleString('pt-BR')} L · ${fmtBRL(s.valorTotal)}`}
                      subtitle={[fmtDataHoraBR(s.data), equip ?? s.placa, obra, tanque].filter(Boolean).join(' · ')}
                      deletedAt={s.deletedAt}
                      deletedBy={s.deletedBy}
                      onRestore={() => handleRestaurar('saida', s.id)}
                      busy={restaurarSaida.isPending}
                    />
                  );
                })}
              </ul>
            </Section>
          )}

          {entradas.length > 0 && (
            <Section
              title="Entradas excluídas"
              icon={ArrowDownToLine}
              count={entradas.length}
            >
              <ul className="divide-y divide-[var(--color-border)]">
                {entradas.map((e) => (
                  <DeletedItem
                    key={e.id}
                    title={`${e.quantidadeLitros.toLocaleString('pt-BR')} L · ${fmtBRL(e.valorTotal)}`}
                    subtitle={[fmtDataHoraBR(e.dataHora), e.fornecedor, tanqueMap.get(e.depositoId) ?? '—', e.notaFiscal && `NF ${e.notaFiscal}`].filter(Boolean).join(' · ')}
                    deletedAt={e.deletedAt}
                    deletedBy={e.deletedBy}
                    onRestore={() => handleRestaurar('entrada', e.id)}
                    busy={restaurarEntrada.isPending}
                  />
                ))}
              </ul>
            </Section>
          )}

          {transfers.length > 0 && (
            <Section
              title="Transferências excluídas"
              icon={ArrowLeftRight}
              count={transfers.length}
            >
              <ul className="divide-y divide-[var(--color-border)]">
                {transfers.map((t) => (
                  <DeletedItem
                    key={t.id}
                    title={`${t.quantidadeLitros.toLocaleString('pt-BR')} L`}
                    subtitle={[
                      fmtDataHoraBR(t.dataHora),
                      `${tanqueMap.get(t.depositoOrigemId) ?? '?'} → ${tanqueMap.get(t.depositoDestinoId) ?? '?'}`,
                    ].filter(Boolean).join(' · ')}
                    deletedAt={t.deletedAt}
                    deletedBy={t.deletedBy}
                    onRestore={() => handleRestaurar('transferencia', t.id)}
                    busy={restaurarTransf.isPending}
                  />
                ))}
              </ul>
            </Section>
          )}

          {tanques.length > 0 && (
            <Section
              title="Tanques excluídos"
              icon={Container}
              count={tanques.length}
            >
              <ul className="divide-y divide-[var(--color-border)]">
                {tanques.map((d) => (
                  <DeletedItem
                    key={d.id}
                    title={d.nome}
                    subtitle={`Capacidade ${d.capacidadeLitros.toLocaleString('pt-BR')} L · Nível atual ${d.nivelAtualLitros.toLocaleString('pt-BR')} L`}
                    deletedAt={d.deletedAt}
                    deletedBy={d.deletedBy}
                    onRestore={() => handleRestaurar('tanque', d.id)}
                    busy={restaurarTanque.isPending}
                  />
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, count, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[var(--color-surface-2)] transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-[var(--color-fg-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-fg-muted)]" />}
        <Icon className="w-4 h-4 text-[var(--color-fg-muted)]" />
        <span className="font-semibold text-sm flex-1 text-left">{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] font-semibold tabular-nums">
          {count}
        </span>
      </button>
      {open && <div className="border-t border-[var(--color-border)]">{children}</div>}
    </div>
  );
}

interface DeletedItemProps {
  title: string;
  subtitle: string;
  deletedAt: string | null;
  deletedBy: string | null;
  onRestore: () => void;
  busy: boolean;
}

function DeletedItem({ title, subtitle, deletedAt, deletedBy, onRestore, busy }: DeletedItemProps) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)]/40 transition-colors">
      <Droplet className="w-4 h-4 text-[var(--color-fg-subtle)] shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)] truncate">{title}</div>
        <div className="text-xs text-[var(--color-fg-muted)] truncate">{subtitle}</div>
        <div className="text-[11px] text-[var(--color-fg-subtle)] italic mt-0.5">
          Excluído por <strong>{deletedBy ?? '—'}</strong> em {fmtDataHoraBR(deletedAt)}
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onRestore}
        disabled={busy}
        className="text-xs inline-flex items-center gap-1.5 shrink-0"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
        Restaurar
      </Button>
    </li>
  );
}
