// Marco 2 / PR12 — Modal para adicionar peça em uma OS.
//
// Operador escolhe o insumo (do catálogo geral), informa quantidade,
// custo unitário e opcionalmente depósito. Status default 'reservada'
// (vira 'consumida' no fechamento da OS — fluxo do PR13).

import { useState, useCallback, useMemo, type FormEvent } from 'react';
import type { Insumo, OSPeca, DepositoMaterial } from '../../../types';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import { useAuth } from '../../../contexts/AuthContext';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import FilterCombobox from '../../ui/FilterCombobox';
import { parseNum } from '../../../utils/parseNum';

interface Props {
  open: boolean;
  onClose: () => void;
  osId: string;
  insumos: Insumo[];
  depositos: DepositoMaterial[];
  initial?: OSPeca | null;
  onSubmit: (peca: OSPeca) => Promise<void>;
  usuarioNome: string;
}

const STATUS_PECA_OPTIONS = [
  { value: 'reservada', label: 'Reservada' },
  { value: 'consumida', label: 'Consumida' },
  { value: 'devolvida', label: 'Devolvida' },
];

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AdicionarPecaOSModal({
  open, onClose, osId, insumos, depositos, initial, onSubmit, usuarioNome,
}: Props) {
  const [insumoId, setInsumoId] = useState(initial?.insumoId ?? '');
  const [depositoId, setDepositoId] = useState(initial?.depositoId ?? '');
  const [quantidade, setQuantidade] = useState(initial?.quantidade?.toString() ?? '1');
  const [custoUnitario, setCustoUnitario] = useState(initial?.custoUnitario?.toString() ?? '');
  const [status, setStatus] = useState<OSPeca['status']>(initial?.status ?? 'reservada');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Filtra insumos: tipo 'peca', 'filtro', 'lubrificante', 'fluido' (qualquer
  // não-combustível). Lista geral também aceita.
  const insumosFiltrados = useMemo(() => {
    return insumos.filter((i) => i.ativo !== false);
  }, [insumos]);

  const quantidadeNum = parseNum(quantidade);
  const custoUnitarioNum = parseNum(custoUnitario);
  const custoTotal = quantidadeNum * custoUnitarioNum;

  const podeSalvar = !!insumoId && quantidadeNum > 0 && custoUnitarioNum >= 0;

  const { temAcao } = useAuth();
  const canAddPeca = temAcao('adicionar_peca_os');
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canAddPeca) return;
    if (!podeSalvar || submitting) return;
    setSubmitting(true);
    try {
      const insumo = insumos.find((i) => i.id === insumoId);
      await onSubmit({
        id: initial?.id ?? gerarId(),
        osId,
        insumoId,
        depositoId: depositoId || null,
        quantidade: quantidadeNum,
        unidadeMedidaId: null,
        custoUnitario: custoUnitarioNum,
        custoTotal: quantidadeNum * custoUnitarioNum,
        status,
        saidaMaterialId: null,
        observacoes: observacoes.trim() || (insumo ? `Insumo: ${insumo.nome}` : ''),
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        createdBy: initial?.createdBy ?? usuarioNome,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    podeSalvar, submitting, insumoId, depositoId, quantidadeNum, custoUnitarioNum,
    status, observacoes, osId, initial, insumos, usuarioNome, onSubmit, onClose,
  ]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar peça' : 'Adicionar peça'} size="default">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="osPecaInsumo" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Peça / Insumo <span className="text-[var(--color-danger)]">*</span>
          </label>
          <FilterCombobox
            value={insumoId}
            onChange={setInsumoId}
            options={insumosFiltrados.map((i) => ({ value: i.id, label: i.nome }))}
            placeholder="Buscar peça por nome…"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input
            label="Quantidade"
            id="osPecaQtd"
            type="number"
            step="any"
            min="0"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            required
          />
          <Input
            label="Custo unitário (R$)"
            id="osPecaCusto"
            type="number"
            step="0.01"
            min="0"
            value={custoUnitario}
            onChange={(e) => setCustoUnitario(e.target.value)}
            required
          />
          <Select
            label="Status"
            id="osPecaStatus"
            value={status}
            onChange={(e) => setStatus(e.target.value as OSPeca['status'])}
            options={STATUS_PECA_OPTIONS}
          />
        </div>

        {depositos.length > 0 && (
          <Select
            label="Depósito (opcional)"
            id="osPecaDeposito"
            value={depositoId}
            onChange={(e) => setDepositoId(e.target.value)}
            options={depositos.filter((d) => d.ativo !== false).map((d) => ({ value: d.id, label: d.nome }))}
            placeholder="—"
          />
        )}

        <div>
          <label htmlFor="osPecaObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observação
          </label>
          <textarea
            id="osPecaObs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="NF, marca da peça, observação técnica…"
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
            {submitting ? 'Salvando…' : initial ? 'Salvar alterações' : 'Adicionar peça'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
