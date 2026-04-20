import { useState, useCallback, useMemo } from 'react';
import type { Abastecimento, EntradaCombustivel, TransferenciaCombustivel, Deposito, FiltrosAbastecimento } from '../../../types';
import { useObras } from '../../../hooks/useObras';
import { useEtapas } from '../../../hooks/useEtapas';
import { useDepositos, useAdicionarDeposito, useAtualizarDeposito, useExcluirDeposito } from '../../../hooks/useDepositos';
import { useAbastecimentos, useAdicionarAbastecimento, useAtualizarAbastecimento, useExcluirAbastecimento, useMarcarAbastecimentoPago, useDesmarcarAbastecimentoPago } from '../../../hooks/useAbastecimentos';
import { useEntradasCombustivel, useAdicionarEntradaCombustivel, useAtualizarEntradaCombustivel, useExcluirEntradaCombustivel } from '../../../hooks/useEntradasCombustivel';
import { useTransferenciasCombustivel, useAdicionarTransferenciaCombustivel, useExcluirTransferenciaCombustivel } from '../../../hooks/useTransferenciasCombustivel';
import { useAuth } from '../../../contexts/AuthContext';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import PasswordDialog from '../../ui/PasswordDialog';
import AbastecimentoFilters from '../../combustivel/AbastecimentoFilters';
import AbastecimentoForm from '../../combustivel/AbastecimentoForm';
import AbastecimentoList from '../../combustivel/AbastecimentoList';
import AbastecimentoExternoList from '../../combustivel/AbastecimentoExternoList';
import EntradaForm from '../../combustivel/EntradaForm';
import EntradaList from '../../combustivel/EntradaList';
import TransferenciaForm from '../../combustivel/TransferenciaForm';
import TransferenciaList from '../../combustivel/TransferenciaList';
import TanqueList from './TanqueList';
import TanqueForm from './TanqueForm';
import CombustivelDashboard from '../../combustivel/CombustivelDashboard';
import ExportarPDFModal from '../../combustivel/ExportarPDFModal';

type SubTab = 'dashboard' | 'tanques' | 'entradas' | 'saidas' | 'transferencias';

const FILTROS_VAZIOS: FiltrosAbastecimento = {
  obraId: '',
  tipoCombustivel: '',
  dataInicio: '',
  dataFim: '',
};

