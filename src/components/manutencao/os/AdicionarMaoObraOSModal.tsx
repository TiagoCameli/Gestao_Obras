// Marco 2 / PR12 — Modal para apontar mão de obra própria em uma OS.

import { useState, useCallback, type FormEvent } from 'react';
import type { Colaborador, OSMaoObra } from '../../../types';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import FilterCombobox from '../../ui/FilterCombobox';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  osId: string;
  colaboradores: Colaborador[];
  initial?: OSMaoObra | null;
  onSubmit: (mo: OSMaoObra) => Promise<void>;
  usuarioNome: string;
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

export default function AdicionarMaoObraOSModal({
  open, onClose, osId, colaboradores, initial, onSubmit, usuarioNome,
}: Props) {
  const [colaboradorId, setColaboradorId] = useState(initial?.colaboradorId ?? '');
  const [data, setData] = useState(initial?.data ?? new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState(initial?.horas?.toString() ?? '');
  const [custoHora, setCustoHora] = useState(initial?.custoHora?.toString() ?? '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const horasNum = parseNum(horas);
  const custoHoraNum = parseNum(custoHora);
  const custoTotal = horasNum * custoHoraNum;

  const podeSalvar = !!colaboradorId && !!data && horasNum > 0;

  const { temAcao } = useAuth();
  const canAddMO = temAcao('adicionar_mao_obra_os');
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canAddMO) return;
    if (!podeSalvar || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        id: initial?.id ?? gerarId(),
        osId,
        colaboradorId,
        data,
        horas: horasNum,
        custoHora: custoHoraNum > 0 ? custoHoraNum : null,
        custoTotal,
        observacoes: observacoes.trim(),
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        createdBy: initial?.createdBy ?? usuarioNome,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    podeSalvar, submitting, colaboradorId, data, horasNum, custoHoraNum, custoTotal,
    observacoes, osId, initial, usuarioNome, onSubmit, onClose,
  ]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar mão de obra' : 'Apontar horas'} size="default">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="osMOColab" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Mecânico / colaborador <span className="text-[var(--color-danger)]">*</span>
          </label>
          <FilterCombobox
            value={colaboradorId}
            onChange={setColaboradorId}
            options={colaboradores
              .filter((c) => c.ativo !== false)
              .map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Buscar por nome…"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input
            label="Data"
            id="osMOData"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
          <Input
            label="Horas trabalhadas"
            id="osMOHoras"
            type="number"
            step="0.25"
            min="0"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            required
          />
          <Input
            label="Custo / hora (R$)"
            id="osMOCusto"
            type="number"
            step="0.01"
            min="0"
            value={custoHora}
            onChange={(e) => setCustoHora(e.target.value)}
            placeholder="opcional"
          />
        </div>

        <div>
          <label htmlFor="osMOObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observação
          </label>
          <textarea
            id="osMOObs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="O que foi feito nesse intervalo?"
            className="w-full min-h-[56px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        {custoTotal > 0 && (
          <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
            Total da linha:{' '}
            <strong className="font-mono">
              {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || submitting}>
            {submitting ? 'Salvando…' : initial ? 'Salvar alterações' : 'Apontar horas'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
