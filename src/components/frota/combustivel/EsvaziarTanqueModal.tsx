// F11 — Modal "Esvaziar tanque". Descarte explícito pra trocar de
// combustível. Pede motivo obrigatório. O trigger no DB cuida do recalc:
// nivel_atual_litros vira 0 e combustivel_atual_id vira null.

import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Deposito } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import SubmitButton from '../../ui/SubmitButton';
import { useEsvaziarTanque } from '../../../hooks/useEsvaziamentosTanque';
import { useAuth } from '../../../contexts/AuthContext';
import { formatLitros } from '../../../utils/formatters';

interface Props {
  open: boolean;
  onClose: () => void;
  tanque: Deposito | null;
  combustivelNome?: string | null;
}

export default function EsvaziarTanqueModal({ open, onClose, tanque, combustivelNome }: Props) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const esvaziarMut = useEsvaziarTanque();

  useEffect(() => {
    if (open) {
      setMotivo('');
      setErro('');
    }
  }, [open]);

  const { temAcao } = useAuth();
  const canEsvaziar = temAcao('esvaziar_tanque');
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEsvaziar) { setErro('Sem permissão para esvaziar tanque.'); return; }
    if (!tanque) return;
    if (motivo.trim().length < 3) {
      setErro('Informe um motivo (mín. 3 caracteres).');
      return;
    }
    try {
      await esvaziarMut.mutateAsync({
        depositoId: tanque.id,
        litrosDescartados: tanque.nivelAtualLitros,
        motivo: motivo.trim(),
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao esvaziar tanque.';
      setErro(msg);
    }
  }

  if (!tanque) return null;

  return (
    <Modal open={open} onClose={onClose} title="Esvaziar tanque">
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Atenção</p>
            <p>
              Esta ação registra um descarte de <strong>{formatLitros(tanque.nivelAtualLitros)}</strong>
              {combustivelNome ? <> de <strong>{combustivelNome}</strong></> : null} do tanque{' '}
              <strong>{tanque.nome}</strong> e libera o tanque pra receber outro combustível.
              Não pode ser desfeita.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="esvazia-motivo" className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5">
            Motivo *
          </label>
          <textarea
            id="esvazia-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={esvaziarMut.isPending}
            placeholder="Ex: troca pra Diesel S500 conforme demanda obra Lote 09."
            className="w-full h-24 px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </div>

        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
            {erro}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={esvaziarMut.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={esvaziarMut.isPending} loadingLabel="Esvaziando...">
            Esvaziar tanque
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
