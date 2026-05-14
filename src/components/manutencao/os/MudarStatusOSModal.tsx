// Marco 2 / PR11 — Modal que confirma a mudança de status da OS.
//
// Permite escolher próximo status a partir dos válidos (transitions
// flow), e em transições críticas (concluída/cancelada) pede observação.

import { useState, type FormEvent } from 'react';
import type { StatusOS } from '../../../types';
import { STATUS_OS_LABEL } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { STATUS_COLOR } from './styles';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  numero: string;
  statusAtual: StatusOS;
  onConfirm: (novoStatus: StatusOS, observacao: string) => Promise<void>;
}

/** Próximos status válidos a partir do atual. */
function proximosStatus(atual: StatusOS): StatusOS[] {
  switch (atual) {
    case 'rascunho':            return ['aberta', 'cancelada'];
    case 'aberta':              return ['em_execucao', 'aguardando_pecas', 'cancelada'];
    case 'aguardando_pecas':    return ['em_execucao', 'cancelada'];
    case 'em_execucao':         return ['aguardando_pecas', 'aguardando_aprovacao', 'concluida', 'cancelada'];
    case 'aguardando_aprovacao':return ['concluida', 'em_execucao', 'cancelada'];
    case 'concluida':           return []; // não pode mudar
    case 'cancelada':           return ['aberta']; // reabertura
    default:                    return [];
  }
}

const PRECISA_OBS = new Set<StatusOS>(['concluida', 'cancelada']);

export default function MudarStatusOSModal({
  open, onClose, numero, statusAtual, onConfirm,
}: Props) {
  const opcoes = proximosStatus(statusAtual);
  const [escolhido, setEscolhido] = useState<StatusOS | ''>('');
  const [obs, setObs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const precisaObs = escolhido && PRECISA_OBS.has(escolhido);
  const podeSalvar = !!escolhido && (!precisaObs || obs.trim().length > 0);

  const { temAcao } = useAuth();
  const canMudar = temAcao('mudar_status_os');
  const canAprovar = temAcao('aprovar_os');
  const canCancelar = temAcao('cancelar_os');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting || !escolhido) return;
    // Gates específicos por transição
    if (escolhido === 'cancelada' && !canCancelar) return;
    if (escolhido === 'concluida' && !canAprovar && !canMudar) return;
    if (!canMudar && !canAprovar && !canCancelar) return;
    setSubmitting(true);
    try {
      await onConfirm(escolhido, obs.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Avançar status — ${numero}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
          <p className="text-xs text-[var(--color-fg-muted)] mb-1">Status atual</p>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: STATUS_COLOR[statusAtual].bg, color: STATUS_COLOR[statusAtual].fg }}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[statusAtual].dot }} />
            {STATUS_OS_LABEL[statusAtual]}
          </span>
        </div>

        {opcoes.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)] py-2 text-center">
            Esta OS não pode mudar de status (já está concluída).
          </p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
                Próximo status
              </label>
              <div className="flex flex-wrap gap-2">
                {opcoes.map((s) => {
                  const ativo = escolhido === s;
                  const cor = STATUS_COLOR[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEscolhido(s)}
                      className={
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ' +
                        (ativo ? 'ring-2 ring-[var(--color-ring)]' : '')
                      }
                      style={{
                        backgroundColor: cor.bg,
                        color: cor.fg,
                        borderColor: ativo ? cor.dot : 'transparent',
                      }}
                    >
                      <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor.dot }} />
                      {STATUS_OS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="osObsStatus"
                className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
              >
                Observação {precisaObs && <span className="text-[var(--color-danger)]">*</span>}
              </label>
              <textarea
                id="osObsStatus"
                rows={3}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder={
                  precisaObs
                    ? (escolhido === 'concluida'
                        ? 'Resumo do que foi feito, peças trocadas, próxima recomendação…'
                        : 'Motivo do cancelamento…')
                    : 'Opcional'
                }
                className="w-full min-h-[72px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                required={!!precisaObs}
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            {opcoes.length === 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          {opcoes.length > 0 && (
            <Button type="submit" disabled={!podeSalvar || submitting}>
              {submitting ? 'Salvando…' : 'Confirmar'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