export default function FrotaCombustivelContainer() {
  const { temAcao, usuario } = useAuth();
  const canEdit = temAcao('editar_combustivel');
  const canDelete = temAcao('excluir_combustivel');
  const canCreateEntrada = temAcao('criar_entrada_combustivel');
  const canCreateSaida = temAcao('criar_saida_combustivel');
  const canCreateTransferencia = temAcao('criar_transferencia_combustivel');

  const [subTab, setSubTab] = useState<SubTab>('dashboard');

  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: depositos = [] } = useDepositos();
  const { data: todosAbastecimentos = [] } = useAbastecimentos();
  const { data: todasEntradas = [] } = useEntradasCombustivel();
  const { data: todasTransferencias = [] } = useTransferenciasCombustivel();

  // Deposito mutations
  const adicionarDepositoMut = useAdicionarDeposito();
  const atualizarDepositoMut = useAtualizarDeposito();
  const excluirDepositoMut = useExcluirDeposito();

  // Abastecimento mutations
  const adicionarAbastecimentoMut = useAdicionarAbastecimento();
  const atualizarAbastecimentoMut = useAtualizarAbastecimento();
  const excluirAbastecimentoMut = useExcluirAbastecimento();
  const marcarPagoMut = useMarcarAbastecimentoPago();
  const desmarcarPagoMut = useDesmarcarAbastecimentoPago();

  // Entrada mutations
  const adicionarEntradaMut = useAdicionarEntradaCombustivel();
  const atualizarEntradaMut = useAtualizarEntradaCombustivel();
  const excluirEntradaMut = useExcluirEntradaCombustivel();

  // Transferencia mutations
  const adicionarTransferenciaMut = useAdicionarTransferenciaCombustivel();
  const excluirTransferenciaMut = useExcluirTransferenciaCombustivel();

  // Filtros
  const [filtros, setFiltros] = useState<FiltrosAbastecimento>(FILTROS_VAZIOS);

  // Tanque state
  const [modalTanqueOpen, setModalTanqueOpen] = useState(false);
  const [editandoTanque, setEditandoTanque] = useState<Deposito | null>(null);

  // Saida state
  const [modalSaidaOpen, setModalSaidaOpen] = useState(false);
  const [editandoSaida, setEditandoSaida] = useState<Abastecimento | null>(null);

  // Entrada state
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [editandoEntrada, setEditandoEntrada] = useState<EntradaCombustivel | null>(null);

  // Transferencia state
  const [modalTransferenciaOpen, setModalTransferenciaOpen] = useState(false);

  // Exportar state
  const [modalExportarOpen, setModalExportarOpen] = useState(false);

  // Sub-tab para saidas
  type SubTabSaida = 'tanque' | 'dinheiro' | 'requisicao';
  const [subTabSaida, setSubTabSaida] = useState<SubTabSaida>('tanque');

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

  // Filter helpers
  function filtrarPorData(dataHora: string): boolean {
    if (filtros.dataInicio && new Date(dataHora) < new Date(filtros.dataInicio)) return false;
    if (filtros.dataFim && new Date(dataHora) > new Date(filtros.dataFim + 'T23:59:59')) return false;
    return true;
  }

  const abastecimentosFiltrados = useMemo(() => {
    return todosAbastecimentos.filter((a) => {
      if (filtros.obraId && a.obraId !== filtros.obraId) return false;
      if (filtros.tipoCombustivel && a.tipoCombustivel !== filtros.tipoCombustivel) return false;
      if (!filtrarPorData(a.dataHora)) return false;
      return true;
    });
  }, [todosAbastecimentos, filtros]);

  const saidasTanque = useMemo(() => abastecimentosFiltrados.filter((a) => !a.origemCombustivel || a.origemCombustivel === 'tanque'), [abastecimentosFiltrados]);
  const saidasDinheiro = useMemo(() => abastecimentosFiltrados.filter((a) => a.origemCombustivel === 'dinheiro'), [abastecimentosFiltrados]);
  const saidasRequisicao = useMemo(() => abastecimentosFiltrados.filter((a) => a.origemCombustivel === 'requisicao'), [abastecimentosFiltrados]);

  const entradasFiltradas = useMemo(() => {
    return todasEntradas.filter((e) => {
      if (filtros.obraId && e.obraId !== filtros.obraId) return false;
      if (filtros.tipoCombustivel && e.tipoCombustivel !== filtros.tipoCombustivel) return false;
      if (!filtrarPorData(e.dataHora)) return false;
      return true;
    });
  }, [todasEntradas, filtros]);

  const transferenciasFiltradas = useMemo(() => {
    return todasTransferencias.filter((t) => filtrarPorData(t.dataHora));
  }, [todasTransferencias, filtros]);

  // Tanque handlers
  const handleSubmitTanque = useCallback(
    async (deposito: Deposito) => {
      if (editandoTanque) {
        await atualizarDepositoMut.mutateAsync(deposito);
      } else {
        await adicionarDepositoMut.mutateAsync({ ...deposito, criadoPor: usuario?.nome || '' });
      }
      setModalTanqueOpen(false);
      setEditandoTanque(null);
    },
    [editandoTanque, atualizarDepositoMut, adicionarDepositoMut, usuario]
  );

  const handleEditTanque = useCallback((deposito: Deposito) => {
    pedirSenha(() => {
      setEditandoTanque(deposito);
      setModalTanqueOpen(true);
    });
  }, []);

  const handleDeleteTanque = useCallback(
    async (id: string) => {
      pedirSenha(async () => {
        await excluirDepositoMut.mutateAsync(id);
      });
    },
    [excluirDepositoMut]
  );

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
    [editandoSaida, atualizarAbastecimentoMut, adicionarAbastecimentoMut, usuario]
  );

  const handleEditSaida = useCallback((ab: Abastecimento) => {
    pedirSenha(() => {
      setEditandoSaida(ab);
      setModalSaidaOpen(true);
    });
  }, []);

  const handleDeleteSaida = useCallback(
    async (id: string) => {
      await excluirAbastecimentoMut.mutateAsync(id);
    },
    [excluirAbastecimentoMut]
  );

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
    [editandoEntrada, atualizarEntradaMut, adicionarEntradaMut, usuario]
  );

  const handleEditEntrada = useCallback((ent: EntradaCombustivel) => {
    pedirSenha(() => {
      setEditandoEntrada(ent);
      setModalEntradaOpen(true);
    });
  }, []);

  const handleDeleteEntrada = useCallback(
    async (id: string) => {
      await excluirEntradaMut.mutateAsync(id);
    },
    [excluirEntradaMut]
  );

  // Transferencia handlers
  const handleSubmitTransferencia = useCallback(
    async (data: TransferenciaCombustivel) => {
      await adicionarTransferenciaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      setModalTransferenciaOpen(false);
    },
    [adicionarTransferenciaMut, usuario]
  );

  const handleDeleteTransferencia = useCallback(
    async (id: string) => {
      await excluirTransferenciaMut.mutateAsync(id);
    },
    [excluirTransferenciaMut]
  );

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'tanques', label: 'Tanques' },
    { key: 'entradas', label: 'Entradas' },
    { key: 'saidas', label: 'Saídas' },
    { key: 'transferencias', label: 'Transferências' },
  ];

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {canCreateEntrada && (
          <Button
            onClick={() => { setEditandoEntrada(null); setModalEntradaOpen(true); }}
            className="text-sm"
          >
            + Nova Entrada
          </Button>
        )}
        {canCreateSaida && (
          <Button
            onClick={() => { setEditandoSaida(null); setModalSaidaOpen(true); }}
            className="text-sm"
          >
            + Nova Saída
          </Button>
        )}
        {canCreateTransferencia && (
          <Button
            onClick={() => setModalTransferenciaOpen(true)}
            className="text-sm"
          >
            + Nova Transferência
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => setModalExportarOpen(true)}
          className="text-sm"
        >
          Exportar Relatório
        </Button>
      </div>

      {/* Filtros */}
      {subTab !== 'tanques' && subTab !== 'dashboard' && (
        <AbastecimentoFilters
          filtros={filtros}
          onChange={setFiltros}
          onClear={() => setFiltros(FILTROS_VAZIOS)}
          obras={obras}
        />
      )}

      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-gray-200 dark:bg-slate-700 rounded-lg p-1 w-fit overflow-x-auto">
        {subTabs.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === t.key
                ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'dashboard' && (
        <CombustivelDashboard
          abastecimentos={abastecimentosFiltrados}
          entradas={entradasFiltradas}
          todasEntradas={todasEntradas}
          todosAbastecimentos={todosAbastecimentos}
          transferencias={todasTransferencias}
          obras={obras}
          etapas={etapas}
          depositos={depositos}
        />
      )}

      {subTab === 'tanques' && (
        <TanqueList
          depositos={depositos}
          obras={obras}
          onEdit={handleEditTanque}
          onDelete={(id) => handleDeleteTanque(id)}
          canEdit={canEdit}
          canDelete={canDelete}
          onNovo={() => { setEditandoTanque(null); setModalTanqueOpen(true); }}
          canCreate={canCreateEntrada}
        />
      )}

      {subTab === 'entradas' && (
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

      {subTab === 'saidas' && (
        <div>
          {/* Sub-tabs de origem */}
          <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 w-fit">
            {([
              { key: 'tanque' as SubTabSaida, label: 'Tanque', count: saidasTanque.length },
              { key: 'dinheiro' as SubTabSaida, label: 'Dinheiro', count: saidasDinheiro.length },
              { key: 'requisicao' as SubTabSaida, label: 'Requisição', count: saidasRequisicao.length },
            ]).map((st) => (
              <button
                key={st.key}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  subTabSaida === st.key
                    ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
                onClick={() => setSubTabSaida(st.key)}
              >
                {st.label}
                <span className="ml-1.5 text-xs text-gray-400">({st.count})</span>
              </button>
            ))}
          </div>

          {subTabSaida === 'tanque' && (
            <AbastecimentoList
              abastecimentos={saidasTanque}
              obras={obras}
              onEdit={handleEditSaida}
              onDelete={(id) => pedirSenha(() => handleDeleteSaida(id))}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}

          {subTabSaida === 'dinheiro' && (
            <AbastecimentoExternoList
              abastecimentos={saidasDinheiro}
              obras={obras}
              onEdit={handleEditSaida}
              onDelete={(id) => pedirSenha(() => handleDeleteSaida(id))}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}

          {subTabSaida === 'requisicao' && (
            <AbastecimentoExternoList
              abastecimentos={saidasRequisicao}
              obras={obras}
              onEdit={handleEditSaida}
              onDelete={(id) => pedirSenha(() => handleDeleteSaida(id))}
              onMarcarPago={(id) => marcarPagoMut.mutate({ id, pagoPor: usuario?.nome || '' })}
              onDesmarcarPago={(id) => desmarcarPagoMut.mutate(id)}
              canEdit={canEdit}
              canDelete={canDelete}
              mostrarPagamento
            />
          )}
        </div>
      )}

      {subTab === 'transferencias' && (
        <TransferenciaList
          transferencias={transferenciasFiltradas}
          depositos={depositos}
          onDelete={(id) => pedirSenha(() => handleDeleteTransferencia(id))}
          canDelete={canDelete}
        />
      )}

      {/* Password dialog */}
      <PasswordDialog
        open={senhaOpen}
        onClose={() => { setSenhaOpen(false); setSenhaAction(null); }}
        onSuccess={() => {
          if (senhaAction) senhaAction();
          setSenhaAction(null);
        }}
        title="Senha de Edição"
      />

      {/* Modal Tanque */}
      <Modal
        open={modalTanqueOpen}
        onClose={() => { setModalTanqueOpen(false); setEditandoTanque(null); }}
        title={editandoTanque ? 'Editar Tanque' : 'Novo Tanque de Combustível'}
      >
        <TanqueForm
          initial={editandoTanque}
          onSubmit={handleSubmitTanque}
          onCancel={() => { setModalTanqueOpen(false); setEditandoTanque(null); }}
          obras={obras}
        />
      </Modal>

      {/* Modal Saida */}
      <Modal
        open={modalSaidaOpen}
        onClose={() => { setModalSaidaOpen(false); setEditandoSaida(null); }}
        title={editandoSaida ? 'Editar Saída' : 'Nova Saída de Combustível'}
      >
        <AbastecimentoForm
          initial={editandoSaida}
          onSubmit={handleSubmitSaida}
          onCancel={() => { setModalSaidaOpen(false); setEditandoSaida(null); }}
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
        onClose={() => { setModalEntradaOpen(false); setEditandoEntrada(null); }}
        title={editandoEntrada ? 'Editar Entrada' : 'Nova Entrada de Combustível'}
      >
        <EntradaForm
          initial={editandoEntrada}
          onSubmit={handleSubmitEntrada}
          onCancel={() => { setModalEntradaOpen(false); setEditandoEntrada(null); }}
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

      {/* Modal Exportar Relatório */}
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
