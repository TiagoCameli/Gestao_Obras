import { useEffect, useMemo, useRef, useState } from 'react';

export default function MultiSearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Todos',
}: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  const selectedLabels = useMemo(() => {
    if (value.length === 0) return '';
    const map = new Map(options.map((o) => [o.id, o.label]));
    if (value.length <= 2) return value.map((id) => map.get(id) || id).join(', ');
    return `${value.length} selecionados`;
  }, [value, options]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={placeholder}
        aria-expanded={open}
        className="w-full h-[44px] border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between cursor-pointer"
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        <span className={selectedLabels ? 'text-gray-800 dark:text-slate-200 truncate' : 'text-gray-400 dark:text-slate-500'}>
          {selectedLabels || placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b dark:border-slate-600 flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {value.length > 0 && (
              <button type="button" className="text-xs text-red-500 hover:underline shrink-0" onClick={() => onChange([])}>Limpar</button>
            )}
          </div>
          <div className="overflow-y-auto max-h-48" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500 italic">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={value.includes(o.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 ${value.includes(o.id) ? 'bg-emt-verde/10' : ''}`}
                  onClick={() => toggle(o.id)}
                >
                  <span className={`w-4 h-4 border rounded shrink-0 flex items-center justify-center ${value.includes(o.id) ? 'bg-emt-verde border-emt-verde text-white' : 'border-gray-300 dark:border-slate-600'}`}>
                    {value.includes(o.id) && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  <span className="text-gray-700 dark:text-slate-200">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
