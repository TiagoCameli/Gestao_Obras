import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function ConfirmWithCountdown({
  open,
  onClose,
  onConfirm,
  title = 'Confirmar Exclusão',
  message = 'Tem certeza que deseja excluir?',
  countdown = 5,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  countdown?: number;
}) {
  const [remaining, setRemaining] = useState(countdown);

  useEffect(() => {
    if (!open) {
      setRemaining(countdown);
      return;
    }

    if (remaining <= 0) return;

    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, remaining, countdown]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-4">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          variant="danger"
          disabled={remaining > 0}
          onClick={onConfirm}
        >
          {remaining > 0 ? `Confirmar (${remaining}s)` : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
}
