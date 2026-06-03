// Marco 0 / PR4 — Modal que pede motivo antes de mudar o status do equipamento.
//
// Mudanças para "ativa" não exigem motivo obrigatório (vai voltar a operar é
// motivo suficiente). Mudanças para os 3 estados não-ativos exigem motivo
// não-vazio para gerar registro auditável no histórico.

import { useEffect, useState, type FormEvent } from 'react';
import type { StatusEquipamento } from '../../types';
import { STATUS_EQUIPAMENTO_LABEL } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import SubmitButton from '../ui/SubmitButton';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  equipamentoNome: string;
  statusDe: StatusEquipamento;
  statusPara: StatusEquipamento;
  onConfirm: (motivo: string, observacoes: string) => Promise<void>;
}

// Sugestões rápidas por destino (chips que preenchem motivo)
const SUGESTOES_MOTIVO: Record<StatusEquipamento, string[]> = {
  ativa: [
    'Retorno após manutenção',
    'Reparo concluído',
    'Liberado pelo mecânico',
    'Volta de oficina externa',
  ],
  manutencao_preventiva: [
    'Preventiva agendada',
    'Troca de óleo / filtros',
    'Inspeção periódica',
    'Lavagem e lubrificação',
  ],
  manutencao_corretiva: [
    'Pane mecânica',
    'Pane elétrica',
    'Vazamento',
    'Superaquecimento',
    'Defeito reportado pelo operador',
    'Falha hidráulica',
    'Falha no sistema de freios',
  ],
  fora_funcionamento: [
    'Aguardando peça',
    'Aguardando oficina externa',
    'Reparo de alto custo — em avaliação',
    'Acidente',
    'Sinistro com seguro',
    'Vendido / baixado',
  ],
};

export default function StatusChangeMotivoModal({
  open,
  onClose,
  equipamentoNome,
  statusDe,
  statusPara,
  onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMotivo('');
      setObservacoes('');
      setSubmitting(false);
    }
  }, [open]);

  const motivoObrigatorio = statusPara !== 'ativa';
  const { temAcao } = useAuth();
  const canMudarStatus = temAcao('mudar_status_equipamento');
  const podeSalvar = canMudarStatus && (!motivoObrigatorio || motivo.trim().length > 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canMudarStatus) return;
    if (!podeSalvar || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(motivo.trim(), observacoes.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const sugestoes = SUGESTOES_MOTIVO[statusPara] ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Mudar status do equipamento">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
          <p className="text-xs text-[var(--color-fg-muted)] mb-1">Equipamento</p>
          <p className="text-sm font-medium text-[var(--color-fg)]">{equipamentoNome}</p>
          <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
            <span className="text-[var(--color-fg-muted)]">De:</span>
            <span className="font-medium text-[var(--color-fg)]">{STATUS_EQUIPAMENTO_LABEL[statusDe]}</span>
            <span className="text-[var(--color-fg-subtle)]">→</span>
            <span className="text-[var(--color-fg-muted)]">Para:</span>
            <span className="font-medium text-[var(--color-fg)]">{STATUS_EQUIPAMENTO_LABEL[statusPara]}</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="motivo"
            className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
          >
            Motivo {motivoObrigatorio && <span className="text-[var(--color-danger)]">*</span>}
          </label>
          <input
            id="motivo"
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={motivoObrigatorio ? 'O que motivou a mudança?' : '(opcional)'}
            className="w-full h-[42px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            autoFocus
            disabled={submitting}
            required={motivoObrigatorio}
          />
          {sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMotivo(s)}
                  disabled={submitting}
                  className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="motivoObs"
            className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
          >
            Observações
          </label>
          <textarea
            id="motivoObs"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
            disabled={submitting}
            className="w-full min-h-[72px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <SubmitButton loading={submitting} disabled={!podeSalvar}>
            Confirmar
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
