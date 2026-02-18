import type { FiltrosAbastecimento, Obra } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import Select from '../ui/Select';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface FiltersProps {
  filtros: FiltrosAbastecimento;
  onChange: (filtros: FiltrosAbastecimento) => void;
  onClear: () => void;
  obras: Obra[];
}

export default function AbastecimentoFilters({
  filtros,
  onChange,
  onClear,
  obras,
}: FiltersProps) {
  const { data: insumosData } = useInsumos();
  const insumosCombustivel = (insumosData ?? []).filter((i) => i.tipo === 'combustivel');

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
          id="filtro-obra"
          value={filtros.obraId}
          onChange={(e) => onChange({ ...filtros, obraId: e.target.value })}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Todas"
        />
        <Select
          label="Combustível"
          id="filtro-combustivel"
          value={filtros.tipoCombustivel}
          onChange={(e) =>
            onChange({ ...filtros, tipoCombustivel: e.target.value })
          }
          options={insumosCombustivel.map((i) => ({ value: i.id, label: i.nome }))}
          placeholder="Todos"
        />
        <Input
          label="Data Início"
          id="filtro-inicio"
          type="date"
          value={filtros.dataInicio}
          onChange={(e) => onChange({ ...filtros, dataInicio: e.target.value })}
        />
        <Input
          label="Data Fim"
          id="filtro-fim"
          type="date"
          value={filtros.dataFim}
          onChange={(e) => onChange({ ...filtros, dataFim: e.target.value })}
        />
      </div>
    </div>
  );
}
