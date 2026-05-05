import { useState, useCallback, useMemo } from 'react';
import type {
  Abastecimento,
  EntradaCombustivel,
  TransferenciaCombustivel,
  Deposito,
  FiltrosAbastecimento,
  SaidaCombustivel,
} from '../../../types';
import { useObras } from '../../../hooks/useObras';
import { useEtapas } from '../../../hooks/useEtapas';
import { useDepositos, useAdicionarDeposito, useAtualizarDeposito, useExcluirDeposito } from '../../../hooks/useDepositos';
// Hooks novos (Fase 3) — saídas via tabela unificada saidas_combustivel
import { useSaidasCombustivel, useAdicionarSaidaCombustivel, useAtualizarSaidaCombustivel, useExcluirSaidaCombustivel } from '../../../hooks/useSaidasCombustivel';
import { useEntradasCombustivel, useAdicionarEntradaCombustivel, useAtualizarEntradaCombustivel, useExcluirEntradaCombustivel } from '../../../hooks/useEntradasCombustivel';
import { useTransferenciasCombustivel, useAdicionarTransferenciaCombustivel, useExcluirTransferenciaCombustivel } from '../../../hooks/useTransferenciasCombustivel';
import { useEquipamentos } from '../../../hooks/useEquipamentos';
import { useFornecedores } from '../../../hooks/useFornecedores';
import { useInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import PasswordDialog from '../../ui/PasswordDialog';
import AbastecimentoFilters from '../../combustivel/AbastecimentoFilters';
// Saída unificada (Fase 4)
import SaidaCombustivelForm from '../../combustivel/SaidaCombustivelForm';
import SaidaCombustivelList from '../../combustivel/SaidaCombustivelList';
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
  // Depositos: divididos por uso.
  // - depositosTodos (incluindo externos): pra views/lists/dashboards/exports.
  //   Garante que rows com depósito externo (Transterra) renderizam o nome.
  // - depositosOperacionais (default, só internos): pra forms que CRIAM rows.
  //   Triggers do DB bloqueiam INSERT em externos — filtro UI evita 4xx.
  const { data: depositosTodos = [] } = useDepositos({ incluirExternos: true });
  const { data: depositosOperacionais = [] } = useDepositos();
  // Saídas via tabela unificada (Fase 3) — fonte canônica.
  const { data: todasSaidas = [] } = useSaidasCombustivel();
  // Adapter inline pro shape Abastecimento legado (CombustivelDashboard
  // ignora via _abastLegacy; ExportarPDFModal ainda consome). Será removido
  // quando ExportarPDFModal migrar pra SaidaCombustivel (Commit 5).
  const todosAbastecimentos: Abastecimento[] = useMemo(
    () => todasSaidas.map((s) => ({
      id: s.id,
      dataHora: s.data,
      tipoCombustivel: s.tipoCombustivel ?? '',
      quantidadeLitros: s.litros,
      valorTotal: s.valorTotal,
      obraId: s.obraId ?? '',
      etapaId: s.etapaId ?? '',
      alocacoes: s.alocacoes ?? [],
      depositoId: s.tanqueId ?? '',
      equipamentoId: (s.equipamentoId === 'desconhecido' ? '' : (s.equipamentoId ?? '')),
      veiculo: '',
      fotosUrls: s.fotoUrls ?? [],
      observacoes: s.observacoes ?? '',
      criadoPor: s.createdBy ?? '',
      origemCombustivel: s.origem,
      fornecedor: '',
      pago: s.pago ?? false,
      dataPagamento: s.pagoEm ?? '',
      pagoPor: '',
    })),
    [todasSaidas]
  );
  const { data: todasEntradas = [] } = useEntradasCombustivel();
  const { data: todasTransferencias = [] } = useTransferenciasCombustivel();
  const { data: todosEquipamentos = [] } = useEquipamentos();
  const { data: todosFornecedores = [] } = useFornecedores();
  const { data: todosInsumos = [] } = useInsumos();

  // Transportadoras filtradas pra forms/lists de saídas
  const transportadoras = useMemo(
    () => todosFornecedores.filter((f) => f.ehTransportadora && f.ativo !== false),
    [todosFornecedores]
  );

  // Combustíveis = insumos tipo 'combustivel' ativos
  const combustiveis = useMemo(
    () => todosInsumos.filter((i) => i.tipo === 'combustivel' && i.ativo !== false),
    [todosInsumos]
  );

  // Deposito mutations
  const adicionarDepositoMut = useAdicionarDeposito();
  const atualizarDepositoMut = useAtualizarDeposito();
  const excluirDepositoMut = useExcluirDeposito();

  // Saída mutations (modelo unificado Fase 3)
  const adicionarSaidaMut = useAdicionarSaidaCombustivel();
  const atualizarSaidaMut = useAtualizarSaidaCombustivel();
  const excluirSaidaMut = useExcluirSaidaCombustivel();

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

  // Saida state (modelo unificado Fase 3/4)
  const [modalSaidaOpen, setModalSaidaOpen] = useState(false);
  const [editandoSaida, setEditandoSaida] = useState<SaidaCombustivel | null>(null);

  // Entrada state
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [editandoEntrada, setEditandoEntrada] = useState<EntradaCombustivel | null>(null);

  // Transferencia state
  const [modalTransferenciaOpen, setModalTransferenciaOpen] = useState(false);

  // Exportar state
  const [modalExportarOpen, setModalExportarOpen] = useState(false);

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

  // Filtro shape antigo (Abastecimento.dataHora) — usado pelo Dashboard +
  // ExportarPDFModal que ainda recebem o shape antigo via shim.
  const abastecimentosFiltrados = useMemo(() => {
    return todosAbastecimentos.filter((a) => {
      if (filtros.obraId && a.obraId !== filtros.obraId) return false;
      if (filtros.tipoCombustivel && a.tipoCombustivel !== filtros.tipoCombustivel) return false;
      if (!filtrarPorData(a.dataHora)) return false;
      return true;
    });
  }, [todosAbastecimentos, filtros]);

  // Saídas no shape novo (SaidaCombustivel.data) — alimenta SaidaCombustivelList.
  const saidasFiltradas = useMemo(() => {
    return todasSaidas.filter((s) => {
      if (filtros.obraId && s.obraId !== filtros.obraId) return false;
      if (filtros.tipoCombustivel && s.tipoCombustivel !== filtros.tipoCombustivel) return false;
      if (!filtrarPorData(s.data)) return false;
      return true;
    });
  }, [todasSaidas, filtros]);

  const entradasFiltradas = useMemo(() => {
    return todasEntradas.filter((e) => {
      // Entradas são globais — sem filtro por obra.
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

  // Saida handlers (modelo unificado SaidaCombustivel)
  const handleSubmitSaida = useCallback(
    async (saida: SaidaCombustivel) => {
      if (editandoSaida) {
        await atualizarSaidaMut.mutateAsync(saida);
      } else {
        await adicionarSaidaMut.mutateAsync({ ...saida, createdBy: usuario?.nome || null });
      }
      setModalSaidaOpen(false);
      setEditandoSaida(null);
    },
    [editandoSaida, atualizarSaidaMut, adicionarSaidaMut, usuario]
  );

  const handleEditSaida = useCallback((s: SaidaCombustivel) => {
    pedirSenha(() => {
      setEditandoSaida(s);
      setModalSaidaOpen(true);
    });
  }, []);

  const handleDeleteSaida = useCallback(
    async (id: string) => {
      await excluirSaidaMut.mutateAsync(id);
    },
    [excluirSaidaMut]
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
          depositos={depositosTodos}
        />
      )}

      {subTab === 'tanques' && (
        <TanqueList
          depositos={depositosTodos}
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
          depositos={depositosTodos}
          onEdit={handleEditEntrada}
          onDelete={(id) => pedirSenha(() => handleDeleteEntrada(id))}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {subTab === 'saidas' && (
        <SaidaCombustivelList
          saidas={saidasFiltradas}
          obras={obras}
          depositos={depositosTodos}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          onEdit={handleEditSaida}
          onDelete={(id) => pedirSenha(() => handleDeleteSaida(id))}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {subTab === 'transferencias' && (
        <TransferenciaList
          transferencias={transferenciasFiltradas}
          depositos={depositosTodos}
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
        />
      </Modal>

      {/* Modal Saida (form unificado Fase 4) */}
      <Modal
        open={modalSaidaOpen}
        onClose={() => { setModalSaidaOpen(false); setEditandoSaida(null); }}
        title={editandoSaida ? 'Editar Saída' : 'Nova Saída de Combustível'}
        size="lg"
      >
        <SaidaCombustivelForm
          initial={editandoSaida}
          onSubmit={handleSubmitSaida}
          onCancel={() => { setModalSaidaOpen(false); setEditandoSaida(null); }}
          obras={obras}
          etapas={etapas}
          depositos={depositosTodos}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          entradasCombustivel={todasEntradas}
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
          depositos={depositosOperacionais}
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
          depositos={depositosOperacionais}
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
        depositos={depositosTodos}
      />
    </div>
  );
}
