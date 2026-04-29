import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { ENTITY_CONFIGS } from './configs';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UniversalImporter({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('');

  function go() {
    if (!selected) return;
    onClose();
    navigate(`/cadastros/${selected}?import=1`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar via Excel">
      <p className="text-sm text-[var(--color-fg-muted)] mb-4">
        Escolha o tipo de cadastro que deseja importar. Você poderá baixar o template, ajustar a planilha e arrastar o arquivo na próxima tela.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
        {ENTITY_CONFIGS.map((c) => {
          const active = selected === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => setSelected(c.slug)}
              className={
                'text-left rounded-lg border p-3 transition-colors flex items-center gap-3 ' +
                (active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]')
              }
            >
              <span className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                <span className="w-4 h-4 inline-block">{c.icon}</span>
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--color-fg)] truncate">{c.plural}</div>
                <div className="text-xs text-[var(--color-fg-subtle)] truncate">{c.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={go} disabled={!selected}>Continuar</Button>
      </div>
    </Modal>
  );
}
