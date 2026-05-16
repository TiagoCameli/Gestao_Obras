/**
 * Drawer lateral que mostra o histórico de auditoria de um documento de Compras.
 *
 * Carrega de `compras_auditoria` filtrando por entidade + entidade_id e
 * renderiza como timeline reverse-chronological. Cada ação tem um ícone e
 * cor próprios.
 */
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, FileEdit, FileX, Trash2, RotateCcw, PlusCircle,
  Send, Inbox, Banknote, BanknoteX, Package,
} from 'lucide-react';
import Drawer from '../ui/Drawer';
import { carregarHistoricoCompras } from '../../utils/comprasAudit';
import type { AcaoAuditoriaCompras, EntidadeCompra } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  entidade: EntidadeCompra;
  entidadeId: string;
  numero: string;
}

const ACAO_INFO: Record<AcaoAuditoriaCompras, { Icon: typeof CheckCircle2; cor: string; label: string }> = {
  created:             { Icon: PlusCircle,   cor: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200',     label: 'Criou' },
  updated:             { Icon: FileEdit,     cor: 'text-slate-700 bg-slate-50 dark:bg-slate-900 border-slate-200',    label: 'Editou' },
  approved:            { Icon: CheckCircle2, cor: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200', label: 'Aprovou' },
  rejected:            { Icon: XCircle,      cor: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200',     label: 'Rejeitou' },
  cancelled:           { Icon: FileX,        cor: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200',     label: 'Cancelou' },
  deleted:             { Icon: Trash2,       cor: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200',     label: 'Excluiu' },
  restored:            { Icon: RotateCcw,    cor: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200', label: 'Restaurou' },
  received:            { Icon: Inbox,        cor: 'text-slate-700 bg-slate-50 dark:bg-slate-900 border-slate-200',    label: 'Marcou como recebido' },
  sent_to_supplier:    { Icon: Send,         cor: 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200',     label: 'Enviou para fornecedor' },
  quote_received:      { Icon: Package,      cor: 'text-violet-700 bg-violet-50 dark:bg-violet-950/40 border-violet-200', label: 'Recebeu cotação' },
  financial_posted:    { Icon: Banknote,     cor: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200', label: 'Lançou no financeiro' },
  financial_cancelled: { Icon: BanknoteX,    cor: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200',     label: 'Cancelou lançamento' },
};

function formatarDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function HistoricoCompras({ open, onClose, entidade, entidadeId, numero }: Props) {
  // react-query lida com fetching + cache + revalidation sem violar a regra
  // "no setState in effect" do projeto.
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ['compras_auditoria', entidade, entidadeId],
    queryFn: () => carregarHistoricoCompras(entidade, entidadeId),
    enabled: open && !!entidadeId,
    staleTime: 30_000,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Histórico"
      subtitle={numero ? `${entidade.toUpperCase()} · ${numero}` : entidade.toUpperCase()}
      width="md"
    >
      {loading ? (
        <div className="text-sm text-[var(--color-fg-muted)]">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-[var(--color-fg-muted)] py-8 text-center">
          Nenhum evento registrado ainda.
        </div>
      ) : (
        <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-5 pl-6">
          {items.map((it) => {
            const info = ACAO_INFO[it.acao] ?? {
              Icon: FileEdit,
              cor: 'text-slate-700 bg-slate-50 border-slate-200',
              label: it.acao,
            };
            const Icon = info.Icon;
            return (
              <li key={it.id} className="relative">
                <span
                  className={`absolute -left-[33px] top-0 w-6 h-6 rounded-full inline-flex items-center justify-center border ${info.cor}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="text-sm">
                  <div className="font-medium text-[var(--color-fg)]">
                    {info.label}
                    <span className="ml-1.5 text-[var(--color-fg-muted)] font-normal">
                      por {it.usuarioNome}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-fg-subtle)] mt-0.5">
                    {formatarDataHora(it.criadoEm)}
                  </div>
                  {it.observacao && (
                    <div className="text-xs text-[var(--color-fg-muted)] mt-1.5 italic border-l-2 border-[var(--color-border)] pl-2">
                      {it.observacao}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
