import { useState } from 'react';
import type { PedidoCompra, Obra } from '../../types';
import { formatDate } from '../../utils/formatters';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const URGENCIA_BADGE: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700',
};

const URGENCIA_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  critica: 'Crítica',
};

const STATUS_BADGE: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  aprovado: 'bg-green-100 text-green-800',
  reprovado: 'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
};

const UNIDADE_LABEL: Record<string, string> = {
  un: 'un', kg: 'kg', m: 'm', m2: 'm²', m3: 'm³', lt: 'lt', sc: 'sc', pc: 'pç', cx: 'cx', rl: 'rl', tb: 'tb',
};

interface PedidoCompraListProps {
  pedidos: PedidoCompra[];
  obras: Obra[];
  busca: string;
  categorias: { value: string; label: string }[];
  onAprovar: (pedido: PedidoCompra) => void;
  onReprovar: (pedido: PedidoCompra) => void;
  onDesaprovar: (pedido: PedidoCompra) => void;
  onEnviarCotacao: (pedido: PedidoCompra) => void;
  onGerarOC: (pedido: PedidoCompra) => void;
  canApprove: boolean;
  canCreate: boolean;
}

export default function PedidoCompraList({
  pedidos,
  obras,
  busca,
  categorias,
  onAprovar,
  onReprovar,
  onDesaprovar,
  onEnviarCotacao,
  onGerarOC,
  canApprove,
  canCreate,
}: PedidoCompraListProps) {
  const [detalhePedido, setDetalhePedido] = useState<PedidoCompra | null>(null);
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const categoriaLabelMap = new Map(categorias.map((c) => [c.value, c.label]));

  const buscaLower = busca.toLowerCase();
  const filtrados = pedidos
    .filter((p) => {
      if (!busca) return true;
      return (
        p.numero.toLowerCase().includes(buscaLower) ||
        (obrasMap.get(p.obraId) || '').toLowerCase().includes(buscaLower) ||
        p.solicitante.toLowerCase().includes(buscaLower)
      );
    })
    .sort((a, b) => b.data.localeCompare(a.data) || b.numero.localeCompare(a.numero));

  // Cards resumo
  const totalPedidos = pedidos.length;
  const pendentes = pedidos.filter((p) => p.status === 'pendente').length;
  const aprovados = pedidos.filter((p) => p.status === 'aprovado').length;

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total de Pedidos</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{totalPedidos}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{pendentes}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Aprovados</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{aprovados}</p>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        {filtrados.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Nenhum pedido encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[90px]">Nº</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[100px]">Data</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider">Obra</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider">Solicitante</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[70px]">Itens</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[90px]">Urgência</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[100px]">Status</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[180px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{p.numero}</td>
                    <td className="px-4 py-2.5 text-gray-600">{formatDate(p.data)}</td>
                    <td className="px-4 py-2.5 text-gray-600 truncate">{obrasMap.get(p.obraId) || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-600 truncate">{p.solicitante}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{p.itens.length}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${URGENCIA_BADGE[p.urgencia]}`}>
                        {URGENCIA_LABEL[p.urgencia]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button onClick={() => setDetalhePedido(p)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Detalhes
                        </button>
                        {p.status === 'pendente' && canApprove && (
                          <>
                            <button onClick={() => onAprovar(p)} className="text-xs text-green-600 hover:text-green-800 font-medium">
                              Aprovar
                            </button>
                            <button onClick={() => onReprovar(p)} className="text-xs text-red-600 hover:text-red-800 font-medium">
                              Reprovar
                            </button>
                          </>
                        )}
                        {p.status === 'aprovado' && canCreate && (
                          <>
                            <button onClick={() => onEnviarCotacao(p)} className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                              Cotação
                            </button>
                            <button onClick={() => onGerarOC(p)} className="text-xs text-emt-verde hover:text-emt-verde-escuro font-medium">
                              Gerar OC
                            </button>
                          </>
                        )}
                        {(p.status === 'aprovado' || p.status === 'reprovado') && canApprove && (
                          <button onClick={() => onDesaprovar(p)} className="text-xs text-yellow-600 hover:text-yellow-800 font-medium">
                            Voltar p/ Pendente
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Detalhes */}
      <Modal open={detalhePedido !== null} onClose={() => setDetalhePedido(null)} title={`Pedido ${detalhePedido?.numero || ''}`}>
        {detalhePedido && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Data</p>
                <p className="font-medium">{formatDate(detalhePedido.data)}</p>
              </div>
              <div>
                <p className="text-gray-500">Obra</p>
                <p className="font-medium">{obrasMap.get(detalhePedido.obraId) || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Solicitante</p>
                <p className="font-medium">{detalhePedido.solicitante}</p>
              </div>
              <div>
                <p className="text-gray-500">Urgência</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${URGENCIA_BADGE[detalhePedido.urgencia]}`}>
                  {URGENCIA_LABEL[detalhePedido.urgencia]}
                </span>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[detalhePedido.status]}`}>
                  {STATUS_LABEL[detalhePedido.status]}
                </span>
              </div>
            </div>
            {detalhePedido.observacoes && (
              <div className="text-sm">
                <p className="text-gray-500">Observações</p>
                <p className="text-gray-700">{detalhePedido.observacoes}</p>
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Itens ({detalhePedido.itens.length})</h4>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Descrição</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Categoria</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Qtd</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Unid.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detalhePedido.itens.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-1.5">{item.descricao}</td>
                      <td className="px-3 py-1.5 text-gray-500">{categoriaLabelMap.get(item.categoria) || item.categoria}</td>
                      <td className="px-3 py-1.5 text-right">{item.quantidade}</td>
                      <td className="px-3 py-1.5">{UNIDADE_LABEL[item.unidade] || item.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setDetalhePedido(null)}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export { URGENCIA_BADGE, URGENCIA_LABEL, STATUS_BADGE, STATUS_LABEL, UNIDADE_LABEL };
