import { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.id === value)?.label || '';

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightIdx >= 0 && highlightIdx < filtered.length) {
      e.preventDefault(); onChange(filtered[highlightIdx].id); setOpen(false); setSearch('');
    }
  }

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-label={placeholder}
        aria-expanded={open}
        className={`w-full h-[44px] border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emt-verde ${
          disabled ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed border-gray-200 dark:border-slate-600' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 cursor-pointer'
        }`}
        onClick={() => { if (!disabled) { setOpen(!open); setSearch(''); } }}
        disabled={disabled}
      >
        <span className={selectedLabel ? 'text-gray-800 dark:text-slate-200' : 'text-gray-400 dark:text-slate-500'}>
          {selectedLabel || placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b dark:border-slate-600">
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-44" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500 italic">Nenhum resultado</p>
            ) : (
              filtered.map((o, idx) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 ${idx === highlightIdx ? 'bg-gray-100 dark:bg-slate-700' : ''} ${o.id === value ? 'bg-emt-verde/10 text-emt-verde font-medium' : 'text-gray-700 dark:text-slate-200'}`}
                  onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
