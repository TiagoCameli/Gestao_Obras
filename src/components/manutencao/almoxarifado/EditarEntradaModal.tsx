// Edita UMA entrada de peça (uma linha de entradas_material). Complementa o
// NovaEntradaModal, que só cria (e em lote por NF). Aqui o registro já existe:
// dá pra ajustar depósito, fornecedor, NF, data, peça, quantidade, valor e obs.
//
// Guarda de saldo: se a alteração reduzir a contribuição desta entrada e deixar
// o saldo da peça no depósito negativo (peça já consumida em OS), bloqueia. A
// matemática vive em movimentacoesAlmoxarifado.ts (testada).

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import FilterCombobox from '../../ui/FilterCombobox';
import type { EntradaMaterial, Insumo } from '../../../types';
import { useAtualizarEntradaMaterial } from '../../../hooks/useEntradasMaterial';
import { useDepositosMaterial } from '../../../hooks/useDepositosMaterial';
import { useFornecedores } from '../../../hooks/useFornecedores';
import { useInsumos } from '../../../hooks/useInsumos';
import { useSaldoEstoquePorDeposito } from '../../../hooks/useSaldoEstoque';
import { useAuth } from '../../../contexts/AuthContext';
import { acharSaldoDeposito } from '../../../utils/estoqueServico';
import {
  saldoAposExcluirEntrada,
  saldoAposEditarEntrada,
  mensagemSaldoNegativo,
} from '../../../utils/movimentacoesAlmoxarifado';

interface Props {
  open: boolean;
  onClose: () => void;
  entrada: EntradaMaterial;
}

function numOrZero(s: string): number {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ISO armazenado → valor do <input datetime-local> em horário local.
function isoParaInputLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function EditarEntradaModal({ open, onClose, entrada }: Props) {
  const { usuario } = useAuth();
  const atualizar = useAtualizarEntradaMaterial();
  const qc = useQueryClient();
  const { data: depositos = [] } = useDepositosMaterial();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: insumos = [] } = useInsumos();
  // Saldo da peça ORIGINAL desta entrada — base da guarda de saldo negativo.
  const { data: saldosOrig = [] } = useSaldoEstoquePorDeposito(entrada.insumoId);

  const vUnitInicial = entrada.valorUnitario ?? (entrada.quantidade ? entrada.valorTotal / entrada.quantidade : 0);

  const [depositoId, setDepositoId] = useState(entrada.depositoMaterialId);
  const [fornecedorId, setFornecedorId] = useState(entrada.fornecedorId);
  const [notaFiscal, setNotaFiscal] = useState(entrada.notaFiscal);
  const [insumoId, setInsumoId] = useState(entrada.insumoId);
  const [dataHora, setDataHora] = useState(isoParaInputLocal(entrada.dataHora));
  const [quantidade, setQuantidade] = useState(String(entrada.quantidade));
  const [valorUnitario, setValorUnitario] = useState(String(vUnitInicial));
  const [observacoes, setObservacoes] = useState(entrada.observacoes);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const depositosAtivos = useMemo(
    () => depositos.filter((d) => d.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [depositos],
  );
  const fornecedoresAtivos = useMemo(
    () => fornecedores.filter((f) => f.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)),
    [fornecedores],
  );
  const insumosPecas = useMemo(
    () => insumos.filter((i: Insumo) => i.ativo && i.usadoEmManutencao).sort((a, b) => a.nome.localeCompare(b.nome)),
    [insumos],
  );

  const qty = numOrZero(quantidade);
  const vUnit = numOrZero(valorUnitario);
  const total = qty * vUnit;

  const podeSalvar = !!depositoId && !!fornecedorId && !!notaFiscal.trim() && !!dataHora && !!insumoId && qty > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setErro(null);

    // Guarda de saldo: usa o saldo da peça/depósito ORIGINAL desta entrada.
    const saldoOrig = acharSaldoDeposito(saldosOrig, entrada.depositoMaterialId)?.saldo ?? 0;
    const mudouAlvo = insumoId !== entrada.insumoId || depositoId !== entrada.depositoMaterialId;
    const resultado = mudouAlvo
      ? saldoAposExcluirEntrada(saldoOrig, entrada.quantidade)
      : saldoAposEditarEntrada(saldoOrig, entrada.quantidade, qty);
    const bloqueio = mensagemSaldoNegativo(resultado);
    if (bloqueio) {
      setErro(bloqueio);
      return;
    }

    setSubmitting(true);
    try {
      const atualizada: EntradaMaterial = {
        ...entrada,
        dataHora: new Date(dataHora).toISOString(),
        depositoMaterialId: depositoId,
        insumoId,
        quantidade: qty,
        valorUnitario: vUnit,
        valorTotal: total,
        fornecedorId,
        notaFiscal: notaFiscal.trim(),
        observacoes: observacoes.trim(),
        atualizadoPor: usuario?.nome ?? '',
      };
      await atualizar.mutateAsync(atualizada);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['saldo_estoque_total'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_deposito'] }),
      ]);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar a entrada.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar entrada de peça" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Depósito"
            id="edEntDep"
            value={depositoId}
            onChange={(e) => setDepositoId(e.target.value)}
            options={[
              { value: '', label: 'Selecione…' },
              ...depositosAtivos.map((d) => ({ value: d.id, label: d.nome })),
            ]}
            required
          />
          <Select
            label="Fornecedor"
            id="edEntForn"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            options={[
              { value: '', label: 'Selecione…' },
              ...fornecedoresAtivos.map((f) => ({ value: f.id, label: f.nome })),
            ]}
            required
          />
          <Input
            label="Nota fiscal"
            required
            value={notaFiscal}
            onChange={(e) => setNotaFiscal(e.target.value)}
            placeholder="Ex.: 123456"
          />
          <Input
            label="Data e hora"
            required
            type="datetime-local"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Peça <span className="text-[var(--color-danger)]">*</span>
          </label>
          <FilterCombobox
            value={insumoId}
            onChange={setInsumoId}
            options={insumosPecas.map((p) => ({
              value: p.id,
              label: p.codigoSku ? `${p.codigoSku} — ${p.nome}` : p.nome,
            }))}
            placeholder="Buscar peça…"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
          <Input
            label="Quantidade"
            type="number"
            min="0"
            step="any"
            required
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
          <Input
            label="Valor unitário (R$)"
            type="number"
            min="0"
            step="any"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
          />
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">Total</div>
            <div className="font-mono font-semibold text-[var(--color-fg)]">{fmtBRL(total)}</div>
          </div>
        </div>

        <div>
          <label htmlFor="edEntObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observações
          </label>
          <textarea
            id="edEntObs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full min-h-[56px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        {erro && (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || submitting}>
            {submitting ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
