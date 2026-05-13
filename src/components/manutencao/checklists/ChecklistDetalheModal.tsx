// Marco 5 / PR26 — Modal de detalhe de uma execução de checklist.
//
// Mostra todas as respostas com chips de cor por resposta. Em respostas
// 'Não', exibe foto + observação.

import { ImageOff, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import Modal from '../../ui/Modal';
import { useChecklistRespostas, useChecklistPerguntas, useChecklistExecucoes } from '../../../hooks/useChecklists';
import { useEquipamentos } from '../../../hooks/useEquipamentos';
import type { RespostaChecklist, StatusExecucaoChecklist } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  execucaoId: string;
}

const STATUS_LABEL: Record<StatusExecucaoChecklist, string> = {
  concluido: 'Concluído',
  concluido_com_pendencias: 'Concluído com pendências',
  bloqueado: 'Bloqueado',
};

function fmtData(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ChecklistDetalheModal({ open, onClose, execucaoId }: Props) {
  // Não temos getById; vamos puxar a lista e filtrar
  const { data: execucoes = [] } = useChecklistExecucoes({ limit: 500 });
  const execucao = execucoes.find((e) => e.id === execucaoId);
  const { data: respostas = [] } = useChecklistRespostas(execucaoId);
  const { data: perguntas = [] } = useChecklistPerguntas(execucao?.templateId);
  const { data: equipamentos = [] } = useEquipamentos();

  const equipamento = execucao ? equipamentos.find((e) => e.id === execucao.equipamentoId) : null;

  if (!execucao) {
    return (
      <Modal open={open} onClose={onClose} title="Execução de checklist">
        <p className="text-sm text-[var(--color-fg-muted)] py-6 text-center">Execução não encontrada.</p>
      </Modal>
    );
  }

  // Mapa pergunta_id → pergunta
  const perguntasPorId = new Map(perguntas.map((p) => [p.id, p]));

  // Estatísticas
  const sims = respostas.filter((r) => r.resposta === 'sim').length;
  const naos = respostas.filter((r) => r.resposta === 'nao').length;
  const nas = respostas.filter((r) => r.resposta === 'nao_aplica').length;

  return (
    <Modal open={open} onClose={onClose} title={`Execução em ${equipamento?.codigoPatrimonio ?? execucao.equipamentoId}`} size="lg">
      <div className="space-y-4">
        {/* Cabeçalho */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
          <div className="text-xs text-[var(--color-fg-muted)]">Equipamento</div>
          <div className="text-base font-semibold text-[var(--color-fg)]">
            {equipamento?.codigoPatrimonio ?? '—'} · {equipamento?.nome ?? execucao.equipamentoId}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Operador</div>
              <div className="text-sm text-[var(--color-fg)]">{execucao.operadorNome || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Conclusão</div>
              <div className="text-sm text-[var(--color-fg)]">{fmtData(execucao.concluidoEm)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Medição</div>
              <div className="text-sm text-[var(--color-fg)] font-mono">
                {execucao.medicaoAtual != null
                  ? `${execucao.medicaoAtual.toLocaleString('pt-BR')} ${equipamento?.tipoMedicao === 'horimetro' ? 'h' : 'km'}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Status</div>
              <div className="text-sm">
                <span
                  className={
                    'inline-block text-[11px] px-2 py-0.5 rounded-full ' +
                    (execucao.status === 'bloqueado' ? 'bg-[var(--color-danger)] text-white'
                      : execucao.status === 'concluido_com_pendencias' ? 'bg-[var(--color-warning)] text-white'
                      : 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]')
                  }
                >
                  {STATUS_LABEL[execucao.status]}
                </span>
              </div>
            </div>
          </div>
          {execucao.observacoesGerais && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Observações gerais</div>
              <p className="text-sm text-[var(--color-fg)] mt-0.5 whitespace-pre-wrap">{execucao.observacoesGerais}</p>
            </div>
          )}
        </div>

        {/* Resumo respostas */}
        <div className="grid grid-cols-3 gap-2">
          <Counter icon={CheckCircle2} label="Sim" valor={sims} cor="text-[var(--color-success-fg)]" />
          <Counter icon={XCircle} label="Não" valor={naos} cor="text-[var(--color-danger-fg)]" />
          <Counter icon={MinusCircle} label="N/A" valor={nas} cor="text-[var(--color-fg-muted)]" />
        </div>

        {/* Respostas */}
        <div className="space-y-2">
          {respostas
            .slice()
            .sort((a, b) => {
              const pa = perguntasPorId.get(a.perguntaId);
              const pb = perguntasPorId.get(b.perguntaId);
              return (pa?.ordem ?? 999) - (pb?.ordem ?? 999);
            })
            .map((r) => {
              const p = perguntasPorId.get(r.perguntaId);
              return (
                <div
                  key={r.id}
                  className={
                    'rounded-lg border p-3 ' +
                    (r.resposta === 'sim' ? 'border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/50'
                      : r.resposta === 'nao' ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)]')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-fg)]">
                        {p?.pergunta ?? r.perguntaSnapshot}
                        {p?.critica && (
                          <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-danger)] text-white align-middle">
                            CRÍTICA
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={
                        'inline-block text-[11px] px-2 py-0.5 rounded-full shrink-0 ' +
                        (r.resposta === 'sim' ? 'bg-[var(--color-success)] text-white'
                          : r.resposta === 'nao' ? 'bg-[var(--color-danger)] text-white'
                          : 'bg-[var(--color-fg-muted)] text-white')
                      }
                    >
                      {labelResposta(r.resposta)}
                    </span>
                  </div>
                  {r.resposta === 'nao' && (
                    <div className="mt-2 space-y-2">
                      {r.observacao && (
                        <p className="text-xs text-[var(--color-fg)] whitespace-pre-wrap">
                          {r.observacao}
                        </p>
                      )}
                      {r.fotoUrl ? (
                        <a href={r.fotoUrl} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={r.fotoUrl}
                            alt="Foto da não-conformidade"
                            className="w-full max-h-64 object-contain rounded-lg border border-[var(--color-border)] bg-black/30"
                          />
                        </a>
                      ) : (
                        <div className="text-xs text-[var(--color-fg-muted)] inline-flex items-center gap-1">
                          <ImageOff className="w-3.5 h-3.5" /> Sem foto registrada
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </Modal>
  );
}

function labelResposta(r: RespostaChecklist): string {
  return r === 'sim' ? 'Sim' : r === 'nao' ? 'Não' : 'N/A';
}

function Counter({
  icon: Icon, label, valor, cor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2 flex items-center gap-2">
      <Icon className={'w-5 h-5 ' + cor} />
      <div>
        <div className="text-[11px] uppercase text-[var(--color-fg-muted)]">{label}</div>
        <div className="text-lg font-semibold text-[var(--color-fg)]">{valor}</div>
      </div>
    </div>
  );
}
