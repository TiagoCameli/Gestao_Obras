import { useState, useCallback, useMemo, type FormEvent } from 'react';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import { useAdicionarOleoOS } from '../../../hooks/useOSOleos';
import { useTiposOleo } from '../../../hooks/useTiposOleo';
import { useAuth } from '../../../contexts/AuthContext';

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

const UNIDADE_OPTIONS = [
  { value: 'L', label: 'Litros (L)' },
  { value: 'kg', label: 'Quilos (kg)' },
];

interface Props {
  osId: string;
  onClose: () => void;
}

export default function AdicionarOleoOSModal({ osId, onClose }: Props) {
  const [tipoOleoId, setTipoOleoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState<'L' | 'kg'>('L');
  const [valorUnitario, setValorUnitario] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { temAcao, usuario } = useAuth();
  const canAdd = temAcao('adicionar_oleo_os');

  const adicionarOleo = useAdicionarOleoOS();
  const { data: tiposOleo = [], isLoading: loadingTipos } = useTiposOleo(true);

  const tiposAtivos = useMemo(
    () => tiposOleo.filter((t) => t.ativo),
    [tiposOleo],
  );

  const quantidadeNum = parseNum(quantidade);
  const valorUnitarioNum = parseNum(valorUnitario);
  const total = quantidadeNum * valorUnitarioNum;

  const podeSalvar =
    !!tipoOleoId &&
    quantidadeNum > 0 &&
    valorUnitarioNum >= 0 &&
    valorUnitario.trim().length > 0;

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canAdd || !podeSalvar || adicionarOleo.isPending) return;
    setSubmitError(null);
    try {
      await adicionarOleo.mutateAsync({
        osId,
        tipoOleoId,
        quantidade: quantidadeNum,
        unidade,
        valorUnitario: valorUnitarioNum,
        valorTotal: total,
        createdBy: usuario?.nome ?? '',
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao adicionar troca de óleo.');
    }
  }, [
    canAdd, podeSalvar, adicionarOleo, osId, tipoOleoId, quantidadeNum,
    unidade, valorUnitarioNum, total, usuario, onClose,
  ]);

  return (
    <Modal open onClose={onClose} title="Adicionar troca de óleo" size="default">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Tipo de óleo"
          id="oleoTipo"
          value={tipoOleoId}
          onChange={(e) => setTipoOleoId(e.target.value)}
          options={tiposAtivos.map((t) => ({ value: t.id, label: t.nome }))}
          placeholder={loadingTipos ? 'Carregando…' : 'Selecione o tipo de óleo'}
          disabled={loadingTipos}
          required
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input
            label="Quantidade"
            id="oleoQtd"
            type="number"
            step="any"
            min="0.001"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            required
          />
          <Select
            label="Unidade"
            id="oleoUnidade"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as 'L' | 'kg')}
            options={UNIDADE_OPTIONS}
          />
          <Input
            label="Valor unitário (R$)"
            id="oleoValorUnit"
            type="number"
            step="0.01"
            min="0"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
            required
          />
        </div>

        {total > 0 && (
          <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
            Total da linha:{' '}
            <strong className="font-mono">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
        )}

        {submitError && (
          <div className="rounded-lg bg-[var(--color-danger-subtle,#fee2e2)] border border-[var(--color-danger)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={adicionarOleo.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || adicionarOleo.isPending}>
            {adicionarOleo.isPending ? 'Salvando…' : 'Adicionar óleo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
