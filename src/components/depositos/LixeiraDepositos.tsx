/**
 * LixeiraDepositos — modal com itens deletados (depósitos + movimentações).
 * Mesma UX da LixeiraCompras, adaptada para o módulo de Depósitos.
 */
import { useMemo, useState } from 'react';
import {
  Trash2, RotateCcw, AlertTriangle, Package, ArrowDown, ArrowUp, ArrowRightLeft, Inbox, Clock, Sparkles,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  useDepositosLixeira,
  useRestaurarDepositoLixeira,
  useExcluirPermanenteDeposito,
  usePurgarLixeiraDepositos,
  type DepositoLixeiraItem,
  type EntidadeDeposito,
} from '../../hooks/useDepositosLixeira';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ENTIDADE_INFO: Record<EntidadeDeposito, { label: string; Icon: typeof Package; cor: string }> = {
  deposito:      { label: 'Depósitos',       Icon: Package,        cor: 'text-emerald-600' },
  entrada:       { label: 'Entradas',        Icon: ArrowDown,      cor: 'text-blue-600' },
  saida:         { label: 'Saídas',          Icon: ArrowUp,        cor: 'text-rose-600' },
  transferencia: { label: 'Transferências',  Icon: ArrowRightLeft, cor: 'text-violet-600' },
};

