import { useState, useMemo } from 'react';
import type { HistoricoInspecao, Equipamento } from '../../../types';
import Button from '../../ui/Button';

interface Props {
  registros: HistoricoInspecao[];
  equipamentos: Equipamento[];
  onNovoRegistro: () => void;
  onExcluir: (id: string) => void;
  canCreate: boolean;
}

export default function ListaHistoricoInspecao({ registros, equipamentos, onNovoRegistro, onExcluir, canCreate }: Props) {
  const [filtroEquip, setFiltroEquip] = useState('');

  const equipMap = useMemo(() => {
    const m = new Map<string, Equipamento>();
    for (const e of equipamentos) m.set(e.id, e);
    return m;
  }, [equipamentos]);

  const filtrados = useMemo(() => {
    if (!filtroEquip) return registros;
    return registros.filter((r) => r.equipamentoId === filtroEquip);
  }, [registros, filtroEquip]);

  // Agrupar por equipamento
  const agrupados = useMemo(() => {
    const map = new Map<string, HistoricoInspecao[]>();
    for (const r of filtrados) {
      const arr = map.get(r.equipamentoId) ?? [];
      arr.push(r);
      map.set(r.equipamentoId, arr);
    }
    return map;
  }, [filtrados]);

  const inputClass = 'w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white dark:bg-slate-700 dark:text-slate-200';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="w-full sm:w-64">
          <select value={filtroEquip} onChange={(e) => setFiltroEquip(e.target.value)} className={inputClass}>
            <option value="">Todos os equipamentos</option>
            {equipamentos
              .filter((e) => e.ativo)
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
          </select>
        </div>
        {canCreate && (
          <Button onClick={onNovoRegistro} className="text-sm">
            + Nova Inspeção
          </Button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          Nenhum registro de inspeção encontrado.
        </div>
      ) : (
        <div className="space-y-6">
          {[...agrupados.entries()].map(([equipId, regs]) => {
            const eq = equipMap.get(equipId);
            return (
              <div key={equipId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                    {eq?.nome ?? 'Equipamento removido'}
                  </h3>
                  {eq?.codigoPatrimonio && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">({eq.codigoPatrimonio})</span>
                  )}
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300 w-28">Data</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300 w-20">Horário</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">Descrição da Não Conformidade</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">Providência Tomada</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300 w-28">Operador</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300 w-28">Encarregado</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300 w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {regs.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                            {r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{r.horario || '-'}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300 max-w-xs">
                            <p className="line-clamp-2">{r.descricao || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300 max-w-xs">
                            <p className="line-clamp-2">{r.providencia || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{r.operador || '-'}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{r.encarregado || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => { if (confirm('Excluir este registro?')) onExcluir(r.id); }}
                              className="text-red-500 hover:underline text-sm"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
