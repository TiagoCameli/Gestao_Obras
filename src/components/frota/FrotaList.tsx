import type { Equipamento, Empresa } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';

interface FrotaListProps {
  equipamentos: Equipamento[];
  empresas: Empresa[];
  onSelect: (equipamento: Equipamento) => void;
  alertasMap?: Map<string, number>;
}

export default function FrotaList({ equipamentos, empresas, onSelect, alertasMap = new Map() }: FrotaListProps) {
  const empresaMap = new Map(empresas.map((e) => [e.id, e.nome]));

  return (
    <div className="overflow-x-auto rounded-lg shadow">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-emt-verde text-white">
            <th className="px-4 py-3 text-left font-semibold">Patrimônio</th>
            <th className="px-4 py-3 text-left font-semibold">Nome</th>
            <th className="px-4 py-3 text-left font-semibold">Tipo</th>
            <th className="px-4 py-3 text-left font-semibold">Marca</th>
            <th className="px-4 py-3 text-left font-semibold">Ano</th>
            <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">N. Série</th>
            <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Empresa</th>
            <th className="px-4 py-3 text-center font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {equipamentos.map((eq, i) => {
            const cat = getCategoriaFrota(eq.tipo);
            const alertas = alertasMap.get(eq.id) ?? 0;
            return (
              <tr
                key={eq.id}
                onClick={() => onSelect(eq)}
                className={`cursor-pointer transition-colors hover:bg-emt-verde/5 dark:hover:bg-slate-700 ${
                  i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'
                }`}
              >
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 font-mono text-xs">
                  {eq.codigoPatrimonio || '—'}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    {eq.nome}
                    {alertas > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" title={`${alertas} alerta(s) de manutenção`}>
                        {alertas}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cat.corBg} ${cat.corTexto}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cat.cor}`} />
                    {cat.codigo}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{eq.marca || '—'}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{eq.ano || '—'}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 hidden lg:table-cell font-mono text-xs">
                  {eq.numeroSerie || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 hidden md:table-cell">
                  {empresaMap.get(eq.empresaId) || '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    eq.ativo
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  }`}>
                    {eq.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
              </tr>
            );
          })}
          {equipamentos.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                Nenhum equipamento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
