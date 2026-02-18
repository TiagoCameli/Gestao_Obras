import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Abastecimento, EntradaCombustivel, TransferenciaCombustivel, FiltrosAbastecimento } from '../types';
import { useAbastecimentos, useAdicionarAbastecimento, useAtualizarAbastecimento, useExcluirAbastecimento } from '../hooks/useAbastecimentos';
import { useEntradasCombustivel, useAdicionarEntradaCombustivel, useAtualizarEntradaCombustivel, useExcluirEntradaCombustivel } from '../hooks/useEntradasCombustivel';
import { useTransferenciasCombustivel, useAdicionarTransferenciaCombustivel, useExcluirTransferenciaCombustivel } from '../hooks/useTransferenciasCombustivel';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useDepositos } from '../hooks/useDepositos';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import AbastecimentoForm from '../components/combustivel/AbastecimentoForm';
import AbastecimentoFilters from '../components/combustivel/AbastecimentoFilters';
import AbastecimentoList from '../components/combustivel/AbastecimentoList';
import EntradaForm from '../components/combustivel/EntradaForm';
import EntradaList from '../components/combustivel/EntradaList';
import TransferenciaForm from '../components/combustivel/TransferenciaForm';
import TransferenciaList from '../components/combustivel/TransferenciaList';
import CombustivelDashboard from '../components/combustivel/CombustivelDashboard';
import ExportarPDFModal from '../components/combustivel/ExportarPDFModal';
import PasswordDialog from '../components/ui/PasswordDialog';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'dashboard' | 'saidas' | 'entradas' | 'transferencias';

const FILTROS_VAZIOS: FiltrosAbastecimento = {
  obraId: '',
  tipoCombustivel: '',
  dataInicio: '',
  dataFim: '',
};

