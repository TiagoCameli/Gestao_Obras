import { useState, useMemo } from 'react';
import type { AbastecimentoCarreta, Insumo } from '../../types';
import Button from '../ui/Button';

interface AbastecimentoCarretaListProps {
  abastecimentos: AbastecimentoCarreta[];
  combustiveis: Insumo[];
  filtroTransportadora: string;
  onEdit: (abast: AbastecimentoCarreta) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function AbastecimentoCarretaList({
  abastecimentos,
  combustiveis,
  filtroTransportadora,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: AbastecimentoCarretaListProps) {
  const [pagina, setPagina] = useState(0);
  const porPagina = 15;

  const combustiveisMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);

  const filtrados = useMemo(() => {
    return abastecimentos
      .filter((a) => {
        if (filtroTransportadora) {
          const q = filtroTransportadora.toLowerCase();
          if (!a.transportadora.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [abastecimentos, filtroTransportadora]);

  useMemo(() => setPagina(0), [filtroTransportadora]);

  const totalPaginas = Math.ceil(filtrados.length / porPagina);
  const paginados = filtrados.slice(pagina * porPagina, (pagina + 1) * porPagina);

  const totalGeral = filtrados.reduce((sum, a) => sum + a.valorTotal, 0);

  if (filtrados.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhum abastecimento de carreta encontrado.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-emt-verde text-white">
              <tr>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Data</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Transportadora</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Placa</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Combustivel</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Litros</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Valor Unit.</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Total</th>
                <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-emt-cinza-claro">
              {paginados.map((abast) => (
                <tr key={abast.id} className="hover:bg-emt-verde-claro">
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                    {abast.data ? new Date(abast.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{abast.transportadora}</td>
                  <td className="px-4 py-3 text-gray-800 font-mono">{abast.placaCarreta}</td>
                  <td className="px-4 py-3 text-gray-600">{combustiveisMap.get(abast.tipoCombustivel) || abast.tipoCombustivel || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{abast.quantidadeLitros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {abast.valorUnidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emt-verde whitespace-nowrap">
                    {abast.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {canEdit && (
                        <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onEdit(abast)}>
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(abast.id)}
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={6} className="px-4 py-3 text-right text-gray-700">
                  Total ({filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}):
                </td>
                <td className="px-4 py-3 text-right text-emt-verde whitespace-nowrap">
                  {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {filtrados.length} abastecimento{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
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
  );
}
