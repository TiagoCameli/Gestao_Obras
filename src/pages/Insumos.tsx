import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  EntradaMaterial,
  SaidaMaterial,
  TransferenciaMaterial,
  FiltrosInsumos,
} from '../types';
import { useEntradasMaterial, useAdicionarEntradaMaterial, useAtualizarEntradaMaterial, useExcluirEntradaMaterial } from '../hooks/useEntradasMaterial';
import { useSaidasMaterial, useAdicionarSaidaMaterial, useAtualizarSaidaMaterial, useExcluirSaidaMaterial } from '../hooks/useSaidasMaterial';
import { useTransferenciasMaterial, useAdicionarTransferenciaMaterial, useExcluirTransferenciaMaterial } from '../hooks/useTransferenciasMaterial';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useDepositosMaterial } from '../hooks/useDepositosMaterial';
import { useInsumos } from '../hooks/useInsumos';
import { useFornecedores } from '../hooks/useFornecedores';
import { useUnidades } from '../hooks/useUnidades';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import PasswordDialog from '../components/ui/PasswordDialog';
import { useAuth } from '../contexts/AuthContext';
import InsumoFilters from '../components/insumos/InsumoFilters';
import EntradaMaterialForm from '../components/insumos/EntradaMaterialForm';
import EntradaMaterialList from '../components/insumos/EntradaMaterialList';
import SaidaMaterialForm from '../components/insumos/SaidaMaterialForm';
import SaidaMaterialList from '../components/insumos/SaidaMaterialList';
import TransferenciaMaterialForm from '../components/insumos/TransferenciaMaterialForm';
import TransferenciaMaterialList from '../components/insumos/TransferenciaMaterialList';
import InsumosDashboard from '../components/insumos/InsumosDashboard';
import ExportarInsumosModal from '../components/insumos/ExportarInsumosModal';

type Tab = 'dashboard' | 'entradas' | 'saidas' | 'transferencias';

const FILTROS_VAZIOS: FiltrosInsumos = {
  obraId: '',
  insumoId: '',
  dataInicio: '',
  dataFim: '',
};

