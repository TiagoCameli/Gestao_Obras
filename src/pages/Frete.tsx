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
import { exportarFretesPDF, exportarFretesExcel } from '../utils/freteExport';
import ImportAtualizacaoFretesModal from '../components/frete/ImportAtualizacaoFretesModal';
import { exportarPedidosMaterialExcel, exportarPedidosMaterialPDF } from '../utils/pedidosMaterialExport';
import { exportarAbastecimentosCarretaExcel, exportarAbastecimentosCarretaPDF } from '../utils/abastecimentoCarretaExport';
import FilterBar from '../components/frete/FilterBar';
import { Truck, Sparkles, BarChart3, Wallet, Fuel, PackageSearch } from 'lucide-react';

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

  // Import atualização modal
  const [importAtualizacaoOpen, setImportAtualizacaoOpen] = useState(false);

  // Frete filters
  const [filtros, setFiltros] = useState<FiltrosFrete>({
    obraId: '',
    transportadora: '',
    motorista: '',
    insumoId: '',
    origem: '',
    destino: '',
    dataInicio: '',
    dataFim: '',
    notaFiscal: '',
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

  // Extract unique destinos (locais de entrega) from fretes
  const destinos = useMemo(() => {
    const set = new Set(fretes.map((f) => f.destino?.trim()).filter(Boolean));
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
        <p className="text-[var(--color-fg-subtle)]">Carregando...</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: 'fretes', label: 'Fretes', icon: <Truck className="h-3.5 w-3.5" /> },
    { key: 'pagamentos', label: 'Pagamentos', icon: <Wallet className="h-3.5 w-3.5" /> },
    { key: 'abastecimentos', label: 'Abastecimento Transterra', icon: <Fuel className="h-3.5 w-3.5" /> },
    { key: 'pedidos', label: 'Pedidos', icon: <PackageSearch className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      className="frete-premium ambient-bg -mx-3 sm:-mx-6 -my-6 sm:-my-8 px-3 sm:px-6 py-6 sm:py-8 min-h-[calc(100dvh-64px)]"
      style={
        {
          /* Scope: o accent da página vira âmbar, alinhando com o módulo
             de Medição. Nada fora desta página é afetado. */
          ['--color-accent' as string]: 'var(--color-accent-amber)',
          ['--color-accent-hover' as string]: 'var(--color-accent-amber-hover)',
          ['--color-accent-soft' as string]: 'var(--color-accent-amber-soft)',
          ['--color-accent-fg' as string]: 'var(--color-accent-amber-fg)',
          ['--color-ring' as string]: 'var(--color-accent-amber-glow)',
        } as React.CSSProperties
      }
    >
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
        <div className="flex items-start gap-4">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
              boxShadow: '0 10px 24px -8px var(--color-accent-amber-glow), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <Truck className="h-5 w-5" style={{ color: 'var(--color-fg-on-accent)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
              <span className="label-eyebrow">Operations · Logística</span>
            </div>
            <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[var(--color-fg)] leading-tight">
              Frete &amp; <span style={{ color: 'var(--color-accent)' }}>Logística</span>.
            </h1>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[640px] leading-relaxed">
              Fretes, pagamentos a transportadoras, abastecimentos de carreta e pedidos de material — tudo num painel unificado com controle granular de custos.
            </p>
          </div>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2 shrink-0">
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
              + Novo Frete
            </Button>
          </div>
        )}
      </div>

      {/* ── Premium tab bar com underline accent ─────────────────────── */}
      <div className="border-b border-[var(--color-border)] mb-6">
        <div className="flex gap-1 overflow-x-auto -mb-px">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <span className={active ? 'text-[var(--color-accent)]' : ''}>{t.icon}</span>
                {t.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent, var(--color-accent) 30%, var(--color-accent) 70%, transparent)',
                      boxShadow: '0 0 12px var(--color-accent-amber-glow)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
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
          <FilterBar
            search={{
              value: filtros.notaFiscal,
              onChange: (v) => setFiltros((f) => ({ ...f, notaFiscal: v })),
              placeholder: 'Buscar por nota fiscal...',
            }}
            fields={[
              { key: 'obraId', label: 'Obra', value: filtros.obraId, onChange: (v) => setFiltros((f) => ({ ...f, obraId: v })), options: obras.map((o) => ({ value: o.id, label: o.nome })), placeholder: 'Todas as obras' },
              { key: 'transportadora', label: 'Transportadora', value: filtros.transportadora, onChange: (v) => setFiltros((f) => ({ ...f, transportadora: v })), options: transportadoras.map((t) => ({ value: t, label: t })), placeholder: 'Todas as transportadoras' },
              { key: 'dataInicio', label: 'De', value: filtros.dataInicio, onChange: (v) => setFiltros((f) => ({ ...f, dataInicio: v })), type: 'date', placeholder: 'Data início' },
              { key: 'dataFim', label: 'Até', value: filtros.dataFim, onChange: (v) => setFiltros((f) => ({ ...f, dataFim: v })), type: 'date', placeholder: 'Data fim' },
              { key: 'motorista', label: 'Motorista', value: filtros.motorista, onChange: (v) => setFiltros((f) => ({ ...f, motorista: v })), options: motoristas.map((m) => ({ value: m, label: m })), placeholder: 'Todos os motoristas', collapsed: true },
              { key: 'insumoId', label: 'Material', value: filtros.insumoId, onChange: (v) => setFiltros((f) => ({ ...f, insumoId: v })), options: insumosAtivos.map((i) => ({ value: i.id, label: i.nome })), placeholder: 'Todos os materiais', collapsed: true },
              { key: 'origem', label: 'Pedreira', value: filtros.origem, onChange: (v) => setFiltros((f) => ({ ...f, origem: v })), options: origens.map((o) => ({ value: o, label: o })), placeholder: 'Todas as pedreiras', collapsed: true },
              { key: 'destino', label: 'Local de Entrega', value: filtros.destino, onChange: (v) => setFiltros((f) => ({ ...f, destino: v })), options: destinos.map((d) => ({ value: d, label: d })), placeholder: 'Todos os locais', collapsed: true },
            ]}
            onClearAll={() =>
              setFiltros({ obraId: '', transportadora: '', motorista: '', insumoId: '', origem: '', destino: '', dataInicio: '', dataFim: '', notaFiscal: '' })
            }
          />

          <div className="flex gap-2 mb-4">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => exportarFretesExcel(fretes, insumosAtivos, filtros)}
            >
              Exportar Excel
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => exportarFretesPDF(fretes, insumosAtivos, filtros)}
            >
              Exportar PDF
            </Button>
            {canEdit && (
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => setImportAtualizacaoOpen(true)}
              >
                Atualizar via Planilha
              </Button>
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
          <FilterBar
            fields={[
              { key: 'transportadora', label: 'Transportadora', value: pagFiltroTransportadora, onChange: setPagFiltroTransportadora, options: transportadoras.map((t) => ({ value: t, label: t })), placeholder: 'Todas as transportadoras' },
              {
                key: 'mes', label: 'Mês', value: pagFiltroMes, onChange: setPagFiltroMes,
                options: mesesPagamento.map((m) => {
                  const [ano, mes] = m.split('-');
                  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  return { value: m, label: `${nomes[parseInt(mes, 10) - 1]}/${ano}` };
                }),
                placeholder: 'Todos os meses',
              },
              { key: 'dataInicio', label: 'De', value: pagFiltroDataInicio, onChange: setPagFiltroDataInicio, type: 'date', placeholder: 'Data início' },
              { key: 'dataFim', label: 'Até', value: pagFiltroDataFim, onChange: setPagFiltroDataFim, type: 'date', placeholder: 'Data fim' },
              { key: 'metodo', label: 'Método', value: pagFiltroMetodo, onChange: setPagFiltroMetodo, options: METODO_OPTIONS, placeholder: 'Todos os métodos', collapsed: true },
              { key: 'pagoPor', label: 'Pago por', value: pagFiltroPagoPor, onChange: setPagFiltroPagoPor, options: pagoPorOpcoes.map((p) => ({ value: p, label: p })), placeholder: 'Todos - Pago Por', collapsed: true },
            ]}
            onClearAll={() => {
              setPagFiltroTransportadora(''); setPagFiltroMes(''); setPagFiltroMetodo('');
              setPagFiltroPagoPor(''); setPagFiltroDataInicio(''); setPagFiltroDataFim('');
            }}
          />

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
          <FilterBar
            fields={[
              { key: 'transportadora', label: 'Transportadora', value: abastFiltroTransportadora, onChange: setAbastFiltroTransportadora, options: transportadoras.map((t) => ({ value: t, label: t })), placeholder: 'Todas as transportadoras' },
              { key: 'placa', label: 'Placa', value: abastFiltroPlaca, onChange: setAbastFiltroPlaca, options: placasAbast.map((p) => ({ value: p, label: p })), placeholder: 'Todas as placas' },
              { key: 'dataInicio', label: 'De', value: abastFiltroDataInicio, onChange: setAbastFiltroDataInicio, type: 'date', placeholder: 'Data início' },
              { key: 'dataFim', label: 'Até', value: abastFiltroDataFim, onChange: setAbastFiltroDataFim, type: 'date', placeholder: 'Data fim' },
              { key: 'combustivel', label: 'Combustível', value: abastFiltroCombustivel, onChange: setAbastFiltroCombustivel, options: combustiveis.map((c) => ({ value: c.id, label: c.nome })), placeholder: 'Todos os combustíveis', collapsed: true },
              {
                key: 'mes', label: 'Mês', value: abastFiltroMes, onChange: setAbastFiltroMes,
                options: mesesAbast.map((m) => {
                  const [ano, mes] = m.split('-');
                  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  return { value: m, label: `${nomes[parseInt(mes, 10) - 1]}/${ano}` };
                }),
                placeholder: 'Todos os meses', collapsed: true,
              },
            ]}
            onClearAll={() => {
              setAbastFiltroTransportadora(''); setAbastFiltroPlaca(''); setAbastFiltroCombustivel('');
              setAbastFiltroMes(''); setAbastFiltroDataInicio(''); setAbastFiltroDataFim('');
            }}
          />

          <div className="flex gap-2 mb-4">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => exportarAbastecimentosCarretaExcel(abastecimentosCarreta, combustiveis, {
                transportadora: abastFiltroTransportadora,
                placa: abastFiltroPlaca,
                combustivelId: abastFiltroCombustivel,
                mesReferencia: abastFiltroMes,
                dataInicio: abastFiltroDataInicio,
                dataFim: abastFiltroDataFim,
              })}
            >
              Exportar Excel
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => exportarAbastecimentosCarretaPDF(abastecimentosCarreta, combustiveis, {
                transportadora: abastFiltroTransportadora,
                placa: abastFiltroPlaca,
                combustivelId: abastFiltroCombustivel,
                mesReferencia: abastFiltroMes,
                dataInicio: abastFiltroDataInicio,
                dataFim: abastFiltroDataFim,
              })}
            >
              Exportar PDF
            </Button>
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
          <FilterBar
            fields={[
              { key: 'fornecedor', label: 'Fornecedor', value: pedidoFiltroFornecedor, onChange: setPedidoFiltroFornecedor, options: fornecedores.filter((f) => f.ativo !== false).map((f) => ({ value: f.id, label: f.nome })), placeholder: 'Todos os fornecedores' },
              { key: 'material', label: 'Material', value: pedidoFiltroMaterial, onChange: setPedidoFiltroMaterial, options: insumosAtivos.map((i) => ({ value: i.id, label: i.nome })), placeholder: 'Todos os materiais' },
              { key: 'dataInicio', label: 'De', value: pedidoFiltroDataInicio, onChange: setPedidoFiltroDataInicio, type: 'date', placeholder: 'Data início' },
              { key: 'dataFim', label: 'Até', value: pedidoFiltroDataFim, onChange: setPedidoFiltroDataFim, type: 'date', placeholder: 'Data fim' },
            ]}
            onClearAll={() => {
              setPedidoFiltroFornecedor(''); setPedidoFiltroMaterial('');
              setPedidoFiltroDataInicio(''); setPedidoFiltroDataFim('');
            }}
          />

          <div className="flex gap-2 mb-4">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => exportarPedidosMaterialExcel(
                pedidosMaterial,
                fornecedores,
                insumosAtivos,
                { fornecedorId: pedidoFiltroFornecedor, materialId: pedidoFiltroMaterial, dataInicio: pedidoFiltroDataInicio, dataFim: pedidoFiltroDataFim }
              )}
            >
              Exportar Excel
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => exportarPedidosMaterialPDF(
                pedidosMaterial,
                fornecedores,
                insumosAtivos,
                { fornecedorId: pedidoFiltroFornecedor, materialId: pedidoFiltroMaterial, dataInicio: pedidoFiltroDataInicio, dataFim: pedidoFiltroDataFim }
              )}
            >
              Exportar PDF
            </Button>
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
          onSubmitBatch={async (pagamentos) => {
            for (const pag of pagamentos) {
              await adicionarPagamentoMutation.mutateAsync({ ...pag, criadoPor: usuario?.nome || '' });
            }
            setPagModalOpen(false);
            setPagEditando(null);
          }}
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

      <ImportAtualizacaoFretesModal
        open={importAtualizacaoOpen}
        onClose={() => setImportAtualizacaoOpen(false)}
        fretes={fretes}
        insumos={insumosAtivos}
        onUpdate={async (updates) => {
          for (const frete of updates) {
            await atualizarMutation.mutateAsync(frete as FreteType);
          }
        }}
      />
    </div>
  );
}
