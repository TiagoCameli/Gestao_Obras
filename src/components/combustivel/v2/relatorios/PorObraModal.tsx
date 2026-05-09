// Modal de parâmetros do template "Por Obra" (F4.B.1).
// Combobox single-select pra obra + month input. Charts montados off-screen
// (always-mounted, mesmo padrão do MensalConsolidadoModal) — captura via
// settleAndCapture com containerKey específico pra coexistir com Mensal
// na árvore de RelatóriosTab.

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, X, ClipboardList } from 'lucide-react';
import type {
  EntradaCombustivel,
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
} from '../../../../types';
import Button from '../../../ui/Button';
import FilterCombobox from '../../../ui/FilterCombobox';
import { fmtBRL } from '../../../../utils/exportTemplate';
import { exportarPorObraExcel, exportarPorObraPDF } from './porObraExport';
import RelatorioCharts from './RelatorioCharts';
import { settleAndCapture } from './pdf/captureCharts';
import { detectAnomalias } from '../anomalias/detect';

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

const CONTAINER_KEY = 'por-obra';

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

export default function PorObraModal({
  open,
  onClose,
  saidas,
  entradas,
  equipamentos,
  transportadoras,
  obras,
  combustiveis,
}: Props) {
  const [obraId, setObraId] = useState<string>('');
  const [mes, setMes] = useState<string>(mesAnteriorIso());
  const [generating, setGenerating] = useState<'pdf' | 'xlsx' | null>(null);

  useEffect(() => {
    if (open) {
      setObraId('');
      setMes(mesAnteriorIso());
      setGenerating(null);
    }
  }, [open]);

  // Lista de opções pra combobox — só obras que têm saídas (ranking de relevância).
  const obraOptions = useMemo(() => {
    return [...obras]
      .filter((o) => o.status !== 'concluida' || saidas.some((s) => s.obraId === o.id))
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((o) => ({ value: o.id, label: o.nome }));
  }, [obras, saidas]);

  const obraSelecionada = useMemo(
    () => obras.find((o) => o.id === obraId) ?? null,
    [obras, obraId],
  );

  // Saídas filtradas: pelo obraId + mês. Ambos os modos (próprios + carretas)
  // — o relatório quer cobertura completa do consumo NA obra.
  const saidasObra = useMemo(() => {
    if (!obraId) return [];
    return saidas.filter(
      (s) => s.obraId === obraId && s.data.slice(0, 7) === mes,
    );
  }, [saidas, obraId, mes]);

  const entradasNoMes = useMemo(() => {
    return entradas.filter((e) => e.dataHora.slice(0, 7) === mes);
  }, [entradas, mes]);

  // Período (1 mês) pra alimentar EvolucaoTemporal off-screen.
  const periodoMes = useMemo(() => {
    const [ano, mm] = mes.split('-');
    const last = new Date(Number(ano), Number(mm), 0).getDate();
    return { from: `${ano}-${mm}-01`, to: `${ano}-${mm}-${String(last).padStart(2, '0')}` };
  }, [mes]);

  // Métricas de pré-visualização do escopo selecionado
  const previewLitros = useMemo(
    () => saidasObra.reduce((acc, s) => acc + s.litros, 0),
    [saidasObra],
  );
  const previewCusto = useMemo(
    () => saidasObra.reduce((acc, s) => acc + s.valorTotal, 0),
    [saidasObra],
  );

  async function handleGerar(formato: 'pdf' | 'xlsx') {
    if (!obraSelecionada) return;
    setGenerating(formato);
    // F3.C.2 — Anomalias do escopo: detectAnomalias precisa do hist 90d (D3)
    // e gap 60d (D5), por isso recebe saidas (banco completo) também.
    const combustivelNome = new Map(combustiveis.map((c) => [c.id, c.nome]));
    const obraNome = new Map(obras.map((o) => [o.id, o.nome]));
    const anomalias = detectAnomalias({
      saidasNoPeriodo: saidasObra,
      saidasTodas: saidas,
      equipamentos,
      combustivelNome,
      obraNome,
    });
    const input = {
      obra: obraSelecionada,
      mesReferencia: mes,
      saidasObra,
      entradasNoMes,
      equipamentos,
      transportadoras,
      combustiveis,
      anomalias,
    };
    try {
      if (formato === 'pdf') {
        const charts = await settleAndCapture(CONTAINER_KEY);
        exportarPorObraPDF({ ...input, charts });
      } else {
        await exportarPorObraExcel(input);
      }
    } catch (e) {
      console.error('Erro ao gerar relatório', e);
      alert('Falha ao gerar o relatório. Tente novamente.');
    } finally {
      setGenerating(null);
    }
  }

  const empty = !obraId || saidasObra.length === 0;

  return (
    <>
      {/* Always-mounted off-screen — captura instantânea quando o usuário
          clica PDF. Sem mount-on-demand pra evitar race conditions com
          React 19 concurrent. Container key dedicado pra coexistir com
          o Mensal Consolidado na árvore. */}
      <RelatorioCharts
        containerKey={CONTAINER_KEY}
        saidasNoMes={saidasObra}
        equipamentos={equipamentos}
        periodo={periodoMes}
      />

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--color-surface-1)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-fg)] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[var(--color-accent)]" />
                  Por Obra
                </h2>
                <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                  Detalhamento de uma obra específica em 1 mês — saídas, equipamentos, fornecedores
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
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5">
                  Obra
                </label>
                <FilterCombobox
                  value={obraId}
                  onChange={setObraId}
                  options={obraOptions}
                  placeholder="Buscar obra…"
                />
              </div>

              <div>
                <label htmlFor="mes-input-obra" className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5">
                  Mês de referência
                </label>
                <input
                  id="mes-input-obra"
                  type="month"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  disabled={generating !== null}
                  className="w-full h-10 px-3 text-sm rounded-lg bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <p className="text-[11px] text-[var(--color-fg-muted)] mt-1">
                  {mesAnoLabel(mes)}
                  {obraId && (
                    <>
                      {' · '}
                      <span className="font-semibold tabular-nums">{saidasObra.length}</span> saída{saidasObra.length !== 1 ? 's' : ''}
                      {' · '}
                      <span className="font-semibold tabular-nums">{previewLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
                      {' · '}
                      <span className="font-semibold tabular-nums">{fmtBRL(previewCusto)}</span>
                    </>
                  )}
                </p>
              </div>

              {obraId && saidasObra.length === 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  Sem saídas para esta obra no mês selecionado. Escolha outra combinação.
                </div>
              )}

              {generating === 'pdf' && (
                <div className="rounded-lg bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 px-3 py-2 text-xs text-[var(--color-accent-fg)] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Gerando relatório com gráficos…</span>
                </div>
              )}
            </div>

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
      )}
    </>
  );
}
