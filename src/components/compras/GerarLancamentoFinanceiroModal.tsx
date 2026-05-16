/**
 * Modal para gerar lançamento financeiro a partir de uma OC aprovada.
 *
 * NOTA: o módulo Financeiro ainda não existe no app — este modal é o
 * placeholder que marca a OC como `lancamento_financeiro_status='lancada'`
 * e grava `lancado_financeiro_em/por` + um id interno. Quando o módulo
 * Financeiro for construído, este modal vira o ponto de integração real
 * (criar parcelas, contas a pagar, etc.).
 *
 * Restrição: uma OC só pode ter UM lançamento. O botão de gerar só aparece
 * quando lancamento_financeiro_status === 'pendente'.
 */
import { useState } from 'react';
import { Banknote, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { OrdemCompra, Fornecedor } from '../../types';

interface Props {
  open: boolean;
  oc: OrdemCompra | null;
  fornecedor?: Fornecedor;
  onClose: () => void;
  onConfirm: (oc: OrdemCompra, observacao: string) => Promise<void>;
}

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function GerarLancamentoFinanceiroModal({
  open, oc, fornecedor, onClose, onConfirm,
}: Props) {
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!oc) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(oc, observacao);
      setObservacao('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Gerar lançamento financeiro — ${oc.numero}`}>
      <div className="space-y-5">
        {/* Resumo da OC */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Banknote className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-[var(--color-fg)]">{oc.numero}</span>
            <span className="text-[var(--color-fg-muted)]">·</span>
            <span className="text-[var(--color-fg-muted)]">{fornecedor?.nome ?? 'fornecedor não informado'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-fg-muted)]">Total a lançar:</span>
            <span className="font-semibold text-base text-[var(--color-fg)] tabular-nums">{fmtMoeda(oc.totalGeral)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
            <span>Condição: {oc.condicaoPagamento || '—'}</span>
            <span>Forma: {oc.formaPagamento || '—'}</span>
          </div>
        </div>

        {/* Aviso temporário sobre o módulo financeiro */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-sm text-blue-900 dark:text-blue-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            O módulo <strong>Financeiro</strong> ainda será construído. Por enquanto, esse botão
            apenas <strong>marca esta OC como lançada</strong> (com auditoria de quem fez e quando).
            Quando o Financeiro existir, ele vai consumir essas OCs lançadas para gerar parcelas
            e contas a pagar.
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1.5">
            Observação do lançamento (opcional)
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="Ex.: dividir em 3 parcelas, vencimento dia 10, etc."
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            <Banknote className="w-4 h-4" />
            {submitting ? 'Lançando…' : 'Confirmar lançamento'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
