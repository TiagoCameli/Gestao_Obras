/**
 * Modal pequeno para reprovar um pedido com motivo OBRIGATÓRIO.
 *
 * Decisão registrada no doc: motivo é sempre exigido — solicitante precisa
 * entender o porquê pra refazer o pedido corretamente.
 */
import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface Props {
  open: boolean;
  numeroPedido: string;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void> | void;
}

export default function RejeitarPedidoModal({ open, numeroPedido, onClose, onConfirm }: Props) {
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMotivo('');
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    const m = motivo.trim();
    if (m.length < 3) return;
    setSubmitting(true);
    try {
      await onConfirm(m);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const valido = motivo.trim().length >= 3;

  return (
    <Modal open={open} onClose={onClose} title={`Reprovar pedido ${numeroPedido}`}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Explique brevemente o motivo. Essa mensagem será visível para o solicitante.
        </p>
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1.5">
            Motivo <span className="text-rose-500">*</span>
          </label>
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ex.: orçamento estourado este mês — refazer com cotação de pelo menos 3 fornecedores."
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-none"
          />
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
            Mínimo 3 caracteres. {motivo.trim().length} caracteres digitados.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!valido || submitting}>
            {submitting ? 'Reprovando…' : 'Reprovar pedido'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
