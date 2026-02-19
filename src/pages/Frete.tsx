import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Frete as FreteType, FiltrosFrete, Localidade, PagamentoFrete, AbastecimentoCarreta, PedidoMaterial } from '../types';
import { useFretes, useAdicionarFrete, useAtualizarFrete, useExcluirFrete } from '../hooks/useFretes';
import { usePagamentosFrete, useAdicionarPagamentoFrete, useAtualizarPagamentoFrete, useExcluirPagamentoFrete } from '../hooks/usePagamentosFrete';
import { useAbastecimentosCarreta, useAdicionarAbastecimentoCarreta, useAtualizarAbastecimentoCarreta, useExcluirAbastecimentoCarreta } from '../hooks/useAbastecimentosCarreta';
import { usePedidosMaterial, useAdicionarPedidoMaterial, useAtualizarPedidoMaterial, useExcluirPedidoMaterial } from '../hooks/usePedidosMaterial';
import { useObras } from '../hooks/useObras';
import { useInsumos } from '../hooks/useInsumos';
import { useLocalidades, useAdicionarLocalidade } from '../hooks/useLocalidades';
import { useFuncionarios } from '../hooks/useFuncionarios';
import { useFornecedores } from '../hooks/useFornecedores';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import FilterCombobox from '../components/ui/FilterCombobox';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PasswordDialog from '../components/ui/PasswordDialog';
import FreteForm from '../components/frete/FreteForm';
import FreteList from '../components/frete/FreteList';
import PagamentoFreteForm from '../components/frete/PagamentoFreteForm';
import PagamentoFreteList from '../components/frete/PagamentoFreteList';
import AbastecimentoCarretaForm from '../components/frete/AbastecimentoCarretaForm';
import AbastecimentoCarretaList from '../components/frete/AbastecimentoCarretaList';
import FreteDashboard from '../components/frete/FreteDashboard';
import PedidoMaterialForm from '../components/frete/PedidoMaterialForm';
import PedidoMaterialList from '../components/frete/PedidoMaterialList';

type Tab = 'dashboard' | 'fretes' | 'pagamentos' | 'abastecimentos' | 'pedidos';

