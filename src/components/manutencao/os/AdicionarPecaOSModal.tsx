// Adicionar peça em uma OS — agora com baixa de estoque.
// Só peças com saldo aparecem; escolhe o almoxarifado de saída (obrigatório);
// unidade e custo (= custo médio da entrada) vêm automáticos; quantidade é
// validada contra o saldo. A baixa é feita pela view v_saldo_estoque (que
// desconta os_pecas ativas com depósito) + trigger tg_os_pecas_valida_saldo.

import { useState, useCallback, useMemo, type FormEvent } from 'react';
import type { OSPeca } from '../../../types';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import FilterCombobox from '../../ui/FilterCombobox';
import { parseNum } from '../../../utils/parseNum';
import { useAuth } from '../../../contexts/AuthContext';
import { useSaldoEstoqueTotal, useSaldoEstoquePorDeposito } from '../../../hooks/useSaldoEstoque';
import { depositosComSaldo, acharSaldoDeposito, validarQtdContraSaldo } from '../../../utils/estoqueServico';

interface Props {
  open: boolean;
  onClose: () => void;
  osId: string;
  initial?: OSPeca | null;
  onSubmit: (peca: OSPeca) => Promise<void>;
  usuarioNome: string;
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtQty(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export default function AdicionarPecaOSModal({
  open, onClose, osId, initial, onSubmit, usuarioNome,
}: Props) {
  const { temAcao } = useAuth();
  const canAddPeca = temAcao('adicionar_peca_os');

  const [insumoId, setInsumoId] = useState(initial?.insumoId ?? '');
  const [depositoId, setDepositoId] = useState(initial?.depositoId ?? '');
  const [quantidade, setQuantidade] = useState(initial?.quantidade?.toString() ?? '1');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Só insumos de manutenção COM saldo em algum depósito.
  const { data: saldosTotais = [] } = useSaldoEstoqueTotal({ apenasManutencao: true });
  const opcoesPeca = useMemo(
    () => saldosTotais
      .filter((s) => s.saldoTotal > 0)
      .map((s) => ({ value: s.insumoId, label: `${s.insumoNome} (${fmtQty(s.saldoTotal)} ${s.unidade})` })),
    [saldosTotais],
  );

  // Saldo por depósito do insumo escolhido.
  const { data: saldosDep = [] } = useSaldoEstoquePorDeposito(insumoId || null);
  const depOpcoes = useMemo(() => depositosComSaldo(saldosDep), [saldosDep]);

  // Ao trocar de insumo, zera o depósito escolhido (evita depósito de outro item).
  const escolherInsumo = (id: string) => { setInsumoId(id); setDepositoId(''); };

  const saldoDep = depositoId ? acharSaldoDeposito(saldosDep, depositoId) : null;
  const unidade = saldoDep?.unidade ?? '';
  const custoMedio = saldoDep?.custoMedio ?? null;
  const saldoDisponivel = saldoDep?.saldo ?? 0;

  const quantidadeNum = parseNum(quantidade);
  const erroQtd = depositoId ? validarQtdContraSaldo(quantidadeNum, saldoDisponivel) : null;
  const custoTotal = quantidadeNum * (custoMedio ?? 0);

  const podeSalvar = !!insumoId && !!depositoId && custoMedio != null && !erroQtd;

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canAddPeca || !podeSalvar || submitting || custoMedio == null) return;
    setSubmitting(true);
    try {
      const nome = saldoDep?.insumoNome ?? '';
      await onSubmit({
        id: initial?.id ?? gerarId(),
        osId,
        insumoId,
        depositoId,
        quantidade: quantidadeNum,
        unidadeMedidaId: null,
        custoUnitario: custoMedio,
        custoTotal: quantidadeNum * custoMedio,
        status: initial?.status ?? 'reservada',
        saidaMaterialId: null,
        observacoes: observacoes.trim() || (nome ? `Insumo: ${nome}` : ''),
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        createdBy: initial?.createdBy ?? usuarioNome,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    canAddPeca, podeSalvar, submitting, custoMedio, saldoDep, insumoId, depositoId,
    quantidadeNum, observacoes, osId, initial, usuarioNome, onSubmit, onClose,
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
            onChange={escolherInsumo}
            options={opcoesPeca}
            placeholder="Buscar peça com saldo…"
          />
          {opcoesPeca.length === 0 && (
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">
              Nenhuma peça com saldo. Cadastre a peça no almoxarifado e lance a entrada.
            </p>
          )}
        </div>

        <Select
          label="Almoxarifado (de onde sai)"
          id="osPecaDeposito"
          value={depositoId}
          onChange={(e) => setDepositoId(e.target.value)}
          options={depOpcoes.map((d) => ({ value: d.depositoId, label: `${d.depositoNome} — ${fmtQty(d.saldo)} ${d.unidade}` }))}
          placeholder={insumoId ? 'Selecione o almoxarifado' : 'Escolha a peça primeiro'}
          disabled={!insumoId}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label={`Quantidade${unidade ? ` (${unidade})` : ''}`}
              id="osPecaQtd"
              type="number"
              step="any"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
            {depositoId && (
              <p className={`text-xs mt-1 ${erroQtd ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg-muted)]'}`}>
                {erroQtd ?? `Disponível: ${fmtQty(saldoDisponivel)} ${unidade}`}
              </p>
            )}
          </div>
          <Input
            label="Custo unitário (R$) — da entrada"
            id="osPecaCusto"
            type="text"
            value={custoMedio != null ? custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
            readOnly
            disabled
          />
        </div>

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

        {custoTotal > 0 && !erroQtd && (
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
