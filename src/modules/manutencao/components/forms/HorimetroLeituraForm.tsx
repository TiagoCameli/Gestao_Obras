import { useState, type FormEvent } from 'react';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import type { HorimetroLeitura } from '../../types';

export interface HorimetroLeituraFormData {
  equipamentoId: string;
  dataLeitura: string;
  valor: number;
  observacao?: string;
}

export interface HorimetroLeituraFormProps {
  equipamentoId: string;
  ultimaLeitura?: HorimetroLeitura;
  onSubmit: (data: HorimetroLeituraFormData) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HorimetroLeituraForm({
  equipamentoId,
  ultimaLeitura,
  onSubmit,
  onCancel,
  className = '',
}: HorimetroLeituraFormProps) {
  const [data, setData] = useState<string>(hojeIso());
  const [valor, setValor] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorNum = Number(valor);
  const menorQueAnterior =
    ultimaLeitura && Number.isFinite(valorNum) && valorNum < ultimaLeitura.valor;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!Number.isFinite(valorNum) || valorNum < 0) {
      setErro('Informe um valor de horímetro válido.');
      return;
    }
    if (!data) {
      setErro('Informe a data da leitura.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        equipamentoId,
        dataLeitura: data,
        valor: valorNum,
        observacao: observacao.trim() || undefined,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={'flex flex-col gap-3 ' + className}>
      {ultimaLeitura && (
        <div className="text-xs text-[var(--color-fg-muted)]">
          Última leitura: {ultimaLeitura.valor.toLocaleString('pt-BR')} h em{' '}
          {ultimaLeitura.dataLeitura}
        </div>
      )}

      <Input
        id="horimetro-data"
        label="Data da leitura"
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        required
      />

      <Input
        id="horimetro-valor"
        label="Valor (horas)"
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Ex.: 8453.5"
        required
      />

      {menorQueAnterior && (
        <div
          role="alert"
          className="text-xs px-3 py-2 rounded-lg bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] border border-[var(--color-warning)]/30"
        >
          Valor menor que a última leitura. Confirme se houve troca de horímetro.
        </div>
      )}

      <div>
        <label
          htmlFor="horimetro-obs"
          className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
        >
          Observação
        </label>
        <textarea
          id="horimetro-obs"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          placeholder="Notas opcionais sobre a leitura"
        />
      </div>

      {erro && (
        <div
          role="alert"
          className="text-xs px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border border-[var(--color-danger)]/30"
        >
          {erro}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar leitura'}
        </Button>
      </div>
    </form>
  );
}

export default HorimetroLeituraForm;