export default function Combustivel() {
  const { temAcao, usuario } = useAuth();
  const canEdit = temAcao('editar_combustivel');
  const canDelete = temAcao('excluir_combustivel');
  const canCreateEntrada = temAcao('criar_entrada_combustivel');
  const canCreateSaida = temAcao('criar_saida_combustivel');
  const canCreateTransferencia = temAcao('criar_transferencia_combustivel');
  const canExport = temAcao('exportar_combustivel');
  const canViewDashboard = temAcao('ver_dashboard_combustivel');
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['dashboard', 'saidas', 'entradas', 'transferencias'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const defaultTab: Tab = canViewDashboard ? 'dashboard' : 'entradas';
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : defaultTab;
  const setTab = useCallback((t: Tab) => setSearchParams({ tab: t }, { replace: true }), [setSearchParams]);

  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: depositos = [], isLoading } = useDepositos();
  const { data: todosAbastecimentos = [] } = useAbastecimentos();
  const { data: todasEntradas = [] } = useEntradasCombustivel();
  const { data: todasTransferencias = [] } = useTransferenciasCombustivel();

  const adicionarAbastecimentoMut = useAdicionarAbastecimento();
  const atualizarAbastecimentoMut = useAtualizarAbastecimento();
  const excluirAbastecimentoMut = useExcluirAbastecimento();
  const adicionarEntradaMut = useAdicionarEntradaCombustivel();
  const atualizarEntradaMut = useAtualizarEntradaCombustivel();
  const excluirEntradaMut = useExcluirEntradaCombustivel();
  const adicionarTransferenciaMut = useAdicionarTransferenciaCombustivel();
  const excluirTransferenciaMut = useExcluirTransferenciaCombustivel();

  // Saida state
  const [modalSaidaOpen, setModalSaidaOpen] = useState(false);
  const [editandoSaida, setEditandoSaida] = useState<Abastecimento | null>(null);
  const [filtros, setFiltros] = useState<FiltrosAbastecimento>(FILTROS_VAZIOS);

  // Entrada state
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [editandoEntrada, setEditandoEntrada] = useState<EntradaCombustivel | null>(null);

  // Transferencia state
  const [modalTransferenciaOpen, setModalTransferenciaOpen] = useState(false);

  // Exportar PDF state
  const [modalExportarOpen, setModalExportarOpen] = useState(false);

  // Helper: filtrar por data
  function filtrarPorData(dataHora: string): boolean {
    if (filtros.dataInicio && new Date(dataHora) < new Date(filtros.dataInicio)) return false;
    if (filtros.dataFim && new Date(dataHora) > new Date(filtros.dataFim + 'T23:59:59')) return false;
    return true;
  }

  const abastecimentosFiltrados = useMemo(() => {
    return todosAbastecimentos.filter((a) => {
      if (filtros.obraId && a.obraId !== filtros.obraId) return false;
      if (filtros.tipoCombustivel && a.tipoCombustivel !== filtros.tipoCombustivel)
        return false;
      if (!filtrarPorData(a.dataHora)) return false;
      return true;
    });
  }, [todosAbastecimentos, filtros]);

  const entradasFiltradas = useMemo(() => {
    return todasEntradas.filter((e) => {
      if (filtros.obraId && e.obraId !== filtros.obraId) return false;
      if (filtros.tipoCombustivel && e.tipoCombustivel !== filtros.tipoCombustivel) return false;
      if (!filtrarPorData(e.dataHora)) return false;
      return true;
    });
  }, [todasEntradas, filtros]);

  const transferenciasFiltradas = useMemo(() => {
    return todasTransferencias.filter((t) => {
      if (!filtrarPorData(t.dataHora)) return false;
      return true;
    });
  }, [todasTransferencias, filtros]);

  // Saida handlers
  const handleSubmitSaida = useCallback(
    async (data: Abastecimento) => {
      if (editandoSaida) {
        await atualizarAbastecimentoMut.mutateAsync(data);
      } else {
        await adicionarAbastecimentoMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      }
      setModalSaidaOpen(false);
      setEditandoSaida(null);
    },
    [editandoSaida, atualizarAbastecimentoMut, adicionarAbastecimentoMut]
  );

  // Password gate para edicao
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

  const handleEditSaida = useCallback((ab: Abastecimento) => {
    pedirSenha(() => {
      setEditandoSaida(ab);
      setModalSaidaOpen(true);
    });
  }, []);

  const handleDeleteSaida = useCallback(async (id: string) => {
    await excluirAbastecimentoMut.mutateAsync(id);
  }, [excluirAbastecimentoMut]);

  // Entrada handlers
  const handleSubmitEntrada = useCallback(
    async (data: EntradaCombustivel) => {
      if (editandoEntrada) {
        await atualizarEntradaMut.mutateAsync(data);
      } else {
        await adicionarEntradaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      }
      setModalEntradaOpen(false);
      setEditandoEntrada(null);
    },
    [editandoEntrada, atualizarEntradaMut, adicionarEntradaMut]
  );

  const handleEditEntrada = useCallback((ent: EntradaCombustivel) => {
    pedirSenha(() => {
      setEditandoEntrada(ent);
      setModalEntradaOpen(true);
    });
  }, []);

  const handleDeleteEntrada = useCallback(async (id: string) => {
    await excluirEntradaMut.mutateAsync(id);
  }, [excluirEntradaMut]);

  // Transferencia handlers
  const handleSubmitTransferencia = useCallback(
    async (data: TransferenciaCombustivel) => {
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
        <h1 className="text-3xl font-bold text-gray-800">Combustível</h1>
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
            <Button
              onClick={() => setModalTransferenciaOpen(true)}
            >
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
      <AbastecimentoFilters
        filtros={filtros}
        onChange={setFiltros}
        onClear={() => setFiltros(FILTROS_VAZIOS)}
        obras={obras}
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
        <CombustivelDashboard
          abastecimentos={abastecimentosFiltrados}
          entradas={entradasFiltradas}
          todasEntradas={todasEntradas}
          todosAbastecimentos={todosAbastecimentos}
          obras={obras}
          etapas={etapas}
          depositos={depositos}
        />
      )}

      {tab === 'saidas' && (
        <AbastecimentoList
          abastecimentos={abastecimentosFiltrados}
          obras={obras}
          onEdit={handleEditSaida}
          onDelete={(id) => pedirSenha(() => handleDeleteSaida(id))}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {tab === 'entradas' && (
        <EntradaList
          entradas={entradasFiltradas}
          obras={obras}
          depositos={depositos}
          onEdit={handleEditEntrada}
          onDelete={(id) => pedirSenha(() => handleDeleteEntrada(id))}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {tab === 'transferencias' && (
        <TransferenciaList
          transferencias={transferenciasFiltradas}
          depositos={depositos}
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

      {/* Modal Saida */}
      <Modal
        open={modalSaidaOpen}
        onClose={() => {
          setModalSaidaOpen(false);
          setEditandoSaida(null);
        }}
        title={editandoSaida ? 'Editar Saída' : 'Nova Saída de Combustível'}
      >
        <AbastecimentoForm
          initial={editandoSaida}
          onSubmit={handleSubmitSaida}
          onCancel={() => {
            setModalSaidaOpen(false);
            setEditandoSaida(null);
          }}
          obras={obras}
          etapas={etapas}
          depositos={depositos}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarAbastecimentoMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalSaidaOpen(false);
            setEditandoSaida(null);
          }}
        />
      </Modal>

      {/* Modal Entrada */}
      <Modal
        open={modalEntradaOpen}
        onClose={() => {
          setModalEntradaOpen(false);
          setEditandoEntrada(null);
        }}
        title={editandoEntrada ? 'Editar Entrada' : 'Nova Entrada de Combustível'}
      >
        <EntradaForm
          initial={editandoEntrada}
          onSubmit={handleSubmitEntrada}
          onCancel={() => {
            setModalEntradaOpen(false);
            setEditandoEntrada(null);
          }}
          obras={obras}
          depositos={depositos}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarEntradaMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalEntradaOpen(false);
            setEditandoEntrada(null);
          }}
        />
      </Modal>

      {/* Modal Transferencia */}
      <Modal
        open={modalTransferenciaOpen}
        onClose={() => setModalTransferenciaOpen(false)}
        title="Nova Transferência de Combustível"
      >
        <TransferenciaForm
          onSubmit={handleSubmitTransferencia}
          onCancel={() => setModalTransferenciaOpen(false)}
          depositos={depositos}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarTransferenciaMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalTransferenciaOpen(false);
          }}
        />
      </Modal>

      {/* Modal Exportar PDF */}
      <ExportarPDFModal
        open={modalExportarOpen}
        onClose={() => setModalExportarOpen(false)}
        abastecimentos={abastecimentosFiltrados}
        entradas={entradasFiltradas}
        transferencias={transferenciasFiltradas}
        obras={obras}
        depositos={depositos}
      />
    </div>
  );
}
