import type { FiltrosInsumos, Insumo, Obra } from '../../types';
import Select from '../ui/Select';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface FiltersProps {
  filtros: FiltrosInsumos;
  onChange: (filtros: FiltrosInsumos) => void;
  onClear: () => void;
  obras: Obra[];
  insumos: Insumo[];
}

export default function InsumoFilters({
  filtros,
  onChange,
  onClear,
  obras,
  insumos,
}: FiltersProps) {
  const insumosMaterial = insumos.filter((i) => i.tipo === 'material');

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Filtros</h3>
        <Button variant="ghost" onClick={onClear} className="text-xs">
          Limpar filtros
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select
          label="Obra"
          id="filtro-obra-insumo"
          value={filtros.obraId}
          onChange={(e) => onChange({ ...filtros, obraId: e.target.value })}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Todas"
        />
        <Select
          label="Material"
          id="filtro-material"
          value={filtros.insumoId}
          onChange={(e) => onChange({ ...filtros, insumoId: e.target.value })}
          options={insumosMaterial.map((i) => ({ value: i.id, label: i.nome }))}
          placeholder="Todos"
        />
        <Input
          label="Data Inicio"
          id="filtro-inicio-insumo"
          type="date"
          value={filtros.dataInicio}
          onChange={(e) => onChange({ ...filtros, dataInicio: e.target.value })}
        />
        <Input
          label="Data Fim"
          id="filtro-fim-insumo"
          type="date"
          value={filtros.dataFim}
          onChange={(e) => onChange({ ...filtros, dataFim: e.target.value })}
        />
      </div>
    </div>
  );
}
