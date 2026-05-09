// Modal de parâmetros do template "Raw Export" (F4.C).
// Sem PDF, sem charts — só Excel multi-aba com dado cru. Modal mais
// simples que os outros: month input + botão Excel.

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, X } from 'lucide-react';
import type {
  Deposito,
  EntradaCombustivel,
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
  TransferenciaCombustivel,
} from '../../../../types';
import Button from '../../../ui/Button';
import { exportarRawExcel } from './rawExportExcel';

interface Props {
  open: boolean;
  onClose: () => void;
  saidas: SaidaCombustivel[];
  entradas: EntradaCombustivel[];
  transferencias: TransferenciaCombustivel[];
  obras: Obra[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  depositos: Deposito[];
}

function mesAnteriorIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function mesAnoLabel(mes: string): string {
  if (!mes) return '—';
  const [ano, m] = mes.split('-');
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return mes;
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${meses[idx]} de ${ano}`;
}

export default function RawExportModal({
  open,
  onClose,
  saidas,
  entradas,
  transferencias,
  obras,
  equipamentos,
  transportadoras,
  combustiveis,
  depositos,
}: Props) {
  const [mes, setMes] = useState<string>(mesAnteriorIso());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setMes(mesAnteriorIso());
      setGenerating(false);
    }
  }, [open]);

  // Subsets do mês — saída.data e entrada/transferência.dataHora começam YYYY-MM-DD
  const saidasNoMes = useMemo(
    () => saidas.filter((s) => s.data.slice(0, 7) === mes),
    [saidas, mes],
  );
  const entradasNoMes = useMemo(
    () => entradas.filter((e) => e.dataHora.slice(0, 7) === mes),
    [entradas, mes],
  );
  const transferenciasNoMes = useMemo(
    () => transferencias.filter((t) => t.dataHora.slice(0, 7) === mes),
    [transferencias, mes],
  );

  if (!open) return null;

  async function handleGerar() {
    setGenerating(true);
    try {
      await exportarRawExcel({
        mesReferencia: mes,
        saidasNoMes,
        entradasNoMes,
        transferenciasNoMes,
        obras,
        equipamentos,
        transportadoras,
        combustiveis,
        depositos,
      });
    } catch (e) {
      console.error('Erro ao gerar raw export', e);
      alert('Falha ao gerar o relatório. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  const empty = saidasNoMes.length === 0 && entradasNoMes.length === 0 && transferenciasNoMes.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[var(--color-surface-1)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-full max-w-md flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-fg)] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[var(--color-accent)]" />
              Raw Export
            </h2>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              Excel multi-aba — saídas, entradas, transferências do mês com FKs resolvidas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="p-1 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 text-[var(--color-fg-muted)]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="mes-input-raw" className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5">
              Mês de referência
            </label>
            <input
              id="mes-input-raw"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              disabled={generating}
              className="w-full h-10 px-3 text-sm rounded-lg bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <p className="text-[11px] text-[var(--color-fg-muted)] mt-1">
              {mesAnoLabel(mes)} · <span className="font-semibold tabular-nums">{saidasNoMes.length}</span> saída{saidasNoMes.length !== 1 ? 's' : ''}
              {' · '}
              <span className="font-semibold tabular-nums">{entradasNoMes.length}</span> entrada{entradasNoMes.length !== 1 ? 's' : ''}
              {' · '}
              <span className="font-semibold tabular-nums">{transferenciasNoMes.length}</span> transferência{transferenciasNoMes.length !== 1 ? 's' : ''}
            </p>
          </div>

          {empty && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Sem movimentação no mês selecionado. Escolha outro mês.
            </div>
          )}

          <div className="rounded-lg bg-[var(--color-surface-2)]/50 border border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--color-fg)]">5 sheets:</span> Resumo · Saídas · Entradas · Transferências · Cadastros (referência inline com tanques, equipamentos, transportadoras e combustíveis).
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={handleGerar}
            disabled={empty || generating}
            className="text-sm inline-flex items-center gap-1.5"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Excel
          </Button>
        </div>
      </div>
    </div>
  );
}