function fmtDataHora(iso: string): string {
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}
function diasRestantes(retencaoAte: string): number {
  return Math.max(0, Math.ceil((new Date(retencaoAte).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function LixeiraDepositos({ open, onClose }: Props) {
  const { temAcao, usuario } = useAuth();
  const { showToast } = useToast();
  const podeRestaurar = temAcao('restaurar_lixeira_depositos');
  const podeExcluirPerm = temAcao('excluir_permanente_depositos');

  const { data: items = [], isLoading } = useDepositosLixeira();
  const restaurarMut = useRestaurarDepositoLixeira();
  const excluirPermMut = useExcluirPermanenteDeposito();
  const purgarMut = usePurgarLixeiraDepositos();

  const [tabAtiva, setTabAtiva] = useState<EntidadeDeposito>('deposito');
  const [confirmar, setConfirmar] = useState<{ tipo: 'restaurar' | 'excluir'; item: DepositoLixeiraItem } | null>(null);

  const itensPorTab = useMemo(
    () => ({
      deposito:      items.filter((i) => i.entidade === 'deposito'),
      entrada:       items.filter((i) => i.entidade === 'entrada'),
      saida:         items.filter((i) => i.entidade === 'saida'),
      transferencia: items.filter((i) => i.entidade === 'transferencia'),
    }) as Record<EntidadeDeposito, DepositoLixeiraItem[]>,
    [items]
  );

  const handleRestaurar = async (item: DepositoLixeiraItem) => {
    try {
      await restaurarMut.mutateAsync({ item, usuarioNome: usuario?.nome || '' });
      showToast({ kind: 'success', message: 'Item restaurado com sucesso.' });
      setConfirmar(null);
    } catch (e) {
      showToast({ kind: 'error', message: 'Falha ao restaurar: ' + (e as Error).message });
    }
  };
  const handleExcluirPerm = async (item: DepositoLixeiraItem) => {
    try {
      await excluirPermMut.mutateAsync({ item, usuarioNome: usuario?.nome || '' });
      showToast({ kind: 'success', message: 'Item excluído permanentemente.' });
      setConfirmar(null);
    } catch (e) {
      showToast({ kind: 'error', message: 'Falha ao excluir: ' + (e as Error).message });
    }
  };
  const handlePurgar = async () => {
    if (!confirm('Limpar todos os itens com retenção expirada (>30 dias)?')) return;
    try {
      const n = await purgarMut.mutateAsync();
      showToast({
        kind: 'success',
        message: n === 0 ? 'Nenhum item expirado.' : `${n} item(ns) removidos permanentemente.`,
      });
    } catch (e) {
      showToast({ kind: 'error', message: 'Falha ao limpar: ' + (e as Error).message });
    }
  };

  const itensAtivos = itensPorTab[tabAtiva];
  const total = items.length;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Lixeira de Depósitos" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Itens excluídos ficam na lixeira por <strong>30 dias</strong>. Você pode restaurar
            ou apagar manualmente a qualquer momento.
          </p>

          <div className="flex flex-wrap gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-1 w-fit">
            {(['deposito', 'entrada', 'saida', 'transferencia'] as EntidadeDeposito[]).map((ent) => {
              const info = ENTIDADE_INFO[ent];
              const Icon = info.Icon;
              const ativo = tabAtiva === ent;
              const count = itensPorTab[ent].length;
              return (
                <button
                  key={ent}
                  type="button"
                  onClick={() => setTabAtiva(ent)}
                  className={
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-2 ' +
                    (ativo
                      ? 'bg-[var(--color-surface-1)] text-[var(--color-fg)] shadow-[var(--shadow-xs)]'
                      : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {info.label}
                  {count > 0 && (
                    <span className={
                      'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded text-[10px] font-bold tabular-nums ' +
                      (ativo ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)]')
                    }>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando…</div>
          ) : itensAtivos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] py-12 text-center">
              <Inbox className="w-8 h-8 mx-auto text-[var(--color-fg-subtle)] mb-2" />
              <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                {ENTIDADE_INFO[tabAtiva].label} — lixeira vazia
              </h3>
              <p className="text-xs text-[var(--color-fg-muted)]">Nenhum item excluído.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto -mx-1 px-1">
              {itensAtivos.map((item) => (
                <ItemLixeira
                  key={item.id}
                  item={item}
                  podeRestaurar={podeRestaurar}
                  podeExcluirPerm={podeExcluirPerm}
                  onRestaurar={() => setConfirmar({ tipo: 'restaurar', item })}
                  onExcluirPerm={() => setConfirmar({ tipo: 'excluir', item })}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-fg-muted)]">
              Total na lixeira: {total} item{total !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              {podeExcluirPerm && (
                <button
                  type="button"
                  onClick={handlePurgar}
                  disabled={purgarMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50"
                  title="Apaga itens com mais de 30 dias"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {purgarMut.isPending ? 'Limpando…' : 'Limpar expirados'}
                </button>
              )}
              <Button variant="secondary" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Diálogo de confirmação */}
      <Modal
        open={!!confirmar}
        onClose={() => setConfirmar(null)}
        title={confirmar?.tipo === 'restaurar' ? 'Restaurar item' : 'Excluir permanentemente'}
      >
        {confirmar && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${confirmar.tipo === 'excluir' ? 'text-rose-600' : 'text-amber-600'}`} />
              <div className="text-sm text-[var(--color-fg)]">
                {confirmar.tipo === 'restaurar'
                  ? <>O item será <strong>restaurado</strong> e voltará a aparecer normalmente. Tudo certo?</>
                  : <>O item será <strong>removido permanentemente</strong>. Esta ação <strong>não pode ser desfeita</strong>. Confirma?</>}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs">
              <div>
                <strong>{ENTIDADE_INFO[confirmar.item.entidade].label.slice(0, -1)}</strong>
                {' · '}
                {(confirmar.item.payload.nome as string) || (confirmar.item.payload.numero as string) || confirmar.item.entidadeId}
              </div>
              <div className="text-[var(--color-fg-muted)] mt-0.5">
                Excluído por {confirmar.item.deletadoPor || 'desconhecido'} em {fmtDataHora(confirmar.item.deletadoEm)}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setConfirmar(null)}>Cancelar</Button>
              {confirmar.tipo === 'restaurar' ? (
                <Button onClick={() => handleRestaurar(confirmar.item)} disabled={restaurarMut.isPending}>
                  <RotateCcw className="w-4 h-4" />
                  {restaurarMut.isPending ? 'Restaurando…' : 'Restaurar'}
                </Button>
              ) : (
                <Button variant="danger" onClick={() => handleExcluirPerm(confirmar.item)} disabled={excluirPermMut.isPending}>
                  <Trash2 className="w-4 h-4" />
                  {excluirPermMut.isPending ? 'Excluindo…' : 'Excluir permanente'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function ItemLixeira({
  item, podeRestaurar, podeExcluirPerm, onRestaurar, onExcluirPerm,
}: {
  item: DepositoLixeiraItem;
  podeRestaurar: boolean;
  podeExcluirPerm: boolean;
  onRestaurar: () => void;
  onExcluirPerm: () => void;
}) {
  const dias = diasRestantes(item.retencaoAte);
  const corDias = dias <= 3 ? 'text-rose-600' : dias <= 7 ? 'text-amber-600' : 'text-[var(--color-fg-muted)]';
  const nome = (item.payload.nome as string)
    ?? (item.payload.numero as string)
    ?? item.entidadeId;
  const descricao = (item.payload.observacoes as string)
    ?? (item.payload.endereco as string)
    ?? '';

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex items-center gap-3 hover:bg-[var(--color-surface-2)]/40 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-fg)] truncate">{nome}</div>
        {descricao && <div className="text-xs text-[var(--color-fg-muted)] truncate mt-0.5">{descricao}</div>}
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-fg-subtle)] mt-1">
          <span>Excluído por <strong>{item.deletadoPor || '?'}</strong> em {fmtDataHora(item.deletadoEm)}</span>
          <span className={`inline-flex items-center gap-1 ${corDias}`}>
            <Clock className="w-3 h-3" />
            {dias === 0 ? 'expira hoje' : `${dias}d restantes`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {podeRestaurar && (
          <button
            type="button"
            onClick={onRestaurar}
            title="Restaurar"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Restaurar
          </button>
        )}
        {podeExcluirPerm && (
          <button
            type="button"
            onClick={onExcluirPerm}
            title="Excluir permanentemente"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
