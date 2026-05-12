// Marco 1 / PR8 — Timeline do equipamento.
//
// Lista cronológica (mais recente primeiro) de eventos que tocaram o
// equipamento: status, abastecimento, apontamento, leitura manual, documento.
// Filtros por tipo + paginação simples (mostra 30, "ver mais" pra +30).

import { useState, useMemo } from 'react';
import {
  Activity, Fuel, Clock, Gauge, FileText, History, X,
} from 'lucide-react';
import { useHistoricoEquipamento, type TipoEventoHistorico } from '../../../hooks/useHistoricoEquipamento';
import Button from '../../ui/Button';

interface Props {
  equipamentoId: string;
}

const FILTROS: { value: TipoEventoHistorico | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'status', label: 'Status' },
  { value: 'abastecimento', label: 'Abastecimentos' },
  { value: 'apontamento', label: 'Horas' },
  { value: 'medicao', label: 'Leituras' },
  { value: 'documento', label: 'Documentos' },
];

const ICONES: Record<TipoEventoHistorico, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  status: Activity,
  abastecimento: Fuel,
  apontamento: Clock,
  medicao: Gauge,
  documento: FileText,
};

const CORES: Record<TipoEventoHistorico, { dot: string; bg: string }> = {
  status: { dot: 'bg-amber-500', bg: 'bg-amber-500/15' },
  abastecimento: { dot: 'bg-sky-500', bg: 'bg-sky-500/15' },
  apontamento: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/15' },
  medicao: { dot: 'bg-violet-500', bg: 'bg-violet-500/15' },
  documento: { dot: 'bg-rose-500', bg: 'bg-rose-500/15' },
};

const PAGE_SIZE = 30;

function fmtDataHora(s: string): { dia: string; hora: string } {
  if (!s) return { dia: '—', hora: '' };
  const d = new Date(s);
  if (isNaN(d.getTime())) return { dia: s.slice(0, 10), hora: '' };
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { dia, hora };
}

export default function HistoricoEquipamentoSection({ equipamentoId }: Props) {
  const { data: eventos = [], isLoading } = useHistoricoEquipamento(equipamentoId);
  const [filtro, setFiltro] = useState<TipoEventoHistorico | 'todos'>('todos');
  const [mostrar, setMostrar] = useState(PAGE_SIZE);

  const filtrados = useMemo(
    () => (filtro === 'todos' ? eventos : eventos.filter((e) => e.tipo === filtro)),
    [eventos, filtro]
  );

  const visiveis = filtrados.slice(0, mostrar);
  const temMais = filtrados.length > mostrar;

  // Contagem por tipo (pra mostrar nos chips)
  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: eventos.length };
    for (const e of eventos) c[e.tipo] = (c[e.tipo] ?? 0) + 1;
    return c;
  }, [eventos]);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Histórico
          {eventos.length > 0 && (
            <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">
              ({eventos.length})
            </span>
          )}
        </h3>
        {filtro !== 'todos' && (
          <button
            type="button"
            onClick={() => setFiltro('todos')}
            className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] inline-flex items-center gap-1"
          >
            <X aria-hidden className="w-3 h-3" />
            limpar filtro
          </button>
        )}
      </div>

      {/* Chips de filtro */}
      {eventos.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {FILTROS.map((f) => {
            const ativo = filtro === f.value;
            const qtd = contagem[f.value] ?? 0;
            if (f.value !== 'todos' && qtd === 0) return null;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => { setFiltro(f.value); setMostrar(PAGE_SIZE); }}
                className={
                  'text-xs px-2.5 py-1 rounded-full border transition-colors ' +
                  (ativo
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]')
                }
              >
                {f.label} <span className="opacity-70">({qtd})</span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-2">Carregando histórico…</p>
      ) : eventos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center">
          <History aria-hidden className="w-6 h-6 text-[var(--color-fg-subtle)] mx-auto mb-1.5" />
          <p className="text-sm text-[var(--color-fg-muted)]">
            Sem histórico ainda. Conforme abastecimentos, apontamentos de horas e mudanças de status forem registrados, eles aparecerão aqui.
          </p>
        </div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhum evento do tipo selecionado.
          </p>
        </div>
      ) : (
        <ul className="relative space-y-2">
          {/* Linha vertical da timeline */}
          <span aria-hidden className="absolute left-3.5 top-2 bottom-2 w-px bg-[var(--color-border)]" />
          {visiveis.map((e) => {
            const Icon = ICONES[e.tipo];
            const cor = CORES[e.tipo];
            const { dia, hora } = fmtDataHora(e.data);
            return (
              <li key={e.id} className="relative pl-10">
                {/* Ponto + ícone */}
                <span
                  aria-hidden
                  className={
                    'absolute left-0 top-1.5 w-7 h-7 rounded-full inline-flex items-center justify-center ' +
                    cor.bg
                  }
                >
                  <Icon className="w-3.5 h-3.5 text-[var(--color-fg)]" />
                </span>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--color-fg)]">
                        {e.titulo}
                      </div>
                      {e.descricao && (
                        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                          {e.descricao}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                        <span>{dia}</span>
                        {hora && <span>· {hora}</span>}
                        {e.autor && <span>· {e.autor}</span>}
                      </div>
                    </div>
                    {e.valor && (
                      <div className="text-sm font-mono font-medium text-[var(--color-fg)] shrink-0">
                        {e.valor}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {temMais && (
        <div className="flex justify-center mt-3">
          <Button variant="secondary" size="sm" onClick={() => setMostrar(mostrar + PAGE_SIZE)}>
            Ver mais {Math.min(PAGE_SIZE, filtrados.length - mostrar)} eventos
          </Button>
        </div>
      )}
    </section>
  );
}
