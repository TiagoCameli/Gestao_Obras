// AnomaliasTab — aba "Anomalias" do módulo Combustível (F3.A).
//
// Lista plana de anomalias detectadas, com filtros laterais (severity +
// detector) e empty-state positivo quando 0. Sem drawer/ação ainda
// (esperando F3.B). detectAnomalias() é puro e memoizado.

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Search, ShieldCheck } from 'lucide-react';
import type {
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
} from '../../../../types';
import {
  detectAnomalias,
  DETECTOR_LABEL,
  SEVERITY_LABEL,
  type Anomalia,
  type DetectorId,
  type Severidade,
} from './detect';
import { useCombustivelFilter } from '../filters/FilterContext';
import AnomaliaDrawer from './AnomaliaDrawer';

interface Props {
  /** Saídas filtradas pelo recorte UI (mode + período + obra + ...). */
  saidasFiltradas: SaidaCombustivel[];
  /** Saídas TODAS (sem filtro UI). D3 precisa hist 90d, D5 precisa 60d
   *  fixos do banco completo. */
  saidasTodas: SaidaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  obras: Obra[];
  combustiveis: Insumo[];
  /** Callbacks dispatch pra mutations — owners são o container que tem
   *  acesso aos React Query hooks + password dialog. */
  onEditSaida: (s: SaidaCombustivel) => void;
  onDeleteSaida: (id: string) => void;
  onAtribuirEquipamento: (saida: SaidaCombustivel, equipamentoId: string) => Promise<void>;
  /** F3.C.1 — pré-filtro vindo do KPI #6 da VG. Aplicado uma vez no mount/
   *  quando muda; container limpa via onConsumeSeverityPrefill pra não
   *  re-aplicar em re-renders triviais. */
  severityPrefill?: Severidade[] | null;
  onConsumeSeverityPrefill?: () => void;
  /** F3.D.2 — Map de checks vindos do hook useAnomaliasChecks no container.
   *  Drawer consome via lookup pra renderizar banner "Verificada". */
  anomaliasChecks?: Map<string, import('../../../../hooks/useAnomaliasChecks').AnomaliaCheck>;
  onMarcarVerificada?: (anomaliaId: string) => void;
  onDesfazerVerificacao?: (anomaliaId: string) => void;
}

const SEVERITY_STYLES: Record<Severidade, {
  icon: typeof AlertCircle;
  badgeBg: string;
  badgeFg: string;
  border: string;
  iconColor: string;
}> = {
  critical: {
    icon: AlertCircle,
    badgeBg: 'bg-[var(--color-danger-soft)]',
    badgeFg: 'text-[var(--color-danger-fg)]',
    border: 'border-[var(--color-danger)]/30',
    iconColor: 'text-[var(--color-danger)]',
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: 'bg-[var(--color-warning-soft)]',
    badgeFg: 'text-[var(--color-warning-fg)]',
    border: 'border-[var(--color-warning)]/30',
    iconColor: 'text-[var(--color-warning)]',
  },
  info: {
    icon: Info,
    badgeBg: 'bg-[var(--color-info-soft)]',
    badgeFg: 'text-[var(--color-info-fg)]',
    border: 'border-[var(--color-info)]/30',
    iconColor: 'text-[var(--color-info)]',
  },
};

const SEVERITY_FILTERS: Severidade[] = ['critical', 'warning', 'info'];
const DETECTOR_FILTERS: DetectorId[] = ['D1', 'D2', 'D3', 'D4', 'D5'];

