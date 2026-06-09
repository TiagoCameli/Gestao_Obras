import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldCheck, Search } from 'lucide-react';
import Card from '../../ui/Card';
import AnomaliaFreteDrawer from './AnomaliaFreteDrawer';
import {
  detectAnomaliasFrete, type AnomaliaFrete, type Severidade, type FreteDetectorId,
  SEVERITY_LABEL, FRETE_DETECTOR_LABEL,
} from './detect';
import type { Frete, PedidoMaterial, Fornecedor } from '../../../types';
import type { AnomaliaFreteCheck } from '../../../hooks/useAnomaliasFreteChecks';

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

interface Props {
  fretesNoPeriodo: Frete[];
  fretesTodos: Frete[];
  pedidos: PedidoMaterial[];
  fornecedores: Fornecedor[];
  insumoNome: Map<string, string>;
  fornecedorNome: Map<string, string>;
  hoje: string;
  onEditFrete: (f: Frete) => void;
  anomaliasChecks: Map<string, AnomaliaFreteCheck>;
  onMarcarVerificada: (anomaliaId: string) => void;
  onDesfazerVerificacao: (anomaliaId: string) => void;
}

const ALL_SEV: Severidade[] = ['critical', 'warning', 'info'];
const ALL_DET: FreteDetectorId[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

export default function AnomaliasFreteTab(props: Props) {
  const {
    fretesNoPeriodo, fretesTodos, pedidos, fornecedores, insumoNome, fornecedorNome, hoje,
    onEditFrete, anomaliasChecks, onMarcarVerificada, onDesfazerVerificacao,
  } = props;

  const anomalias = useMemo(
    () => detectAnomaliasFrete({ fretesNoPeriodo, fretesTodos, pedidos, fornecedores, insumoNome, fornecedorNome, hoje }),
    [fretesNoPeriodo, fretesTodos, pedidos, fornecedores, insumoNome, fornecedorNome, hoje],
  );

  const [sevFiltro, setSevFiltro] = useState<Severidade[]>([]);
  const [detFiltro, setDetFiltro] = useState<FreteDetectorId[]>([]);
  const [busca, setBusca] = useState('');
  const [mostrarVerificadas, setMostrarVerificadas] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visiveis = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return anomalias.filter((a) => {
      const verificada = anomaliasChecks.has(a.id);
      if (verificada && !mostrarVerificadas) return false;
      if (sevFiltro.length && !sevFiltro.includes(a.severity)) return false;
      if (detFiltro.length && !detFiltro.includes(a.detector)) return false;
      if (q && !`${a.title} ${a.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [anomalias, anomaliasChecks, mostrarVerificadas, sevFiltro, detFiltro, busca]);

  // Uma passada só: produz sevCounts, detCounts, verificadasCount, abertasCount.
  // Quando toggle OFF, exclui verificadas das contagens da sidebar (igual ao combustível).
  const counts = useMemo(() => {
    const sevCounts: Record<Severidade, number> = { critical: 0, warning: 0, info: 0 };
    const detCounts: Record<FreteDetectorId, number> = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0 };
    let verificadasCount = 0;
    for (const a of anomalias) {
      const isChecked = anomaliasChecks.has(a.id);
      if (isChecked) verificadasCount++;
      if (!mostrarVerificadas && isChecked) continue;
      sevCounts[a.severity]++;
      detCounts[a.detector]++;
    }
    return { sevCounts, detCounts, verificadasCount, abertasCount: anomalias.length - verificadasCount };
  }, [anomalias, anomaliasChecks, mostrarVerificadas]);

  // Auto-fechar drawer quando a anomalia selecionada sai da lista
  useEffect(() => {
    if (selectedId && !anomalias.some((a) => a.id === selectedId)) setSelectedId(null);
  }, [anomalias, selectedId]);

  const selected: AnomaliaFrete | null = anomalias.find((a) => a.id === selectedId) ?? null;

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  if (anomalias.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-[var(--color-success)]">
          <ShieldCheck className="w-5 h-5" />
          <p className="text-sm font-medium">Sem anomalias detectadas no período.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--color-fg-muted)]">
        {counts.abertasCount} anomalia(s) em aberto{counts.verificadasCount > 0 ? ` · ${counts.verificadasCount} verificada(s)` : ''}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <aside className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase text-[var(--color-fg-muted)] mb-1.5">Severidade</div>
            <div className="flex flex-col gap-1">
              {ALL_SEV.map((s) => {
                const n = counts.sevCounts[s];
                const on = sevFiltro.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggle(sevFiltro, s, setSevFiltro)}
                    className={`text-left text-sm px-2 py-1 rounded flex justify-between ${on ? 'bg-[var(--color-surface-2)] font-semibold' : 'hover:bg-[var(--color-surface-1)]'}`}>
                    <span>{SEVERITY_LABEL[s]}</span><span className="text-[var(--color-fg-muted)]">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-[var(--color-fg-muted)] mb-1.5">Tipo</div>
            <div className="flex flex-col gap-1">
              {ALL_DET.map((d) => {
                const n = counts.detCounts[d];
                const on = detFiltro.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggle(detFiltro, d, setDetFiltro)}
                    className={`text-left text-xs px-2 py-1 rounded flex justify-between gap-2 ${on ? 'bg-[var(--color-surface-2)] font-semibold' : 'hover:bg-[var(--color-surface-1)]'}`}>
                    <span>{d} · {FRETE_DETECTOR_LABEL[d]}</span><span className="text-[var(--color-fg-muted)]">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {counts.verificadasCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={mostrarVerificadas} onChange={(e) => setMostrarVerificadas(e.target.checked)} />
              Mostrar verificadas ({counts.verificadasCount})
            </label>
          )}
          {(sevFiltro.length > 0 || detFiltro.length > 0 || busca) ? (
            <button type="button" className="text-xs text-[var(--color-accent)]" onClick={() => { setSevFiltro([]); setDetFiltro([]); setBusca(''); }}>
              Limpar filtros
            </button>
          ) : null}
        </aside>

        <section className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[var(--color-fg-muted)]" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar anomalia..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface-1)]" />
          </div>
          {visiveis.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)] italic py-4">Nenhuma anomalia bate com os filtros atuais.</p>
          ) : visiveis.map((a) => {
            const st = SEVERITY_STYLES[a.severity];
            const I = st.icon;
            return (
              <button key={a.id} type="button" onClick={() => setSelectedId(a.id)}
                className={`w-full text-left rounded-lg border ${st.border} p-3 hover:bg-[var(--color-surface-1)] transition-colors`}>
                <div className="flex items-center gap-2 mb-1">
                  <I className={`w-4 h-4 ${st.iconColor}`} />
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${st.badgeBg} ${st.badgeFg}`}>{SEVERITY_LABEL[a.severity]}</span>
                  <span className="text-[10px] text-[var(--color-fg-muted)]">{a.detector} · {a.data}</span>
                  {anomaliasChecks.has(a.id) && <span className="text-[10px] text-[var(--color-success)]">✓ verificada</span>}
                </div>
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs text-[var(--color-fg-muted)]">{a.description}</div>
              </button>
            );
          })}
        </section>
      </div>

      <AnomaliaFreteDrawer
        anomalia={selected}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        fretesTodos={fretesTodos}
        insumoNome={insumoNome}
        onEditFrete={onEditFrete}
        verificada={selected ? anomaliasChecks.get(selected.id) ?? null : null}
        onMarcarVerificada={onMarcarVerificada}
        onDesfazerVerificacao={onDesfazerVerificacao}
      />
    </div>
  );
}
