import { useState, useEffect, useRef } from 'react';

interface FilterComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}

export default function FilterCombobox({
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: FilterComboboxProps) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selecionado = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtrados = options.filter((o) =>
    o.label.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
        placeholder={placeholder}
        value={aberto ? busca : (selecionado?.label ?? '')}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); setBusca(''); }}
        autoComplete="off"
      />
      {value && !aberto && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          onClick={() => { onChange(''); setBusca(''); }}
          title="Limpar"
        >
          ✕
        </button>
      )}
      {aberto && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          <li
            className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${!value ? 'bg-green-100 font-medium' : 'text-gray-400'}`}
            onMouseDown={() => { onChange(''); setAberto(false); setBusca(''); }}
          >
            {placeholder}
          </li>
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</li>
          ) : (
            filtrados.map((o) => (
              <li
                key={o.value}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${o.value === value ? 'bg-green-100 font-medium' : ''}`}
                onMouseDown={() => { onChange(o.value); setAberto(false); setBusca(''); }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
