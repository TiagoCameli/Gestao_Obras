import { useState, useMemo } from 'react';
import type { CargoFuncionario, Funcionario } from '../../types';
import { CARGOS } from '../../utils/permissions';
import Button from '../ui/Button';

interface FuncionarioListProps {
  funcionarios: Funcionario[];
  onEdit: (func: Funcionario) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function FuncionarioList({ funcionarios, onEdit, onDelete, canEdit = true, canDelete = true }: FuncionarioListProps) {
  const [busca, setBusca] = useState('');
  const [filtroCargo, setFiltroCargo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [pagina, setPagina] = useState(0);
  const porPagina = 10;

  const filtrados = useMemo(() => {
    return funcionarios.filter((f) => {
      if (busca) {
        const q = busca.toLowerCase();
        if (!f.nome.toLowerCase().includes(q) && !f.email.toLowerCase().includes(q)) return false;
      }
      if (filtroCargo && f.cargo !== filtroCargo) return false;
      if (filtroStatus && f.status !== filtroStatus) return false;
      return true;
    });
  }, [funcionarios, busca, filtroCargo, filtroStatus]);

  const totalPaginas = Math.ceil(filtrados.length / porPagina);
  const paginados = filtrados.slice(pagina * porPagina, (pagina + 1) * porPagina);

  const CARGO_COLORS: Record<CargoFuncionario, string> = {
    Administrador: 'bg-purple-100 text-purple-800',
    Gerente: 'bg-emt-verde-claro text-emt-verde-escuro',
    Supervisor: 'bg-cyan-100 text-cyan-800',
    Operador: 'bg-gray-100 text-gray-800',
    Financeiro: 'bg-amber-100 text-amber-800',
  };

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde w-64"
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          value={filtroCargo}
          onChange={(e) => { setFiltroCargo(e.target.value); setPagina(0); }}
        >
          <option value="">Todos os cargos</option>
          {CARGOS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          value={filtroStatus}
          onChange={(e) => { setFiltroStatus(e.target.value); setPagina(0); }}
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Nenhum funcionario encontrado.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-emt-verde text-white">
                  <tr>
                    <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Funcionario</th>
                    <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">E-mail</th>
                    <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Cargo</th>
                    <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">Status</th>
                    <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-emt-cinza-claro">
                  {paginados.map((func) => {
                    const iniciais = func.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
                    return (
                      <tr key={func.id} className="hover:bg-emt-verde-claro">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              func.status === 'ativo' ? 'bg-emt-verde-claro text-emt-verde' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {iniciais}
                            </div>
                            <span className="font-medium text-gray-800">{func.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{func.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CARGO_COLORS[func.cargo]}`}>
                            {func.cargo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            func.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {func.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            {canEdit && (
                              <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onEdit(func)}>
                                Editar
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                                onClick={() => onDelete(func.id)}
                              >
                                Excluir
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginacao */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                {filtrados.length} funcionario{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600 flex items-center px-2">
                  {pagina + 1} / {totalPaginas}
                </span>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={pagina >= totalPaginas - 1}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Proximo
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
