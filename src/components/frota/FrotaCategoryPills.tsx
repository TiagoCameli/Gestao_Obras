import type { Equipamento, TipoEquipamento } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';

interface FrotaCategoryPillsProps {
  equipamentos: Equipamento[];
  categoriaFiltro: TipoEquipamento | '';
  onSelect: (tipo: TipoEquipamento | '') => void;
}

export default function FrotaCategoryPills({ equipamentos, categoriaFiltro, onSelect }: FrotaCategoryPillsProps) {
  const contagem = new Map<TipoEquipamento, number>();
  for (const eq of equipamentos) {
    if (eq.tipo) {
      contagem.set(eq.tipo, (contagem.get(eq.tipo) ?? 0) + 1);
    }
  }

  const tipos = Array.from(contagem.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect('')}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          categoriaFiltro === ''
            ? 'bg-emt-verde text-white'
            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
        }`}
      >
        Todos ({equipamentos.length})
      </button>
      {tipos.map(([tipo, count]) => {
        const cat = getCategoriaFrota(tipo);
        const ativo = categoriaFiltro === tipo;
        return (
          <button
            key={tipo}
            onClick={() => onSelect(tipo)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
              ativo
                ? `${cat.cor} text-white`
                : `${cat.corBg} ${cat.corTexto} hover:opacity-80`
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${ativo ? 'bg-white' : cat.cor}`} />
            {cat.label} ({count})
          </button>
        );
      })}
    </div>
  );
}
