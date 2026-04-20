import type { Equipamento, Empresa, TipoEquipamento } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';

interface FrotaGridProps {
  equipamentos: Equipamento[];
  empresas: Empresa[];
  categoriaFiltro: TipoEquipamento | '';
  onSelect: (equipamento: Equipamento) => void;
  alertasMap?: Map<string, number>;
}

function EquipamentoCard({ eq, empresaNome, alertas, onClick }: { eq: Equipamento; empresaNome: string; alertas: number; onClick: () => void }) {
  const cat = getCategoriaFrota(eq.tipo);

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md transition-shadow p-4 text-left w-full border border-gray-100 dark:border-slate-700"
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cat.corBg} ${cat.corTexto}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cat.cor}`} />
          {cat.codigo}
        </span>
        <div className="flex items-center gap-1.5">
          {alertas > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" title={`${alertas} alerta(s) de manutenção`}>
              {alertas}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            eq.ativo
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          }`}>
            {eq.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>
      <h3 className="font-semibold text-gray-800 dark:text-slate-200 truncate">{eq.nome}</h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
        {[eq.marca, eq.ano].filter(Boolean).join(' · ') || '—'}
      </p>
      {eq.codigoPatrimonio && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          Patrimônio: {eq.codigoPatrimonio}
        </p>
      )}
      {empresaNome && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 truncate">
          {empresaNome}
        </p>
      )}
    </button>
  );
}

export default function FrotaGrid({ equipamentos, empresas, categoriaFiltro, onSelect, alertasMap = new Map() }: FrotaGridProps) {
  const empresaMap = new Map(empresas.map((e) => [e.id, e.nome]));

  if (categoriaFiltro) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {equipamentos.map((eq) => (
          <EquipamentoCard
            key={eq.id}
            eq={eq}
            empresaNome={empresaMap.get(eq.empresaId) ?? ''}
            alertas={alertasMap.get(eq.id) ?? 0}
            onClick={() => onSelect(eq)}
          />
        ))}
      </div>
    );
  }

  // Group by category when no filter
  const grupos = new Map<string, Equipamento[]>();
  for (const eq of equipamentos) {
    const key = eq.tipo || 'Outros';
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(eq);
  }

  const gruposOrdenados = Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-6">
      {gruposOrdenados.map(([tipo, eqs]) => {
        const cat = getCategoriaFrota(tipo as Equipamento['tipo']);
        return (
          <div key={tipo}>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${cat.cor}`} />
              {cat.label} ({eqs.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {eqs.map((eq) => (
                <EquipamentoCard
                  key={eq.id}
                  eq={eq}
                  empresaNome={empresaMap.get(eq.empresaId) ?? ''}
                  alertas={alertasMap.get(eq.id) ?? 0}
                  onClick={() => onSelect(eq)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
