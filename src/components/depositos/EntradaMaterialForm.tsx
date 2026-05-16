/**
 * EntradaMaterialForm — entrada avulsa de material no depósito.
 *
 * Campos: insumo (autocomplete) · qtd · valor unitário (auto-calcula total) ·
 * valor total (auto-calcula unitário) · fornecedor (opcional) · NF · observações
 *
 * Mostra info do depósito alvo no topo. Não permite trocar depósito (é o
 * contexto do modal de detalhe).
 */
import { useCallback, useMemo, useState } from 'react';
import { Package, AlertCircle, Calendar } from 'lucide-react';
import type {
  DepositoMaterial, EntradaMaterial, Insumo, Fornecedor,
} from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  deposito: DepositoMaterial;
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  onSubmit: (entrada: EntradaMaterial) => Promise<void>;
  onCancel: () => void;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function EntradaMaterialForm({
  deposito, insumos, fornecedores, onSubmit, onCancel,
}: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const [dataHora, setDataHora] = useState(new Date().toISOString().slice(0, 16));
  const [insumoId, setInsumoId] = useState('');
  const [buscaInsumo, setBuscaInsumo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(0);
  const [valorUnitario, setValorUnitario] = useState<number>(0);
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [fornecedorId, setFornecedorId] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Qual campo o usuário editou por último: 'unit' (recalcula total) ou 'total' (recalcula unit) */
  const [ultimoEdit, setUltimoEdit] = useState<'unit' | 'total'>('unit');

  const insumoSelecionado = insumos.find((i) => i.id === insumoId);

  const sugestoesInsumo = useMemo(() => {
    const q = buscaInsumo.trim().toLowerCase();
    if (!q) return insumos.filter((i) => i.ativo !== false).slice(0, 8);
    return insumos
      .filter((i) => i.ativo !== false && i.nome.toLowerCase().includes(q))
      .slice(0, 8);
  }, [insumos, buscaInsumo]);

  // Recalcula total ou unit conforme último campo editado
  const setUnit = (v: number) => {
    setValorUnitario(v);
    setUltimoEdit('unit');
    if (quantidade > 0) setValorTotal(v * quantidade);
  };
  const setTotal = (v: number) => {
    setValorTotal(v);
    setUltimoEdit('total');
    if (quantidade > 0) setValorUnitario(v / quantidade);
  };
  const setQtd = (v: number) => {
    setQuantidade(v);
    if (ultimoEdit === 'unit' && valorUnitario > 0) setValorTotal(valorUnitario * v);
    else if (ultimoEdit === 'total' && v > 0) setValorUnitario(valorTotal / v);
  };

  const podeSalvar = !!insumoId && quantidade > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      if (!insumoId) { setErro('Selecione um insumo.'); return; }
      if (quantidade <= 0) { setErro('Quantidade precisa ser maior que zero.'); return; }
      setSubmitting(true);
      try {
        const entrada: EntradaMaterial = {
          id: genId(),
          dataHora,
          depositoMaterialId: deposito.id,
          insumoId,
          obraId: deposito.obrasIds?.[0] ?? deposito.obraId ?? '',
          quantidade,
          valorUnitario: valorUnitario || undefined,
          valorTotal,
          fornecedorId: fornecedorId,
          notaFiscal: notaFiscal.trim(),
          observacoes: observacoes.trim(),
          criadoPor: usuario?.nome || '',
        };
        await onSubmit(entrada);
        showToast({
          kind: 'success',
          message: `Entrada registrada: ${quantidade} ${insumoSelecionado?.unidade ?? ''} de ${insumoSelecionado?.nome ?? 'insumo'}.`,
        });
      } catch (err) {
        setErro((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [insumoId, quantidade, dataHora, deposito, valorUnitario, valorTotal,
     fornecedorId, notaFiscal, observacoes, usuario, insumoSelecionado, onSubmit, showToast]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Info do depósito */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm">
        <Package className="w-4 h-4 text-[var(--color-fg-muted)]" />
        Entrada no depósito <strong className="text-[var(--color-fg)]">{deposito.nome}</strong>
      </div>

      {/* Insumo (autocomplete) */}
      <div>
        <Label>Insumo <span className="text-rose-500">*</span></Label>
        <div className="relative">
          <input
            type="text"
            value={aberto ? buscaInsumo : (insumoSelecionado?.nome ?? '')}
            onChange={(e) => { setBuscaInsumo(e.target.value); setAberto(true); setInsumoId(''); }}
            onFocus={() => { setAberto(true); setBuscaInsumo(''); }}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            placeholder="Buscar insumo na base…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            autoFocus
            required
          />
          {insumoSelecionado && (
            <div className="text-[11px] text-emerald-700 mt-1 ml-1">
              ✓ {insumoSelecionado.nome} ({insumoSelecionado.unidade})
            </div>
          )}
          {aberto && sugestoesInsumo.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg max-h-56 overflow-auto">
              {sugestoesInsumo.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onMouseDown={() => { setInsumoId(i.id); setAberto(false); setBuscaInsumo(''); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] flex items-center justify-between"
                >
                  <span>{i.nome}</span>
                  <span className="text-[10px] text-[var(--color-fg-subtle)]">{i.unidade}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Qtd / Valor unit / Valor total */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Quantidade <span className="text-rose-500">*</span></Label>
          <Input
            type="number" step="any" min="0"
            value={quantidade || ''}
            onChange={(e) => setQtd(Number(e.target.value))}
            placeholder="0"
            required
          />
        </div>
        <div>
          <Label>Valor unitário (R$)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={valorUnitario || ''}
            onChange={(e) => setUnit(Number(e.target.value))}
            placeholder="0,00"
          />
        </div>
        <div>
          <Label>Valor total (R$)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={valorTotal || ''}
            onChange={(e) => setTotal(Number(e.target.value))}
            placeholder="0,00"
          />
          <p className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">
            Auto-calcula um quando você muda outro
          </p>
        </div>
      </div>

      {/* Data + Fornecedor + NF */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Data / hora</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-subtle)] pointer-events-none" />
            <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>Fornecedor</Label>
          <select
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
          >
            <option value="">— sem fornecedor específico —</option>
            {fornecedores.filter((f) => f.ativo !== false).map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Nota fiscal</Label>
          <Input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} placeholder="Número da NF (opcional)" />
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          placeholder="Ex.: chegada de pedido OC-2026-0042"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </div>

      {erro && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-900 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!podeSalvar || submitting}>
          {submitting ? 'Salvando…' : 'Registrar entrada'}
        </Button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}
