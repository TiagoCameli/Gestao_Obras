// Modal de parâmetros do template "Por Equipamento" (F4.B.2).
// Combobox single-select pra equipamento + range de/até (default
// últimos 90 dias). Charts always-mounted off-screen — apenas
// EvolucaoTemporal é capturado; TopEquipamentos cai em modo lista
// (1 row → useList → no SVG) e captureChartImages pula via null check.

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, X, Settings2 } from 'lucide-react';
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
import {
  exportarPorEquipamentoExcel,
  exportarPorEquipamentoPDF,
} from './porEquipamentoExport';
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

const CONTAINER_KEY = 'por-equipamento';

/** Default range: últimos 90 dias (today inclusive). Mesmo padrão do
 *  preset 'ultimos_90' do FilterContext. */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 89);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function isoDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PorEquipamentoModal({
  open,
  onClose,
  saidas,
  entradas,
  equipamentos,
  transportadoras: _transportadoras,
  obras,
  combustiveis,
}: Props) {
  const [equipId, setEquipId] = useState<string>('');
  const initialRange = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState<string>(initialRange.from);
  const [to, setTo] = useState<string>(initialRange.to);
  const [generating, setGenerating] = useState<'pdf' | 'xlsx' | null>(null);

  useEffect(() => {
    if (open) {
      setEquipId('');
      const r = defaultRange();
      setFrom(r.from);
      setTo(r.to);
      setGenerating(null);
    }
  }, [open]);

  // Lista de equipamentos ativos pra combobox (label = código + nome).
  const equipOptions = useMemo(() => {
    return [...equipamentos]
      .filter((e) => e.ativo !== false)
      .sort((a, b) =>
        (a.codigoPatrimonio || a.nome).localeCompare(b.codigoPatrimonio || b.nome),
      )
      .map((e) => {
        const codigo = e.codigoPatrimonio || e.tipo || '';
        const label = codigo ? `${codigo} · ${e.nome}` : e.nome;
        return { value: e.id, label };
      });
  }, [equipamentos]);

  const equipSelecionado = useMemo(
    () => equipamentos.find((e) => e.id === equipId) ?? null,
    [equipamentos, equipId],
  );

  // Tech-debt #34 fix — usar getTime() (TZ local) em vez de slice(0, 10) (UTC),
  // mesma razão do fix em VisaoGeralTab.isInRange. Saídas em 21:00-23:59 BRT
  // caem em UTC do dia seguinte; slice(UTC) rejeitava elas indevidamente.
  const fromTs = useMemo(() => new Date(from + 'T00:00:00').getTime(), [from]);
  const toTs = useMemo(() => new Date(to + 'T23:59:59').getTime(), [to]);

  // Saídas filtradas: tipoConsumidor='equipamento_proprio' + equipId + range.
  const saidasEquip = useMemo(() => {
    if (!equipId) return [];
    return saidas.filter((s) => {
      if (s.tipoConsumidor !== 'equipamento_proprio') return false;
      if (s.equipamentoId !== equipId) return false;
      const t = new Date(s.data).getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [saidas, equipId, fromTs, toTs]);

  const entradasNoPeriodo = useMemo(() => {
    return entradas.filter((e) => {
      const t = new Date(e.dataHora).getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [entradas, fromTs, toTs]);

  const periodo = useMemo(() => ({ from, to }), [from, to]);

  // Métricas de pré-visualização do escopo selecionado
  const previewLitros = useMemo(
    () => saidasEquip.reduce((acc, s) => acc + s.litros, 0),
    [saidasEquip],
  );
  const previewCusto = useMemo(
    () => saidasEquip.reduce((acc, s) => acc + s.valorTotal, 0),
    [saidasEquip],
  );

  function applyPreset90() {
    const r = defaultRange();
    setFrom(r.from);
    setTo(r.to);
  }

  function applyPreset30() {
    const today = new Date();
    const fromD = new Date(today);
    fromD.setDate(fromD.getDate() - 29);
    setFrom(isoDateStr(fromD));
    setTo(isoDateStr(today));
  }

  async function handleGerar(formato: 'pdf' | 'xlsx') {
    if (!equipSelecionado) return;
    setGenerating(formato);
    // F3.C.2 — Anomalias do escopo. detectAnomalias precisa do banco
    // completo pra D3 (90d hist) e D5 (60d gap).
    const combustivelNome = new Map(combustiveis.map((c) => [c.id, c.nome]));
    const obraNome = new Map(obras.map((o) => [o.id, o.nome]));
    const anomalias = detectAnomalias({
      saidasNoPeriodo: saidasEquip,
      saidasTodas: saidas,
      equipamentos,
      combustivelNome,
      obraNome,
    });
    const input = {
      equipamento: equipSelecionado,
      from,
      to,
      saidasEquipamento: saidasEquip,
      entradasNoPeriodo,
      obras,
      combustiveis,
      anomalias,
    };
    try {
      if (formato === 'pdf') {
        const charts = await settleAndCapture(CONTAINER_KEY);
        exportarPorEquipamentoPDF({ ...input, charts });
      } else {
        await exportarPorEquipamentoExcel(input);
      }
    } catch (e) {
      console.error('Erro ao gerar relatório', e);
      alert('Falha ao gerar o relatório. Tente novamente.');
    } finally {
      setGenerating(null);
    }
  }

  const empty = !equipId || saidasEquip.length === 0;
  const rangeInvalid = from > to;

  return (
    <>
      {/* Always-mounted off-screen — captura instantânea do EvolucaoTemporal.
          TopEquipamentos com 1 row cai em modo lista (sem SVG) e é pulado
          pelo capture. ContainerKey dedicado pra coexistir com Mensal +
          PorObra na árvore. */}
      <RelatorioCharts
        containerKey={CONTAINER_KEY}
        saidasNoMes={saidasEquip}
        equipamentos={equipamentos}
        periodo={periodo}
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
                  <Settings2 className="w-4 h-4 text-[var(--color-accent)]" />
                  Por Equipamento
                </h2>
                <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                  Histórico de consumo de um equipamento — obras frequentes, evolução temporal, fornecedores
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
                  Equipamento
                </label>
                <FilterCombobox
                  value={equipId}
                  onChange={setEquipId}
                  options={equipOptions}
                  placeholder="Buscar por código ou nome…"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                    Período
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={applyPreset30}
                      disabled={generating !== null}
                      className="text-[10px] px-2 py-0.5 rounded text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                    >
                      Últimos 30d
                    </button>
                    <button
                      type="button"
                      onClick={applyPreset90}
                      disabled={generating !== null}
                      className="text-[10px] px-2 py-0.5 rounded text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                    >
                      Últimos 90d
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                    disabled={generating !== null}
                    className="h-10 px-3 text-sm rounded-lg bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                    aria-label="Data inicial"
                  />
                  <input
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => setTo(e.target.value)}
                    disabled={generating !== null}
                    className="h-10 px-3 text-sm rounded-lg bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                    aria-label="Data final"
                  />
                </div>
                <p className="text-[11px] text-[var(--color-fg-muted)] mt-1">
                  {rangeInvalid ? (
                    <span className="text-amber-700">Range inválido: data inicial maior que final.</span>
                  ) : (
                    <>
                      {equipId ? (
                        <>
                          <span className="font-semibold tabular-nums">{saidasEquip.length}</span> saída{saidasEquip.length !== 1 ? 's' : ''}
                          {' · '}
                          <span className="font-semibold tabular-nums">{previewLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
                          {' · '}
                          <span className="font-semibold tabular-nums">{fmtBRL(previewCusto)}</span>
                        </>
                      ) : (
                        'Selecione um equipamento pra ver o resumo do escopo.'
                      )}
                    </>
                  )}
                </p>
              </div>

              {equipId && saidasEquip.length === 0 && !rangeInvalid && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  Sem saídas para este equipamento no período. Tente um range maior ou outro equipamento.
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
                disabled={empty || rangeInvalid || generating !== null}
                className="text-sm inline-flex items-center gap-1.5"
              >
                {generating === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Excel
              </Button>
              <Button
                type="button"
                onClick={() => handleGerar('pdf')}
                disabled={empty || rangeInvalid || generating !== null}
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
