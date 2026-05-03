import { useMemo, useState } from 'react';
import { History, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import { useAuth } from '../../../../contexts/AuthContext';
import ManutencaoEmptyState from '../shared/ManutencaoEmptyState';
import { deleteRegistro } from '../../utils/manutencaoRegistrosApi';
import {
  ACOES_MANUTENCAO,
  EXECUTOR_LABELS,
  type ManutencaoRegistro,
  type ManutencaoTarefa,
} from '../../types';

export interface HistoricoManutencaoListProps {
  registros: ManutencaoRegistro[];
  tarefas: ManutencaoTarefa[];
  className?: string;
}

const STATUS_LABEL: Record<ManutencaoRegistro['status'], string> = {
  concluida: 'Concluída',
  pendente: 'Pendente',
  parcial: 'Parcial',
  cancelada: 'Cancelada',
};

const STATUS_COR: Record<ManutencaoRegistro['status'], string> = {
  concluida: 'var(--color-success-fg)',
  pendente: 'var(--color-warning-fg)',
  parcial: 'var(--color-info-fg)',
  cancelada: 'var(--color-fg-subtle)',
};

function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatarBRL(v?: number): string {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function HistoricoManutencaoList({
  registros,
  tarefas,
  className = '',
}: HistoricoManutencaoListProps) {
  const tarefaPorId = useMemo(() => {
    const m = new Map<string, ManutencaoTarefa>();
    tarefas.forEach((t) => m.set(t.id, t));
    return m;
  }, [tarefas]);

  const [aberto, setAberto] = useState<ManutencaoRegistro | null>(null);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const qc = useQueryClient();
  const { temAcao } = useAuth();
  const podeEditar = temAcao(ACOES_MANUTENCAO.editar);

  async function handleExcluir() {
    if (!aberto) return;
    setExcluindo(true);
    try {
      await deleteRegistro(aberto.id);
      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      setExcluirOpen(false);
      setAberto(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao deletar');
    } finally {
      setExcluindo(false);
    }
  }

  if (registros.length === 0) {
    return (
      <ManutencaoEmptyState
        titulo="Sem histórico"
        mensagem="Nenhuma manutenção foi registrada para este equipamento."
        icone={<History />}
        className={className}
      />
    );
  }

  return (
    <div className={'w-full ' + className}>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
            <tr>
              <th className="text-left font-medium px-3 py-2">Data</th>
              <th className="text-left font-medium px-3 py-2">Tarefa</th>
              <th className="text-left font-medium px-3 py-2">Executor</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-right font-medium px-3 py-2">Horímetro</th>
              <th className="text-right font-medium px-3 py-2">Custo</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r, i) => {
              const t = tarefaPorId.get(r.tarefaId);
              return (
                <tr
                  key={r.id}
                  onClick={() => setAberto(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAberto(r);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Detalhes do registro ${formatarData(r.executadoEm)}`}
                  className={
                    'cursor-pointer transition-colors ' +
                    (i % 2 === 0 ? 'bg-[var(--color-surface-1)]' : 'bg-[var(--color-surface-2)]/50') +
                    ' hover:bg-[var(--color-surface-2)] ' +
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
                  }
                >
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--color-fg-muted)]">
                    {formatarData(r.executadoEm)}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-fg)]">{t?.titulo ?? r.tarefaId}</td>
                  <td className="px-3 py-2 text-[var(--color-fg-muted)]">
                    {EXECUTOR_LABELS[r.executorPapel]}
                  </td>
                  <td className="px-3 py-2 font-medium" style={{ color: STATUS_COR[r.status] }}>
                    {STATUS_LABEL[r.status]}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--color-fg-muted)]">
                    {r.horimetroNoMomento?.toLocaleString('pt-BR') ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-fg)]">
                    {formatarBRL(r.custoTotalBrl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!aberto}
        onClose={() => setAberto(null)}
        title={
          aberto ? (tarefaPorId.get(aberto.tarefaId)?.titulo ?? 'Registro') : 'Registro'
        }
        size="lg"
      >
        {aberto && (
          <div className="p-4 sm:p-5 space-y-4 text-sm">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-[var(--color-fg-muted)]">Data</dt>
                <dd className="text-[var(--color-fg)]">{formatarData(aberto.executadoEm)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-fg-muted)]">Executor</dt>
                <dd className="text-[var(--color-fg)]">{EXECUTOR_LABELS[aberto.executorPapel]}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-fg-muted)]">Status</dt>
                <dd style={{ color: STATUS_COR[aberto.status] }} className="font-medium">
                  {STATUS_LABEL[aberto.status]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-fg-muted)]">Horímetro</dt>
                <dd className="text-[var(--color-fg)] font-mono">
                  {aberto.horimetroNoMomento?.toLocaleString('pt-BR') ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-fg-muted)]">Custo total</dt>
                <dd className="text-[var(--color-fg)]">{formatarBRL(aberto.custoTotalBrl)}</dd>
              </div>
            </dl>

            {aberto.observacoes && (
              <div>
                <h5 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase mb-1">
                  Observações
                </h5>
                <p className="whitespace-pre-wrap text-[var(--color-fg)]">{aberto.observacoes}</p>
              </div>
            )}

            {aberto.problemasEncontrados && (
              <div>
                <h5 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase mb-1">
                  Problemas encontrados
                </h5>
                <p className="whitespace-pre-wrap text-[var(--color-fg)]">
                  {aberto.problemasEncontrados}
                </p>
              </div>
            )}

            {aberto.acoesRecomendadas && (
              <div>
                <h5 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase mb-1">
                  Ações recomendadas
                </h5>
                <p className="whitespace-pre-wrap text-[var(--color-fg)]">
                  {aberto.acoesRecomendadas}
                </p>
              </div>
            )}

            {aberto.fotosUrls && aberto.fotosUrls.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase mb-2">
                  Fotos
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {aberto.fotosUrls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square overflow-hidden rounded-lg border border-[var(--color-border)]"
                    >
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {podeEditar && (
              <div className="flex justify-between items-center pt-3 border-t border-[var(--color-border)]">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => setExcluirOpen(true)}
                  disabled={excluindo}
                >
                  <Trash2 aria-hidden className="w-4 h-4" />
                  Deletar
                </Button>
                <Link
                  to={`/manutencao/registros/${aberto.id}/editar`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-sm"
                  onClick={() => setAberto(null)}
                >
                  <Pencil aria-hidden className="w-4 h-4" />
                  Editar
                </Link>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={excluirOpen}
        onClose={() => setExcluirOpen(false)}
        onConfirm={handleExcluir}
        title="Deletar registro de manutenção"
        message="Tem certeza que deseja deletar este registro? As fotos serão removidas permanentemente do bucket."
        requirePassword={false}
      />
    </div>
  );
}

export default HistoricoManutencaoList;
