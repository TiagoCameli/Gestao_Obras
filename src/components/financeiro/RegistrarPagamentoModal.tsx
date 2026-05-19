/**
 * RegistrarPagamentoModal — Pequeno modal para registrar pagamento de uma
 * parcela de lançamento. Pré-preenche data = hoje e valor = valor da parcela.
 *
 * Ao confirmar, dispara `useRegistrarPagamentoFinanceiro` que insere o
 * pagamento, marca a parcela como pago e recalcula o status do lançamento.
 */
import { useEffect, useState } from 'react';
import { Banknote, Loader2, Paperclip, FileText, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';
import { useRegistrarPagamentoFinanceiro } from '../../hooks/usePagamentosFinanceiros';
import type {
  LancamentoFinanceiro,
  ParcelaLancamento,
  FormaPagamentoLancamento,
} from '../../types';

const FORMAS: { value: FormaPagamentoLancamento; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'outros', label: 'Outros' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoFinanceiro | null;
  parcela: ParcelaLancamento | null;
}

export default function RegistrarPagamentoModal({
  open, onClose, lancamento, parcela,
}: Props) {
  const { showToast } = useToast();
  const registrarMut = useRegistrarPagamentoFinanceiro();

  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState(0);
  const [forma, setForma] = useState<FormaPagamentoLancamento>('pix');
  const [observacoes, setObservacoes] = useState('');
  const [comprovanteUrl, setComprovanteUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  // Resetar form quando muda a parcela alvo
  useEffect(() => {
    if (parcela) {
      setValor(parcela.valor);
      setDataPagamento(new Date().toISOString().slice(0, 10));
      setForma((lancamento?.formaPagamento as FormaPagamentoLancamento) ?? 'pix');
      setObservacoes('');
      setComprovanteUrl(undefined);
    }
  }, [parcela, lancamento]);

  if (!parcela || !lancamento) return null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `pagamentos/${parcela!.id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('financeiro-anexos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('financeiro-anexos').getPublicUrl(path);
      setComprovanteUrl(data.publicUrl);
      showToast({ kind: 'success', message: 'Comprovante enviado.' });
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao enviar comprovante.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function confirmar() {
    if (valor <= 0) {
      showToast({ kind: 'error', message: 'Valor pago precisa ser maior que zero.' });
      return;
    }
    if (!dataPagamento) {
      showToast({ kind: 'error', message: 'Informe a data do pagamento.' });
      return;
    }
    try {
      await registrarMut.mutateAsync({
        parcela: parcela!,
        lancamento: lancamento!,
        pagamento: {
          dataPagamento,
          valor,
          formaPagamento: forma,
          comprovanteUrl,
          observacoes,
        },
      });
      showToast({
        kind: 'success',
        message: `Pagamento da parcela ${parcela!.numero}/${lancamento!.parcelas.length} registrado.`,
      });
      onClose();
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao registrar pagamento.',
      });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Registrar pagamento · Parcela ${parcela.numero}/${lancamento.parcelas.length}`} size="default">
      <div className="space-y-4">
        {/* Resumo da parcela */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-3 text-[12.5px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[var(--color-fg-muted)]">Lançamento</span>
            <strong className="text-[var(--color-fg)]">{lancamento.numero}</strong>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[var(--color-fg-muted)]">Parcela</span>
            <strong className="text-[var(--color-fg)]">
              {parcela.numero}/{lancamento.parcelas.length} · venc. {new Date(parcela.dataVencimento + 'T00:00').toLocaleDateString('pt-BR')}
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-fg-muted)]">Valor da parcela</span>
            <strong className="text-[var(--color-fg)] tabular-nums">R$ {parcela.valor.toFixed(2)}</strong>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">Data do pagamento</label>
            <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">Valor pago</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[var(--color-fg-subtle)] pointer-events-none z-10">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
                className="w-full h-[42px] rounded-lg pl-10 pr-3 py-2 text-sm text-right bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">Forma de pagamento</label>
            <SmartSelect
              value={forma}
              onChange={(e) => setForma(e.target.value as FormaPagamentoLancamento)}
              className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)] flex items-center"
            >
              {FORMAS.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
            </SmartSelect>
          </div>
        </div>

        {/* Comprovante */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">Comprovante (opcional)</label>
          {comprovanteUrl ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[12.5px]">
              <FileText className="w-4 h-4 text-[var(--color-fg-muted)]" />
              <a href={comprovanteUrl} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-[var(--color-fg)] hover:text-[var(--color-accent)]">
                Ver comprovante anexado
              </a>
              <button type="button" onClick={() => setComprovanteUrl(undefined)} className="text-[var(--color-fg-subtle)] hover:text-rose-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              {uploading ? 'Enviando…' : 'Anexar comprovante (PDF, JPG, PNG)'}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">Observações (opcional)</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex: pago via PIX da conta da Empresa A; conferido por João"
            className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={registrarMut.isPending}>
            <span className="inline-flex items-center gap-1.5">
              <Banknote className="w-4 h-4" />
              {registrarMut.isPending ? 'Salvando…' : 'Confirmar pagamento'}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
