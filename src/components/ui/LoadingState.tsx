/**
 * LoadingState — wrapper de presets sobre `ui/Skeleton`. Substitui
 * `<p>Carregando…</p>` em código novo.
 *
 * Modos:
 *   - `list`       : 5 cards com avatar + 2 linhas (lista de pessoas/itens)
 *   - `table`      : N linhas com M colunas de skeleton
 *   - `dashboard`  : 3 hero KPIs + 8 compact KPIs + 1 chart placeholder
 *   - `cards`      : grid de N skeleton cards
 *   - `inline`     : spinner + texto (fallback pra contextos pequenos)
 *
 * Uso:
 *   {isLoading ? <LoadingState mode="dashboard" /> : <DashboardContent />}
 *   {isLoading ? <LoadingState mode="table" rows={8} cols={6} /> : <Table />}
 */
import Skeleton, { SkeletonCard, SkeletonTableRow } from './Skeleton';
import Spinner from './Spinner';

interface BaseProps {
  className?: string;
}

interface ListProps extends BaseProps { mode: 'list'; count?: number; }
interface TableProps extends BaseProps { mode: 'table'; rows?: number; cols?: number; }
interface DashboardProps extends BaseProps { mode: 'dashboard'; }
interface CardsProps extends BaseProps { mode: 'cards'; count?: number; cols?: number; }
interface InlineProps extends BaseProps { mode: 'inline'; label?: string; }

type Props = ListProps | TableProps | DashboardProps | CardsProps | InlineProps;

export default function LoadingState(props: Props) {
  if (props.mode === 'list') {
    const count = props.count ?? 5;
    return (
      <div className={'space-y-2 ' + (props.className ?? '')} aria-busy="true" aria-live="polite">
        {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (props.mode === 'table') {
    const rows = props.rows ?? 8;
    const cols = props.cols ?? 6;
    return (
      <div className={'surface-raised overflow-hidden ' + (props.className ?? '')} aria-busy="true" aria-live="polite">
        <table className="w-full">
          <thead className="bg-[var(--color-surface-2)]">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-3 py-2.5">
                  <Skeleton width="60%" height="0.625rem" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonTableRow key={i} columns={cols} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (props.mode === 'dashboard') {
    return (
      <div className={'space-y-5 ' + (props.className ?? '')} aria-busy="true" aria-live="polite">
        {/* Hero KPIs — 3 grandes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="7rem" rounded="0.75rem" />
          ))}
        </div>
        {/* Compact KPIs — 8 menores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height="5rem" rounded="0.75rem" />
          ))}
        </div>
        {/* Chart card */}
        <Skeleton height="20rem" rounded="0.75rem" />
      </div>
    );
  }

  if (props.mode === 'cards') {
    const count = props.count ?? 6;
    const cols = props.cols ?? 3;
    const gridClass = `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${cols} gap-3 ` + (props.className ?? '');
    return (
      <div className={gridClass} aria-busy="true" aria-live="polite">
        {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // inline
  return (
    <div
      className={'flex items-center justify-center gap-2 py-6 ' + (props.className ?? '')}
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size="sm" />
      <span className="text-sm text-[var(--color-fg-muted)]">{props.label ?? 'Carregando…'}</span>
    </div>
  );
}
