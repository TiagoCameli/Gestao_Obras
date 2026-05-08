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
import ExportarPDFModal from '../../combustivel/ExportarPDFModal';
// v2 — IA premium da página /combustivel (F1+)
import { CombustivelFilterProvider } from '../../combustivel/v2/filters/FilterContext';
import FilterBar from '../../combustivel/v2/filters/FilterBar';
import FilterChips from '../../combustivel/v2/filters/FilterChips';
import CombustivelTabsNav, { type CombustivelTabId } from '../../combustivel/v2/CombustivelTabsNav';
import VisaoGeralTab from '../../combustivel/v2/visao-geral/VisaoGeralTab';
import ModeSwitch from '../../combustivel/v2/ModeSwitch';
import ComingSoon from '../../combustivel/v2/ComingSoon';
import ConsumidoresPlaceholder from '../../combustivel/v2/ConsumidoresPlaceholder';

type SubTab = CombustivelTabId;

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

  const [subTab, setSubTab] = useState<SubTab>('visao_geral');

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

  // Listas distinct pra alimentar o multi-select da FilterBar v2.
  const fornecedoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const e of todasEntradas) {
      const v = (e.fornecedor || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todasEntradas]);

  const operadoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const s of todasSaidas) {
      const v = (s.motorista || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todasSaidas]);

  // Placas distinct (apenas saídas de carreta — onde placa faz sentido).
  const placasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const s of todasSaidas) {
      if (s.tipoConsumidor !== 'carreta_transportadora') continue;
      const v = (s.placa || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todasSaidas]);

  // Maps id→label pra resolver chips de filtro globais
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const equipamentosMap = useMemo(() => new Map(todosEquipamentos.map((e) => [e.id, e.nome])), [todosEquipamentos]);
  const insumosMap = useMemo(() => new Map(todosInsumos.map((i) => [i.id, i.nome])), [todosInsumos]);
  const transportadorasMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);

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

  // Saídas operacionais (sem dashboard / analítico / relatórios) ainda
  // dependem do AbastecimentoFilters legado. Migra na F2.
  const isOperacional =
    subTab === 'entradas' || subTab === 'saidas' || subTab === 'transferencias';

  return (
    <CombustivelFilterProvider>
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 px-3 sm:px-4 pt-1">
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

      {/* Mode switch — separa "dois mundos" da operação (proprios vs carretas).
          Compartilha tanques. */}
      <div className="px-3 sm:px-4">
        <ModeSwitch />
      </div>

      {/* Barra global de filtros (sticky) — dirige a Visão Geral.
          Filtro legado das abas operacionais fica abaixo, apenas nelas. */}
      <FilterBar
        obras={obras}
        equipamentos={todosEquipamentos}
        combustiveis={combustiveis}
        fornecedoresDisponiveis={fornecedoresDisponiveis}
        operadoresDisponiveis={operadoresDisponiveis}
        transportadoras={transportadoras}
        placasDisponiveis={placasDisponiveis}
      />
      <FilterChips
        obrasMap={obrasMap}
        equipamentosMap={equipamentosMap}
        insumosMap={insumosMap}
        transportadorasMap={transportadorasMap}
      />

      {/* Filtro legado — só nas abas operacionais até F2 migrar elas. */}
      {isOperacional && (
        <div className="px-3 sm:px-4">
          <AbastecimentoFilters
            filtros={filtros}
            onChange={setFiltros}
            onClear={() => setFiltros(FILTROS_VAZIOS)}
            obras={obras}
          />
        </div>
      )}

      {/* Sub-tab navigation v2 */}
      <div className="px-3 sm:px-4">
        <CombustivelTabsNav active={subTab} onChange={setSubTab} />
      </div>

      {/* Sub-tab content */}
      <div className="px-3 sm:px-4">
      {subTab === 'visao_geral' && (
        <VisaoGeralTab
          saidas={todasSaidas}
          entradas={todasEntradas}
          obras={obras}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          onVerTodasSaidas={() => setSubTab('saidas')}
        />
      )}

      {subTab === 'consumidores' && <ConsumidoresPlaceholder />}

      {subTab === 'obras' && (
        <ComingSoon
          phase="F2"
          title="Análise por Obra"
          description="Custo por obra com top equipamentos consumidores, % do total da operação e drill-down por período."
        />
      )}

      {subTab === 'fornecedores' && (
        <ComingSoon
          phase="F2"
          title="Comparativo de Fornecedores"
          description="R$/L de compra por fornecedor com mín / médio / máx, # de compras e tendência. Destaca o melhor preço do período."
        />
      )}

      {subTab === 'anomalias' && (
        <ComingSoon
          phase="F3"
          title="Anomalias e Insights"
          description="Equipamentos com consumo crescente, fornecedores acima da média, detecção de gastos fora do padrão. Cálculo cliente-side via histórico de medição."
        />
      )}

      {subTab === 'relatorios' && (
        <ComingSoon
          phase="F4"
          title="Relatórios premium"
          description="Templates dedicados (Mensal Consolidado, por Obra, por Equipamento, Anomalias, Raw export) com PDF e Excel multi-aba branded."
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
      </div>

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
    </CombustivelFilterProvider>
  );
}
