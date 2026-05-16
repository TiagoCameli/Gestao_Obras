import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  PedidoCompra,
  Cotacao,
  OrdemCompra,
  ItemOrdemCompra,
  OrdemServico,
} from '../types';
import { usePedidosCompra, useAdicionarPedidoCompra, useAtualizarPedidoCompra, useExcluirPedidoCompra } from '../hooks/usePedidosCompra';
import { useCotacoes, useAdicionarCotacao, useAtualizarCotacao, useExcluirCotacao } from '../hooks/useCotacoes';
import { useOrdensCompra, useAdicionarOrdemCompra, useAtualizarOrdemCompra, useExcluirOrdemCompra } from '../hooks/useOrdensCompra';
import { useAtualizarOS } from '../hooks/useOrdensServico';
import { supabase } from '../lib/supabase';
import { dbToOrdemServico } from '../lib/mappers';
import { useDepositosMaterialV2 } from '../hooks/useDepositosObras';
import { useDepositos } from '../hooks/useDepositos';
import { useAdicionarEntradaMaterial } from '../hooks/useEntradasMaterial';
import { useAdicionarEntradaCombustivel } from '../hooks/useEntradasCombustivel';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useFornecedores, useAdicionarFornecedor } from '../hooks/useFornecedores';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useEmpresas } from '../hooks/useEmpresas';
import { useInsumos } from '../hooks/useInsumos';
import { useUnidades } from '../hooks/useUnidades';
import { useCategoriasMaterial } from '../hooks/useCategoriasMaterial';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PedidoCompraFormV2 from '../components/compras/PedidoCompraFormV2';
import PedidoCompraListV2 from '../components/compras/PedidoCompraListV2';
import RejeitarPedidoModal from '../components/compras/RejeitarPedidoModal';
import CotacaoFormV2 from '../components/compras/CotacaoFormV2';
import CotacaoListV2 from '../components/compras/CotacaoListV2';
import EnviarCotacaoFornecedorModal from '../components/compras/EnviarCotacaoFornecedorModal';
import OrdemCompraFormV2 from '../components/compras/OrdemCompraFormV2';
import OrdemCompraListV2 from '../components/compras/OrdemCompraListV2';
import GerarLancamentoFinanceiroModal from '../components/compras/GerarLancamentoFinanceiroModal';
import VisaoGeralCompras from '../components/compras/VisaoGeralCompras';
import LixeiraCompras from '../components/compras/LixeiraCompras';
import NotificacoesSino from '../components/compras/NotificacoesSino';
import { criarNotificacaoCompras } from '../hooks/useComprasNotificacoes';
import ImportOCModal from '../components/compras/ImportOCModal';
import { proximoNumeroPorAno } from '../utils/comprasNumero';
import { auditar } from '../utils/comprasAudit';
import { useUploadAnexoCompras } from '../hooks/useComprasAnexos';

type Tab = 'visao' | 'pedidos' | 'cotacoes' | 'ordens';