export default function AnomaliasTab({
  saidasFiltradas,
  saidasTodas,
  equipamentos,
  transportadoras,
  obras,
  combustiveis,
  onEditSaida,
  onDeleteSaida,
  onAtribuirEquipamento,
  severityPrefill,
  onConsumeSeverityPrefill,
  anomaliasChecks,
  onMarcarVerificada,
  onDesfazerVerificacao,
}: Props) {
  const { state } = useCombustivelFilter();
  const [busca, setBusca] = useState('');
  const [sevFiltro, setSevFiltro] = useState<Set<Severidade>>(new Set());
  const [detFiltro, setDetFiltro] = useState<Set<DetectorId>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // F3.D.3 — toggle "Mostrar verificadas" (default OFF). Quando OFF,
  // anomalias com check ficam escondidas da lista (mas continuam contadas
  // num badge separado: "X / Y verificadas"). KPI #6 também reflete isso.
  const [mostrarVerificadas, setMostrarVerificadas] = useState(false);

  // F3.C.1 — Aplica pré-filtro vindo do KPI da VG (uma vez por trigger).
  // Container chama onConsumeSeverityPrefill() pra limpar o prop, evitando
  // re-aplicação em renders subsequentes (ex: filtros mudando, refresh do
  // React Query). Set inválido vira no-op.
  useEffect(() => {
    if (severityPrefill && severityPrefill.length > 0) {
      setSevFiltro(new Set(severityPrefill));
      onConsumeSeverityPrefill?.();
    }
  }, [severityPrefill, onConsumeSeverityPrefill]);

  const combustivelNome = useMemo(
    () => new Map(combustiveis.map((c) => [c.id, c.nome])),
    [combustiveis],
  );
  const obraNome = useMemo(
    () => new Map(obras.map((o) => [o.id, o.nome])),
    [obras],
  );

  const anomalias = useMemo(() => {
    const t0 = performance.now();
    const result = detectAnomalias({
      saidasNoPeriodo: saidasFiltradas,
      saidasTodas,
      equipamentos,
      combustivelNome,
      obraNome,
    });
    const dt = performance.now() - t0;
    if (dt > 50) {
      console.log(`[anomalias] detect rodou em ${dt.toFixed(0)}ms (${result.length} anomalias)`);
    }
    return result;
  }, [saidasFiltradas, saidasTodas, equipamentos, combustivelNome, obraNome]);

  // Auto-close: quando a anomalia selecionada some da lista (ID determinístico
  // não está mais presente), significa "resolvida" via mutation. Drawer fecha.
  // Se a anomalia ainda existe (ex: D4 com 3 dups → user excluiu 1 → 2 ainda
  // formam dup), drawer permanece aberto com conteúdo recalculado.
  useEffect(() => {
    if (!selectedId) return;
    if (!anomalias.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [anomalias, selectedId]);

  const selectedAnomalia = useMemo(
    () => (selectedId ? anomalias.find((a) => a.id === selectedId) ?? null : null),
    [anomalias, selectedId],
  );

  // F3.D.3 — counts considerando o toggle "Mostrar verificadas". Quando OFF
  // (default), counts da sidebar refletem só não-verificadas. checksCount
  // separado pra mostrar "X / N verificadas" no badge do header.
  const counts = useMemo(() => {
    const sev: Record<Severidade, number> = { critical: 0, warning: 0, info: 0 };
    const det: Record<DetectorId, number> = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 };
    let verificadasCount = 0;
    for (const a of anomalias) {
      const isChecked = anomaliasChecks?.has(a.id) ?? false;
      if (isChecked) verificadasCount++;
      // Quando toggle OFF, exclui verificadas das contagens da sidebar
      if (!mostrarVerificadas && isChecked) continue;
      sev[a.severity]++;
      det[a.detector]++;
    }
    return { sev, det, verificadasCount };
  }, [anomalias, anomaliasChecks, mostrarVerificadas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return anomalias.filter((a) => {
      // F3.D.3 — esconde verificadas quando toggle OFF
      if (!mostrarVerificadas && (anomaliasChecks?.has(a.id) ?? false)) return false;
      if (sevFiltro.size > 0 && !sevFiltro.has(a.severity)) return false;
      if (detFiltro.size > 0 && !detFiltro.has(a.detector)) return false;
      if (q && !`${a.title} ${a.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [anomalias, sevFiltro, detFiltro, busca, mostrarVerificadas, anomaliasChecks]);

  function toggleSev(s: Severidade) {
    setSevFiltro((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleDet(d: DetectorId) {
    setDetFiltro((cur) => {
      const next = new Set(cur);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function clearFiltros() {
    setSevFiltro(new Set());
    setDetFiltro(new Set());
    setBusca('');
  }

  const hasFiltros = sevFiltro.size > 0 || detFiltro.size > 0 || busca.trim().length > 0;

  // Empty state — nenhuma anomalia DETECTADA (não filtrada). Sinaliza
  // estado limpo no escopo atual, diferente de "sem dados".
  if (anomalias.length === 0) {
    return (
      <div className="space-y-4">
        <Header total={0} mode={state.mode} />
        <div className="rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/40 p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-[var(--color-success)] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[var(--color-fg)]">
            Sem anomalias detectadas no período
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            Os 5 detectores (sentinel, R$/L outlier, volume atípico, duplicatas, gap operacional) rodaram e não encontraram problemas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header total={anomalias.length} mode={state.mode} />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Filtros laterais */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
              Severidade
            </div>
            <div className="flex flex-col gap-1.5">
              {SEVERITY_FILTERS.map((s) => {
                const active = sevFiltro.has(s);
                const styles = SEVERITY_STYLES[s];
                const Icon = styles.icon;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSev(s)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      active
                        ? `${styles.badgeBg} ${styles.badgeFg} font-semibold`
                        : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? '' : styles.iconColor}`} />
                    <span className="flex-1 text-left">{SEVERITY_LABEL[s]}</span>
                    <span className="tabular-nums opacity-70">{counts.sev[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
              Detector
            </div>
            <div className="flex flex-col gap-1.5">
              {DETECTOR_FILTERS.map((d) => {
                const active = detFiltro.has(d);
                const count = counts.det[d];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDet(d)}
                    disabled={count === 0}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      active
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold'
                        : count === 0
                          ? 'text-[var(--color-fg-subtle)] cursor-not-allowed'
                          : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-60">{d}</span>
                    <span className="flex-1 text-left">{DETECTOR_LABEL[d]}</span>
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* F3.D.3 — toggle "Mostrar verificadas" */}
          {counts.verificadasCount > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
              <label className="flex items-center gap-2 text-xs text-[var(--color-fg)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={mostrarVerificadas}
                  onChange={(e) => setMostrarVerificadas(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[var(--color-accent)]"
                />
                <span className="flex-1">Mostrar verificadas</span>
                <span className="tabular-nums text-[var(--color-success)] font-semibold">
                  {counts.verificadasCount}
                </span>
              </label>
              <p className="text-[10px] text-[var(--color-fg-muted)] mt-1.5 italic leading-tight">
                Anomalias revisadas e marcadas como OK ficam fora da lista por padrão.
              </p>
            </div>
          )}

          {hasFiltros && (
            <button
              type="button"
              onClick={clearFiltros}
              className="text-[11px] text-[var(--color-fg-muted)] hover:text-red-600 underline px-2"
            >
              Limpar filtros
            </button>
          )}
        </aside>

        {/* Lista */}
        <section className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título ou descrição…"
              className="w-full h-10 pl-9 pr-3 text-sm rounded-lg bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {filtradas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-8 text-center text-xs text-[var(--color-fg-muted)]">
              Nenhuma anomalia bate com os filtros atuais.
              {hasFiltros && (
                <button
                  type="button"
                  onClick={clearFiltros}
                  className="ml-2 underline hover:text-[var(--color-fg)]"
                >
                  Limpar
                </button>
              )}
            </div>
          ) : (
            filtradas.map((a) => (
              <AnomaliaRow key={a.id} a={a} onClick={() => setSelectedId(a.id)} />
            ))
          )}
        </section>
      </div>

      <AnomaliaDrawer
        anomalia={selectedAnomalia}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        saidasTodas={saidasTodas}
        obras={obras}
        equipamentos={equipamentos}
        transportadoras={transportadoras}
        combustiveis={combustiveis}
        onEditSaida={onEditSaida}
        onDeleteSaida={onDeleteSaida}
        onAtribuirEquipamento={onAtribuirEquipamento}
        verificada={selectedAnomalia ? anomaliasChecks?.get(selectedAnomalia.id) ?? null : null}
        onMarcarVerificada={onMarcarVerificada}
        onDesfazerVerificacao={onDesfazerVerificacao}
      />
    </div>
  );
}

function Header({ total, mode }: { total: number; mode: 'proprios' | 'carretas' }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-fg)]">Anomalias</h2>
      <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
        Detecção cliente-side de saídas e estados fora do padrão · escopo atual: <span className="font-medium">{mode === 'proprios' ? 'Equipamentos próprios' : 'Carretas'}</span>{' '}
        · <span className="font-mono tabular-nums">{total}</span> anomalia{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

function AnomaliaRow({ a, onClick }: { a: Anomalia; onClick: () => void }) {
  const styles = SEVERITY_STYLES[a.severity];
  const Icon = styles.icon;
  const dataLabel = a.data.split('-').reverse().join('/');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border ${styles.border} bg-[var(--color-surface-1)] p-3 flex items-start gap-3 transition-colors hover:bg-[var(--color-surface-2)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]`}
    >
      <div className={`shrink-0 w-9 h-9 rounded-full ${styles.badgeBg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${styles.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${styles.badgeBg} ${styles.badgeFg}`}>
            {SEVERITY_LABEL[a.severity]}
          </span>
          <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">{a.detector}</span>
          <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">·</span>
          <span className="text-[10px] text-[var(--color-fg-subtle)] tabular-nums">{dataLabel}</span>
          {a.affectedSaidaIds.length > 1 && (
            <>
              <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">·</span>
              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                {a.affectedSaidaIds.length} saídas afetadas
              </span>
            </>
          )}
        </div>
        <h4 className="text-sm font-semibold text-[var(--color-fg)] mt-0.5">{a.title}</h4>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{a.description}</p>
        {a.acaoSugerida && (
          <p className="text-[11px] text-[var(--color-fg-subtle)] mt-1.5 italic">
            ↳ {a.acaoSugerida}
          </p>
        )}
      </div>
    </button>
  );
}
