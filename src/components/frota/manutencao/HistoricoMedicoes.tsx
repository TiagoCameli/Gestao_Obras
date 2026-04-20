import { useState, useMemo } from 'react';
import type { HistoricoMedicao, Equipamento } from '../../../types';

interface Props {
  medicoes: HistoricoMedicao[];
  equipamentos: Equipamento[];
  onNovaMedicao: () => void;
}

const tipoLabel: Record<string, string> = {
  horimetro: 'Horímetro',
  odometro: 'Odômetro',
  km: 'Quilometragem',
};

export default function HistoricoMedicoes({ medicoes, equipamentos, onNovaMedicao }: Props) {
  const [filtroEquipamento, setFiltroEquipamento] = useState('');
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e.nome])), [equipamentos]);

  const medicoesFiltradas = useMemo(() => {
    if (!filtroEquipamento) return medicoes;
    return medicoes.filter((m) => m.equipamentoId === filtroEquipamento);
  }, [medicoes, filtroEquipamento]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <select
          value={filtroEquipamento}
          onChange={(e) => setFiltroEquipamento(e.target.value)}
          className="w-full sm:w-64 h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
        >
          <option value="">Todos os equipamentos</option>
          {equipamentos.map((eq) => (
            <option key={eq.id} value={eq.id}>{eq.nome}</option>
          ))}
        </select>
        <button
          onClick={onNovaMedicao}
          className="h-[44px] bg-emt-verde text-white rounded-lg px-4 text-sm font-medium hover:bg-emt-verde-escuro transition-colors shrink-0"
        >
          + Nova Medição
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-emt-verde text-white">
              <th className="px-4 py-3 text-left font-semibold">Equipamento</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Observações</th>
            </tr>
          </thead>
          <tbody>
            {medicoesFiltradas.map((m, i) => (
              <tr
                key={m.id}
                className={`${
                  i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'
                }`}
              >
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">
                  {equipMap.get(m.equipamentoId) ?? m.equipamentoId}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                  {tipoLabel[m.tipoMedicao] ?? m.tipoMedicao}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-slate-200">
                  {m.valor.toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                  {m.dataRegistro ? new Date(m.dataRegistro).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell truncate max-w-xs">
                  {m.observacoes || '—'}
                </td>
              </tr>
            ))}
            {medicoesFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                  Nenhuma medição registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