export default function Compras() {
  const { temAcao, usuario } = useAuth();
  const canCreate = temAcao('criar_compra');
  const canEdit = temAcao('editar_compra');
  const canApprove = temAcao('aprovar_pedido');

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['visao', 'pedidos', 'cotacoes', 'ordens'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'visao';
  const setTab = useCallback((t: Tab) => setSearchParams({ tab: t }, { replace: true }), [setSearchParams]);

  // Data
  const { data: pedidos = [], isLoading: loadingPedidos } = usePedidosCompra();
  const { data: cotacoes = [] } = useCotacoes();
  const { data: ordens = [] } = useOrdensCompra();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: equipamentos = [] } = useEquipamentos();
  const { data: empresas = [] } = useEmpresas();
  const { data: insumos = [] } = useInsumos();
  const { data: unidades = [] } = useUnidades();
  const { data: categoriasMaterial = [] } = useCategoriasMaterial();
  const { data: depositosMaterial = [] } = useDepositosMaterialV2();
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
  const atualizarOSMut = useAtualizarOS();

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

  // V2: modal pra rejeitar pedido com motivo obrigatório
  const [rejeitarPedido, setRejeitarPedido] = useState<PedidoCompra | null>(null);
  const { showToast } = useToast();
  const uploadAnexoMut = useUploadAnexoCompras();

  // V2: filtro de busca + modal de envio de cotação para fornecedor
  const [buscaCotacao, setBuscaCotacao] = useState('');
  const [enviarCotacao, setEnviarCotacao] = useState<Cotacao | null>(null);

  // V2 (Fase 3): busca OC + modal de lançamento financeiro
  const [buscaOC, setBuscaOC] = useState('');
  const [gerarLancamentoOC, setGerarLancamentoOC] = useState<OrdemCompra | null>(null);

  // V2 (Fase 5): modal de Lixeira
  const [lixeiraAberta, setLixeiraAberta] = useState(false);

  // V2 (Fase 7): atalho global "/" pra focar a busca da aba ativa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const ativo = document.activeElement as HTMLElement | null;
      const tag = ativo?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || ativo?.isContentEditable) return;
      const input = document.getElementById(`busca-compras-${tab}`) as HTMLInputElement | null;
      if (input) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  // Mantém referência em uso (será usada quando a aba "Recebimento" for criada)
  void depositosMaterial;

  const pedidosAprovados = useMemo(
    () => pedidos.filter((p) => (p.status === 'aprovado' || p.status === 'em_cotacao' || p.status === 'cotado') && !p.deletadoEm),
    [pedidos]
  );

  // Próximos números — formato PREFIX-AAAA-NNNN
  const proxPedido = proximoNumeroPorAno('PED', pedidos.map((p) => p.numero));
  const proxCotacao = proximoNumeroPorAno('COT', cotacoes.map((c) => c.numero));
  const proxOC = proximoNumeroPorAno('OC', ordens.map((o) => o.numero));

  // Empresas exibidas no combobox "Faturar para" da OC.
  // Por enquanto, só EMT Construtora. Se a empresa estiver cadastrada na
  // tabela `empresas`, usa o registro real (com CNPJ). Caso contrário,
  // injeta uma opção sintética só com o nome — assim o combobox nunca
  // fica vazio enquanto o cadastro não é feito.
  const empresasFaturamento = useMemo(() => {
    const emt = empresas.filter((e) => /emt\s*construtora/i.test(e.nome));
    if (emt.length > 0) return emt;
    return [{
      id: '__emt_sintetica__',
      nome: 'EMT Construtora',
      cnpj: '',
      endereco: '',
      areaAtuacao: '',
      ativo: true,
      criadoPor: '',
    }];
  }, [empresas]);

  // ── Pedido handlers ──
  const handlePedidoSubmit = useCallback(async (pedido: PedidoCompra, anexosPendentes: File[] = []) => {
    const nomeUsuario = usuario?.nome || '';
    const ehNovo = !editandoPedido;
    if (ehNovo) {
      await adicionarPedidoMut.mutateAsync({ ...pedido, criadoPor: nomeUsuario });
      await auditar({
        entidade: 'pedido', entidadeId: pedido.id, acao: 'created',
        usuarioNome: nomeUsuario, diffDepois: { numero: pedido.numero, solicitante: pedido.solicitante, status: pedido.status },
      });
    } else {
      await atualizarPedidoMut.mutateAsync(pedido);
      await auditar({
        entidade: 'pedido', entidadeId: pedido.id, acao: 'updated',
        usuarioNome: nomeUsuario,
      });
    }
    // Upload de anexos pendentes (modo "novo" não tinha id ainda)
    if (anexosPendentes.length > 0) {
      for (const file of anexosPendentes) {
        try {
          await uploadAnexoMut.mutateAsync({
            entidade: 'pedido', entidadeId: pedido.id, file, enviadoPor: nomeUsuario,
          });
        } catch (e) {
          showToast({ kind: 'error', message: `Falha no anexo "${file.name}": ${(e as Error).message}` });
        }
      }
    }
    showToast({
      kind: 'success',
      message: ehNovo ? `Pedido ${pedido.numero} criado.` : `Pedido ${pedido.numero} atualizado.`,
    });
    setPedidoModalOpen(false);
    setEditandoPedido(null);
  }, [editandoPedido, adicionarPedidoMut, atualizarPedidoMut, usuario, uploadAnexoMut, showToast]);

  const handleAprovar = useCallback(async (pedido: PedidoCompra) => {
    const nomeUsuario = usuario?.nome || '';
    const agora = new Date().toISOString();
    const atualizado: PedidoCompra = {
      ...pedido,
      status: 'aprovado',
      aprovadoPor: nomeUsuario,
      aprovadoEm: agora,
      reprovadoPor: undefined,
      reprovadoEm: undefined,
      motivoReprovacao: undefined,
    };
    await atualizarPedidoMut.mutateAsync(atualizado);
    await auditar({
      entidade: 'pedido', entidadeId: pedido.id, acao: 'approved',
      usuarioNome: nomeUsuario,
    });
    // Notifica o solicitante
    await criarNotificacaoCompras({
      destinatarioId: pedido.solicitante,
      tipo: 'pedido_aprovado',
      titulo: `Pedido ${pedido.numero} aprovado`,
      mensagem: `Seu pedido foi aprovado por ${nomeUsuario} e já pode seguir para cotação ou OC.`,
      link: `/compras?tab=pedidos&id=${pedido.id}`,
    });
    showToast({ kind: 'success', message: `Pedido ${pedido.numero} aprovado.` });
  }, [atualizarPedidoMut, usuario, showToast]);

  // Abre o modal de motivo (V2: motivo obrigatório)
  const handleAbrirReprovar = useCallback((pedido: PedidoCompra) => {
    setRejeitarPedido(pedido);
  }, []);

  const handleConfirmarReprovacao = useCallback(async (motivo: string) => {
    if (!rejeitarPedido) return;
    const nomeUsuario = usuario?.nome || '';
    const agora = new Date().toISOString();
    const atualizado: PedidoCompra = {
      ...rejeitarPedido,
      status: 'reprovado',
      reprovadoPor: nomeUsuario,
      reprovadoEm: agora,
      motivoReprovacao: motivo,
      aprovadoPor: undefined,
      aprovadoEm: undefined,
    };
    await atualizarPedidoMut.mutateAsync(atualizado);
    await auditar({
      entidade: 'pedido', entidadeId: rejeitarPedido.id, acao: 'rejected',
      usuarioNome: nomeUsuario, observacao: motivo,
    });
    // Notifica o solicitante (com motivo)
    await criarNotificacaoCompras({
      destinatarioId: rejeitarPedido.solicitante,
      tipo: 'pedido_reprovado',
      titulo: `Pedido ${rejeitarPedido.numero} reprovado`,
      mensagem: `${nomeUsuario} reprovou seu pedido. Motivo: ${motivo}`,
      link: `/compras?tab=pedidos&id=${rejeitarPedido.id}`,
    });
    showToast({ kind: 'success', message: `Pedido ${rejeitarPedido.numero} reprovado.` });
    setRejeitarPedido(null);
  }, [rejeitarPedido, atualizarPedidoMut, usuario, showToast]);

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
    const nomeUsuario = usuario?.nome || '';
    const pedido = pedidos.find((p) => p.id === deletePedidoId);
    // Soft delete: marca deletado_em + envia para lixeira
    if (pedido) {
      const agora = new Date().toISOString();
      await atualizarPedidoMut.mutateAsync({
        ...pedido,
        deletadoEm: agora,
        deletadoPor: nomeUsuario,
      });
      // Snapshot para lixeira (retenção 30 dias automatic via DEFAULT)
      const { supabase } = await import('../lib/supabase');
      await supabase.from('compras_lixeira').insert({
        id: pedido.id,
        entidade: 'pedido',
        entidade_id: pedido.id,
        payload: pedido as unknown as Record<string, unknown>,
        deletado_por: nomeUsuario,
      }).then(({ error }) => {
        if (error) console.warn('[lixeira] insert falhou:', error.message);
      });
      await auditar({
        entidade: 'pedido', entidadeId: pedido.id, acao: 'deleted',
        usuarioNome: nomeUsuario,
      });
      showToast({ kind: 'info', message: `Pedido ${pedido.numero} movido para a lixeira (30 dias).` });
    }
    setDeletePedidoId(null);
  }, [deletePedidoId, pedidos, atualizarPedidoMut, usuario, showToast]);

  // Manter excluirPedidoMut acessível (usado pelo restore/Hard delete da lixeira no futuro)
  void excluirPedidoMut;

  // ── Cotação handlers ──
  const handleCotacaoSubmit = useCallback(async (cotacao: Cotacao) => {
    const nomeUsuario = usuario?.nome || '';
    const ehNovo = !cotacoes.find((c) => c.id === cotacao.id);
    if (!ehNovo) {
      await atualizarCotacaoMut.mutateAsync(cotacao);
      await auditar({ entidade: 'cotacao', entidadeId: cotacao.id, acao: 'updated', usuarioNome: nomeUsuario });
    } else {
      await adicionarCotacaoMut.mutateAsync({ ...cotacao, criadoPor: nomeUsuario });
      await auditar({
        entidade: 'cotacao', entidadeId: cotacao.id, acao: 'created',
        usuarioNome: nomeUsuario,
        diffDepois: { numero: cotacao.numero, descricao: cotacao.descricao, fornecedores: cotacao.fornecedores.length },
      });
      // Se foi criada a partir de um pedido, atualiza status do pedido pra em_cotacao
      if (cotacao.pedidoCompraId) {
        const pedido = pedidos.find((p) => p.id === cotacao.pedidoCompraId);
        if (pedido && pedido.status === 'aprovado') {
          await atualizarPedidoMut.mutateAsync({ ...pedido, status: 'em_cotacao' });
        }
      }
    }
    showToast({
      kind: 'success',
      message: ehNovo ? `Cotação ${cotacao.numero} criada.` : `Cotação ${cotacao.numero} atualizada.`,
    });
    setCotacaoModalOpen(false);
    setPedidoParaCotacao(null);
    setEditandoCotacao(null);
  }, [cotacoes, pedidos, adicionarCotacaoMut, atualizarCotacaoMut, atualizarPedidoMut, usuario, showToast]);

  // Helper público pra salvar mudanças de preço sem fechar modal (uso futuro)
  void atualizarCotacaoMut;

  const handleExcluirCotacao = useCallback(async () => {
    if (!deleteCotacaoId) return;
    const nomeUsuario = usuario?.nome || '';
    const cotacao = cotacoes.find((c) => c.id === deleteCotacaoId);
    if (cotacao) {
      const agora = new Date().toISOString();
      await atualizarCotacaoMut.mutateAsync({ ...cotacao, deletadoEm: agora, deletadoPor: nomeUsuario });
      const { supabase } = await import('../lib/supabase');
      await supabase.from('compras_lixeira').insert({
        id: cotacao.id,
        entidade: 'cotacao',
        entidade_id: cotacao.id,
        payload: cotacao as unknown as Record<string, unknown>,
        deletado_por: nomeUsuario,
      }).then(({ error }) => {
        if (error) console.warn('[lixeira] insert falhou:', error.message);
      });
      await auditar({ entidade: 'cotacao', entidadeId: cotacao.id, acao: 'deleted', usuarioNome: nomeUsuario });
      showToast({ kind: 'info', message: `Cotação ${cotacao.numero} movida para a lixeira (30 dias).` });
    }
    setDeleteCotacaoId(null);
  }, [deleteCotacaoId, cotacoes, atualizarCotacaoMut, usuario, showToast]);

  // Mantém referência (será usado pelo restore da lixeira no futuro)
  void excluirCotacaoMut;

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
    const nomeUsuario = usuario?.nome || '';
    const ehNovo = !editandoOC?.id;
    if (!ehNovo) {
      await atualizarOCMut.mutateAsync(oc);
      await auditar({ entidade: 'oc', entidadeId: oc.id, acao: 'updated', usuarioNome: nomeUsuario });
    } else {
      await adicionarOCMut.mutateAsync({ ...oc, criadoPor: nomeUsuario });
      await auditar({
        entidade: 'oc', entidadeId: oc.id, acao: 'created',
        usuarioNome: nomeUsuario,
        diffDepois: { numero: oc.numero, fornecedor: oc.fornecedorId, total: oc.totalGeral, destino: oc.tipoDestino },
      });
    }
    showToast({
      kind: 'success',
      message: ehNovo ? `OC ${oc.numero} criada (aguardando aprovação).` : `OC ${oc.numero} atualizada.`,
    });
    setOcModalOpen(false);
    setEditandoOC(null);
  }, [editandoOC, adicionarOCMut, atualizarOCMut, usuario, showToast]);

  // Aprovação separada (workflow b — quem cria envia, outro usuário aprova).
  //
  // v2.5+: a OC pode ter destinos POR ITEM (multi-destino). Iteramos pela
  // lista de itens e aplicamos os efeitos conforme o destino de cada um:
  //   - manutencao_equipamento (serviço): registra na OS vinculada
  //   - manutencao_equipamento (peça): trigger no banco já gera entrada
  //   - obra_etapa, sede: lançamento financeiro direto (placeholder)
  //   - obra_deposito/deposito_central/tanque: entrada no estoque
  //
  // Idempotência: cada OS marca uma tag "[OC ${numero}]" nas observações
  // — se a aprovação rolar de novo, pula.
  const handleAprovarOCv2 = useCallback(async (oc: OrdemCompra) => {
    const nomeUsuario = usuario?.nome || '';
    const agora = new Date().toISOString();

    // ── 1. Agrupar itens de mão de obra por OS (efeito por item) ──────
    // Cada item carrega seu próprio destino. Fallback pra oc.tipoDestino
    // quando o item não tem (OC antiga retrocompat).
    const servicosPorOS = new Map<string, { total: number; itens: ItemOrdemCompra[] }>();
    for (const it of oc.itens) {
      const destinoItem = it.tipoDestino ?? oc.tipoDestino;
      const tipo = it.tipo ?? 'material';
      if (destinoItem === 'manutencao_equipamento' && tipo === 'servico' && it.osId) {
        const atual = servicosPorOS.get(it.osId) ?? { total: 0, itens: [] };
        atual.total += it.subtotal;
        atual.itens.push(it);
        servicosPorOS.set(it.osId, atual);
      }
    }

    // ── 2. Aplica efeitos nas OSs (uma chamada por OS afetada) ────────
    for (const [osId, info] of servicosPorOS.entries()) {
      const { data: osDb, error: osErr } = await supabase
        .from('ordens_servico')
        .select('*')
        .eq('id', osId)
        .is('deleted_at', null)
        .maybeSingle();
      if (osErr || !osDb) {
        showToast({
          kind: 'error',
          message: `OS vinculada não encontrada (id=${osId}). Aprovação interrompida.`,
        });
        return;
      }
      const os: OrdemServico = dbToOrdemServico(osDb);

      // Idempotência
      const tag = `[OC ${oc.numero}]`;
      if (os.observacoes.includes(tag)) continue;

      const linhaServicos = info.itens
        .map((it) => `  • ${it.descricao} — ${it.quantidade} ${it.unidade} × R$ ${it.precoUnitario.toFixed(2)} = R$ ${it.subtotal.toFixed(2)}`)
        .join('\n');
      const novaObs = [
        os.observacoes.trim(),
        `${tag} Mão de obra registrada via aprovação da OC em ${agora.slice(0, 10)} por ${nomeUsuario}:`,
        linhaServicos,
      ].filter(Boolean).join('\n');

      const osAtualizada: OrdemServico = {
        ...os,
        custoServicoTerceiro: (os.custoServicoTerceiro || 0) + info.total,
        observacoes: novaObs,
        updatedAt: agora,
        updatedBy: nomeUsuario,
      };
      await atualizarOSMut.mutateAsync(osAtualizada);
    }

    // ── 2. Marca OC como aprovada ─────────────────────────────────────
    const aprovada: OrdemCompra = {
      ...oc,
      aprovada: true,
      status: 'aprovada',
      aprovadaPor: nomeUsuario,
      aprovadaEm: agora,
      // Trigger no banco já marca lancamento_financeiro_status='pendente' quando aprovada vai a true
    };
    await atualizarOCMut.mutateAsync(aprovada);
    await auditar({
      entidade: 'oc', entidadeId: oc.id, acao: 'approved',
      usuarioNome: nomeUsuario,
    });
    // Notifica o criador da OC
    await criarNotificacaoCompras({
      destinatarioId: oc.criadoPor,
      tipo: 'oc_aprovada',
      titulo: `OC ${oc.numero} aprovada`,
      mensagem: `${nomeUsuario} aprovou a OC. Lançamento financeiro pendente.`,
      link: `/compras?tab=ordens&id=${oc.id}`,
    });

    // Mensagem extra resume os efeitos automáticos aplicados
    const numOSs = servicosPorOS.size;
    const msgExtra = numOSs > 0
      ? ` ${numOSs} OS${numOSs > 1 ? 's' : ''} atualizada${numOSs > 1 ? 's' : ''} com mão de obra.`
      : '';
    showToast({ kind: 'success', message: `OC ${oc.numero} aprovada. Aguardando lançamento financeiro.${msgExtra}` });
    // Fecha o modal se estava aberto
    setOcModalOpen(false);
    setEditandoOC(null);
  }, [atualizarOCMut, atualizarOSMut, usuario, showToast]);

  // Gerar lançamento financeiro — placeholder até módulo Financeiro existir
  const handleConfirmarLancamento = useCallback(async (oc: OrdemCompra, observacao: string) => {
    const nomeUsuario = usuario?.nome || '';
    const agora = new Date().toISOString();
    const lancamentoId = `LF-${new Date().getFullYear()}-${oc.numero}`;
    await atualizarOCMut.mutateAsync({
      ...oc,
      lancamentoFinanceiroStatus: 'lancada',
      lancadoFinanceiroEm: agora,
      lancadoFinanceiroPor: nomeUsuario,
      lancamentoFinanceiroId: lancamentoId,
    });
    await auditar({
      entidade: 'oc', entidadeId: oc.id, acao: 'financial_posted',
      usuarioNome: nomeUsuario,
      observacao: observacao || `Lançamento gerado: ${lancamentoId}`,
    });
    showToast({ kind: 'success', message: `Lançamento ${lancamentoId} gerado.` });
  }, [atualizarOCMut, usuario, showToast]);

  const handleExcluirOC = useCallback(async (oc: OrdemCompra) => {
    if (oc.entradaGerada || oc.lancamentoFinanceiroStatus === 'lancada') {
      showToast({ kind: 'error', message: 'OC com entrada de estoque ou lançamento financeiro não pode ser excluída.' });
      return;
    }
    if (!window.confirm(`Mover OC ${oc.numero} para a lixeira (30 dias)?`)) return;
    const nomeUsuario = usuario?.nome || '';
    const agora = new Date().toISOString();
    await atualizarOCMut.mutateAsync({ ...oc, deletadoEm: agora, deletadoPor: nomeUsuario });
    const { supabase } = await import('../lib/supabase');
    await supabase.from('compras_lixeira').insert({
      id: oc.id, entidade: 'oc', entidade_id: oc.id,
      payload: oc as unknown as Record<string, unknown>,
      deletado_por: nomeUsuario,
    }).then(({ error }) => { if (error) console.warn('[lixeira]', error.message); });
    await auditar({ entidade: 'oc', entidadeId: oc.id, acao: 'deleted', usuarioNome: nomeUsuario });
    showToast({ kind: 'info', message: `OC ${oc.numero} movida para a lixeira.` });
  }, [atualizarOCMut, usuario, showToast]);

  void excluirOCMut; // mantido para uso futuro (hard delete da lixeira)
  // Hooks de geração de entrada de material/combustível ficam preservados — vamos
  // reativar quando construirmos a tela de "Recebimento de OC" (fase futura).
  void adicionarEntradaMaterialMut; void adicionarEntradaCombustivelMut;

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
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-32 bg-[var(--color-surface-2)] animate-pulse rounded" />
          <div className="h-9 w-72 bg-[var(--color-surface-2)] animate-pulse rounded" />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <div className="h-10 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 px-4 flex items-center gap-3 border-b border-[var(--color-border)] last:border-b-0">
              <div className="h-3 w-20 bg-[var(--color-surface-2)] animate-pulse rounded" />
              <div className="h-3 w-16 bg-[var(--color-surface-2)] animate-pulse rounded" />
              <div className="h-3 flex-1 bg-[var(--color-surface-2)] animate-pulse rounded" />
              <div className="h-5 w-16 bg-[var(--color-surface-2)] animate-pulse rounded-full" />
              <div className="h-3 w-20 bg-[var(--color-surface-2)] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'visao', label: 'Visão Geral' },
    { key: 'pedidos', label: 'Pedidos' },
    { key: 'cotacoes', label: 'Cotações' },
    { key: 'ordens', label: 'Ordens de Compra' },
  ];

  return (
    <div>
      {/* ── Header premium ─────────────────────────────────────────────
          Título + subtítulo discreto à esquerda; ações primárias à
          direita, com separador visual antes dos ícones (sino/lixeira)
          pra ficar claro que são utilitários. */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)] leading-none">
            Compras
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-subtle)]">
            Pedidos → Cotações → Ordens de Compra · controle integrado
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canCreate && (
            <>
              <Button
                variant="secondary"
                onClick={() => { setEditandoPedido(null); setPedidoModalOpen(true); }}
              >
                + Pedido
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setPedidoParaCotacao(null); setCotacaoModalOpen(true); }}
              >
                + Cotação
              </Button>
              <Button onClick={() => { setEditandoOC(null); setOcModalOpen(true); }}>
                + Nova OC
              </Button>
            </>
          )}
          {/* Separador visual antes dos utilitários */}
          <span className="hidden sm:block w-px h-6 bg-[var(--color-border)] mx-1" aria-hidden="true" />
          {/* Sino de notificações */}
          <NotificacoesSino
            onNavigate={(link) => {
              const m = link.match(/tab=([a-z]+)(?:&id=([^&]+))?/);
              if (m) {
                const newTab = m[1];
                if (validTabs.includes(newTab as Tab)) setTab(newTab as Tab);
              }
            }}
          />
          {/* Lixeira */}
          {temAcao('restaurar_lixeira_compras') && (
            <button
              type="button"
              onClick={() => setLixeiraAberta(true)}
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] transition-colors"
              title="Lixeira de Compras"
              aria-label="Lixeira"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs com indicador inferior premium ───────────────────────
          Antes era um pill-tab — agora é um underline-tab que ocupa
          a largura completa e fica menos "miúdo" visualmente. */}
      <div className="mb-6 border-b border-[var(--color-border)]">
        <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Compras tabs">
          {tabs.map((t) => {
            const ativo = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ' +
                  (ativo
                    ? 'border-[var(--color-accent)] text-[var(--color-fg)]'
                    : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]')
                }
                aria-current={ativo ? 'page' : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Visão Geral Tab (V2 premium — Dashboard) ── */}
      {tab === 'visao' && (
        <VisaoGeralCompras
          pedidos={pedidos}
          cotacoes={cotacoes}
          ordens={ordens}
          obras={obras}
          fornecedores={fornecedores}
          onAbrirPedido={(p) => {
            setEditandoPedido(p);
            setPedidoModalOpen(true);
          }}
          onAbrirOC={(oc) => {
            setEditandoOC(oc);
            setOcModalOpen(true);
          }}
          onGerarLancamento={(oc) => setGerarLancamentoOC(oc)}
        />
      )}

      {/* ── Pedidos Tab (V2 premium) ── */}
      {tab === 'pedidos' && (
        <>
          <div className="mb-4 relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              id="busca-compras-pedidos"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
              placeholder="Buscar… (atalho: /)"
              value={buscaPedido}
              onChange={(e) => setBuscaPedido(e.target.value)}
            />
          </div>
          <PedidoCompraListV2
            pedidos={pedidos}
            obras={obras}
            cotacoes={cotacoes}
            ordens={ordens}
            busca={buscaPedido}
            categorias={categoriasOptions}
            onAprovar={handleAprovar}
            onReprovar={handleAbrirReprovar}
            onDesaprovar={handleDesaprovar}
            onExcluir={(p) => setDeletePedidoId(p.id)}
            onEnviarCotacao={handleEnviarCotacao}
            onGerarOC={handleGerarOCDireto}
            onEditar={(p) => { setEditandoPedido(p); setPedidoModalOpen(true); }}
            canApprove={canApprove}
            canCreate={canCreate}
          />
        </>
      )}

      {/* ── Cotações Tab (V2 premium) ── */}
      {tab === 'cotacoes' && (
        <>
          <div className="mb-4 relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              id="busca-compras-cotacoes"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
              placeholder="Buscar… (atalho: /)"
              value={buscaCotacao}
              onChange={(e) => setBuscaCotacao(e.target.value)}
            />
          </div>
          <CotacaoListV2
            cotacoes={cotacoes}
            fornecedores={fornecedores}
            pedidos={pedidos}
            busca={buscaCotacao}
            onEditar={(cot) => {
              setEditandoCotacao(cot);
              setPedidoParaCotacao(null);
              setCotacaoModalOpen(true);
            }}
            onEnviar={(cot) => setEnviarCotacao(cot)}
            onExcluir={(cot) => setDeleteCotacaoId(cot.id)}
            canEdit={canEdit}
            canCreate={canCreate}
          />
        </>
      )}

      {/* ── Ordens de Compra Tab (V2 premium) ── */}
      {tab === 'ordens' && (
        <>
          <div className="mb-4 relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              id="busca-compras-ordens"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
              placeholder="Buscar… (atalho: /)"
              value={buscaOC}
              onChange={(e) => setBuscaOC(e.target.value)}
            />
          </div>
          <OrdemCompraListV2
            ordens={ordens}
            obras={obras}
            etapas={etapas}
            fornecedores={fornecedores}
            busca={buscaOC}
            onEditar={(oc) => { setEditandoOC(oc); setOcModalOpen(true); }}
            onAprovar={handleAprovarOCv2}
            onGerarLancamento={(oc) => setGerarLancamentoOC(oc)}
            onExcluir={handleExcluirOC}
            canEdit={canEdit}
            canCreate={canCreate}
          />
        </>
      )}


      {/* Modal Pedido (V2 premium — empilhado com itens + descrição + anexos) */}
      <Modal
        open={pedidoModalOpen}
        onClose={() => { setPedidoModalOpen(false); setEditandoPedido(null); }}
        title={editandoPedido ? `Editar pedido ${editandoPedido.numero}` : 'Novo pedido de compra'}
        size="xl"
      >
        <PedidoCompraFormV2
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

      {/* Modal de reprovação (motivo obrigatório — V2) */}
      <RejeitarPedidoModal
        open={!!rejeitarPedido}
        numeroPedido={rejeitarPedido?.numero || ''}
        onClose={() => setRejeitarPedido(null)}
        onConfirm={handleConfirmarReprovacao}
      />

      {/* Modal Cotação (V2 premium — com mapa comparativo embutido) */}
      <Modal
        open={cotacaoModalOpen}
        onClose={() => { setCotacaoModalOpen(false); setPedidoParaCotacao(null); setEditandoCotacao(null); }}
        title={editandoCotacao ? `Editar cotação ${editandoCotacao.numero}` : 'Nova cotação'}
        size="xl"
      >
        <CotacaoFormV2
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
          onGerarOC={(cot, fornecedorId, itemIds) => {
            // Salva primeiro a cotação (se pendente) e depois delega
            handleGerarOCdeCotacao(cot, fornecedorId, itemIds);
          }}
          onAbrirEnviar={(cot) => setEnviarCotacao(cot)}
          onCreateFornecedor={async (nome) => {
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            await adicionarFornecedorMut.mutateAsync({
              id, nome,
              cnpj: '', telefone: '', email: '', observacoes: '',
              ativo: true, criadoPor: usuario?.nome || '',
              ehTransportadora: false, taxaLitroPadrao: 0, ehDonaDeTanque: false,
            });
            return id;
          }}
        />
      </Modal>

      {/* Modal Enviar para fornecedor (V2 — gera links públicos) */}
      <EnviarCotacaoFornecedorModal
        open={!!enviarCotacao}
        cotacao={enviarCotacao}
        fornecedores={fornecedores}
        onClose={() => setEnviarCotacao(null)}
      />

      {/* Modal OC (V2 — destinos múltiplos + workflow de aprovação) */}
      <Modal
        open={ocModalOpen}
        onClose={() => { setOcModalOpen(false); setEditandoOC(null); }}
        title={editandoOC?.id ? `Editar OC ${editandoOC.numero}` : 'Nova Ordem de Compra'}
        size="xl"
      >
        <OrdemCompraFormV2
          initial={editandoOC}
          obras={obras}
          etapas={etapas}
          fornecedores={fornecedores}
          insumos={insumos}
          equipamentos={equipamentos}
          // Temporariamente exibe só EMT Construtora no combobox "Faturar para".
          // Para liberar todas as empresas cadastradas, basta trocar por `empresas`.
          empresas={empresasFaturamento}
          depositosMaterial={depositosMaterial}
          tanquesCombustivel={depositosCombustivel}
          proximoNumero={proxOC}
          onSubmit={handleOCSubmit}
          onCancel={() => { setOcModalOpen(false); setEditandoOC(null); }}
          onAprovar={handleAprovarOCv2}
          onGerarLancamento={(oc) => setGerarLancamentoOC(oc)}
          onCreateFornecedor={async (nome) => {
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            await adicionarFornecedorMut.mutateAsync({
              id, nome,
              cnpj: '', telefone: '', email: '', observacoes: '',
              ativo: true, criadoPor: usuario?.nome || '',
              ehTransportadora: false, taxaLitroPadrao: 0, ehDonaDeTanque: false,
            });
            return id;
          }}
        />
      </Modal>

      {/* Modal de geração de lançamento financeiro (placeholder até módulo Financeiro existir) */}
      <GerarLancamentoFinanceiroModal
        open={!!gerarLancamentoOC}
        oc={gerarLancamentoOC}
        fornecedor={gerarLancamentoOC ? fornecedores.find((f) => f.id === gerarLancamentoOC.fornecedorId) : undefined}
        onClose={() => setGerarLancamentoOC(null)}
        onConfirm={handleConfirmarLancamento}
      />

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
        message="Esta cotação será movida para a lixeira (30 dias)."
        onConfirm={handleExcluirCotacao}
        onClose={() => setDeleteCotacaoId(null)}
      />

      {/* Lixeira (V2 Fase 5) */}
      <LixeiraCompras open={lixeiraAberta} onClose={() => setLixeiraAberta(false)} />
    </div>
  );
}
