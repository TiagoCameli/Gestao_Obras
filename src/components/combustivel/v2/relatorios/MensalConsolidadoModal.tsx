// Modal de parâmetros do template "Mensal Consolidado".
// Período = 1 mês (default mes_anterior). Aciona PDF ou Excel.
//
// F4.A.2.1: PDF embeda 2 PNGs de gráficos (Top Equipamentos +
// EvolucaoTemporal). Mount-on-demand via flag `rendering` — ao clicar
// PDF, o modal monta <RelatorioCharts> off-screen, espera próximos
// frames + fonts.ready, captura SVGs em PNG dataURL, desmonta, e
// chama o exportador com os PNGs.

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import type {
  EntradaCombustivel,
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
} from '../../../../types';
import Button from '../../../ui/Button';
import {
  exportarMensalConsolidadoExcel,
  exportarMensalConsolidadoPDF,
  type ChartImagens,
} from './mensalConsolidadoExport';
import RelatorioCharts from './RelatorioCharts';
import { svgElementToPngDataUrl } from './pdf/svgToPng';

interface Props {
  open: boolean;
  onClose: () => void;
  saidas: SaidaCombustivel[];
  entradas: EntradaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  obras: Obra[];
  combustiveis: Insumo[];
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

export default function MensalConsolidadoModal({
  open,
  onClose,
  saidas,
  entradas,
  equipamentos,
  transportadoras,
  obras,
  combustiveis,
}: Props) {
  const [mes, setMes] = useState<string>(mesAnteriorIso());
  const [generating, setGenerating] = useState<'pdf' | 'xlsx' | null>(null);
  /** Quando true, RelatorioCharts é montado off-screen pra captura. */
  const [renderingCharts, setRenderingCharts] = useState(false);

  useEffect(() => {
    if (open) {
      setMes(mesAnteriorIso());
      setGenerating(null);
      setRenderingCharts(false);
    }
  }, [open]);

  // Subset filtrado pelo mês — saída.data e entrada.dataHora começam com YYYY-MM-DD
  const saidasNoMes = useMemo(() => {
    return saidas.filter((s) => s.data.slice(0, 7) === mes);
  }, [saidas, mes]);

  const entradasNoMes = useMemo(() => {
    return entradas.filter((e) => e.dataHora.slice(0, 7) === mes);
  }, [entradas, mes]);

  // Período do mês selecionado pra alimentar EvolucaoTemporal.
  const periodoMes = useMemo(() => {
    const [ano, mm] = mes.split('-');
    const last = new Date(Number(ano), Number(mm), 0).getDate();
    return { from: `${ano}-${mm}-01`, to: `${ano}-${mm}-${String(last).padStart(2, '0')}` };
  }, [mes]);

  if (!open) return null;

  /** Espera 2 RAFs (commit + paint) seguidos, depois fonts + buffer pra
   *  Recharts terminar layout. Animação já está disabled via prop. */
  async function waitChartsReady(bufferMs = 120): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (typeof document.fonts?.ready === 'object' && 'then' in document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, bufferMs));
  }

  async function captureChartImages(): Promise<ChartImagens> {
    const result: ChartImagens = {};
    const topEqSvg = document.querySelector(
      '[data-relatorio-charts] [data-chart="top-equipamentos"] svg',
    ) as SVGElement | null;
    const evolSvg = document.querySelector(
      '[data-relatorio-charts] [data-chart="evolucao-temporal"] svg',
    ) as SVGElement | null;
    if (topEqSvg) {
      try {
        result.topEquipamentos = await svgElementToPngDataUrl(topEqSvg, 'auto', 'auto');
      } catch (e) {
        console.warn('captureChartImages: falha em topEquipamentos', e);
      }
    }
    if (evolSvg) {
      try {
        result.evolucaoTemporal = await svgElementToPngDataUrl(evolSvg, 'auto', 'auto');
      } catch (e) {
        console.warn('captureChartImages: falha em evolucaoTemporal', e);
      }
    }
    return result;
  }

  async function handleGerar(formato: 'pdf' | 'xlsx') {
    setGenerating(formato);
    const input = {
      mesReferencia: mes,
      saidasNoMes,
      entradasNoMes,
      equipamentos,
      transportadoras,
      obras,
      combustiveis,
    };
    try {
      if (formato === 'pdf') {
        // Mount-on-demand: RelatorioCharts entra no DOM, espera frames,
        // captura PNGs, depois desmonta.
        setRenderingCharts(true);
        await waitChartsReady();
        const charts = await captureChartImages();
        setRenderingCharts(false);
        exportarMensalConsolidadoPDF({ ...input, charts });
      } else {
        await exportarMensalConsolidadoExcel(input);
      }
    } catch (e) {
      console.error('Erro ao gerar relatório', e);
      alert('Falha ao gerar o relatório. Tente novamente.');
      setRenderingCharts(false);
    } finally {
      setGenerating(null);
    }
  }

  const empty = saidasNoMes.length === 0 && entradasNoMes.length === 0;

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
              <FileText className="w-4 h-4 text-[var(--color-accent)]" />
              Mensal Consolidado
            </h2>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              Visão executiva do mês — KPIs, top 10 equipamentos/carretas/obras, fornecedores
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating !== null}
            className="p-1 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 text-[var(--color-fg-muted)]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="mes-input" className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5">
              Mês de referência
            </label>
            <input
              id="mes-input"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              disabled={generating !== null}
              className="w-full h-10 px-3 text-sm rounded-lg bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <p className="text-[11px] text-[var(--color-fg-muted)] mt-1">
              {mesAnoLabel(mes)} · {saidasNoMes.length} saída{saidasNoMes.length !== 1 ? 's' : ''} · {entradasNoMes.length} entrada{entradasNoMes.length !== 1 ? 's' : ''}
            </p>
          </div>

          {empty && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Sem movimentação no mês selecionado. Escolha outro mês.
            </div>
          )}

          {generating === 'pdf' && (
            <div className="rounded-lg bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 px-3 py-2 text-xs text-[var(--color-accent-fg)] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Gerando relatório com gráficos…</span>
            </div>
          )}
        </div>

        {renderingCharts && (
          <RelatorioCharts
            saidasNoMes={saidasNoMes}
            equipamentos={equipamentos}
            periodo={periodoMes}
          />
        )}

        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleGerar('xlsx')}
            disabled={empty || generating !== null}
            className="text-sm inline-flex items-center gap-1.5"
          >
            {generating === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Excel
          </Button>
          <Button
            type="button"
            onClick={() => handleGerar('pdf')}
            disabled={empty || generating !== null}
            className="text-sm inline-flex items-center gap-1.5"
          >
            {generating === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
