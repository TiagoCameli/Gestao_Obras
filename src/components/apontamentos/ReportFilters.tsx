import SearchableSelect from './SearchableSelect';
import MultiSearchableSelect from './MultiSearchableSelect';
import { FilterXIcon } from './icons';

interface ReportFiltersProps {
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (v: string) => void;
  onDataFimChange: (v: string) => void;
  obraIds: string[];
  onObraIdsChange: (ids: string[]) => void;
  obras: { id: string; label: string }[];
  etapaIds: string[];
  onEtapaIdsChange: (ids: string[]) => void;
  etapas: { id: string; label: string }[];
  entityValue?: string;
  onEntityChange?: (id: string) => void;
  entityOptions?: { id: string; label: string }[];
  entityPlaceholder?: string;
  entityLabel?: string;
  onClear: () => void;
}

export default function ReportFilters({
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  obraIds,
  onObraIdsChange,
  obras,
  etapaIds,
  onEtapaIdsChange,
  etapas,
  entityValue,
  onEntityChange,
  entityOptions,
  entityPlaceholder = 'Todos',
  entityLabel = 'Entidade',
  onClear,
}: ReportFiltersProps) {
  const hasFilters = obraIds.length > 0 || etapaIds.length > 0 || (entityValue !== undefined && entityValue !== '');

  return (
    <div className="flex flex-wrap gap-3 items-end mb-4">
      <div className="w-full sm:w-auto">
        <label className="block text-xs text-gray-500 mb-1">Data Inicial</label>
        <input
          type="date"
          className="h-[44px] border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          value={dataInicio}
          onChange={(e) => onDataInicioChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-auto">
        <label className="block text-xs text-gray-500 mb-1">Data Final</label>
        <input
          type="date"
          className="h-[44px] border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          value={dataFim}
          onChange={(e) => onDataFimChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-48">
        <label className="block text-xs text-gray-500 mb-1">Obras</label>
        <MultiSearchableSelect
          options={obras}
          value={obraIds}
          onChange={onObraIdsChange}
          placeholder="Todas"
        />
      </div>
      <div className="w-full sm:w-48">
        <label className="block text-xs text-gray-500 mb-1">Etapas</label>
        <MultiSearchableSelect
          options={etapas}
          value={etapaIds}
          onChange={onEtapaIdsChange}
          placeholder="Todas"
        />
      </div>
      {entityOptions && onEntityChange && (
        <div className="w-full sm:w-48">
          <label className="block text-xs text-gray-500 mb-1">{entityLabel}</label>
          <SearchableSelect
            options={entityOptions}
            value={entityValue || ''}
            onChange={onEntityChange}
            placeholder={entityPlaceholder}
          />
        </div>
      )}
      {hasFilters && (
        <button
          type="button"
          className="h-[44px] inline-flex items-center gap-1.5 px-3 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          onClick={onClear}
          title="Limpar filtros"
        >
          <FilterXIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Limpar</span>
        </button>
      )}
    </div>
  );
}
