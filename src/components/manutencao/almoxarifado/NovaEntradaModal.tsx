// Marco 4 / PR19 — Modal de entrada de peças via nota fiscal manual.
//
// Cabeçalho: depósito, fornecedor, NF, data, observações.
// Lista de itens dinâmica: peça (combobox), qty, valor unitário, total. Cada
// item vira uma row em entradas_material com a mesma nota_fiscal — assim a
// view v_saldo_estoque agrupa todas as entradas dessa NF normalmente.
//
// Total da NF é calculado client-side e exibido. Quando salva, insere as N
// linhas em batch (mesmo data_hora, mesmo deposito, mesmo fornecedor, mesma NF).
//
// DANFE: leitura automática vem em PR posterior — por ora, apenas manual.

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import FilterCombobox from '../../ui/FilterCombobox';
import type { EntradaMaterial, Insumo } from '../../../types';
import { useAdicionarEntradaMaterial } from '../../../hooks/useEntradasMaterial';
import { useDepositosMaterial } from '../../../hooks/useDepositosMaterial';
import { useFornecedores } from '../../../hooks/useFornecedores';
import { useInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  insumoIdInicial?: string;
}

interface LinhaItem {
  insumoId: string;
  quantidade: string;
  valorUnitario: string;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function numOrZero(s: string): number {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function novaLinha(insumoId = ''): LinhaItem {
  return { insumoId, quantidade: '', valorUnitario: '' };
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 16);
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function NovaEntradaModal({ open, onClose, insumoIdInicial }: Props) {
  const { usuario } = useAuth();
  const adicionar = useAdicionarEntradaMaterial();
  const qc = useQueryClient();
  const { data: depositos = [] } = useDepositosMaterial();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: insumos = [] } = useInsumos();

  const [depositoId, setDepositoId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [dataHora, setDataHora] = useState(hojeIso());
  const [observacoes, setObservacoes] = useState('');
  const [linhas, setLinhas] = useState<LinhaItem[]>([novaLinha(insumoIdInicial)]);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const depositosAtivos = useMemo(
    () => depositos.filter((d) => d.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [depositos]
  );
  const fornecedoresAtivos = useMemo(
    () => fornecedores.filter((f) => f.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)),
    [fornecedores]
  );
  const insumosPecas = useMemo(
    () => insumos.filter((i) => i.ativo && i.usadoEmManutencao).sort((a, b) => a.nome.localeCompare(b.nome)),
    [insumos]
  );

  const insumosById = useMemo(() => {
    const m = new Map<string, Insumo>();
    for (const i of insumosPecas) m.set(i.id, i);
    return m;
  }, [insumosPecas]);

  const totalNF = linhas.reduce((s, l) => s + numOrZero(l.quantidade) * numOrZero(l.valorUnitario), 0);
  const totalItens = linhas.filter((l) => l.insumoId && numOrZero(l.quantidade) > 0).length;

  const podeSalvar =
    !!depositoId && !!fornecedorId && !!notaFiscal.trim() && !!dataHora && totalItens > 0;

  function atualizarLinha(index: number, patch: Partial<LinhaItem>) {
    setLinhas((arr) => arr.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function adicionarLinha() {
    setLinhas((arr) => [...arr, novaLinha()]);
  }

  function removerLinha(index: number) {
    setLinhas((arr) => (arr.length === 1 ? [novaLinha()] : arr.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);

    try {
      const deposito = depositosAtivos.find((d) => d.id === depositoId);
      const obraId = deposito?.obraId ?? '';

      // Cria uma EntradaMaterial por linha válida. obra_id pega do depósito.
      const linhasValidas = linhas.filter(
        (l) => l.insumoId && numOrZero(l.quantidade) > 0 && numOrZero(l.valorUnitario) >= 0
      );
      if (linhasValidas.length === 0) {
        throw new Error('Adicione pelo menos um item válido.');
      }

      const dataIso = new Date(dataHora).toISOString();

      // Insere em sequência para preservar ordem (poderia ser paralelo)
      for (const l of linhasValidas) {
        const qty = numOrZero(l.quantidade);
        const vUnit = numOrZero(l.valorUnitario);
        const entrada: EntradaMaterial = {
          id: gerarId(),
          dataHora: dataIso,
          depositoMaterialId: depositoId,
          insumoId: l.insumoId,
          obraId,
          quantidade: qty,
          valorTotal: qty * vUnit,
          fornecedorId,
          notaFiscal: notaFiscal.trim(),
          observacoes: observacoes.trim(),
          criadoPor: usuario?.nome ?? '',
        };
        await adicionar.mutateAsync(entrada);
      }

      // Invalida views de saldo pra UI recalcular sem reload manual
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['saldo_estoque_total'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_deposito'] }),
      ]);

      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar entrada');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Entrada de peças (nota fiscal)" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cabeçalho da NF */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select
            label="Depósito"
            id="entDep"
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
            id="entForn"
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

        {/* Itens */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Itens da nota
            </h3>
            <Button type="button" size="sm" variant="secondary" onClick={adicionarLinha}>
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </Button>
          </div>

          {insumosPecas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-fg-muted)]">
              Nenhuma peça cadastrada no almoxarifado. Cadastre uma peça
              primeiro pelo botão "Nova peça".
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2 w-2/5">Peça</th>
                    <th className="text-right px-3 py-2 w-1/6">Quantidade</th>
                    <th className="text-right px-3 py-2 w-1/6">Valor unitário</th>
                    <th className="text-right px-3 py-2 w-1/6">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => {
                    const insumo = insumosById.get(l.insumoId);
                    const qty = numOrZero(l.quantidade);
                    const vUnit = numOrZero(l.valorUnitario);
                    return (
                      <tr key={i} className="border-t border-[var(--color-border)]">
                        <td className="px-3 py-2 align-top">
                          <FilterCombobox
                            value={l.insumoId}
                            onChange={(v) => atualizarLinha(i, { insumoId: v })}
                            options={insumosPecas.map((p) => ({
                              value: p.id,
                              label: p.codigoSku
                                ? `${p.codigoSku} — ${p.nome}`
                                : p.nome,
                            }))}
                            placeholder="Buscar peça…"
                          />
                          {insumo && (
                            <div className="text-[11px] text-[var(--color-fg-subtle)] mt-1">
                              {insumo.fabricante}{insumo.codigoFabricante && ` · ${insumo.codigoFabricante}`}
                              {' · '}unidade {insumo.unidade}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={l.quantidade}
                            onChange={(e) => atualizarLinha(i, { quantidade: e.target.value })}
                            className="w-full h-[34px] rounded-lg px-2 py-1 text-sm text-right bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={l.valorUnitario}
                            onChange={(e) => atualizarLinha(i, { valorUnitario: e.target.value })}
                            className="w-full h-[34px] rounded-lg px-2 py-1 text-sm text-right bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-right font-mono text-[var(--color-fg)]">
                          {fmtBRL(qty * vUnit)}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <button
                            type="button"
                            onClick={() => removerLinha(i)}
                            className="p-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-soft)]"
                            aria-label="Remover linha"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                      Total da nota
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--color-fg)]">
                      {fmtBRL(totalNF)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <label htmlFor="entObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observações
          </label>
          <textarea
            id="entObs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Notas adicionais (transportadora, lote, validade…)"
            className="w-full min-h-[60px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
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
            {submitting ? 'Salvando…' : `Salvar entrada · ${fmtBRL(totalNF)}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
