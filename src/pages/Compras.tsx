import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  PedidoCompra,
  Cotacao,
  OrdemCompra,
  ItemOrdemCompra,
} from '../types';
import { usePedidosCompra, useAdicionarPedidoCompra, useAtualizarPedidoCompra } from '../hooks/usePedidosCompra';
import { useCotacoes, useAdicionarCotacao, useAtualizarCotacao } from '../hooks/useCotacoes';
import { useOrdensCompra, useAdicionarOrdemCompra, useAtualizarOrdemCompra } from '../hooks/useOrdensCompra';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useFornecedores } from '../hooks/useFornecedores';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import PedidoCompraForm from '../components/compras/PedidoCompraForm';
import PedidoCompraList from '../components/compras/PedidoCompraList';
import CotacaoForm from '../components/compras/CotacaoForm';
import CotacaoList from '../components/compras/CotacaoList';
import OrdemCompraForm from '../components/compras/OrdemCompraForm';
import OrdemCompraList from '../components/compras/OrdemCompraList';

type Tab = 'pedidos' | 'cotacoes' | 'ordens';

function proximoNumero(prefix: string, existentes: string[]): string {
  const nums = existentes
    .map((n) => {
      const match = n.match(new RegExp(`^${prefix}-(\\d+)$`));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export default function Compras() {
  const { temAcao, usuario } = useAuth();
  const canCreate = temAcao('criar_compra');
  const canEdit = temAcao('editar_compra');
  const canApprove = temAcao('aprovar_pedido');

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['pedidos', 'cotacoes', 'ordens'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'pedidos';
  const setTab = useCallback((t: Tab) => setSearchParams({ tab: t }, { replace: true }), [setSearchParams]);

  // Data
  const { data: pedidos = [], isLoading: loadingPedidos } = usePedidosCompra();
  const { data: cotacoes = [] } = useCotacoes();
  const { data: ordens = [] } = useOrdensCompra();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: fornecedores = [] } = useFornecedores();

  const adicionarPedidoMut = useAdicionarPedidoCompra();
  const atualizarPedidoMut = useAtualizarPedidoCompra();
  const adicionarCotacaoMut = useAdicionarCotacao();
  const atualizarCotacaoMut = useAtualizarCotacao();
  const adicionarOCMut = useAdicionarOrdemCompra();
  const atualizarOCMut = useAtualizarOrdemCompra();

  // State
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [editandoPedido, setEditandoPedido] = useState<PedidoCompra | null>(null);
  const [buscaPedido, setBuscaPedido] = useState('');

  const [cotacaoModalOpen, setCotacaoModalOpen] = useState(false);
  const [pedidoParaCotacao, setPedidoParaCotacao] = useState<PedidoCompra | null>(null);

  const [ocModalOpen, setOcModalOpen] = useState(false);
  const [editandoOC, setEditandoOC] = useState<OrdemCompra | null>(null);

  const pedidosAprovados = useMemo(() => pedidos.filter((p) => p.status === 'aprovado'), [pedidos]);

  // Próximos números
  const proxPedido = proximoNumero('PED', pedidos.map((p) => p.numero));
  const proxCotacao = proximoNumero('COT', cotacoes.map((c) => c.numero));
  const proxOC = proximoNumero('OC', ordens.map((o) => o.numero));

  // ── Pedido handlers ──
  const handlePedidoSubmit = useCallback(async (pedido: PedidoCompra) => {
    if (editandoPedido) {
      await atualizarPedidoMut.mutateAsync(pedido);
    } else {
      await adicionarPedidoMut.mutateAsync({ ...pedido, criadoPor: usuario?.nome || '' });
    }
    setPedidoModalOpen(false);
    setEditandoPedido(null);
  }, [editandoPedido, adicionarPedidoMut, atualizarPedidoMut, usuario]);

  const handleAprovar = useCallback(async (pedido: PedidoCompra) => {
    await atualizarPedidoMut.mutateAsync({ ...pedido, status: 'aprovado' });
  }, [atualizarPedidoMut]);

  const handleReprovar = useCallback(async (pedido: PedidoCompra) => {
    await atualizarPedidoMut.mutateAsync({ ...pedido, status: 'reprovado' });
  }, [atualizarPedidoMut]);

  const handleEnviarCotacao = useCallback((pedido: PedidoCompra) => {
    setPedidoParaCotacao(pedido);
    setCotacaoModalOpen(true);
    setTab('cotacoes');
  }, [setTab]);

  const handleGerarOCDireto = useCallback((pedido: PedidoCompra) => {
    // Cria uma OC pré-preenchida com itens do pedido
    const ocItens: ItemOrdemCompra[] = pedido.itens.map((item) => ({
      id: item.id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      precoUnitario: 0,
      subtotal: 0,
    }));
    setEditandoOC({
      id: '',
      numero: '',
      dataCriacao: '',
      dataEntrega: '',
      obraId: pedido.obraId,
      etapaObraId: '',
      fornecedorId: '',
      cotacaoId: '',
      pedidoCompraId: pedido.id,
      itens: ocItens,
      custosAdicionais: { frete: 0, outrasDespesas: 0, impostos: 0, desconto: 0 },
      totalMateriais: 0,
      totalGeral: 0,
      condicaoPagamento: '',
      prazoEntrega: '',
      status: 'emitida',
      observacoes: '',
      entradaInsumos: false,
      criadoPor: '',
    });
    setOcModalOpen(true);
    setTab('ordens');
  }, [setTab]);

  // ── Cotação handlers ──
  const handleCotacaoSubmit = useCallback(async (cotacao: Cotacao) => {
    if (cotacoes.find((c) => c.id === cotacao.id)) {
      await atualizarCotacaoMut.mutateAsync(cotacao);
    } else {
      await adicionarCotacaoMut.mutateAsync({ ...cotacao, criadoPor: usuario?.nome || '' });
    }
    setCotacaoModalOpen(false);
    setPedidoParaCotacao(null);
  }, [cotacoes, adicionarCotacaoMut, atualizarCotacaoMut, usuario]);

  const handleSalvarPrecos = useCallback(async (cotacao: Cotacao) => {
    await atualizarCotacaoMut.mutateAsync(cotacao);
  }, [atualizarCotacaoMut]);

  const handleGerarOCdeCotacao = useCallback((cotacao: Cotacao, fornecedorId: string, itemIds: string[]) => {
    const cf = cotacao.fornecedores.find((f) => f.fornecedorId === fornecedorId);
    if (!cf) return;

    const itens: ItemOrdemCompra[] = cotacao.itensPedido
      .filter((item) => itemIds.includes(item.id))
      .map((item) => {
        const preco = cf.itensPrecos.find((ip) => ip.itemPedidoId === item.id);
        return {
          id: item.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          precoUnitario: preco?.precoUnitario ?? 0,
          subtotal: item.quantidade * (preco?.precoUnitario ?? 0),
        };
      });

    const pedidoRef = pedidos.find((p) => p.id === cotacao.pedidoCompraId);
    const totalMat = itens.reduce((sum, i) => sum + i.subtotal, 0);

    setEditandoOC({
      id: '',
      numero: '',
      dataCriacao: '',
      dataEntrega: '',
      obraId: pedidoRef?.obraId ?? '',
      etapaObraId: '',
      fornecedorId,
      cotacaoId: cotacao.id,
      pedidoCompraId: cotacao.pedidoCompraId,
      itens,
      custosAdicionais: { frete: 0, outrasDespesas: 0, impostos: 0, desconto: 0 },
      totalMateriais: totalMat,
      totalGeral: totalMat,
      condicaoPagamento: cf.condicaoPagamento,
      prazoEntrega: cf.prazoEntrega,
      status: 'emitida',
      observacoes: '',
      entradaInsumos: false,
      criadoPor: '',
    });
    setOcModalOpen(true);
    setTab('ordens');
  }, [pedidos, setTab]);

  // ── OC handlers ──
  const handleOCSubmit = useCallback(async (oc: OrdemCompra) => {
    if (editandoOC?.id) {
      await atualizarOCMut.mutateAsync(oc);
    } else {
      await adicionarOCMut.mutateAsync({ ...oc, criadoPor: usuario?.nome || '' });
    }
    setOcModalOpen(false);
    setEditandoOC(null);
  }, [editandoOC, adicionarOCMut, atualizarOCMut, usuario]);

  const handleMarcarEntregue = useCallback(async (oc: OrdemCompra) => {
    await atualizarOCMut.mutateAsync({
      ...oc,
      status: 'entregue',
      dataEntrega: new Date().toISOString().slice(0, 10),
    });
  }, [atualizarOCMut]);

  const handleCancelarOC = useCallback(async (oc: OrdemCompra) => {
    await atualizarOCMut.mutateAsync({ ...oc, status: 'cancelada' });
  }, [atualizarOCMut]);

  if (loadingPedidos) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pedidos', label: 'Pedidos de Material' },
    { key: 'cotacoes', label: 'Cotações' },
    { key: 'ordens', label: 'Ordens de Compra' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Compras</h1>
        {canCreate && (
          <div className="flex gap-2">
            {tab === 'pedidos' && (
              <Button onClick={() => { setEditandoPedido(null); setPedidoModalOpen(true); }}>
                Novo Pedido
              </Button>
            )}
            {tab === 'cotacoes' && (
              <Button onClick={() => { setPedidoParaCotacao(null); setCotacaoModalOpen(true); }}>
                Nova Cotação
              </Button>
            )}
            {tab === 'ordens' && (
              <Button onClick={() => { setEditandoOC(null); setOcModalOpen(true); }}>
                Nova OC
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-200 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pedidos Tab ── */}
      {tab === 'pedidos' && (
        <>
          <div className="mb-4">
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde w-72"
              placeholder="Buscar por número, obra ou solicitante..."
              value={buscaPedido}
              onChange={(e) => setBuscaPedido(e.target.value)}
            />
          </div>
          <PedidoCompraList
            pedidos={pedidos}
            obras={obras}
            busca={buscaPedido}
            onAprovar={handleAprovar}
            onReprovar={handleReprovar}
            onEnviarCotacao={handleEnviarCotacao}
            onGerarOC={handleGerarOCDireto}
            canApprove={canApprove}
            canCreate={canCreate}
          />
        </>
      )}

      {/* ── Cotações Tab ── */}
      {tab === 'cotacoes' && (
        <CotacaoList
          cotacoes={cotacoes}
          fornecedores={fornecedores}
          pedidos={pedidos}
          onSalvarPrecos={handleSalvarPrecos}
          onGerarOC={handleGerarOCdeCotacao}
          canEdit={canEdit}
          canCreate={canCreate}
        />
      )}

      {/* ── Ordens de Compra Tab ── */}
      {tab === 'ordens' && (
        <OrdemCompraList
          ordens={ordens}
          obras={obras}
          etapas={etapas}
          fornecedores={fornecedores}
          cotacoes={cotacoes}
          pedidos={pedidos}
          onEdit={(oc) => { setEditandoOC(oc); setOcModalOpen(true); }}
          onMarcarEntregue={handleMarcarEntregue}
          onCancelar={handleCancelarOC}
          canEdit={canEdit}
        />
      )}

      {/* Modal Pedido */}
      <Modal
        open={pedidoModalOpen}
        onClose={() => { setPedidoModalOpen(false); setEditandoPedido(null); }}
        title={editandoPedido ? 'Editar Pedido' : 'Novo Pedido de Material'}
      >
        <PedidoCompraForm
          initial={editandoPedido}
          obras={obras}
          onSubmit={handlePedidoSubmit}
          onCancel={() => { setPedidoModalOpen(false); setEditandoPedido(null); }}
          proximoNumero={proxPedido}
        />
      </Modal>

      {/* Modal Cotação */}
      <Modal
        open={cotacaoModalOpen}
        onClose={() => { setCotacaoModalOpen(false); setPedidoParaCotacao(null); }}
        title="Nova Cotação"
      >
        <CotacaoForm
          initial={null}
          pedidosAprovados={pedidosAprovados}
          fornecedores={fornecedores}
          onSubmit={handleCotacaoSubmit}
          onCancel={() => { setCotacaoModalOpen(false); setPedidoParaCotacao(null); }}
          proximoNumero={proxCotacao}
          pedidoPreSelecionado={pedidoParaCotacao}
        />
      </Modal>

      {/* Modal OC */}
      <Modal
        open={ocModalOpen}
        onClose={() => { setOcModalOpen(false); setEditandoOC(null); }}
        title={editandoOC?.id ? 'Editar Ordem de Compra' : 'Nova Ordem de Compra'}
      >
        <OrdemCompraForm
          initial={editandoOC}
          obras={obras}
          etapas={etapas}
          fornecedores={fornecedores}
          onSubmit={handleOCSubmit}
          onCancel={() => { setOcModalOpen(false); setEditandoOC(null); }}
          proximoNumero={proxOC}
        />
      </Modal>
    </div>
  );
}
