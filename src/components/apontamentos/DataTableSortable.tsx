import { useState } from 'react';
import { SortAscIcon, SortDescIcon } from './icons';
import EmptyState from './EmptyState';

type SortDirection = 'asc' | 'desc' | null;

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableSortableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  totalsRow?: Record<string, string | number | React.ReactNode>;
  emptyMessage?: string;
  headerBgClass?: string;
  headerTextClass?: string;
  title?: string;
  onRowClick?: (row: T) => void;
}

export default function DataTableSortable<T>({
  columns,
  data,
  totalsRow,
  emptyMessage,
  headerBgClass = 'bg-[var(--color-surface-2)]',
  headerTextClass = 'text-[var(--color-fg-muted)]',
  title,
  onRowClick,
}: DataTableSortableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: '', direction: null });

  function handleSort(key: string) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: null };
    });
  }

  const sorted = (() => {
    if (!sort.key || !sort.direction) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sort.direction === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sort.direction === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  })();

  if (data.length === 0) {
    return (
      <div className="surface-raised overflow-hidden">
        {title && (
          <div className={`px-4 py-2.5 border-b border-[var(--color-border)] ${headerBgClass}`}>
            <h3 className={`text-sm font-semibold ${headerTextClass}`}>{title}</h3>
          </div>
        )}
        <EmptyState type="registros" message={emptyMessage} />
      </div>
    );
  }

  const alignClass = (align?: string) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="surface-raised overflow-hidden">
      {title && (
        <div className={`px-4 py-2.5 border-b border-[var(--color-border)] ${headerBgClass}`}>
          <h3 className={`text-sm font-semibold ${headerTextClass}`}>{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm" role="table">
          <thead>
            <tr className={`border-b border-[var(--color-border)] ${headerBgClass} ${headerTextClass} text-xs uppercase tracking-wider`}>
              {columns.map((col) => {
                const sortable = col.sortable !== false;
                const isActive = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`${alignClass(col.align)} px-4 py-2 ${col.className || ''} ${sortable ? 'cursor-pointer select-none hover:bg-black/5' : ''}`}
                    onClick={sortable ? () => handleSort(col.key) : undefined}
                    aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sortable && isActive && (
                        sort.direction === 'asc' ? <SortAscIcon className="w-3 h-3" /> : <SortDescIcon className="w-3 h-3" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {sorted.map((row, i) => (
              <tr
                key={i}
                role="row"
                className={`hover:bg-[var(--color-surface-2)] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} role="cell" className={`${alignClass(col.align)} px-4 py-2 ${col.className || ''}`}>
                    {col.render ? col.render(row) : col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totalsRow && (
            <tfoot className="border-t-2 border-[var(--color-border-strong)]">
              <tr className="bg-[var(--color-surface-2)] font-semibold text-[var(--color-fg)]">
                {columns.map((col) => (
                  <td key={col.key} className={`${alignClass(col.align)} px-4 py-2 ${col.className || ''}`}>
                    {totalsRow[col.key] ?? ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