export default function Frete() {
  const { temAcao, usuario } = useAuth();
  const canCreate = temAcao('criar_frete');
  const canEdit = temAcao('editar_frete');
  const canDelete = temAcao('excluir_frete');

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['dashboard', 'fretes', 'pagamentos', 'abastecimentos', 'pedidos'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'dashboard';
  const setTab = useCallback((t: Tab) => setSearchParams({ tab: t }, { replace: true }), [setSearchParams]);

  const { data: fretes = [], isLoading } = useFretes();
  const { data: obras = [] } = useObras();
  const { data: insumos = [] } = useInsumos();
  const { data: localidades = [] } = useLocalidades();
  const { data: funcionarios = [] } = useFuncionarios();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: pagamentosFrete = [] } = usePagamentosFrete();
  const adicionarMutation = useAdicionarFrete();
  const atualizarMutation = useAtualizarFrete();
  const excluirMutation = useExcluirFrete();
  const adicionarLocalidadeMutation = useAdicionarLocalidade();
  const adicionarPagamentoMutation = useAdicionarPagamentoFrete();
  const atualizarPagamentoMutation = useAtualizarPagamentoFrete();
  const excluirPagamentoMutation = useExcluirPagamentoFrete();
  const { data: abastecimentosCarreta = [] } = useAbastecimentosCarreta();
  const adicionarAbastCarretaMutation = useAdicionarAbastecimentoCarreta();
  const atualizarAbastCarretaMutation = useAtualizarAbastecimentoCarreta();
  const excluirAbastCarretaMutation = useExcluirAbastecimentoCarreta();
  const { data: pedidosMaterial = [] } = usePedidosMaterial();
  const adicionarPedidoMutation = useAdicionarPedidoMaterial();
  const atualizarPedidoMutation = useAtualizarPedidoMaterial();
  const excluirPedidoMutation = useExcluirPedidoMaterial();

  // Filter insumos: materials + combustiveis
  const insumosAtivos = insumos.filter((i) => i.ativo !== false);
  const combustiveis = insumos.filter((i) => i.tipo === 'combustivel' && i.ativo !== false);

  // Nomes dos fornecedores ativos como opcoes de transportadora
  const transportadoras = useMemo(() => {
    return fornecedores
      .filter((f) => f.ativo !== false)
      .map((f) => f.nome)
      .sort();
  }, [fornecedores]);

  // Extract unique meses from pagamentos
  const mesesPagamento = useMemo(() => {
    const set = new Set(pagamentosFrete.map((p) => p.mesReferencia).filter(Boolean));
    return Array.from(set).sort();
  }, [pagamentosFrete]);

  // Extract unique pagoPor from pagamentos
  const pagoPorOpcoes = useMemo(() => {
    const set = new Set(pagamentosFrete.map((p) => p.pagoPor).filter(Boolean));
    return Array.from(set).sort();
  }, [pagamentosFrete]);

  const METODO_OPTIONS = [
    { value: 'pix', label: 'Pix' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'transferencia', label: 'Transferência' },
    { value: 'combustivel', label: 'Combustível' },
  ];

  // ── Frete Form state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<FreteType | null>(null);

  // Localidade modal state
  const [localidadeModalOpen, setLocalidadeModalOpen] = useState(false);
  const [novaLocalidadeNome, setNovaLocalidadeNome] = useState('');
  const [novaLocalidadeEndereco, setNovaLocalidadeEndereco] = useState('');

  // Frete delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Frete filters
  const [filtros, setFiltros] = useState<FiltrosFrete>({
    obraId: '',
    transportadora: '',
    motorista: '',
    insumoId: '',
    origem: '',
    dataInicio: '',
    dataFim: '',
  });

  // Extract unique motoristas from fretes
  const motoristas = useMemo(() => {
    const set = new Set(fretes.map((f) => f.motorista).filter(Boolean));
    return Array.from(set).sort();
  }, [fretes]);

  // Extract unique origens (pedreiras) from fretes
  const origens = useMemo(() => {
    const set = new Set(fretes.map((f) => f.origem?.trim()).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [fretes]);

  // ── Pagamento Frete state ──
  const [pagModalOpen, setPagModalOpen] = useState(false);
  const [pagEditando, setPagEditando] = useState<PagamentoFrete | null>(null);
  const [pagDeleteId, setPagDeleteId] = useState<string | null>(null);

  // Pagamento filters
  const [pagFiltroTransportadora, setPagFiltroTransportadora] = useState('');
  const [pagFiltroMes, setPagFiltroMes] = useState('');
  const [pagFiltroMetodo, setPagFiltroMetodo] = useState('');
  const [pagFiltroPagoPor, setPagFiltroPagoPor] = useState('');
  const [pagFiltroDataInicio, setPagFiltroDataInicio] = useState('');
  const [pagFiltroDataFim, setPagFiltroDataFim] = useState('');

  // ── Abastecimento Carreta state ──
  const [abastModalOpen, setAbastModalOpen] = useState(false);
  const [editandoAbast, setEditandoAbast] = useState<AbastecimentoCarreta | null>(null);
  const [abastDeleteId, setAbastDeleteId] = useState<string | null>(null);

  // Abastecimento filters
  const [abastFiltroTransportadora, setAbastFiltroTransportadora] = useState('');
  const [abastFiltroPlaca, setAbastFiltroPlaca] = useState('');
  const [abastFiltroCombustivel, setAbastFiltroCombustivel] = useState('');
  const [abastFiltroMes, setAbastFiltroMes] = useState('');
  const [abastFiltroDataInicio, setAbastFiltroDataInicio] = useState('');
  const [abastFiltroDataFim, setAbastFiltroDataFim] = useState('');

  // Extract unique placas from abastecimentos
  const placasAbast = useMemo(() => {
    const set = new Set(abastecimentosCarreta.map((a) => a.placaCarreta).filter(Boolean));
    return Array.from(set).sort();
  }, [abastecimentosCarreta]);

  // Extract unique meses from abastecimentos
  const mesesAbast = useMemo(() => {
    const set = new Set(abastecimentosCarreta.map((a) => a.mesReferencia).filter(Boolean));
    return Array.from(set).sort();
  }, [abastecimentosCarreta]);

  // ── Pedido Material state ──
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [pedidoEditando, setPedidoEditando] = useState<PedidoMaterial | null>(null);
  const [pedidoDeleteId, setPedidoDeleteId] = useState<string | null>(null);

  // Pedido filters
  const [pedidoFiltroFornecedor, setPedidoFiltroFornecedor] = useState('');
  const [pedidoFiltroMaterial, setPedidoFiltroMaterial] = useState('');
  const [pedidoFiltroDataInicio, setPedidoFiltroDataInicio] = useState('');
  const [pedidoFiltroDataFim, setPedidoFiltroDataFim] = useState('');

  // Password gate
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaAction, setSenhaAction] = useState<(() => void) | null>(null);

  function pedirSenha(action: () => void) {
    if (usuario?.cargo === 'Administrador') {
      action();
      return;
    }
    setSenhaAction(() => action);
    setSenhaOpen(true);
  }

  // ── Frete handlers ──
  const handleSubmit = useCallback(
    async (frete: FreteType) => {
      if (editando) {
        await atualizarMutation.mutateAsync(frete);
      } else {
        await adicionarMutation.mutateAsync({ ...frete, criadoPor: usuario?.nome || '' });
      }
      setModalOpen(false);
      setEditando(null);
    },
    [editando, adicionarMutation, atualizarMutation]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await excluirMutation.mutateAsync(id);
      setDeleteId(null);
    },
    [excluirMutation]
  );

  // ── Pagamento handlers ──
  const handlePagSubmit = useCallback(
    async (pagamento: PagamentoFrete) => {
      if (pagEditando) {
        await atualizarPagamentoMutation.mutateAsync(pagamento);
      } else {
        await adicionarPagamentoMutation.mutateAsync({ ...pagamento, criadoPor: usuario?.nome || '' });
      }
      setPagModalOpen(false);
      setPagEditando(null);
    },
    [pagEditando, adicionarPagamentoMutation, atualizarPagamentoMutation]
  );

  const handlePagDelete = useCallback(
    async (id: string) => {
      await excluirPagamentoMutation.mutateAsync(id);
      setPagDeleteId(null);
    },
    [excluirPagamentoMutation]
  );

  // ── Abastecimento Carreta handlers ──
  const handleAbastSubmit = useCallback(
    async (abast: AbastecimentoCarreta) => {
      try {
        if (editandoAbast) {
          await atualizarAbastCarretaMutation.mutateAsync(abast);
        } else {
          await adicionarAbastCarretaMutation.mutateAsync({ ...abast, criadoPor: usuario?.nome || '' });
        }
        setAbastModalOpen(false);
        setEditandoAbast(null);
      } catch (err) {
        console.error('Erro ao salvar abastecimento:', err);
      }
    },
    [editandoAbast, adicionarAbastCarretaMutation, atualizarAbastCarretaMutation, usuario]
  );

  const handleAbastDelete = useCallback(
    async (id: string) => {
      await excluirAbastCarretaMutation.mutateAsync(id);
      setAbastDeleteId(null);
    },
    [excluirAbastCarretaMutation]
  );

  // ── Pedido Material handlers ──
  const handlePedidoSubmit = useCallback(
    async (pedido: PedidoMaterial) => {
      if (pedidoEditando) {
        await atualizarPedidoMutation.mutateAsync(pedido);
      } else {
        await adicionarPedidoMutation.mutateAsync({ ...pedido, criadoPor: usuario?.nome || '' });
      }
      setPedidoModalOpen(false);
      setPedidoEditando(null);
    },
    [pedidoEditando, adicionarPedidoMutation, atualizarPedidoMutation, usuario]
  );

  const handlePedidoDelete = useCallback(
    async (id: string) => {
      await excluirPedidoMutation.mutateAsync(id);
      setPedidoDeleteId(null);
    },
    [excluirPedidoMutation]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'fretes', label: 'Fretes' },
    { key: 'pagamentos', label: 'Pagamentos' },
    { key: 'abastecimentos', label: 'Abastecimentos' },
    { key: 'pedidos', label: 'Pedidos' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Frete</h1>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setLocalidadeModalOpen(true)}>
              Nova Localidade
            </Button>
            <Button variant="secondary" onClick={() => { setPedidoEditando(null); setPedidoModalOpen(true); }}>
              Novo Pedido
            </Button>
            <Button variant="secondary" onClick={() => { setEditandoAbast(null); setAbastModalOpen(true); }}>
              Novo Abastecimento
            </Button>
            <Button variant="secondary" onClick={() => { setPagEditando(null); setPagModalOpen(true); }}>
              Novo Pagamento
            </Button>
            <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
              Novo Frete
            </Button>
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

      {/* ── Dashboard Tab ── */}
      {tab === 'dashboard' && (
        <FreteDashboard
          fretes={fretes}
          pagamentos={pagamentosFrete}
          abastecimentosCarreta={abastecimentosCarreta}
          obras={obras}
          pedidosMaterial={pedidosMaterial}
          fornecedores={fornecedores}
        />
      )}

      {/* ── Fretes Tab ── */}
      {tab === 'fretes' && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-4">
            <FilterCombobox
              className="w-48"
              value={filtros.obraId}
              onChange={(v) => setFiltros((f) => ({ ...f, obraId: v }))}
              options={obras.map((o) => ({ value: o.id, label: o.nome }))}
              placeholder="Todas as obras"
            />
            <FilterCombobox
              className="w-48"
              value={filtros.transportadora}
              onChange={(v) => setFiltros((f) => ({ ...f, transportadora: v }))}
              options={transportadoras.map((t) => ({ value: t, label: t }))}
              placeholder="Todas as transportadoras"
            />
            <FilterCombobox
              className="w-48"
              value={filtros.motorista}
              onChange={(v) => setFiltros((f) => ({ ...f, motorista: v }))}
              options={motoristas.map((m) => ({ value: m, label: m }))}
              placeholder="Todos os motoristas"
            />
            <FilterCombobox
              className="w-48"
              value={filtros.insumoId}
              onChange={(v) => setFiltros((f) => ({ ...f, insumoId: v }))}
              options={insumosAtivos.map((i) => ({ value: i.id, label: i.nome }))}
              placeholder="Todos os materiais"
            />
            <FilterCombobox
              className="w-48"
              value={filtros.origem}
              onChange={(v) => setFiltros((f) => ({ ...f, origem: v }))}
              options={origens.map((o) => ({ value: o, label: o }))}
              placeholder="Todas as pedreiras"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
              title="Data inicio"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
              title="Data fim"
            />
            {(filtros.obraId || filtros.transportadora || filtros.motorista || filtros.insumoId || filtros.origem || filtros.dataInicio || filtros.dataFim) && (
              <button
                className="text-sm text-emt-verde hover:text-emt-verde-escuro font-medium"
                onClick={() => setFiltros({ obraId: '', transportadora: '', motorista: '', insumoId: '', origem: '', dataInicio: '', dataFim: '' })}
              >
                Limpar filtros
              </button>
            )}
          </div>

          <FreteList
            fretes={fretes}
            obras={obras}
            insumos={insumosAtivos}
            filtros={filtros}
            onEdit={(frete) => pedirSenha(() => { setEditando(frete); setModalOpen(true); })}
            onDelete={(id) => pedirSenha(() => setDeleteId(id))}
            onUpdateDataChegada={canEdit ? async (frete, dataChegada) => {
              await atualizarMutation.mutateAsync({ ...frete, dataChegada });
            } : undefined}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}

      {/* ── Pagamentos Tab ── */}
      {tab === 'pagamentos' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <FilterCombobox
              className="w-48"
              value={pagFiltroTransportadora}
              onChange={setPagFiltroTransportadora}
              options={transportadoras.map((t) => ({ value: t, label: t }))}
              placeholder="Todas as transportadoras"
            />
            <FilterCombobox
              className="w-48"
              value={pagFiltroMes}
              onChange={setPagFiltroMes}
              options={mesesPagamento.map((m) => {
                const [ano, mes] = m.split('-');
                const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                return { value: m, label: `${nomes[parseInt(mes, 10) - 1]}/${ano}` };
              })}
              placeholder="Todos os meses"
            />
            <FilterCombobox
              className="w-48"
              value={pagFiltroMetodo}
              onChange={setPagFiltroMetodo}
              options={METODO_OPTIONS}
              placeholder="Todos os métodos"
            />
            <FilterCombobox
              className="w-48"
              value={pagFiltroPagoPor}
              onChange={setPagFiltroPagoPor}
              options={pagoPorOpcoes.map((p) => ({ value: p, label: p }))}
              placeholder="Todos - Pago Por"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={pagFiltroDataInicio}
              onChange={(e) => setPagFiltroDataInicio(e.target.value)}
              title="Data início"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={pagFiltroDataFim}
              onChange={(e) => setPagFiltroDataFim(e.target.value)}
              title="Data fim"
            />
            {(pagFiltroTransportadora || pagFiltroMes || pagFiltroMetodo || pagFiltroPagoPor || pagFiltroDataInicio || pagFiltroDataFim) && (
              <button
                className="text-sm text-emt-verde hover:text-emt-verde-escuro font-medium"
                onClick={() => { setPagFiltroTransportadora(''); setPagFiltroMes(''); setPagFiltroMetodo(''); setPagFiltroPagoPor(''); setPagFiltroDataInicio(''); setPagFiltroDataFim(''); }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          <PagamentoFreteList
            pagamentos={pagamentosFrete}
            filtroTransportadora={pagFiltroTransportadora}
            filtroMes={pagFiltroMes}
            filtroMetodo={pagFiltroMetodo}
            filtroPagoPor={pagFiltroPagoPor}
            filtroDataInicio={pagFiltroDataInicio}
            filtroDataFim={pagFiltroDataFim}
            onEdit={(pag) => pedirSenha(() => { setPagEditando(pag); setPagModalOpen(true); })}
            onDelete={(id) => pedirSenha(() => setPagDeleteId(id))}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}

      {/* ── Abastecimentos Tab ── */}
      {tab === 'abastecimentos' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <FilterCombobox
              className="w-48"
              value={abastFiltroTransportadora}
              onChange={setAbastFiltroTransportadora}
              options={transportadoras.map((t) => ({ value: t, label: t }))}
              placeholder="Todas as transportadoras"
            />
            <FilterCombobox
              className="w-48"
              value={abastFiltroPlaca}
              onChange={setAbastFiltroPlaca}
              options={placasAbast.map((p) => ({ value: p, label: p }))}
              placeholder="Todas as placas"
            />
            <FilterCombobox
              className="w-48"
              value={abastFiltroCombustivel}
              onChange={setAbastFiltroCombustivel}
              options={combustiveis.map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Todos os combustíveis"
            />
            <FilterCombobox
              className="w-48"
              value={abastFiltroMes}
              onChange={setAbastFiltroMes}
              options={mesesAbast.map((m) => {
                const [ano, mes] = m.split('-');
                const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                return { value: m, label: `${nomes[parseInt(mes, 10) - 1]}/${ano}` };
              })}
              placeholder="Todos os meses"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={abastFiltroDataInicio}
              onChange={(e) => setAbastFiltroDataInicio(e.target.value)}
              title="Data início"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={abastFiltroDataFim}
              onChange={(e) => setAbastFiltroDataFim(e.target.value)}
              title="Data fim"
            />
            {(abastFiltroTransportadora || abastFiltroPlaca || abastFiltroCombustivel || abastFiltroMes || abastFiltroDataInicio || abastFiltroDataFim) && (
              <button
                className="text-sm text-emt-verde hover:text-emt-verde-escuro font-medium"
                onClick={() => { setAbastFiltroTransportadora(''); setAbastFiltroPlaca(''); setAbastFiltroCombustivel(''); setAbastFiltroMes(''); setAbastFiltroDataInicio(''); setAbastFiltroDataFim(''); }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          <AbastecimentoCarretaList
            abastecimentos={abastecimentosCarreta}
            combustiveis={combustiveis}
            filtroTransportadora={abastFiltroTransportadora}
            filtroPlaca={abastFiltroPlaca}
            filtroCombustivel={abastFiltroCombustivel}
            filtroMes={abastFiltroMes}
            filtroDataInicio={abastFiltroDataInicio}
            filtroDataFim={abastFiltroDataFim}
            onEdit={(abast) => pedirSenha(() => { setEditandoAbast(abast); setAbastModalOpen(true); })}
            onDelete={(id) => pedirSenha(() => setAbastDeleteId(id))}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}

      {/* ── Pedidos Tab ── */}
      {tab === 'pedidos' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <FilterCombobox
              className="w-48"
              value={pedidoFiltroFornecedor}
              onChange={setPedidoFiltroFornecedor}
              options={fornecedores.filter((f) => f.ativo !== false).map((f) => ({ value: f.id, label: f.nome }))}
              placeholder="Todos os fornecedores"
            />
            <FilterCombobox
              className="w-48"
              value={pedidoFiltroMaterial}
              onChange={setPedidoFiltroMaterial}
              options={insumosAtivos.map((i) => ({ value: i.id, label: i.nome }))}
              placeholder="Todos os materiais"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={pedidoFiltroDataInicio}
              onChange={(e) => setPedidoFiltroDataInicio(e.target.value)}
              title="Data início"
            />
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              type="date"
              value={pedidoFiltroDataFim}
              onChange={(e) => setPedidoFiltroDataFim(e.target.value)}
              title="Data fim"
            />
            {(pedidoFiltroFornecedor || pedidoFiltroMaterial || pedidoFiltroDataInicio || pedidoFiltroDataFim) && (
              <button
                className="text-sm text-emt-verde hover:text-emt-verde-escuro font-medium"
                onClick={() => { setPedidoFiltroFornecedor(''); setPedidoFiltroMaterial(''); setPedidoFiltroDataInicio(''); setPedidoFiltroDataFim(''); }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          <PedidoMaterialList
            pedidos={pedidosMaterial}
            fornecedores={fornecedores}
            insumos={insumosAtivos}
            filtroFornecedor={pedidoFiltroFornecedor}
            filtroMaterial={pedidoFiltroMaterial}
            filtroDataInicio={pedidoFiltroDataInicio}
            filtroDataFim={pedidoFiltroDataFim}
            onEdit={(pedido) => pedirSenha(() => { setPedidoEditando(pedido); setPedidoModalOpen(true); })}
            onDelete={(id) => pedirSenha(() => setPedidoDeleteId(id))}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}

      {/* Modal Frete Form */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        title={editando ? 'Editar Frete' : 'Novo Frete'}
      >
        <FreteForm
          initial={editando}
          onSubmit={handleSubmit}
          onCancel={() => { setModalOpen(false); setEditando(null); }}
          obras={obras}
          insumos={insumosAtivos}
          localidades={localidades}
          transportadoras={transportadoras}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarMutation.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalOpen(false);
            setEditando(null);
          }}
        />
      </Modal>

      {/* Modal Pagamento Frete Form */}
      <Modal
        open={pagModalOpen}
        onClose={() => { setPagModalOpen(false); setPagEditando(null); }}
        title={pagEditando ? 'Editar Pagamento' : 'Novo Pagamento'}
      >
        <PagamentoFreteForm
          initial={pagEditando}
          onSubmit={handlePagSubmit}
          onCancel={() => { setPagModalOpen(false); setPagEditando(null); }}
          transportadoras={transportadoras}
          funcionarios={funcionarios}
          fornecedores={fornecedores}
          nomeUsuario={usuario?.nome}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarPagamentoMutation.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setPagModalOpen(false);
            setPagEditando(null);
          }}
        />
      </Modal>

      {/* Modal Localidades */}
      <Modal
        open={localidadeModalOpen}
        onClose={() => { setLocalidadeModalOpen(false); setNovaLocalidadeNome(''); setNovaLocalidadeEndereco(''); }}
        title="Localidades"
      >
        <div className="space-y-6">
          {/* Form nova localidade */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const nome = novaLocalidadeNome.trim();
              if (!nome) return;
              const nova: Localidade = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                nome,
                endereco: novaLocalidadeEndereco.trim(),
                ativo: true,
                criadoPor: usuario?.nome || '',
              };
              await adicionarLocalidadeMutation.mutateAsync(nova);
              setNovaLocalidadeNome('');
              setNovaLocalidadeEndereco('');
            }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold text-gray-700">Adicionar nova localidade</h3>
            <Input
              label="Nome"
              id="novaLocalidadeNome"
              type="text"
              value={novaLocalidadeNome}
              onChange={(e) => setNovaLocalidadeNome(e.target.value)}
              placeholder="Ex: Sao Paulo, Pedreira central..."
              required
              autoFocus
            />
            <Input
              label="Link / Endereço (opcional)"
              id="novaLocalidadeEndereco"
              type="text"
              value={novaLocalidadeEndereco}
              onChange={(e) => setNovaLocalidadeEndereco(e.target.value)}
              placeholder="Ex: https://maps.google.com/..."
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!novaLocalidadeNome.trim()}>
                Adicionar
              </Button>
            </div>
          </form>

          {/* Lista de localidades cadastradas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Localidades cadastradas ({localidades.length})
            </h3>
            {localidades.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma localidade cadastrada.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {localidades.map((loc) => (
                  <div key={loc.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{loc.nome}</p>
                      {loc.endereco && (
                        <a
                          href={loc.endereco}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emt-verde hover:text-emt-verde-escuro underline truncate block"
                        >
                          {loc.endereco}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => { setLocalidadeModalOpen(false); setNovaLocalidadeNome(''); setNovaLocalidadeEndereco(''); }}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      <PasswordDialog
        open={senhaOpen}
        onClose={() => {
          setSenhaOpen(false);
          setSenhaAction(null);
        }}
        onSuccess={() => {
          if (senhaAction) senhaAction();
          setSenhaAction(null);
        }}
        title="Senha de Confirmação"
      />

      {/* Confirm Delete Frete */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
        title="Excluir Frete"
        message="Tem certeza que deseja excluir este frete? Esta ação não pode ser desfeita."
      />

      {/* Confirm Delete Pagamento */}
      <ConfirmDialog
        open={pagDeleteId !== null}
        onClose={() => setPagDeleteId(null)}
        onConfirm={() => { if (pagDeleteId) handlePagDelete(pagDeleteId); }}
        title="Excluir Pagamento"
        message="Tem certeza que deseja excluir este pagamento? Esta ação não pode ser desfeita."
      />

      {/* Modal Abastecimento Carreta Form */}
      <Modal
        open={abastModalOpen}
        onClose={() => { setAbastModalOpen(false); setEditandoAbast(null); }}
        title={editandoAbast ? 'Editar Abastecimento' : 'Novo Abastecimento'}
      >
        <AbastecimentoCarretaForm
          initial={editandoAbast}
          onSubmit={handleAbastSubmit}
          onCancel={() => { setAbastModalOpen(false); setEditandoAbast(null); }}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarAbastCarretaMutation.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setAbastModalOpen(false);
            setEditandoAbast(null);
          }}
        />
      </Modal>

      {/* Confirm Delete Abastecimento Carreta */}
      <ConfirmDialog
        open={abastDeleteId !== null}
        onClose={() => setAbastDeleteId(null)}
        onConfirm={() => { if (abastDeleteId) handleAbastDelete(abastDeleteId); }}
        title="Excluir Abastecimento"
        message="Tem certeza que deseja excluir este abastecimento? Esta ação não pode ser desfeita."
      />

      {/* Modal Pedido Material Form */}
      <Modal
        open={pedidoModalOpen}
        onClose={() => { setPedidoModalOpen(false); setPedidoEditando(null); }}
        title={pedidoEditando ? 'Editar Pedido de Material' : 'Novo Pedido de Material'}
        size="xl"
      >
        <PedidoMaterialForm
          initial={pedidoEditando}
          onSubmit={handlePedidoSubmit}
          onCancel={() => { setPedidoModalOpen(false); setPedidoEditando(null); }}
          fornecedores={fornecedores}
          insumos={insumosAtivos}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarPedidoMutation.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setPedidoModalOpen(false);
            setPedidoEditando(null);
          }}
        />
      </Modal>

      {/* Confirm Delete Pedido Material */}
      <ConfirmDialog
        open={pedidoDeleteId !== null}
        onClose={() => setPedidoDeleteId(null)}
        onConfirm={() => { if (pedidoDeleteId) handlePedidoDelete(pedidoDeleteId); }}
        title="Excluir Pedido"
        message="Tem certeza que deseja excluir este pedido de material? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
