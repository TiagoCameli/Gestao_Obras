import { useState, useMemo } from 'react';
import type { Frete, Obra, Insumo } from '../../types';
import Button from '../ui/Button';

interface FreteListProps {
  fretes: Frete[];
  obras: Obra[];
  insumos: Insumo[];
  filtros: { obraId: string; transportadora: string; motorista: string; dataInicio: string; dataFim: string };
  onEdit: (frete: Frete) => void;
  onDelete: (id: string) => void;
  onUpdateDataChegada?: (frete: Frete, dataChegada: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function FreteList({
  fretes,
  obras,
  insumos,
  filtros,
  onEdit,
  onDelete,
  onUpdateDataChegada,
  canEdit = true,
  canDelete = true,
}: FreteListProps) {
  const [pagina, setPagina] = useState(0);
  const porPagina = 15;

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);

  const filtrados = useMemo(() => {
    return fretes
      .filter((f) => {
        if (filtros.obraId && f.obraId !== filtros.obraId) return false;
        if (filtros.transportadora && f.transportadora !== filtros.transportadora) return false;
        if (filtros.motorista) {
          const q = filtros.motorista.toLowerCase();
          if (!f.motorista?.toLowerCase().includes(q)) return false;
        }
        if (filtros.dataInicio && f.data < filtros.dataInicio) return false;
        if (filtros.dataFim && f.data > filtros.dataFim) return false;
        return true;
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [fretes, filtros]);

  // Reset page when filters change
  useMemo(() => setPagina(0), [filtros]);

  const totalPaginas = Math.ceil(filtrados.length / porPagina);
  const paginados = filtrados.slice(pagina * porPagina, (pagina + 1) * porPagina);

  const totalGeral = filtrados.reduce((sum, f) => sum + f.valorTotal, 0);

  if (filtrados.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhum frete encontrado.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-emt-verde text-white">
              <tr>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Data de Saida</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Data de Chegada</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Origem → Destino</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Transportadora</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Motorista</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Placa</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Material</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Peso (t)</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">KM</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">R$/TKM</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Total</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Obra</th>
                <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-emt-cinza-claro">
              {paginados.map((frete) => (
                <tr key={frete.id} className="hover:bg-emt-verde-claro">
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                    {frete.data ? new Date(frete.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-1 whitespace-nowrap">
                    {onUpdateDataChegada ? (
                      <input
                        type="date"
                        className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emt-verde w-[130px]"
                        value={frete.dataChegada || ''}
                        onChange={(e) => onUpdateDataChegada(frete, e.target.value)}
                      />
                    ) : (
                      <span className="text-gray-800">
                        {frete.dataChegada ? new Date(frete.dataChegada + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {frete.origem} → {frete.destino}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{frete.transportadora}</td>
                  <td className="px-4 py-3 text-gray-800">{frete.motorista || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{frete.placaCarreta || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{insumosMap.get(frete.insumoId) || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{frete.pesoToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{frete.kmRodados.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{frete.valorTkm.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emt-verde whitespace-nowrap">
                    {frete.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{obrasMap.get(frete.obraId) || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {canEdit && (
                        <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onEdit(frete)}>
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(frete.id)}
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
                <td colSpan={10} className="px-4 py-3 text-right text-gray-700">
                  Total ({filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}):
                </td>
                <td className="px-4 py-3 text-right text-emt-verde whitespace-nowrap">
                  {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {filtrados.length} frete{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
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
