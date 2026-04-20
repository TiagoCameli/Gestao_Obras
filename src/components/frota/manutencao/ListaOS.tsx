import { useState, useMemo } from 'react';
import type { OrdemServico, Equipamento, StatusOS, TipoOS } from '../../../types';
import { getCorStatus, getCorPrioridade, labelStatus, labelPrioridade } from '../../../utils/manutencao';

interface Props {
  ordensServico: OrdemServico[];
  equipamentos: Equipamento[];
  onSelect: (os: OrdemServico) => void;
  onNovaOS: () => void;
  canCreate: boolean;
}

export default function ListaOS({ ordensServico, equipamentos, onSelect, onNovaOS, canCreate }: Props) {
  const [filtroStatus, setFiltroStatus] = useState<StatusOS | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<TipoOS | ''>('');
  const [filtroEquipamento, setFiltroEquipamento] = useState('');
  const [busca, setBusca] = useState('');

  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e.nome])), [equipamentos]);

  const osFiltradas = useMemo(() => {
    let lista = ordensServico;
    if (filtroStatus) lista = lista.filter((os) => os.status === filtroStatus);
    if (filtroTipo) lista = lista.filter((os) => os.tipo === filtroTipo);
    if (filtroEquipamento) lista = lista.filter((os) => os.equipamentoId === filtroEquipamento);
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      lista = lista.filter(
        (os) =>
          os.numero.toLowerCase().includes(termo) ||
          os.descricao.toLowerCase().includes(termo) ||
          os.responsavel.toLowerCase().includes(termo),
      );
    }
    return lista;
  }, [ordensServico, filtroStatus, filtroTipo, filtroEquipamento, busca]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="Buscar OS..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusOS | '')}
          className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="aguardando_peca">Aguardando Peça</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as TipoOS | '')}
          className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
        >
          <option value="">Todos os tipos</option>
          <option value="corretiva">Corretiva</option>
          <option value="preventiva">Preventiva</option>
        </select>
        <select
          value={filtroEquipamento}
          onChange={(e) => setFiltroEquipamento(e.target.value)}
          className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
        >
          <option value="">Todos os equipamentos</option>
          {equipamentos.map((eq) => (
            <option key={eq.id} value={eq.id}>{eq.nome}</option>
          ))}
        </select>
        {canCreate && (
          <button
            onClick={onNovaOS}
            className="h-[44px] bg-emt-verde text-white rounded-lg px-4 text-sm font-medium hover:bg-emt-verde-escuro transition-colors"
          >
            + Nova OS
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-emt-verde text-white">
              <th className="px-4 py-3 text-left font-semibold">Número</th>
              <th className="px-4 py-3 text-left font-semibold">Equipamento</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Prioridade</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {osFiltradas.map((os, i) => (
              <tr
                key={os.id}
                onClick={() => onSelect(os)}
                className={`cursor-pointer transition-colors hover:bg-emt-verde/5 dark:hover:bg-slate-700 ${
                  i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-slate-400">{os.numero}</td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">
                  {equipMap.get(os.equipamentoId) ?? os.equipamentoId}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 capitalize">{os.tipo}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCorPrioridade(os.prioridade)}`}>
                    {labelPrioridade(os.prioridade)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCorStatus(os.status)}`}>
                    {labelStatus(os.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                  {os.dataAbertura ? new Date(os.dataAbertura).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 hidden md:table-cell">
                  {os.responsavel || '—'}
                </td>
              </tr>
            ))}
            {osFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                  Nenhuma ordem de serviço encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
