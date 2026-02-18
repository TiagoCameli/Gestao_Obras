import { useState, useMemo } from 'react';
import type { PagamentoFrete } from '../../types';
import Button from '../ui/Button';

const METODO_LABELS: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  combustivel: 'Combustível',
};

function formatMesRef(mesRef: string): string {
  if (!mesRef) return '-';
  const [ano, mes] = mesRef.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
}

interface PagamentoFreteListProps {
  pagamentos: PagamentoFrete[];
  filtroTransportadora: string;
  filtroMes: string;
  onEdit: (pagamento: PagamentoFrete) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function PagamentoFreteList({
  pagamentos,
  filtroTransportadora,
  filtroMes,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: PagamentoFreteListProps) {
  const [pagina, setPagina] = useState(0);
  const porPagina = 15;

  const filtrados = useMemo(() => {
    return pagamentos
      .filter((p) => {
        if (filtroTransportadora && p.transportadora !== filtroTransportadora) return false;
        if (filtroMes && p.mesReferencia !== filtroMes) return false;
        return true;
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [pagamentos, filtroTransportadora, filtroMes]);

  useMemo(() => setPagina(0), [filtroTransportadora, filtroMes]);

  const totalPaginas = Math.ceil(filtrados.length / porPagina);
  const paginados = filtrados.slice(pagina * porPagina, (pagina + 1) * porPagina);

  const totalGeral = filtrados.reduce((sum, p) => sum + p.valor, 0);

  if (filtrados.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Nenhum pagamento encontrado.</p>
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
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Mês Ref.</th>
                <th className="text-right px-4 py-3 text-white font-medium uppercase text-xs">Valor</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Método</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Responsavel</th>
                <th className="text-left px-4 py-3 text-white font-medium uppercase text-xs">Pago Por</th>
                <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-emt-cinza-claro">
              {paginados.map((pag) => (
                <tr key={pag.id} className="hover:bg-emt-verde-claro">
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                    {pag.data ? new Date(pag.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{pag.transportadora}</td>
                  <td className="px-4 py-3 text-gray-800">{formatMesRef(pag.mesReferencia)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emt-verde whitespace-nowrap">
                    {pag.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {METODO_LABELS[pag.metodo] || pag.metodo}
                    {pag.metodo === 'combustivel' && pag.quantidadeCombustivel > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({pag.quantidadeCombustivel.toLocaleString('pt-BR')}L)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{pag.responsavel}</td>
                  <td className="px-4 py-3 text-gray-600">{pag.pagoPor || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {canEdit && (
                        <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onEdit(pag)}>
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(pag.id)}
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
                <td colSpan={3} className="px-4 py-3 text-right text-gray-700">
                  Total ({filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}):
                </td>
                <td className="px-4 py-3 text-right text-emt-verde whitespace-nowrap">
                  {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {filtrados.length} pagamento{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
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
              Próximo
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