export default function Insumos() {
  const { temAcao, usuario } = useAuth();
  const canEdit = temAcao('editar_insumos');
  const canDelete = temAcao('excluir_insumos');
  const canCreateEntrada = temAcao('criar_entrada_material');
  const canCreateSaida = temAcao('criar_saida_material');
  const canCreateTransferencia = temAcao('criar_transferencia_material');
  const canExport = temAcao('exportar_insumos');
  const canViewDashboard = temAcao('ver_dashboard_insumos');
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['dashboard', 'entradas', 'saidas', 'transferencias'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const defaultTab: Tab = canViewDashboard ? 'dashboard' : 'entradas';
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : defaultTab;
  const setTab = useCallback((t: Tab) => setSearchParams({ tab: t }, { replace: true }), [setSearchParams]);

  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: depositosMaterial = [], isLoading } = useDepositosMaterial();
  const { data: todasEntradas = [] } = useEntradasMaterial();
  const { data: todasSaidas = [] } = useSaidasMaterial();
  const { data: todasTransferencias = [] } = useTransferenciasMaterial();
  const { data: insumos = [] } = useInsumos();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: unidades = [] } = useUnidades();

  const adicionarEntradaMut = useAdicionarEntradaMaterial();
  const atualizarEntradaMut = useAtualizarEntradaMaterial();
  const excluirEntradaMut = useExcluirEntradaMaterial();
  const adicionarSaidaMut = useAdicionarSaidaMaterial();
  const atualizarSaidaMut = useAtualizarSaidaMaterial();
  const excluirSaidaMut = useExcluirSaidaMaterial();
  const adicionarTransferenciaMut = useAdicionarTransferenciaMaterial();
  const excluirTransferenciaMut = useExcluirTransferenciaMaterial();

  // Entrada state
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [editandoEntrada, setEditandoEntrada] = useState<EntradaMaterial | null>(null);

  // Saida state
  const [modalSaidaOpen, setModalSaidaOpen] = useState(false);
  const [editandoSaida, setEditandoSaida] = useState<SaidaMaterial | null>(null);

  // Transferencia state
  const [modalTransferenciaOpen, setModalTransferenciaOpen] = useState(false);

  // Exportar
  const [modalExportarOpen, setModalExportarOpen] = useState(false);

  // Filtros
  const [filtros, setFiltros] = useState<FiltrosInsumos>(FILTROS_VAZIOS);

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

  // Helper: filtrar por data
  function filtrarPorData(dataHora: string): boolean {
    if (filtros.dataInicio && new Date(dataHora) < new Date(filtros.dataInicio))
      return false;
    if (
      filtros.dataFim &&
      new Date(dataHora) > new Date(filtros.dataFim + 'T23:59:59')
    )
      return false;
    return true;
  }

  const entradasFiltradas = useMemo(() => {
    return todasEntradas.filter((e) => {
      if (filtros.obraId && e.obraId !== filtros.obraId) return false;
      if (filtros.insumoId && e.insumoId !== filtros.insumoId) return false;
      if (!filtrarPorData(e.dataHora)) return false;
      return true;
    });
  }, [todasEntradas, filtros]);

  const saidasFiltradas = useMemo(() => {
    return todasSaidas.filter((s) => {
      if (filtros.obraId && s.obraId !== filtros.obraId) return false;
      if (filtros.insumoId && s.insumoId !== filtros.insumoId) return false;
      if (!filtrarPorData(s.dataHora)) return false;
      return true;
    });
  }, [todasSaidas, filtros]);

  const transferenciasFiltradas = useMemo(() => {
    return todasTransferencias.filter((t) => {
      if (filtros.insumoId && t.insumoId !== filtros.insumoId) return false;
      if (!filtrarPorData(t.dataHora)) return false;
      return true;
    });
  }, [todasTransferencias, filtros]);

  // Entrada handlers
  const handleSubmitEntrada = useCallback(
    async (data: EntradaMaterial) => {
      if (editandoEntrada) {
        await atualizarEntradaMut.mutateAsync(data);
      } else {
        await adicionarEntradaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      }
      setModalEntradaOpen(false);
      setEditandoEntrada(null);
    },
    [editandoEntrada, atualizarEntradaMut, adicionarEntradaMut, usuario]
  );

  const handleEditEntrada = useCallback((ent: EntradaMaterial) => {
    pedirSenha(() => {
      setEditandoEntrada(ent);
      setModalEntradaOpen(true);
    });
  }, []);

  const handleDeleteEntrada = useCallback(async (id: string) => {
    await excluirEntradaMut.mutateAsync(id);
  }, [excluirEntradaMut]);

  // Saida handlers
  const handleSubmitSaida = useCallback(
    async (data: SaidaMaterial) => {
      if (editandoSaida) {
        await atualizarSaidaMut.mutateAsync(data);
      } else {
        await adicionarSaidaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      }
      setModalSaidaOpen(false);
      setEditandoSaida(null);
    },
    [editandoSaida, atualizarSaidaMut, adicionarSaidaMut, usuario]
  );

  const handleEditSaida = useCallback((saida: SaidaMaterial) => {
    pedirSenha(() => {
      setEditandoSaida(saida);
      setModalSaidaOpen(true);
    });
  }, []);

  const handleDeleteSaida = useCallback(async (id: string) => {
    await excluirSaidaMut.mutateAsync(id);
  }, [excluirSaidaMut]);

  // Transferencia handlers
  const handleSubmitTransferencia = useCallback(
    async (data: TransferenciaMaterial) => {
      await adicionarTransferenciaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      setModalTransferenciaOpen(false);
    },
    [adicionarTransferenciaMut, usuario]
  );

  const handleDeleteTransferencia = useCallback(async (id: string) => {
    await excluirTransferenciaMut.mutateAsync(id);
  }, [excluirTransferenciaMut]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    ...(canViewDashboard ? [{ key: 'dashboard' as Tab, label: 'Dashboard' }] : []),
    { key: 'entradas', label: 'Entradas' },
    { key: 'saidas', label: 'Saídas' },
    { key: 'transferencias', label: 'Transferências' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Insumos</h1>
        <div className="flex gap-3">
          {canCreateEntrada && (
            <Button
              onClick={() => {
                setEditandoEntrada(null);
                setModalEntradaOpen(true);
              }}
            >
              Nova Entrada
            </Button>
          )}
          {canCreateSaida && (
            <Button
              onClick={() => {
                setEditandoSaida(null);
                setModalSaidaOpen(true);
              }}
            >
              Nova Saída
            </Button>
          )}
          {canCreateTransferencia && (
            <Button onClick={() => setModalTransferenciaOpen(true)}>
              Nova Transferência
            </Button>
          )}
          {canExport && (
            <Button variant="secondary" onClick={() => setModalExportarOpen(true)}>
              Exportar Relatório
            </Button>
          )}
        </div>
      </div>

      {/* Filtros globais */}
      <InsumoFilters
        filtros={filtros}
        onChange={setFiltros}
        onClear={() => setFiltros(FILTROS_VAZIOS)}
        obras={obras}
        insumos={insumos}
      />

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

      {tab === 'dashboard' && (
        <InsumosDashboard
          entradas={entradasFiltradas}
          saidas={saidasFiltradas}
          todasEntradas={todasEntradas}
          todasSaidas={todasSaidas}
          obras={obras}
          etapas={etapas}
          depositosMaterial={depositosMaterial}
        />
      )}

      {tab === 'entradas' && (
        <EntradaMaterialList
          entradas={entradasFiltradas}
          obras={obras}
          depositosMaterial={depositosMaterial}
          onEdit={handleEditEntrada}
          onDelete={(id) => pedirSenha(() => handleDeleteEntrada(id))}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {tab === 'saidas' && (
        <SaidaMaterialList
          saidas={saidasFiltradas}
          obras={obras}
          depositosMaterial={depositosMaterial}
          etapas={etapas}
          onEdit={handleEditSaida}
          onDelete={(id) => pedirSenha(() => handleDeleteSaida(id))}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {tab === 'transferencias' && (
        <TransferenciaMaterialList
          transferencias={transferenciasFiltradas}
          depositosMaterial={depositosMaterial}
          onDelete={(id) => pedirSenha(() => handleDeleteTransferencia(id))}
          canDelete={canDelete}
        />
      )}

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
        title="Senha de Edição"
      />

      {/* Modal Entrada */}
      <Modal
        open={modalEntradaOpen}
        onClose={() => {
          setModalEntradaOpen(false);
          setEditandoEntrada(null);
        }}
        title={
          editandoEntrada ? 'Editar Entrada' : 'Nova Entrada de Material'
        }
      >
        <EntradaMaterialForm
          initial={editandoEntrada}
          onSubmit={handleSubmitEntrada}
          onCancel={() => {
            setModalEntradaOpen(false);
            setEditandoEntrada(null);
          }}
          obras={obras}
          insumos={insumos}
          fornecedores={fornecedores}
          depositosMaterial={depositosMaterial}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarEntradaMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalEntradaOpen(false);
            setEditandoEntrada(null);
          }}
        />
      </Modal>

      {/* Modal Saida */}
      <Modal
        open={modalSaidaOpen}
        onClose={() => {
          setModalSaidaOpen(false);
          setEditandoSaida(null);
        }}
        title={editandoSaida ? 'Editar Saída' : 'Nova Saída de Material'}
      >
        <SaidaMaterialForm
          initial={editandoSaida}
          onSubmit={handleSubmitSaida}
          onCancel={() => {
            setModalSaidaOpen(false);
            setEditandoSaida(null);
          }}
          obras={obras}
          insumos={insumos}
          etapas={etapas}
          depositosMaterial={depositosMaterial}
          unidades={unidades}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarSaidaMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalSaidaOpen(false);
            setEditandoSaida(null);
          }}
        />
      </Modal>

      {/* Modal Exportar */}
      <ExportarInsumosModal
        open={modalExportarOpen}
        onClose={() => setModalExportarOpen(false)}
        entradas={entradasFiltradas}
        saidas={saidasFiltradas}
        transferencias={transferenciasFiltradas}
        obras={obras}
        depositos={depositosMaterial}
      />

      {/* Modal Transferencia */}
      <Modal
        open={modalTransferenciaOpen}
        onClose={() => setModalTransferenciaOpen(false)}
        title="Nova Transferência de Material"
      >
        <TransferenciaMaterialForm
          onSubmit={handleSubmitTransferencia}
          onCancel={() => setModalTransferenciaOpen(false)}
          depositosMaterial={depositosMaterial}
          insumos={insumos}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarTransferenciaMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalTransferenciaOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
