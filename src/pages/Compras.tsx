import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  PedidoCompra,
  Cotacao,
  OrdemCompra,
  ItemOrdemCompra,
  EntradaMaterial,
  EntradaCombustivel,
} from '../types';
import { usePedidosCompra, useAdicionarPedidoCompra, useAtualizarPedidoCompra, useExcluirPedidoCompra } from '../hooks/usePedidosCompra';
import { useCotacoes, useAdicionarCotacao, useAtualizarCotacao, useExcluirCotacao } from '../hooks/useCotacoes';
import { useOrdensCompra, useAdicionarOrdemCompra, useAtualizarOrdemCompra, useExcluirOrdemCompra } from '../hooks/useOrdensCompra';
import { useDepositosMaterial } from '../hooks/useDepositosMaterial';
import { useDepositos } from '../hooks/useDepositos';
import { useAdicionarEntradaMaterial } from '../hooks/useEntradasMaterial';
import { useAdicionarEntradaCombustivel } from '../hooks/useEntradasCombustivel';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useFornecedores, useAdicionarFornecedor } from '../hooks/useFornecedores';
import { useInsumos } from '../hooks/useInsumos';
import { useUnidades } from '../hooks/useUnidades';
import { useCategoriasMaterial } from '../hooks/useCategoriasMaterial';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PedidoCompraForm from '../components/compras/PedidoCompraForm';
import PedidoCompraList from '../components/compras/PedidoCompraList';
import CotacaoForm from '../components/compras/CotacaoForm';
import CotacaoList from '../components/compras/CotacaoList';
import OrdemCompraForm from '../components/compras/OrdemCompraForm';
import OrdemCompraList from '../components/compras/OrdemCompraList';
import ImportOCModal from '../components/compras/ImportOCModal';

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
  const { data: insumos = [] } = useInsumos();
  const { data: unidades = [] } = useUnidades();
  const { data: categoriasMaterial = [] } = useCategoriasMaterial();
  const { data: depositosMaterial = [] } = useDepositosMaterial();
  const { data: depositosCombustivel = [] } = useDepositos();

  const categoriasOptions = useMemo(
    () => categoriasMaterial.filter((c) => c.ativo).map((c) => ({ value: c.valor, label: c.nome })),
    [categoriasMaterial]
  );

  const adicionarFornecedorMut = useAdicionarFornecedor();
  const adicionarPedidoMut = useAdicionarPedidoCompra();
  const atualizarPedidoMut = useAtualizarPedidoCompra();
  const excluirPedidoMut = useExcluirPedidoCompra();
  const adicionarCotacaoMut = useAdicionarCotacao();
  const atualizarCotacaoMut = useAtualizarCotacao();
  const excluirCotacaoMut = useExcluirCotacao();
  const adicionarOCMut = useAdicionarOrdemCompra();
  const atualizarOCMut = useAtualizarOrdemCompra();
  const excluirOCMut = useExcluirOrdemCompra();
  const adicionarEntradaMaterialMut = useAdicionarEntradaMaterial();
  const adicionarEntradaCombustivelMut = useAdicionarEntradaCombustivel();

  // State
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [editandoPedido, setEditandoPedido] = useState<PedidoCompra | null>(null);
  const [buscaPedido, setBuscaPedido] = useState('');
  const [deletePedidoId, setDeletePedidoId] = useState<string | null>(null);

  const [cotacaoModalOpen, setCotacaoModalOpen] = useState(false);
  const [pedidoParaCotacao, setPedidoParaCotacao] = useState<PedidoCompra | null>(null);
  const [editandoCotacao, setEditandoCotacao] = useState<Cotacao | null>(null);
  const [deleteCotacaoId, setDeleteCotacaoId] = useState<string | null>(null);

  const [ocModalOpen, setOcModalOpen] = useState(false);
  const [editandoOC, setEditandoOC] = useState<OrdemCompra | null>(null);
  const [importOCOpen, setImportOCOpen] = useState(false);

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

  const handleDesaprovar = useCallback(async (pedido: PedidoCompra) => {
    await atualizarPedidoMut.mutateAsync({ ...pedido, status: 'pendente' });
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
      obraId: pedido.obraId,
      etapaObraId: '',
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
      formaPagamento: '',
      parcelas: [],
      prazoEntrega: '',
      status: 'emitida',
      observacoes: '',
      entradaInsumos: false,
      entradaGerada: false,
      empresaFaturamento: '',
      aprovada: false,
      criadoPor: '',
    });
    setOcModalOpen(true);
    setTab('ordens');
  }, [setTab]);

  const handleExcluirPedido = useCallback(async () => {
    if (!deletePedidoId) return;
    await excluirPedidoMut.mutateAsync(deletePedidoId);
    setDeletePedidoId(null);
  }, [deletePedidoId, excluirPedidoMut]);

  // ── Cotação handlers ──
  const handleCotacaoSubmit = useCallback(async (cotacao: Cotacao) => {
    if (cotacoes.find((c) => c.id === cotacao.id)) {
      await atualizarCotacaoMut.mutateAsync(cotacao);
    } else {
      await adicionarCotacaoMut.mutateAsync({ ...cotacao, criadoPor: usuario?.nome || '' });
    }
    setCotacaoModalOpen(false);
    setPedidoParaCotacao(null);
    setEditandoCotacao(null);
  }, [cotacoes, adicionarCotacaoMut, atualizarCotacaoMut, usuario]);

  const handleSalvarPrecos = useCallback(async (cotacao: Cotacao) => {
    await atualizarCotacaoMut.mutateAsync(cotacao);
  }, [atualizarCotacaoMut]);

  const handleExcluirCotacao = useCallback(async () => {
    if (!deleteCotacaoId) return;
    await excluirCotacaoMut.mutateAsync(deleteCotacaoId);
    setDeleteCotacaoId(null);
  }, [deleteCotacaoId, excluirCotacaoMut]);

  const handleGerarOCdeCotacao = useCallback((cotacao: Cotacao, fornecedorId: string, itemIds: string[]) => {
    const cf = cotacao.fornecedores.find((f) => f.fornecedorId === fornecedorId);
    if (!cf) return;

    const pedidoRef = pedidos.find((p) => p.id === cotacao.pedidoCompraId);

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
          obraId: pedidoRef?.obraId ?? '',
          etapaObraId: '',
        };
      });
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
      formaPagamento: '',
      parcelas: [],
      prazoEntrega: cf.prazoEntrega,
      status: 'emitida',
      observacoes: '',
      entradaInsumos: false,
      entradaGerada: false,
      empresaFaturamento: '',
      aprovada: false,
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

  const handleReabrirOC = useCallback(async (oc: OrdemCompra) => {
    await atualizarOCMut.mutateAsync({ ...oc, status: 'emitida', dataEntrega: '' });
  }, [atualizarOCMut]);

  const handleExcluirOC = useCallback(async (oc: OrdemCompra) => {
    if (oc.entradaGerada) return;
    if (!window.confirm(`Excluir permanentemente a OC ${oc.numero}?`)) return;
    await excluirOCMut.mutateAsync(oc.id);
  }, [excluirOCMut]);

  const handleAprovarOC = useCallback(async (oc: OrdemCompra) => {
    await atualizarOCMut.mutateAsync(oc);
  }, [atualizarOCMut]);

  const handleGerarEntrada = useCallback(async (oc: OrdemCompra, tipo: 'insumos' | 'combustivel', depositoId: string) => {
    const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const agora = new Date().toISOString();
    const nomeUsuario = usuario?.nome || '';
    const forn = fornecedores.find((f) => f.id === oc.fornecedorId);

    if (tipo === 'insumos') {
      // Create one EntradaMaterial per OC item, matching to insumo by descricao
      for (const item of oc.itens) {
        const insumo = insumos.find((i) => i.nome.toLowerCase() === item.descricao.toLowerCase());
        const entrada: EntradaMaterial = {
          id: genId(),
          dataHora: agora,
          depositoMaterialId: depositoId,
          insumoId: insumo?.id || '',
          obraId: oc.obraId,
          quantidade: item.quantidade,
          valorTotal: item.subtotal,
          fornecedorId: oc.fornecedorId,
          notaFiscal: '',
          observacoes: `Gerado a partir da OC ${oc.numero}`,
          criadoPor: nomeUsuario,
        };
        await adicionarEntradaMaterialMut.mutateAsync(entrada);
      }
    } else {
      // Combustível: create one entry with the OC total
      const totalLitros = oc.itens.reduce((sum, i) => sum + i.quantidade, 0);
      const entrada: EntradaCombustivel = {
        id: genId(),
        dataHora: agora,
        depositoId,
        tipoCombustivel: oc.itens[0]?.descricao || 'diesel',
        obraId: oc.obraId,
        quantidadeLitros: totalLitros,
        valorTotal: oc.totalGeral,
        fornecedor: forn?.nome || '',
        notaFiscal: '',
        observacoes: `Gerado a partir da OC ${oc.numero}`,
        criadoPor: nomeUsuario,
      };
      await adicionarEntradaCombustivelMut.mutateAsync(entrada);
    }
    // Marca a OC como entrada já gerada
    await atualizarOCMut.mutateAsync({ ...oc, entradaGerada: true });
  }, [usuario, fornecedores, insumos, adicionarEntradaMaterialMut, adicionarEntradaCombustivelMut, atualizarOCMut]);

  // ── Import OC handler ──
  const handleImportOCs = useCallback(async (items: Record<string, unknown>[]) => {
    const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    // Group items by fornecedor (case-insensitive, trimmed)
    const grupos = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const key = String(item.fornecedor).trim().toLowerCase();
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(item);
    }

    // Compute starting OC number
    const numerosExistentes = ordens.map((o) => o.numero);
    let maxNum = numerosExistentes
      .map((n) => { const m = n.match(/^OC-(\d+)$/); return m ? parseInt(m[1], 10) : 0; })
      .reduce((a, b) => Math.max(a, b), 0);

    for (const [, grupoItens] of grupos) {
      maxNum++;
      const numero = `OC-${String(maxNum).padStart(4, '0')}`;

      const nomeFornecedor = String(grupoItens[0].fornecedor).trim();
      const forn = fornecedores.find((f) => f.nome.trim().toLowerCase() === nomeFornecedor.toLowerCase());

      const ocItens: ItemOrdemCompra[] = grupoItens.map((it) => {
        const qty = Number(it.quantidade);
        const price = Number(it.precoUnitario);
        return {
          id: genId(),
          descricao: String(it.descricao),
          quantidade: qty,
          unidade: String(it.unidade),
          precoUnitario: price,
          subtotal: qty * price,
          obraId: '',
          etapaObraId: '',
        };
      });

      const totalMateriais = ocItens.reduce((sum, i) => sum + i.subtotal, 0);

      const empresaFat = String(grupoItens[0].empresaFaturamento || '').trim();
      const obs = grupoItens.map((it) => String(it.observacoes || '').trim()).filter(Boolean).join('; ');

      const oc: OrdemCompra = {
        id: '',
        numero,
        dataCriacao: '',
        dataEntrega: '',
        obraId: '',
        etapaObraId: '',
        fornecedorId: forn?.id || '',
        cotacaoId: '',
        pedidoCompraId: '',
        itens: ocItens,
        custosAdicionais: { frete: 0, outrasDespesas: 0, impostos: 0, desconto: 0 },
        totalMateriais,
        totalGeral: totalMateriais,
        condicaoPagamento: '',
        formaPagamento: '',
        parcelas: [],
        prazoEntrega: '',
        status: 'emitida',
        observacoes: obs,
        entradaInsumos: false,
        entradaGerada: false,
        empresaFaturamento: empresaFat,
        aprovada: false,
        criadoPor: usuario?.nome || '',
      };

      await adicionarOCMut.mutateAsync(oc);
    }
  }, [ordens, fornecedores, usuario, adicionarOCMut]);

  if (loadingPedidos) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-fg-subtle)]">Carregando...</p>
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
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)]">Compras</h1>
        {canCreate && (
          <div className="flex gap-2">
            <Button onClick={() => { setEditandoPedido(null); setPedidoModalOpen(true); }}>
              Novo Pedido
            </Button>
            <Button onClick={() => { setPedidoParaCotacao(null); setCotacaoModalOpen(true); }}>
              Nova Cotação
            </Button>
            <Button onClick={() => { setEditandoOC(null); setOcModalOpen(true); }}>
              Nova OC
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--color-surface-1)] text-[var(--color-fg)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
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
            cotacoes={cotacoes}
            ordens={ordens}
            busca={buscaPedido}
            categorias={categoriasOptions}
            onAprovar={handleAprovar}
            onReprovar={handleReprovar}
            onDesaprovar={handleDesaprovar}
            onExcluir={(p) => setDeletePedidoId(p.id)}
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
          onEditar={(cot) => {
            setEditandoCotacao(cot);
            setPedidoParaCotacao(null);
            setCotacaoModalOpen(true);
          }}
          onExcluir={(cot) => setDeleteCotacaoId(cot.id)}
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
          onReabrir={handleReabrirOC}
          onExcluir={handleExcluirOC}
          onAprovar={handleAprovarOC}
          onGerarEntrada={handleGerarEntrada}
          depositosMaterial={depositosMaterial}
          depositosCombustivel={depositosCombustivel}
          canEdit={canEdit}
        />
      )}

      {/* Modal Pedido */}
      <Modal
        open={pedidoModalOpen}
        onClose={() => { setPedidoModalOpen(false); setEditandoPedido(null); }}
        title={editandoPedido ? 'Editar Pedido' : 'Novo Pedido de Material'}
        size="xl"
      >
        <PedidoCompraForm
          initial={editandoPedido}
          obras={obras}
          insumos={insumos}
          unidades={unidades}
          categorias={categoriasOptions}
          onSubmit={handlePedidoSubmit}
          onCancel={() => { setPedidoModalOpen(false); setEditandoPedido(null); }}
          proximoNumero={proxPedido}
          nomeUsuario={usuario?.nome}
        />
      </Modal>

      {/* Modal Cotação */}
      <Modal
        open={cotacaoModalOpen}
        onClose={() => { setCotacaoModalOpen(false); setPedidoParaCotacao(null); setEditandoCotacao(null); }}
        title={editandoCotacao ? `Editar Cotação ${editandoCotacao.numero}` : 'Nova Cotação'}
        size="xl"
      >
        <CotacaoForm
          initial={editandoCotacao}
          pedidosAprovados={pedidosAprovados}
          fornecedores={fornecedores}
          insumos={insumos}
          unidades={unidades}
          categorias={categoriasOptions}
          onSubmit={handleCotacaoSubmit}
          onCancel={() => { setCotacaoModalOpen(false); setPedidoParaCotacao(null); setEditandoCotacao(null); }}
          proximoNumero={proxCotacao}
          pedidoPreSelecionado={pedidoParaCotacao}
          onCreateFornecedor={async (nome) => {
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            await adicionarFornecedorMut.mutateAsync({
              id,
              nome,
              cnpj: '',
              telefone: '',
              email: '',
              observacoes: '',
              ativo: true,
              criadoPor: usuario?.nome || '',
            });
            return id;
          }}
        />
      </Modal>

      {/* Modal OC */}
      <Modal
        open={ocModalOpen}
        onClose={() => { setOcModalOpen(false); setEditandoOC(null); }}
        title={editandoOC?.id ? 'Editar Ordem de Compra' : 'Nova Ordem de Compra'}
        size="xl"
      >
        <OrdemCompraForm
          initial={editandoOC}
          obras={obras}
          etapas={etapas}
          fornecedores={fornecedores}
          insumos={insumos}
          onSubmit={handleOCSubmit}
          onCancel={() => { setOcModalOpen(false); setEditandoOC(null); }}
          proximoNumero={proxOC}
          onImportExcel={() => { setOcModalOpen(false); setEditandoOC(null); setImportOCOpen(true); }}
          onCreateFornecedor={async (nome) => {
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            await adicionarFornecedorMut.mutateAsync({
              id,
              nome,
              cnpj: '',
              telefone: '',
              email: '',
              observacoes: '',
              ativo: true,
              criadoPor: usuario?.nome || '',
            });
            return id;
          }}
        />
      </Modal>

      {/* Modal Importar OCs */}
      <ImportOCModal
        open={importOCOpen}
        onClose={() => setImportOCOpen(false)}
        onImport={handleImportOCs}
      />

      {/* Confirmação excluir pedido */}
      <ConfirmDialog
        open={deletePedidoId !== null}
        title="Excluir Pedido"
        message="Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita."
        onConfirm={handleExcluirPedido}
        onClose={() => setDeletePedidoId(null)}
      />

      {/* Confirmação excluir cotação */}
      <ConfirmDialog
        open={deleteCotacaoId !== null}
        title="Excluir Cotação"
        message="Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita."
        onConfirm={handleExcluirCotacao}
        onClose={() => setDeleteCotacaoId(null)}
      />
    </div>
  );
}
