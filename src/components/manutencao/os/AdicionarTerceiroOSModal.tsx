import { useState, useCallback, type FormEvent } from 'react';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { useAdicionarTerceiroOS } from '../../../hooks/useOSTerceiros';
import { useAuth } from '../../../contexts/AuthContext';

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

interface Props {
  osId: string;
  onClose: () => void;
}

export default function AdicionarTerceiroOSModal({ osId, onClose }: Props) {
  const [prestador, setPrestador] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { temAcao, usuario } = useAuth();
  const canAdd = temAcao('adicionar_terceiro_os');

  const adicionarTerceiro = useAdicionarTerceiroOS();

  const valorNum = parseNum(valor);
  const podeSalvar = prestador.trim().length > 0 && valorNum >= 0 && valor.trim().length > 0;

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canAdd || !podeSalvar || adicionarTerceiro.isPending) return;
    setSubmitError(null);
    try {
      await adicionarTerceiro.mutateAsync({
        osId,
        prestador: prestador.trim(),
        descricao: descricao.trim(),
        valor: valorNum,
        notaFiscal: notaFiscal.trim() || null,
        createdBy: usuario?.nome ?? '',
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao adicionar serviço de terceiro.');
    }
  }, [
    canAdd, podeSalvar, adicionarTerceiro, osId, prestador, descricao,
    valorNum, notaFiscal, usuario, onClose,
  ]);

  return (
    <Modal open onClose={onClose} title="Adicionar serviço de terceiro" size="default">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Prestador"
          id="tercPrestador"
          type="text"
          value={prestador}
          onChange={(e) => setPrestador(e.target.value)}
          placeholder="Nome da oficina ou empresa"
          required
        />

        <div>
          <label htmlFor="tercDescricao" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Descrição
          </label>
          <textarea
            id="tercDescricao"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição do serviço realizado…"
            className="w-full min-h-[56px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Valor (R$)"
            id="tercValor"
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          <Input
            label="Nota fiscal (opcional)"
            id="tercNF"
            type="text"
            value={notaFiscal}
            onChange={(e) => setNotaFiscal(e.target.value)}
            placeholder="Número da NF"
          />
        </div>

        {submitError && (
          <div className="rounded-lg bg-[var(--color-danger-subtle,#fee2e2)] border border-[var(--color-danger)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={adicionarTerceiro.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || adicionarTerceiro.isPending}>
            {adicionarTerceiro.isPending ? 'Salvando…' : 'Adicionar serviço'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
